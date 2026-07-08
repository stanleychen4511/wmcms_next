'use server';

import { pool } from '../../lib/db';
import { formatDateOnly } from '../../lib/dateOnly';
import { generateBlindIndex } from '../../lib/crypto';
import { CaseSummary, ApplicationRecord, WorkflowStage, ApplicationStatus } from '../../types';
import { STATUS_TO_STAGE, DB_STAGE_TO_FRONTEND, STATUS_LABEL } from '../../lib/stageMaps';
import { writeAuditLog } from './auditActions';

export interface ApplicationStatusResult {
    found: boolean;
    hasActiveApplication?: boolean;
    status?: string | null;
    applyAmount?: number | null;
    approvedAmount?: number | null;
    totalApprovedAmount?: number;
    /** 累積核准補助金額 — 經濟弱勢（subsidy_subtype='1'）案件加總 */
    totalApprovedSubtype1?: number;
    /** 累積核准補助金額 — 小康家庭（subsidy_subtype='2'）案件加總 */
    totalApprovedSubtype2?: number;
    maxAmount?: number;
    remaining?: number;
    error?: string;
}

/**
 * #24: 用身分證號（blind index）查詢申請人 ID。
 * 回傳 null 表示查不到。
 *
 * DB 內所有 search_salt 都是 32-byte Buffer（CLAUDE.md 規定的格式；歷史 64-byte
 * 不一致格式已由 scripts/migrate_64byte_salts.mjs 一次性轉換完畢）。
 * Bidx 是 TEXT (64-char hex string)，與寫入時 `generateBlindIndex(value, hexStr)` 一致。
 */
