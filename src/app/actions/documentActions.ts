'use server';

import { pool } from '../../lib/db';
import path from 'path';
import { writeAuditLog } from './auditActions';
import { uploadFile } from '../../lib/storage';

/**
 * Count pages in a file buffer by extension.
 * - .pdf  → exact page count via pdf-lib
 * - .docx → approximate section count via mammoth XML parse
 * - .doc  → null (cannot reliably parse)
 * - images → 1
 */
async function countPages(buffer: Buffer, ext: string): Promise<number | null> {
    try {
        if (ext === '.pdf') {
            const { PDFDocument } = await import('pdf-lib');
            const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
            return doc.getPageCount();
        }
        if (ext === '.docx') {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            // Count form-feed characters or estimate by paragraph breaks
            // mammoth doesn't expose page count; use section breaks as proxy
            // fallback: count every ~3000 chars as a page (rough estimate)
            const text = result.value || '';
            return Math.max(1, Math.ceil(text.length / 3000));
        }
        if (ext === '.doc') {
            return null; // Cannot reliably parse legacy .doc
        }
        // Images: jpg, jpeg, png
        return 1;
    } catch {
        return null;
    }
}

export interface DocumentEntry {
    id: string; // The file type identifier (doc sequence number per spec)
    label: string; // Display name
    status: '0' | '1' | '2'; // 0=待上傳/未符合, 1=符合, 2=逾期
    fileUrl?: string; // the database file_path
    rejectReason?: string;
    uploadedAt?: string;
    isRequired: boolean;
    /** 是否可延後補件：true 表示收件當下未上傳也能進入家訪階段，但送董事審核前須齊全 */
    allowSupplement: boolean;
    phase?: string; // 'apply' | 'reimbursement'
    storageLocationPath?: string | null;
}

export interface DocumentTypeConfig {
    id: number;
    label: string;
    phase: string;
    is_required: boolean;
    allow_supplement: boolean;
    storage_location_id: number | null;
    storage_location_path: string | null;
    sort_order: number;
    is_active: boolean;
    scope: 'C' | 'D';
}

