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
                   d.storage_location_id, d.sort_order, d.is_active,
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

export async function uploadApplicationDocument(
    applicationId: string,
    documentId: string,    // e.g. '1', '2', ... (matches application_documents.id SMALLINT)
    documentLabel: string, // e.g. '自費醫療補助申請書'
    caseNumber: string,    // e.g. 'A115003'
    formData: FormData,
    uploaderAccount?: string
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

    try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const safeLabel = sanitizeForFilename(documentLabel);
        const timestamp = formatTimestamp(new Date());
        const fileName = `${caseNumber}_${safeLabel}_${timestamp}${ext}`;
        const localRelPath = `/uploads/${applicationId}/${fileName}`;
        const blobKey = `uploads/${applicationId}/${fileName}`;

        const publicUrl = await uploadFile(buffer, blobKey, localRelPath);

        // Count pages after upload
        const pages = await countPages(buffer, ext);

        // Only write to DB for real DB-backed applications (numeric IDs)
        if (/^\d+$/.test(applicationId)) {
            const client = await pool.connect();
            try {
                await client.query(
                    `INSERT INTO application_documents (application_id, id, file_path, status, uploaded_at, pages)
                     VALUES ($1, $2, $3, '0', NOW(), $4)
                     ON CONFLICT (application_id, id)
                     DO UPDATE SET file_path = EXCLUDED.file_path, status = '0', uploaded_at = NOW(), pages = EXCLUDED.pages`,
                    [applicationId, documentId, publicUrl, pages]
                );
            } finally {
                client.release();
            }
        }

        void writeAuditLog({
            userId: null,
            action: 'document.upload',
            targetType: 'document',
            targetId: documentId,
            detail: { applicationId, documentLabel, filePath: publicUrl },
        });
        return { success: true, filePath: publicUrl };
    } catch (err: any) {
        console.error('File upload error', err);
        return { success: false, error: '檔案上傳失敗' };
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
        const existRes = await client.query(
            `SELECT 1 FROM application_documents WHERE application_id = $1 AND id = $2`,
            [applicationId, documentId]
        );

        if (existRes.rows.length > 0) {
            await client.query(
                `UPDATE application_documents SET status = $1, reject_reason = $2 WHERE application_id = $3 AND id = $4`,
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
            SELECT d.id::text, d.label, d.phase, d.is_required, d.sort_order,
                   lp.full_path AS storage_location_path
            FROM document_type_config d
            LEFT JOIN loc_path lp ON lp.id = d.storage_location_id
            WHERE d.is_active = true
            ORDER BY d.phase, d.sort_order, d.id
        `);

        const docTypes = configRes.rows as {
            id: string; label: string; phase: string;
            is_required: boolean; storage_location_path: string | null;
        }[];

        const uploadRes = await client.query(
            `SELECT id::text, file_path, status, reject_reason, uploaded_at
             FROM application_documents WHERE application_id = $1`,
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
                    phase: doc.phase,
                    storageLocationPath: doc.storage_location_path,
                };
            }
            return {
                id: doc.id,
                label: doc.label,
                status: '0' as const,
                isRequired: doc.is_required,
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
    applicantId: string
): Promise<{ docId: string; label: string; fileUrl: string; sourceCaseNumber: string }[]> {
    if (!applicantId) return [];
    const client = await pool.connect();
    try {
        // Get the most recent application for this applicant (any status)
        const appRes = await client.query(
            `SELECT id, case_number FROM applications
             WHERE applicant_id = $1
             ORDER BY apply_at DESC LIMIT 1`,
            [applicantId]
        );
        if (appRes.rows.length === 0) return [];
        const { id: lastAppId, case_number: caseNumber } = appRes.rows[0];

        // Get doc id=3 (身分證) and id=4 (個資同意書) from that application
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
             ON CONFLICT (application_id, id)
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
