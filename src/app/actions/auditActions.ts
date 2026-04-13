'use server';

import { pool } from '../../lib/db';

export type AuditAction =
    | 'application.create'
    | 'application.update'
    | 'application.stage_advance'
    | 'application.stage_rollback'
    | 'application.officer_assign'
    | 'application.close'
    | 'home_visit.create'
    | 'home_visit.update'
    | 'document.upload'
    | 'document.preview'
    | 'document.delete'
    | 'document.status_update'
    | 'user.login'
    | 'user.create'
    | 'user.update'
    | 'user.deactivate'
    | 'file_location.create'
    | 'file_location.update'
    | 'file_location.disable'
    | 'file_location.enable'
    | 'template.upload'
    | 'template.update'
    | 'template.disable'
    | 'template.enable'
    | 'template.download'
    | 'notification.send';

export type AuditTargetType =
    | 'application'
    | 'home_visit'
    | 'document'
    | 'user'
    | 'file_location'
    | 'template'
    | 'notification';

export interface WriteAuditLogParams {
    userId: string | null;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId?: string | null;
    detail?: Record<string, unknown>;
}

/**
 * Write a single audit log entry. Fire-and-forget safe — errors are logged
 * but never rethrown, so they won't break the main operation.
 */
export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, target_type, target_id, detail)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                params.userId ?? null,
                params.action,
                params.targetType,
                params.targetId ?? null,
                params.detail ? JSON.stringify(params.detail) : null,
            ]
        );
    } catch (err) {
        console.error('writeAuditLog error (non-fatal):', err);
    }
}

export interface AuditLogEntry {
    id: string;
    createdAt: string;
    userId: string | null;
    userAccount: string | null;
    userName: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    detail: Record<string, unknown> | null;
}

export interface FetchAuditLogsParams {
    targetType?: AuditTargetType;
    targetId?: string;
    userAccount?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
}

export async function fetchAuditLogs(params: FetchAuditLogsParams = {}): Promise<{
    rows: AuditLogEntry[];
    total: number;
}> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.targetType) {
        conditions.push(`al.target_type = $${idx++}`);
        values.push(params.targetType);
    }
    if (params.targetId) {
        conditions.push(`al.target_id = $${idx++}`);
        values.push(params.targetId);
    }
    if (params.userAccount) {
        conditions.push(`u.account ILIKE $${idx++}`);
        values.push(`%${params.userAccount}%`);
    }
    if (params.action) {
        conditions.push(`al.action = $${idx++}`);
        values.push(params.action);
    }
    if (params.dateFrom) {
        conditions.push(`al.created_at >= $${idx++}`);
        values.push(params.dateFrom);
    }
    if (params.dateTo) {
        conditions.push(`al.created_at < ($${idx++}::date + interval '1 day')`);
        values.push(params.dateTo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit  = params.limit  ?? 50;
    const offset = params.offset ?? 0;

    const client = await pool.connect();
    try {
        const [dataRes, countRes] = await Promise.all([
            client.query(
                `SELECT al.id, al.created_at, al.user_id, al.action, al.target_type, al.target_id, al.detail,
                        u.account as user_account, u.name_enc, u.name_iv
                 FROM audit_logs al
                 LEFT JOIN users u ON u.id = al.user_id
                 ${where}
                 ORDER BY al.created_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...values, limit, offset]
            ),
            client.query(
                `SELECT COUNT(*) AS total
                 FROM audit_logs al
                 LEFT JOIN users u ON u.id = al.user_id
                 ${where}`,
                values
            ),
        ]);

        const { decryptAES } = await import('../../lib/crypto');

        return {
            rows: dataRes.rows.map(r => ({
                id: String(r.id),
                createdAt: r.created_at instanceof Date
                    ? r.created_at.toISOString()
                    : String(r.created_at),
                userId: r.user_id ?? null,
                userAccount: r.user_account ?? null,
                userName: r.name_enc && r.name_iv
                    ? decryptAES(r.name_enc, r.name_iv) || null
                    : null,
                action: r.action,
                targetType: r.target_type,
                targetId: r.target_id ?? null,
                detail: r.detail ?? null,
            })),
            total: parseInt(countRes.rows[0].total, 10),
        };
    } catch (err) {
        console.error('fetchAuditLogs error:', err);
        return { rows: [], total: 0 };
    } finally {
        client.release();
    }
}
