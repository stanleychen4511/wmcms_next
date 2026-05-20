/**
 * 撥款核銷文件合併列印 route（refine-disbursement-flow，task 6.1）
 *
 * POST /api/disbursement-print
 *   body: { disbursementId: string, operatorUserId: string,
 *           documents: ('opinion'|'medical'|'payment')[] }
 *
 * 守門：
 *   - operatorUserId 必須具 accountant 角色（admin 不再 bypass，與其他撥款守門一致）
 *   - 對應 payment_disbursements.review_stage 必須為 '3'（會計階段）
 *   - documents 至少一項；不在白名單則拒絕
 *
 * 流程：
 *   1) 依 documents 順序取每個 PDF buffer：
 *      'opinion' → ReviewOpinionPdf 渲染
 *      'medical' → 從 application_documents (id=17, disbursement_id=X) 抓所有檔案
 *      'payment' → 從 application_documents (id=18, disbursement_id=X) 抓檔案
 *      （'medical' / 'payment' 的來源若是 image，用 pdf-lib embedJpg/embedPng 包成 PDF 頁）
 *   2) 用 pdf-lib 合併所有頁面為單一 PDF
 *   3) 寫 audit_logs（detail.selected = documents 陣列、disbursement_id、operator）
 *   4) 回傳 application/pdf
 */
import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { pool } from '../../../lib/db';
import { writeAuditLog } from '../../actions/auditActions';

const ALLOWED_DOC_KEYS = ['opinion', 'medical', 'payment'] as const;
type DocKey = typeof ALLOWED_DOC_KEYS[number];

