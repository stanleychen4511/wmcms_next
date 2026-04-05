'use server';

import { pool } from '../../lib/db';
import {
    DB_STAGE_TO_FRONTEND,
    FRONTEND_TO_DB_STAGE,
    ADVANCE_STAGE_TO_STATUS,
    STAGE_LABEL,
    STATUS_LABEL,
} from '../../lib/stageMaps';

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
}

// Guard: mock store IDs look like 'app-001-a', real DB IDs are numeric UUIDs or bigints.
// The applications table uses BIGSERIAL (bigint PK), so valid IDs are all-digit strings.
function isValidDbId(id: string): boolean {
    return /^\d+$/.test(id);
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
                w.stage as wf_stage,
                u_app.name_enc as app_name_enc, u_app.name_iv  as app_name_iv,
                u_off.name_enc as off_name_enc, u_off.name_iv  as off_name_iv
            FROM applications a
            LEFT JOIN application_workflow w ON w.application_id = a.id
            LEFT JOIN users u_app ON u_app.id = a.applicant_id
            LEFT JOIN users u_off ON u_off.id = a.officer_id
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
             SET age                = $1,
                 moveable_property  = $2,
                 immoveable_property = $3,
                 annual_income      = $4,
                 marital_status     = $5,
                 has_children       = $6,
                 updated_at         = NOW()
             WHERE id = $7`,
            [
                data.age ?? null,
                data.moveable_property ?? null,
                data.immoveable_property ?? null,
                data.annual_income ?? null,
                data.marital_status ?? null,
                data.has_children ?? null,
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
    const earlyStages = new Set(['application', 'admin_review']);
    const toStatus   = earlyStages.has(toStage) ? '1' : '2';
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
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('retreatWorkflowStage error', err);
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
