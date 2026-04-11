'use server';

import { pool } from '../../lib/db';
import { promises as fs } from 'fs';
import path from 'path';
import { writeAuditLog } from './auditActions';

export interface DocumentEntry {
    id: string; // The file type identifier (doc sequence number per spec)
    label: string; // Display name
    status: '0' | '1' | '2'; // 0=待上傳/未符合, 1=符合, 2=逾期
    fileUrl?: string; // the database file_path
    rejectReason?: string;
    uploadedAt?: string;
    isRequired: boolean;
    phase?: string; // 'apply' | 'reimbursement'
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

        // Ensure the directory exists
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', applicationId);
        await fs.mkdir(uploadDir, { recursive: true });

        // Filename format: 案件編號_文件類型名稱_時間戳記.ext
        // e.g. A115003_自費醫療補助申請書_20260405074600.pdf
        const safeLabel = sanitizeForFilename(documentLabel);
        const timestamp = formatTimestamp(new Date());
        const fileName = `${caseNumber}_${safeLabel}_${timestamp}${ext}`;
        const filePath = path.join(uploadDir, fileName);

        // Write file locally
        await fs.writeFile(filePath, buffer);

        // The URL path accessible from frontend
        const publicUrl = `/uploads/${applicationId}/${fileName}`;

        // Only write to DB for real DB-backed applications (numeric IDs)
        if (/^\d+$/.test(applicationId)) {
            const client = await pool.connect();
            try {
                await client.query(
                    `INSERT INTO application_documents (application_id, id, file_path, status, uploaded_at)
                     VALUES ($1, $2, $3, '0', NOW())
                     ON CONFLICT (application_id, id)
                     DO UPDATE SET file_path = EXCLUDED.file_path, status = '0', uploaded_at = NOW()`,
                    [applicationId, documentId, publicUrl]
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
    // 文件清單依據需求規格書 application_documents.id (SMALLINT):
    // 申請類文件 (1-13), 複審類文件 (14-16), 補助類文件 (17-21)
    const DEFAULT_DOCS: { id: string; label: string; phase: string; isRequired: boolean }[] = [
        { id: '1',  label: '自費醫療補助申請表', phase: 'apply', isRequired: true },
        { id: '3',  label: '身分證正反面影本', phase: 'apply', isRequired: true },
        { id: '4',  label: '個資同意書', phase: 'apply', isRequired: true },
        { id: '6',  label: '綜所稅清單(配偶亦繳)', phase: 'apply', isRequired: true },
        { id: '8',  label: '全戶戶籍謄本', phase: 'apply', isRequired: true },
        { id: '2',  label: '重大傷病證明', phase: 'apply', isRequired: true },
        { id: '11', label: '診斷證明', phase: 'apply', isRequired: true },
        { id: '13', label: '醫療單據正本或與正本相符之影本', phase: 'apply', isRequired: true },
        { id: '9',  label: '集保結算所資料', phase: 'apply', isRequired: false },
        { id: '10', label: '購屋貸款利息單據', phase: 'apply', isRequired: false },
        { id: '5',  label: '現職醫事人員在職證明', phase: 'apply', isRequired: false },
        // 核銷撥款階段文件 (id 17-20)
        { id: '17', label: '醫療收據', phase: 'reimbursement', isRequired: true },
        { id: '18', label: '領款收據', phase: 'reimbursement', isRequired: true },
        { id: '19', label: '保險給付通知單', phase: 'reimbursement', isRequired: false },
        { id: '20', label: '生命故事同意刊登截圖證明', phase: 'reimbursement', isRequired: false },
    ];

    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id::text, file_path, status, reject_reason, uploaded_at 
             FROM application_documents WHERE application_id = $1`,
            [applicationId]
        );

        const dbRecords = new Map(res.rows.map((r: any) => [String(r.id), r]));

        return DEFAULT_DOCS.map(doc => {
            const row = dbRecords.get(doc.id);
            if (row) {
                return {
                    id: doc.id,
                    label: doc.label,
                    status: (row.status ?? '0') as '0' | '1' | '2',
                    fileUrl: row.file_path,
                    rejectReason: row.reject_reason,
                    uploadedAt: row.uploaded_at ? row.uploaded_at.toISOString() : undefined,
                    isRequired: doc.isRequired,
                    phase: doc.phase,
                };
            }
            return {
                id: doc.id,
                label: doc.label,
                status: '0' as const,
                isRequired: doc.isRequired,
                phase: doc.phase,
            };
        });

    } finally {
        client.release();
    }
}
