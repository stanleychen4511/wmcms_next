'use server';

/**
 * 列印頁面 server-side 資料組裝。
 *
 * 三個入口：
 *   - fetchReviewOpinionPrintData  → 審核意見表
 *   - fetchPaymentReceiptPrintData → 領款收據
 *   - fetchMedicalReceipts         → 醫療收據（已上傳檔案 URL 列表）
 *
 * 全部入口在第一行就驗證 operatorUserId 必須具備 admin 或 accountant 角色，
 * 否則回 { success: false, error: '權限不足' } 且不返回資料。
 */

import { pool } from '../../lib/db';
import { decryptAES } from '../../lib/crypto';

export interface ReviewOpinionPrintData {
    caseNumber: string;
    applicantName: string;
    category: 'A' | 'B' | 'C' | 'D' | null;
    applicationType: string | null;
    caseDescription: string | null;        // home_visit.subsidy_need_reason
    boardComments: string | null;          // applications.board_review_comments
    approvedAmount: number | null;
    isApproved: boolean | null;
    reviewDate: string | null;             // ISO；advance to reimbursement 的時間
    signatures: Array<{
        signerName: string;
        signatureDataUrl: string;
        signedAt: string;
    }>;
}

export interface PaymentReceiptPrintData {
    caseNumber: string;
    applicantName: string;
    applicantIdNumber: string | null;
    /** user feedback #12：領款收據加上戶籍地址與電話 */
    applicantAddress: string | null;
    applicantPhone: string | null;
    category: 'A' | 'B' | 'C' | 'D' | null;
    applicationType: string | null;
    approvedAmount: number | null;
    /** 對外露出的撥款隱碼（取代內部 receipt_number；單筆撥款時由 caller 帶入） */
    externalCode?: string;
    /** 撥款層級欄位（單筆撥款時由 caller 帶入；case-level fetch 時為 undefined） */
    paymentMethod?: string | null;       // '匯款' | '代付醫院' | '現金' | '其他'
    bankName?: string | null;
    bankBranch?: string | null;
    bankAccount?: string | null;
    payeeName?: string | null;
    payeeRelation?: string | null;       // '本人' | '配偶' | '子女' | '父母' | '其他'
    payeeRelationOther?: string | null;  // 當 payeeRelation='其他' 時的補充
    org: {
        full_name: string;
        license_no: string;
        registration_no: string;
        uniform_no: string;
        address: string;
        phone: string;
        fax: string;
        line_qr_url: string;
    };
}

export interface MedicalReceiptFile {
    docInstanceId: string;       // application_documents.id（複合 PK 第二碼）
    fileName: string;
    fileUrl: string;             // 開新分頁用
    uploadedAt: string | null;
}

export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// ─── 權限守門 ────────────────────────────────────────────────────────────

/**
 * 檢查 operatorUserId 是否具備 admin 或 accountant 角色。
 * 兩個角色任一即通過；其他角色（包含 chairman / supervisor / case_officer）一律拒絕。
 */
