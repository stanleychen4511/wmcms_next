'use server';

/**
 * 申請人關懷紀錄 server actions。
 *
 * 表：applicant_care_records（以申請人為主體，1 對多紀錄）
 *
 * 角色權限：
 *   建立：volunteer 或 social_worker
 *   檢視：volunteer / social_worker / admin / supervisor
 *   編輯：只有原建立者本人
 *   刪除：原建立者本人 或 admin
 */

import { pool } from '../../lib/db';
import { decryptAES } from '../../lib/crypto';
import { writeAuditLog } from './auditActions';

export interface CareRecord {
    id: string;
    applicantUserId: string;
    careUserId: string | null;
    careUserName: string;
    careDate: string;          // ISO date yyyy-mm-dd
    summary: string;
    mediaUrls: string[];
    createdAt: string;
    updatedAt: string;
}

type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// ─── 內部 helpers ────────────────────────────────────────────────────────

async function hasAnyRole(operatorUserId: string, codes: string[]): Promise<boolean> {
    if (!/^\d+$/.test(operatorUserId)) return false;
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT 1 FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint AND r.code = ANY($2::text[])
             LIMIT 1`,
            [operatorUserId, codes]
        );
        return (res.rowCount ?? 0) > 0;
    } finally {
        client.release();
    }
}

/** Trim 每個 URL、移除空字串與 null，回傳乾淨字串陣列 */
function normalizeMediaUrls(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const out: string[] = [];
    for (const raw of input) {
        if (raw == null) continue;
        const s = String(raw).trim();
        if (s) out.push(s);
    }
    return out;
}

function decryptName(enc: Buffer | null, iv: Buffer | null, fallback = '未知'): string {
    if (!enc || !iv) return fallback;
    try {
        return decryptAES(enc, iv) || fallback;
    } catch {
        return fallback;
    }
}

// ─── Create ───────────────────────────────────────────────────────────────

export async function createCareRecord(
    operatorUserId: string,
    applicantUserId: string,
    careDate: string,
    summary: string,
    mediaUrls: string[] | null
): Promise<ActionResult<{ id: string }>> {
    // Role gate
    if (!(await hasAnyRole(operatorUserId, ['volunteer', 'social_worker']))) {
        return { success: false, error: '權限不足' };
    }

    // Validate inputs
    if (!applicantUserId || !/^\d+$/.test(applicantUserId)) {
        return { success: false, error: '申請人 ID 無效' };
    }
    const trimmedSummary = (summary ?? '').trim();
    if (!trimmedSummary) {
        return { success: false, error: '請填寫關懷摘要' };
    }
    if (!careDate || isNaN(new Date(careDate).getTime())) {
        return { success: false, error: '關懷日期無效' };
    }
    const cleanedUrls = normalizeMediaUrls(mediaUrls);

    const client = await pool.connect();
    try {
        // 驗證 applicant 存在且 active
        const applRes = await client.query(
            `SELECT id FROM users WHERE id = $1::bigint AND is_active = TRUE LIMIT 1`,
            [applicantUserId]
        );
        if (applRes.rowCount === 0) {
            return { success: false, error: '申請人不存在或已停用' };
        }

        const insRes = await client.query(
            `INSERT INTO applicant_care_records
                 (applicant_user_id, care_user_id, care_date, summary, media_urls)
             VALUES ($1::bigint, $2::bigint, $3::date, $4, $5::text[])
             RETURNING id::text`,
            [applicantUserId, operatorUserId, careDate, trimmedSummary, cleanedUrls]
        );
        const newId = insRes.rows[0].id as string;

        void writeAuditLog({
            userId: operatorUserId,
            action: 'care_record.created',
            targetType: 'care_record',
            targetId: newId,
            detail: {
                applicant_user_id: applicantUserId,
                care_date: careDate,
                summary_length: trimmedSummary.length,
                media_count: cleanedUrls.length,
            },
        });

        return { success: true, data: { id: newId } };
    } catch (err: any) {
        console.error('createCareRecord error:', err);
        return { success: false, error: err.message ?? '建立失敗' };
    } finally {
        client.release();
    }
}

// ─── Fetch list ───────────────────────────────────────────────────────────

export async function fetchCareRecordsByApplicant(
    operatorUserId: string,
    applicantUserId: string
): Promise<ActionResult<CareRecord[]>> {
    if (!(await hasAnyRole(operatorUserId, ['volunteer', 'social_worker', 'admin', 'supervisor']))) {
        return { success: false, error: '權限不足' };
    }
    if (!applicantUserId || !/^\d+$/.test(applicantUserId)) {
        return { success: false, error: '申請人 ID 無效' };
    }

    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT
                 cr.id::text           AS id,
                 cr.applicant_user_id::text AS applicant_user_id,
                 cr.care_user_id::text AS care_user_id,
                 cr.care_date,
                 cr.summary,
                 cr.media_urls,
                 cr.created_at,
                 cr.updated_at,
                 u.name_enc,
                 u.name_iv,
                 u.account AS care_user_account
             FROM applicant_care_records cr
             LEFT JOIN users u ON u.id = cr.care_user_id
             WHERE cr.applicant_user_id = $1::bigint
             ORDER BY cr.care_date DESC, cr.created_at DESC`,
            [applicantUserId]
        );

        const data: CareRecord[] = res.rows.map((r: any) => ({
            id: r.id,
            applicantUserId: r.applicant_user_id,
            careUserId: r.care_user_id,
            careUserName: decryptName(r.name_enc, r.name_iv, r.care_user_account ?? '（已移除）'),
            careDate: r.care_date ? new Date(r.care_date).toISOString().split('T')[0] : '',
            summary: r.summary,
            mediaUrls: Array.isArray(r.media_urls) ? r.media_urls : [],
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : '',
        }));

        return { success: true, data };
    } catch (err: any) {
        console.error('fetchCareRecordsByApplicant error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

// ─── Update ───────────────────────────────────────────────────────────────

export async function updateCareRecord(
    operatorUserId: string,
    recordId: string,
    careDate: string,
    summary: string,
    mediaUrls: string[] | null
): Promise<ActionResult> {
    if (!/^\d+$/.test(recordId)) {
        return { success: false, error: '紀錄不存在' };
    }
    const trimmedSummary = (summary ?? '').trim();
    if (!trimmedSummary) {
        return { success: false, error: '請填寫關懷摘要' };
    }
    if (!careDate || isNaN(new Date(careDate).getTime())) {
        return { success: false, error: '關懷日期無效' };
    }
    const cleanedUrls = normalizeMediaUrls(mediaUrls);

    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT care_user_id::text, care_date, summary, media_urls
             FROM applicant_care_records WHERE id = $1::bigint`,
            [recordId]
        );
        if (cur.rowCount === 0) {
            return { success: false, error: '紀錄不存在' };
        }
        const row = cur.rows[0];

        // Only the creator may edit
        if (row.care_user_id !== operatorUserId) {
            return { success: false, error: '只有建立者可以編輯此紀錄' };
        }

        // 計算 changedFields
        const changedFields: string[] = [];
        const oldCareDate = row.care_date ? new Date(row.care_date).toISOString().split('T')[0] : '';
        if (oldCareDate !== careDate) changedFields.push('careDate');
        if ((row.summary ?? '') !== trimmedSummary) changedFields.push('summary');
        const oldUrls: string[] = Array.isArray(row.media_urls) ? row.media_urls : [];
        if (oldUrls.join('|') !== cleanedUrls.join('|')) changedFields.push('mediaUrls');

        await client.query(
            `UPDATE applicant_care_records
             SET care_date = $1::date, summary = $2, media_urls = $3::text[], updated_at = NOW()
             WHERE id = $4::bigint`,
            [careDate, trimmedSummary, cleanedUrls, recordId]
        );

        void writeAuditLog({
            userId: operatorUserId,
            action: 'care_record.updated',
            targetType: 'care_record',
            targetId: recordId,
            detail: { changedFields },
        });

        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('updateCareRecord error:', err);
        return { success: false, error: err.message ?? '更新失敗' };
    } finally {
        client.release();
    }
}

// ─── Delete ───────────────────────────────────────────────────────────────

export async function deleteCareRecord(
    operatorUserId: string,
    recordId: string
): Promise<ActionResult> {
    if (!/^\d+$/.test(recordId)) {
        return { success: false, error: '紀錄不存在' };
    }

    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT care_user_id::text, applicant_user_id::text, care_date
             FROM applicant_care_records WHERE id = $1::bigint`,
            [recordId]
        );
        if (cur.rowCount === 0) {
            return { success: false, error: '紀錄不存在' };
        }
        const row = cur.rows[0];

        const isCreator = row.care_user_id === operatorUserId;
        const isAdmin = await hasAnyRole(operatorUserId, ['admin']);
        if (!isCreator && !isAdmin) {
            return { success: false, error: '權限不足' };
        }

        await client.query(
            `DELETE FROM applicant_care_records WHERE id = $1::bigint`,
            [recordId]
        );

        void writeAuditLog({
            userId: operatorUserId,
            action: 'care_record.deleted',
            targetType: 'care_record',
            targetId: recordId,
            detail: {
                applicant_user_id: row.applicant_user_id,
                care_user_id: row.care_user_id,
                care_date: row.care_date ? new Date(row.care_date).toISOString().split('T')[0] : null,
                deleted_by_role: isCreator ? 'creator' : 'admin',
            },
        });

        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('deleteCareRecord error:', err);
        return { success: false, error: err.message ?? '刪除失敗' };
    } finally {
        client.release();
    }
}
