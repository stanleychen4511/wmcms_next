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
    | 'case_assigned_to_officer'
    | 'case_payment_receipt_to_applicant'
    | 'disbursement_completed';

type Channel = 'email' | 'line';

interface EventContext {
    applicationId: string;
    groupId?: string;
    disbursementId?: string;
    officerUserId?: string;
}

interface TemplateRow {
    id: number;
    subject: string | null;
    body: string;
}

interface NotificationRule {
    id: string;
    name: string;
    channels: Channel[];
    recipientPolicy: Record<string, unknown>;
    templatesByChannel: Partial<Record<Channel, number>>;
}

type PerChannelStatus =
    | 'sent'
    | 'failed'
    | 'skipped_user_preference'
    | 'skipped_template_missing'
    | 'skipped_no_target';

const EVENT_CHANNEL_RESTRICTIONS: Partial<Record<NotificationEventType, Channel[]>> = {
    case_payment_receipt_to_applicant: ['email'],
};

function isChannel(value: unknown): value is Channel {
    return value === 'email' || value === 'line';
}

function getPolicyRecipientTypes(policy: Record<string, unknown>): string[] {
    const list = policy.recipient_types;
    if (Array.isArray(list)) return list.map(String).filter(Boolean);
    const single = policy.recipient_type;
    return typeof single === 'string' && single ? [single] : [];
}

function shouldRespectUserPreferences(rule: NotificationRule | null): boolean {
    return rule?.recipientPolicy.respect_user_preferences !== false;
}