async function hasAccountantRole(userId: string): Promise<boolean> {
    if (!userId || !/^\d+$/.test(userId)) return false;
    const r = await pool.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint AND r.code = 'accountant' LIMIT 1`,
        [userId]
    );
    return (r.rowCount ?? 0) > 0;
}

/** 將檔案路徑（本地 /uploads/... 或 https blob URL）讀為 Buffer */
async function readFileBuffer(filePath: string): Promise<Buffer | null> {
    try {
        if (filePath.startsWith('https://') || filePath.startsWith('http://')) {
            const res = await fetch(filePath);
            if (!res.ok) return null;
            return Buffer.from(await res.arrayBuffer());
        }
        // 本地 dev：允許任意子目錄（撥款檔案放在 /uploads/{appId}/disb{id}/...），
        // 但禁止 .. 跳脫上層
        if (/^\/(uploads|intake)\//.test(filePath) && !filePath.includes('..')) {
            const abs = path.join(process.cwd(), 'public', filePath);
            return await fs.readFile(abs);
        }
        return null;
    } catch {
        return null;
    }
}

/** 將 image (jpg/png) buffer 包成 single-page PDF buffer，A4 尺寸內等比縮放 */
async function imageBufferToPdf(buffer: Buffer, ext: string): Promise<Buffer | null> {
    try {
        const { PDFDocument } = await import('pdf-lib');
        const doc = await PDFDocument.create();
        const lower = ext.toLowerCase();
        let img;
        if (lower === '.jpg' || lower === '.jpeg') {
            img = await doc.embedJpg(buffer);
        } else if (lower === '.png') {
            img = await doc.embedPng(buffer);
        } else {
            return null;
        }
        // A4 595.28 x 841.89 pt
        const A4_W = 595.28, A4_H = 841.89;
        const scale = Math.min(A4_W / img.width, A4_H / img.height, 1);
        const w = img.width * scale, h = img.height * scale;
        const page = doc.addPage([A4_W, A4_H]);
        page.drawImage(img, { x: (A4_W - w) / 2, y: (A4_H - h) / 2, width: w, height: h });
        return Buffer.from(await doc.save());
    } catch (e) {
        console.error('imageBufferToPdf failed', e);
        return null;
    }
}

/** 把任一檔案（PDF / image）轉成 PDF buffer；非支援檔案回 null + log 警告 */
async function fileToPdfBuffer(filePath: string): Promise<Buffer | null> {
    const buf = await readFileBuffer(filePath);
    if (!buf) {
        console.warn(`[disbursement-print] 讀取失敗：${filePath}`);
        return null;
    }
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') return buf;
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') return imageBufferToPdf(buf, ext);
    console.warn(`[disbursement-print] 不支援的檔案格式 ${ext}，已跳過：${filePath}`);
    return null;
}

export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return new NextResponse('Invalid JSON body', { status: 400 });
    }
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const disbursementId = String(b.disbursementId ?? '');
    const operatorUserId = String(b.operatorUserId ?? '');
    const documents: DocKey[] = Array.isArray(b.documents)
        ? (b.documents as unknown[]).filter((d): d is DocKey =>
              typeof d === 'string' && (ALLOWED_DOC_KEYS as readonly string[]).includes(d))
        : [];

    if (!/^\d+$/.test(disbursementId)) {
        return new NextResponse('Invalid disbursementId', { status: 400 });
    }
    if (documents.length === 0) {
        return new NextResponse('At least one document must be selected', { status: 400 });
    }

    // 角色 + stage 守門
    if (!(await hasAccountantRole(operatorUserId))) {
        return new NextResponse('Forbidden', { status: 403 });
    }
    const r = await pool.query(
        `SELECT review_stage, application_id::text, amount, external_code FROM payment_disbursements
         WHERE id = $1::bigint LIMIT 1`,
        [disbursementId]
    );
    if (r.rowCount === 0) {
        return new NextResponse('Disbursement not found', { status: 404 });
    }
    const stage: string = r.rows[0].review_stage;
    if (stage !== '3') {
        return new NextResponse(`Disbursement not in accountant stage (current: ${stage})`, { status: 409 });
    }
    const applicationId: string = r.rows[0].application_id;
    const disbursementAmount = Number(r.rows[0].amount);
    const externalCode: string = r.rows[0].external_code ?? '';

    // 為 fetchPaymentReceiptPrintData / fetchReviewOpinionPrintData 取得 admin uid（需具 admin/accountant）
    // 這裡 operator 已是 accountant，可直接傳 operator
    try {
        const { PDFDocument } = await import('pdf-lib');
        const merged = await PDFDocument.create();

        for (const key of documents) {
            const partial = await renderDocumentPdf(key, applicationId, disbursementId, disbursementAmount, externalCode, operatorUserId);
            if (!partial) continue;
            const src = await PDFDocument.load(partial);
            const pages = await merged.copyPages(src, src.getPageIndices());
            pages.forEach(p => merged.addPage(p));
        }

        const out = Buffer.from(await merged.save());
        if (out.length === 0) {
            return new NextResponse('No printable content for selection', { status: 422 });
        }

        // audit
        void writeAuditLog({
            userId: operatorUserId,
            action: 'payment_disbursement.print_merged',
            targetType: 'payment_disbursement',
            targetId: disbursementId,
            detail: { selected: documents, application_id: applicationId },
        });

        return new NextResponse(out, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="disbursement_${disbursementId}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: any) {
        console.error('disbursement-print merge error', err);
        return new NextResponse('Print merge failed', { status: 500 });
    }
}

async function renderDocumentPdf(
    key: DocKey,
    applicationId: string,
    disbursementId: string,
    disbursementAmount: number,
    externalCode: string,
    accountantUserId: string,
): Promise<Buffer | null> {
    if (key === 'payment') {
        // 個管已上傳的紙本領款收據掃描檔（id=18, disbursement_id=X），多檔取最新一筆
        const fr = await pool.query(
            `SELECT file_path FROM application_documents
             WHERE application_id = $1::bigint AND id = 18 AND disbursement_id = $2::bigint
               AND file_path IS NOT NULL
             ORDER BY uploaded_at DESC NULLS LAST LIMIT 1`,
            [applicationId, disbursementId]
        );
        if (fr.rowCount && fr.rowCount > 0) {
            const buf = await fileToPdfBuffer(fr.rows[0].file_path);
            if (buf) return buf;
        }
        // 退而求其次：用 receipt_file_path（個管產生的領款收據 PDF）
        const pr = await pool.query(
            `SELECT receipt_file_path FROM payment_disbursements WHERE id = $1::bigint LIMIT 1`,
            [disbursementId]
        );
        if (pr.rowCount && pr.rows[0].receipt_file_path) {
            const buf = await fileToPdfBuffer(pr.rows[0].receipt_file_path);
            if (buf) return buf;
        }
        // 最後保底：即時重新渲染一份 PDF
        try {
            const dr = await pool.query(
                `SELECT payment_method, bank_name, bank_branch, bank_account,
                        payee_name, payee_relation, payee_relation_other
                 FROM payment_disbursements WHERE id = $1::bigint LIMIT 1`,
                [disbursementId]
            );
            const row = dr.rows[0] ?? {};
            const { generateDisbursementPaymentReceiptPdf } =
                await import('../../../lib/pdf/generateDisbursementPaymentReceiptPdf');
            return await generateDisbursementPaymentReceiptPdf(applicationId, accountantUserId, {
                amount: disbursementAmount,
                externalCode,
                paymentMethod: row.payment_method,
                bankName: row.bank_name,
                bankBranch: row.bank_branch,
                bankAccount: row.bank_account,
                payeeName: row.payee_name,
                payeeRelation: row.payee_relation,
                payeeRelationOther: row.payee_relation_other,
            });
        } catch {
            return null;
        }
    }
    if (key === 'medical') {
        // 會計上傳的醫療收據（id=17, disbursement_id=X），可多檔
        const fr = await pool.query(
            `SELECT file_path FROM application_documents
             WHERE application_id = $1::bigint AND id = 17 AND disbursement_id = $2::bigint
               AND file_path IS NOT NULL
             ORDER BY uploaded_at ASC NULLS LAST`,
            [applicationId, disbursementId]
        );
        if (fr.rowCount === 0) return null;
        // 多檔合併為一份 PDF buffer
        const { PDFDocument } = await import('pdf-lib');
        const subDoc = await PDFDocument.create();
        for (const row of fr.rows) {
            const buf = await fileToPdfBuffer(row.file_path);
            if (!buf) continue;
            const src = await PDFDocument.load(buf);
            const pages = await subDoc.copyPages(src, src.getPageIndices());
            pages.forEach(p => subDoc.addPage(p));
        }
        if (subDoc.getPageCount() === 0) return null;
        return Buffer.from(await subDoc.save());
    }
    if (key === 'opinion') {
        try {
            const { generateReviewOpinionPdf } = await import('../../../lib/pdf/generateReviewOpinionPdf');
            return await generateReviewOpinionPdf(applicationId, accountantUserId);
        } catch (e) {
            console.error('opinion render failed', e);
            return null;
        }
    }
    return null;
}
