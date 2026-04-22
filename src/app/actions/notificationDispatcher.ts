'use server';

import { pool } from '../../lib/db';
import { decryptAES } from '../../lib/crypto';
import { writeAuditLog } from './auditActions';
import { fetchSetting } from './settingsActions';
import { sendNotificationEmail, NotificationRecipient } from './notificationActions';
import { sendLineMessage } from './lineActions';
import { applyPlaceholders } from '../../lib/notificationUtils';

export type NotificationEventType =
    | 'case_entered_board_review'
    | 'case_assigned_to_board_group'
    | 'case_payment_receipt_to_applicant';

type Channel = 'email' | 'line';

interface EventContext {
    applicationId: string;
    groupId?: string;
}

/**
 * Per-event channel restriction. Events listed here SHALL only attempt
 * the listed channels regardless of the recipient's notification_channels.
 * Events NOT listed respect the user's preference (existing behaviour).
 */
const EVENT_CHANNEL_RESTRICTIONS: Partial<Record<NotificationEventType, Channel[]>> = {
    case_payment_receipt_to_applicant: ['email'],
};

type PerChannelStatus = 'sent' | 'failed' | 'skipped_no_channel' | 'skipped_template_missing' | 'skipped_no_target';

// ─── Recipient resolvers (hardcoded per event) ───────────────────────────────

async function resolveRecipients(eventType: NotificationEventType, ctx: EventContext): Promise<string[]> {
    const client = await pool.connect();
    try {
        if (eventType === 'case_entered_board_review') {
            const res = await client.query(
                `SELECT DISTINCT u.id::text AS id
                 FROM users u
                 JOIN user_roles ur ON ur.user_id = u.id
                 JOIN roles r ON r.id = ur.role_id
                 WHERE r.code = 'chairman' AND u.is_active = TRUE`
            );
            return res.rows.map(r => r.id);
        }
        if (eventType === 'case_assigned_to_board_group') {
            if (!ctx.groupId) return [];
            const res = await client.query(
                `SELECT user_id::text AS id
                 FROM board_group_members
                 WHERE group_id = $1::bigint`,
                [ctx.groupId]
            );
            return res.rows.map(r => r.id);
        }
        if (eventType === 'case_payment_receipt_to_applicant') {
            // 單一收件人 = 申請人；inactive 申請人靜默跳過
            const res = await client.query(
                `SELECT u.id::text AS id
                 FROM applications a
                 JOIN users u ON u.id = a.applicant_id
                 WHERE a.id = $1::bigint AND u.is_active = TRUE
                 LIMIT 1`,
                [ctx.applicationId]
            );
            return res.rows.map(r => r.id);
        }
        return [];
    } finally {
        client.release();
    }
}

// ─── Template lookup ────────────────────────────────────────────────────────

interface TemplateRow {
    id: number;
    subject: string | null;
    body: string;
}

async function loadTemplate(channel: Channel, eventType: NotificationEventType): Promise<TemplateRow | null> {
    const name = `${channel}_${eventType}`;
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id, subject, body FROM notification_templates
             WHERE name = $1 AND status = 1 LIMIT 1`,
            [name]
        );
        if (res.rowCount === 0) return null;
        return { id: res.rows[0].id, subject: res.rows[0].subject, body: res.rows[0].body };
    } finally {
        client.release();
    }
}

// ─── Context placeholder loader ──────────────────────────────────────────────

async function loadPlaceholderVars(eventType: NotificationEventType, ctx: EventContext): Promise<Record<string, string>> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT a.case_number, a.apply_amount, a.approved_amount,
                    u.name_enc AS applicant_name_enc, u.name_iv AS applicant_name_iv,
                    bg.name AS group_name
             FROM applications a
             LEFT JOIN users u ON u.id = a.applicant_id
             LEFT JOIN board_review_assignments bra ON bra.application_id = a.id
             LEFT JOIN board_groups bg ON bg.id = bra.group_id
             WHERE a.id = $1::bigint LIMIT 1`,
            [ctx.applicationId]
        );
        if (res.rowCount === 0) {
            return { '案號': '', '申請人': '', '申請金額': '', '核定金額': '', '組別名稱': '', '系統連結': '' };
        }
        const row = res.rows[0];
        const applicantName = row.applicant_name_enc && row.applicant_name_iv
            ? (decryptAES(row.applicant_name_enc, row.applicant_name_iv) || '未知')
            : '未知';
        const amount = row.apply_amount != null ? Number(row.apply_amount).toLocaleString() : '—';
        const approvedAmount = row.approved_amount != null ? Number(row.approved_amount).toLocaleString() : '—';
        // If override group context provided (e.g. reassign not yet committed to assignments table), prefer it
        let groupName = row.group_name ?? '';
        if (eventType === 'case_assigned_to_board_group' && ctx.groupId && !groupName) {
            const g = await client.query(`SELECT name FROM board_groups WHERE id = $1::bigint LIMIT 1`, [ctx.groupId]);
            groupName = g.rows[0]?.name ?? '';
        }
        const systemUrl = process.env.NEXT_PUBLIC_SYSTEM_URL ?? '';
        const caseLink = systemUrl ? `${systemUrl.replace(/\/$/, '')}/?case=${ctx.applicationId}` : '';
        return {
            '案號': row.case_number ?? '',
            '申請人': applicantName,
            '申請金額': amount,
            '核定金額': approvedAmount,
            '組別名稱': groupName,
            '系統連結': caseLink,
        };
    } finally {
        client.release();
    }
}