async function loadRules(eventType: NotificationEventType): Promise<NotificationRule[] | null> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT
                r.id::text,
                r.name,
                r.channels,
                r.recipient_policy,
                COALESCE(
                    jsonb_object_agg(rt.channel, rt.template_id) FILTER (WHERE rt.channel IS NOT NULL),
                    '{}'::jsonb
                ) AS templates_by_channel
             FROM notification_rules r
             LEFT JOIN notification_rule_templates rt ON rt.rule_id = r.id
             WHERE r.event_code = $1 AND r.is_enabled = TRUE
             GROUP BY r.id, r.name, r.channels, r.recipient_policy, r.sort_order
             ORDER BY r.sort_order ASC, r.id ASC`,
            [eventType]
        );
        return res.rows.map(row => ({
            id: row.id,
            name: row.name,
            channels: (row.channels ?? []).filter(isChannel),
            recipientPolicy: row.recipient_policy ?? {},
            templatesByChannel: row.templates_by_channel ?? {},
        }));
    } catch (err: any) {
        if (err?.code === '42P01') return null;
        throw err;
    } finally {
        client.release();
    }
}

async function resolveRoleUsers(roleCode: string): Promise<string[]> {
    const res = await pool.query(
        `SELECT DISTINCT u.id::text AS id
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.code = $1 AND u.is_active = TRUE`,
        [roleCode]
    );
    return res.rows.map(r => r.id);
}

async function resolveBoardGroupMembers(groupId?: string): Promise<string[]> {
    if (!groupId) return [];
    const res = await pool.query(
        `SELECT u.id::text AS id
         FROM board_group_members bgm
         JOIN users u ON u.id = bgm.user_id
         WHERE bgm.group_id = $1::bigint AND u.is_active = TRUE`,
        [groupId]
    );
    return res.rows.map(r => r.id);
}

async function resolveAssignedOfficer(ctx: EventContext): Promise<string[]> {
    if (ctx.officerUserId) {
        const res = await pool.query(
            `SELECT id::text AS id
             FROM users
             WHERE id = $1::bigint AND is_active = TRUE
             LIMIT 1`,
            [ctx.officerUserId]
        );
        return res.rows.map(r => r.id);
    }
    const res = await pool.query(
        `SELECT u.id::text AS id
         FROM applications a
         JOIN users u ON u.id = a.officer_id
         WHERE a.id = $1::bigint AND u.is_active = TRUE
         LIMIT 1`,
        [ctx.applicationId]
    );
    return res.rows.map(r => r.id);
}

async function resolveApplicant(applicationId: string): Promise<string[]> {
    const res = await pool.query(
        `SELECT u.id::text AS id
         FROM applications a
         JOIN users u ON u.id = a.applicant_id
         WHERE a.id = $1::bigint AND u.is_active = TRUE
         LIMIT 1`,
        [applicationId]
    );
    return res.rows.map(r => r.id);
}

async function resolveDisbursementRelatedUsers(disbursementId?: string): Promise<string[]> {
    if (!disbursementId) return [];
    const res = await pool.query(
        `SELECT DISTINCT u.id::text AS id
         FROM payment_disbursements pd
         LEFT JOIN users u ON u.id IN (pd.created_by, pd.supervisor_user_id, pd.accountant_user_id)
         WHERE pd.id = $1::bigint AND u.id IS NOT NULL AND u.is_active = TRUE
         UNION
         SELECT u.id::text AS id
         FROM payment_disbursements pd
         JOIN applications a ON a.id = pd.application_id
         JOIN users u ON u.id = a.applicant_id
         WHERE pd.id = $1::bigint AND u.is_active = TRUE`,
        [disbursementId]
    );
    return res.rows.map(r => r.id);
}

async function resolveLegacyRecipients(eventType: NotificationEventType, ctx: EventContext): Promise<string[]> {
    if (eventType === 'case_entered_board_review') return resolveRoleUsers('chairman');
    if (eventType === 'case_assigned_to_board_group') return resolveBoardGroupMembers(ctx.groupId);
    if (eventType === 'case_assigned_to_officer') return resolveAssignedOfficer(ctx);
    if (eventType === 'case_payment_receipt_to_applicant') return resolveApplicant(ctx.applicationId);
    if (eventType === 'disbursement_completed') return resolveDisbursementRelatedUsers(ctx.disbursementId);
    return [];
}

async function resolveRuleRecipients(rule: NotificationRule, ctx: EventContext): Promise<string[]> {
    const recipientTypes = getPolicyRecipientTypes(rule.recipientPolicy);
    if (recipientTypes.length === 0) return [];

    const ids = new Set<string>();
    for (const type of recipientTypes) {
        const resolved =
            type === 'chairman' ? await resolveRoleUsers('chairman') :
            type === 'board_group_members' ? await resolveBoardGroupMembers(ctx.groupId) :
            type === 'assigned_officer' ? await resolveAssignedOfficer(ctx) :
            type === 'disbursement_related_users' ? await resolveDisbursementRelatedUsers(ctx.disbursementId) :
            type === 'applicant' ? await resolveApplicant(ctx.applicationId) :
            type.startsWith('role:') ? await resolveRoleUsers(type.slice('role:'.length)) :
            [];
        resolved.forEach(id => ids.add(id));
    }
    return [...ids];
}

async function loadTemplateByName(channel: Channel, eventType: NotificationEventType): Promise<TemplateRow | null> {
    const name = `${channel}_${eventType}`;
    const res = await pool.query(
        `SELECT id, subject, body
         FROM notification_templates
         WHERE name = $1 AND status = 1
         LIMIT 1`,
        [name]
    );
    if (res.rowCount === 0) return null;
    return { id: res.rows[0].id, subject: res.rows[0].subject, body: res.rows[0].body };
}

async function loadTemplateForRule(
    channel: Channel,
    eventType: NotificationEventType,
    rule: NotificationRule | null,
): Promise<TemplateRow | null> {
    const templateId = rule?.templatesByChannel[channel];
    if (templateId) {
        const res = await pool.query(
            `SELECT id, subject, body
             FROM notification_templates
             WHERE id = $1 AND channel = $2 AND status = 1
             LIMIT 1`,
            [templateId, channel]
        );
    if ((res.rowCount ?? 0) > 0) {
            return { id: res.rows[0].id, subject: res.rows[0].subject, body: res.rows[0].body };
        }
    }
    return loadTemplateByName(channel, eventType);
}

async function loadPlaceholderVars(eventType: NotificationEventType, ctx: EventContext): Promise<Record<string, string>> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT a.case_number, a.apply_amount, a.approved_amount,
                    u.name_enc AS applicant_name_enc, u.name_iv AS applicant_name_iv,
                    ou.name_enc AS officer_name_enc, ou.name_iv AS officer_name_iv,
                    ou.account AS officer_account,
                    bg.name AS group_name
             FROM applications a
             LEFT JOIN users u ON u.id = a.applicant_id
             LEFT JOIN users ou ON ou.id = COALESCE($2::bigint, a.officer_id)
             LEFT JOIN board_review_assignments bra ON bra.application_id = a.id
             LEFT JOIN board_groups bg ON bg.id = bra.group_id
             WHERE a.id = $1::bigint
             LIMIT 1`,
            [ctx.applicationId, ctx.officerUserId ?? null]
        );
        if (res.rowCount === 0) {
            return {};
        }

        const row = res.rows[0];
        const applicantName = row.applicant_name_enc && row.applicant_name_iv
            ? (decryptAES(row.applicant_name_enc, row.applicant_name_iv) || '申請人')
            : '申請人';
        const amount = row.apply_amount != null ? Number(row.apply_amount).toLocaleString() : '';
        const approvedAmount = row.approved_amount != null ? Number(row.approved_amount).toLocaleString() : '';
        const officerName = row.officer_name_enc && row.officer_name_iv
            ? (decryptAES(row.officer_name_enc, row.officer_name_iv) || row.officer_account || '')
            : (row.officer_account || '');

        let groupName = row.group_name ?? '';
        if (eventType === 'case_assigned_to_board_group' && ctx.groupId && !groupName) {
            const groupRes = await client.query(
                `SELECT name FROM board_groups WHERE id = $1::bigint LIMIT 1`,
                [ctx.groupId]
            );
            groupName = groupRes.rows[0]?.name ?? '';
        }

        const systemUrl = process.env.NEXT_PUBLIC_SYSTEM_URL ?? '';
        const caseLink = systemUrl ? `${systemUrl.replace(/\/$/, '')}/?case=${ctx.applicationId}` : '';

        let thisDisbursementAmount = '';
        let cumulativeDisbursementAmount = '';
        if (eventType === 'disbursement_completed' && ctx.disbursementId) {
            const disbursementRes = await client.query(
                `SELECT pd.amount,
                        COALESCE((
                            SELECT SUM(amount)
                            FROM payment_disbursements
                            WHERE application_id = pd.application_id AND review_stage = '9'
                        ), 0) AS total_completed
                 FROM payment_disbursements pd
                 WHERE pd.id = $1::bigint
                 LIMIT 1`,
                [ctx.disbursementId]
            );
            if (disbursementRes.rowCount && disbursementRes.rowCount > 0) {
                thisDisbursementAmount = Number(disbursementRes.rows[0].amount).toLocaleString();
                cumulativeDisbursementAmount = Number(disbursementRes.rows[0].total_completed).toLocaleString();
            }
        }

        const readableVars = {
            '案號': row.case_number ?? '',
            '申請人': applicantName,
            '申請金額': amount,
            '核定金額': approvedAmount,
            '承辦人': officerName,
            '組別名稱': groupName,
            '系統連結': systemUrl,
            '案件連結': caseLink,
        };

        return {
            ...readableVars,
            '案號': row.case_number ?? '',
            '申請人': applicantName,
            '申請金額': amount,
            '核定金額': approvedAmount,
            '董事組別': groupName,
            '案件連結': caseLink,
            '組別名稱': groupName,
            '系統連結': caseLink,
            '本次撥款金額': thisDisbursementAmount,
            '累計撥款金額': cumulativeDisbursementAmount,
        };
    } finally {
        client.release();
    }
}

