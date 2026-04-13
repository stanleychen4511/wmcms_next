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

/** Ensure default system settings exist (upsert on first run). */
export async function ensureDefaultSettings(): Promise<void> {
    const defaults: { key: string; value: string; description: string }[] = [
        { key: 'pending_doc_alert_days', value: '7',      description: '收件後超過此天數且仍有必備文件未上傳的案件，將於首頁顯示未補件提示' },
        { key: 'max_apply_amount',       value: '350000', description: '每筆申請案件的申請金額上限（元）' },
    ];
    const client = await pool.connect();
    try {
        for (const d of defaults) {
            await client.query(
                `INSERT INTO system_settings (key, value, description)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (key) DO NOTHING`,
                [d.key, d.value, d.description]
            );
        }
    } catch (err) {
        console.error('ensureDefaultSettings error:', err);
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