async function assertAdminOrAccountant(operatorUserId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!operatorUserId || !/^\d+$/.test(operatorUserId)) {
        return { ok: false, error: '權限不足' };
    }
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT 1
             FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint
               AND r.code IN ('admin', 'accountant')
             LIMIT 1`,
            [operatorUserId]
        );
        return (res.rowCount ?? 0) > 0 ? { ok: true } : { ok: false, error: '權限不足' };
    } finally {
        client.release();
    }
}

// 對外暴露一個輕量化的權限查詢工具，供 UI 條件 render 用。
export async function isPrintPrivileged(operatorUserId: string): Promise<boolean> {
    const r = await assertAdminOrAccountant(operatorUserId);
    return r.ok;
}

// ─── 5.2 審核意見表資料 ────────────────────────────────────────────────

function decryptName(enc: Buffer | null, iv: Buffer | null): string {
    if (!enc || !iv) return '未知';
    try {
        return decryptAES(enc, iv) || '未知';
    } catch {
        return '未知';
    }
}

// ─── 5.4 醫療收據檔案清單 ──────────────────────────────────────────────

export async function fetchMedicalReceipts(
    applicationId: string,
    operatorUserId: string
): Promise<ActionResult<MedicalReceiptFile[]>> {
    const auth = await assertAdminOrAccountant(operatorUserId);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };

    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT
                ad.id::text   AS doc_id,
                ad.file_path,
                ad.uploaded_at,
                dtc.label
             FROM application_documents ad
             JOIN document_type_config dtc ON dtc.id = ad.id
             WHERE ad.application_id = $1::bigint
               AND dtc.label = '醫療收據'
               AND ad.file_path IS NOT NULL
               AND ad.file_path <> ''
             ORDER BY ad.uploaded_at DESC NULLS LAST`,
            [applicationId]
        );

        // file_path 可能是 Vercel Blob 的 public URL（https://...）或相對儲存路徑。
        // 前端直接 window.open，URL 由 file_path 本身決定。
        const files: MedicalReceiptFile[] = res.rows.map((r: any) => ({
            docInstanceId: r.doc_id,
            fileName: r.file_path.split('/').pop() || r.file_path,
            fileUrl: r.file_path,
            uploadedAt: r.uploaded_at ? new Date(r.uploaded_at).toISOString() : null,
        }));

        return { success: true, data: files };
    } catch (err: any) {
        console.error('fetchMedicalReceipts error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

// ─── 5.3 領款收據資料 ──────────────────────────────────────────────────

/** 一次讀取 8 個 org_* 設定值；任一 key 缺席以空字串 fallback。 */
async function fetchOrgSettings(client: any): Promise<PaymentReceiptPrintData['org']> {
    const keys = [
        'org_full_name',
        'org_license_no',
        'org_registration_no',
        'org_uniform_no',
        'org_address',
        'org_phone',
        'org_fax',
        'org_line_qr_url',
    ];
    const res = await client.query(
        `SELECT key, value FROM system_settings WHERE key = ANY($1::text[])`,
        [keys]
    );
    const map = new Map<string, string>();
    for (const r of res.rows) map.set(r.key, r.value ?? '');
    return {
        full_name:       map.get('org_full_name')       ?? '',
        license_no:      map.get('org_license_no')      ?? '',
        registration_no: map.get('org_registration_no') ?? '',
        uniform_no:      map.get('org_uniform_no')      ?? '',
        address:         map.get('org_address')         ?? '',
        phone:           map.get('org_phone')           ?? '',
        fax:             map.get('org_fax')             ?? '',
        line_qr_url:     map.get('org_line_qr_url')     ?? '',
    };
}

export async function fetchPaymentReceiptPrintData(
    applicationId: string,
    operatorUserId: string
): Promise<ActionResult<PaymentReceiptPrintData>> {
    const auth = await assertAdminOrAccountant(operatorUserId);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };

    const client = await pool.connect();
    try {
        const [caseRes, org] = await Promise.all([
            client.query(
                `SELECT
                    a.case_number,
                    a.application_type,
                    a.approved_amount,
                    a.applicant_address,
                    a.applicant_phone,
                    u.name_enc       AS app_name_enc,
                    u.name_iv        AS app_name_iv,
                    u.id_number_enc  AS id_enc,
                    u.id_number_iv   AS id_iv
                 FROM applications a
                 LEFT JOIN users u ON u.id = a.applicant_id
                 WHERE a.id = $1::bigint`,
                [applicationId]
            ),
            fetchOrgSettings(client),
        ]);
        if (caseRes.rowCount === 0) {
            return { success: false, error: '案件不存在' };
        }
        const row = caseRes.rows[0];

        // resolveCategory 展開
        const type = row.application_type as 'A' | 'B' | 'C' | 'D' | null;
        const caseNumber = row.case_number as string;
        let category: 'A' | 'B' | 'C' | 'D' | null = null;
        if (type && ['A', 'B', 'C', 'D'].includes(type)) {
            category = type;
        } else if (caseNumber && ['A', 'B', 'C', 'D'].includes(caseNumber[0])) {
            category = caseNumber[0] as 'A' | 'B' | 'C' | 'D';
        }

        let applicantIdNumber: string | null = null;
        if (row.id_enc && row.id_iv) {
            try {
                applicantIdNumber = decryptAES(row.id_enc, row.id_iv) || null;
            } catch {
                applicantIdNumber = null;
            }
        }

        return {
            success: true,
            data: {
                caseNumber: row.case_number,
                applicantName: decryptName(row.app_name_enc, row.app_name_iv),
                applicantIdNumber,
                applicantAddress: row.applicant_address ?? null,
                applicantPhone: row.applicant_phone ?? null,
                category,
                applicationType: type,
                approvedAmount: row.approved_amount != null ? Number(row.approved_amount) : null,
                org,
            },
        };
    } catch (err: any) {
        console.error('fetchPaymentReceiptPrintData error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

export async function fetchReviewOpinionPrintData(
    applicationId: string,
    operatorUserId: string
): Promise<ActionResult<ReviewOpinionPrintData>> {
    const auth = await assertAdminOrAccountant(operatorUserId);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };

    const client = await pool.connect();
    try {
        // 一次 JOIN 抓回案件 + 申請人姓名 + 個管師案件說明（fallback 到家訪 subsidy_need_reason）
        const caseRes = await client.query(
            `SELECT
                a.case_number,
                a.application_type,
                a.approved_amount,
                a.board_review_comments,
                a.officer_case_summary,
                u.name_enc AS app_name_enc,
                u.name_iv  AS app_name_iv,
                (SELECT subsidy_need_reason
                 FROM home_visit
                 WHERE application_id = a.id
                 ORDER BY visit_date DESC NULLS LAST, id DESC
                 LIMIT 1) AS subsidy_need_reason,
                (SELECT is_approved
                 FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY id DESC LIMIT 1) AS wf_is_approved,
                -- 審核日期：首次推進到 reimbursement 的 reviewed_at；若無則 null
                -- （append-only：可能有多列 stage='reimbursement'，取最早一筆＝董事核可進核銷的時間）
                (SELECT reviewed_at
                 FROM application_workflow
                 WHERE application_id = a.id AND stage = 'reimbursement'
                 ORDER BY id ASC LIMIT 1) AS review_date
             FROM applications a
             LEFT JOIN users u ON u.id = a.applicant_id
             WHERE a.id = $1::bigint`,
            [applicationId]
        );
        if (caseRes.rowCount === 0) {
            return { success: false, error: '案件不存在' };
        }
        const row = caseRes.rows[0];

        // 董事電子簽章（依簽章時間排序）
        const sigRes = await client.query(
            `SELECT
                s.signature_data_url,
                s.signed_at,
                u.name_enc,
                u.name_iv
             FROM board_review_signatures s
             JOIN users u ON u.id = s.signer_user_id
             WHERE s.application_id = $1::bigint
             ORDER BY s.signed_at ASC`,
            [applicationId]
        );

        const signatures = sigRes.rows.map((r: any) => ({
            signerName: decryptName(r.name_enc, r.name_iv),
            signatureDataUrl: r.signature_data_url,
            signedAt: r.signed_at ? new Date(r.signed_at).toISOString() : '',
        }));

        // resolveCategory 邏輯就地展開（避免 'use server' import client lib 多一層 hop）
        const type = row.application_type as 'A' | 'B' | 'C' | 'D' | null;
        const caseNumber = row.case_number as string;
        let category: 'A' | 'B' | 'C' | 'D' | null = null;
        if (type && ['A', 'B', 'C', 'D'].includes(type)) {
            category = type;
        } else if (caseNumber && ['A', 'B', 'C', 'D'].includes(caseNumber[0])) {
            category = caseNumber[0] as 'A' | 'B' | 'C' | 'D';
        }

        return {
            success: true,
            data: {
                caseNumber: row.case_number,
                applicantName: decryptName(row.app_name_enc, row.app_name_iv),
                category,
                applicationType: type,
                // #17 案件說明優先取 applications.officer_case_summary（個管師填寫）；
                // 舊資料 fallback 到 home_visit.subsidy_need_reason
                caseDescription: row.officer_case_summary ?? row.subsidy_need_reason ?? null,
                boardComments: row.board_review_comments ?? null,
                approvedAmount: row.approved_amount != null ? Number(row.approved_amount) : null,
                isApproved: row.wf_is_approved,
                reviewDate: row.review_date ? new Date(row.review_date).toISOString() : null,
                signatures,
            },
        };
    } catch (err: any) {
        console.error('fetchReviewOpinionPrintData error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}
