'use server';

/**
 * 來電紀錄「聯絡方式類別」選項（WMCMS-1 #75）
 *
 * 表：contact_channel_options
 * - 讀取：任何登入者（來電紀錄表單下拉、報表）
 * - 新增／修改／停用：僅 admin（後台「聯絡方式類別」頁）
 * 停用而非刪除：已使用的類別需保留在歷史紀錄與統計中。
 */

import { pool } from '../../lib/db';
import { writeAuditLog } from './auditActions';

export interface ContactChannelOption {
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
}

type ActionResult<T = undefined> = T extends undefined
    ? { success: boolean; error?: string }
    : { success: boolean; data?: T; error?: string };

function rowToOption(row: any): ContactChannelOption {
    return {
        id: String(row.id),
        name: row.name,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active === true,
    };
}

async function isAdmin(operatorUserId: string): Promise<boolean> {
    if (!/^\d+$/.test(operatorUserId ?? '')) return false;
    const res = await pool.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint AND r.code = 'admin' LIMIT 1`,
        [operatorUserId]
    );
    return (res.rowCount ?? 0) > 0;
}

/** 下拉選單與後台清單用；activeOnly=false 時包含停用選項 */
export async function fetchContactChannelOptions(activeOnly = true): Promise<ActionResult<ContactChannelOption[]>> {
    try {
        const res = await pool.query(
            `SELECT id, name, sort_order, is_active
             FROM contact_channel_options
             ${activeOnly ? 'WHERE is_active = TRUE' : ''}
             ORDER BY sort_order ASC, id ASC`
        );
        return { success: true, data: res.rows.map(rowToOption) };
    } catch (err: any) {
        console.error('fetchContactChannelOptions error:', err);
        return { success: false, error: err.message };
    }
}

export async function createContactChannelOption(
    operatorUserId: string,
    name: string,
    sortOrder: number,
): Promise<ActionResult<{ id: string }>> {
    if (!(await isAdmin(operatorUserId))) return { success: false, error: '僅系統管理員可管理聯絡方式類別' };
    const trimmed = (name ?? '').trim();
    if (!trimmed) return { success: false, error: '類別名稱為必填' };
    if (trimmed.length > 30) return { success: false, error: '類別名稱不可超過 30 字' };
    try {
        const res = await pool.query(
            `INSERT INTO contact_channel_options (name, sort_order) VALUES ($1, $2) RETURNING id`,
            [trimmed, sortOrder | 0]
        );
        const id = String(res.rows[0].id);
        void writeAuditLog({
            userId: operatorUserId,
            action: 'contact_channel.create',
            targetType: 'contact_channel',
            targetId: id,
            detail: { name: trimmed, sortOrder },
        });
        return { success: true, data: { id } };
    } catch (err: any) {
        if (err.code === '23505') return { success: false, error: `類別「${trimmed}」已存在（包含停用中的類別）` };
        console.error('createContactChannelOption error:', err);
        return { success: false, error: err.message };
    }
}

export async function updateContactChannelOption(
    operatorUserId: string,
    id: string,
    name: string,
    sortOrder: number,
): Promise<ActionResult> {
    if (!(await isAdmin(operatorUserId))) return { success: false, error: '僅系統管理員可管理聯絡方式類別' };
    if (!/^\d+$/.test(id)) return { success: false, error: '無效的類別 ID' };
    const trimmed = (name ?? '').trim();
    if (!trimmed) return { success: false, error: '類別名稱為必填' };
    if (trimmed.length > 30) return { success: false, error: '類別名稱不可超過 30 字' };
    try {
        const res = await pool.query(
            `UPDATE contact_channel_options
             SET name = $1, sort_order = $2, updated_at = NOW()
             WHERE id = $3::bigint`,
            [trimmed, sortOrder | 0, id]
        );
        if (res.rowCount === 0) return { success: false, error: '找不到類別' };
        void writeAuditLog({
            userId: operatorUserId,
            action: 'contact_channel.update',
            targetType: 'contact_channel',
            targetId: id,
            detail: { name: trimmed, sortOrder },
        });
        return { success: true };
    } catch (err: any) {
        if (err.code === '23505') return { success: false, error: `類別「${trimmed}」已被其他類別使用` };
        console.error('updateContactChannelOption error:', err);
        return { success: false, error: err.message };
    }
}

export async function toggleContactChannelOptionActive(
    operatorUserId: string,
    id: string,
    isActive: boolean,
): Promise<ActionResult> {
    if (!(await isAdmin(operatorUserId))) return { success: false, error: '僅系統管理員可管理聯絡方式類別' };
    if (!/^\d+$/.test(id)) return { success: false, error: '無效的類別 ID' };
    try {
        const res = await pool.query(
            `UPDATE contact_channel_options SET is_active = $1, updated_at = NOW() WHERE id = $2::bigint`,
            [isActive, id]
        );
        if (res.rowCount === 0) return { success: false, error: '找不到類別' };
        void writeAuditLog({
            userId: operatorUserId,
            action: 'contact_channel.toggle_active',
            targetType: 'contact_channel',
            targetId: id,
            detail: { is_active: isActive },
        });
        return { success: true };
    } catch (err: any) {
        console.error('toggleContactChannelOptionActive error:', err);
        return { success: false, error: err.message };
    }
}