export async function findApplicantIdByIdNumber(idNumber: string): Promise<string | null> {
    const trimmed = (idNumber ?? '').trim().toUpperCase();
    if (!trimmed) return null;
    const client = await pool.connect();
    try {
        const usersRes = await client.query(
            `SELECT id, search_salt, id_number_bidx FROM users WHERE is_active = true`
        );
        for (const row of usersRes.rows) {
            if (!row.search_salt || !row.id_number_bidx) continue;
            const saltHex = (row.search_salt as Buffer).toString('hex');
            if (generateBlindIndex(trimmed, saltHex) === String(row.id_number_bidx)) {
                return String(row.id);
            }
        }
        return null;
    } finally {
        client.release();
    }
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
        //    同時依 subsidy_subtype 分開累計，給 UI 顯示「經濟弱勢累計 / 小康家庭累計」
        const sumRes = await client.query(`
            SELECT
                COALESCE(SUM(approved_amount), 0) AS total_approved,
                COALESCE(SUM(approved_amount) FILTER (WHERE subsidy_subtype = '1'), 0) AS total_approved_1,
                COALESCE(SUM(approved_amount) FILTER (WHERE subsidy_subtype = '2'), 0) AS total_approved_2
            FROM applications
            WHERE applicant_id = $1 AND status = '4'
        `, [matchedUserId]);

        const totalApprovedAmount    = parseInt(sumRes.rows[0].total_approved   || '0', 10);
        const totalApprovedSubtype1  = parseInt(sumRes.rows[0].total_approved_1 || '0', 10);
        const totalApprovedSubtype2  = parseInt(sumRes.rows[0].total_approved_2 || '0', 10);

        // 子類型尚未選定（lookup 階段），採兩子類型較大值；submit 時再用實際子類型 enforce
        const { fetchSubsidyAmountLimitsMap } = await import('./eligibilityRulesActions');
        const limits = await fetchSubsidyAmountLimitsMap();
        const maxAmount = Math.max(limits['1'] ?? 0, limits['2'] ?? 0);
        const remaining = Math.max(0, maxAmount - totalApprovedAmount);

        const appData = appRes.rows[0] ?? null;
        return {
            found: true,
            hasActiveApplication,
            status: appData?.status ?? null,
            applyAmount: appData?.apply_amount ?? null,
            approvedAmount: appData?.approved_amount ?? null,
            totalApprovedAmount,
            totalApprovedSubtype1,
            totalApprovedSubtype2,
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
    email: string = '',
    referralInfo?: {
        unitName?: string;
        contactName?: string;
        contactTitle?: string;
        contactPhone?: string;
        contactEmail?: string;
    },
    /** 補助子類型（115 年辦法）：'1'=經濟弱勢、'2'=小康家庭；未指定則 NULL（後續可在資格表單補填） */
    subsidySubtype?: '1' | '2' | null,
    /** 申請人聯絡電話（必填） */
    applicantPhone: string = '',
    /** 申請人出生年月日 YYYY-MM-DD（必填） */
    applicantDob: string = '',
    /** 癌別（必填） */
    cancerType: string = '',
    /** 癌症期數（必填） */
    cancerStage: string = '',
    /** 申請形式：'P' 紙本 / 'E' 電子郵件（必填） */
    applicationForm: 'P' | 'E' | '' = '',
    /** 治療階段：'B' 治療前 / 'A' 治療後 / 'X' 治療前後（必填） */
    treatmentPhase: 'B' | 'A' | 'X' | '' = '',
    _emailVerificationToken: string = '',
    _referralEmailVerificationToken: string = '',
): Promise<{ success: boolean; caseId?: string; error?: string }> {
    const isEconomicWeak = subsidySubtype === '1';
    // 內部新增案件不需 Email 驗證；經濟弱勢主要聯繫轉介單位，申請人 Email 可空白。
    const trimmedEmail = (email ?? '').trim();
    if (!isEconomicWeak && (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))) {
        return { success: false, error: '請填寫有效的 Email 地址' };
    }
    const trimmedPhone = (applicantPhone ?? '').trim();
    if (!trimmedPhone) {
        return { success: false, error: '請填寫申請人聯絡電話' };
    }
    // 出生年月日 / 癌別 / 期數 必填
    const trimmedDob = (applicantDob ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDob)) {
        return { success: false, error: '請填寫有效的出生年月日（YYYY-MM-DD）' };
    }
    const trimmedCancerType = (cancerType ?? '').trim();
    if (!trimmedCancerType) {
        return { success: false, error: '請填寫癌別' };
    }
    const trimmedCancerStage = (cancerStage ?? '').trim();
    if (!trimmedCancerStage) {
        return { success: false, error: '請填寫癌症期數' };
    }
    // 申請形式 / 治療前後 必填
    if (applicationForm !== 'P' && applicationForm !== 'E') {
        return { success: false, error: '請選擇申請形式（紙本／電子郵件）' };
    }
    if (treatmentPhase !== 'B' && treatmentPhase !== 'A' && treatmentPhase !== 'X') {
        return { success: false, error: '請選擇欲申請治療項目（治療完成三個月以內／治療未開始／兩者皆有）' };
    }
    // 案件來源與轉介單位驗證：way='1' 時一律寫 NULL；way='2' 時須提供轉介單位
    //   - 可從 referral_units 表選（referralUnitId）
    //   - 或在 referralInfo.unitName 自由填寫（#6 改版後加上）
    //   兩者擇一即可
    const way: '1' | '2' = applicationWay === '2' ? '2' : '1';
    let effectiveUnitId: string | null = null;
    if (way === '2') {
        const hasUnitId   = !(referralUnitId === null || referralUnitId === undefined || referralUnitId === '');
        const hasFreeText = !!(referralInfo?.unitName?.trim());
        if (!hasUnitId && !hasFreeText) {
            return { success: false, error: '選擇「轉介」時請選擇或自由填寫轉介單位' };
        }
        const referralEmail = referralInfo?.contactEmail?.trim() ?? '';
        if (!referralEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referralEmail)) {
            return { success: false, error: '轉介申請須填寫有效的轉介人 Email' };
        }
        if (hasUnitId) effectiveUnitId = String(referralUnitId);
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

        const applicantEmailForDb = trimmedEmail || null;

        if (applicantId && applicantEmailForDb) {
            // Existing applicant — refresh email (they may be re-applying with updated contact)
            await client.query(
                `UPDATE users SET email = $1 WHERE id = $2::bigint`,
                [applicantEmailForDb, applicantId]
            );
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
                    email, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
                ON CONFLICT (account) DO UPDATE SET
                    name_enc         = EXCLUDED.name_enc,
                    name_iv          = EXCLUDED.name_iv,
                    name_bidx        = EXCLUDED.name_bidx,
                    id_number_enc    = EXCLUDED.id_number_enc,
                    id_number_iv     = EXCLUDED.id_number_iv,
                    id_number_bidx   = EXCLUDED.id_number_bidx,
                    search_salt      = EXCLUDED.search_salt,
                    password         = EXCLUDED.password,
                    email            = EXCLUDED.email,
                    is_active        = TRUE
                RETURNING id;
            `;

            const newU = await client.query(insertUserQuery, [
                generatedAccount, passHash, saltBuffer,
                nameEnc, nameIv, nameBidx,
                idEnc, idIv, idBidx,
                applicantEmailForDb,
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
        // 子類型驗證：經濟弱勢（'1'）依 115 辦法僅接受轉介
        const effectiveSubtype: '1' | '2' | null = subsidySubtype ?? null;
        if (effectiveSubtype === '1' && way !== '2') {
            await client.query('ROLLBACK');
            return { success: false, error: '經濟弱勢補助依 115 辦法僅接受「轉介」管道' };
        }

        const appRes = await client.query(`
            INSERT INTO applications (
                case_number, applicant_id, officer_id, status, apply_at,
                application_type, apply_amount, application_way, referral_unit_id,
                referral_unit_name, referral_contact_name, referral_contact_title, referral_contact_phone, referral_contact_email,
                subsidy_subtype, applicant_phone,
                applicant_dob, cancer_type, cancer_stage,
                application_form, treatment_phase
            ) VALUES ($1, $2, $3, '1', NOW(), $4, $5, $6, $7::bigint, $8, $9, $10, $11, $12, $13, $14, $15::date, $16, $17, $18, $19)
            RETURNING id;
        `, [
            caseNumber, applicantId, officerId, typePrefix, applyAmount ?? null, way, effectiveUnitId,
            referralInfo?.unitName?.trim() || null,
            referralInfo?.contactName?.trim() || null,
            referralInfo?.contactTitle?.trim() || null,
            referralInfo?.contactPhone?.trim() || null,
            referralInfo?.contactEmail?.trim() || null,
            effectiveSubtype,
            trimmedPhone,
            trimmedDob, trimmedCancerType, trimmedCancerStage,
            applicationForm, treatmentPhase,
        ]);

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
export async function fetchCaseSummaries(
    options?: { volunteerOnlyFilterUserId?: string }
): Promise<CaseSummary[]> {
    // 志工視野過濾（#11）：只回家訪指派為該志工的案件
    // 上層應只在「使用者僅有 volunteer 角色，沒有 case_officer/admin 等廣權限」時傳入此參數
    const volunteerFilter = options?.volunteerOnlyFilterUserId;
    const useVolunteerFilter = !!(volunteerFilter && /^\d+$/.test(volunteerFilter));

    const client = await pool.connect();
    try {
        // applicants_for_volunteer：依 home_visit_assignee_id 比對，只看這位志工被指派的案件
        const queryText = `
            ${useVolunteerFilter ? `
            WITH applicants_for_volunteer AS (
                SELECT DISTINCT a.applicant_id
                FROM applications a
                WHERE a.home_visit_assignee_id = $1::bigint
            ),
            ` : 'WITH '}user_stats AS (
                SELECT
                    applicant_id,
                    COUNT(*) as app_count,
                    SUM(COALESCE(approved_amount, 0)) FILTER (WHERE status = '4' AND approved_amount IS NOT NULL AND approved_amount > 0) as total_approved
                FROM applications
                ${useVolunteerFilter ? 'WHERE applicant_id IN (SELECT applicant_id FROM applicants_for_volunteer)' : ''}
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
                    a.subsidy_subtype,
                    a.applicant_phone,
                    u_off.name_enc as off_name_enc, u_off.name_iv as off_name_iv,
                    u_off.account as officer_account,
                    w.stage as wf_stage,
                    bra.group_id AS board_group_id
                FROM applications a
                LEFT JOIN users u_off ON u_off.id = a.officer_id
                LEFT JOIN LATERAL (
                    SELECT stage FROM application_workflow
                    WHERE application_id = a.id
                    ORDER BY id DESC LIMIT 1
                ) w ON TRUE
                LEFT JOIN board_review_assignments bra ON bra.application_id = a.id
                ${useVolunteerFilter ? 'WHERE a.applicant_id IN (SELECT applicant_id FROM applicants_for_volunteer)' : ''}
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
                l.board_group_id,
                l.subsidy_subtype,
                l.applicant_phone
            FROM users u
            JOIN user_stats s ON s.applicant_id = u.id
            LEFT JOIN latest_apps l ON l.applicant_id = u.id
            ORDER BY l.apply_at DESC NULLS LAST
        `;
        const params = useVolunteerFilter ? [volunteerFilter] : [];
        const res = await client.query(queryText, params);

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
                applicantPhone: row.applicant_phone ?? null,
                applicationCount: parseInt(row.app_count),
                totalAmount: parseInt(row.total_approved) || 0,
                appliedAt: formatDateOnly(row.apply_at) ?? '',
                stage,
                officer: offName,
                officerId: row.officer_id ? String(row.officer_id) : null,
                assignedBoardGroupId: row.board_group_id != null ? String(row.board_group_id) : null,
                subsidySubtype: (row.subsidy_subtype === '1' || row.subsidy_subtype === '2')
                    ? row.subsidy_subtype : null,
                statusCode: dbStatus,
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
        const { notifyEvent } = await import('./notificationDispatcher');
        for (const applicationId of applicationIds) {
            void notifyEvent('case_assigned_to_officer', { applicationId, officerUserId })
                .catch(err => console.error('[notify] case_assigned_to_officer failed:', err));
        }
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
        // Append-only workflow：每案多列；用 LATERAL 取最新一列當作目前 stage
        const res = await client.query(`
            SELECT
                a.id, a.case_number, a.apply_at, a.status, a.approved_amount,
                u_off.name_enc as off_name_enc, u_off.name_iv as off_name_iv,
                u_off.account as officer_account,
                w.stage as wf_stage
            FROM applications a
            LEFT JOIN users u_off ON u_off.id = a.officer_id
            LEFT JOIN LATERAL (
                SELECT stage FROM application_workflow
                WHERE application_id = a.id
                ORDER BY id DESC LIMIT 1
            ) w ON TRUE
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
                caseNumber: row.case_number ?? undefined,
                applicantId,
                applicantName,
                appliedAt: formatDateOnly(row.apply_at) ?? '',
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

/**
 * 取得所有「尚未派案」（officer_id IS NULL 且未結案）的案件清單。
 * 給首頁的「未派案」modal 用。回傳順序為 apply_at ASC（最早申請的先處理）。
 */
export async function fetchUnassignedCases(): Promise<Array<{ applicationId: string; caseNumber: string; applicantName: string; appliedAt: string | null }>> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT a.id::text AS app_id, a.case_number, a.apply_at,
                    u.name_enc, u.name_iv
             FROM applications a
             JOIN users u ON u.id = a.applicant_id
             WHERE a.officer_id IS NULL AND a.status NOT IN ('2','4')
             ORDER BY a.apply_at ASC NULLS LAST`
        );
        const { decryptAES } = await import('../../lib/crypto');
        return res.rows.map(row => {
            const name = row.name_enc && row.name_iv ? (decryptAES(row.name_enc, row.name_iv) || '未知') : '未知';
            return {
                applicationId: row.app_id,
                caseNumber: row.case_number ?? '',
                applicantName: name,
                appliedAt: formatDateOnly(row.apply_at),
            };
        });
    } catch (err) {
        console.error('fetchUnassignedCases error', err);
        return [];
    } finally {
        client.release();
    }
}

/**
 * 取得「可撥款但尚未建立撥款紀錄」的案件清單（個管自己負責的）。
 *
 * 條件：
 *   - status='3' （待核銷 — 董事審核已通過、進入核銷階段）
 *   - officer_id = $1 （當前個管）
 *   - 尚無任何 payment_disbursements 紀錄
 *
 * 用途：首頁「可撥款」提醒按鈕，提醒承辦人對核可通過的案件建立撥款流程。
 */
export async function fetchDisbursableCases(operatorUserId: string): Promise<Array<{
    applicationId: string; caseNumber: string; applicantName: string; approvedAmount: number | null;
}>> {
    if (!/^\d+$/.test(operatorUserId)) return [];
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT a.id::text AS app_id, a.case_number, a.approved_amount,
                    u.name_enc, u.name_iv
             FROM applications a
             JOIN users u ON u.id = a.applicant_id
             WHERE a.status = '3'
               AND a.officer_id = $1::bigint
               AND NOT EXISTS (
                   SELECT 1 FROM payment_disbursements pd
                   WHERE pd.application_id = a.id
               )
             ORDER BY a.apply_at ASC NULLS LAST`,
            [operatorUserId]
        );
        const { decryptAES } = await import('../../lib/crypto');
        return res.rows.map(row => ({
            applicationId: row.app_id,
            caseNumber: row.case_number ?? '',
            applicantName: row.name_enc && row.name_iv
                ? (decryptAES(row.name_enc, row.name_iv) || '未知') : '未知',
            approvedAmount: row.approved_amount != null ? Number(row.approved_amount) : null,
        }));
    } catch (err) {
        console.error('fetchDisbursableCases error', err);
        return [];
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

/**
 * #12 編輯領款收據：開放 case_officer/admin/supervisor 在任何階段更新申請人聯絡電話 + 戶籍地址，
 * 不受 updateApplicationBasics 的 stage='admin_review' 限制（因為這兩個欄位是領款收據必要資料，
 * 進入核銷後仍可能需要修正）。
 *
 * 只接受兩個欄位，比 updateApplicationBasics 嚴格，避免被誤用為「繞過 stage 鎖」的入口。
 */
export async function updateApplicantContact(
    applicationId: string,
    patch: { applicantPhone?: string; applicantAddress?: string | null },
    operatorUserId: string,
): Promise<{ success: boolean; error?: string; changedFields?: string[] }> {
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };

    const trimmedPhone = patch.applicantPhone !== undefined ? patch.applicantPhone.trim() : undefined;
    if (trimmedPhone !== undefined) {
        if (!trimmedPhone) return { success: false, error: '申請人聯絡電話為必填' };
        if (trimmedPhone.length > 50) return { success: false, error: '聯絡電話過長' };
    }
    const newAddr = patch.applicantAddress !== undefined
        ? ((patch.applicantAddress ?? '').trim() || null)
        : undefined;
    if (newAddr !== undefined && newAddr && newAddr.length > 500) {
        return { success: false, error: '戶籍地址過長' };
    }

    const client = await pool.connect();
    try {
        // 權限守門：case_officer / supervisor / admin（chairman/board_member 不能改）
        const caseRes = await client.query(
            `SELECT a.officer_id, a.applicant_phone, a.applicant_address
             FROM applications a WHERE a.id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (caseRes.rowCount === 0) return { success: false, error: '案件不存在' };
        const row = caseRes.rows[0];
        const roleRes = await client.query(
            `SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint`,
            [operatorUserId]
        );
        const roles = roleRes.rows.map((r: any) => r.code);
        const isOfficer = String(row.officer_id) === String(operatorUserId) && roles.includes('case_officer');
        const isPriv = roles.includes('admin') || roles.includes('supervisor');
        if (!isOfficer && !isPriv) {
            return { success: false, error: '僅指派之承辦人、主管或系統管理員可修改' };
        }

        const sets: string[] = [];
        const params: unknown[] = [];
        const changedFields: string[] = [];
        if (trimmedPhone !== undefined && trimmedPhone !== (row.applicant_phone ?? '')) {
            params.push(trimmedPhone);
            sets.push(`applicant_phone = $${params.length}`);
            changedFields.push('applicantPhone');
        }
        if (newAddr !== undefined && newAddr !== (row.applicant_address ?? null)) {
            params.push(newAddr);
            sets.push(`applicant_address = $${params.length}`);
            changedFields.push('applicantAddress');
        }
        if (sets.length === 0) return { success: true, changedFields: [] };

        sets.push('updated_at = NOW()');
        params.push(applicationId);
        await client.query(
            `UPDATE applications SET ${sets.join(', ')} WHERE id = $${params.length}::bigint`,
            params
        );
        return { success: true, changedFields };
    } catch (err: any) {
        console.error('updateApplicantContact error:', err);
        return { success: false, error: err.message ?? '更新失敗' };
    } finally {
        client.release();
    }
}

export interface UpdateApplicationBasicsPatch {
    applicantName?: string;
    applicantEmail?: string | null;
    /** 申請人聯絡電話；不可清空 */
    applicantPhone?: string;
    /** 申請人戶籍地址；可空字串 */
    applicantAddress?: string | null;
    /** 出生年月日 YYYY-MM-DD；不可清空 */
    applicantDob?: string;
    /** 癌別；不可清空 */
    cancerType?: string;
    /** 癌症期數；不可清空 */
    cancerStage?: string;
    /** 申請形式：'P' 紙本 / 'E' 電子郵件；不可清空 */
    applicationForm?: 'P' | 'E';
    /** 治療階段：'B'/'A'/'X'；不可清空 */
    treatmentPhase?: 'B' | 'A' | 'X';
    applicationWay?: '1' | '2';
    referralUnitId?: string | null;
    /** #6 轉介單位／承辦人聯絡欄位（way='2' 時隨案保存） */
    referralUnitName?: string | null;
    referralContactName?: string | null;
    referralContactTitle?: string | null;
    referralContactPhone?: string | null;
}

export async function checkApplicationBasicsEditBlock(
    applicationId: string,
): Promise<{ blocked: boolean; reason?: string }> {
    if (!/^\d+$/.test(applicationId)) return { blocked: true, reason: '不正確的案件 ID' };

    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT receipt_number, external_code
             FROM payment_disbursements
             WHERE application_id = $1::bigint
               AND review_stage IN ('1','2','3','4')
             ORDER BY id DESC
             LIMIT 1`,
            [applicationId]
        );
        if ((res.rowCount ?? 0) === 0) return { blocked: false };

        const row = res.rows[0];
        const no = row.receipt_number || row.external_code || '未編號';
        return {
            blocked: true,
            reason: `此案有進行中的撥款（撥款單號 ${no}），請先作廢當前撥款後再編輯個人資料。`,
        };
    } catch (err: any) {
        console.error('checkApplicationBasicsEditBlock error:', err);
        return { blocked: true, reason: err.message ?? '檢查撥款狀態失敗' };
    } finally {
        client.release();
    }
}

