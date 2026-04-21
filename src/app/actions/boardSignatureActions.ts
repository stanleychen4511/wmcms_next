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

// ─── Internal: compute hash from already-fetched row values ──────────────────

function hashFromValues(
    applicationId: string,
    approvedAmount: number | null,
    comments: string | null,
    isApproved: boolean | null,
    assignedGroupId: string | null,
): string {
    const parts = [
        'v1',
        String(applicationId),
        approvedAmount != null ? String(approvedAmount) : 'null',
        comments != null ? comments : 'null',
        isApproved != null ? String(isApproved) : 'null',
        assignedGroupId != null ? String(assignedGroupId) : 'null',
    ];
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

// Load the current inputs for hash calculation (shared helper)
async function loadHashInputs(client: any, applicationId: string) {
    const res = await client.query(
        `SELECT a.approved_amount,
                w.comments AS wf_comments,
                w.is_approved AS wf_is_approved,
                bra.group_id AS assigned_group_id
         FROM applications a
         LEFT JOIN application_workflow w ON w.application_id = a.id
         LEFT JOIN board_review_assignments bra ON bra.application_id = a.id
         WHERE a.id = $1::bigint LIMIT 1`,
        [applicationId]
    );
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    return {
        approvedAmount: row.approved_amount != null ? Number(row.approved_amount) : null,
        comments: row.wf_comments ?? null,
        isApproved: row.wf_is_approved,
        assignedGroupId: row.assigned_group_id != null ? String(row.assigned_group_id) : null,
    };
}

// ─── Public: compute the current content hash ────────────────────────────────

export async function computeBoardReviewContentHash(
    applicationId: string,
): Promise<ActionResult<string>> {
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        const vals = await loadHashInputs(client, applicationId);
        if (!vals) return { success: false, error: '案件不存在' };
        return {
            success: true,
            data: hashFromValues(
                applicationId,
                vals.approvedAmount,
                vals.comments,
                vals.isApproved,
                vals.assignedGroupId,
            ),
        };
    } catch (err: any) {
        console.error('computeBoardReviewContentHash error:', err);
        return { success: false, error: err.message };
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

        // (e) compute current hash
        const vals = await loadHashInputs(client, applicationId);
        if (!vals) {
            await client.query('ROLLBACK');
            return { success: false, error: '無法計算案件內容雜湊' };
        }
        const contentHash = hashFromValues(
            applicationId, vals.approvedAmount, vals.comments, vals.isApproved, vals.assignedGroupId,
        );

        // UPSERT signature
        await client.query(
            `INSERT INTO board_review_signatures
                (application_id, signer_user_id, signature_data_url, content_hash, signed_at, user_agent, ip_address)
             VALUES ($1::bigint, $2::bigint, $3, $4, NOW(), $5, $6)
             ON CONFLICT (application_id, signer_user_id) DO UPDATE SET
                signature_data_url = EXCLUDED.signature_data_url,
                content_hash       = EXCLUDED.content_hash,
                signed_at          = EXCLUDED.signed_at,
                user_agent         = EXCLUDED.user_agent,
                ip_address         = EXCLUDED.ip_address`,
            [applicationId, operatorUserId, signatureDataUrl, contentHash, meta?.userAgent ?? null, meta?.ipAddress ?? null]
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
        const vals = await loadHashInputs(client, applicationId);
        if (!vals || !vals.assignedGroupId) {
            // No assignment yet — return empty
            return {
                success: true,
                data: {
                    currentHash: '',
                    memberCount: 0,
                    signedCount: 0,
                    members: [],
                },
            };
        }
        const currentHash = hashFromValues(
            applicationId, vals.approvedAmount, vals.comments, vals.isApproved, vals.assignedGroupId,
        );

        const res = await client.query(
            `SELECT u.id::text AS user_id, u.account, u.name_enc, u.name_iv,
                    s.signature_data_url, s.content_hash, s.signed_at
             FROM board_group_members m
             JOIN users u ON u.id = m.user_id
             LEFT JOIN board_review_signatures s
               ON s.application_id = $1::bigint AND s.signer_user_id = m.user_id
             WHERE m.group_id = $2::bigint
             ORDER BY u.account ASC`,
            [applicationId, vals.assignedGroupId]
        );

        let signedCount = 0;
        const members: SignatureMemberRow[] = res.rows.map((r: any) => {
            const name = r.name_enc && r.name_iv
                ? decryptAES(r.name_enc, r.name_iv) || '未知'
                : '未知';
            let status: SignatureStatus = 'pending';
            if (r.signature_data_url) {
                if (r.content_hash === currentHash) {
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
                // Only include truncated thumbnail preview to keep payload small; full image is re-fetchable
                thumbnail: r.signature_data_url ? String(r.signature_data_url).slice(0, 120) : null,
            };
        });

        return {
            success: true,
            data: {
                currentHash,
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
