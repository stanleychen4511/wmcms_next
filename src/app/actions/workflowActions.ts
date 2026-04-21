'use server';

import { pool } from '../../lib/db';
import {
    DB_STAGE_TO_FRONTEND,
    FRONTEND_TO_DB_STAGE,
    ADVANCE_STAGE_TO_STATUS,
    STAGE_LABEL,
    STATUS_LABEL,
} from '../../lib/stageMaps';
import { writeAuditLog } from './auditActions';

export interface ApplicationDetail {
    id: string;
    caseNumber: string;
    status: string;
    statusLabel: string;
    stage: string;
    applicantName: string;
    officerName?: string;
    applyAt?: string;
    createdAt?: string;
    // Qualification pre-screening fields
    age?: number | null;
    moveableProperty?: number | null;
    immoveableProperty?: number | null;
    annualIncome?: number | null;
    maritalStatus?: string | null;
    hasChildren?: boolean | null;
    underageChildrenCount?: number | null;
    adultChildrenCount?: number | null;
    // Board review fields
    applyAmount?: number | null;
    approvedAmount?: number | null;
    // Workflow fields
    wfIsApproved?: boolean | null;
    wfComments?: string | null;
    // Application type (A/B/C/D), set at creation, read-only
    applicationType?: string | null;
    // Cumulative approved amount across all completed applications for this applicant
    totalApprovedAmount?: number;
    // Applicant user ID (for fetching historical receipts, etc.)
    applicantId?: string | null;
    // Officer user ID (for UI permission check — e.g. basics-edit button)
    officerId?: string | null;
    // Referral tracking
    applicationWay?: '1' | '2';
    referralUnitId?: string | null;
    referralUnitName?: string | null;   // null when way='2' but unit was deleted
}

// Guard: mock store IDs look like 'app-001-a', real DB IDs are numeric UUIDs or bigints.
// The applications table uses BIGSERIAL (bigint PK), so valid IDs are all-digit strings.
function isValidDbId(id: string): boolean {
    return /^\d+$/.test(id);
}

/**
 * Verify that every current member of the case's assigned board group has a
 * signature row whose content_hash equals the freshly recomputed current hash.
 * Invoked within existing transactions before status updates.
 */
async function checkBoardSignatureGate(
    client: any,
    applicationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    // Must have an assignment first
    const asg = await client.query(
        `SELECT group_id FROM board_review_assignments WHERE application_id = $1::bigint LIMIT 1`,
        [applicationId]
    );
    if (asg.rowCount === 0) {
        return { ok: false, error: '案件尚未派組，無法推進（請董事長先派組並由組員簽章）' };
    }
    const groupId = String(asg.rows[0].group_id);

    // Recompute current content hash inline (keep this file independent of boardSignatureActions module boundary)
    const inputs = await client.query(
        `SELECT a.approved_amount, w.comments AS wf_comments, w.is_approved AS wf_is_approved
         FROM applications a
         LEFT JOIN application_workflow w ON w.application_id = a.id
         WHERE a.id = $1::bigint LIMIT 1`,
        [applicationId]
    );
    const i = inputs.rows[0] ?? {};
    const { createHash } = await import('crypto');
    const parts = [
        'v1',
        String(applicationId),
        i.approved_amount != null ? String(Number(i.approved_amount)) : 'null',
        i.wf_comments != null ? i.wf_comments : 'null',
        i.wf_is_approved != null ? String(i.wf_is_approved) : 'null',
        groupId,
    ];
    const currentHash = createHash('sha256').update(parts.join('|')).digest('hex');

    // Count current members and valid signatures
    const cnt = await client.query(
        `SELECT
            (SELECT COUNT(*)::int FROM board_group_members WHERE group_id = $1::bigint) AS member_count,
            (SELECT COUNT(*)::int
             FROM board_review_signatures s
             JOIN board_group_members m
               ON m.user_id = s.signer_user_id AND m.group_id = $1::bigint
             WHERE s.application_id = $2::bigint AND s.content_hash = $3
            ) AS valid_count`,
        [groupId, applicationId, currentHash]
    );
    const { member_count, valid_count } = cnt.rows[0];
    const memberCount = Number(member_count ?? 0);
    const validCount = Number(valid_count ?? 0);
    if (memberCount === 0) {
        return { ok: false, error: '派組無任何成員，無法推進' };
    }
    if (memberCount !== validCount) {
        const missing = memberCount - validCount;
        return { ok: false, error: `尚有 ${missing} 位組員未簽署（或簽章已因內容變動失效）` };
    }
    return { ok: true };
}

