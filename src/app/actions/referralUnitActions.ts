'use server';

import { pool } from '../../lib/db';
import { writeAuditLog } from './auditActions';

export interface ReferralUnit {
    id: string;            // BIGINT → string（避免 JS number 精度問題）
    name: string;
    contactInfo: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;     // ISO
    updatedAt: string;     // ISO
}

type ActionResult<T = undefined> = T extends undefined
    ? { success: boolean; error?: string }
    : { success: boolean; data?: T; error?: string };

function rowToUnit(row: any): ReferralUnit {
    return {
        id: String(row.id),
        name: row.name,
        contactInfo: row.contact_info ?? null,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
    };
}

/**
 * Active referral units only, sorted for dropdown display.
 * Used by NewApplicationPage when user selects application_way = '2'.
 */
export async function fetchActiveReferralUnits(): Promise<ActionResult<ReferralUnit[]>> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id, name, contact_info, sort_order, is_active, created_at, updated_at
             FROM referral_units
             WHERE is_active = TRUE
             ORDER BY sort_order ASC, name ASC`
        );
        return { success: true, data: res.rows.map(rowToUnit) };
    } catch (err: any) {
        console.error('fetchActiveReferralUnits error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * All referral units (including inactive). Used by the AdminPanel management tab.
 */
export async function fetchAllReferralUnits(): Promise<ActionResult<ReferralUnit[]>> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id, name, contact_info, sort_order, is_active, created_at, updated_at
             FROM referral_units
             ORDER BY sort_order ASC, name ASC`
        );
        return { success: true, data: res.rows.map(rowToUnit) };
    } catch (err: any) {
        console.error('fetchAllReferralUnits error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function createReferralUnit(
    name: string,
    contactInfo: string | null,
    sortOrder: number,
    operatorUserId: string,
): Promise<ActionResult<{ id: string }>> {
    const trimmedName = (name ?? '').trim();
    if (!trimmedName) return { success: false, error: '單位名稱為必填' };

    const client = await pool.connect();
    try {
        const res = await client.query(
            `INSERT INTO referral_units (name, contact_info, sort_order, is_active)
             VALUES ($1, $2, $3, TRUE)
             RETURNING id`,
            [trimmedName, contactInfo?.trim() || null, sortOrder | 0]
        );
        const newId = String(res.rows[0].id);

        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'referral_unit.create',
            targetType: 'referral_unit',
            targetId: newId,
            detail: { name: trimmedName, contactInfo, sortOrder },
        });

        return { success: true, data: { id: newId } };
    } catch (err: any) {
        // UNIQUE violation → 名稱重複；依 design，不自動回收既有停用單位，直接回錯
        if (err.code === '23505') {
            return { success: false, error: `單位名稱「${trimmedName}」已存在（包含停用中的單位）` };
        }
        console.error('createReferralUnit error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function updateReferralUnit(
    id: string,
    name: string,
    contactInfo: string | null,
    sortOrder: number,
    operatorUserId: string,
): Promise<ActionResult> {
    const trimmedName = (name ?? '').trim();
    if (!trimmedName) return { success: false, error: '單位名稱為必填' };

    const client = await pool.connect();
    try {
        const res = await client.query(
            `UPDATE referral_units
             SET name = $1, contact_info = $2, sort_order = $3, updated_at = NOW()
             WHERE id = $4::bigint`,
            [trimmedName, contactInfo?.trim() || null, sortOrder | 0, id]
        );
        if (res.rowCount === 0) return { success: false, error: '找不到單位' };

        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'referral_unit.update',
            targetType: 'referral_unit',
            targetId: id,
            detail: { name: trimmedName, contactInfo, sortOrder },
        });
        return { success: true };
    } catch (err: any) {
        if (err.code === '23505') {
            return { success: false, error: `單位名稱「${trimmedName}」已被其他單位使用` };
        }
        console.error('updateReferralUnit error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function toggleReferralUnitActive(
    id: string,
    isActive: boolean,
    operatorUserId: string,
): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `UPDATE referral_units
             SET is_active = $1, updated_at = NOW()
             WHERE id = $2::bigint`,
            [isActive, id]
        );
        if (res.rowCount === 0) return { success: false, error: '找不到單位' };

        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'referral_unit.toggle_active',
            targetType: 'referral_unit',
            targetId: id,
            detail: { is_active: isActive },
        });
        return { success: true };
    } catch (err: any) {
        console.error('toggleReferralUnitActive error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