async function buildEmailRecipient(userId: string): Promise<NotificationRecipient | null> {
    const res = await pool.query(
        `SELECT id::text, account, email, name_enc, name_iv
         FROM users
         WHERE id = $1::bigint
         LIMIT 1`,
        [userId]
    );
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    if (!row.email) return null;
    const name = row.name_enc && row.name_iv ? (decryptAES(row.name_enc, row.name_iv) || row.account) : row.account;
    return { user_id: row.id, name, email: row.email };
}

async function fetchUserDeliveryState(userId: string): Promise<{
    channels: Channel[];
    email: string | null;
    lineUserId: string | null;
} | null> {
    const res = await pool.query(
        `SELECT notification_channels, line_user_id, email
         FROM users
         WHERE id = $1::bigint
         LIMIT 1`,
        [userId]
    );
    if (res.rowCount === 0) return null;
    return {
        channels: (res.rows[0].notification_channels ?? []).filter(isChannel),
        email: res.rows[0].email ?? null,
        lineUserId: res.rows[0].line_user_id ?? null,
    };
}

/**
 * Event-driven notification dispatcher.
 * Business actions call this after their DB transaction commits.
 * It never throws to the caller; failures are logged and audited.
 */
export async function notifyEvent(
    eventType: NotificationEventType,
    context: EventContext,
): Promise<void> {
    try {
        const enabled = await fetchSetting('notification_dispatcher_enabled', 'false');
        if (enabled !== 'true') return;

        const rules = await loadRules(eventType);
        const vars = await loadPlaceholderVars(eventType, context);

        if (!rules || rules.length === 0) {
            const recipientIds = await resolveLegacyRecipients(eventType, context);
            await dispatchRuleToRecipients(eventType, context, null, recipientIds, vars);
            return;
        }

        for (const rule of rules) {
            const recipientIds = await resolveRuleRecipients(rule, context);
            await dispatchRuleToRecipients(eventType, context, rule, recipientIds, vars);
        }
    } catch (outer) {
        console.error('[dispatcher] outer error', outer);
    }
}