export async function fetchApplicationDetail(applicationId: string): Promise<ApplicationDetail | null> {
    // Reject mock store IDs (e.g. 'app-010-a') which are not valid bigints
    if (!isValidDbId(applicationId)) return null;
    const client = await pool.connect();
    try {
        // Join with application_workflow to get the ACTUAL current stage
        const res = await client.query(`
            SELECT
                a.id, a.case_number, a.status, a.apply_at, a.created_at,
                a.application_type, a.applicant_id, a.officer_id,
                (SELECT COALESCE(SUM(a2.approved_amount), 0) FROM applications a2
                 WHERE a2.applicant_id = a.applicant_id AND a2.status = '4') AS total_approved_amount,
                a.age, a.moveable_property, a.immoveable_property,
                a.annual_income, a.marital_status, a.has_children, a.underage_children_count, a.adult_children_count,
                a.apply_amount, a.approved_amount,
                a.application_way, a.referral_unit_id,
                ru.name AS referral_unit_name,
                w.stage as wf_stage,
                w.is_approved as wf_is_approved,
                w.comments as wf_comments,
                u_app.name_enc as app_name_enc, u_app.name_iv  as app_name_iv,
                u_off.name_enc as off_name_enc, u_off.name_iv  as off_name_iv
            FROM applications a
            LEFT JOIN application_workflow w ON w.application_id = a.id
            LEFT JOIN users u_app ON u_app.id = a.applicant_id
            LEFT JOIN users u_off ON u_off.id = a.officer_id
            LEFT JOIN referral_units ru ON ru.id = a.referral_unit_id
            WHERE a.id = $1
            LIMIT 1
        `, [applicationId]);

        if (res.rows.length === 0) return null;
        const row = res.rows[0];

        const { decryptAES } = await import('../../lib/crypto');
        const applicantName = row.app_name_enc && row.app_name_iv
            ? decryptAES(row.app_name_enc, row.app_name_iv) || '未知'
            : '未知';
        const officerName = row.off_name_enc && row.off_name_iv
            ? decryptAES(row.off_name_enc, row.off_name_iv) || undefined
            : undefined;

        const dbStatus = row.status ?? '1';
        const statusLabel = STATUS_LABEL[dbStatus] ?? '審核中';

        // Use workflow.stage (DB key) to determine the exact frontend stage.
        // Falls back to 'application' if no workflow row yet.
        const dbWfStage = row.wf_stage ?? 'apply';
        const stage = DB_STAGE_TO_FRONTEND[dbWfStage] ?? 'application';

        return {
            id: row.id,
            caseNumber: row.case_number,
            status: dbStatus,
            statusLabel,
            stage,
            applicantName,
            officerName,
            applyAt: row.apply_at ? new Date(row.apply_at).toISOString().split('T')[0] : undefined,
            createdAt: row.created_at ? row.created_at.toISOString() : undefined,
            age: row.age != null ? Number(row.age) : null,
            moveableProperty: row.moveable_property != null ? Number(row.moveable_property) : null,
            immoveableProperty: row.immoveable_property != null ? Number(row.immoveable_property) : null,
            annualIncome: row.annual_income != null ? Number(row.annual_income) : null,
            maritalStatus: row.marital_status ?? null,
            hasChildren: row.has_children ?? null,
            underageChildrenCount: row.underage_children_count != null ? Number(row.underage_children_count) : null,
            adultChildrenCount: row.adult_children_count != null ? Number(row.adult_children_count) : null,
            applyAmount: row.apply_amount != null ? Number(row.apply_amount) : null,
            approvedAmount: row.approved_amount != null ? Number(row.approved_amount) : null,
            wfIsApproved: row.wf_is_approved ?? null,
            wfComments: row.wf_comments ?? null,
            applicationType: row.application_type ?? null,
            totalApprovedAmount: Number(row.total_approved_amount ?? 0),
            applicantId: row.applicant_id ? String(row.applicant_id) : null,
            officerId: row.officer_id ? String(row.officer_id) : null,
            applicationWay: (row.application_way === '2' ? '2' : '1') as '1' | '2',
            referralUnitId: row.referral_unit_id != null ? String(row.referral_unit_id) : null,
            referralUnitName: row.referral_unit_name ?? null,
        };
    } finally {
        client.release();
    }
}

