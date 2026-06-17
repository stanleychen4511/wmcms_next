'use server';

import { pool } from '../../lib/db';
import { formatDateOnly } from '../../lib/dateOnly';
import { fetchSetting } from './settingsActions';
import { decryptAES } from '../../lib/crypto';

export interface PendingDocAlert {
    applicationId: string;
    caseNumber: string;
    applicantName: string;
    applyAt: string;
    daysOverdue: number;   // days since apply_at
    missingCount: number;  // number of required docs missing (status '0' or '2')
}

export interface PendingDocThresholdAlert {
    applicationId: string;
    caseNumber: string;
    applicantName: string;
    reminderCount: number;
    threshold: number;
    lastReminderAt: string | null;
    missingCount: number;
}

type RequiredDocType = { id: string; subsidy_subtype: '1' | '2' | null };

type PendingDocCaseRow = {
    application_id: string;
    case_number: string;
    apply_at: Date | string | null;
    days_since: number | null;
    subsidy_subtype: '1' | '2' | null;
    name_enc: Buffer | null;
    name_iv: Buffer | null;
};

type PendingDocThresholdRow = {
    application_id: string;
    case_number: string;
    subsidy_subtype: '1' | '2' | null;
    name_enc: Buffer | null;
    name_iv: Buffer | null;
    reminder_count: number;
    last_reminder_at: Date | string | null;
};

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/**
 * For a given case_officer, find all active (non-closed) cases where:
 * - apply_at is >= N days ago (N from system_settings)
 * - at least one required apply-phase document is missing (status '0' or '2', or no DB record)
 *
 * 結案狀態 ('2'=審核未通過, '4'=核銷完成) 以外的所有階段
 * (admin_review, home_visit, board_review, reimbursement) 都會被檢測。
 *
 * Required doc IDs are read dynamically from document_type_config
 * (phase='apply', is_required=true, is_active=true).
 */
export async function fetchPendingDocAlerts(
    officerId: string
): Promise<{ success: boolean; data?: PendingDocAlert[]; error?: string }> {
    const client = await pool.connect();
    try {
        const thresholdDays = parseInt(await fetchSetting('pending_doc_alert_days', '14'), 10);

        // Step 0: fetch required apply-phase doc IDs from DB
        const docTypeRes = await client.query<RequiredDocType>(
            `SELECT id::text, subsidy_subtype FROM document_type_config
             WHERE phase = 'apply' AND is_required = true AND is_active = true`
        );
        const requiredDocTypes = docTypeRes.rows;
        const requiredDocIds: string[] = requiredDocTypes.map(r => r.id);

        if (requiredDocIds.length === 0) {
            // No required docs configured → nothing to alert
            return { success: true, data: [] };
        }

        // Step 1: fetch all active (non-closed) cases assigned to this officer
        // 只要不是結案 ('2'/'4')，無論目前在哪個階段都會被檢測
        const casesRes = await client.query<PendingDocCaseRow>(
            `SELECT
                a.id::text AS application_id,
                a.case_number,
                a.apply_at,
                EXTRACT(DAY FROM NOW() - a.apply_at)::int AS days_since,
                a.subsidy_subtype,
                u.name_enc,
                u.name_iv
             FROM applications a
             LEFT JOIN users u ON u.id = a.applicant_id
             WHERE a.officer_id = $1
               AND a.status NOT IN ('2', '4')
               AND a.apply_at IS NOT NULL
               AND NOW() - a.apply_at >= ($2 || ' days')::interval
             ORDER BY a.apply_at ASC`,
            [officerId, thresholdDays]
        );

        if (casesRes.rows.length === 0) {
            return { success: true, data: [] };
        }

        const appIds = casesRes.rows.map(r => r.application_id);

        // Step 2: fetch existing document records for those cases (required apply docs only)
        const docsRes = await client.query(
            `SELECT application_id::text, id::text AS doc_id, status
             FROM application_documents
             WHERE application_id = ANY($1::bigint[])
               AND id = ANY($2::smallint[])`,
            [appIds, requiredDocIds]
        );

        // Build a map: applicationId -> { docId -> status }
        const docMap = new Map<string, Map<string, string>>();
        for (const row of docsRes.rows) {
            if (!docMap.has(row.application_id)) docMap.set(row.application_id, new Map());
            docMap.get(row.application_id)!.set(row.doc_id, row.status);
        }

        // Step 3: calculate missing count per case
        const alerts: PendingDocAlert[] = [];

        for (const row of casesRes.rows) {
            const appDocs = docMap.get(row.application_id);
            let missingCount = 0;

            const applicableDocIds = requiredDocTypes
                .filter(doc => !doc.subsidy_subtype || doc.subsidy_subtype === row.subsidy_subtype)
                .map(doc => doc.id);

            for (const docId of applicableDocIds) {
                const status = appDocs?.get(docId);
                // No record, status '0' (not uploaded), or status '2' (overdue) = missing
                if (!status || status === '0' || status === '2') missingCount++;
            }

            if (missingCount === 0) continue;

            const applicantName =
                row.name_enc && row.name_iv
                    ? decryptAES(row.name_enc, row.name_iv) || '未知'
                    : '未知';

            alerts.push({
                applicationId: row.application_id,
                caseNumber: row.case_number,
                applicantName,
                applyAt: formatDateOnly(row.apply_at) ?? '',
                daysOverdue: row.days_since ?? 0,
                missingCount,
            });
        }

        return { success: true, data: alerts };
    } catch (err: unknown) {
        console.error('fetchPendingDocAlerts error:', err);
        return { success: false, error: errorMessage(err) };
    } finally {
        client.release();
    }
}

