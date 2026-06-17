'use server';

import { pool } from '../../lib/db';
import { generateBlindIndex, encryptAES, generateSalt, hashPassword } from '../../lib/crypto';
import { writeAuditLog } from './auditActions';
import { verifyEmailVerificationToken } from './emailVerificationActions';
// 註：檔案不再經 server function 上傳；client 直接 PUT 到 Vercel Blob，
//     submitExternalApplication 只接收 documents JSON（URL list）。
//     uploadFile / sanitizeForFilename / formatTimestamp 在新流程下已不需要。

export interface EligibilityResult {
    eligible: boolean;
    reason?: string;
    error?: string;
    remaining?: number;
    cumulativeApproved?: number;
    maxAmount?: number;
    activeApplication?: {
        caseNumber: string;
        progress: string;
    };
}

function getApplicantFacingProgress(status: string | null, stage: string | null): string {
    if (status === '4') return '已結案';
    if (status === '2') return '已結案';
    if (status === '3' || stage === 'reimbursement') return '撥款中';
    if (stage === 'board_review' || stage === 'home_visit' || stage === 'visit') return '案件審核中';
    if (stage === 'admin_review') return '文件審核中';
    return '受理中';
}

async function findApplicantUserIdByIdNumber(client: any, idNumber: string): Promise<string | null> {
    const normalizedId = idNumber.trim().toUpperCase();
    const usersRes = await client.query(
        'SELECT id, search_salt, id_number_bidx FROM users WHERE is_active = true'
    );

    for (const row of usersRes.rows) {
        if (!row.search_salt) continue;
        const salt = Buffer.isBuffer(row.search_salt)
            ? row.search_salt.toString('hex')
            : String(row.search_salt);
        const storedBidx = Buffer.isBuffer(row.id_number_bidx)
            ? row.id_number_bidx.toString('hex')
            : String(row.id_number_bidx ?? '');
        if (generateBlindIndex(normalizedId, salt) === storedBidx) {
            return row.id;
        }
    }

    const accountRes = await client.query(
        `SELECT id FROM users WHERE is_active = true AND account = $1 LIMIT 1`,
        [`app_${normalizedId}`]
    );
    return accountRes.rows[0]?.id ?? null;
}

