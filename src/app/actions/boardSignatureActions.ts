'use server';

import * as crypto from 'crypto';
import { pool } from '../../lib/db';
import { hashPassword } from '../../lib/crypto';
import { decryptAES } from '../../lib/crypto';
import { writeAuditLog } from './auditActions';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SignatureStatus = 'signed' | 'invalid' | 'pending';

export interface SignatureMemberRow {
    signerUserId: string;
    name: string;
    account: string;
    status: SignatureStatus;
    signedAt: string | null;
    /** Truncated thumbnail (first 120 chars of data URL) — full URL loaded on demand if needed. */
    thumbnail: string | null;
    /** 該董事個人審核資料（per-member opinion） */
    memberApproved: boolean | null;
    memberAmount: number | null;
    memberComments: string | null;
}

export interface BoardReviewSignatureStatus {
    currentHash: string;
    memberCount: number;
    signedCount: number;   // rows whose hash matches current
    members: SignatureMemberRow[];
}

type ActionResult<T = undefined> = T extends undefined
    ? { success: boolean; error?: string }
    : { success: boolean; data?: T; error?: string };

// ─── Internal: per-member hash（每位董事的雜湊只依自己的審核資料 + 派組 id） ──

function memberHashFromValues(
    applicationId: string,
    signerUserId: string,
    memberApproved: boolean | null,
    memberAmount: number | null,
    memberComments: string | null,
    assignedGroupId: string | null,
): string {
    const parts = [
        'v2',
        String(applicationId),
        String(signerUserId),
        memberApproved != null ? String(memberApproved) : 'null',
        memberAmount != null ? String(memberAmount) : 'null',
        memberComments != null ? memberComments : 'null',
        assignedGroupId != null ? String(assignedGroupId) : 'null',
    ];
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

/** 取得案件當前派組 id（per-member hash 需要） */
async function loadAssignedGroupId(client: any, applicationId: string): Promise<string | null> {
    const res = await client.query(
        `SELECT group_id FROM board_review_assignments WHERE application_id = $1::bigint LIMIT 1`,
        [applicationId]
    );
    if (res.rowCount === 0) return null;
    return String(res.rows[0].group_id);
}

// ─── Public: compute the current content hash ────────────────────────────────

/** 計算「本案某董事」的內容雜湊值（per-member）— 簽章時與此值綁定，編輯後雜湊不同則簽章 invalidated */
export async function computeMemberContentHash(
    applicationId: string,
    signerUserId: string,
): Promise<ActionResult<string>> {
    if (!/^\d+$/.test(applicationId) || !/^\d+$/.test(signerUserId)) {
        return { success: false, error: '無效的 ID' };
    }
    const client = await pool.connect();
    try {
        const groupId = await loadAssignedGroupId(client, applicationId);
        const memRes = await client.query(
            `SELECT member_approved, member_amount, member_comments
             FROM board_review_signatures
             WHERE application_id = $1::bigint AND signer_user_id = $2::bigint
             LIMIT 1`,
            [applicationId, signerUserId]
        );
        const m = memRes.rows[0];
        return {
            success: true,
            data: memberHashFromValues(
                applicationId,
                signerUserId,
                m?.member_approved ?? null,
                m?.member_amount != null ? Number(m.member_amount) : null,
                m?.member_comments ?? null,
                groupId,
            ),
        };
    } finally {
        client.release();
    }
}

// ─── Internal helper: invalidate all signatures within an existing tx client ─

export async function clearStaleSignatures(
    client: any,
    applicationId: string,
    reason: 'content_changed' | 'reassigned',
): Promise<void> {
    const delRes = await client.query(
        `DELETE FROM board_review_signatures
         WHERE application_id = $1::bigint
         RETURNING signer_user_id::text AS uid`,
        [applicationId]
    );
    const invalidatedIds = delRes.rows.map((r: any) => r.uid);
    if (invalidatedIds.length > 0) {
        void writeAuditLog({
            userId: null,
            action: 'board_review.signatures_invalidated',
            targetType: 'application',
            targetId: applicationId,
            detail: { reason, invalidated_user_ids: invalidatedIds },
        });
    }
}

// ─── 儲存個人審核草稿（不簽章；可單獨呼叫，不影響其他董事的簽章） ────────────

export async function saveMemberReviewOpinion(
    applicationId: string,
    operatorUserId: string,
    data: { approved: boolean | null; amount: number | null; comments: string | null },
): Promise<ActionResult<{ contentHash: string }>> {
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };

    // 字數守門：若系統設定了 board_opinion_min_chars > 0，意見字數須達標
    // （comments 為空也擋；強制董事一定要寫意見。若客戶想允許空白則把 min 設為 0）
    const { fetchSetting } = await import('./settingsActions');
    const minCharsRaw = await fetchSetting('board_opinion_min_chars', '50');
    const minChars = Number.isFinite(Number(minCharsRaw)) ? Math.max(0, Number(minCharsRaw)) : 0;
    if (minChars > 0) {
        const len = (data.comments ?? '').length;
        if (len < minChars) {
            return { success: false, error: `審核意見至少需 ${minChars} 字（目前 ${len} 字）` };
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // (a) 確認 stage / status
        const caseRes = await client.query(
            `SELECT a.status, w.stage
             FROM applications a
             LEFT JOIN application_workflow w ON w.application_id = a.id
             WHERE a.id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (caseRes.rowCount === 0 || caseRes.rows[0].status !== '1' || caseRes.rows[0].stage !== 'board_review') {
            await client.query('ROLLBACK');
            return { success: false, error: '此案件目前無法編輯審核資料' };
        }

        // (b) 必須為派組成員
        const groupId = await loadAssignedGroupId(client, applicationId);
        if (!groupId) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件尚未派組' };
        }
        const memRes = await client.query(
            `SELECT 1 FROM board_group_members
             WHERE group_id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
            [groupId, operatorUserId]
        );
        if ((memRes.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '您不是本案派組的成員' };
        }

        // (c) UPSERT — 若已有 row 則更新欄位（保留現有 signature_data_url / signed_at）；
        //     若未存在，需要先放 placeholder（empty signature）
        const existRes = await client.query(
            `SELECT 1 FROM board_review_signatures
             WHERE application_id = $1::bigint AND signer_user_id = $2::bigint LIMIT 1`,
            [applicationId, operatorUserId]
        );
        const newHash = memberHashFromValues(
            applicationId, operatorUserId,
            data.approved, data.amount, data.comments, groupId,
        );

        if ((existRes.rowCount ?? 0) > 0) {
            // 更新意見/金額/結果，但**不更新 content_hash 也不更新 signature_data_url / signed_at**：
            //   - content_hash 是簽章當下的快照；保留它讓 fetchBoardReviewSignatures 比對失敗 → 標記 'invalid'
            //   - 若覆蓋 content_hash，前端 expectedHash 永遠等於 stored_hash → 永遠顯示 signed（bug）
            // 對於尚未簽過的草稿（signature_data_url=''），status 本就是 pending，content_hash 不參與判定。
            await client.query(
                `UPDATE board_review_signatures
                 SET member_approved = $1,
                     member_amount   = $2,
                     member_comments = $3
                 WHERE application_id = $4::bigint AND signer_user_id = $5::bigint`,
                [data.approved, data.amount, data.comments, applicationId, operatorUserId]
            );
        } else {
            // 尚未簽過：插一筆 placeholder（signature_data_url 用空字串，前端可判斷未簽章）
            await client.query(
                `INSERT INTO board_review_signatures
                    (application_id, signer_user_id, signature_data_url, content_hash,
                     member_approved, member_amount, member_comments)
                 VALUES ($1::bigint, $2::bigint, '', $3, $4, $5, $6)`,
                [applicationId, operatorUserId, newHash, data.approved, data.amount, data.comments]
            );
        }

        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId,
            action: 'board_review.draft_save',
            targetType: 'application',
            targetId: applicationId,
            detail: {
                approved: data.approved,
                amount: data.amount,
                comments_length: data.comments?.length ?? 0,
            },
        });

        return { success: true, data: { contentHash: newHash } };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('saveMemberReviewOpinion error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Submit a single signature ───────────────────────────────────────────────

export async function submitBoardSignature(
    applicationId: string,
    signatureDataUrl: string,
    password: string,
    operatorUserId: string,
    meta?: { userAgent?: string; ipAddress?: string },
): Promise<ActionResult<{ contentHash: string }>> {
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };
    if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
        return { success: false, error: '簽名圖像格式不正確' };
    }
    if (!password) return { success: false, error: '請輸入密碼' };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // (a) stage + status
        const caseRes = await client.query(
            `SELECT a.status, w.stage
             FROM applications a
             LEFT JOIN application_workflow w ON w.application_id = a.id
             WHERE a.id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (caseRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件不存在' };
        }
        if (caseRes.rows[0].status !== '1' || caseRes.rows[0].stage !== 'board_review') {
            await client.query('ROLLBACK');
            return { success: false, error: '此案件目前無法簽章（非 board_review 階段或已結案）' };
        }

        // (b) has assignment
        const asgRes = await client.query(
            `SELECT group_id FROM board_review_assignments WHERE application_id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (asgRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件尚未派組，無法簽章' };
        }
        const assignedGroupId = String(asgRes.rows[0].group_id);

        // (c) operator is current member
        const memRes = await client.query(
            `SELECT 1 FROM board_group_members
             WHERE group_id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
            [assignedGroupId, operatorUserId]
        );
        if ((memRes.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '您不是本案派組的成員，無法簽章' };
        }

        // (d) password re-auth
        const userRes = await client.query(
            `SELECT search_salt, password FROM users WHERE id = $1::bigint LIMIT 1`,
            [operatorUserId]
        );
        if (userRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '使用者不存在' };
        }
        const u = userRes.rows[0];
        const saltBuffer = Buffer.isBuffer(u.search_salt) ? u.search_salt : Buffer.from(String(u.search_salt ?? ''), 'hex');
        const providedHash = hashPassword(password, saltBuffer);
        if (providedHash !== u.password) {
            await client.query('ROLLBACK');
            return { success: false, error: '密碼錯誤' };
        }

        // (e) per-member hash — 取該位董事自己當前的草稿值
        const memDraftRes = await client.query(
            `SELECT member_approved, member_amount, member_comments
             FROM board_review_signatures
             WHERE application_id = $1::bigint AND signer_user_id = $2::bigint LIMIT 1`,
            [applicationId, operatorUserId]
        );
        const m = memDraftRes.rows[0];
        const memberApproved  = m?.member_approved ?? null;
        const memberAmount    = m?.member_amount != null ? Number(m.member_amount) : null;
        const memberComments  = m?.member_comments ?? null;

        // 必須有自己的審核結果才能簽章
        if (memberApproved === null) {
            await client.query('ROLLBACK');
            return { success: false, error: '請先儲存個人審核結果（通過/不通過）後再簽章' };
        }

        // 字數守門：與 save draft 同樣的最少字數限制（防止 client 直接呼叫 submit 繞過）
        const { fetchSetting } = await import('./settingsActions');
        const minCharsRaw = await fetchSetting('board_opinion_min_chars', '50');
        const minChars = Number.isFinite(Number(minCharsRaw)) ? Math.max(0, Number(minCharsRaw)) : 0;
        if (minChars > 0) {
            const len = (memberComments ?? '').length;
            if (len < minChars) {
                await client.query('ROLLBACK');
                return { success: false, error: `審核意見至少需 ${minChars} 字（目前 ${len} 字），請先補齊後再簽章` };
            }
        }

        const contentHash = memberHashFromValues(
            applicationId, operatorUserId,
            memberApproved, memberAmount, memberComments, assignedGroupId,
        );

        // UPSERT signature（保留 member_* 草稿欄位）
        await client.query(
            `INSERT INTO board_review_signatures
                (application_id, signer_user_id, signature_data_url, content_hash, signed_at, user_agent, ip_address,
                 member_approved, member_amount, member_comments)
             VALUES ($1::bigint, $2::bigint, $3, $4, NOW(), $5, $6, $7, $8, $9)
             ON CONFLICT (application_id, signer_user_id) DO UPDATE SET
                signature_data_url = EXCLUDED.signature_data_url,
                content_hash       = EXCLUDED.content_hash,
                signed_at          = EXCLUDED.signed_at,
                user_agent         = EXCLUDED.user_agent,
                ip_address         = EXCLUDED.ip_address`,
            [applicationId, operatorUserId, signatureDataUrl, contentHash,
             meta?.userAgent ?? null, meta?.ipAddress ?? null,
             memberApproved, memberAmount, memberComments]
        );

        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId,
            action: 'board_review.signature_added',
            targetType: 'application',
            targetId: applicationId,
            detail: { signer_user_id: operatorUserId, content_hash: contentHash },
        });

        return { success: true, data: { contentHash } };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('submitBoardSignature error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Fetch all signatures + validity status for the case ─────────────────────

export async function fetchBoardReviewSignatures(
    applicationId: string,
): Promise<ActionResult<BoardReviewSignatureStatus>> {
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        const groupId = await loadAssignedGroupId(client, applicationId);
        if (!groupId) {
            return {
                success: true,
                data: { currentHash: '', memberCount: 0, signedCount: 0, members: [] },
            };
        }

        const res = await client.query(
            `SELECT u.id::text AS user_id, u.account, u.name_enc, u.name_iv,
                    s.signature_data_url, s.content_hash, s.signed_at,
                    s.member_approved, s.member_amount, s.member_comments
             FROM board_group_members m
             JOIN users u ON u.id = m.user_id
             LEFT JOIN board_review_signatures s
               ON s.application_id = $1::bigint AND s.signer_user_id = m.user_id
             WHERE m.group_id = $2::bigint
             ORDER BY u.account ASC`,
            [applicationId, groupId]
        );

        let signedCount = 0;
        const members: SignatureMemberRow[] = res.rows.map((r: any) => {
            const name = r.name_enc && r.name_iv
                ? decryptAES(r.name_enc, r.name_iv) || '未知'
                : '未知';
            let status: SignatureStatus = 'pending';
            // 簽章視為有效需要：(1) 有 signature_data_url 非空，(2) 雜湊符合當前 per-member 值
            if (r.signature_data_url && r.signature_data_url !== '') {
                const expectedHash = memberHashFromValues(
                    applicationId, String(r.user_id),
                    r.member_approved ?? null,
                    r.member_amount != null ? Number(r.member_amount) : null,
                    r.member_comments ?? null,
                    groupId,
                );
                if (r.content_hash === expectedHash) {
                    status = 'signed';
                    signedCount += 1;
                } else {
                    status = 'invalid';
                }
            }
            return {
                signerUserId: String(r.user_id),
                name,
                account: r.account,
                status,
                signedAt: r.signed_at ? new Date(r.signed_at).toISOString() : null,
                thumbnail: r.signature_data_url ? String(r.signature_data_url).slice(0, 120) : null,
                memberApproved: r.member_approved ?? null,
                memberAmount: r.member_amount != null ? Number(r.member_amount) : null,
                memberComments: r.member_comments ?? null,
            };
        });

        return {
            success: true,
            data: {
                // currentHash 在 per-member 模式下不再有單一值；保留欄位供向後相容
                currentHash: '',
                memberCount: members.length,
                signedCount,
                members,
            },
        };
    } catch (err: any) {
        console.error('fetchBoardReviewSignatures error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