/**
 * For a given case_officer, find all active (non-closed) cases where the count of
 * pending-doc reminder notifications (notification_logs.is_pending_doc_reminder = TRUE
 * AND status='sent') is >= the system-configured threshold
 * (system_settings.pending_doc_notification_threshold, default 3).
 *
 * Each result also reports the missing required-apply-doc count so callers can
 * surface the same info shown by fetchPendingDocAlerts.
 */
export async function fetchPendingDocThresholdAlerts(
    officerId: string
): Promise<{ success: boolean; data?: PendingDocThresholdAlert[]; error?: string }> {
    const client = await pool.connect();
    try {
        const threshold = parseInt(
            await fetchSetting('pending_doc_notification_threshold', '3'),
            10
        );

        // Step 0: required apply-phase doc IDs (for missingCount)
        const docTypeRes = await client.query<RequiredDocType>(
            `SELECT id::text, subsidy_subtype FROM document_type_config
             WHERE phase = 'apply' AND is_required = true AND is_active = true`
        );
        const requiredDocTypes = docTypeRes.rows;
        const requiredDocIds: string[] = requiredDocTypes.map(r => r.id);

        // Step 1: aggregate reminder counts per case for this officer (non-closed only)
        const casesRes = await client.query<PendingDocThresholdRow>(
            `SELECT
                a.id::text AS application_id,
                a.case_number,
                a.subsidy_subtype,
                u.name_enc,
                u.name_iv,
                COUNT(nl.id)::int AS reminder_count,
                MAX(nl.sent_at) AS last_reminder_at
             FROM applications a
             LEFT JOIN users u ON u.id = a.applicant_id
             INNER JOIN notification_logs nl
                ON nl.application_id = a.id
                AND nl.is_pending_doc_reminder = TRUE
                AND nl.status = 'sent'
             WHERE a.officer_id = $1
               AND a.status NOT IN ('2', '4')
             GROUP BY a.id, a.case_number, a.subsidy_subtype, u.name_enc, u.name_iv
             HAVING COUNT(nl.id) >= $2
             ORDER BY MAX(nl.sent_at) DESC`,
            [officerId, threshold]
        );

        if (casesRes.rows.length === 0) {
            return { success: true, data: [] };
        }

        const appIds = casesRes.rows.map(r => r.application_id);

        // Step 2: missing-doc counts (only if there are required docs configured)
        const missingMap = new Map<string, number>();
        if (requiredDocIds.length > 0) {
            const docsRes = await client.query(
                `SELECT application_id::text, id::text AS doc_id, status
                 FROM application_documents
                 WHERE application_id = ANY($1::bigint[])
                   AND id = ANY($2::smallint[])`,
                [appIds, requiredDocIds]
            );
            const docMap = new Map<string, Map<string, string>>();
            for (const row of docsRes.rows) {
                if (!docMap.has(row.application_id)) docMap.set(row.application_id, new Map());
                docMap.get(row.application_id)!.set(row.doc_id, row.status);
            }
            for (const row of casesRes.rows) {
                const appDocs = docMap.get(row.application_id);
                let missing = 0;
                const applicableDocIds = requiredDocTypes
                    .filter(doc => !doc.subsidy_subtype || doc.subsidy_subtype === row.subsidy_subtype)
                    .map(doc => doc.id);
                for (const docId of applicableDocIds) {
                    const status = appDocs?.get(docId);
                    if (!status || status === '0' || status === '2') missing++;
                }
                missingMap.set(row.application_id, missing);
            }
        }

        const alerts: PendingDocThresholdAlert[] = casesRes.rows.map((row) => {
            const applicantName =
                row.name_enc && row.name_iv
                    ? decryptAES(row.name_enc, row.name_iv) || '未知'
                    : '未知';
            return {
                applicationId: row.application_id,
                caseNumber: row.case_number,
                applicantName,
                reminderCount: row.reminder_count,
                threshold,
                lastReminderAt: row.last_reminder_at
                    ? new Date(row.last_reminder_at).toISOString()
                    : null,
                missingCount: missingMap.get(row.application_id) ?? 0,
            };
        });

        return { success: true, data: alerts };
    } catch (err: unknown) {
        console.error('fetchPendingDocThresholdAlerts error:', err);
        return { success: false, error: errorMessage(err) };
    } finally {
        client.release();
    }
}

