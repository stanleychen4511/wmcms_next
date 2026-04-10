'use server';

import { pool } from '../../lib/db';
import { generateBlindIndex, encryptAES, generateSalt, hashPassword } from '../../lib/crypto';
import path from 'path';
import { promises as fs } from 'fs';

export interface EligibilityResult {
    eligible: boolean;
    reason?: string;
    error?: string;
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

        let matchedUserId: string | null = null;
        for (const row of usersRes.rows) {
            if (!row.search_salt) continue;
            const computed = generateBlindIndex(idNumber.trim().toUpperCase(), row.search_salt);
            if (computed === row.id_number_bidx) {
                matchedUserId = row.id;
                break;
            }
        }

        if (!matchedUserId) {
            // First-time applicant
            return { eligible: true };
        }

        // Check for active (non-terminal) applications
        const activeRes = await client.query(
            `SELECT id FROM applications WHERE applicant_id = $1 AND status NOT IN ('2', '5') LIMIT 1`,
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
             WHERE applicant_id = $1 AND status = '5'`,
            [matchedUserId]
        );

        const total = parseFloat(sumRes.rows[0].total || '0');
        if (total >= 350000) {
            return {
                eligible: false,
                reason: `您的歷史累計獲補助金額已達上限（${total.toLocaleString()} 元），不符合申請資格。`,
            };
        }

        return { eligible: true };
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

function sanitizeForFilename(str: string): string {
    return str.replace(/[/\\:*?"<>|\s]+/g, '_');
}

function formatTimestamp(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join('');
}

const INTAKE_DOCS: { field: string; docId: string; label: string }[] = [
    { field: 'doc_1', docId: '1', label: '自費醫療補助申請表' },
    { field: 'doc_3', docId: '3', label: '身分證正反面影本' },
    { field: 'doc_4', docId: '4', label: '個資同意書' },
];

export async function submitExternalApplication(
    formData: FormData
): Promise<{ success: boolean; caseNumber?: string; error?: string }> {
    const name       = (formData.get('name') as string | null)?.trim() ?? '';
    const idNumber   = (formData.get('idNumber') as string | null)?.trim().toUpperCase() ?? '';
    const maritalStatus = (formData.get('marital_status') as string | null) ?? null;
    const age        = formData.get('age')        ? Number(formData.get('age'))        : null;
    const annualIncome   = formData.get('annual_income')   ? Number(formData.get('annual_income'))   : null;
    const moveableProp   = formData.get('moveable_property')   ? Number(formData.get('moveable_property'))   : null;
    const immoveableProp = formData.get('immoveable_property') ? Number(formData.get('immoveable_property')) : null;
    const hasChildren    = formData.get('has_children') === 'true' ? true : formData.get('has_children') === 'false' ? false : null;
    const underageCount  = formData.get('underage_children_count') ? Number(formData.get('underage_children_count')) : null;

    if (!name || !idNumber) {
        return { success: false, error: '請填寫完整姓名與身分證字號' };
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
                      is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
                 RETURNING id`,
                [account, passHash, searchSalt, nameEnc, nameIv, nameBidx, idEnc, idIv, idBidx]
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
            [`A${rocYear}%`]
        );
        const count = parseInt(countRes.rows[0].total, 10) + 1;
        caseNumber = `A${rocYear}${count.toString().padStart(3, '0')}`;

        // ── 3. Create application (no officer) ───────────────────────────────
        const appRes = await client.query(
            `INSERT INTO applications (
                case_number, applicant_id, officer_id, status, apply_at,
                age, annual_income, moveable_property, immoveable_property,
                marital_status, has_children, underage_children_count
             ) VALUES ($1, $2, NULL, '1', NOW(), $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [caseNumber, applicantId,
             age, annualIncome, moveableProp, immoveableProp,
             maritalStatus, hasChildren, underageCount]
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

    // ── 5. Upload documents (outside transaction — partial failure OK) ───────
    for (const { field, docId, label } of INTAKE_DOCS) {
        const file = formData.get(field) as File | null;
        if (!file || file.size === 0) continue;

        try {
            const ext = path.extname(file.name).toLowerCase();
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', applicationId!);
            await fs.mkdir(uploadDir, { recursive: true });

            const safeLabel = sanitizeForFilename(label);
            const timestamp = formatTimestamp(new Date());
            const fileName = `${caseNumber}_${safeLabel}_${timestamp}${ext}`;
            const filePath = path.join(uploadDir, fileName);

            const bytes = await file.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(bytes));

            const publicUrl = `/uploads/${applicationId}/${fileName}`;

            await pool.query(
                `INSERT INTO application_documents (application_id, id, file_path, status, uploaded_at)
                 VALUES ($1, $2, $3, '0', NOW())
                 ON CONFLICT (application_id, id)
                 DO UPDATE SET file_path = EXCLUDED.file_path, status = '0', uploaded_at = NOW()`,
                [applicationId, docId, publicUrl]
            );
        } catch (err) {
            console.error(`Document upload error for ${field}:`, err);
            // Non-fatal: application is already created
        }
    }

    return { success: true, caseNumber: caseNumber! };
}
