'use server';
import { pool } from '../../lib/db';
import { encryptAES, decryptAES } from '../../lib/crypto';
import { writeAuditLog } from './auditActions';
import { SYSTEM_TEMPLATE_NAMES } from '../../lib/systemTemplates';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationChannel {
    id: number;
    channel: 'email' | 'line' | 'sms';
    is_enabled: boolean;
    config: Record<string, unknown> | null;
}

export interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;         // plaintext (in memory only)
    from_name: string;
    from_email: string;
}

export interface NotificationTemplate {
    id: number;
    name: string;
    channel: string;
    subject: string | null;
    body: string;
    description: string | null;
    status: 0 | 1;
    sort_order: number;
    created_at: string;
}

export interface NotificationRecipient {
    user_id: string;
    name: string;
    email: string;
    roles?: string[];          // present when fetched from staff list
    is_applicant?: boolean;    // true when fetched as the case applicant
    is_bcc?: boolean;          // manual notification: send this recipient as Bcc
}

export interface NotificationLog {
    id: string;
    application_id: string;
    channel: string;
    sender_id: string | null;
    sender_name: string | null;
    recipients: NotificationRecipient[];
    subject: string | null;
    body: string;
    template_id: number | null;
    status: 'sent' | 'failed';
    error_message: string | null;
    sent_at: string;
}

interface ActionResult {
    success: boolean;
    error?: string;
}

// ─── Channel Actions ──────────────────────────────────────────────────────────

