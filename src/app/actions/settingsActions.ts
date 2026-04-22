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
        { key: 'pending_doc_notification_threshold', value: '3', description: '同案件累計發送幾次未補件提醒後，於 UI 提示承辦人考慮以不通過結案' },
        { key: 'board_auto_assign',      value: 'false',  description: '董事審核階段自動派案開關（true/false）：true 時案件進 board_review 自動派給當前案件最少、priority 最小的組別' },
        { key: 'line_official_account_id', value: '',     description: 'LINE 官方帳號 ID（@xxxxxx 格式）；使用者個人設定頁的「加好友」連結會用此值組成 https://line.me/R/ti/p/{@id}' },
        { key: 'notification_dispatcher_enabled', value: 'false', description: '事件通知派送總開關（true/false）：開啟後事件觸發時才會發送 Email/LINE 通知；關閉時事件仍發生但不通知（不影響業務）' },
        { key: 'max_apply_amount',       value: '350000', description: '每筆申請案件的申請金額上限（元）' },
        // 組織基本資料（核銷階段列印的領款收據 header）
        { key: 'org_full_name',       value: '財團法人萬美基金會',                          description: '基金會全名（列印 header）' },
        { key: 'org_license_no',      value: '衛部醫字第 1121668099 號',                     description: '主管機關核准立案字號' },
        { key: 'org_registration_no', value: '113 證他字第 000974 號',                        description: '法人登記證字號' },
        { key: 'org_uniform_no',      value: '93155400',                                     description: '統一編號' },
        { key: 'org_address',         value: '106005 台北市大安區金山南路二段 165 號 4 樓',  description: '登記住址' },
        { key: 'org_phone',           value: '(02) 2321-2777',                               description: '聯絡電話' },
        { key: 'org_fax',             value: '(02) 2321-3828',                               description: '傳真' },
        { key: 'org_line_qr_url',     value: '/org-line-qr.png',                             description: 'LINE 加入志工 QR code 圖片路徑（相對於 public/，或外部 URL）' },
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
