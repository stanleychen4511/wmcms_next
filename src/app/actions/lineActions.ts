'use server';

import * as crypto from 'crypto';
import { messagingApi } from '@line/bot-sdk';
const { MessagingApiClient } = messagingApi;
import { pool } from '../../lib/db';
import { writeAuditLog } from './auditActions';

const LINE_USER_ID_REGEX = /^U[0-9a-f]{32}$/;

interface ActionResult<T = undefined> {
    success: boolean;
    error?: string;
    data?: T;
}

/**
 * Returns whether LINE credentials are configured in the environment.
 * Token preview is only the first 6 chars + ellipsis (never full token).
 * Used by admin UI to show credential status without exposing the secret.
 */
export async function fetchLineCredentialStatus(): Promise<{
    hasSecret: boolean;
    hasToken: boolean;
    tokenPreview: string | null;
}> {
    const secret = process.env.LINE_CHANNEL_SECRET ?? '';
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';
    return {
        hasSecret: secret.length > 0,
        hasToken: token.length > 0,
        tokenPreview: token ? `${token.slice(0, 6)}…` : null,
    };
}

async function logToNotificationLogs(opts: {
    lineUserId: string;
    text: string;
    senderUserId: string | null;
    status: 'sent' | 'failed';
    errorMessage: string | null;
}): Promise<string | null> {
    const client = await pool.connect();
    try {
        const recipients = [{ user_id: null, name: opts.lineUserId, email: '' }];
        const res = await client.query(
            `INSERT INTO notification_logs
                (application_id, channel, sender_id, recipients, subject, body, template_id, status, error_message)
             VALUES (NULL, 'line', $1::bigint, $2, '', $3, NULL, $4, $5)
             RETURNING id`,
            [opts.senderUserId, JSON.stringify(recipients), opts.text, opts.status, opts.errorMessage]
        );
        return String(res.rows[0]?.id ?? '');
    } catch (err: any) {
        console.error('logToNotificationLogs error:', err);
        return null;
    } finally {
        client.release();
    }
}

/**
 * Push a text message to a single LINE user.
 *
 * Validates: env credentials present, lineUserId format (U + 32 hex), text non-empty.
 * On any outcome (success / fail / missing-cred) writes a notification_logs row
 * AND an audit_logs row with action 'line.test_push'.
 */
export async function sendLineMessage(
    lineUserId: string,
    text: string,
    operatorUserId: string,
): Promise<ActionResult<{ logId: string | null }>> {
    const trimmedText = (text ?? '').trim();
    if (!trimmedText) return { success: false, error: '訊息內容不可為空' };

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';
    if (!accessToken) {
        const logId = await logToNotificationLogs({
            lineUserId,
            text: trimmedText,
            senderUserId: operatorUserId || null,
            status: 'failed',
            errorMessage: 'LINE 憑證未設定',
        });
        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'line.test_push',
            targetType: 'notification',
            targetId: logId,
            detail: { line_user_id: lineUserId, status: 'failed', error: 'LINE 憑證未設定' },
        });
        return { success: false, error: 'LINE 憑證未設定' };
    }

    if (!LINE_USER_ID_REGEX.test(lineUserId)) {
        const logId = await logToNotificationLogs({
            lineUserId,
            text: trimmedText,
            senderUserId: operatorUserId || null,
            status: 'failed',
            errorMessage: 'LINE userId 格式錯誤（應為 U 開頭 + 32 位 hex）',
        });
        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'line.test_push',
            targetType: 'notification',
            targetId: logId,
            detail: { line_user_id: lineUserId, status: 'failed', error: 'invalid_format' },
        });
        return { success: false, error: 'LINE userId 格式錯誤（應為 U 開頭 + 32 位 hex）' };
    }

    const client = new MessagingApiClient({ channelAccessToken: accessToken });
    try {
        await client.pushMessage({
            to: lineUserId,
            messages: [{ type: 'text', text: trimmedText }],
        });
        const logId = await logToNotificationLogs({
            lineUserId,
            text: trimmedText,
            senderUserId: operatorUserId || null,
            status: 'sent',
            errorMessage: null,
        });
        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'line.test_push',
            targetType: 'notification',
            targetId: logId,
            detail: { line_user_id: lineUserId, status: 'sent' },
        });
        return { success: true, data: { logId } };
    } catch (err: any) {
        const apiError = err?.originalError?.response?.data?.message
            ?? err?.message
            ?? 'LINE API 呼叫失敗';
        const logId = await logToNotificationLogs({
            lineUserId,
            text: trimmedText,
            senderUserId: operatorUserId || null,
            status: 'failed',
            errorMessage: apiError,
        });
        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'line.test_push',
            targetType: 'notification',
            targetId: logId,
            detail: { line_user_id: lineUserId, status: 'failed', error: apiError },
        });
        return { success: false, error: apiError };
    }
}