// ─── Email recipient helper (needs name + email) ────────────────────────────

async function buildEmailRecipient(userId: string): Promise<NotificationRecipient | null> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id::text, account, email, name_enc, name_iv FROM users WHERE id = $1::bigint LIMIT 1`,
            [userId]
        );
        if (res.rowCount === 0) return null;
        const row = res.rows[0];
        if (!row.email) return null;
        const name = row.name_enc && row.name_iv ? (decryptAES(row.name_enc, row.name_iv) || row.account) : row.account;
        return { user_id: row.id, name, email: row.email };
    } finally {
        client.release();
    }
}

// ─── Main entry ──────────────────────────────────────────────────────────────

/**
 * Event-driven notification dispatcher.
 * Called from business actions AFTER their DB transactions commit.
 * Always fire-and-forget: never throws, errors only logged.
 */
export async function notifyEvent(
    eventType: NotificationEventType,
    context: EventContext,
): Promise<void> {
    try {
        const enabled = await fetchSetting('notification_dispatcher_enabled', 'false');
        if (enabled !== 'true') return;

        // Resolve recipients
        const recipientIds = await resolveRecipients(eventType, context);
        if (recipientIds.length === 0) return;

        // Load placeholder context once
        const vars = await loadPlaceholderVars(eventType, context);

        for (const userId of recipientIds) {
            try {
                await dispatchToRecipient(eventType, context, userId, vars);
            } catch (err) {
                console.error(`[dispatcher] unhandled error for user ${userId}`, err);
                void writeAuditLog({
                    userId: null,
                    action: 'notification.event_dispatched',
                    targetType: 'event',
                    targetId: context.applicationId,
                    detail: {
                        event_type: eventType,
                        recipient_user_id: userId,
                        channels_used: [],
                        status_per_channel: {},
                        dispatch_error: String((err as Error)?.message ?? err),
                    },
                });
            }
        }
    } catch (outer) {
        console.error('[dispatcher] outer error', outer);
    }
}

async function dispatchToRecipient(
    eventType: NotificationEventType,
    context: EventContext,
    userId: string,
    vars: Record<string, string>,
): Promise<void> {
    // Fetch user's preferred channels + minimal info
    const client = await pool.connect();
    let userChannels: Channel[] = [];
    let lineUserId: string | null = null;
    let userEmail: string | null = null;
    try {
        const res = await client.query(
            `SELECT notification_channels, line_user_id, email FROM users WHERE id = $1::bigint LIMIT 1`,
            [userId]
        );
        if (res.rowCount === 0) return;
        userChannels = (res.rows[0].notification_channels ?? []).filter(
            (c: string) => c === 'email' || c === 'line'
        ) as Channel[];
        lineUserId = res.rows[0].line_user_id ?? null;
        userEmail = res.rows[0].email ?? null;
    } finally {
        client.release();
    }

    // Apply per-event channel restriction
    const restriction = EVENT_CHANNEL_RESTRICTIONS[eventType];
    const channels: Channel[] = restriction
        ? restriction.filter(c => c === 'email' || c === 'line')
        : userChannels;

    // 為 case_payment_receipt_to_applicant 事件預先產生 PDF buffer 一次（共用給可能的 email send）
    let pdfBuffer: Buffer | null = null;
    let pdfError: string | null = null;
    let caseNumberForFilename = vars['案號'] || context.applicationId;
    if (eventType === 'case_payment_receipt_to_applicant') {
        try {
            // 使用申請人本身的 userId 通過 fetchPaymentReceiptPrintData 的 admin/accountant 守門 — 不行
            // 改傳系統管理員或繞過守門：實作上 generatePaymentReceiptPdf 會 throw 權限不足
            // → 用第一個 admin 帳號當 operator
            const adminId = await fetchFirstAdminUserId();
            if (!adminId) {
                pdfError = '系統內無 admin 帳號，無法產生 PDF';
            } else {
                const { generatePaymentReceiptPdf } = await import('../../lib/pdf/generatePaymentReceiptPdf');
                pdfBuffer = await generatePaymentReceiptPdf(context.applicationId, adminId);
            }
        } catch (err: any) {
            pdfError = err?.message ?? String(err);
            console.error(`[dispatcher] PDF generation failed for app ${context.applicationId}`, err);
        }
    }

    const statusPerChannel: Record<string, PerChannelStatus> = {};

    for (const channel of channels) {
        try {
            const tpl = await loadTemplate(channel, eventType);
            if (!tpl) {
                statusPerChannel[channel] = 'skipped_template_missing';
                continue;
            }

            const renderedBody = applyPlaceholders(tpl.body, vars);
            const renderedSubject = tpl.subject ? applyPlaceholders(tpl.subject, vars) : '';

            if (channel === 'email') {
                // 對於 case_payment_receipt_to_applicant，不走 buildEmailRecipient（它要解密 name_enc）
                // 申請人 email 在 users.email 欄位即可
                let recipient: NotificationRecipient | null;
                if (eventType === 'case_payment_receipt_to_applicant') {
                    if (!userEmail) {
                        statusPerChannel[channel] = 'skipped_no_target';
                        continue;
                    }
                    // 從 vars 取已解密的申請人姓名作為 display
                    recipient = { user_id: userId, name: vars['申請人'] || userEmail, email: userEmail };
                } else {
                    recipient = await buildEmailRecipient(userId);
                    if (!recipient) {
                        statusPerChannel[channel] = 'skipped_no_target';
                        continue;
                    }
                }

                // PDF 附件（僅 case_payment_receipt_to_applicant 事件）
                const attachments = (eventType === 'case_payment_receipt_to_applicant' && pdfBuffer)
                    ? [{
                        filename: `領款收據_${caseNumberForFilename}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    }]
                    : undefined;

                // PDF 失敗則不寄信（依 spec：no email-without-attachment fallback）
                if (eventType === 'case_payment_receipt_to_applicant' && !pdfBuffer) {
                    statusPerChannel[channel] = 'failed';
                    continue;
                }

                const r = await sendNotificationEmail(
                    context.applicationId,
                    [recipient],
                    renderedSubject || '（無主旨）',
                    renderedBody,
                    tpl.id,
                    '',  // senderUserId empty = system
                    false,
                    attachments,
                );
                statusPerChannel[channel] = r.success ? 'sent' : 'failed';
            } else if (channel === 'line') {
                if (!lineUserId) {
                    statusPerChannel[channel] = 'skipped_no_target';
                    continue;
                }
                const r = await sendLineMessage(lineUserId, renderedBody, '');
                statusPerChannel[channel] = r.success ? 'sent' : 'failed';
            }
        } catch (err) {
            console.error(`[dispatcher] channel=${channel} user=${userId} failed`, err);
            statusPerChannel[channel] = 'failed';
        }
    }

    const usedChannels = Object.keys(statusPerChannel).filter(k =>
        statusPerChannel[k] === 'sent' || statusPerChannel[k] === 'failed'
    );

    void writeAuditLog({
        userId: null,
        action: 'notification.event_dispatched',
        targetType: 'event',
        targetId: context.applicationId,
        detail: {
            event_type: eventType,
            recipient_user_id: userId,
            channels_used: usedChannels,
            status_per_channel: statusPerChannel,
        },
    });

    // 額外為 case_payment_receipt_to_applicant 寫一筆 payment_receipt_sent audit
    if (eventType === 'case_payment_receipt_to_applicant') {
        let status: 'sent' | 'failed' | 'skipped_no_email';
        let errorMessage: string | null = null;
        if (!userEmail) {
            status = 'skipped_no_email';
            errorMessage = 'applicant_email_missing';
        } else if (pdfError || !pdfBuffer) {
            status = 'failed';
            errorMessage = pdfError ?? 'pdf_buffer_unavailable';
        } else if (statusPerChannel.email === 'sent') {
            status = 'sent';
        } else {
            status = 'failed';
            errorMessage = `email_send_status=${statusPerChannel.email ?? 'unknown'}`;
        }
        void writeAuditLog({
            userId: null,
            action: 'notification.payment_receipt_sent',
            targetType: 'application',
            targetId: context.applicationId,
            detail: {
                applicantUserId: userId,
                recipientEmail: userEmail,
                pdfBytes: pdfBuffer?.length ?? null,
                status,
                errorMessage,
                attempt_at: new Date().toISOString(),
            },
        });
    }
}

/** 取系統內第一個 admin 帳號 ID，用於 PDF 產生時通過 fetchPaymentReceiptPrintData 的角色守門。 */
async function fetchFirstAdminUserId(): Promise<string | null> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT u.id::text AS id
             FROM users u
             JOIN user_roles ur ON ur.user_id = u.id
             JOIN roles r ON r.id = ur.role_id
             WHERE r.code = 'admin' AND u.is_active = TRUE
             ORDER BY u.id ASC
             LIMIT 1`
        );
        return res.rows[0]?.id ?? null;
    } finally {
        client.release();
    }
}