async function dispatchRuleToRecipients(
    eventType: NotificationEventType,
    context: EventContext,
    rule: NotificationRule | null,
    recipientIds: string[],
    vars: Record<string, string>,
): Promise<void> {
    for (const userId of [...new Set(recipientIds)]) {
        try {
            await dispatchToRecipient(eventType, context, rule, userId, vars);
        } catch (err) {
            console.error(`[dispatcher] unhandled error for user ${userId}`, err);
            void writeAuditLog({
                userId: null,
                action: 'notification.event_dispatched',
                targetType: 'event',
                targetId: context.applicationId,
                detail: {
                    event_type: eventType,
                    rule_id: rule?.id ?? null,
                    recipient_user_id: userId,
                    channels_used: [],
                    status_per_channel: {},
                    dispatch_error: String((err as Error)?.message ?? err),
                },
            });
        }
    }
}

async function dispatchToRecipient(
    eventType: NotificationEventType,
    context: EventContext,
    rule: NotificationRule | null,
    userId: string,
    vars: Record<string, string>,
): Promise<void> {
    const user = await fetchUserDeliveryState(userId);
    if (!user) return;

    const hasLegacyRestriction = !rule && !!EVENT_CHANNEL_RESTRICTIONS[eventType];
    const allowedChannels = rule?.channels.length
        ? rule.channels
        : (EVENT_CHANNEL_RESTRICTIONS[eventType] ?? user.channels);
    const channels = hasLegacyRestriction || !shouldRespectUserPreferences(rule)
        ? allowedChannels
        : allowedChannels.filter(channel => user.channels.includes(channel));

    let pdfBuffer: Buffer | null = null;
    let pdfError: string | null = null;
    const caseNumberForFilename = vars['案號'] || context.applicationId;
    if (eventType === 'case_payment_receipt_to_applicant') {
        try {
            const adminId = await fetchFirstAdminUserId();
            if (!adminId) {
                pdfError = '找不到可產生 PDF 的管理員帳號';
            } else if (context.disbursementId) {
                const dRes = await pool.query(
                    `SELECT amount, external_code,
                            payment_method, bank_name, bank_branch, bank_account,
                            payee_name, payee_relation, payee_relation_other
                     FROM payment_disbursements
                     WHERE id = $1::bigint
                     LIMIT 1`,
                    [context.disbursementId]
                );
                if (dRes.rowCount === 0) {
                    pdfError = '找不到撥款資料';
                } else {
                    const row = dRes.rows[0];
                    const { generateDisbursementPaymentReceiptPdf } =
                        await import('../../lib/pdf/generateDisbursementPaymentReceiptPdf');
                    pdfBuffer = await generateDisbursementPaymentReceiptPdf(
                        context.applicationId,
                        adminId,
                        {
                            amount: Number(row.amount),
                            externalCode: row.external_code ?? undefined,
                            paymentMethod: row.payment_method,
                            bankName: row.bank_name,
                            bankBranch: row.bank_branch,
                            bankAccount: row.bank_account,
                            payeeName: row.payee_name,
                            payeeRelation: row.payee_relation,
                            payeeRelationOther: row.payee_relation_other,
                        },
                    );
                }
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
    for (const channel of allowedChannels) {
        if (!channels.includes(channel)) {
            statusPerChannel[channel] = 'skipped_user_preference';
            continue;
        }

        try {
            const template = await loadTemplateForRule(channel, eventType, rule);
            if (!template) {
                statusPerChannel[channel] = 'skipped_template_missing';
                continue;
            }

            const renderedBody = applyPlaceholders(template.body, vars);
            const renderedSubject = template.subject ? applyPlaceholders(template.subject, vars) : '';

            if (channel === 'email') {
                let recipient: NotificationRecipient | null;
                if (eventType === 'case_payment_receipt_to_applicant') {
                    if (!user.email) {
                        statusPerChannel[channel] = 'skipped_no_target';
                        continue;
                    }
                    recipient = { user_id: userId, name: vars['申請人'] || user.email, email: user.email };
                } else {
                    recipient = await buildEmailRecipient(userId);
                    if (!recipient) {
                        statusPerChannel[channel] = 'skipped_no_target';
                        continue;
                    }
                }

                if (eventType === 'case_payment_receipt_to_applicant' && !pdfBuffer) {
                    statusPerChannel[channel] = 'failed';
                    continue;
                }

                const attachments = (eventType === 'case_payment_receipt_to_applicant' && pdfBuffer)
                    ? [{
                        filename: `領款收據_${caseNumberForFilename}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    }]
                    : undefined;

                const result = await sendNotificationEmail(
                    context.applicationId,
                    [recipient],
                    renderedSubject || '萬美基金會通知',
                    renderedBody,
                    template.id,
                    '',
                    false,
                    attachments,
                    context.disbursementId ?? null,
                );
                statusPerChannel[channel] = result.success ? 'sent' : 'failed';
            }

            if (channel === 'line') {
                if (!user.lineUserId) {
                    statusPerChannel[channel] = 'skipped_no_target';
                    continue;
                }
                const result = await sendLineMessage(user.lineUserId, renderedBody, '');
                statusPerChannel[channel] = result.success ? 'sent' : 'failed';
            }
        } catch (err) {
            console.error(`[dispatcher] channel=${channel} user=${userId} failed`, err);
            statusPerChannel[channel] = 'failed';
        }
    }

    const usedChannels = Object.keys(statusPerChannel).filter(key =>
        statusPerChannel[key] === 'sent' || statusPerChannel[key] === 'failed'
    );

    void writeAuditLog({
        userId: null,
        action: 'notification.event_dispatched',
        targetType: 'event',
        targetId: context.applicationId,
        detail: {
            event_type: eventType,
            rule_id: rule?.id ?? null,
            rule_name: rule?.name ?? null,
            recipient_user_id: userId,
            channels_used: usedChannels,
            status_per_channel: statusPerChannel,
        },
    });

    if (eventType === 'case_payment_receipt_to_applicant') {
        let status: 'sent' | 'failed' | 'skipped_no_email';
        let errorMessage: string | null = null;
        if (!user.email) {
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
                recipientEmail: user.email,
                pdfBytes: pdfBuffer?.length ?? null,
                status,
                errorMessage,
                attempt_at: new Date().toISOString(),
            },
        });
    }
}

async function fetchFirstAdminUserId(): Promise<string | null> {
    const res = await pool.query(
        `SELECT u.id::text AS id
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'admin' AND u.is_active = TRUE
         ORDER BY u.id ASC
         LIMIT 1`
    );
    return res.rows[0]?.id ?? null;
}
