'use server';

import { pool } from '../../lib/db';
import { writeAuditLog } from './auditActions';

export interface SystemSetting {
    key: string;
    value: string;
    description: string | null;
    updatedAt: string;
}

/** Fetch a single setting value by key. Returns the defaultValue if not found. */
export async function fetchSetting(key: string, defaultValue = ''): Promise<string> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT value FROM system_settings WHERE key = $1 LIMIT 1`,
            [key]
        );
        return res.rows.length > 0 ? res.rows[0].value : defaultValue;
    } catch (err) {
        console.error('fetchSetting error:', err);
        return defaultValue;
    } finally {
        client.release();
    }
}

/** Fetch all settings for the admin settings panel. */
export async function fetchAllSettings(): Promise<{ success: boolean; data?: SystemSetting[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT key, value, description, updated_at FROM system_settings ORDER BY key`
        );
        const data: SystemSetting[] = res.rows.map(r => ({
            key: r.key,
            value: r.value,
            description: r.description ?? null,
            updatedAt: r.updated_at ? r.updated_at.toISOString() : '',
        }));
        return { success: true, data };
    } catch (err: any) {
        console.error('fetchAllSettings error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/** Update a setting value. Writes an audit log entry. */
export async function updateSetting(
    key: string,
    newValue: string,
    operatorUserId: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        // Read old value for audit detail
        const oldRes = await client.query(
            `SELECT value FROM system_settings WHERE key = $1`,
            [key]
        );
        const oldValue = oldRes.rows.length > 0 ? oldRes.rows[0].value : null;

        const res = await client.query(
            `UPDATE system_settings
             SET value = $1, updated_at = NOW()
             WHERE key = $2`,
            [newValue, key]
        );

        if (res.rowCount === 0) {
            return { success: false, error: `找不到參數 key: ${key}` };
        }

        void writeAuditLog({
            userId: operatorUserId,
            action: 'setting.update',
            targetType: 'setting',
            targetId: key,
            detail: { oldValue, newValue },
        });

        return { success: true };
    } catch (err: any) {
        console.error('updateSetting error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
