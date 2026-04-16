'use server';

import { pool } from '../../lib/db';
import { uploadFile } from '../../lib/storage';
import { writeAuditLog } from './auditActions';
import path from 'path';

export interface Banner {
    id: number;
    title: string | null;
    subtitle: string | null;
    image_url: string;
    link_url: string | null;
    sort_order: number;
    is_active: boolean;
}

export async function fetchActiveBanners(): Promise<Banner[]> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id, title, subtitle, image_url, link_url, sort_order, is_active
             FROM banners
             WHERE is_active = true
             ORDER BY sort_order ASC, id ASC`
        );
        return res.rows;
    } finally {
        client.release();
    }
}

export async function fetchAllBanners(): Promise<Banner[]> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id, title, subtitle, image_url, link_url, sort_order, is_active
             FROM banners
             ORDER BY sort_order ASC, id ASC`
        );
        return res.rows;
    } finally {
        client.release();
    }
}

export async function upsertBanner(
    data: {
        id?: number;
        title?: string | null;
        subtitle?: string | null;
        link_url?: string | null;
        sort_order?: number;
        is_active?: boolean;
    },
    formData?: FormData,
    operatorUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        let imageUrl: string | undefined;

        // Handle image upload if a file was provided
        if (formData) {
            const file = formData.get('image') as File | null;
            if (file && file.size > 0) {
                const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                const ext = path.extname(file.name).toLowerCase();
                if (!ALLOWED_EXTS.includes(ext) || !ALLOWED_MIME.includes(file.type)) {
                    return { success: false, error: '僅接受圖片檔案（.jpg、.png、.gif、.webp）' };
                }
                const timestamp = Date.now();
                const blobKey = `banners/banner_${timestamp}${ext}`;
                const localRelPath = `/uploads/banners/banner_${timestamp}${ext}`;
                const bytes = await file.arrayBuffer();
                imageUrl = await uploadFile(Buffer.from(bytes), blobKey, localRelPath);
            }
        }

        if (data.id) {
            // Update
            const fields: string[] = ['updated_at = NOW()'];
            const values: any[] = [];
            let i = 1;
            if (imageUrl !== undefined)       { fields.push(`image_url = $${i++}`);   values.push(imageUrl); }
            if (data.title !== undefined)     { fields.push(`title = $${i++}`);       values.push(data.title || null); }
            if (data.subtitle !== undefined)  { fields.push(`subtitle = $${i++}`);    values.push(data.subtitle || null); }
            if (data.link_url !== undefined)  { fields.push(`link_url = $${i++}`);    values.push(data.link_url || null); }
            if (data.sort_order !== undefined){ fields.push(`sort_order = $${i++}`);  values.push(data.sort_order); }
            if (data.is_active !== undefined) { fields.push(`is_active = $${i++}`);   values.push(data.is_active); }
            values.push(data.id);
            await client.query(
                `UPDATE banners SET ${fields.join(', ')} WHERE id = $${i}`,
                values
            );
        } else {
            // Insert — image is required for new banners
            if (!imageUrl) return { success: false, error: '新增 Banner 時必須上傳圖片' };
            await client.query(
                `INSERT INTO banners (title, subtitle, image_url, link_url, sort_order, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    data.title || null,
                    data.subtitle || null,
                    imageUrl,
                    data.link_url || null,
                    data.sort_order ?? 0,
                    data.is_active ?? true,
                ]
            );
        }

        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: data.id ? 'banner.update' : 'banner.create',
            targetType: 'banner',
            targetId: String(data.id ?? 'new'),
            detail: { title: data.title, link_url: data.link_url },
        });

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function deleteBanner(
    id: number,
    operatorUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM banners WHERE id = $1`, [id]);
        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: 'banner.delete',
            targetType: 'banner',
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

export async function toggleBannerActive(
    id: number,
    is_active: boolean,
    operatorUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE banners SET is_active = $1, updated_at = NOW() WHERE id = $2`,
            [is_active, id]
        );
        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: 'banner.toggle',
            targetType: 'banner',
            targetId: String(id),
            detail: { is_active },
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function updateBannerOrder(
    items: { id: number; sort_order: number }[],
    operatorUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const { id, sort_order } of items) {
            await client.query(
                `UPDATE banners SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
                [sort_order, id]
            );
        }
        await client.query('COMMIT');
        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: 'banner.reorder',
            targetType: 'banner',
            targetId: 'bulk',
            detail: { items },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