/**
 * Single-application predicate: is this case currently in the pending-doc state
 * (i.e., would appear in fetchPendingDocAlerts)? Used by SendNotificationModal
 * to default the "is pending-doc reminder" checkbox.
 */
export async function isApplicationInPendingDocState(
    applicationId: string
): Promise<{ success: boolean; data?: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        const thresholdDays = parseInt(await fetchSetting('pending_doc_alert_days', '14'), 10);
        const docTypeRes = await client.query(
            `SELECT dtc.id::text
             FROM document_type_config dtc
             JOIN applications a ON a.id = $1::bigint
             WHERE dtc.phase = 'apply'
               AND dtc.is_required = true
               AND dtc.is_active = true
               AND (dtc.subsidy_subtype IS NULL OR dtc.subsidy_subtype = a.subsidy_subtype)`,
            [applicationId]
        );
        const requiredDocIds: string[] = docTypeRes.rows.map((r: { id: string }) => r.id);
        if (requiredDocIds.length === 0) return { success: true, data: false };

        const appRes = await client.query(
            `SELECT 1 AS hit
             FROM applications
             WHERE id = $1
               AND status NOT IN ('2', '4')
               AND apply_at IS NOT NULL
               AND NOW() - apply_at >= ($2 || ' days')::interval`,
            [applicationId, thresholdDays]
        );
        if (appRes.rows.length === 0) return { success: true, data: false };

        const docsRes = await client.query(
            `SELECT id::text AS doc_id, status
             FROM application_documents
             WHERE application_id = $1
               AND id = ANY($2::smallint[])`,
            [applicationId, requiredDocIds]
        );
        const statusById = new Map<string, string>();
        for (const row of docsRes.rows) statusById.set(row.doc_id, row.status);
        for (const docId of requiredDocIds) {
            const status = statusById.get(docId);
            if (!status || status === '0' || status === '2') {
                return { success: true, data: true };
            }
        }
        return { success: true, data: false };
    } catch (err: unknown) {
        console.error('isApplicationInPendingDocState error:', err);
        return { success: false, error: errorMessage(err) };
    } finally {
        client.release();
    }
}

/**
 * Per-application reminder count + threshold (for case-detail view banner).
 */
export async function fetchPendingDocReminderStatus(
    applicationId: string
): Promise<{ success: boolean; data?: { count: number; threshold: number; lastReminderAt: string | null }; error?: string }> {
    const client = await pool.connect();
    try {
        const threshold = parseInt(
            await fetchSetting('pending_doc_notification_threshold', '3'),
            10
        );
        const res = await client.query(
            `SELECT COUNT(*)::int AS cnt, MAX(sent_at) AS last_at
             FROM notification_logs
             WHERE application_id = $1
               AND is_pending_doc_reminder = TRUE
               AND status = 'sent'`,
            [applicationId]
        );
        const row = res.rows[0] ?? { cnt: 0, last_at: null };
        return {
            success: true,
            data: {
                count: row.cnt ?? 0,
                threshold,
                lastReminderAt: row.last_at ? new Date(row.last_at).toISOString() : null,
            },
        };
    } catch (err: unknown) {
        console.error('fetchPendingDocReminderStatus error:', err);
        return { success: false, error: errorMessage(err) };
    } finally {
        client.release();
    }
}