export async function fetchDocumentTypeConfigs(): Promise<DocumentTypeConfig[]> {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            WITH RECURSIVE loc_path AS (
                SELECT id, location_name, parent_id,
                       location_name::text AS full_path
                FROM file_storage_location WHERE parent_id IS NULL
                UNION ALL
                SELECT l.id, l.location_name, l.parent_id,
                       lp.full_path || ' / ' || l.location_name
                FROM file_storage_location l JOIN loc_path lp ON l.parent_id = lp.id
            )
            SELECT d.id, d.label, d.phase, d.is_required, d.allow_supplement,
                   d.storage_location_id, d.sort_order, d.is_active, d.scope,
                   lp.full_path AS storage_location_path
            FROM document_type_config d
            LEFT JOIN loc_path lp ON lp.id = d.storage_location_id
            ORDER BY d.phase, d.sort_order, d.id
        `);
        return res.rows;
    } finally {
        client.release();
    }
}

export async function updateDocumentTypeConfig(
    id: number,
    data: {
        label?: string;
        phase?: string;
        is_required?: boolean;
        allow_supplement?: boolean;
        storage_location_id?: number | null;
        sort_order?: number;
        is_active?: boolean;
    }
): Promise<{ success: boolean; error?: string }> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (data.label !== undefined)               { fields.push(`label = $${i++}`);               values.push(data.label); }
    if (data.phase !== undefined)               { fields.push(`phase = $${i++}`);               values.push(data.phase); }
    if (data.is_required !== undefined)         { fields.push(`is_required = $${i++}`);         values.push(data.is_required); }
    if (data.allow_supplement !== undefined)    { fields.push(`allow_supplement = $${i++}`);    values.push(data.allow_supplement); }
    if (data.storage_location_id !== undefined) { fields.push(`storage_location_id = $${i++}`); values.push(data.storage_location_id); }
    if (data.sort_order !== undefined)          { fields.push(`sort_order = $${i++}`);          values.push(data.sort_order); }
    if (data.is_active !== undefined)           { fields.push(`is_active = $${i++}`);           values.push(data.is_active); }
    if (fields.length === 0) return { success: true };
    values.push(id);
    const client = await pool.connect();
    try {
        await client.query(`UPDATE document_type_config SET ${fields.join(', ')} WHERE id = $${i}`, values);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Generates a timestamp string in the format: YYYYMMDDHHmmss
 */
function formatTimestamp(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join('');
}

/**
 * Sanitizes a string for use in a filename by replacing characters
 * that are invalid or problematic in filenames.
 */
function sanitizeForFilename(str: string): string {
    return str.replace(/[\/\\:*?"<>|\s]+/g, '_');
}

/**
 * 依 disbursementId 與 document_type_config.scope 守門：
 *   scope='C' → disbursementId 必須為 null/undefined（case-level）
 *   scope='D' → disbursementId 必須非 null（disbursement-level），且依文件類型強制角色 + review_stage：
 *     id=18 領款收據：case_officer + review_stage='1'
 *     id=17 醫療收據：accountant + review_stage='3'
 *
 * 若 disbursementId 提供 → 需傳入 operatorUserId 以做角色檢查。
 */
async function checkDocumentScopeAndRole(
    client: any,
    documentId: string,
    disbursementId: string | null | undefined,
    operatorUserId: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
    const cfgRes = await client.query(
        `SELECT scope FROM document_type_config WHERE id = $1`,
        [documentId]
    );
    if (cfgRes.rows.length === 0) {
        return { ok: false, error: `未知文件類型 id=${documentId}` };
    }
    const scope: 'C' | 'D' = cfgRes.rows[0].scope;
    const hasDisb = disbursementId !== null && disbursementId !== undefined && disbursementId !== '';
    if (scope === 'C' && hasDisb) {
        return { ok: false, error: 'case-level 文件不可帶 disbursementId' };
    }
    if (scope === 'D' && !hasDisb) {
        return { ok: false, error: 'disbursement-level 文件需提供 disbursementId' };
    }
    if (scope === 'C') return { ok: true };

    // scope='D'：必須有 operator + 取得撥款的 review_stage
    if (!operatorUserId) {
        return { ok: false, error: '上傳 disbursement-level 文件需要 operatorUserId' };
    }
    const disbRes = await client.query(
        `SELECT review_stage FROM payment_disbursements WHERE id = $1`,
        [disbursementId]
    );
    if (disbRes.rows.length === 0) {
        return { ok: false, error: '撥款不存在' };
    }
    const stage: string = disbRes.rows[0].review_stage;

    const rolesRes = await client.query(
        `SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
        [operatorUserId]
    );
    const roles = new Set(rolesRes.rows.map((r: any) => r.code));

    // 領款收據（id=18）：個管階段
    if (Number(documentId) === 18) {
        if (!roles.has('case_officer')) return { ok: false, error: '只有個管師可上傳領款收據' };
        if (stage !== '1') return { ok: false, error: '僅個管階段（review_stage=1）可上傳領款收據' };
    }
    // 醫療收據（id=17）：會計階段
    if (Number(documentId) === 17) {
        if (!roles.has('accountant')) return { ok: false, error: '只有會計可上傳醫療收據' };
        if (stage !== '3') return { ok: false, error: '僅會計階段（review_stage=3）可上傳醫療收據' };
    }
    return { ok: true };
}

/** 撥款相關文件（醫療收據/領款收據）僅接受可合併列印的格式（PDF / 圖片） */
const DISBURSEMENT_DOC_EXTS = ['.pdf', '.jpg', '.jpeg', '.png'];
function isDisbursementReceiptType(documentId: string): boolean {
    const n = Number(documentId);
    return n === 17 || n === 18;
}

