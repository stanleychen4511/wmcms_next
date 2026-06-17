'use server';

import { pool } from '../../lib/db';
import { encryptAES } from '../../lib/crypto';
import { CLOSE_REASON_OPTIONS, CloseReasonCode } from '../../lib/closeReasonConstants';
import { writeAuditLog } from './auditActions';

const ALLOWED_CREATE_ROLES = ['admin', 'supervisor', 'board_member', 'executive', 'chairman', 'case_officer'];
const VALID_CODES = new Set(CLOSE_REASON_OPTIONS.map(opt => opt.code));

async function hasCreatePermission(operatorUserId: string): Promise<boolean> {
    if (!/^\d+$/.test(operatorUserId)) return false;
    const res = await pool.query(
        `SELECT 1
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint
           AND r.code = ANY($2::text[])
         LIMIT 1`,
        [operatorUserId, ALLOWED_CREATE_ROLES]
    );
    return (res.rowCount ?? 0) > 0;
}

export interface RejectedArchiveReasonInput {
    code: CloseReasonCode;
    detail?: string;
}

export interface RejectedArchiveInput {
    operatorUserId: string;
    applicantName: string;
    applyAt: string;
    applicationForm?: 'P' | 'E' | '';
    reasons: RejectedArchiveReasonInput[];
    notes?: string;
}

export async function createRejectedArchive(input: RejectedArchiveInput): Promise<{ success: boolean; error?: string }> {
    const operatorUserId = input.operatorUserId;
    if (!(await hasCreatePermission(operatorUserId))) {
        return { success: false, error: '權限不足' };
    }

    const applicantName = input.applicantName.trim();
    if (!applicantName) return { success: false, error: '請輸入申請人姓名' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.applyAt)) {
        return { success: false, error: '請輸入申請日期' };
    }

    const reasons = input.reasons
        .map(r => ({ code: r.code, detail: (r.detail ?? '').trim() }))
        .filter(r => VALID_CODES.has(r.code));
    if (reasons.length === 0) {
        return { success: false, error: '請至少選擇一項不通過原因' };
    }

    for (const reason of reasons) {
        const opt = CLOSE_REASON_OPTIONS.find(o => o.code === reason.code);
        if (opt?.detailHint && !reason.detail) {
            return { success: false, error: `請填寫「${opt.label}」的${opt.detailLabel ?? '補充說明'}` };
        }
    }

    const { enc, iv } = encryptAES(applicantName);
    if (!enc || !iv) return { success: false, error: '姓名加密失敗' };

    const applicationForm = input.applicationForm === 'P' || input.applicationForm === 'E'
        ? input.applicationForm
        : null;

    try {
        const res = await pool.query<{ id: string }>(
            `INSERT INTO rejected_application_archives
                 (applicant_name_enc, applicant_name_iv, apply_at, application_form,
                  reason_rows, officer_id, notes)
             VALUES ($1, $2, $3::date, $4, $5::jsonb, $6::bigint, $7)
             RETURNING id::text`,
            [
                enc,
                iv,
                input.applyAt,
                applicationForm,
                JSON.stringify(reasons),
                operatorUserId,
                input.notes?.trim() || null,
            ]
        );

        void writeAuditLog({
            userId: operatorUserId,
            action: 'rejected_archive.create',
            targetType: 'rejected_application_archive',
            targetId: res.rows[0]?.id ?? null,
            detail: { applyAt: input.applyAt, reasonCodes: reasons.map(r => r.code) },
        });
        return { success: true };
    } catch (err: any) {
        console.error('createRejectedArchive', err);
        return { success: false, error: err.message ?? '新增不通過歸檔失敗' };
    }
}