export async function queryApplicantEligibility(
    idNumber: string,
    subsidySubtype?: '1' | '2',
): Promise<EligibilityResult> {
    if (!idNumber || idNumber.trim() === '') {
        return { eligible: false, reason: '請提供身分證字號' };
    }

    const client = await pool.connect();
    try {
        const normalizedId = idNumber.trim().toUpperCase();
        const matchedUserId = await findApplicantUserIdByIdNumber(client, normalizedId);

        if (!matchedUserId) {
            // First-time applicant — 沒有比中任何已存在的 user，視為新申請人，可繼續填表
            return { eligible: true };
        }

        // Check for active (non-terminal) applications
        const activeRes = await client.query(
            `SELECT a.id, a.case_number, a.status, wf.stage
             FROM applications a
             LEFT JOIN LATERAL (
                 SELECT stage
                 FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY COALESCE(reviewed_at, created_at) DESC, id DESC
                 LIMIT 1
             ) wf ON true
             WHERE a.applicant_id = $1
               AND (
                   a.status NOT IN ('2', '4')
                   OR EXISTS (
                       SELECT 1
                       FROM payment_disbursements pd
                       WHERE pd.application_id = a.id
                         AND pd.review_stage IN ('1', '2', '3', '4')
                   )
               )
             ORDER BY a.created_at DESC, a.id DESC
             LIMIT 1`,
            [matchedUserId]
        );

        if (activeRes.rows.length > 0) {
            const active = activeRes.rows[0];
            return {
                eligible: false,
                reason: '您已正在申請中，請勿重複送出申請。如有疑問，請聯繫承辦人員。',
                activeApplication: {
                    caseNumber: active.case_number ?? '',
                    progress: getApplicantFacingProgress(active.status, active.stage),
                },
            };
        }

        // 跨年度累計核准金額；依子類型分開。
        // status='3' 已通過進入核銷、status='4' 已結案，兩者都算已核定額度。
        const sumRes = await client.query(
            `SELECT
                COALESCE(SUM(CASE WHEN subsidy_subtype = '1' THEN approved_amount END), 0) AS econ_total,
                COALESCE(SUM(CASE WHEN subsidy_subtype = '2' THEN approved_amount END), 0) AS mid_total
             FROM applications
             WHERE applicant_id = $1
               AND status IN ('3', '4')
               AND approved_amount IS NOT NULL
               AND approved_amount > 0`,
            [matchedUserId]
        );
        const econUsed = Number(sumRes.rows[0].econ_total || 0);
        const midUsed  = Number(sumRes.rows[0].mid_total  || 0);

        const { fetchSubsidyAmountLimitsMap } = await import('./eligibilityRulesActions');
        const limits = await fetchSubsidyAmountLimitsMap();
        const econMax = limits['1'] ?? 0;
        const midMax  = limits['2'] ?? 0;
        const econRemaining = Math.max(0, econMax - econUsed);
        const midRemaining  = Math.max(0, midMax  - midUsed);

        if (subsidySubtype === '1' && econRemaining <= 0) {
            return {
                eligible: false,
                reason: `經濟弱勢累積補助已達上限 ${econMax.toLocaleString()} 元，目前無法再申請經濟弱勢補助。`,
            };
        }
        if (subsidySubtype === '2' && midRemaining <= 0) {
            return {
                eligible: false,
                reason: `小康家庭累積補助已達上限 ${midMax.toLocaleString()} 元，目前無法再申請小康家庭補助。`,
            };
        }

        // 未指定子類型時，保留舊行為：只要兩種額度任一還有餘額 → 可繼續資格判定。
        if (!subsidySubtype && econRemaining <= 0 && midRemaining <= 0) {
            return {
                eligible: false,
                reason: `您申請額度已滿（經濟弱勢已使用 ${econUsed.toLocaleString()} 元、小康家庭已使用 ${midUsed.toLocaleString()} 元），目前無法送出新申請。`,
            };
        }

        if (subsidySubtype === '1') {
            return {
                eligible: true,
                remaining: econRemaining,
                cumulativeApproved: econUsed,
                maxAmount: econMax,
            };
        }
        if (subsidySubtype === '2') {
            return {
                eligible: true,
                remaining: midRemaining,
                cumulativeApproved: midUsed,
                maxAmount: midMax,
            };
        }

        // 向後相容：未指定子類型時，保留 cumulativeApproved/maxAmount/remaining 三個舊欄位（取較大者）
        return {
            eligible: true,
            remaining: Math.max(econRemaining, midRemaining),
            cumulativeApproved: econUsed + midUsed,
            maxAmount: Math.max(econMax, midMax),
        };
    } catch (err: any) {
        console.error('queryApplicantEligibility error:', err);
        return { eligible: false, error: '系統異常，請稍後再試' };
    } finally {
        client.release();
    }
}

function generateTempPassword(): string {
    return Math.random().toString(36).substring(2, 12);
}

