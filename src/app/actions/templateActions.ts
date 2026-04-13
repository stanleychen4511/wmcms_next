'use server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { pool } from '../../lib/db';
import { writeAuditLog } from './auditActions';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateCategory {
    id: number;
    name: string;
    sort_order: number;
    status: 0 | 1;
    created_at: string;
}

export interface TemplateFile {
    id: number;
    display_name: string;
    description: string | null;
    category: string | null;
    category_id: number | null;
    file_name: string;
    original_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    sort_order: number;
    status: 0 | 1;
    uploaded_by: string | null;
    uploader_account: string | null;
    created_at: string;
    updated_at: string;
}

interface ActionResult {
    success: boolean;
    error?: string;
}

// ─── Allowed file types ───────────────────────────────────────────────────────

const ALLOWED_MIME = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
]);

const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']);

// ─── Category Actions ─────────────────────────────────────────────────────────

export async function fetchAllCategories(): Promise<{ success: boolean; data?: TemplateCategory[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query<TemplateCategory>(
            `SELECT id, name, sort_order, status, created_at::text
             FROM template_categories
             ORDER BY sort_order, name`
        );
        return { success: true, data: res.rows };
    } catch (err: any) {
        console.error('fetchAllCategories error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function fetchActiveCategories(): Promise<{ success: boolean; data?: TemplateCategory[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query<TemplateCategory>(
            `SELECT id, name, sort_order, status, created_at::text
             FROM template_categories
             WHERE status = 1
             ORDER BY sort_order, name`
        );
        return { success: true, data: res.rows };
    } catch (err: any) {
        console.error('fetchActiveCategories error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function addCategory(name: string, sortOrder: number, operatorUserId: string): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO template_categories (name, sort_order) VALUES ($1, $2)`,
            [name.trim(), sortOrder]
        );
        return { success: true };
    } catch (err: any) {
        console.error('addCategory error:', err);
        if (err.code === '23505') return { success: false, error: '已有相同名稱的分類。' };
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function updateCategory(id: number, name: string, sortOrder: number, operatorUserId: string): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE template_categories SET name = $1, sort_order = $2 WHERE id = $3`,
            [name.trim(), sortOrder, id]
        );
        return { success: true };
    } catch (err: any) {
        console.error('updateCategory error:', err);
        if (err.code === '23505') return { success: false, error: '已有相同名稱的分類。' };
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function toggleCategoryStatus(id: number, newStatus: 0 | 1, operatorUserId: string): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        if (newStatus === 0) {
            // Check if any active template uses this category
            const check = await client.query(
                `SELECT COUNT(*) AS cnt FROM template_files
                 WHERE category_id = $1 AND status = 1`,
                [id]
            );
            if (parseInt(check.rows[0].cnt, 10) > 0) {
                return { success: false, error: '此分類下仍有啟用中的範本檔案，請先停用所有範本後再停用此分類。' };
            }
        }
        await client.query(
            `UPDATE template_categories SET status = $1 WHERE id = $2`,
            [newStatus, id]
        );
        return { success: true };
    } catch (err: any) {
        console.error('toggleCategoryStatus error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Template File Actions ────────────────────────────────────────────────────

export async function fetchAllTemplateFiles(): Promise<{ success: boolean; data?: TemplateFile[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT tf.id, tf.display_name, tf.description, tc.name AS category,
                    tf.category_id, tf.file_name, tf.original_name, tf.file_path,
                    tf.file_size, tf.mime_type, tf.sort_order, tf.status,
                    tf.uploaded_by::text, u.account AS uploader_account,
                    tf.created_at::text, tf.updated_at::text
             FROM template_files tf
             LEFT JOIN template_categories tc ON tc.id = tf.category_id
             LEFT JOIN users u ON u.id = tf.uploaded_by
             ORDER BY tc.sort_order NULLS LAST, tf.sort_order, tf.display_name`
        );
        return { success: true, data: res.rows };
    } catch (err: any) {
        console.error('fetchAllTemplateFiles error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function fetchActiveTemplateFiles(): Promise<{ success: boolean; data?: TemplateFile[]; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT tf.id, tf.display_name, tf.description, tc.name AS category,
                    tf.category_id, tf.file_name, tf.original_name, tf.file_path,
                    tf.file_size, tf.mime_type, tf.sort_order, tf.status,
                    tf.uploaded_by::text, u.account AS uploader_account,
                    tf.created_at::text, tf.updated_at::text
             FROM template_files tf
             LEFT JOIN template_categories tc ON tc.id = tf.category_id
             LEFT JOIN users u ON u.id = tf.uploaded_by
             WHERE tf.status = 1 AND (tc.status = 1 OR tf.category_id IS NULL)
             ORDER BY tc.sort_order NULLS LAST, tf.sort_order, tf.display_name`
        );
        return { success: true, data: res.rows };
    } catch (err: any) {
        console.error('fetchActiveTemplateFiles error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function uploadTemplateFile(formData: FormData, operatorUserId: string): Promise<ActionResult> {
    const file = formData.get('file') as File | null;
    const displayName = (formData.get('display_name') as string | null)?.trim();
    const description = (formData.get('description') as string | null)?.trim() || null;
    const categoryIdRaw = formData.get('category_id') as string | null;
    const categoryId = categoryIdRaw ? parseInt(categoryIdRaw, 10) : null;
    const sortOrder = parseInt((formData.get('sort_order') as string | null) ?? '1', 10);

    if (!file || !displayName) return { success: false, error: '請提供檔案與顯示名稱。' };

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return { success: false, error: `不支援的檔案格式：${ext}` };
    if (!ALLOWED_MIME.has(file.type)) return { success: false, error: `不支援的 MIME 類型：${file.type}` };

    const uuid = randomUUID();
    const storedName = `${uuid}${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'templates');
    const filePath = path.join(uploadDir, storedName);
    const publicPath = `/uploads/templates/${storedName}`;

    const client = await pool.connect();
    try {
        await fs.mkdir(uploadDir, { recursive: true });
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        const res = await client.query(
            `INSERT INTO template_files
                (display_name, description, category_id, file_name, original_name,
                 file_path, file_size, mime_type, sort_order, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid)
             RETURNING id`,
            [displayName, description, categoryId, storedName, file.name,
             publicPath, file.size, file.type, sortOrder, operatorUserId || null]
        );

        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'template.upload',
            targetType: 'template',
            targetId: String(res.rows[0].id),
            detail: { display_name: displayName, original_name: file.name, file_size: file.size },
        });

        return { success: true };
    } catch (err: any) {
        // Best-effort cleanup
        await fs.unlink(filePath).catch(() => {});
        console.error('uploadTemplateFile error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function updateTemplateFile(
    id: number,
    displayName: string,
    description: string | null,
    categoryId: number | null,
    sortOrder: number,
    operatorUserId: string
): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE template_files
             SET display_name = $1, description = $2, category_id = $3, sort_order = $4
             WHERE id = $5`,
            [displayName.trim(), description?.trim() || null, categoryId, sortOrder, id]
        );
        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'template.update',
            targetType: 'template',
            targetId: String(id),
            detail: { display_name: displayName },
        });
        return { success: true };
    } catch (err: any) {
        console.error('updateTemplateFile error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function disableTemplateFile(id: number, displayName: string, operatorUserId: string): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE template_files SET status = 0 WHERE id = $1`, [id]);
        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'template.disable',
            targetType: 'template',
            targetId: String(id),
            detail: { display_name: displayName },
        });
        return { success: true };
    } catch (err: any) {
        console.error('disableTemplateFile error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function enableTemplateFile(id: number, displayName: string, operatorUserId: string): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE template_files SET status = 1 WHERE id = $1`, [id]);
        void writeAuditLog({
            userId: operatorUserId || null,
            action: 'template.enable',
            targetType: 'template',
            targetId: String(id),
            detail: { display_name: displayName },
        });
        return { success: true };
    } catch (err: any) {
        console.error('enableTemplateFile error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/** Fetch a single template file record for download validation */
export async function getTemplateFileById(id: number): Promise<{ success: boolean; data?: TemplateFile; error?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT tf.id, tf.display_name, tf.original_name, tf.file_path,
                    tf.file_size, tf.mime_type, tf.status, tf.file_name,
                    tf.description, tc.name AS category, tf.category_id,
                    tf.sort_order, tf.uploaded_by::text, u.account AS uploader_account,
                    tf.created_at::text, tf.updated_at::text
             FROM template_files tf
             LEFT JOIN template_categories tc ON tc.id = tf.category_id
             LEFT JOIN users u ON u.id = tf.uploaded_by
             WHERE tf.id = $1`,
            [id]
        );
        if (res.rows.length === 0) return { success: false, error: '找不到此範本檔案。' };
        return { success: true, data: res.rows[0] };
    } catch (err: any) {
        console.error('getTemplateFileById error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
