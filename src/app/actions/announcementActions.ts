'use server';

import { pool } from '../../lib/db';
import { fetchSetting } from './settingsActions';
import { writeAuditLog } from './auditActions';

export interface AnnouncementCategory {
    id: number;
    name: string;
    color: string;
    sort_order: number;
    is_active: boolean;
}

export interface Announcement {
    id: number;
    category_id: number | null;
    category_name: string | null;
    category_color: string | null;
    title: string;
    content: string;
    publish_date: string;   // ISO date string YYYY-MM-DD
    start_date: string;
    end_date: string | null;
    is_active: boolean;
    created_at: string;
}

/** Homepage: latest 10 active announcements within date range, newest first */
export async function fetchHomeAnnouncements(): Promise<{
    items: Announcement[];
    newDays: number;
}> {
    const client = await pool.connect();
    try {
        const newDaysStr = await fetchSetting('announcement_new_days', '7');
        const newDays = parseInt(newDaysStr, 10) || 7;

        const res = await client.query(
            `SELECT
                a.id, a.category_id, a.title, a.content,
                a.publish_date::text, a.start_date::text,
                a.end_date::text, a.is_active, a.created_at::text,
                c.name AS category_name, c.color AS category_color
             FROM announcements a
             LEFT JOIN announcement_categories c ON c.id = a.category_id
             WHERE a.is_active = true
               AND a.start_date <= CURRENT_DATE
               AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
             ORDER BY a.publish_date DESC, a.id DESC
             LIMIT 10`
        );
        return { items: res.rows, newDays };
    } finally {
        client.release();
    }
}

/** All announcements page: all active, no date-range filter, newest first */
export async function fetchAllAnnouncements(): Promise<{
    items: Announcement[];
    newDays: number;
}> {
    const client = await pool.connect();
    try {
        const newDaysStr = await fetchSetting('announcement_new_days', '7');
        const newDays = parseInt(newDaysStr, 10) || 7;

        const res = await client.query(
            `SELECT
                a.id, a.category_id, a.title, a.content,
                a.publish_date::text, a.start_date::text,
                a.end_date::text, a.is_active, a.created_at::text,
                c.name AS category_name, c.color AS category_color
             FROM announcements a
             LEFT JOIN announcement_categories c ON c.id = a.category_id
             WHERE a.is_active = true
             ORDER BY a.publish_date DESC, a.id DESC`
        );
        return { items: res.rows, newDays };
    } finally {
        client.release();
    }
}

/** Admin: fetch all announcements regardless of active/date */
export async function fetchAllAnnouncementsAdmin(): Promise<Announcement[]> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT
                a.id, a.category_id, a.title, a.content,
                a.publish_date::text, a.start_date::text,
                a.end_date::text, a.is_active, a.created_at::text,
                c.name AS category_name, c.color AS category_color
             FROM announcements a
             LEFT JOIN announcement_categories c ON c.id = a.category_id
             ORDER BY a.publish_date DESC, a.id DESC`
        );
        return res.rows;
    } finally {
        client.release();
    }
}

export async function fetchAnnouncementById(id: number): Promise<Announcement | null> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT
                a.id, a.category_id, a.title, a.content,
                a.publish_date::text, a.start_date::text,
                a.end_date::text, a.is_active, a.created_at::text,
                c.name AS category_name, c.color AS category_color
             FROM announcements a
             LEFT JOIN announcement_categories c ON c.id = a.category_id
             WHERE a.id = $1`,
            [id]
        );
        return res.rows[0] ?? null;
    } finally {
        client.release();
    }
}

export async function fetchActiveCategories(): Promise<AnnouncementCategory[]> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id, name, color, sort_order, is_active
             FROM announcement_categories
             WHERE is_active = true
             ORDER BY sort_order ASC, id ASC`
        );
        return res.rows;
    } finally {
        client.release();
    }
}

export async function fetchAllCategories(): Promise<AnnouncementCategory[]> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id, name, color, sort_order, is_active
             FROM announcement_categories
             ORDER BY sort_order ASC, id ASC`
        );
        return res.rows;
    } finally {
        client.release();
    }
}

export async function upsertAnnouncement(
    data: {
        id?: number;
        category_id?: number | null;
        title: string;
        content: string;
        publish_date: string;
        start_date: string;
        end_date?: string | null;
        is_active?: boolean;
    },
    operatorUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        if (data.id) {
            await client.query(
                `UPDATE announcements
                 SET category_id = $1, title = $2, content = $3,
                     publish_date = $4, start_date = $5, end_date = $6,
                     is_active = $7, updated_at = NOW()
                 WHERE id = $8`,
                [
                    data.category_id ?? null,
                    data.title,
                    data.content,
                    data.publish_date,
                    data.start_date,
                    data.end_date || null,
                    data.is_active ?? true,
                    data.id,
                ]
            );
        } else {
            await client.query(
                `INSERT INTO announcements
                    (category_id, title, content, publish_date, start_date, end_date, is_active, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    data.category_id ?? null,
                    data.title,
                    data.content,
                    data.publish_date,
                    data.start_date,
                    data.end_date || null,
                    data.is_active ?? true,
                    operatorUserId ?? null,
                ]
            );
        }
        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: data.id ? 'announcement.update' : 'announcement.create',
            targetType: 'announcement',
            targetId: String(data.id ?? 'new'),
            detail: { title: data.title },
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function deleteAnnouncement(
    id: number,
    operatorUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM announcements WHERE id = $1`, [id]);
        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: 'announcement.delete',
            targetType: 'announcement',
            targetId: String(id),
            detail: {},
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function upsertCategory(
    data: {
        id?: number;
        name: string;
        color: string;
        sort_order: number;
        is_active?: boolean;
    },
    operatorUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        if (data.id) {
            await client.query(
                `UPDATE announcement_categories
                 SET name = $1, color = $2, sort_order = $3, is_active = $4
                 WHERE id = $5`,
                [data.name, data.color, data.sort_order, data.is_active ?? true, data.id]
            );
        } else {
            await client.query(
                `INSERT INTO announcement_categories (name, color, sort_order, is_active)
                 VALUES ($1, $2, $3, $4)`,
                [data.name, data.color, data.sort_order, data.is_active ?? true]
            );
        }
        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: data.id ? 'announcement_category.update' : 'announcement_category.create',
            targetType: 'announcement_category',
            targetId: String(data.id ?? 'new'),
            detail: { name: data.name },
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function deleteCategory(
    id: number,
    operatorUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        // Check if any announcements use this category
        const check = await client.query(
            `SELECT COUNT(*) FROM announcements WHERE category_id = $1`, [id]
        );
        if (parseInt(check.rows[0].count) > 0) {
            return { success: false, error: '此分類仍有公告使用中，無法刪除' };
        }
        await client.query(`DELETE FROM announcement_categories WHERE id = $1`, [id]);
        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: 'announcement_category.delete',
            targetType: 'announcement_category',
            targetId: String(id),
            detail: {},
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