// ─── Phase 2: account linking ────────────────────────────────────────────────

const LINK_CODE_TTL_MINUTES = 30;

/**
 * Reply to a LINE event using its replyToken. Reply messages do NOT count
 * against the push quota, but reply tokens expire after ~1 minute and are
 * single-use. Failures are logged but never retried.
 */
export async function replyLineMessage(replyToken: string, text: string): Promise<void> {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';
    if (!accessToken) {
        console.error('[replyLineMessage] LINE_CHANNEL_ACCESS_TOKEN not set');
        return;
    }
    try {
        const lineClient = new MessagingApiClient({ channelAccessToken: accessToken });
        await lineClient.replyMessage({
            replyToken,
            messages: [{ type: 'text', text }],
        });
    } catch (err: any) {
        const apiError = err?.originalError?.response?.data?.message ?? err?.message ?? 'unknown';
        console.error('[replyLineMessage] reply failed:', apiError);
    }
}

/**
 * Generate a fresh 6-digit binding code for the operator user.
 * - Fails if the user is already linked to a LINE account.
 * - Overwrites any prior code (PK = user_id).
 * - Audit log does NOT contain the code value (only expiry).
 */
export async function generateLineLinkCode(
    operatorUserId: string,
): Promise<ActionResult<{ code: string; expiresAt: string }>> {
    if (!/^\d+$/.test(operatorUserId)) return { success: false, error: '無效的使用者 ID' };

    const client = await pool.connect();
    try {
        const userRes = await client.query(
            `SELECT line_user_id FROM users WHERE id = $1::bigint LIMIT 1`,
            [operatorUserId]
        );
        if (userRes.rowCount === 0) return { success: false, error: '使用者不存在' };
        if (userRes.rows[0].line_user_id) {
            return { success: false, error: '此帳號已綁定 LINE，請先解除綁定' };
        }

        const code = String(crypto.randomInt(100000, 1000000)); // 100000-999999
        const ttlMinutes = LINK_CODE_TTL_MINUTES;

        const upRes = await client.query(
            `INSERT INTO user_line_link_codes (user_id, code, expires_at, created_at)
             VALUES ($1::bigint, $2, NOW() + ($3 || ' minutes')::interval, NOW())
             ON CONFLICT (user_id) DO UPDATE SET
                code       = EXCLUDED.code,
                expires_at = EXCLUDED.expires_at,
                created_at = NOW()
             RETURNING expires_at`,
            [operatorUserId, code, String(ttlMinutes)]
        );
        const expiresAt = new Date(upRes.rows[0].expires_at).toISOString();

        void writeAuditLog({
            userId: operatorUserId,
            action: 'line.link_code_generated',
            targetType: 'user',
            targetId: operatorUserId,
            detail: { expires_at: expiresAt, ttl_minutes: ttlMinutes },
        });

        return { success: true, data: { code, expiresAt } };
    } catch (err: any) {
        console.error('generateLineLinkCode error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Unlink the operator user's LINE account. No-op (still success) if already unlinked.
 * Audit detail records the previous LINE userId for traceability.
 */
export async function unlinkLine(operatorUserId: string): Promise<ActionResult> {
    if (!/^\d+$/.test(operatorUserId)) return { success: false, error: '無效的使用者 ID' };

    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT line_user_id FROM users WHERE id = $1::bigint LIMIT 1`,
            [operatorUserId]
        );
        if (cur.rowCount === 0) return { success: false, error: '使用者不存在' };
        const previous = cur.rows[0].line_user_id;
        if (!previous) {
            // Already unlinked → no-op, no audit
            return { success: true };
        }

        await client.query(
            `UPDATE users SET line_user_id = NULL WHERE id = $1::bigint`,
            [operatorUserId]
        );
        void writeAuditLog({
            userId: operatorUserId,
            action: 'line.account_unlinked',
            targetType: 'user',
            targetId: operatorUserId,
            detail: { previous_line_user_id: previous },
        });
        return { success: true };
    } catch (err: any) {
        console.error('unlinkLine error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Fetch link state for the personal settings UI.
 * Full lineUserId is NOT returned to the client — only last 6 chars.
 */
export async function fetchLineLinkStatus(operatorUserId: string): Promise<ActionResult<{
    linked: boolean;
    lineUserIdSuffix: string | null;
    pendingCode: { code: string; expiresAt: string } | null;
}>> {
    if (!/^\d+$/.test(operatorUserId)) return { success: false, error: '無效的使用者 ID' };

    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT u.line_user_id,
                    c.code, c.expires_at
             FROM users u
             LEFT JOIN user_line_link_codes c
               ON c.user_id = u.id AND c.expires_at > NOW()
             WHERE u.id = $1::bigint
             LIMIT 1`,
            [operatorUserId]
        );
        if (res.rowCount === 0) return { success: false, error: '使用者不存在' };
        const row = res.rows[0];
        const linked = !!row.line_user_id;
        return {
            success: true,
            data: {
                linked,
                lineUserIdSuffix: linked ? String(row.line_user_id).slice(-6) : null,
                pendingCode: !linked && row.code
                    ? {
                        code: String(row.code).trim(),
                        expiresAt: new Date(row.expires_at).toISOString(),
                    }
                    : null,
            },
        };
    } catch (err: any) {
        console.error('fetchLineLinkStatus error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Internal helper for webhook: process a 6-digit binding code.
 * Returns reply text to send back to the user.
 *
 * Within a transaction: SELECT matching code → UPDATE users.line_user_id → DELETE link_code → audit.
 */
export async function consumeLinkCodeFromWebhook(
    code: string,
    senderLineUserId: string,
): Promise<{ replyText: string; linkedUserId: string | null }> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const codeRes = await client.query(
            `SELECT user_id FROM user_line_link_codes
             WHERE code = $1 AND expires_at > NOW() LIMIT 1`,
            [code]
        );
        if (codeRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { replyText: '綁定碼無效或已過期', linkedUserId: null };
        }
        const targetUserId = String(codeRes.rows[0].user_id);

        try {
            await client.query(
                `UPDATE users SET line_user_id = $1 WHERE id = $2::bigint`,
                [senderLineUserId, targetUserId]
            );
        } catch (err: any) {
            await client.query('ROLLBACK');
            if (err.code === '23505') {
                return { replyText: '此 LINE 帳號已綁定其他系統使用者', linkedUserId: null };
            }
            throw err;
        }

        await client.query(
            `DELETE FROM user_line_link_codes WHERE user_id = $1::bigint`,
            [targetUserId]
        );

        // Decrypt the linked user's name for the success reply
        const userInfoRes = await client.query(
            `SELECT name_enc, name_iv FROM users WHERE id = $1::bigint LIMIT 1`,
            [targetUserId]
        );
        const { decryptAES } = await import('../../lib/crypto');
        const u = userInfoRes.rows[0];
        const name = u?.name_enc && u?.name_iv ? (decryptAES(u.name_enc, u.name_iv) || '使用者') : '使用者';

        await client.query('COMMIT');

        void writeAuditLog({
            userId: targetUserId,
            action: 'line.account_linked',
            targetType: 'user',
            targetId: targetUserId,
            detail: { system_user_id: targetUserId, line_user_id: senderLineUserId },
        });

        return { replyText: `綁定成功！您是 ${name}`, linkedUserId: targetUserId };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('consumeLinkCodeFromWebhook error:', err);
        return { replyText: '系統錯誤，請稍後再試', linkedUserId: null };
    } finally {
        client.release();
    }
}

/**
 * Internal helper for webhook: check if a LINE userId is already linked to a system user.
 */
export async function findUserByLineUserId(lineUserId: string): Promise<string | null> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id::text FROM users WHERE line_user_id = $1 LIMIT 1`,
            [lineUserId]
        );
        return res.rowCount === 0 ? null : res.rows[0].id;
    } catch (err) {
        console.error('findUserByLineUserId error:', err);
        return null;
    } finally {
        client.release();
    }
}