/**
 * Edit a case's basic info (applicant name / source / referral unit). Writes a
 * single audit entry with before/after diff
 * of only the fields that actually changed. No audit log when nothing changed.
 *
 * 申請類別（application_type）不在可編輯欄位內 — 案號 case_number 已綁定類別首字母，
 * 類別有誤須以不通過結案重新建立新案件。
 *
 * Permission: caller must be the case's officer OR have the admin role.
 * Guard: blocked while the case has an in-flight payment_disbursement.
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
                    a.referral_unit_name, a.referral_contact_name,
                    a.referral_contact_title, a.referral_contact_phone,
                    a.applicant_phone, a.applicant_address, a.applicant_dob, a.cancer_type, a.cancer_stage,
                    a.application_form, a.treatment_phase,
                    u_app.email AS applicant_email,
                    w.stage AS wf_stage
             FROM applications a
             LEFT JOIN users u_app ON u_app.id = a.applicant_id
             LEFT JOIN LATERAL (
                 SELECT stage FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY id DESC LIMIT 1
             ) w ON TRUE
             WHERE a.id = $1::bigint
             LIMIT 1`,
            [applicationId]
        );
        if (caseRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件不存在' };
        }
        const row = caseRes.rows[0];

        // ── Step b: disbursement guard ─────────────────────────────────────
        const blockRes = await client.query(
            `SELECT receipt_number, external_code
             FROM payment_disbursements
             WHERE application_id = $1::bigint
               AND review_stage IN ('1','2','3','4')
             ORDER BY id DESC
             LIMIT 1`,
            [applicationId]
        );
        if ((blockRes.rowCount ?? 0) > 0) {
            await client.query('ROLLBACK');
            const d = blockRes.rows[0];
            const no = d.receipt_number || d.external_code || '未編號';
            return { success: false, error: `此案有進行中的撥款（撥款單號 ${no}），請先作廢當前撥款後再編輯個人資料。` };
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

        // ── Step e2: applicant phone handling（必填、不可清空） ─────────────
        let emailActuallyChanged = false;
        let nextEmail: string | null = row.applicant_email ?? null;
        if (patch.applicantEmail !== undefined) {
            const newEmail = (patch.applicantEmail ?? '').trim();
            if (newEmail.length > 255) {
                await client.query('ROLLBACK');
                return { success: false, error: 'Email 長度不可超過 255 字' };
            }
            if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
                await client.query('ROLLBACK');
                return { success: false, error: '請輸入有效的 Email 格式' };
            }
            const normalizedEmail = newEmail || null;
            if (normalizedEmail !== (row.applicant_email ?? null)) {
                emailActuallyChanged = true;
                nextEmail = normalizedEmail;
            }
        }

        let phoneActuallyChanged = false;
        let nextPhone: string = row.applicant_phone ?? '';
        if (patch.applicantPhone !== undefined) {
            const newPhone = patch.applicantPhone.trim();
            if (!newPhone) {
                await client.query('ROLLBACK');
                return { success: false, error: '申請人聯絡電話為必填' };
            }
            if (newPhone.length > 50) {
                await client.query('ROLLBACK');
                return { success: false, error: '聯絡電話過長' };
            }
            if (newPhone !== (row.applicant_phone ?? '')) {
                phoneActuallyChanged = true;
                nextPhone = newPhone;
            }
        }

        // ── Step e2b: applicant address handling（選填，可空） ─────────────
        let addressActuallyChanged = false;
        let nextAddress: string | null = row.applicant_address ?? null;
        if (patch.applicantAddress !== undefined) {
            const newAddr = (patch.applicantAddress ?? '').trim() || null;
            if (newAddr && newAddr.length > 500) {
                await client.query('ROLLBACK');
                return { success: false, error: '戶籍地址過長' };
            }
            if (newAddr !== (row.applicant_address ?? null)) {
                addressActuallyChanged = true;
                nextAddress = newAddr;
            }
        }

        // ── Step e3: DOB / 癌別 / 期數 — 必填且不可清空 ────────────────────
        const formatDob = (v: unknown): string => {
            if (!v) return '';
            const d = new Date(v as string | number | Date);
            if (Number.isNaN(d.getTime())) return '';
            const p = (n: number) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        };
        const curDob = formatDob(row.applicant_dob);
        let dobChanged = false;
        let nextDob: string = curDob;
        if (patch.applicantDob !== undefined) {
            const v = patch.applicantDob.trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                await client.query('ROLLBACK');
                return { success: false, error: '出生年月日格式錯誤（YYYY-MM-DD）' };
            }
            if (v !== curDob) { dobChanged = true; nextDob = v; }
        }
        let cancerTypeChanged = false;
        let nextCancerType: string = row.cancer_type ?? '';
        if (patch.cancerType !== undefined) {
            const v = patch.cancerType.trim();
            if (!v) { await client.query('ROLLBACK'); return { success: false, error: '癌別為必填' }; }
            if (v.length > 100) { await client.query('ROLLBACK'); return { success: false, error: '癌別過長' }; }
            if (v !== (row.cancer_type ?? '')) { cancerTypeChanged = true; nextCancerType = v; }
        }
        let cancerStageChanged = false;
        let nextCancerStage: string = row.cancer_stage ?? '';
        if (patch.cancerStage !== undefined) {
            const v = patch.cancerStage.trim();
            if (!v) { await client.query('ROLLBACK'); return { success: false, error: '癌症期數為必填' }; }
            if (v.length > 50) { await client.query('ROLLBACK'); return { success: false, error: '癌症期數過長' }; }
            if (v !== (row.cancer_stage ?? '')) { cancerStageChanged = true; nextCancerStage = v; }
        }

        // ── Step e4: 申請形式 / 治療前後 — 必填且不可清空 ─────────────────
        let applicationFormChanged = false;
        let nextApplicationForm: 'P' | 'E' = (row.application_form === 'P' || row.application_form === 'E') ? row.application_form : 'P';
        if (patch.applicationForm !== undefined) {
            if (patch.applicationForm !== 'P' && patch.applicationForm !== 'E') {
                await client.query('ROLLBACK');
                return { success: false, error: '申請形式必須為紙本或電子郵件' };
            }
            if (patch.applicationForm !== row.application_form) {
                applicationFormChanged = true;
                nextApplicationForm = patch.applicationForm;
            }
        }
        let treatmentPhaseChanged = false;
        let nextTreatmentPhase: 'B' | 'A' | 'X' =
            (row.treatment_phase === 'B' || row.treatment_phase === 'A' || row.treatment_phase === 'X') ? row.treatment_phase : 'A';
        if (patch.treatmentPhase !== undefined) {
            if (patch.treatmentPhase !== 'B' && patch.treatmentPhase !== 'A' && patch.treatmentPhase !== 'X') {
                await client.query('ROLLBACK');
                return { success: false, error: '欲申請治療項目必須為治療完成三個月以內、治療未開始或兩者皆有' };
            }
            if (patch.treatmentPhase !== row.treatment_phase) {
                treatmentPhaseChanged = true;
                nextTreatmentPhase = patch.treatmentPhase;
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
        if (emailActuallyChanged) {
            changedFields.push('applicantEmail');
            before.applicantEmail = row.applicant_email ?? null;
            after.applicantEmail = nextEmail;
        }
        if (phoneActuallyChanged) {
            changedFields.push('applicantPhone');
            before.applicantPhone = row.applicant_phone ?? null;
            after.applicantPhone = nextPhone;
        }
        if (addressActuallyChanged) {
            changedFields.push('applicantAddress');
            before.applicantAddress = row.applicant_address ?? null;
            after.applicantAddress = nextAddress;
        }
        if (dobChanged) {
            changedFields.push('applicantDob');
            before.applicantDob = curDob || null;
            after.applicantDob = nextDob;
        }
        if (cancerTypeChanged) {
            changedFields.push('cancerType');
            before.cancerType = row.cancer_type ?? null;
            after.cancerType = nextCancerType;
        }
        if (cancerStageChanged) {
            changedFields.push('cancerStage');
            before.cancerStage = row.cancer_stage ?? null;
            after.cancerStage = nextCancerStage;
        }
        if (applicationFormChanged) {
            changedFields.push('applicationForm');
            before.applicationForm = row.application_form ?? null;
            after.applicationForm = nextApplicationForm;
        }
        if (treatmentPhaseChanged) {
            changedFields.push('treatmentPhase');
            before.treatmentPhase = row.treatment_phase ?? null;
            after.treatmentPhase = nextTreatmentPhase;
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

        // 轉介聯絡欄位處理：保留資料策略
        //   - way='2'：以 patch 提供的值寫入；patch 未提供（undefined）= 不動
        //   - way='1'：保留先前轉介資料於 DB（patch 通常不含；若有送 null 則覆蓋）
        //     原因：使用者切到自提後再切回轉介時可保留先前填寫的內容
        const norm = (v: string | null | undefined): string | null | undefined => {
            if (v === undefined) return undefined; // 不變
            const t = (v ?? '').trim();
            return t === '' ? null : t;
        };
        const nextReferralFields: { col: string; key: string; cur: string | null; next: string | null | undefined }[] = [
            { col: 'referral_unit_name',     key: 'referralUnitName',     cur: row.referral_unit_name ?? null,     next: norm(patch.referralUnitName) },
            { col: 'referral_contact_name',  key: 'referralContactName',  cur: row.referral_contact_name ?? null,  next: norm(patch.referralContactName) },
            { col: 'referral_contact_title', key: 'referralContactTitle', cur: row.referral_contact_title ?? null, next: norm(patch.referralContactTitle) },
            { col: 'referral_contact_phone', key: 'referralContactPhone', cur: row.referral_contact_phone ?? null, next: norm(patch.referralContactPhone) },
        ];
        const referralColUpdates: { col: string; val: string | null }[] = [];
        for (const f of nextReferralFields) {
            if (f.next === undefined) continue;  // 不變
            if (f.next !== f.cur) {
                changedFields.push(f.key);
                before[f.key] = f.cur;
                after[f.key] = f.next;
                referralColUpdates.push({ col: f.col, val: f.next });
            }
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
        if (emailActuallyChanged) {
            await client.query(
                `UPDATE users SET email = $1 WHERE id = $2::bigint`,
                [nextEmail, row.applicant_id]
            );
        }

        // UPDATE applications if any of its columns changed
        // 不會更新 application_type（維持與 case_number 首字母一致）
        const appChangedCols = changedFields.filter(f => f !== 'applicantName' && f !== 'applicantEmail');
        if (appChangedCols.length > 0) {
            // 動態組欄位
            const sets: string[] = ['application_way = $1', 'referral_unit_id = $2::bigint', 'updated_at = NOW()'];
            const params: unknown[] = [nextWay, nextReferralUnitId];
            for (const u of referralColUpdates) {
                params.push(u.val);
                sets.push(`${u.col} = $${params.length}`);
            }
            if (phoneActuallyChanged) {
                params.push(nextPhone);
                sets.push(`applicant_phone = $${params.length}`);
            }
            if (addressActuallyChanged) {
                params.push(nextAddress);
                sets.push(`applicant_address = $${params.length}`);
            }
            if (dobChanged) {
                params.push(nextDob);
                sets.push(`applicant_dob = $${params.length}::date`);
            }
            if (cancerTypeChanged) {
                params.push(nextCancerType);
                sets.push(`cancer_type = $${params.length}`);
            }
            if (cancerStageChanged) {
                params.push(nextCancerStage);
                sets.push(`cancer_stage = $${params.length}`);
            }
            if (applicationFormChanged) {
                params.push(nextApplicationForm);
                sets.push(`application_form = $${params.length}`);
            }
            if (treatmentPhaseChanged) {
                params.push(nextTreatmentPhase);
                sets.push(`treatment_phase = $${params.length}`);
            }
            params.push(applicationId);
            await client.query(
                `UPDATE applications SET ${sets.join(', ')} WHERE id = $${params.length}::bigint`,
                params
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

// ─── 家訪人員指派（#11） ────────────────────────────────────────────────

/**
 * 列出可被指派去家訪的人員（volunteer + case_officer，皆 active）。
 * 回傳給 UI 顯示在「指派家訪」下拉選單。
 */
