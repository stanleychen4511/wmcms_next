'use server';

import { pool } from '../../lib/db';
import { generateBlindIndex } from '../../lib/crypto';
import { CaseSummary, ApplicationRecord, WorkflowStage, ApplicationStatus } from '../../types';
import { STATUS_TO_STAGE, DB_STAGE_TO_FRONTEND, STATUS_LABEL } from '../../lib/stageMaps';
import { writeAuditLog } from './auditActions';
import { fetchSetting } from './settingsActions';

export interface ApplicationStatusResult {
    found: boolean;
    hasActiveApplication?: boolean;
    status?: string | null;
    applyAmount?: number | null;
    approvedAmount?: number | null;
    totalApprovedAmount?: number;
    maxAmount?: number;
    remaining?: number;
    error?: string;
}

export async function checkApplicationStatus(idNumber: string): Promise<ApplicationStatusResult> {
    if (!idNumber) {
        return { found: false, error: '請提供身分證字號' };
    }

    const client = await pool.connect();
    try {
        // 1. Fetch all active users with their search_salt and id blind index.
        //    Match by id_number_bidx only — name is not used for lookup.
        //    Coerce to string first — pg may return bytea columns as Buffer objects.
        const usersRes = await client.query(`
            SELECT id, search_salt, id_number_bidx
            FROM users
            WHERE is_active = true
        `);

        const normalizedId = idNumber.trim().toUpperCase();
        let matchedUserId: string | null = null;

        for (const row of usersRes.rows) {
            if (!row.search_salt) continue;
            const salt = Buffer.isBuffer(row.search_salt)
                ? row.search_salt.toString('hex')
                : String(row.search_salt);
            const storedIdBidx = Buffer.isBuffer(row.id_number_bidx)
                ? row.id_number_bidx.toString('hex')
                : String(row.id_number_bidx ?? '');

            if (generateBlindIndex(normalizedId, salt) === storedIdBidx) {
                matchedUserId = row.id;
                break;
            }
        }

        if (!matchedUserId) {
            return { found: false };
        }

        // 2. Check whether ANY application is still active (status NOT IN '2','4').
        //    Per spec: 2=審核未通過(結案), 4=核銷完成(結案); all others are in-progress.
        //    We must check ALL rows, not just the latest one — a person could have an
        //    older active case even if their newest case is already closed.
        const activeRes = await client.query(`
            SELECT id FROM applications
            WHERE applicant_id = $1
              AND status NOT IN ('2', '4')
            LIMIT 1
        `, [matchedUserId]);

        const hasActiveApplication = activeRes.rows.length > 0;

        // 3. Get latest application data for display purposes
        const appRes = await client.query(`
            SELECT status, apply_amount, approved_amount
            FROM applications
            WHERE applicant_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [matchedUserId]);

        // 4. Get total approved amount (status='4' 核銷完成 only)
        const sumRes = await client.query(`
            SELECT COALESCE(SUM(approved_amount), 0) AS total_approved
            FROM applications
            WHERE applicant_id = $1 AND status = '4'
        `, [matchedUserId]);

        const totalApprovedAmount = parseInt(sumRes.rows[0].total_approved || '0', 10);

        const maxAmountStr = await fetchSetting('max_apply_amount', '350000');
        const maxAmount = Number(maxAmountStr) || 350000;
        const remaining = Math.max(0, maxAmount - totalApprovedAmount);

        const appData = appRes.rows[0] ?? null;
        return {
            found: true,
            hasActiveApplication,
            status: appData?.status ?? null,
            applyAmount: appData?.apply_amount ?? null,
            approvedAmount: appData?.approved_amount ?? null,
            totalApprovedAmount,
            maxAmount,
            remaining,
        };

    } catch (err: any) {
        console.error('Error fetching application status:', err);
        return { found: false, error: '系統異常，請稍後再試' };
    } finally {
        client.release();
    }
}

// Generate an initial random password for applicants who are auto-created
function generateTempPassword(): string {
    return Math.random().toString(36).substring(2, 12);
}

export async function createNewApplication(
    name: string,
    idNumber: string,
    officerAccount: string,
    applicationType: string = 'A',
    applyAmount?: number | null,
): Promise<{ success: boolean; caseId?: string; error?: string }> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Find or create the applicant user.
        //    Match by id_number_bidx only — name is for case data, not for lookup.
        let applicantId: string | null = null;
        const normalizedId = idNumber.trim().toUpperCase();

        const usersRes = await client.query('SELECT id, search_salt, id_number_bidx FROM users WHERE is_active = true');
        for (const row of usersRes.rows) {
            if (!row.search_salt) continue;
            const { generateBlindIndex } = await import('../../lib/crypto');
            const salt = Buffer.isBuffer(row.search_salt)
                ? row.search_salt.toString('hex')
                : String(row.search_salt);
            const storedIdBidx = Buffer.isBuffer(row.id_number_bidx)
                ? row.id_number_bidx.toString('hex')
                : String(row.id_number_bidx ?? '');
            if (generateBlindIndex(normalizedId, salt) === storedIdBidx) {
                applicantId = row.id;
                break;
            }
        }

        if (!applicantId) {
            // Applicant doesn't exist. Create them!
            const { encryptAES, generateSalt, hashPassword, generateBlindIndex } = await import('../../lib/crypto');
            
            // Use full ID number as account key — unique per person, server-side only
            const generatedAccount = `app_${idNumber.toUpperCase()}`;
            const tempPass = generateTempPassword();
            const searchSalt = generateSalt();
            const passHash = hashPassword(tempPass, searchSalt);
            
            const { enc: nameEnc, iv: nameIv } = encryptAES(name);
            const nameBidx = generateBlindIndex(name, searchSalt);
            
            const { enc: idEnc, iv: idIv } = encryptAES(idNumber);
            const idBidx = generateBlindIndex(idNumber, searchSalt);

            const insertUserQuery = `
                INSERT INTO users (
                    account, password, search_salt,
                    name_enc, name_iv, name_bidx,
                    id_number_enc, id_number_iv, id_number_bidx,
                    is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
                RETURNING id;
            `;
            
            const newU = await client.query(insertUserQuery, [
                generatedAccount, passHash, searchSalt,
                nameEnc, nameIv, nameBidx,
                idEnc, idIv, idBidx
            ]);
            applicantId = newU.rows[0].id;
            
            // Get Applicant Role ID
            const roleRes = await client.query(`SELECT id FROM roles WHERE code = 'applicant'`);
            if (roleRes.rows.length > 0) {
                await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [applicantId, roleRes.rows[0].id]);
            }
        }

        // 2. Fetch officer user ID based on account
        let officerId: string | null = null;
        const oRes = await client.query(`SELECT id FROM users WHERE account = $1`, [officerAccount]);
        if (oRes.rows.length > 0) {
            officerId = oRes.rows[0].id;
        }

        // 3. Generate sequential case_number (format: A<民國年3碼><流水號3碼>, total 7 chars)
        const now = new Date();
        // Taiwanese calendar year = Western year - 1911
        const rocYear = String(now.getFullYear() - 1911).padStart(3, '0');
        const typePrefix = applicationType.toUpperCase();
        const countRes = await client.query(
            `SELECT count(*) as total FROM applications WHERE case_number LIKE $1`,
            [`${typePrefix}${rocYear}%`]
        );
        const count = parseInt(countRes.rows[0].total) + 1;
        const caseNumber = `${typePrefix}${rocYear}${count.toString().padStart(3, '0')}`; // e.g. D115003 (7 chars)

        // 4. Create the application — status '1' = 審核中 (per spec)
        const appRes = await client.query(`
            INSERT INTO applications (
                case_number, applicant_id, officer_id, status, apply_at, application_type, apply_amount
            ) VALUES ($1, $2, $3, '1', NOW(), $4, $5)
            RETURNING id;
        `, [caseNumber, applicantId, officerId, typePrefix, applyAmount ?? null]);

        const newCaseId = appRes.rows[0].id;

        // 5. Create the initial workflow record (one row per application per spec)
        // stage = 'admin_review' = 行政初審 (申請收件已合併入行政初審)
        // is_approved = NULL = 尚未審核
        await client.query(`
            INSERT INTO application_workflow
                (application_id, stage, reviewer_id, is_approved, comments)
            VALUES ($1, 'admin_review', $2, NULL, '案件已建立，進入行政初審階段')
        `, [newCaseId, officerId]);

        await client.query('COMMIT');
        void writeAuditLog({
            userId: officerId,
            action: 'application.create',
            targetType: 'application',
            targetId: String(newCaseId),
            detail: { caseNumber, officerAccount },
        });
        return { success: true, caseId: newCaseId };

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Create application error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Fetch a summary of all applicants and their latest application status.
 * Used for the main inquiry list page.
 */
export async function fetchCaseSummaries(): Promise<CaseSummary[]> {
    const client = await pool.connect();
    try {
        // Query to get aggregated data for each applicant
        // We join applications to get counts and sums, and another join for latest application details
        const res = await client.query(`
            WITH user_stats AS (
                SELECT 
                    applicant_id,
                    COUNT(*) as app_count,
                    SUM(COALESCE(approved_amount, 0)) FILTER (WHERE approved_amount IS NOT NULL AND approved_amount > 0) as total_approved
                FROM applications
                GROUP BY applicant_id
            ),
            latest_apps AS (
                SELECT DISTINCT ON (applicant_id)
                    a.id as app_id,
                    a.applicant_id,
                    a.case_number,
                    a.officer_id,
                    a.apply_at,
                    a.status,
                    u_off.name_enc as off_name_enc, u_off.name_iv as off_name_iv,
                    u_off.account as officer_account,
                    w.stage as wf_stage
                FROM applications a
                LEFT JOIN users u_off ON u_off.id = a.officer_id
                LEFT JOIN application_workflow w ON w.application_id = a.id
                ORDER BY a.applicant_id, a.apply_at DESC
            )
            SELECT
                u.id as applicant_id,
                u.name_enc,
                u.name_iv,
                s.app_count,
                s.total_approved,
                l.app_id,
                l.case_number,
                l.officer_id,
                l.apply_at,
                l.status,
                l.wf_stage,
                l.off_name_enc,
                l.off_name_iv,
                l.officer_account
            FROM users u
            JOIN user_stats s ON s.applicant_id = u.id
            LEFT JOIN latest_apps l ON l.applicant_id = u.id
            ORDER BY l.apply_at DESC NULLS LAST
        `);

        const { decryptAES } = await import('../../lib/crypto');
        
        return res.rows.map(row => {
            const name = row.name_enc && row.name_iv 
                ? decryptAES(row.name_enc, row.name_iv) || '未知'
                : '未知';

            const offName = row.off_name_enc && row.off_name_iv
                ? decryptAES(row.off_name_enc, row.off_name_iv) || row.officer_account || '系統'
                : row.officer_account || '系統';

            const dbStatus = row.status ?? '1';
            const dbWfStage = row.wf_stage;
            
            // Map stage: prefer workflow stage, then status-based mapping
            let stage: WorkflowStage = 'admin_review';
            if (dbWfStage && DB_STAGE_TO_FRONTEND[dbWfStage]) {
                stage = DB_STAGE_TO_FRONTEND[dbWfStage] as WorkflowStage;
            } else {
                stage = (STATUS_TO_STAGE[dbStatus] || 'admin_review') as WorkflowStage;
            }

            return {
                id: row.applicant_id,
                applicationId: String(row.app_id),
                caseNumber: row.case_number ?? '',
                applicantName: name,
                applicationCount: parseInt(row.app_count),
                totalAmount: parseInt(row.total_approved) || 0,
                appliedAt: row.apply_at ? row.apply_at.toISOString().split('T')[0] : '',
                stage,
                officer: offName,
                officerId: row.officer_id ? String(row.officer_id) : null,
            };
        });
    } catch (err) {
        console.error('fetchCaseSummaries error', err);
        return [];
    } finally {
        client.release();
    }
}

/**
 * Batch-assign an officer to multiple applications.
 */
export async function assignOfficerBatch(
    applicationIds: string[],
    officerUserId: string,
    operatorAccount?: string
): Promise<{ success: boolean; error?: string }> {
    if (!applicationIds.length) return { success: false, error: '未選擇案件' };
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE applications SET officer_id = $1, updated_at = NOW()
             WHERE id = ANY($2::bigint[])`,
            [officerUserId, applicationIds]
        );
        void writeAuditLog({
            userId: null,
            action: 'application.officer_assign',
            targetType: 'application',
            targetId: applicationIds.join(','),
            detail: { applicationIds, officerUserId },
        });
        return { success: true };
    } catch (err: any) {
        console.error('assignOfficerBatch error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Fetch all historical application records for a specific applicant.
 */
export async function fetchApplicantHistory(applicantId: string): Promise<ApplicationRecord[]> {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT 
                a.id, a.apply_at, a.status, a.approved_amount,
                u_off.name_enc as off_name_enc, u_off.name_iv as off_name_iv,
                u_off.account as officer_account,
                w.stage as wf_stage
            FROM applications a
            LEFT JOIN users u_off ON u_off.id = a.officer_id
            LEFT JOIN application_workflow w ON w.application_id = a.id
            WHERE a.applicant_id = $1
            ORDER BY a.apply_at DESC
        `, [applicantId]);

        // Get applicant name for the record (we could also pass it in or fetch once)
        const nameRes = await client.query('SELECT name_enc, name_iv FROM users WHERE id = $1', [applicantId]);
        const { decryptAES } = await import('../../lib/crypto');
        const applicantName = nameRes.rows[0]?.name_enc 
            ? decryptAES(nameRes.rows[0].name_enc, nameRes.rows[0].name_iv) || '未知'
            : '未知';

        return res.rows.map(row => {
            const dbStatus = row.status ?? '1';
            const dbWfStage = row.wf_stage;

            const offName = row.off_name_enc && row.off_name_iv
                ? decryptAES(row.off_name_enc, row.off_name_iv) || row.officer_account || '系統'
                : row.officer_account || '系統';

            let stage: WorkflowStage = 'admin_review';
            if (dbWfStage && DB_STAGE_TO_FRONTEND[dbWfStage]) {
                stage = DB_STAGE_TO_FRONTEND[dbWfStage] as WorkflowStage;
            } else {
                stage = (STATUS_TO_STAGE[dbStatus] || 'admin_review') as WorkflowStage;
            }

            // Map status code to 'active' | 'closed'
            // 2 (審核未通過結案), 4 (核銷完成結案), 5 (legacy completed) are closed.
            const status: ApplicationStatus = (dbStatus === '2' || dbStatus === '4') ? 'closed' : 'active';
            
            return {
                id: row.id,
                applicantId,
                applicantName,
                appliedAt: row.apply_at ? row.apply_at.toISOString().split('T')[0] : '',
                stage,
                officer: offName,
                status,
                closedReason: STATUS_LABEL[dbStatus] || undefined,
                amount: row.approved_amount ? parseInt(row.approved_amount) : undefined
            };
        });
    } catch (err) {
        console.error('fetchApplicantHistory error', err);
        return [];
    } finally {
        client.release();
    }
}

/**
 * Count active cases that have not yet been assigned to an officer.
 * Used to show the unassigned-case reminder on the homepage for assign-capable roles.
 */
export async function fetchApplicationIdsByCaseNumbers(
    caseNumbers: string[]
): Promise<Record<string, string>> {
    if (!caseNumbers.length) return {};
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id::text, case_number FROM applications WHERE case_number = ANY($1)`,
            [caseNumbers]
        );
        const map: Record<string, string> = {};
        for (const row of res.rows) {
            map[row.case_number] = String(row.id);
        }
        return map;
    } catch (err) {
        console.error('fetchApplicationIdsByCaseNumbers error', err);
        return {};
    } finally {
        client.release();
    }
}

export async function fetchUnassignedCount(): Promise<number> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT COUNT(*)::int AS cnt
             FROM applications
             WHERE officer_id IS NULL
               AND status NOT IN ('2', '4')`
        );
        return res.rows[0]?.cnt ?? 0;
    } catch (err) {
        console.error('fetchUnassignedCount error', err);
        return 0;
    } finally {
        client.release();
    }
}