export async function submitExternalApplication(
    formData: FormData
): Promise<{ success: boolean; caseNumber?: string; error?: string }> {
    const name            = (formData.get('name') as string | null)?.trim() ?? '';
    const idNumber        = (formData.get('idNumber') as string | null)?.trim().toUpperCase() ?? '';
    const applicationType = ((formData.get('application_type') as string | null) ?? 'A').toUpperCase();
    const maritalStatus   = (formData.get('marital_status') as string | null) ?? null;
    const age        = formData.get('age')        ? Number(formData.get('age'))        : null;
    const annualIncome   = formData.get('annual_income')   ? Number(formData.get('annual_income'))   : null;
    const moveableProp   = formData.get('moveable_property')   ? Number(formData.get('moveable_property'))   : null;
    const immoveableProp = formData.get('immoveable_property') ? Number(formData.get('immoveable_property')) : null;
    const hasChildren    = formData.get('has_children') === 'true' ? true : formData.get('has_children') === 'false' ? false : null;
    const underageCount  = formData.get('underage_children_count') ? Number(formData.get('underage_children_count')) : null;
    const adultCount     = formData.get('adult_children_count') ? Number(formData.get('adult_children_count')) : null;
    const applyAmount    = formData.get('apply_amount') ? Number(formData.get('apply_amount')) : null;
    const email          = ((formData.get('email') as string | null) ?? '').trim();
    const emailVerificationToken = ((formData.get('email_verification_token') as string | null) ?? '').trim();
    const applicantPhone = ((formData.get('applicant_phone') as string | null) ?? '').trim();
    const applicantDob   = ((formData.get('applicant_dob') as string | null) ?? '').trim();
    const cancerTypeIn   = ((formData.get('cancer_type') as string | null) ?? '').trim();
    const cancerStageIn  = ((formData.get('cancer_stage') as string | null) ?? '').trim();
    // 治療階段：'B'/'A'/'X'（必填）
    const treatmentPhaseRaw = ((formData.get('treatment_phase') as string | null) ?? '').trim();
    const treatmentPhase: 'B' | 'A' | 'X' | null =
        treatmentPhaseRaw === 'B' || treatmentPhaseRaw === 'A' || treatmentPhaseRaw === 'X' ? treatmentPhaseRaw : null;
    // 申請形式：外部收件後端強制 'E'，不從 formData 讀（避免被竄改）
    const applicationForm: 'E' = 'E';
    // 申請方式 + 轉介窗口（user feedback #1 #6）
    const wayRaw = ((formData.get('application_way') as string | null) ?? '').trim();
    const referralUnitNameIn      = ((formData.get('referral_unit_name')     as string | null) ?? '').trim();
    const referralContactNameIn   = ((formData.get('referral_contact_name')  as string | null) ?? '').trim();
    const referralContactTitleIn  = ((formData.get('referral_contact_title') as string | null) ?? '').trim();
    const referralContactPhoneIn  = ((formData.get('referral_contact_phone') as string | null) ?? '').trim();
    const referralContactEmailIn  = ((formData.get('referral_contact_email') as string | null) ?? '').trim();
    const referralEmailVerificationToken = ((formData.get('referral_email_verification_token') as string | null) ?? '').trim();
    // 補助子類型（115 年辦法）
    const subsidySubtypeRaw = (formData.get('subsidy_subtype') as string | null) ?? null;
    const subsidySubtype: '1' | '2' | null =
        subsidySubtypeRaw === '1' || subsidySubtypeRaw === '2' ? subsidySubtypeRaw : null;
    // 經濟弱勢專屬（萬元）
    const econDeposit       = formData.get('econ_deposit')        ? Number(formData.get('econ_deposit'))        : null;
    const econMonthlyIncome = formData.get('econ_monthly_income') ? Number(formData.get('econ_monthly_income')) : null;

    if (!name || !idNumber) {
        return { success: false, error: '請填寫完整姓名與身分證字號' };
    }
    if (name.length > 50) {
        return { success: false, error: '申請人姓名不可超過 50 個字' };
    }
    // Email 必填驗證（核銷階段需自動寄領款收據至此信箱）
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: '請填寫有效的 Email 地址' };
    }
    // 申請人聯絡電話必填
    if (!applicantPhone) {
        return { success: false, error: '請填寫申請人聯絡電話' };
    }
    // 出生年月日 / 癌別 / 期數 必填
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applicantDob)) {
        return { success: false, error: '請填寫有效的出生年月日（YYYY-MM-DD）' };
    }
    if (!cancerTypeIn) return { success: false, error: '請填寫癌別' };
    if (!cancerStageIn) return { success: false, error: '請填寫癌症期數' };
    if (!treatmentPhase) return { success: false, error: '請選擇欲申請治療項目（治療完成三個月以內／治療未開始／兩者皆有）' };

    // 申請方式：經濟弱勢強制 way='2'；小康看送來的；其他預設 '1'
    const subsidySubtypeForWay = ((formData.get('subsidy_subtype') as string | null) ?? '').trim();
    const applicationWay: '1' | '2' = subsidySubtypeForWay === '1'
        ? '2'
        : (wayRaw === '2' ? '2' : '1');
    if (applicationWay === '2') {
        if (!referralUnitNameIn || !referralContactNameIn || !referralContactTitleIn || !referralContactPhoneIn) {
            return { success: false, error: '轉介申請須填寫轉介單位 / 轉介人姓名 / 職稱 / 聯絡電話' };
        }
        if (!referralContactEmailIn || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referralContactEmailIn)) {
            return { success: false, error: '轉介申請須填寫有效的轉介人 Email' };
        }
    }

    // 子類型 + 申請金額上限驗證（依 115 辦法子類型不同上限）
    if (!subsidySubtype) {
        return { success: false, error: '請選擇補助子類型（經濟弱勢／小康家庭）' };
    }
    if (!(await verifyEmailVerificationToken(email, 'applicant_application', emailVerificationToken))) {
        return { success: false, error: '請先完成申請人 Email 驗證' };
    }
    if (applicationWay === '2' && !(await verifyEmailVerificationToken(referralContactEmailIn, 'referral_application', referralEmailVerificationToken))) {
        return { success: false, error: '請先完成轉介人 Email 驗證' };
    }

    const limitRow = await pool.query<{ amount_max: string }>(
        `SELECT amount_max FROM subsidy_amount_limits WHERE subsidy_subtype = $1`,
        [subsidySubtype]
    );
    const subtypeMax = Number(limitRow.rows[0]?.amount_max ?? 0);
    if (applyAmount == null || applyAmount <= 0) {
        return { success: false, error: '請輸入申請金額' };
    }
    if (subtypeMax > 0 && applyAmount > subtypeMax) {
        return {
            success: false,
            error: `申請金額不可超過 ${subsidySubtype === '1' ? '經濟弱勢' : '小康家庭'} 累積補助上限 ${subtypeMax.toLocaleString()} 元`,
        };
    }
    // 進一步：依「該子類型」已用額度檢查剩餘餘額（兩子類型獨立計算）
    if (subtypeMax > 0) {
        const quota = await fetchApplicantQuota(idNumber);
        const remainingForSubtype = subsidySubtype === '1' ? quota.econRemaining : quota.midRemaining;
        if (applyAmount > remainingForSubtype) {
            return {
                success: false,
                error: `${subsidySubtype === '1' ? '經濟弱勢' : '小康家庭'}剩餘額度為 ${remainingForSubtype.toLocaleString()} 元，本次申請 ${applyAmount.toLocaleString()} 元超過剩餘額度`,
            };
        }
    }

    const client = await pool.connect();
    let applicationId: string | null = null;
    let caseNumber: string | null = null;

    try {
        await client.query('BEGIN');

        // ── 1. Find or create applicant ──────────────────────────────────────
        let applicantId: string | null = null;

        applicantId = await findApplicantUserIdByIdNumber(client, idNumber);
        if (applicantId) {
            // Refresh email for existing applicant (they may be reapplying with new contact)
            await client.query(
                `UPDATE users SET email = $1 WHERE id = $2::bigint`,
                [email, applicantId]
            );
        }

        if (!applicantId) {
            // If blind index didn't match but account already exists, the ID number is taken
            // — do not silently reuse it, return an error instead
            const accountCheck = await client.query(
                `SELECT id FROM users WHERE account = $1`,
                [`app_${idNumber}`]
            );
            if (accountCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return { success: false, error: '此身分證字號已有申請紀錄，請聯繫承辦人員協助處理。' };
            }
        }

        if (!applicantId) {
            // salt 一律存 32-byte Buffer（與 seed_admin / CLAUDE.md 規定一致）
            const searchSalt = generateSalt();
            const saltBuffer = Buffer.from(searchSalt, 'hex');
            const tempPass = generateTempPassword();
            const passHash = hashPassword(tempPass, saltBuffer);

            const { enc: nameEnc, iv: nameIv } = encryptAES(name);
            const nameBidx = generateBlindIndex(name, searchSalt);
            const { enc: idEnc, iv: idIv } = encryptAES(idNumber);
            const idBidx = generateBlindIndex(idNumber, searchSalt);
            const account = `app_${idNumber}`;

            const newU = await client.query(
                `INSERT INTO users
                     (account, password, search_salt,
                      name_enc, name_iv, name_bidx,
                      id_number_enc, id_number_iv, id_number_bidx,
                      email, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
                 RETURNING id`,
                [account, passHash, saltBuffer, nameEnc, nameIv, nameBidx, idEnc, idIv, idBidx, email]
            );
            applicantId = newU.rows[0].id;

            const roleRes = await client.query(`SELECT id FROM roles WHERE code = 'applicant'`);
            if (roleRes.rows.length > 0) {
                await client.query(
                    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
                    [applicantId, roleRes.rows[0].id]
                );
            }
        }

        const activeRes = await client.query(
            `SELECT a.case_number, a.status, wf.stage
             FROM applications a
             LEFT JOIN LATERAL (
                 SELECT stage
                 FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY COALESCE(reviewed_at, created_at) DESC, id DESC
                 LIMIT 1
             ) wf ON true
             WHERE a.applicant_id = $1::bigint
               AND (
                   a.status NOT IN ('2', '4')
                   OR EXISTS (
                       SELECT 1
                       FROM payment_disbursements pd
                       WHERE pd.application_id = a.id
                         AND pd.review_stage IN ('1', '2', '3', '4')
                   )
               )
             ORDER BY a.created_at DESC, a.id DESC
             LIMIT 1`,
            [applicantId]
        );
        if (activeRes.rows.length > 0) {
            const active = activeRes.rows[0];
            await client.query('ROLLBACK');
            return {
                success: false,
                error: `您已有進行中案件（${active.case_number ?? '未編號'}，${getApplicantFacingProgress(active.status, active.stage)}），請勿重複送出申請。`,
            };
        }

        // ── 2. Generate sequential case number ───────────────────────────────
        const now = new Date();
        const rocYear = String(now.getFullYear() - 1911).padStart(3, '0');
        const countRes = await client.query(
            `SELECT count(*) AS total FROM applications WHERE case_number LIKE $1`,
            [`${applicationType}${rocYear}%`]
        );
        const count = parseInt(countRes.rows[0].total, 10) + 1;
        caseNumber = `${applicationType}${rocYear}${count.toString().padStart(3, '0')}`;

        // ── 3. Create application (no officer) ───────────────────────────────
        const appRes = await client.query(
            `INSERT INTO applications (
                case_number, applicant_id, officer_id, status, apply_at,
                application_type,
                age, annual_income, moveable_property, immoveable_property,
                marital_status, has_children, underage_children_count, adult_children_count,
                apply_amount,
                subsidy_subtype, econ_deposit, econ_monthly_income,
                applicant_phone,
                applicant_dob, cancer_type, cancer_stage,
                application_form, treatment_phase,
                application_way, referral_unit_name,
                referral_contact_name, referral_contact_title, referral_contact_phone, referral_contact_email
             ) VALUES ($1, $2, NULL, '1', NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::date, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
             RETURNING id`,
            [caseNumber, applicantId,
             applicationType,
             age, annualIncome, moveableProp, immoveableProp,
             maritalStatus, hasChildren, underageCount, adultCount,
             applyAmount,
             subsidySubtype, econDeposit, econMonthlyIncome,
             applicantPhone,
             applicantDob, cancerTypeIn, cancerStageIn,
             applicationForm, treatmentPhase,
             applicationWay, applicationWay === '2' ? (referralUnitNameIn || null) : null,
             applicationWay === '2' ? (referralContactNameIn || null) : null,
             applicationWay === '2' ? (referralContactTitleIn || null) : null,
             applicationWay === '2' ? (referralContactPhoneIn || null) : null,
             applicationWay === '2' ? (referralContactEmailIn || null) : null]
        );
        applicationId = appRes.rows[0].id;

        // ── 4. Create initial workflow record ────────────────────────────────
        await client.query(
            `INSERT INTO application_workflow
                 (application_id, stage, reviewer_id, is_approved, comments)
             VALUES ($1, 'admin_review', NULL, NULL, '線上收件申請，進入行政初審')`,
            [applicationId]
        );

        await client.query('COMMIT');
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('submitExternalApplication DB error:', err);
        return { success: false, error: '申請提交失敗，請稍後再試' };
    } finally {
        client.release();
    }

    // ── 5. 連結 client 已上傳的文件 URL ──────────────────────────────────────
    // 客戶端已用 @vercel/blob/client `upload()` 把檔案直接 PUT 到 Blob，
    // 表單只送 documents JSON：[{ docId, url, originalName, mimeType, size }]
    // server 此處只負責驗證 URL 並寫入 application_documents。
    interface IntakeDocPayload {
        docId: string;
        url: string;
        originalName?: string;
        mimeType?: string;
        size?: number;
    }
    let intakeDocs: IntakeDocPayload[] = [];
    try {
        const raw = (formData.get('documents') as string | null) ?? '';
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                intakeDocs = parsed.filter(d =>
                    d && typeof d.docId === 'string' && typeof d.url === 'string'
                );
            }
        }
    } catch (err) {
        console.error('parse documents JSON error:', err);
    }

    // 安全：只接受我們發出的 URL：production = Blob、本地 dev = /uploads/ 或 /intake/ 相對路徑
    const isValidUrl = (u: string): boolean => {
        if (u.startsWith('/uploads/') || u.startsWith('/intake/')) return true;  // 本地 dev fallback
        try {
            const url = new URL(u);
            return url.protocol === 'https:'
                && (url.hostname.endsWith('.public.blob.vercel-storage.com')
                    || url.hostname.endsWith('.blob.vercel-storage.com'));
        } catch {
            return false;
        }
    };

    await Promise.all(intakeDocs.map(async ({ docId, url }) => {
        if (!/^\d+$/.test(docId)) return;
        if (!isValidUrl(url)) {
            console.warn('[intake] reject invalid URL:', url.slice(0, 50));
            return;
        }
        try {
            await pool.query(
                `INSERT INTO application_documents (application_id, id, file_path, status, uploaded_at)
                 VALUES ($1, $2, $3, '0', NOW())`,
                [applicationId, docId, url]
            );
        } catch (err) {
            console.error(`Document link error for doc_${docId}:`, err);
        }
    }));

    void writeAuditLog({
        userId: null,
        action: 'application.create',
        targetType: 'application',
        targetId: String(applicationId),
        detail: { caseNumber, source: 'online' },
    });

    return { success: true, caseNumber: caseNumber! };
}