export async function fetchHomeVisitCandidates(): Promise<{ id: string; name: string; account: string; roleCodes: string[] }[]> {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT u.id::text AS id, u.account, u.name_enc, u.name_iv,
                   COALESCE(json_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '[]') AS roles
            FROM users u
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            WHERE u.is_active = TRUE
              AND u.id IN (
                  SELECT ur2.user_id FROM user_roles ur2
                  JOIN roles r2 ON r2.id = ur2.role_id
                  WHERE r2.code IN ('volunteer', 'case_officer')
              )
            GROUP BY u.id, u.account, u.name_enc, u.name_iv
            ORDER BY u.account ASC
        `);
        const { decryptAES } = await import('../../lib/crypto');
        return res.rows.map((r: any) => ({
            id: r.id,
            account: r.account,
            name: r.name_enc && r.name_iv ? (decryptAES(r.name_enc, r.name_iv) || r.account) : r.account,
            roleCodes: r.roles as string[],
        }));
    } finally {
        client.release();
    }
}

/**
 * 指派某使用者去家訪此案件（assignee = volunteer/case_officer）。
 * 傳 null 為清除指派。
 * 角色守門：case_officer / supervisor / admin 可指派。
 */
export async function assignHomeVisitor(
    operatorUserId: string,
    applicationId: string,
    assigneeUserId: string | null,
): Promise<{ success: boolean; error?: string }> {
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };
    if (assigneeUserId !== null && !/^\d+$/.test(assigneeUserId)) {
        return { success: false, error: '無效的指派人員 ID' };
    }
    const client = await pool.connect();
    try {
        // role gate
        const roleRes = await client.query(
            `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint AND r.code IN ('case_officer','supervisor','admin') LIMIT 1`,
            [operatorUserId]
        );
        if ((roleRes.rowCount ?? 0) === 0) {
            return { success: false, error: '權限不足' };
        }
        // 若有指定 assignee：驗證該 user 為 volunteer 或 case_officer
        if (assigneeUserId !== null) {
            const checkRes = await client.query(
                `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = $1::bigint AND r.code IN ('volunteer','case_officer') LIMIT 1`,
                [assigneeUserId]
            );
            if ((checkRes.rowCount ?? 0) === 0) {
                return { success: false, error: '指派對象必須是志工或承辦人員' };
            }
        }
        const res = await client.query(
            `UPDATE applications SET home_visit_assignee_id = $1, updated_at = NOW()
             WHERE id = $2::bigint RETURNING id`,
            [assigneeUserId, applicationId]
        );
        if (res.rowCount === 0) return { success: false, error: '案件不存在' };
        void writeAuditLog({
            userId: operatorUserId,
            action: 'application.basics_update',
            targetType: 'application',
            targetId: applicationId,
            detail: { changedFields: ['home_visit_assignee_id'], assignee_user_id: assigneeUserId },
        });
        return { success: true };
    } catch (err: any) {
        console.error('assignHomeVisitor error:', err);
        return { success: false, error: err.message ?? '指派失敗' };
    } finally {
        client.release();
    }
}