export async function uploadApplicationDocument(
    applicationId: string,
    documentId: string,    // e.g. '1', '2', ... (matches application_documents.id SMALLINT)
    documentLabel: string, // e.g. '自費醫療補助申請書'
    caseNumber: string,    // e.g. 'A115003'
    formData: FormData,
    uploaderAccount?: string,
    options?: {
        disbursementId?: string | null;   // scope='D' 文件必填
        operatorUserId?: string | null;   // scope='D' 文件必填（用來檢查角色）
    }
): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const file = formData.get('file') as File;
    if (!file) return { success: false, error: '未提供檔案' };

    const ALLOWED_EXTS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ALLOWED_MIME = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
    ];
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext) || !ALLOWED_MIME.includes(file.type)) {
        return { success: false, error: '僅接受 PDF、Word 或圖片檔案（.pdf、.doc、.docx、.jpg、.png）' };
    }

    // 撥款相關文件（醫療收據 / 領款收據）必須是 PDF 或圖片，否則合併列印無法處理
    if (isDisbursementReceiptType(documentId) && !DISBURSEMENT_DOC_EXTS.includes(ext)) {
        return { success: false, error: '醫療收據／領款收據僅接受 PDF 或圖片（不支援 .doc / .docx，請先轉檔）' };
    }

    const disbursementId = options?.disbursementId ?? null;
    const operatorUserId = options?.operatorUserId ?? null;

    try {
        // scope + 角色 + review_stage 守門（先做，避免不合法上傳浪費 blob 寫入）
        if (/^\d+$/.test(applicationId)) {
            const client = await pool.connect();
            try {
                const check = await checkDocumentScopeAndRole(
                    client, documentId, disbursementId, operatorUserId
                );
                if (!check.ok) return { success: false, error: check.error };
            } finally {
                client.release();
            }
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const safeLabel = sanitizeForFilename(documentLabel);
        const timestamp = formatTimestamp(new Date());
        const disbSuffix = disbursementId ? `_disb${disbursementId}` : '';
        const fileName = `${caseNumber}_${safeLabel}${disbSuffix}_${timestamp}${ext}`;
        const localRelPath = `/uploads/${applicationId}/${fileName}`;
        const blobKey = `uploads/${applicationId}/${fileName}`;

        const publicUrl = await uploadFile(buffer, blobKey, localRelPath);

        // Count pages after upload
        const pages = await countPages(buffer, ext);

        // Only write to DB for real DB-backed applications (numeric IDs)
        if (/^\d+$/.test(applicationId)) {
            const client = await pool.connect();
            try {
                if (disbursementId) {
                    // disbursement-level：upsert by (application_id, id, disbursement_id) 部分唯一索引
                    await client.query(
                        `INSERT INTO application_documents (application_id, id, disbursement_id, file_path, status, uploaded_at, pages)
                         VALUES ($1, $2, $3, $4, '0', NOW(), $5)
                         ON CONFLICT (application_id, id, disbursement_id) WHERE disbursement_id IS NOT NULL
                         DO UPDATE SET file_path = EXCLUDED.file_path, status = '0', uploaded_at = NOW(), pages = EXCLUDED.pages`,
                        [applicationId, documentId, disbursementId, publicUrl, pages]
                    );
                } else {
                    // case-level：原行為，但 ON CONFLICT 針對 partial unique index
                    await client.query(
                        `INSERT INTO application_documents (application_id, id, file_path, status, uploaded_at, pages)
                         VALUES ($1, $2, $3, '0', NOW(), $4)
                         ON CONFLICT (application_id, id) WHERE disbursement_id IS NULL
                         DO UPDATE SET file_path = EXCLUDED.file_path, status = '0', uploaded_at = NOW(), pages = EXCLUDED.pages`,
                        [applicationId, documentId, publicUrl, pages]
                    );
                }
            } finally {
                client.release();
            }
        }

        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: 'document.upload',
            targetType: 'document',
            targetId: documentId,
            detail: { applicationId, documentLabel, filePath: publicUrl, disbursementId: disbursementId ?? undefined },
        });
        return { success: true, filePath: publicUrl };
    } catch (err: any) {
        console.error('File upload error', err);
        return { success: false, error: '檔案上傳失敗' };
    }
}

