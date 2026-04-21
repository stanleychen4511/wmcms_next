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
    applicationWay: '1' | '2' = '1',
    referralUnitId: number | string | null = null,
): Promise<{ success: boolean; caseId?: string; error?: string }> {
    // 案件來源與轉介單位驗證：way='1' 時一律寫 NULL；way='2' 時必須給有效且啟用中的單位
    const way: '1' | '2' = applicationWay === '2' ? '2' : '1';
    let effectiveUnitId: string | null = null;
    if (way === '2') {
        if (referralUnitId === null || referralUnitId === undefined || referralUnitId === '') {
            return { success: false, error: '選擇「轉介」時必須指定轉介單位' };
        }
        effectiveUnitId = String(referralUnitId);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 0. 驗證轉介單位存在且啟用中（僅 way=2 時檢查）
        if (way === '2' && effectiveUnitId) {
            const unitRes = await client.query(
                `SELECT is_active FROM referral_units WHERE id = $1::bigint`,
                [effectiveUnitId]
            );
            if (unitRes.rowCount === 0) {
                await client.query('ROLLBACK');
                return { success: false, error: '轉介單位不存在' };
            }
            if (!unitRes.rows[0].is_active) {
                await client.query('ROLLBACK');
                return { success: false, error: '轉介單位已停用，請改選其他單位' };
            }
        }

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
            // 必須存成 Buffer（二進位），讀回時 .toString('hex') 才能還原原始 hex 字串
            const saltBuffer = Buffer.from(searchSalt, 'hex');
            const passHash = hashPassword(tempPass, searchSalt);

            const { enc: nameEnc, iv: nameIv } = encryptAES(name);
            const nameBidx = generateBlindIndex(name, searchSalt);

            const { enc: idEnc, iv: idIv } = encryptAES(normalizedId);
            const idBidx = generateBlindIndex(normalizedId, searchSalt);

            // ON CONFLICT：帳號已存在時更新加密資料（同一身分證換名字等情境）
            const insertUserQuery = `
                INSERT INTO users (
                    account, password, search_salt,
                    name_enc, name_iv, name_bidx,
                    id_number_enc, id_number_iv, id_number_bidx,
                    is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
                ON CONFLICT (account) DO UPDATE SET
                    name_enc         = EXCLUDED.name_enc,
                    name_iv          = EXCLUDED.name_iv,
                    name_bidx        = EXCLUDED.name_bidx,
                    id_number_enc    = EXCLUDED.id_number_enc,
                    id_number_iv     = EXCLUDED.id_number_iv,
                    id_number_bidx   = EXCLUDED.id_number_bidx,
                    search_salt      = EXCLUDED.search_salt,
                    password         = EXCLUDED.password,
                    is_active        = TRUE
                RETURNING id;
            `;

            const newU = await client.query(insertUserQuery, [
                generatedAccount, passHash, saltBuffer,
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
                case_number, applicant_id, officer_id, status, apply_at,
                application_type, apply_amount, application_way, referral_unit_id
            ) VALUES ($1, $2, $3, '1', NOW(), $4, $5, $6, $7::bigint)
            RETURNING id;
        `, [caseNumber, applicantId, officerId, typePrefix, applyAmount ?? null, way, effectiveUnitId]);

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
                    -- 僅核銷完成（status='4'）的案件才計入累積核准金額。
                    -- 共筆模式下 board_review 階段即可儲存 approved_amount，若不加 status 過濾會提前計入未結案的草案金額。
                    SUM(COALESCE(approved_amount, 0)) FILTER (WHERE status = '4' AND approved_amount IS NOT NULL AND approved_amount > 0) as total_approved
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
                    w.stage as wf_stage,
                    bra.group_id AS board_group_id
                FROM applications a
                LEFT JOIN users u_off ON u_off.id = a.officer_id
                LEFT JOIN application_workflow w ON w.application_id = a.id
                LEFT JOIN board_review_assignments bra ON bra.application_id = a.id
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
                l.officer_account,
                l.board_group_id
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
                assignedBoardGroupId: row.board_group_id != null ? String(row.board_group_id) : null,
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

// ─── Edit case basics (admin_review stage only) ─────────────────────────────

export interface UpdateApplicationBasicsPatch {
    applicantName?: string;
    applicationWay?: '1' | '2';
    referralUnitId?: string | null;
}

/**
 * Edit a case's basic info (applicant name / source / referral unit) during the
 * `admin_review` stage only. Writes a single audit entry with before/after diff
 * of only the fields that actually changed. No audit log when nothing changed.
 *
 * 申請類別（application_type）不在可編輯欄位內 — 案號 case_number 已綁定類別首字母，
 * 類別有誤須以不通過結案重新建立新案件。
 *
 * Permission: caller must be the case's officer OR have the admin role.
 * Stage: applications.status must be '1' AND workflow.stage must be 'admin_review'.
 */
export async function updateApplicationBasics(
    applicationId: string,
    patch: UpdateApplicationBasicsPatch,
    operatorUserId: string,
): Promise<{ success: boolean; error?: string; changedFields?: string[] }> {
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── Step a: load current values + workflow stage ───────────────────
        const caseRes = await client.query(
            `SELECT a.status, a.officer_id, a.applicant_id,
                    a.application_type, a.application_way, a.referral_unit_id,
                    w.stage AS wf_stage
             FROM applications a
             LEFT JOIN application_workflow w ON w.application_id = a.id
             WHERE a.id = $1::bigint
             LIMIT 1`,
            [applicationId]
        );
        if (caseRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件不存在' };
        }
        const row = caseRes.rows[0];

        // ── Step b: stage check ────────────────────────────────────────────
        if (row.status !== '1' || row.wf_stage !== 'admin_review') {
            await client.query('ROLLBACK');
            return { success: false, error: '僅行政初審階段可修改案件基本資訊' };
        }

        // ── Step c: permission check ───────────────────────────────────────
        const isOfficer = String(row.officer_id ?? '') === String(operatorUserId ?? '');
        let isAdmin = false;
        if (!isOfficer) {
            const roleRes = await client.query(
                `SELECT 1 FROM user_roles ur
                 JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = $1::bigint AND r.code = 'admin'
                 LIMIT 1`,
                [operatorUserId]
            );
            isAdmin = (roleRes.rowCount ?? 0) > 0;
        }
        if (!isOfficer && !isAdmin) {
            await client.query('ROLLBACK');
            return { success: false, error: '無權限修改此案件' };
        }

        // ── Step d: normalize & validate referral fields ───────────────────
        // 申請類別不可修改（鎖住與 case_number 首字母的對應），僅讀取現值供後續 UPDATE 使用
        const currentType = row.application_type;

        const nextWay: '1' | '2' = (patch.applicationWay ?? row.application_way ?? '1') as '1' | '2';
        if (nextWay !== '1' && nextWay !== '2') {
            await client.query('ROLLBACK');
            return { success: false, error: '案件來源必須為自提(1)或轉介(2)' };
        }

        let nextReferralUnitId: string | null;
        if (nextWay === '1') {
            // way='1' → force null regardless of patch input
            nextReferralUnitId = null;
        } else {
            // way='2' → required & must point to active unit
            const candidate = patch.referralUnitId !== undefined
                ? patch.referralUnitId
                : (row.referral_unit_id !== null ? String(row.referral_unit_id) : null);
            if (!candidate) {
                await client.query('ROLLBACK');
                return { success: false, error: '選擇「轉介」時必須指定轉介單位' };
            }
            const unitRes = await client.query(
                `SELECT is_active FROM referral_units WHERE id = $1::bigint`,
                [candidate]
            );
            if (unitRes.rowCount === 0) {
                await client.query('ROLLBACK');
                return { success: false, error: '轉介單位不存在' };
            }
            if (!unitRes.rows[0].is_active) {
                await client.query('ROLLBACK');
                return { success: false, error: '轉介單位已停用，請改選其他單位' };
            }
            nextReferralUnitId = candidate;
        }

        // ── Step e: applicant name handling ────────────────────────────────
        let oldApplicantName: string | undefined;
        let nameActuallyChanged = false;
        let newNameEncArgs: { enc: Buffer; iv: Buffer; bidx: string | null } | null = null;

        if (patch.applicantName !== undefined) {
            const newName = patch.applicantName.trim();
            if (newName.length < 1 || newName.length > 50) {
                await client.query('ROLLBACK');
                return { success: false, error: '申請人姓名長度須為 1–50 字' };
            }

            // Decrypt current applicant name for comparison
            const userRes = await client.query(
                `SELECT search_salt, name_enc, name_iv
                 FROM users WHERE id = $1::bigint LIMIT 1`,
                [row.applicant_id]
            );
            if (userRes.rowCount === 0) {
                await client.query('ROLLBACK');
                return { success: false, error: '找不到申請人資料' };
            }
            const u = userRes.rows[0];

            const { decryptAES, encryptAES } = await import('../../lib/crypto');
            oldApplicantName = u.name_enc && u.name_iv
                ? decryptAES(u.name_enc, u.name_iv) || ''
                : '';

            if (oldApplicantName !== newName) {
                nameActuallyChanged = true;
                const { enc, iv } = encryptAES(newName);
                // Re-use existing search_salt (Buffer → hex) for blind index
                const saltHex = Buffer.isBuffer(u.search_salt)
                    ? u.search_salt.toString('hex')
                    : String(u.search_salt ?? '');
                const bidx = saltHex ? generateBlindIndex(newName, saltHex) : null;
                newNameEncArgs = { enc: enc as Buffer, iv: iv as Buffer, bidx };
            }
        }

        // ── Step f: diff & UPDATE ──────────────────────────────────────────
        const changedFields: string[] = [];
        const before: Record<string, unknown> = {};
        const after: Record<string, unknown> = {};

        if (nameActuallyChanged) {
            changedFields.push('applicantName');
            before.applicantName = oldApplicantName;
            after.applicantName = patch.applicantName!.trim();
        }
        if (patch.applicationWay !== undefined && nextWay !== row.application_way) {
            changedFields.push('applicationWay');
            before.applicationWay = row.application_way;
            after.applicationWay = nextWay;
        }
        const currentUnitIdStr = row.referral_unit_id !== null ? String(row.referral_unit_id) : null;
        if (nextReferralUnitId !== currentUnitIdStr) {
            changedFields.push('referralUnitId');
            before.referralUnitId = currentUnitIdStr;
            after.referralUnitId = nextReferralUnitId;
        }

        // No-op: commit and return without audit
        if (changedFields.length === 0) {
            await client.query('COMMIT');
            return { success: true, changedFields: [] };
        }

        // UPDATE users name if changed
        if (nameActuallyChanged && newNameEncArgs) {
            await client.query(
                `UPDATE users SET name_enc = $1, name_iv = $2, name_bidx = $3
                 WHERE id = $4::bigint`,
                [newNameEncArgs.enc, newNameEncArgs.iv, newNameEncArgs.bidx, row.applicant_id]
            );
        }

        // UPDATE applications if any of its columns changed
        // 不會更新 application_type（維持與 case_number 首字母一致）
        const appChangedCols = changedFields.filter(f => f !== 'applicantName');
        if (appChangedCols.length > 0) {
            await client.query(
                `UPDATE applications
                 SET application_way  = $1,
                     referral_unit_id = $2::bigint,
                     updated_at       = NOW()
                 WHERE id = $3::bigint`,
                [nextWay, nextReferralUnitId, applicationId]
            );
        }
        // currentType 被保留以供未來除錯參考（目前未使用於 UPDATE）
        void currentType;

        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'application.basics_update',
            targetType: 'application',
            targetId: applicationId,
            detail: { changedFields, before, after },
        });

        return { success: true, changedFields };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('updateApplicationBasics error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
