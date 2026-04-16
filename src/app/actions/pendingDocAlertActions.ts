'use server';

import { pool } from '../../lib/db';
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

/**
 * For a given case_officer, find all active admin_review cases where:
 * - apply_at is >= N days ago (N from system_settings)
 * - at least one required apply-phase document is missing (status '0' or '2', or no DB record)
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
        const docTypeRes = await client.query(
            `SELECT id::text FROM document_type_config
             WHERE phase = 'apply' AND is_required = true AND is_active = true`
        );
        const requiredDocIds: string[] = docTypeRes.rows.map((r: any) => r.id);

        if (requiredDocIds.length === 0) {
            // No required docs configured → nothing to alert
            return { success: true, data: [] };
        }

        // Step 1: fetch active admin_review cases assigned to this officer
        // Use LATERAL to get the latest workflow record's stage per case
        const casesRes = await client.query(
            `SELECT
                a.id::text AS application_id,
                a.case_number,
                a.apply_at,
                EXTRACT(DAY FROM NOW() - a.apply_at)::int AS days_since,
                u.name_enc,
                u.name_iv
             FROM applications a
             LEFT JOIN users u ON u.id = a.applicant_id
             LEFT JOIN LATERAL (
                 SELECT stage FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY reviewed_at DESC NULLS LAST, id DESC LIMIT 1
             ) w ON true
             WHERE a.officer_id = $1
               AND a.status NOT IN ('2', '4')
               AND (w.stage = 'admin_review' OR w.stage IS NULL)
               AND a.apply_at IS NOT NULL
               AND NOW() - a.apply_at >= ($2 || ' days')::interval
             ORDER BY a.apply_at ASC`,
            [officerId, thresholdDays]
        );

        if (casesRes.rows.length === 0) {
            return { success: true, data: [] };
        }

        const appIds = casesRes.rows.map((r: any) => r.application_id);

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

            for (const docId of requiredDocIds) {
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
                applyAt: row.apply_at ? new Date(row.apply_at).toISOString().split('T')[0] : '',
                daysOverdue: row.days_since ?? 0,
                missingCount,
            });
        }

        return { success: true, data: alerts };
    } catch (err: any) {
        console.error('fetchPendingDocAlerts error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