/**
 * 每個申請人「一生額度」分子類型獨立計算：
 *   - 經濟弱勢（subtype='1'）：例 NT$ 30,000
 *   - 小康家庭（subtype='2'）：例 NT$ 350,000
 *
 * 兩種額度不互通：申請人 A 用完小康 35 萬後若改為經濟弱勢身分，
 * 仍可再申請經濟弱勢的 3 萬。跨年度也累計（不歸零）。
 */
export interface ApplicantQuota {
    /** 經濟弱勢累計核准金額 */
    econUsed: number;
    /** 經濟弱勢一生額度上限 */
    econMax: number;
    /** 經濟弱勢剩餘可申請額度 */
    econRemaining: number;
    /** 小康家庭累計核准金額 */
    midUsed: number;
    /** 小康家庭一生額度上限 */
    midMax: number;
    /** 小康家庭剩餘可申請額度 */
    midRemaining: number;
    /** 向後相容（舊欄位；= 兩種較大者的剩餘額度，用於未選定 subtype 之 UI 顯示） */
    cumulativeApproved: number;
    maxAmount: number;
    remaining: number;
}

export async function fetchApplicantQuota(idNumber: string): Promise<ApplicantQuota> {
    const { fetchSubsidyAmountLimitsMap } = await import('./eligibilityRulesActions');
    const limits = await fetchSubsidyAmountLimitsMap();
    const econMax = limits['1'] ?? 0;
    const midMax  = limits['2'] ?? 0;
    const maxAmount = Math.max(econMax, midMax);

    const blank: ApplicantQuota = {
        econUsed: 0, econMax, econRemaining: econMax,
        midUsed:  0, midMax,  midRemaining:  midMax,
        cumulativeApproved: 0, maxAmount, remaining: maxAmount,
    };

    if (!idNumber || idNumber.trim() === '') return blank;

    const client = await pool.connect();
    try {
        const normalizedIdQ = idNumber.trim().toUpperCase();
        const matchedUserId = await findApplicantUserIdByIdNumber(client, normalizedIdQ);
        if (!matchedUserId) return blank;

        // 跨年度合計：依 subsidy_subtype 分開 SUM。
        // status='3' 已通過進入核銷、status='4' 已結案，兩者都算已核定額度。
        const sumRes = await client.query(
            `SELECT
                COALESCE(SUM(CASE WHEN subsidy_subtype = '1' THEN approved_amount END), 0) AS econ_total,
                COALESCE(SUM(CASE WHEN subsidy_subtype = '2' THEN approved_amount END), 0) AS mid_total,
                COALESCE(SUM(approved_amount), 0) AS overall_total
             FROM applications
             WHERE applicant_id = $1
               AND status IN ('3', '4')
               AND approved_amount IS NOT NULL
               AND approved_amount > 0`,
            [matchedUserId]
        );
        const econUsed = Number(sumRes.rows[0].econ_total || 0);
        const midUsed  = Number(sumRes.rows[0].mid_total  || 0);
        const overall  = Number(sumRes.rows[0].overall_total || 0);
        return {
            econUsed,
            econMax,
            econRemaining: Math.max(0, econMax - econUsed),
            midUsed,
            midMax,
            midRemaining: Math.max(0, midMax - midUsed),
            cumulativeApproved: overall,
            maxAmount,
            remaining: Math.max(0, maxAmount - overall),  // 兩者大值的舊邏輯（未選 subtype 時 fallback）
        };
    } catch {
        return blank;
    } finally {
        client.release();
    }
}