/**
 * 連結 client 已直接上傳到 Vercel Blob 的檔案（不再經過 server function 上傳）。
 *
 * 用途：避開 Vercel function payload 4.5 MB 上限。Browser 用
 *       `@vercel/blob/client` `upload()` 直接 PUT 到 Blob 拿到 URL，
 *       再呼叫此 action 寫入 application_documents。
 *
 * 守門：
 *   - URL 必須是 vercel-storage.com domain（防偽）
 *   - 套用既有的 scope + 角色 + review_stage 守門
 *   - 寫 audit log
 *
 * 不做：page count（client 直接上傳沒 buffer；如需可 server fetch URL 但耗資源）
 *      → 後續報表若需頁數可 lazy-compute
 */
export async function linkApplicationDocumentByUrl(
    applicationId: string,
    documentId: string,
    documentLabel: string,
    blobUrl: string,
    originalName: string,
    mimeType: string,
    options?: {
        disbursementId?: string | null;
        operatorUserId?: string | null;
    }
): Promise<{ success: boolean; filePath?: string; error?: string }> {
    // URL 防偽：
    //   - production：必須是 Vercel Blob 公開 URL（https://*.public.blob.vercel-storage.com/...）
    //   - 本地 dev：允許 /uploads/... 相對路徑（由 /api/local-upload 寫到 public/）
    const isValidUrl = (u: string): boolean => {
        if (u.startsWith('/uploads/')) return true;  // local dev
        try {
            const url = new URL(u);
            return url.protocol === 'https:'
                && (url.hostname.endsWith('.public.blob.vercel-storage.com')
                    || url.hostname.endsWith('.blob.vercel-storage.com'));
        } catch {
            return false;
        }
    };
    if (!isValidUrl(blobUrl)) {
        return { success: false, error: '無效的檔案 URL' };
    }

    // 副檔名 + MIME 白名單（同 uploadApplicationDocument）
    const ALLOWED_EXTS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'];
    const ALLOWED_MIME = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/webp',
    ];
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext) || !ALLOWED_MIME.includes(mimeType)) {
        return { success: false, error: '僅接受 PDF、Word 或圖片檔案（.pdf、.doc、.docx、.jpg、.png）' };
    }
    if (isDisbursementReceiptType(documentId) && !DISBURSEMENT_DOC_EXTS.includes(ext)) {
        return { success: false, error: '醫療收據／領款收據僅接受 PDF 或圖片（不支援 .doc / .docx，請先轉檔）' };
    }

    const disbursementId = options?.disbursementId ?? null;
    const operatorUserId = options?.operatorUserId ?? null;

    try {
        // scope + 角色 + review_stage 守門
        if (/^\d+$/.test(applicationId)) {
            const client = await pool.connect();
            try {
                const check = await checkDocumentScopeAndRole(
                    client, documentId, disbursementId, operatorUserId
                );
                if (!check.ok) return { success: false, error: check.error };
            } finally {
                client.release();
            }

            // 寫入 application_documents（pages 設 NULL；client 上傳路徑不算頁數）
            const writeClient = await pool.connect();
            try {
                if (disbursementId) {
                    await writeClient.query(
                        `INSERT INTO application_documents (application_id, id, disbursement_id, file_path, status, uploaded_at, pages)
                         VALUES ($1, $2, $3, $4, '0', NOW(), NULL)
                         ON CONFLICT (application_id, id, disbursement_id) WHERE disbursement_id IS NOT NULL
                         DO UPDATE SET file_path = EXCLUDED.file_path, status = '0', uploaded_at = NOW(), pages = NULL`,
                        [applicationId, documentId, disbursementId, blobUrl]
                    );
                } else {
                    await writeClient.query(
                        `INSERT INTO application_documents (application_id, id, file_path, status, uploaded_at, pages)
                         VALUES ($1, $2, $3, '0', NOW(), NULL)
                         ON CONFLICT (application_id, id) WHERE disbursement_id IS NULL
                         DO UPDATE SET file_path = EXCLUDED.file_path, status = '0', uploaded_at = NOW(), pages = NULL`,
                        [applicationId, documentId, blobUrl]
                    );
                }
            } finally {
                writeClient.release();
            }
        }

        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: 'document.upload',
            targetType: 'document',
            targetId: documentId,
            detail: { applicationId, documentLabel, filePath: blobUrl, disbursementId: disbursementId ?? undefined, viaClientUpload: true },
        });
        return { success: true, filePath: blobUrl };
    } catch (err: any) {
        console.error('linkApplicationDocumentByUrl error', err);
        return { success: false, error: '檔案連結失敗' };
    }
}