export async function fetchChannels(): Promise<{ success: boolean; data?: NotificationChannel[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query<NotificationChannel>(
            `SELECT id, channel, is_enabled, config FROM notification_channels ORDER BY id`
        );
        return { success: true, data: res.rows };
    } catch (err: any) {
        console.error('fetchChannels error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function updateChannelEnabled(channel: string, isEnabled: boolean): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE notification_channels SET is_enabled = $1 WHERE channel = $2`,
            [isEnabled, channel]
        );
        return { success: true };
    } catch (err: any) {
        console.error('updateChannelEnabled error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function saveSmtpConfig(config: SmtpConfig): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        // Encrypt password before storing (convert Buffers to hex strings for JSON)
        const { enc, iv } = encryptAES(config.password);
        const stored = {
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.user,
            password_enc: enc ? enc.toString('hex') : null,
            password_iv: iv ? iv.toString('hex') : null,
            from_name: config.from_name,
            from_email: config.from_email,
        };
        await client.query(
            `UPDATE notification_channels SET config = $1 WHERE channel = 'email'`,
            [JSON.stringify(stored)]
        );
        return { success: true };
    } catch (err: any) {
        console.error('saveSmtpConfig error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/** Load SMTP config with decrypted password */
export async function loadSmtpConfig(): Promise<{ success: boolean; data?: SmtpConfig; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT config FROM notification_channels WHERE channel = 'email'`
        );
        const cfg = res.rows[0]?.config;
        if (!cfg) return { success: true, data: undefined };

        const password = cfg.password_enc && cfg.password_iv
            ? decryptAES(Buffer.from(cfg.password_enc, 'hex'), Buffer.from(cfg.password_iv, 'hex')) ?? ''
            : '';

        return {
            success: true,
            data: {
                host: cfg.host ?? '',
                port: cfg.port ?? 587,
                secure: cfg.secure ?? false,
                user: cfg.user ?? '',
                password,
                from_name: cfg.from_name ?? '',
                from_email: cfg.from_email ?? '',
            },
        };
    } catch (err: any) {
        console.error('loadSmtpConfig error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Template Actions ─────────────────────────────────────────────────────────

export async function fetchTemplates(): Promise<{ success: boolean; data?: NotificationTemplate[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query<NotificationTemplate>(
            `SELECT id, name, channel, subject, body, description, status, sort_order, created_at::text
             FROM notification_templates
             ORDER BY sort_order, name`
        );
        return { success: true, data: res.rows };
    } catch (err: any) {
        console.error('fetchTemplates error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function fetchActiveTemplates(): Promise<{ success: boolean; data?: NotificationTemplate[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query<NotificationTemplate>(
            `SELECT id, name, channel, subject, body, description, status, sort_order, created_at::text
             FROM notification_templates
             WHERE status = 1
             ORDER BY sort_order, name`
        );
        return { success: true, data: res.rows };
    } catch (err: any) {
        console.error('fetchActiveTemplates error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function addTemplate(
    name: string, channel: string, subject: string | null,
    body: string, description: string | null, sortOrder: number, createdBy: string
): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO notification_templates (name, channel, subject, body, description, sort_order, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7::bigint)`,
            [name, channel, subject || null, body, description || null, sortOrder, createdBy]
        );
        return { success: true };
    } catch (err: any) {
        console.error('addTemplate error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function updateTemplate(
    id: number, name: string, channel: string, subject: string | null,
    body: string, description: string | null, sortOrder: number
): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        // Guard: system templates cannot be renamed (dispatcher looks up by name)
        const curRes = await client.query(`SELECT name FROM notification_templates WHERE id=$1 LIMIT 1`, [id]);
        const curName = curRes.rows[0]?.name;
        if (curName && SYSTEM_TEMPLATE_NAMES.has(curName) && curName !== name) {
            return { success: false, error: '系統範本不可改名（body/subject 仍可編輯）' };
        }
        await client.query(
            `UPDATE notification_templates
             SET name=$1, channel=$2, subject=$3, body=$4, description=$5, sort_order=$6
             WHERE id=$7`,
            [name, channel, subject || null, body, description || null, sortOrder, id]
        );
        return { success: true };
    } catch (err: any) {
        console.error('updateTemplate error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function toggleTemplateStatus(id: number, status: 0 | 1): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        // Guard: disabling a system template would break the dispatcher
        if (status === 0) {
            const nameRes = await client.query(`SELECT name FROM notification_templates WHERE id=$1 LIMIT 1`, [id]);
            const name = nameRes.rows[0]?.name;
            if (name && SYSTEM_TEMPLATE_NAMES.has(name)) {
                return { success: false, error: '系統範本不可停用' };
            }
        }
        await client.query(`UPDATE notification_templates SET status=$1 WHERE id=$2`, [status, id]);
        return { success: true };
    } catch (err: any) {
        console.error('toggleTemplateStatus error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Recipient helpers ────────────────────────────────────────────────────────

/**
 * Fetch staff users (non-applicant roles) with email, including their roles.
 * Applicant-only accounts are excluded — use fetchApplicantRecipient() for that.
 */
export async function fetchEmailRecipients(): Promise<{ success: boolean; data?: NotificationRecipient[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT u.id::text AS user_id, u.name_enc, u.name_iv, u.email,
                    COALESCE(
                        ARRAY_AGG(r.code ORDER BY r.id) FILTER (WHERE r.code IS NOT NULL),
                        '{}'::text[]
                    ) AS roles
             FROM users u
             LEFT JOIN user_roles ur ON ur.user_id = u.id
             LEFT JOIN roles r ON r.id = ur.role_id
             WHERE u.is_active = true
               AND u.email IS NOT NULL AND u.email <> ''
               AND u.id NOT IN (
                   SELECT DISTINCT user_id FROM user_roles ur2
                   JOIN roles r2 ON r2.id = ur2.role_id
                   WHERE r2.code IN ('applicant', 'admin')
               )
             GROUP BY u.id, u.name_enc, u.name_iv, u.email
             ORDER BY u.account`
        );
        const { decryptAES: dec } = await import('../../lib/crypto');
        const data: NotificationRecipient[] = res.rows.map(r => ({
            user_id: r.user_id,
            name: r.name_enc && r.name_iv ? dec(r.name_enc, r.name_iv) ?? r.user_id : r.user_id,
            email: r.email,
            roles: r.roles ?? [],
        }));
        return { success: true, data };
    } catch (err: any) {
        console.error('fetchEmailRecipients error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Fetch the applicant of a specific application as a recipient.
 * Returns null if the applicant has no email on record.
 */
export async function fetchApplicantRecipient(
    applicationId: string
): Promise<{ success: boolean; data?: NotificationRecipient | null; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT u.id::text AS user_id, u.name_enc, u.name_iv, u.email
             FROM applications a
             JOIN users u ON u.id = a.applicant_id
             WHERE a.id = $1
             LIMIT 1`,
            [applicationId]
        );
        if (res.rows.length === 0) return { success: true, data: null };
        const r = res.rows[0];
        if (!r.email) return { success: true, data: null };
        const { decryptAES: dec } = await import('../../lib/crypto');
        const recipient: NotificationRecipient = {
            user_id: r.user_id,
            name: r.name_enc && r.name_iv ? dec(r.name_enc, r.name_iv) ?? r.user_id : r.user_id,
            email: r.email,
            is_applicant: true,
        };
        return { success: true, data: recipient };
    } catch (err: any) {
        console.error('fetchApplicantRecipient error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Send Email ───────────────────────────────────────────────────────────────

export interface EmailAttachment {
    filename: string;
    content: Buffer;
    contentType: string;
}

export async function sendNotificationEmail(
    applicationId: string,
    recipients: NotificationRecipient[],
    subject: string,
    body: string,
    templateId: number | null,
    senderUserId: string,
    isPendingDocReminder: boolean = false,
    attachments?: EmailAttachment[],
    disbursementId?: string | null,
): Promise<ActionResult> {
    // 1. Load SMTP config
    const cfgRes = await loadSmtpConfig();
    if (!cfgRes.success || !cfgRes.data) {
        return { success: false, error: 'SMTP 設定尚未完成，請至「通知管理」設定 Email 渠道。' };
    }
    const cfg = cfgRes.data;
    if (!cfg.host || !cfg.user) {
        return { success: false, error: 'SMTP 設定不完整。' };
    }

    // 2. Send via Nodemailer
    let sendError: string | null = null;
    const hasExplicitBccSetting = recipients.some(r => typeof r.is_bcc === 'boolean');
    const applicantRecipients = recipients.filter(r => r.is_applicant);
    const staffRecipients = recipients.filter(r => !r.is_applicant);
    const visibleRecipients = hasExplicitBccSetting
        ? recipients.filter(r => !r.is_bcc)
        : (applicantRecipients.length > 0 ? applicantRecipients : recipients);
    const bccRecipients = hasExplicitBccSetting
        ? recipients.filter(r => r.is_bcc)
        : (applicantRecipients.length > 0 ? staffRecipients : []);
    const formatAddresses = (items: NotificationRecipient[]) =>
        items.map(r => `"${r.name}" <${r.email}>`).join(', ');
    try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: { user: cfg.user, pass: cfg.password },
        });

        await transporter.sendMail({
            from: `"${cfg.from_name}" <${cfg.from_email}>`,
            to: visibleRecipients.length > 0
                ? formatAddresses(visibleRecipients)
                : `"${cfg.from_name}" <${cfg.from_email}>`,
            ...(bccRecipients.length > 0 ? { bcc: formatAddresses(bccRecipients) } : {}),
            subject,
            text: body,
            html: body.replace(/\n/g, '<br>'),
            ...(attachments && attachments.length > 0 ? { attachments } : {}),
        });
    } catch (err: any) {
        console.error('sendNotificationEmail SMTP error:', err);
        sendError = err.message ?? '發送失敗';
    }

    // 3. Write notification_logs
    const client = await pool.connect();
    try {
        const logRes = await client.query(
            `INSERT INTO notification_logs
                (application_id, channel, sender_id, recipients, subject, body, template_id, status, error_message, is_pending_doc_reminder, disbursement_id)
             VALUES ($1, 'email', $2::bigint, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id`,
            [
                applicationId,
                senderUserId || null,
                JSON.stringify(recipients),
                subject,
                body,
                templateId,
                sendError ? 'failed' : 'sent',
                sendError,
                isPendingDocReminder,
                disbursementId ?? null,
            ]
        );

        // 4. Audit log
        void writeAuditLog({
            userId: senderUserId || null,
            action: 'notification.send',
            targetType: 'notification',
            targetId: String(logRes.rows[0].id),
            detail: {
                application_id: applicationId,
                channel: 'email',
                recipients: recipients.map(r => r.email),
                visible_recipients: visibleRecipients.map(r => r.email),
                bcc_recipients: bccRecipients.map(r => r.email),
                subject,
                status: sendError ? 'failed' : 'sent',
                pending_doc_reminder: isPendingDocReminder,
                attachments_count: attachments?.length ?? 0,
                attachment_filenames: attachments?.map(a => a.filename) ?? [],
            },
        });

        if (sendError) return { success: false, error: sendError };
        return { success: true };
    } catch (err: any) {
        console.error('sendNotificationEmail log error:', err);
        return { success: false, error: sendError ?? err.message };
    } finally {
        client.release();
    }
}

// ─── Internal email sender (used by schedule execution) ──────────────────────

async function sendScheduledEmail(opts: {
    to: { name: string; address: string }[];
    subject: string;
    html: string;
}): Promise<{ success: boolean; error?: string }> {
    const cfgRes = await loadSmtpConfig();
    if (!cfgRes.success || !cfgRes.data) {
        return { success: false, error: 'SMTP 設定尚未完成' };
    }
    const cfg = cfgRes.data;
    if (!cfg.host || !cfg.user) return { success: false, error: 'SMTP 設定不完整' };
    try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: { user: cfg.user, pass: cfg.password },
        });
        const toAddresses = opts.to.map(r => `"${r.name}" <${r.address}>`).join(', ');
        await transporter.sendMail({
            from: `"${cfg.from_name}" <${cfg.from_email}>`,
            to: toAddresses,
            subject: opts.subject,
            html: opts.html,
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message ?? '發送失敗' };
    }
}

// ── Notification Schedules ─────────────────────────────────────────────────

export interface NotificationSchedule {
    id: number;
    name: string;
    channel: string;
    template_id: number | null;
    template_name?: string;
    recipient_type: string;
    conditions: Record<string, any>;
    frequency: string;
    day_of_week: number | null;
    is_active: boolean;
    last_sent_at: string | null;
    created_at: string;
}

export async function fetchSchedules(): Promise<{ success: boolean; data?: NotificationSchedule[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT s.id, s.name, s.channel, s.template_id, t.name AS template_name,
                   s.recipient_type, s.conditions, s.frequency, s.day_of_week,
                   s.is_active, s.last_sent_at::text, s.created_at::text
            FROM notification_schedules s
            LEFT JOIN notification_templates t ON t.id = s.template_id
            ORDER BY s.created_at DESC
        `);
        return { success: true, data: res.rows };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function saveSchedule(data: {
    id?: number;
    name: string;
    template_id: number | null;
    recipient_type: string;
    conditions: Record<string, any>;
    frequency: string;
    day_of_week: number | null;
    is_active: boolean;
}): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        if (data.id) {
            await client.query(
                `UPDATE notification_schedules
                 SET name=$1, template_id=$2, recipient_type=$3, conditions=$4,
                     frequency=$5, day_of_week=$6, is_active=$7, updated_at=NOW()
                 WHERE id=$8`,
                [data.name, data.template_id, data.recipient_type, JSON.stringify(data.conditions),
                 data.frequency, data.day_of_week, data.is_active, data.id]
            );
        } else {
            await client.query(
                `INSERT INTO notification_schedules
                     (name, template_id, recipient_type, conditions, frequency, day_of_week, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [data.name, data.template_id, data.recipient_type, JSON.stringify(data.conditions),
                 data.frequency, data.day_of_week, data.is_active]
            );
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function deleteSchedule(id: number): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM notification_schedules WHERE id = $1`, [id]);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function toggleScheduleActive(id: number, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE notification_schedules SET is_active=$1, updated_at=NOW() WHERE id=$2`, [isActive, id]);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function executeSchedule(
    scheduleId: number,
    triggeredBy: 'cron' | 'manual' = 'manual'
): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
    const client = await pool.connect();
    try {
        // Load the schedule
        const schRes = await client.query(
            `SELECT s.*, t.subject, t.body FROM notification_schedules s
             LEFT JOIN notification_templates t ON t.id = s.template_id
             WHERE s.id = $1`,
            [scheduleId]
        );
        if (schRes.rows.length === 0) return { success: false, sent: 0, failed: 0, error: '找不到排程' };
        const schedule = schRes.rows[0];
        if (!schedule.subject || !schedule.body) return { success: false, sent: 0, failed: 0, error: '模板未設定' };

        // Build recipient list based on conditions
        const conditions = schedule.conditions as Record<string, any>;
        const missingDocDaysGt = conditions.missing_doc_days_gt ?? 0;

        // Query applicants with missing docs older than threshold days
        const recipientsRes = await client.query(
            `SELECT DISTINCT a.id AS application_id, a.case_number, a.apply_at,
                    u.name_enc, u.name_iv, u.account
             FROM applications a
             JOIN users u ON u.id = a.applicant_id
             LEFT JOIN application_documents d ON d.application_id = a.id
             WHERE a.status NOT IN ('2', '4')
               AND NOW() - a.apply_at > ($1 || ' days')::interval
               AND (
                   d.id IS NULL
                   OR d.status IN ('0', '2')
               )
             ORDER BY a.apply_at ASC`,
            [missingDocDaysGt]
        );

        const { decryptAES } = await import('../../lib/crypto');
        let sent = 0;
        let failed = 0;

        for (const row of recipientsRes.rows) {
            const applicantName = row.name_enc && row.name_iv
                ? (decryptAES(row.name_enc, row.name_iv) || '申請人')
                : '申請人';

            // Get applicant email from account (format: app_IDNUMBER — no email stored)
            // Skip if no real email available
            // For now we use the account as a placeholder identifier
            // In production this would need an email field on users table
            const emailMatch = row.account?.match(/^app_(.+)$/);
            if (!emailMatch) { failed++; continue; }

            const vars: Record<string, string> = {
                '案號': row.case_number,
                '申請人': applicantName,
                '申請日期': row.apply_at ? new Date(row.apply_at).toLocaleDateString('zh-TW') : '',
                '缺件天數': String(Math.floor((Date.now() - new Date(row.apply_at).getTime()) / 86400000)),
            };

            const { applyPlaceholders } = await import('../../lib/notificationUtils');
            const subject = applyPlaceholders(schedule.subject, vars);
            const body = applyPlaceholders(schedule.body, vars);

            // Send email — get channel config
            const chRes = await client.query(
                `SELECT config FROM notification_channels WHERE type='email' AND is_enabled=true LIMIT 1`
            );
            if (chRes.rows.length === 0) { failed++; continue; }

            const result = await sendScheduledEmail({
                to: [{ name: applicantName, address: `${row.account}@placeholder.local` }],
                subject,
                html: body,
            });
            if (result.success) sent++; else failed++;
        }

        // Update last_sent_at
        await client.query(
            `UPDATE notification_schedules SET last_sent_at=NOW(), updated_at=NOW() WHERE id=$1`,
            [scheduleId]
        );

        void writeAuditLog({
            userId: null,
            action: 'notification.schedule_execute',
            targetType: 'notification_schedule',
            targetId: String(scheduleId),
            detail: { triggeredBy, sent, failed },
        });

        return { success: true, sent, failed };
    } catch (err: any) {
        return { success: false, sent: 0, failed: 0, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Notification Logs ────────────────────────────────────────────────────────

export async function fetchNotificationLogs(applicationId: string): Promise<{ success: boolean; data?: NotificationLog[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT nl.id::text, nl.application_id::text, nl.channel,
                    nl.sender_id::text, u.name_enc, u.name_iv,
                    nl.recipients, nl.subject, nl.body,
                    nl.template_id, nl.status, nl.error_message,
                    nl.sent_at::text
             FROM notification_logs nl
             LEFT JOIN users u ON u.id = nl.sender_id
             WHERE nl.application_id = $1
             ORDER BY nl.sent_at DESC`,
            [applicationId]
        );
        const { decryptAES: dec } = await import('../../lib/crypto');
        const data: NotificationLog[] = res.rows.map(r => ({
            id: r.id,
            application_id: r.application_id,
            channel: r.channel,
            sender_id: r.sender_id ?? null,
            sender_name: r.name_enc && r.name_iv ? dec(r.name_enc, r.name_iv) ?? null : null,
            recipients: r.recipients ?? [],
            subject: r.subject ?? null,
            body: r.body,
            template_id: r.template_id ?? null,
            status: r.status,
            error_message: r.error_message ?? null,
            sent_at: r.sent_at,
        }));
        return { success: true, data };
    } catch (err: any) {
        console.error('fetchNotificationLogs error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
