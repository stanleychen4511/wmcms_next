'use server';

import crypto from 'node:crypto';
import { pool } from '../../lib/db';
import { loadSmtpConfig } from './notificationActions';

export type EmailVerificationPurpose = 'applicant_application' | 'referral_application';

type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function hashCode(email: string, purpose: EmailVerificationPurpose, code: string, salt: string): string {
    return crypto
        .createHash('sha256')
        .update(`${salt}:${purpose}:${email}:${code}`)
        .digest('hex');
}

function purposeLabel(purpose: EmailVerificationPurpose): string {
    return purpose === 'referral_application' ? '轉介人 Email' : '申請人 Email';
}

export async function requestEmailVerificationCode(
    email: string,
    purpose: EmailVerificationPurpose,
): Promise<ActionResult<{ expiresAt: string }>> {
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(normalizedEmail)) {
        return { success: false, error: '請填寫有效的 Email 地址' };
    }

    const cfgRes = await loadSmtpConfig();
    if (!cfgRes.success || !cfgRes.data || !cfgRes.data.host || !cfgRes.data.user) {
        return { success: false, error: 'SMTP 設定尚未完成，無法寄送 Email 驗證碼' };
    }
    const cfg = cfgRes.data;

    const client = await pool.connect();
    try {
        const recent = await client.query(
            `SELECT created_at
             FROM email_verification_codes
             WHERE email = $1 AND purpose = $2
             ORDER BY created_at DESC
             LIMIT 1`,
            [normalizedEmail, purpose],
        );
        if (recent.rowCount && recent.rows[0].created_at) {
            const seconds = (Date.now() - new Date(recent.rows[0].created_at).getTime()) / 1000;
            if (seconds < 45) {
                return { success: false, error: '驗證碼剛寄出，請稍候再重寄' };
            }
        }

        const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
        const salt = crypto.randomBytes(16).toString('hex');
        const codeHash = hashCode(normalizedEmail, purpose, code, salt);
        const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: { user: cfg.user, pass: cfg.password },
        });
        await transporter.sendMail({
            from: `"${cfg.from_name || '萬美基金會'}" <${cfg.from_email || cfg.user}>`,
            to: normalizedEmail,
            subject: '萬美基金會 Email 驗證碼',
            text: `您的${purposeLabel(purpose)}驗證碼是 ${code}，${CODE_TTL_MINUTES} 分鐘內有效。若您沒有申請，請忽略此信。`,
            html: `<p>您的${purposeLabel(purpose)}驗證碼是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>${CODE_TTL_MINUTES} 分鐘內有效。若您沒有申請，請忽略此信。</p>`,
        });

        await client.query(
            `INSERT INTO email_verification_codes (email, purpose, code_hash, salt, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [normalizedEmail, purpose, codeHash, salt, expiresAt],
        );

        return { success: true, data: { expiresAt: expiresAt.toISOString() } };
    } catch (err: any) {
        console.error('requestEmailVerificationCode error:', err);
        return { success: false, error: err.message ?? '寄送 Email 驗證碼失敗' };
    } finally {
        client.release();
    }
}

export async function confirmEmailVerificationCode(
    email: string,
    purpose: EmailVerificationPurpose,
    code: string,
): Promise<ActionResult<{ token: string }>> {
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = code.trim();
    if (!EMAIL_RE.test(normalizedEmail)) {
        return { success: false, error: '請填寫有效的 Email 地址' };
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
        return { success: false, error: '請輸入 6 位數驗證碼' };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const res = await client.query(
            `SELECT id, code_hash, salt, attempts, expires_at
             FROM email_verification_codes
             WHERE email = $1
               AND purpose = $2
               AND verified_at IS NULL
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [normalizedEmail, purpose],
        );
        if (res.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '請先寄送 Email 驗證碼' };
        }

        const row = res.rows[0];
        if (new Date(row.expires_at).getTime() < Date.now()) {
            await client.query('ROLLBACK');
            return { success: false, error: '驗證碼已過期，請重新寄送' };
        }
        if (Number(row.attempts ?? 0) >= MAX_ATTEMPTS) {
            await client.query('ROLLBACK');
            return { success: false, error: '驗證次數過多，請重新寄送驗證碼' };
        }

        const expected = hashCode(normalizedEmail, purpose, normalizedCode, row.salt);
        if (expected !== row.code_hash) {
            await client.query(
                `UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1`,
                [row.id],
            );
            await client.query('COMMIT');
            return { success: false, error: '驗證碼不正確' };
        }

        const token = crypto.randomBytes(24).toString('hex');
        await client.query(
            `UPDATE email_verification_codes
             SET verified_at = NOW(), verification_token = $1
             WHERE id = $2`,
            [token, row.id],
        );
        await client.query('COMMIT');
        return { success: true, data: { token } };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('confirmEmailVerificationCode error:', err);
        return { success: false, error: err.message ?? 'Email 驗證失敗' };
    } finally {
        client.release();
    }
}

export async function verifyEmailVerificationToken(
    email: string,
    purpose: EmailVerificationPurpose,
    token: string | null | undefined,
): Promise<boolean> {
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(normalizedEmail) || !token) return false;

    const res = await pool.query(
        `SELECT 1
         FROM email_verification_codes
         WHERE email = $1
           AND purpose = $2
           AND verification_token = $3
           AND verified_at IS NOT NULL
           AND expires_at > NOW()
         LIMIT 1`,
        [normalizedEmail, purpose, token],
    );
    return (res.rowCount ?? 0) > 0;
}
