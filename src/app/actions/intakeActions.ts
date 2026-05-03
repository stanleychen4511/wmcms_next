'use server';

import { pool } from '../../lib/db';
import { generateBlindIndex, encryptAES, generateSalt, hashPassword } from '../../lib/crypto';
import { writeAuditLog } from './auditActions';
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
}

export async function queryApplicantEligibility(idNumber: string): Promise<EligibilityResult> {
    if (!idNumber || idNumber.trim() === '') {
        return { eligible: false, reason: '請提供身分證字號' };
    }

    const client = await pool.connect();
    try {
        const usersRes = await client.query(
            'SELECT id, search_salt, id_number_bidx FROM users WHERE is_active = true'
        );

        const normalizedId = idNumber.trim().toUpperCase();
        let matchedUserId: string | null = null;
        for (const row of usersRes.rows) {
            if (!row.search_salt) continue;
            // Coerce to string in case pg returns bytea as Buffer
            const salt = Buffer.isBuffer(row.search_salt)
                ? row.search_salt.toString('hex')
                : String(row.search_salt);
            const storedBidx = Buffer.isBuffer(row.id_number_bidx)
                ? row.id_number_bidx.toString('hex')
                : String(row.id_number_bidx ?? '');
            const computed = generateBlindIndex(normalizedId, salt);
            if (computed === storedBidx) {
                matchedUserId = row.id;
                break;
            }
        }

        if (!matchedUserId) {
            // First-time applicant — 沒有比中任何已存在的 user，視為新申請人，可繼續填表
            return { eligible: true };
        }

        // Check for active (non-terminal) applications
        const activeRes = await client.query(
            `SELECT id FROM applications WHERE applicant_id = $1 AND status NOT IN ('2', '4') LIMIT 1`,
            [matchedUserId]
        );

        if (activeRes.rows.length > 0) {
            return {
                eligible: false,
                reason: '您目前已有進行中的申請案件，不可重複申請。如有疑問，請聯繫承辦人員。',
            };
        }

        // Check cumulative approved amount
        const sumRes = await client.query(
            `SELECT COALESCE(SUM(approved_amount), 0) AS total
             FROM applications
             WHERE applicant_id = $1 AND status = '4'`,
            [matchedUserId]
        );

        const total = parseFloat(sumRes.rows[0].total || '0');
        // 改：依 subsidy_amount_limits 取兩子類型最大值（資格查詢階段尚未選定子類型）
        const { fetchSubsidyAmountLimitsMap } = await import('./eligibilityRulesActions');
        const limits = await fetchSubsidyAmountLimitsMap();
        const maxAmount = Math.max(limits['1'] ?? 0, limits['2'] ?? 0);
        const remaining = maxAmount - total;

        if (remaining <= 0) {
            return {
                eligible: false,
                reason: `您的歷史累計獲補助金額已達上限（${total.toLocaleString()} 元），不符合申請資格。`,
            };
        }

        return { eligible: true, remaining, cumulativeApproved: total, maxAmount };
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
    if (!treatmentPhase) return { success: false, error: '請選擇治療階段（治療前／治療後／治療前後）' };

    // 子類型 + 申請金額上限驗證（依 115 辦法子類型不同上限）
    if (!subsidySubtype) {
        return { success: false, error: '請選擇補助子類型（經濟弱勢／小康家庭）' };
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

    const client = await pool.connect();
    let applicationId: string | null = null;
    let caseNumber: string | null = null;

    try {
        await client.query('BEGIN');

        // ── 1. Find or create applicant ──────────────────────────────────────
        let applicantId: string | null = null;

        const usersRes = await client.query(
            'SELECT id, search_salt, name_bidx, id_number_bidx FROM users WHERE is_active = true'
        );

        for (const row of usersRes.rows) {
            if (!row.search_salt) continue;
            const computedNameBidx = generateBlindIndex(name, row.search_salt);
            const computedIdBidx = generateBlindIndex(idNumber, row.search_salt);
            if (computedNameBidx === row.name_bidx && computedIdBidx === row.id_number_bidx) {
                applicantId = row.id;
                // Refresh email for existing applicant (they may be reapplying with new contact)
                await client.query(
                    `UPDATE users SET email = $1 WHERE id = $2::bigint`,
                    [email, applicantId]
                );
                break;
            }
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
            const searchSalt = generateSalt();
            const tempPass = generateTempPassword();
            const passHash = hashPassword(tempPass, searchSalt);

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
                [account, passHash, searchSalt, nameEnc, nameIv, nameBidx, idEnc, idIv, idBidx, email]
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
                application_form, treatment_phase
             ) VALUES ($1, $2, NULL, '1', NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::date, $18, $19, $20, $21)
             RETURNING id`,
            [caseNumber, applicantId,
             applicationType,
             age, annualIncome, moveableProp, immoveableProp,
             maritalStatus, hasChildren, underageCount, adultCount,
             applyAmount,
             subsidySubtype, econDeposit, econMonthlyIncome,
             applicantPhone,
             applicantDob, cancerTypeIn, cancerStageIn,
             applicationForm, treatmentPhase]
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

    // 安全：只接受我們發出的 URL：production = Blob、本地 dev = /uploads/ 相對路徑
    const isValidUrl = (u: string): boolean => {
        if (u.startsWith('/uploads/')) return true;  // 本地 dev fallback
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
                 VALUES ($1, $2, $3, '0', NOW())
                 ON CONFLICT (application_id, id) WHERE disbursement_id IS NULL
                 DO UPDATE SET file_path = EXCLUDED.file_path, status = '0', uploaded_at = NOW()`,
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

export interface ApplicantQuota {
    cumulativeApproved: number;
    maxAmount: number;
    remaining: number;
}

export async function fetchApplicantQuota(idNumber: string): Promise<ApplicantQuota> {
    // 子類型未選前，採兩者較大值作為「上限」顯示（實際 enforcement 在 submit 時依子類型）
    const { fetchSubsidyAmountLimitsMap } = await import('./eligibilityRulesActions');
    const limits = await fetchSubsidyAmountLimitsMap();
    const maxAmount = Math.max(limits['1'] ?? 0, limits['2'] ?? 0);

    if (!idNumber || idNumber.trim() === '') {
        return { cumulativeApproved: 0, maxAmount, remaining: maxAmount };
    }

    const client = await pool.connect();
    try {
        const usersRes = await client.query(
            'SELECT id, search_salt, id_number_bidx FROM users WHERE is_active = true'
        );
        let matchedUserId: string | null = null;
        const normalizedIdQ = idNumber.trim().toUpperCase();
        for (const row of usersRes.rows) {
            if (!row.search_salt) continue;
            const salt = Buffer.isBuffer(row.search_salt)
                ? row.search_salt.toString('hex')
                : String(row.search_salt);
            const storedBidx = Buffer.isBuffer(row.id_number_bidx)
                ? row.id_number_bidx.toString('hex')
                : String(row.id_number_bidx ?? '');
            const computed = generateBlindIndex(normalizedIdQ, salt);
            if (computed === storedBidx) {
                matchedUserId = row.id;
                break;
            }
        }
        if (!matchedUserId) {
            return { cumulativeApproved: 0, maxAmount, remaining: maxAmount };
        }
        const sumRes = await client.query(
            `SELECT COALESCE(SUM(approved_amount), 0) AS total
             FROM applications WHERE applicant_id = $1 AND status = '4'`,
            [matchedUserId]
        );
        const total = parseFloat(sumRes.rows[0].total || '0');
        return { cumulativeApproved: total, maxAmount, remaining: Math.max(0, maxAmount - total) };
    } catch {
        return { cumulativeApproved: 0, maxAmount, remaining: maxAmount };
    } finally {
        client.release();
    }
}