export async function updateDocumentStatus(
    applicationId: string,
    documentId: string,
    status: '0' | '1' | '2', // 0=待上傳/未符合, 1=符合, 2=逾期
    rejectReason?: string,
    reviewerAccount?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        // Upsert logic for status change
        // 此 action 僅用於 case-level 文件審核（disbursement_id IS NULL）
        const existRes = await client.query(
            `SELECT 1 FROM application_documents WHERE application_id = $1 AND id = $2 AND disbursement_id IS NULL`,
            [applicationId, documentId]
        );

        if (existRes.rows.length > 0) {
            await client.query(
                `UPDATE application_documents SET status = $1, reject_reason = $2
                 WHERE application_id = $3 AND id = $4 AND disbursement_id IS NULL`,
                [status, rejectReason || null, applicationId, documentId]
            );
        } else {
            await client.query(
                `INSERT INTO application_documents (application_id, id, status, reject_reason) VALUES ($1, $2, $3, $4)`,
                [applicationId, documentId, status, rejectReason || null]
            );
        }
        void writeAuditLog({
            userId: null,
            action: 'document.status_update',
            targetType: 'document',
            targetId: documentId,
            detail: { applicationId, status, rejectReason },
        });
        return { success: true };
    } catch (err: any) {
        console.error('Update doc status error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function fetchApplicationDocuments(applicationId: string): Promise<DocumentEntry[]> {
    // Reject mock store IDs (e.g. 'app-010-a') which are not valid bigints
    if (!/^\d+$/.test(applicationId)) return [];

    const client = await pool.connect();
    try {
        // Load document type config from DB (with storage location path)
        const configRes = await client.query(`
            WITH RECURSIVE loc_path AS (
                SELECT id, location_name, parent_id,
                       location_name::text AS full_path
                FROM file_storage_location WHERE parent_id IS NULL
                UNION ALL
                SELECT l.id, l.location_name, l.parent_id,
                       lp.full_path || ' / ' || l.location_name
                FROM file_storage_location l JOIN loc_path lp ON l.parent_id = lp.id
            )
            SELECT d.id::text, d.label, d.phase, d.is_required, d.allow_supplement, d.sort_order,
                   lp.full_path AS storage_location_path
            FROM document_type_config d
            LEFT JOIN loc_path lp ON lp.id = d.storage_location_id
            WHERE d.is_active = true AND d.scope = 'C'
            ORDER BY d.phase, d.sort_order, d.id
        `);

        const docTypes = configRes.rows as {
            id: string; label: string; phase: string;
            is_required: boolean; allow_supplement: boolean;
            storage_location_path: string | null;
        }[];

        // 僅取 case-level 文件（scope='C'，即 disbursement_id IS NULL）
        // disbursement-level 文件（醫療收據、領款收據）由 DisbursementPanel 顯示
        const uploadRes = await client.query(
            `SELECT id::text, file_path, status, reject_reason, uploaded_at
             FROM application_documents
             WHERE application_id = $1 AND disbursement_id IS NULL`,
            [applicationId]
        );

        const dbRecords = new Map(uploadRes.rows.map((r: any) => [String(r.id), r]));

        return docTypes.map(doc => {
            const row = dbRecords.get(doc.id);
            if (row) {
                return {
                    id: doc.id,
                    label: doc.label,
                    status: (row.status ?? '0') as '0' | '1' | '2',
                    fileUrl: row.file_path,
                    rejectReason: row.reject_reason,
                    uploadedAt: row.uploaded_at ? row.uploaded_at.toISOString() : undefined,
                    isRequired: doc.is_required,
                    allowSupplement: doc.allow_supplement,
                    phase: doc.phase,
                    storageLocationPath: doc.storage_location_path,
                };
            }
            return {
                id: doc.id,
                label: doc.label,
                status: '0' as const,
                isRequired: doc.is_required,
                allowSupplement: doc.allow_supplement,
                phase: doc.phase,
                storageLocationPath: doc.storage_location_path,
            };
        });

    } finally {
        client.release();
    }
}

export interface HistoricalReceipt {
    caseNumber: string;
    docId: string;
    docLabel: string;
    fileUrl: string;
    uploadedAt?: string;
}

export async function fetchHistoricalReceipts(applicantId: string): Promise<HistoricalReceipt[]> {
    if (!/^\S+$/.test(applicantId)) return [];
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT a.case_number, d.id::text AS doc_id, d.file_path, d.uploaded_at
             FROM applications a
             JOIN application_documents d ON d.application_id = a.id
             WHERE a.applicant_id = $1
               AND a.status = '4'
               AND d.id IN (13, 17)
               AND d.file_path IS NOT NULL
             ORDER BY a.apply_at ASC, d.id ASC`,
            [applicantId]
        );
        return res.rows.map((r: any) => ({
            caseNumber: r.case_number,
            docId: r.doc_id,
            docLabel: r.doc_id === '13' ? '醫療單據（申請前）' : '醫療收據（核銷）',
            fileUrl: r.file_path,
            uploadedAt: r.uploaded_at ? new Date(r.uploaded_at).toISOString() : undefined,
        }));
    } finally {
        client.release();
    }
}

export async function fetchLastApplicationDocs(
    applicantId: string,
    currentApplicationId?: string,
): Promise<{ docId: string; label: string; fileUrl: string; sourceCaseNumber: string }[]> {
    if (!applicantId) return [];
    const client = await pool.connect();
    try {
        // 取此申請人「上一筆」案件 — 排除當前正在檢視的案件
        // 沒提供 currentApplicationId 時退化為純粹「最新一筆」（兼容舊呼叫）
        const params: unknown[] = [applicantId];
        let excludeClause = '';
        if (currentApplicationId && /^\d+$/.test(currentApplicationId)) {
            params.push(currentApplicationId);
            excludeClause = `AND id != $${params.length}::bigint`;
        }
        const appRes = await client.query(
            `SELECT id, case_number FROM applications
             WHERE applicant_id = $1 ${excludeClause}
             ORDER BY apply_at DESC LIMIT 1`,
            params,
        );
        if (appRes.rows.length === 0) return [];  // 此人是首次申請（排除自己後沒有其他案件）
        const { id: lastAppId, case_number: caseNumber } = appRes.rows[0];

        // 取上一筆案件的 doc id=3 (身分證) 與 id=4 (個資同意書)
        const docsRes = await client.query(
            `SELECT id::text AS doc_id, file_path
             FROM application_documents
             WHERE application_id = $1 AND id IN (3, 4) AND file_path IS NOT NULL`,
            [lastAppId]
        );
        const DOC_LABELS: Record<string, string> = { '3': '身分證正反面影本', '4': '個資同意書' };
        return docsRes.rows.map((r: any) => ({
            docId: r.doc_id,
            label: DOC_LABELS[r.doc_id] ?? r.doc_id,
            fileUrl: r.file_path,
            sourceCaseNumber: caseNumber,
        }));
    } finally {
        client.release();
    }
}

export async function copyDocumentToApplication(
    targetApplicationId: string,
    docId: string,
    fileUrl: string,
    sourceCaseNumber: string,
    operatorUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO application_documents (application_id, id, file_path, status, uploaded_at)
             VALUES ($1, $2, $3, '0', NOW())
             ON CONFLICT (application_id, id) WHERE disbursement_id IS NULL
             DO UPDATE SET file_path = EXCLUDED.file_path, status = '0', uploaded_at = NOW()`,
            [targetApplicationId, docId, fileUrl]
        );
        void writeAuditLog({
            userId: operatorUserId ?? null,
            action: 'document.copy_from_previous',
            targetType: 'document',
            targetId: docId,
            detail: { targetApplicationId, sourceCaseNumber, fileUrl },
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