/**
 * Advance stage forward. Updates applications.status and UPSERTS the single workflow row.
 */
export async function advanceWorkflowStage(
    applicationId: string,
    fromStage: string,
    toStage: string,
    reviewerUserId: string | null,
    comments?: string
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID（mock 資料不支援資料庫操作）' };
    const toStatus   = ADVANCE_STAGE_TO_STATUS[toStage]  ?? '1';
    const dbStage    = FRONTEND_TO_DB_STAGE[toStage]     ?? toStage;
    const stageLabel = STAGE_LABEL[toStage]               ?? toStage;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 0. 若自 board_review 推進，須驗證全員簽章完整且 hash 有效
        if (fromStage === 'board_review') {
            const gate = await checkBoardSignatureGate(client, applicationId);
            if (!gate.ok) {
                await client.query('ROLLBACK');
                return { success: false, error: gate.error };
            }
        }

        // 1. Update applications.status
        await client.query(
            `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2`,
            [toStatus, applicationId]
        );

        // 2. UPSERT the single workflow row (one per application per spec)
        const existRes = await client.query(
            `SELECT 1 FROM application_workflow WHERE application_id = $1 LIMIT 1`,
            [applicationId]
        );

        if (existRes.rows.length > 0) {
            await client.query(`
                UPDATE application_workflow
                SET stage = $1,
                    reviewer_id = $2,
                    is_approved = true,
                    comments = $3,
                    reviewed_at = NOW()
                WHERE application_id = $4
            `, [dbStage, reviewerUserId, comments ?? `推進至${stageLabel}`, applicationId]);
        } else {
            await client.query(`
                INSERT INTO application_workflow
                    (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
                VALUES ($1, $2, $3, true, $4, NOW())
            `, [applicationId, dbStage, reviewerUserId, comments ?? `建立並進入${stageLabel}`]);
        }

        await client.query('COMMIT');
        void writeAuditLog({
            userId: reviewerUserId,
            action: 'application.stage_advance',
            targetType: 'application',
            targetId: applicationId,
            detail: { from: fromStage, to: toStage, comments },
        });

        // 進入 board_review 階段時，若系統設定 board_auto_assign='true'，觸發自動派組
        if (toStage === 'board_review') {
            const { maybeAutoAssignOnBoardReviewEntry } = await import('./boardGroupActions');
            void maybeAutoAssignOnBoardReviewEntry(applicationId);
        }

        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('advanceWorkflowStage error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export interface QualificationData {
    age?: number | null;
    moveable_property?: number | null;
    immoveable_property?: number | null;
    annual_income?: number | null;
    marital_status?: string | null;  // '1' = 單身, '2' = 已婚
    has_children?: boolean | null;
    underage_children_count?: number | null;
    adult_children_count?: number | null;
    apply_amount?: number | null;
}

/**
 * Save qualification pre-screening data into applications table.
 * Called when advancing FROM the 申請收件 (application) stage.
 */
export async function saveQualificationData(
    applicationId: string,
    data: QualificationData
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID（mock 資料不支援資料庫操作）' };
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE applications
             SET age                    = $1,
                 moveable_property      = $2,
                 immoveable_property    = $3,
                 annual_income          = $4,
                 marital_status         = $5,
                 has_children           = $6,
                 underage_children_count = $7,
                 adult_children_count   = $8,
                 apply_amount           = $9,
                 updated_at             = NOW()
             WHERE id = $10`,
            [
                data.age ?? null,
                data.moveable_property ?? null,
                data.immoveable_property ?? null,
                data.annual_income ?? null,
                data.marital_status ?? null,
                data.has_children ?? null,
                data.underage_children_count ?? null,
                data.adult_children_count ?? null,
                data.apply_amount ?? null,
                applicationId,
            ]
        );
        return { success: true };
    } catch (err: any) {
        console.error('saveQualificationData error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Retreat stage backward.
 * - If retreating to 'application' or 'admin_review': keep status '1' (審核中)
 * - Otherwise: set status '2' (審核未通過) to indicate rejection
 * - is_approved → false
 */
export async function retreatWorkflowStage(
    applicationId: string,
    toStage: string,
    reviewerUserId: string | null,
    comments?: string
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID（mock 資料不支援資料庫操作）' };
    // When retreating to early stages, keep '1' (審核中). 
    // For deeper stages being rejected, use '2' (審核未通過).
    // Retreating always puts the case back to '1' (審核中)
    // Status '2' is reserved for board rejection (結案), never set via retreat
    const toStatus = '1';
    const dbStage    = FRONTEND_TO_DB_STAGE[toStage]  ?? toStage;
    const stageLabel = STAGE_LABEL[toStage]            ?? toStage;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2`,
            [toStatus, applicationId]
        );

        const existRes = await client.query(
            `SELECT 1 FROM application_workflow WHERE application_id = $1 LIMIT 1`,
            [applicationId]
        );

        if (existRes.rows.length > 0) {
            await client.query(`
                UPDATE application_workflow
                SET stage = $1,
                    reviewer_id = $2,
                    is_approved = false,
                    comments = $3,
                    reviewed_at = NOW()
                WHERE application_id = $4
            `, [dbStage, reviewerUserId, comments ?? `退回至${stageLabel}`, applicationId]);
        } else {
            await client.query(`
                INSERT INTO application_workflow
                    (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
                VALUES ($1, $2, $3, false, $4, NOW())
            `, [applicationId, dbStage, reviewerUserId, comments ?? `退回至${stageLabel}`]);
        }

        await client.query('COMMIT');
        void writeAuditLog({
            userId: reviewerUserId,
            action: 'application.stage_rollback',
            targetType: 'application',
            targetId: applicationId,
            detail: { to: toStage, comments },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('retreatWorkflowStage error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Close case as rejected after board review failure.
 * Sets applications.status = '2' (審核未通過/結案),
 * writes approved_amount = 0 and comments into workflow.
 */
export async function closeCaseRejected(
    applicationId: string,
    comments: string,
    reviewerUserId: string | null,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 若案件目前在 board_review 階段才呼叫此結案，須驗全員簽章
        const stageRes = await client.query(
            `SELECT stage FROM application_workflow WHERE application_id = $1 LIMIT 1`,
            [applicationId]
        );
        const curStage = stageRes.rows[0]?.stage;
        if (curStage === 'board_review') {
            const gate = await checkBoardSignatureGate(client, applicationId);
            if (!gate.ok) {
                await client.query('ROLLBACK');
                return { success: false, error: gate.error };
            }
        }

        await client.query(
            `UPDATE applications SET status = '2', approved_amount = 0, updated_at = NOW() WHERE id = $1`,
            [applicationId]
        );
        const existRes = await client.query(
            `SELECT 1 FROM application_workflow WHERE application_id = $1 LIMIT 1`,
            [applicationId]
        );
        if (existRes.rows.length > 0) {
            await client.query(`
                UPDATE application_workflow
                SET stage = 'board_review', reviewer_id = $1, is_approved = false,
                    comments = $2, reviewed_at = NOW()
                WHERE application_id = $3
            `, [reviewerUserId, comments, applicationId]);
        } else {
            await client.query(`
                INSERT INTO application_workflow
                    (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
                VALUES ($1, 'board_review', $2, false, $3, NOW())
            `, [applicationId, reviewerUserId, comments]);
        }
        await client.query('COMMIT');
        void writeAuditLog({
            userId: reviewerUserId,
            action: 'application.close',
            targetType: 'application',
            targetId: applicationId,
            detail: { result: 'rejected', comments },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('closeCaseRejected error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Close a case as rejected because the pending-doc reminder threshold has been
 * reached and the officer judges no further nudge is worthwhile. Reuses the
 * existing closeCaseRejected logic but writes an additional audit entry tagged
 * `pending_doc.threshold_close` with reminder metadata for traceability.
 *
 * Caller is expected to look up reminderCount / lastReminderAt before calling
 * (typically via fetchPendingDocReminderStatus).
 */
export async function closeCaseByPendingDocThreshold(
    applicationId: string,
    reason: string,
    officerUserId: string | null,
    reminderCount: number,
    lastReminderAt: string | null,
): Promise<{ success: boolean; error?: string }> {
    const trimmed = (reason ?? '').trim();
    if (trimmed.length < 5) {
        return { success: false, error: '結案原因至少需 5 字' };
    }
    const result = await closeCaseRejected(applicationId, trimmed, officerUserId);
    if (!result.success) return result;

    void writeAuditLog({
        userId: officerUserId,
        action: 'pending_doc.threshold_close',
        targetType: 'application',
        targetId: applicationId,
        detail: {
            reason: trimmed,
            reminder_count: reminderCount,
            last_reminder_at: lastReminderAt,
        },
    });
    return { success: true };
}

/**
 * Save board review result: approved_amount + workflow comments.
 * approved_amount = 0 when not approved.
 */
export async function saveBoardReviewData(
    applicationId: string,
    approvedAmount: number,
    comments: string,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE applications SET approved_amount = $1, updated_at = NOW() WHERE id = $2`,
            [approvedAmount, applicationId]
        );
        await client.query(
            `UPDATE application_workflow SET comments = $1, reviewed_at = NOW() WHERE application_id = $2`,
            [comments, applicationId]
        );
        await client.query('COMMIT');
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('saveBoardReviewData error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Close case after reimbursement (核銷完成).
 * Sets applications.status = '4' (核銷完成/結案).
 */
export async function closeCase(
    applicationId: string,
    reviewerUserId: string | null,
    approvedAmount?: number | null,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE applications
             SET status = '4',
                 approved_amount = COALESCE($2, approved_amount),
                 updated_at = NOW()
             WHERE id = $1`,
            [applicationId, approvedAmount ?? null]
        );
        await client.query(`
            UPDATE application_workflow
            SET stage = 'reimbursement', reviewer_id = $1, is_approved = true,
                comments = '核銷完成，案件結案', reviewed_at = NOW()
            WHERE application_id = $2
        `, [reviewerUserId, applicationId]);
        await client.query('COMMIT');
        void writeAuditLog({
            userId: reviewerUserId,
            action: 'application.close',
            targetType: 'application',
            targetId: applicationId,
            detail: { result: 'completed' },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('closeCase error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function fetchWorkflowRecord(applicationId: string) {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT w.stage, w.is_approved, w.comments, w.created_at, w.reviewed_at,
                   u.name_enc, u.name_iv
            FROM application_workflow w
            LEFT JOIN users u ON u.id = w.reviewer_id
            WHERE w.application_id = $1
            LIMIT 1
        `, [applicationId]);

        if (res.rows.length === 0) return null;
        const row = res.rows[0];

        const { decryptAES } = await import('../../lib/crypto');
        return {
            stage: row.stage,
            isApproved: row.is_approved,
            comments: row.comments,
            createdAt: row.created_at?.toISOString(),
            reviewedAt: row.reviewed_at?.toISOString(),
            reviewerName: row.name_enc && row.name_iv
                ? decryptAES(row.name_enc, row.name_iv) || '系統'
                : '系統',
        };
    } finally {
        client.release();
    }
}
