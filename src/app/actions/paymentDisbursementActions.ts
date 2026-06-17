'use server';

/**
 * 撥款紀錄 server actions（#12 多層審核流程）
 *
 * 表：payment_disbursements
 * 流程（review_stage）：
 *   '1' 個管師持有中（officer）— 可編輯資料、按【送出】到 '2'
 *   '2' 主管審核中（supervisor）— 可【檢核】【送出】到 '3' 或【退件】回 '1'
 *   '3' 會計審核中（accountant）— 可【檢核】3 項、【送出】到 '4' 或【退件】回 '2'
 *   '4' 執行長審核中（executive）— 可【通過】【完成】到 '9' 或【退件】回 '3'
 *   '9' 已完成（completed）
 *   'X' 已退件廢棄（rejected and abandoned）— 暫不使用，保留代碼
 *
 * 串行守門：DB unique partial index 確保每案最多一筆 in-flight。
 */

import { pool } from '../../lib/db';
import * as crypto from 'crypto';
import { writeAuditLog } from './auditActions';
// 'use server' 檔案不可 export 非 async function；常數與型別搬到 lib/paymentDisbursementConstants.ts
import { REVIEW_STAGE_LABEL, type ReviewStage } from '../../lib/paymentDisbursementConstants';
import { formatDateOnly } from '../../lib/dateOnly';

export interface PaymentDisbursement {
    id: string;
    applicationId: string;
    receiptNumber: string;     // 內碼 YYYY-MM-NNNN
    externalCode: string;      // 外碼（對外露出）
    amount: number;
    payeeName: string | null;
    payeeIdNumber: string | null;
    payeeRelation: string | null;
    payeeRelationOther: string | null;
    paymentMethod: string | null;
    bankName: string | null;
    bankBranch: string | null;
    bankAccount: string | null;
    sentAt: string | null;
    receivedAt: string | null;
    receiptFilePath: string | null;
    remittanceSlipFilePath: string | null;
    medicalReceiptStatus: 'official' | 'unpaid' | null;
    notes: string | null;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;

    // 多層審核狀態
    reviewStage: ReviewStage;
    officerSignedAt: string | null;
    supervisorUserId: string | null;
    supervisorSignedAt: string | null;
    accountantUserId: string | null;
    accountantSignedAt: string | null;
    executiveUserId: string | null;
    executiveSignedAt: string | null;
    rejectedReason: string | null;
    rejectedAt: string | null;
    rejectedBy: string | null;
    rejectedFromStage: string | null;

    // refine-disbursement-flow checklist 欄位
    officerDocCheck: boolean;
    supervisorDocCheck: boolean;
    accountantMedicalUploadedCheck: boolean;
    accountantAmountMatchCheck: boolean;
    accountantBoardOpinionCheck: boolean;
    accountantBankSetupCheck: boolean;
    executiveFinalCheck: boolean;

    // refine-disbursement-flow 衍生欄位（供 UI badge 用）
    paymentReceiptScanUploaded: boolean;       // 個管已上傳紙本掃描檔（id=18）— 同 paymentReceiptScanUrl != null
    paymentReceiptScanUrl: string | null;      // 申請人寄回的領款收據紙本掃描檔 URL（id=18, disbursement_id=X 的最新一筆）
    lastReceiptEmailStatus: 'sent' | 'failed' | null;  // 最近一次寄送領款收據 email 狀態
    lastPrintedAt: string | null;              // 會計合併列印時間
    medicalReceipts: { fileUrl: string; uploadedAt: string | null }[];  // 會計上傳的醫療收據（id=17）

    // user feedback #12：是否同意公開捐贈者姓名（每筆撥款獨立記錄）+ 配套文件
    donorDisclosureConsent: boolean | null;    // null=未填 / true=同意公開 / false=不同意 → 須附聲明書
    donorConsentLetterUploaded: boolean;       // 是否已上傳「捐贈/受補助者聲明書」（doc id=22, disbursement_id=X）
    donorConsentLetterUrl: string | null;      // 聲明書 file_path（供檢視按鈕）
    passbookCoverUploaded: boolean;            // 是否已上傳「存摺封面影本」（doc id=21, disbursement_id=X）
    passbookCoverUrl: string | null;           // 存摺封面 file_path（供檢視按鈕）
}

export interface DisbursementSummary {
    approvedAmount: number;       // applications.approved_amount
    totalDisbursed: number;       // SUM(amount where review_stage='9')
    totalReceived: number;        // SUM(amount where received_at not null AND stage='9')
    totalInFlight: number;        // SUM(amount where stage IN '1'..'4')
    remaining: number;            // approved - (disbursed + in-flight)
    canCloseCase: boolean;        // received >= approved
    closeCaseBlockReason: string | null;
    hasInFlight: boolean;         // 是否有 in-flight 撥款（用於串行守門）
    disbursements: PaymentDisbursement[];
}

type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// ─── 角色守門 ────────────────────────────────────────────────────────────

async function getUserRoles(operatorUserId: string): Promise<string[]> {
    if (!operatorUserId || !/^\d+$/.test(operatorUserId)) return [];
    const client = await pool.connect();
    try {
        const res = await client.query<{ code: string }>(
            `SELECT r.code FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint`,
            [operatorUserId]
        );
        return res.rows.map(r => r.code);
    } finally {
        client.release();
    }
}

async function hasAnyRole(operatorUserId: string, codes: string[]): Promise<boolean> {
    const roles = await getUserRoles(operatorUserId);
    return roles.some(r => codes.includes(r));
}

// 各 stage 對應的可操作角色：
//   '1' 個管師持有中 → 可送出: case_officer
//   '2' 主管審核中   → 可送出/退件: supervisor
//   '3' 會計審核中   → 可送出/退件: accountant
//   '4' 執行長審核中 → 可完成/退件: executive
//   admin 不再 bypass — 各流程僅該角色可動，避免越權
function rolesForStage(stage: ReviewStage): string[] {
    switch (stage) {
        case '1': return ['case_officer'];
        case '2': return ['supervisor'];
        case '3': return ['accountant'];
        case '4': return ['executive'];
        default:  return [];
    }
}

// ─── 收據編號 ─────────────────────────────────────────────────────────
//   內碼 receipt_number ＝ YYYY-MM-NNNN（每月歸零的 4 位流水號，內部可讀）
//   外碼 external_code  ＝ 6 字元 base32 隨機（對外露出，不洩漏編碼邏輯）

const BASE32_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 產生 6 字元 base32 隨機碼（32^6 ≈ 10 億組合）
 *  注意：用 Buffer.readUInt32BE 取得無號 32-bit 整數；
 *  不能用 bitwise `|` — `|` 會強制轉 signed，高位 bit 會變負數，
 *  導致 `n % 32` 為負 → `BASE32_ALPHABET[負數] = undefined`。 */
function generateExternalCode(): string {
    const bytes = crypto.randomBytes(4);
    let n = bytes.readUInt32BE(0);   // 0 ~ 4_294_967_295（永遠正數）
    let s = '';
    for (let i = 0; i < 6; i++) {
        s = BASE32_ALPHABET[n % 32] + s;
        n = Math.floor(n / 32);
    }
    return s;
}

/**
 * 取當月下一個流水號。
 * 在 createDisbursement 的 transaction 內呼叫；UNIQUE constraint 守底。
 * 取最大 NNNN+1，無資料則為 0001。
 */
async function generateMonthlyReceiptNumber(client: any, ym: string): Promise<string> {
    const prefix = `${ym}-`;
    const r = await client.query(
        `SELECT COALESCE(MAX(
            CAST(SUBSTRING(receipt_number FROM '\\d+$') AS INT)
         ), 0) AS max_seq
         FROM payment_disbursements
         WHERE receipt_number LIKE $1 || '%'`,
        [prefix]
    );
    const next = Number(r.rows[0]?.max_seq ?? 0) + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
}

/**
 * 產生 receipt_number + external_code 一組。
 * receipt_number：取當月流水號（在 transaction 內 SELECT MAX → 加一），
 *   若極端 race 撞到 UNIQUE，由 caller catch 23505 後重試（目前 createDisbursement 已在 transaction 中）。
 * external_code：6 字元 base32 隨機，用 retry 避撞號（撞號率 < 0.001%）。
 */
async function generateReceiptIdentifiers(client: any): Promise<{ receiptNumber: string; externalCode: string }> {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const receiptNumber = await generateMonthlyReceiptNumber(client, ym);

    for (let i = 0; i < 10; i++) {
        const candidate = generateExternalCode();
        const exists = await client.query(
            `SELECT 1 FROM payment_disbursements WHERE external_code = $1 LIMIT 1`,
            [candidate]
        );
        if (exists.rowCount === 0) return { receiptNumber, externalCode: candidate };
    }
    throw new Error('產生外部隱碼失敗（10 次重試皆碰撞）');
}

// ─── Helpers ────────────────────────────────────────────────────────────

function rowToDisbursement(r: any): PaymentDisbursement {
    return {
        id: String(r.id),
        applicationId: String(r.application_id),
        receiptNumber: r.receipt_number,
        externalCode: r.external_code ?? '',
        amount: Number(r.amount),
        payeeName: r.payee_name ?? null,
        payeeIdNumber: r.payee_id_number ?? null,
        payeeRelation: r.payee_relation ?? null,
        payeeRelationOther: r.payee_relation_other ?? null,
        paymentMethod: r.payment_method ?? null,
        bankName: r.bank_name ?? null,
        bankBranch: r.bank_branch ?? null,
        bankAccount: r.bank_account ?? null,
        sentAt: formatDateOnly(r.sent_at),
        receivedAt: formatDateOnly(r.received_at),
        receiptFilePath: r.receipt_file_path ?? null,
        medicalReceiptStatus: (r.medical_receipt_status === 'official' || r.medical_receipt_status === 'unpaid')
            ? r.medical_receipt_status
            : null,
        notes: r.notes ?? null,
        createdBy: r.created_by ? String(r.created_by) : null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : '',
        reviewStage: (r.review_stage as ReviewStage) ?? '9',
        officerSignedAt:    r.officer_signed_at    ? new Date(r.officer_signed_at).toISOString()    : null,
        supervisorUserId:   r.supervisor_user_id   ? String(r.supervisor_user_id) : null,
        supervisorSignedAt: r.supervisor_signed_at ? new Date(r.supervisor_signed_at).toISOString() : null,
        accountantUserId:   r.accountant_user_id   ? String(r.accountant_user_id) : null,
        accountantSignedAt: r.accountant_signed_at ? new Date(r.accountant_signed_at).toISOString() : null,
        executiveUserId:    r.executive_user_id    ? String(r.executive_user_id) : null,
        executiveSignedAt:  r.executive_signed_at  ? new Date(r.executive_signed_at).toISOString()  : null,
        rejectedReason:    r.rejected_reason ?? null,
        rejectedAt:        r.rejected_at ? new Date(r.rejected_at).toISOString() : null,
        rejectedBy:        r.rejected_by ? String(r.rejected_by) : null,
        rejectedFromStage: r.rejected_from_stage ?? null,
        officerDocCheck:                  !!r.officer_doc_check,
        supervisorDocCheck:               !!r.supervisor_doc_check,
        accountantMedicalUploadedCheck:   !!r.accountant_medical_uploaded_check,
        accountantAmountMatchCheck:       !!r.accountant_amount_match_check,
        accountantBoardOpinionCheck:      !!r.accountant_board_opinion_check,
        accountantBankSetupCheck:         !!r.accountant_bank_setup_check,
        executiveFinalCheck:              !!r.executive_final_check,
        remittanceSlipFilePath:           r.remittance_slip_file_path ?? null,
        paymentReceiptScanUploaded:       !!r.payment_receipt_scan_uploaded,
        paymentReceiptScanUrl:            r.payment_receipt_scan_url ?? null,
        lastReceiptEmailStatus:           r.last_receipt_email_status ?? null,
        lastPrintedAt:                    r.last_printed_at ? new Date(r.last_printed_at).toISOString() : null,
        medicalReceipts: Array.isArray(r.medical_receipts)
            ? r.medical_receipts.map((m: any) => ({
                fileUrl: m.fileUrl ?? m.file_url ?? '',
                uploadedAt: m.uploadedAt ?? m.uploaded_at ?? null,
              }))
            : [],
        donorDisclosureConsent:           r.donor_disclosure_consent ?? null,
        donorConsentLetterUploaded:       !!r.donor_consent_letter_uploaded,
        donorConsentLetterUrl:            r.donor_consent_letter_url ?? null,
        passbookCoverUploaded:            !!r.passbook_cover_uploaded,
        passbookCoverUrl:                 r.passbook_cover_url ?? null,
    };
}

const SELECT_ALL_COLS = `
    id, application_id, receipt_number, external_code, amount,
    payee_name, payee_id_number, payee_relation, payee_relation_other,
    payment_method, bank_name, bank_branch, bank_account,
    sent_at, received_at, receipt_file_path, remittance_slip_file_path, medical_receipt_status, notes,
    created_by, created_at, updated_at,
    review_stage, officer_signed_at,
    supervisor_user_id, supervisor_signed_at,
    accountant_user_id, accountant_signed_at,
    executive_user_id, executive_signed_at,
    rejected_reason, rejected_at, rejected_by, rejected_from_stage,
    officer_doc_check, supervisor_doc_check,
    accountant_medical_uploaded_check, accountant_amount_match_check,
    accountant_board_opinion_check, accountant_bank_setup_check,
    executive_final_check
`;

// 通知（暫以 audit log 留痕，實際 email/LINE dispatch 由通知 dispatcher 補上）
function logNotificationStub(reason: string, applicationId: string, disbursementId: string, recipients: string[]) {
    // TODO(#12 Phase 4)：串接 notification_logs + LINE/email dispatcher
    console.info('[disbursement notify]', { reason, applicationId, disbursementId, recipients });
}

// ─── 查詢撥款列表 + 摘要 ─────────────────────────────────────────────────

const VIEW_ROLES = ['case_officer', 'supervisor', 'accountant', 'executive', 'admin', 'chairman'];

export async function fetchDisbursements(
    operatorUserId: string,
    applicationId: string,
): Promise<ActionResult<DisbursementSummary>> {
    if (!(await hasAnyRole(operatorUserId, VIEW_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    if (!/^\d+$/.test(applicationId)) {
        return { success: false, error: '無效的案件 ID' };
    }

    const client = await pool.connect();
    try {
        const appRes = await client.query(
            `SELECT approved_amount FROM applications WHERE id = $1::bigint`,
            [applicationId]
        );
        if (appRes.rowCount === 0) return { success: false, error: '案件不存在' };
        const approvedAmount = appRes.rows[0].approved_amount != null
            ? Number(appRes.rows[0].approved_amount) : 0;

        const dRes = await client.query(
            `SELECT ${SELECT_ALL_COLS},
                    EXISTS (SELECT 1 FROM application_documents ad
                            WHERE ad.id = 18 AND ad.disbursement_id = payment_disbursements.id
                              AND ad.file_path IS NOT NULL) AS payment_receipt_scan_uploaded,
                    (SELECT file_path FROM application_documents ad3
                     WHERE ad3.id = 18 AND ad3.disbursement_id = payment_disbursements.id
                       AND ad3.file_path IS NOT NULL
                     ORDER BY ad3.uploaded_at DESC LIMIT 1) AS payment_receipt_scan_url,
                    (SELECT nl.status FROM notification_logs nl
                     WHERE nl.disbursement_id = payment_disbursements.id
                       AND nl.template_id IN (SELECT id FROM notification_templates WHERE name = 'email_case_payment_receipt_to_applicant')
                     ORDER BY nl.sent_at DESC LIMIT 1) AS last_receipt_email_status,
                    (SELECT MAX(created_at) FROM audit_logs
                     WHERE action = 'payment_disbursement.print_merged'
                       AND target_id = payment_disbursements.id::text) AS last_printed_at,
                    (SELECT COALESCE(json_agg(json_build_object(
                        'fileUrl',    file_path,
                        'uploadedAt', uploaded_at
                     ) ORDER BY uploaded_at DESC), '[]'::json)
                     FROM application_documents ad2
                     WHERE ad2.id = 17 AND ad2.disbursement_id = payment_disbursements.id
                       AND ad2.file_path IS NOT NULL) AS medical_receipts,
                    /* user feedback #12：捐贈聲明書 + 存摺封面（per-disbursement） */
                    payment_disbursements.donor_disclosure_consent,
                    EXISTS (SELECT 1 FROM application_documents ad4
                            WHERE ad4.id = 22 AND ad4.disbursement_id = payment_disbursements.id
                              AND ad4.file_path IS NOT NULL) AS donor_consent_letter_uploaded,
                    (SELECT file_path FROM application_documents ad4u
                     WHERE ad4u.id = 22 AND ad4u.disbursement_id = payment_disbursements.id
                       AND ad4u.file_path IS NOT NULL
                     ORDER BY uploaded_at DESC LIMIT 1) AS donor_consent_letter_url,
                    EXISTS (SELECT 1 FROM application_documents ad5
                            WHERE ad5.id = 21 AND ad5.disbursement_id = payment_disbursements.id
                              AND ad5.file_path IS NOT NULL) AS passbook_cover_uploaded,
                    (SELECT file_path FROM application_documents ad5u
                     WHERE ad5u.id = 21 AND ad5u.disbursement_id = payment_disbursements.id
                       AND ad5u.file_path IS NOT NULL
                     ORDER BY uploaded_at DESC LIMIT 1) AS passbook_cover_url
             FROM payment_disbursements
             WHERE application_id = $1::bigint
             ORDER BY created_at ASC`,
            [applicationId]
        );
        const disbursements = dRes.rows.map(rowToDisbursement);
        const completed = disbursements.filter(d => d.reviewStage === '9');
        const inFlight  = disbursements.filter(d => ['1','2','3','4'].includes(d.reviewStage));
        const totalDisbursed = completed.reduce((s, d) => s + d.amount, 0);
        const totalInFlight  = inFlight.reduce((s, d) => s + d.amount, 0);
        const totalReceived  = completed.filter(d => d.receivedAt).reduce((s, d) => s + d.amount, 0);
        const missingRemittanceSlip = completed.find(d => d.receivedAt && !d.remittanceSlipFilePath);
        const closeCaseBlockReason = missingRemittanceSlip
            ? `撥款單號${missingRemittanceSlip.externalCode || missingRemittanceSlip.receiptNumber}未上傳匯款單掃描檔`
            : totalReceived < approvedAmount
                ? '尚有撥款未完成回收紙本；累積回收金額需達核定金額才能結案'
                : null;

        return {
            success: true,
            data: {
                approvedAmount,
                totalDisbursed,
                totalReceived,
                totalInFlight,
                remaining: approvedAmount - totalDisbursed - totalInFlight,
                canCloseCase: approvedAmount > 0 && !closeCaseBlockReason,
                closeCaseBlockReason,
                hasInFlight: inFlight.length > 0,
                disbursements,
            },
        };
    } catch (err: any) {
        console.error('fetchDisbursements error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

// ─── 建立新撥款（個管師） ──────────────────────────────────────────────

export interface CreateDisbursementInput {
    applicationId: string;
    amount: number;
    payeeName?: string;
    payeeIdNumber?: string;
    payeeRelation?: string;
    payeeRelationOther?: string;
    paymentMethod?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccount?: string;
    sentAt?: string;
    notes?: string;
}

export async function createDisbursement(
    operatorUserId: string,
    input: CreateDisbursementInput,
): Promise<ActionResult<PaymentDisbursement>> {
    if (!(await hasAnyRole(operatorUserId, ['case_officer', 'admin']))) {
        return { success: false, error: '僅個管師、admin 可建立撥款' };
    }
    if (!/^\d+$/.test(input.applicationId)) return { success: false, error: '無效的案件 ID' };
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
        return { success: false, error: '金額必須大於 0' };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 串行守門：是否已有 in-flight 撥款
        const inFlightRes = await client.query(
            `SELECT 1 FROM payment_disbursements
             WHERE application_id = $1::bigint AND review_stage IN ('1','2','3','4')
             LIMIT 1`,
            [input.applicationId]
        );
        if ((inFlightRes.rowCount ?? 0) > 0) {
            await client.query('ROLLBACK');
            return {
                success: false,
                error: '本案已有一筆撥款在審核流程中，待該筆完成或退件後才能建立新撥款',
            };
        }

        // 累積金額守門：approved - completed - 本筆 ≥ 0
        const aggRes = await client.query(
            `SELECT a.approved_amount,
                    COALESCE(SUM(d.amount) FILTER (WHERE d.review_stage = '9'), 0) AS completed_total
             FROM applications a
             LEFT JOIN payment_disbursements d ON d.application_id = a.id
             WHERE a.id = $1::bigint
             GROUP BY a.id, a.approved_amount`,
            [input.applicationId]
        );
        if (aggRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件不存在' };
        }
        const approvedAmount = Number(aggRes.rows[0].approved_amount ?? 0);
        const completedTotal = Number(aggRes.rows[0].completed_total ?? 0);
        if (approvedAmount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件尚無核定金額（董事審核未通過或未推進核銷）' };
        }
        if (completedTotal + input.amount > approvedAmount) {
            await client.query('ROLLBACK');
            return {
                success: false,
                error: `本次金額 ${input.amount.toLocaleString()} 元 + 已撥 ${completedTotal.toLocaleString()} 元，超過核定金額 ${approvedAmount.toLocaleString()} 元`,
            };
        }

        const { receiptNumber, externalCode } = await generateReceiptIdentifiers(client);

        const insRes = await client.query(
            `INSERT INTO payment_disbursements
                (application_id, receipt_number, external_code, amount,
                 payee_name, payee_id_number, payee_relation, payee_relation_other,
                 payment_method, bank_name, bank_branch, bank_account,
                 sent_at, notes, created_by, review_stage)
             VALUES ($1::bigint, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::bigint, '1')
             RETURNING ${SELECT_ALL_COLS}`,
            [
                input.applicationId, receiptNumber, externalCode, input.amount,
                input.payeeName ?? null, input.payeeIdNumber ?? null, input.payeeRelation ?? null,
                input.payeeRelationOther ?? null,
                input.paymentMethod ?? null, input.bankName ?? null, input.bankBranch ?? null, input.bankAccount ?? null,
                input.sentAt ?? null, input.notes ?? null, operatorUserId,
            ]
        );
        const created = rowToDisbursement(insRes.rows[0]);

        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId,
            action: 'payment_disbursement.created',
            targetType: 'payment_disbursement',
            targetId: created.id,
            detail: {
                application_id: input.applicationId,
                receipt_number: receiptNumber,
                external_code: externalCode,
                amount: input.amount,
                review_stage: '1',
            },
        });

        return { success: true, data: created };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('createDisbursement error:', err);
        return { success: false, error: err.message ?? '建立失敗' };
    } finally {
        client.release();
    }
}

// ─── 個管師端編輯（stage='1' 期間可改撥款資料） ──────────────────────

export interface UpdateDisbursementInput {
    amount?: number;
    payeeName?: string;
    payeeIdNumber?: string;
    payeeRelation?: string;
    payeeRelationOther?: string;
    paymentMethod?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccount?: string;
    sentAt?: string | null;
    receivedAt?: string | null;
    receiptFilePath?: string | null;
    notes?: string;
}

export async function updateDisbursement(
    operatorUserId: string,
    disbursementId: string,
    input: UpdateDisbursementInput,
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };
    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT pd.review_stage, pd.application_id::text, a.status AS application_status
             FROM payment_disbursements pd
             JOIN applications a ON a.id = pd.application_id
             WHERE pd.id = $1::bigint`,
            [disbursementId]
        );
        if (cur.rowCount === 0) return { success: false, error: '撥款紀錄不存在' };
        const stage = cur.rows[0].review_stage as ReviewStage;
        const inputKeys = Object.keys(input);
        const sentAtOnlyUpdate = inputKeys.length === 1 && input.sentAt !== undefined;
        // 僅 stage='1'（個管師持有中）允許編輯
        if (stage !== '1') {
            if (!(stage === '9' && sentAtOnlyUpdate && cur.rows[0].application_status !== '4')) {
                return { success: false, error: `撥款已進入 ${REVIEW_STAGE_LABEL[stage]}，無法編輯` };
            }
        }
        if (!(await hasAnyRole(operatorUserId, ['case_officer', 'admin']))) {
            return { success: false, error: '權限不足' };
        }

        // 動態組欄位
        const sets: string[] = [];
        const vals: unknown[] = [];
        const push = (col: string, val: unknown) => {
            vals.push(val);
            sets.push(`${col} = $${vals.length}`);
        };
        if (input.amount !== undefined) {
            if (!Number.isFinite(input.amount) || input.amount <= 0) {
                return { success: false, error: '金額必須大於 0' };
            }
            push('amount', input.amount);
        }
        if (input.payeeName       !== undefined) push('payee_name',       input.payeeName       || null);
        if (input.payeeIdNumber   !== undefined) push('payee_id_number',  input.payeeIdNumber   || null);
        if (input.payeeRelation   !== undefined) push('payee_relation',   input.payeeRelation   || null);
        if (input.payeeRelationOther !== undefined) push('payee_relation_other', input.payeeRelationOther || null);
        if (input.paymentMethod   !== undefined) push('payment_method',   input.paymentMethod   || null);
        if (input.bankName        !== undefined) push('bank_name',        input.bankName        || null);
        if (input.bankBranch      !== undefined) push('bank_branch',      input.bankBranch      || null);
        if (input.bankAccount     !== undefined) push('bank_account',     input.bankAccount     || null);
        if (input.sentAt          !== undefined) push('sent_at',          input.sentAt          || null);
        if (input.receivedAt      !== undefined) push('received_at',      input.receivedAt      || null);
        if (input.receiptFilePath !== undefined) push('receipt_file_path', input.receiptFilePath || null);
        if (input.notes           !== undefined) push('notes',            input.notes           || null);
        if (sets.length === 0) return { success: true, data: undefined };
        sets.push('updated_at = NOW()');
        vals.push(disbursementId);

        await client.query(
            `UPDATE payment_disbursements SET ${sets.join(', ')} WHERE id = $${vals.length}::bigint`,
            vals
        );

        void writeAuditLog({
            userId: operatorUserId,
            action: 'payment_disbursement.updated',
            targetType: 'payment_disbursement',
            targetId: disbursementId,
            detail: {
                application_id: cur.rows[0].application_id,
                changed_fields: Object.keys(input),
            },
        });
        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('updateDisbursement error:', err);
        return { success: false, error: err.message ?? '更新失敗' };
    } finally {
        client.release();
    }
}

// ─── 推進審核 stage（共用） ──────────────────────────────────────────

interface AdvanceConfig {
    fromStage: ReviewStage;
    toStage:   ReviewStage;
    label:     string;       // 操作名稱（用於 audit / 訊息）
    /** 寫入哪些欄位 — 例如進到 stage='2' 時要寫 officer_signed_at 與 supervisor_user_id 之外，
        進到 stage='3' 時要寫 supervisor_user_id + supervisor_signed_at */
    setColumns: (operatorUserId: string) => Record<string, unknown>;
    /** Checklist 守門：在 advance 前驗證 checklist 欄位 + 額外前置條件。
        回傳 null 表示通過；否則回傳錯誤訊息。
        client 已在 transaction 中、cur 為 SELECT FOR UPDATE 後的 row。 */
    checklistGate?: (client: any, disbursementId: string, cur: any) => Promise<string | null>;
}

// ─── Checklist 守門小工具 ─────────────────────────────────────────────

async function checkOfficerGate(client: any, disbursementId: string, cur: any): Promise<string | null> {
    if (!cur.officer_doc_check) {
        return '請先勾選「線上/紙本文件齊全」檢核項';
    }
    // 領款收據（document_type_config.id=18）必須已上傳
    const recRes = await client.query(
        `SELECT 1 FROM application_documents
         WHERE id = 18 AND disbursement_id = $1::bigint AND file_path IS NOT NULL
         LIMIT 1`,
        [disbursementId]
    );
    if (recRes.rowCount === 0) {
        return '尚未上傳領款收據紙本掃描檔';
    }
    // 醫療收據（document_type_config.id=17）改由個管階段上傳，並需標記正式收據/未繳款領據
    const medRes = await client.query(
        `SELECT 1 FROM application_documents
         WHERE id = 17 AND disbursement_id = $1::bigint AND file_path IS NOT NULL
         LIMIT 1`,
        [disbursementId]
    );
    if (medRes.rowCount === 0) {
        return '尚未上傳醫療收據 PDF';
    }
    if (!cur.medical_receipt_status) {
        return '請先選擇醫療收據狀態（正式收據 / 未繳款領據）';
    }
    // 已成功寄送過領款收據 email（最近一次需為 sent）
    const mailRes = await client.query(
        `SELECT status FROM notification_logs
         WHERE disbursement_id = $1::bigint
           AND template_id IN (SELECT id FROM notification_templates WHERE name = 'email_case_payment_receipt_to_applicant')
         ORDER BY sent_at DESC LIMIT 1`,
        [disbursementId]
    );
    if (mailRes.rowCount === 0) {
        return '尚未寄送領款收據 email 給申請人';
    }
    if (mailRes.rows[0].status !== 'sent') {
        return '上次寄送領款收據 email 失敗，請重新寄送';
    }
    // 存摺封面（document_type_config.id=21）必須已上傳（每次撥款都要）
    const passRes = await client.query(
        `SELECT 1 FROM application_documents
         WHERE id = 21 AND disbursement_id = $1::bigint AND file_path IS NOT NULL
         LIMIT 1`,
        [disbursementId]
    );
    if (passRes.rowCount === 0) {
        return '尚未上傳存摺封面（每次撥款都需上傳）';
    }
    // 若不同意公開捐贈者姓名，需上傳「捐贈/受補助者聲明書」（doc id=22）
    const consentRes = await client.query(
        `SELECT donor_disclosure_consent FROM payment_disbursements WHERE id = $1::bigint`,
        [disbursementId]
    );
    const consent = consentRes.rows[0]?.donor_disclosure_consent;
    if (consent === null || consent === undefined) {
        return '請先確認「是否同意公開捐贈者姓名」';
    }
    if (consent === false) {
        const letterRes = await client.query(
            `SELECT 1 FROM application_documents
             WHERE id = 22 AND disbursement_id = $1::bigint AND file_path IS NOT NULL
             LIMIT 1`,
            [disbursementId]
        );
        if (letterRes.rowCount === 0) {
            return '勾選「不同意公開捐贈者姓名」時，需上傳捐贈/受補助者聲明書';
        }
    }
    const finalRes = await client.query(
        `SELECT a.approved_amount,
                COALESCE((
                    SELECT SUM(pd.amount)
                    FROM payment_disbursements pd
                    WHERE pd.application_id = a.id
                      AND pd.id <> $2::bigint
                      AND pd.review_stage = '9'
                ), 0) AS completed_amount
         FROM applications a
         WHERE a.id = $1::bigint`,
        [cur.application_id, disbursementId]
    );
    const approvedAmount = Number(finalRes.rows[0]?.approved_amount ?? 0);
    const completedAmount = Number(finalRes.rows[0]?.completed_amount ?? 0);
    const currentAmount = Number(cur.amount ?? 0);
    if (approvedAmount > 0 && completedAmount + currentAmount >= approvedAmount && !cur.sent_at) {
        return '最後一筆補助款請填寫核發日期';
    }
    return null;
}

async function checkSupervisorGate(_client: any, _disbursementId: string, cur: any): Promise<string | null> {
    if (!cur.supervisor_doc_check) {
        return '請先勾選「領款收據已確認無誤」檢核項';
    }
    return null;
}

async function checkAccountantGate(_client: any, _disbursementId: string, cur: any): Promise<string | null> {
    if (!cur.accountant_medical_uploaded_check) return '請先勾選「醫療收據已上傳」';
    if (!cur.accountant_amount_match_check)     return '請先勾選「金額核對無誤」';
    if (!cur.accountant_board_opinion_check)    return '請先勾選「董事審核意見表 2 份」';
    if (!cur.accountant_bank_setup_check)       return '請先勾選「已設定銀行補助款」';
    return null;
}

async function checkExecutiveGate(_client: any, _disbursementId: string, cur: any): Promise<string | null> {
    if (!cur.executive_final_check) {
        return '請先勾選「申請表、家訪、審核意見表確認」檢核項';
    }
    return null;
}

const ADVANCE_CONFIGS: Record<string, AdvanceConfig> = {
    'submitOfficer': {  // 1 → 2
        fromStage: '1', toStage: '2', label: '個管師送出',
        setColumns: (uid) => ({ officer_signed_at: 'NOW()::ts', }),
        checklistGate: checkOfficerGate,
    },
    'submitSupervisor': {  // 2 → 3
        fromStage: '2', toStage: '3', label: '主管送出',
        setColumns: (uid) => ({ supervisor_user_id: uid, supervisor_signed_at: 'NOW()::ts' }),
        checklistGate: checkSupervisorGate,
    },
    'submitAccountant': {  // 3 → 4
        fromStage: '3', toStage: '4', label: '會計送出',
        setColumns: (uid) => ({ accountant_user_id: uid, accountant_signed_at: 'NOW()::ts' }),
        checklistGate: checkAccountantGate,
    },
    'submitExecutive': {  // 4 → 9
        fromStage: '4', toStage: '9', label: '執行長完成',
        setColumns: (uid) => ({ executive_user_id: uid, executive_signed_at: 'NOW()::ts' }),
        checklistGate: checkExecutiveGate,
    },
};

async function advanceStageInternal(
    operatorUserId: string,
    disbursementId: string,
    cfg: AdvanceConfig,
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };
    const allowed = rolesForStage(cfg.fromStage);
    if (!(await hasAnyRole(operatorUserId, allowed))) {
        return { success: false, error: `僅 ${allowed.join('/')} 可在 ${REVIEW_STAGE_LABEL[cfg.fromStage]} 階段操作` };
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cur = await client.query(
            `SELECT review_stage, application_id::text, receipt_number, amount,
                    officer_doc_check, supervisor_doc_check,
                    accountant_medical_uploaded_check, accountant_amount_match_check,
                    accountant_board_opinion_check, accountant_bank_setup_check,
                    executive_final_check,
                    medical_receipt_status,
                    sent_at
             FROM payment_disbursements WHERE id = $1::bigint FOR UPDATE`,
            [disbursementId]
        );
        if (cur.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '撥款紀錄不存在' };
        }
        const curStage = cur.rows[0].review_stage as ReviewStage;
        if (curStage !== cfg.fromStage) {
            await client.query('ROLLBACK');
            return { success: false, error: `當前狀態為「${REVIEW_STAGE_LABEL[curStage]}」，無法執行此操作` };
        }

        // Checklist 守門
        if (cfg.checklistGate) {
            const gateError = await cfg.checklistGate(client, disbursementId, cur.rows[0]);
            if (gateError) {
                await client.query('ROLLBACK');
                return { success: false, error: gateError };
            }
        }

        // 組 UPDATE：review_stage + 各層簽核欄位 + clear rejection 痕跡
        const setSnippets: string[] = [`review_stage = '${cfg.toStage}'`, `updated_at = NOW()`];
        const params: unknown[] = [];
        const cols = cfg.setColumns(operatorUserId);
        for (const [col, val] of Object.entries(cols)) {
            if (val === 'NOW()::ts') {
                setSnippets.push(`${col} = NOW()`);
            } else {
                params.push(val);
                setSnippets.push(`${col} = $${params.length}::bigint`);
            }
        }
        // 推進時清空退件痕跡（避免被重新送出後仍顯示舊原因）
        setSnippets.push('rejected_reason = NULL', 'rejected_at = NULL', 'rejected_by = NULL', 'rejected_from_stage = NULL');

        params.push(disbursementId);
        await client.query(
            `UPDATE payment_disbursements SET ${setSnippets.join(', ')} WHERE id = $${params.length}::bigint`,
            params
        );
        await client.query('COMMIT');

        const isFinal = cfg.toStage === '9';
        void writeAuditLog({
            userId: operatorUserId,
            action: isFinal ? 'payment_disbursement.completed' : 'payment_disbursement.submitted',
            targetType: 'payment_disbursement',
            targetId: disbursementId,
            detail: {
                application_id: cur.rows[0].application_id,
                receipt_number: cur.rows[0].receipt_number,
                from_stage: cfg.fromStage,
                to_stage: cfg.toStage,
                action_label: cfg.label,
            },
        });
        if (isFinal) {
            // 撥款完成通知（fire-and-forget；失敗不影響流程）
            const applicationId = cur.rows[0].application_id;
            void (async () => {
                try {
                    const { notifyEvent } = await import('./notificationDispatcher');
                    await notifyEvent('disbursement_completed', { applicationId, disbursementId });
                } catch (err) {
                    console.error('[disbursement] notify completed failed', err);
                }
            })();
        } else {
            const roleMap: Record<string, string> = { '2': 'supervisor', '3': 'accountant', '4': 'executive' };
            logNotificationStub('submitted',
                cur.rows[0].application_id, disbursementId,
                [roleMap[cfg.toStage] ?? '']);
        }
        return { success: true, data: undefined };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error(`advanceStage(${cfg.label}) error:`, err);
        return { success: false, error: err.message ?? '操作失敗' };
    } finally {
        client.release();
    }
}

export async function submitOfficerStage(operatorUserId: string, disbursementId: string) {
    return advanceStageInternal(operatorUserId, disbursementId, ADVANCE_CONFIGS.submitOfficer);
}
export async function submitSupervisorStage(operatorUserId: string, disbursementId: string) {
    return advanceStageInternal(operatorUserId, disbursementId, ADVANCE_CONFIGS.submitSupervisor);
}
export async function submitAccountantStage(operatorUserId: string, disbursementId: string) {
    return advanceStageInternal(operatorUserId, disbursementId, ADVANCE_CONFIGS.submitAccountant);
}
export async function submitExecutiveStage(operatorUserId: string, disbursementId: string) {
    return advanceStageInternal(operatorUserId, disbursementId, ADVANCE_CONFIGS.submitExecutive);
}

// ─── 歷史醫療收據（accountant only） ────────────────────────────────

export interface HistoricalMedicalReceipt {
    caseNumber: string;
    caseStatus: string;          // '3' = 待核銷 / '4' = 核銷完成
    disbursementSeq: number;     // 該案中第 N 次撥款
    receiptNumber: string;       // 內碼（YYYY-MM-NNNN）
    externalCode: string;        // 外碼（6 字元）
    disbursementAmount: number;
    fileUrl: string;
    uploadedAt: string | null;
}

/**
 * 撈該申請人所有案件中的歷史醫療收據（含當前案件 + 過去結案案件）。
 * 僅 accountant 可呼叫。
 */
export async function fetchApplicantHistoricalMedicalReceipts(
    operatorUserId: string,
    applicantId: string,
): Promise<ActionResult<HistoricalMedicalReceipt[]>> {
    if (!(await hasAnyRole(operatorUserId, ['accountant']))) {
        return { success: false, error: '僅會計可查看歷史醫療收據' };
    }
    if (!applicantId || !/^\d+$/.test(applicantId)) {
        return { success: false, error: '無效的申請人 ID' };
    }

    const client = await pool.connect();
    try {
        const r = await client.query(
            `WITH applicant_apps AS (
                SELECT id, case_number, status FROM applications WHERE applicant_id = $1::bigint
            ),
            ranked_disbursements AS (
                SELECT pd.id, pd.application_id, pd.receipt_number, pd.external_code, pd.amount,
                       ROW_NUMBER() OVER (PARTITION BY pd.application_id ORDER BY pd.created_at ASC) AS seq
                FROM payment_disbursements pd
                WHERE pd.application_id IN (SELECT id FROM applicant_apps)
            )
            SELECT a.case_number, a.status AS case_status,
                   rd.seq, rd.receipt_number, rd.external_code, rd.amount,
                   ad.file_path, ad.uploaded_at
            FROM application_documents ad
            JOIN ranked_disbursements rd ON rd.id = ad.disbursement_id
            JOIN applicant_apps a ON a.id = ad.application_id
            WHERE ad.id = 17 AND ad.disbursement_id IS NOT NULL AND ad.file_path IS NOT NULL
            ORDER BY a.case_number ASC, rd.seq ASC, ad.uploaded_at ASC`,
            [applicantId]
        );
        const data: HistoricalMedicalReceipt[] = r.rows.map((row: any) => ({
            caseNumber: row.case_number,
            caseStatus: row.case_status,
            disbursementSeq: Number(row.seq),
            receiptNumber: row.receipt_number,
            externalCode: row.external_code ?? '',
            disbursementAmount: Number(row.amount),
            fileUrl: row.file_path,
            uploadedAt: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : null,
        }));
        return { success: true, data };
    } catch (err: any) {
        console.error('fetchApplicantHistoricalMedicalReceipts error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

// ─── 案件輔助資料（給撥款 row 的【檢視申請表/家訪/審核意見】用） ─────

export interface CaseAuxiliaryData {
    applicationFormUrl: string | null;          // doc id=1 申請表
    homeVisit: {
        visitDate: string | null;
        visitorName: string | null;
        visitorTitle: string | null;
        selfReportedCondition: string | null;
        diseaseReactionStatus: string | null;
        diseaseReactionOther: string | null;
        treatmentAttitudeStatus: string | null;
        treatmentAttitudeOther: string | null;
        primaryCaregiver: string | null;
        primaryCaregiverOther: string | null;
        familyInteractionStatus: string | null;
        familyInteractionOther: string | null;
        impactedPartyThoughts: string | null;
        treatmentSupportStatus: string | null;
        treatmentSupportOther: string | null;
        subsidyNeedReason: string | null;
        visitorRecommendations: string | null;
        visitorRecommendationsOther: string | null;
        otherStatusNotes: string | null;
        photoUrls: string[];
    } | null;
    boardReview: {
        approvedAmount: number | null;
        boardReviewComments: string | null;     // 彙整後的文字
        signatures: { signerName: string; signedAt: string | null; memberAmount?: number | null; memberComments?: string | null }[];
        rounds: Array<{
            id: string;
            roundNo: number;
            isLatest: boolean;
            approvedAmount: number | null;
            comments: string | null;
            completedAt: string | null;
            signatures: Array<{ signerName: string; signedAt: string | null; memberAmount?: number | null; memberComments?: string | null }>;
        }>;
    };
}

export async function fetchCaseAuxiliaryData(
    operatorUserId: string,
    applicationId: string,
): Promise<ActionResult<CaseAuxiliaryData>> {
    if (!(await hasAnyRole(operatorUserId, VIEW_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };

    const client = await pool.connect();
    try {
        // 申請表（doc id=1, case-level）
        const docRes = await client.query(
            `SELECT file_path FROM application_documents
             WHERE application_id = $1::bigint AND id = 1 AND disbursement_id IS NULL
               AND file_path IS NOT NULL LIMIT 1`,
            [applicationId]
        );
        const applicationFormUrl = docRes.rows[0]?.file_path ?? null;

        // 家訪紀錄（取最新一筆）
        const hvRes = await client.query(
            `SELECT id, visit_date, visitor_name, visitor_title,
                    self_reported_condition, disease_reaction_status, disease_reaction_other,
                    treatment_attitude_status, treatment_attitude_other,
                    primary_caregiver, primary_caregiver_other,
                    family_interaction_status, family_interaction_other,
                    impacted_party_thoughts, treatment_support_status, treatment_support_other,
                    subsidy_need_reason, visitor_recommendations, visitor_recommendations_other,
                    other_status_notes, visit_photo_urls
             FROM home_visit
             WHERE application_id = $1::bigint
             ORDER BY visit_date DESC NULLS LAST, id DESC LIMIT 1`,
            [applicationId]
        );
        let homeVisit: CaseAuxiliaryData['homeVisit'] = null;
        if (hvRes.rowCount && hvRes.rowCount > 0) {
            const hv = hvRes.rows[0];
            homeVisit = {
                visitDate: formatDateOnly(hv.visit_date),
                visitorName: hv.visitor_name ?? null,
                visitorTitle: hv.visitor_title ?? null,
                selfReportedCondition: hv.self_reported_condition ?? null,
                diseaseReactionStatus: hv.disease_reaction_status ?? null,
                diseaseReactionOther: hv.disease_reaction_other ?? null,
                treatmentAttitudeStatus: hv.treatment_attitude_status ?? null,
                treatmentAttitudeOther: hv.treatment_attitude_other ?? null,
                primaryCaregiver: hv.primary_caregiver ?? null,
                primaryCaregiverOther: hv.primary_caregiver_other ?? null,
                familyInteractionStatus: hv.family_interaction_status ?? null,
                familyInteractionOther: hv.family_interaction_other ?? null,
                impactedPartyThoughts: hv.impacted_party_thoughts ?? null,
                treatmentSupportStatus: hv.treatment_support_status ?? null,
                treatmentSupportOther: hv.treatment_support_other ?? null,
                subsidyNeedReason: hv.subsidy_need_reason ?? null,
                visitorRecommendations: hv.visitor_recommendations ?? null,
                visitorRecommendationsOther: hv.visitor_recommendations_other ?? null,
                otherStatusNotes: hv.other_status_notes ?? null,
                photoUrls: Array.isArray(hv.visit_photo_urls) ? hv.visit_photo_urls : [],
            };
        }

        // 董事審核意見：approved_amount + 彙整 comments + 簽章列表
        const appRes = await client.query(
            `SELECT approved_amount, board_review_comments
             FROM applications WHERE id = $1::bigint`,
            [applicationId]
        );
        const sigRes = await client.query(
            `SELECT s.signed_at, s.member_amount, s.member_comments, u.name_enc, u.name_iv, u.account
             FROM board_review_signatures s
             JOIN users u ON u.id = s.signer_user_id
             WHERE s.application_id = $1::bigint
             ORDER BY s.signed_at ASC NULLS LAST`,
            [applicationId]
        );
        const { decryptAES } = await import('../../lib/crypto');
        const signatures = sigRes.rows.map((r: any) => ({
            signerName: r.name_enc && r.name_iv
                ? (decryptAES(r.name_enc, r.name_iv) || r.account)
                : (r.account ?? '未知'),
            signedAt: r.signed_at ? new Date(r.signed_at).toISOString() : null,
            memberAmount: r.member_amount != null ? Number(r.member_amount) : null,
            memberComments: r.member_comments ?? null,
        }));
        const roundRes = await client.query(
            `SELECT id::text, round_no, approved_amount, comments, signatures, completed_at, is_latest
             FROM board_review_rounds
             WHERE application_id = $1::bigint
             ORDER BY round_no DESC`,
            [applicationId]
        );
        const rounds = roundRes.rows.map((r: any) => ({
            id: String(r.id),
            roundNo: Number(r.round_no),
            isLatest: !!r.is_latest,
            approvedAmount: r.approved_amount != null ? Number(r.approved_amount) : null,
            comments: r.comments ?? null,
            completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
            signatures: Array.isArray(r.signatures)
                ? r.signatures.map((s: any) => ({
                    signerName: s.signerName ?? s.signer_name ?? s.account ?? '未知',
                    signedAt: s.signedAt ?? s.signed_at ?? null,
                    memberAmount: s.memberAmount != null ? Number(s.memberAmount) : s.member_amount != null ? Number(s.member_amount) : null,
                    memberComments: s.memberComments ?? s.member_comments ?? null,
                }))
                : [],
        }));
        if (rounds.length === 0 && (appRes.rows[0]?.board_review_comments || signatures.length > 0)) {
            rounds.push({
                id: 'legacy-current',
                roundNo: 1,
                isLatest: true,
                approvedAmount: appRes.rows[0]?.approved_amount != null ? Number(appRes.rows[0].approved_amount) : null,
                comments: appRes.rows[0]?.board_review_comments ?? null,
                completedAt: null,
                signatures,
            });
        }

        return {
            success: true,
            data: {
                applicationFormUrl,
                homeVisit,
                boardReview: {
                    approvedAmount: appRes.rows[0]?.approved_amount != null
                        ? Number(appRes.rows[0].approved_amount) : null,
                    boardReviewComments: appRes.rows[0]?.board_review_comments ?? null,
                    signatures,
                    rounds,
                },
            },
        };
    } catch (err: any) {
        console.error('fetchCaseAuxiliaryData error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

// ─── 撥款列印歷史 — UI hover 顯示用 ────────────────────────────────

export async function fetchLastPrintMeta(
    operatorUserId: string,
    disbursementId: string,
): Promise<ActionResult<{ operatorName: string | null; printedAt: string | null; selected: string[] } | null>> {
    if (!(await hasAnyRole(operatorUserId, VIEW_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    const client = await pool.connect();
    try {
        const r = await client.query(
            `SELECT al.created_at, al.detail, u.account, u.name_enc, u.name_iv
             FROM audit_logs al
             LEFT JOIN users u ON u.id = al.user_id
             WHERE al.action = 'payment_disbursement.print_merged' AND al.target_id = $1
             ORDER BY al.created_at DESC LIMIT 1`,
            [disbursementId]
        );
        if (r.rowCount === 0) return { success: true, data: null };
        const row = r.rows[0];
        let name: string | null = null;
        if (row.name_enc && row.name_iv) {
            try {
                const { decryptAES } = await import('../../lib/crypto');
                name = decryptAES(row.name_enc, row.name_iv) || row.account;
            } catch { name = row.account; }
        } else {
            name = row.account ?? null;
        }
        return {
            success: true,
            data: {
                operatorName: name,
                printedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
                selected: Array.isArray(row.detail?.selected) ? row.detail.selected : [],
            }
        };
    } finally {
        client.release();
    }
}

// ─── 個管寄送領款收據（refine-disbursement-flow，task 4.1 + 4.2） ──────

/**
 * 產生指定撥款的領款收據 PDF，存到 blob/local 並回傳路徑。
 * 僅 case_officer 於 review_stage='1' 可呼叫。
 * 回傳路徑與 PaymentReceiptPdf 結構由現有 generatePaymentReceiptPdf + storage 模組共享。
 * 注意：每次呼叫都產生新檔，不覆寫舊版（保留歷次紀錄）。
 */
export async function generateDisbursementPaymentReceipt(
    operatorUserId: string,
    disbursementId: string,
): Promise<ActionResult<{ filePath: string }>> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };
    if (!(await hasAnyRole(operatorUserId, ['case_officer']))) {
        return { success: false, error: '僅個管師可產生領款收據' };
    }

    const client = await pool.connect();
    let applicationId: string;
    let caseNumber: string;
    let overrides: import('../../lib/pdf/generateDisbursementPaymentReceiptPdf').DisbursementOverrides;
    try {
        const r = await client.query(
            `SELECT pd.review_stage, pd.application_id::text, pd.amount, pd.external_code,
                    pd.payment_method, pd.bank_name, pd.bank_branch, pd.bank_account,
                    pd.payee_name, pd.payee_relation, pd.payee_relation_other,
                    a.case_number
             FROM payment_disbursements pd
             JOIN applications a ON a.id = pd.application_id
             WHERE pd.id = $1::bigint`,
            [disbursementId]
        );
        if (r.rowCount === 0) return { success: false, error: '撥款紀錄不存在' };
        const stage = r.rows[0].review_stage as ReviewStage;
        if (stage !== '1') return { success: false, error: `當前狀態為「${REVIEW_STAGE_LABEL[stage]}」，無法產生領款收據` };
        applicationId = r.rows[0].application_id;
        caseNumber = r.rows[0].case_number;
        overrides = {
            amount: Number(r.rows[0].amount),
            externalCode: r.rows[0].external_code ?? '',
            paymentMethod: r.rows[0].payment_method,
            bankName: r.rows[0].bank_name,
            bankBranch: r.rows[0].bank_branch,
            bankAccount: r.rows[0].bank_account,
            payeeName: r.rows[0].payee_name,
            payeeRelation: r.rows[0].payee_relation,
            payeeRelationOther: r.rows[0].payee_relation_other,
        };
    } finally {
        client.release();
    }

    try {
        // 用一個 active admin 帳號繞過 fetchPaymentReceiptPrintData 的角色守門
        // （該函式守門 admin/accountant；個管不在白名單，但本 action 已驗 role + stage）
        const adminClient = await pool.connect();
        let adminUserId: string;
        try {
            const ar = await adminClient.query(
                `SELECT u.id::text AS id
                 FROM users u
                 JOIN user_roles ur ON ur.user_id = u.id
                 JOIN roles r ON r.id = ur.role_id
                 WHERE r.code = 'admin' AND u.is_active = TRUE
                 ORDER BY u.id ASC LIMIT 1`
            );
            if (ar.rowCount === 0) {
                return { success: false, error: '系統尚未建立 admin 帳號，無法產生 PDF' };
            }
            adminUserId = ar.rows[0].id;
        } finally {
            adminClient.release();
        }

        const { generateDisbursementPaymentReceiptPdf } = await import('../../lib/pdf/generateDisbursementPaymentReceiptPdf');
        const pdfBuffer = await generateDisbursementPaymentReceiptPdf(
            applicationId, adminUserId, overrides
        );

        // 存檔（每次新檔；保留歷次）
        const ts = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
        const fileName = `${caseNumber}_領款收據_disb${disbursementId}_${stamp}.pdf`;
        const localRel = `/uploads/${applicationId}/${fileName}`;
        const blobKey = `uploads/${applicationId}/${fileName}`;
        const { uploadFile } = await import('../../lib/storage');
        const publicUrl = await uploadFile(pdfBuffer, blobKey, localRel);

        // 將最近產生的 PDF 路徑寫入 receipt_file_path（既有欄位）作為「最新一份」
        const upClient = await pool.connect();
        try {
            await upClient.query(
                `UPDATE payment_disbursements
                 SET receipt_file_path = $1, updated_at = NOW()
                 WHERE id = $2::bigint`,
                [publicUrl, disbursementId]
            );
        } finally {
            upClient.release();
        }

        void writeAuditLog({
            userId: operatorUserId,
            action: 'payment_disbursement.receipt_generated',
            targetType: 'payment_disbursement',
            targetId: disbursementId,
            detail: { filePath: publicUrl, amount: overrides.amount },
        });
        return { success: true, data: { filePath: publicUrl } };
    } catch (err: any) {
        console.error('generateDisbursementPaymentReceipt error:', err);
        return { success: false, error: err.message ?? '產生 PDF 失敗' };
    }
}

/**
 * 個管於 review_stage='1' 寄送領款收據 email 給申請人。
 * 須先 generateDisbursementPaymentReceipt 過至少一次（receipt_file_path 不為空）。
 * 觸發 case_payment_receipt_to_applicant，dispatcher 會夾帶 PDF 並寫 notification_logs（含 disbursement_id）。
 */
export type DisbursementNotificationKind = 'approval' | 'receipt';

export interface DisbursementEmailRecipientInput {
    user_id: string;
    name: string;
    email: string;
    is_applicant?: boolean;
    is_bcc?: boolean;
    roles?: string[];
}

export async function sendDisbursementNotificationEmail(
    operatorUserId: string,
    disbursementId: string,
    kind: DisbursementNotificationKind,
    recipients: DisbursementEmailRecipientInput[],
    subject: string,
    body: string,
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };
    if (kind !== 'approval' && kind !== 'receipt') return { success: false, error: '不正確的通知類型' };
    if (!(await hasAnyRole(operatorUserId, ['case_officer']))) {
        return { success: false, error: '僅個管師可寄送撥款階段通知' };
    }
    const cleanRecipients = recipients
        .map(r => ({
            user_id: String(r.user_id ?? '').trim(),
            name: String(r.name ?? '').trim(),
            email: String(r.email ?? '').trim(),
            is_applicant: !!r.is_applicant,
            is_bcc: !!r.is_bcc,
            roles: r.roles ?? [],
        }))
        .filter(r => r.user_id && r.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));
    if (cleanRecipients.length === 0) return { success: false, error: '請至少設定一位有效收件人' };
    if (!cleanRecipients.some(r => r.is_applicant)) return { success: false, error: '收件人必須包含申請人' };
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject) return { success: false, error: '請輸入主旨' };
    if (!trimmedBody) return { success: false, error: '請輸入通知內容' };

    const client = await pool.connect();
    let applicationId = '';
    let caseNumber = '';
    let overrides: import('../../lib/pdf/generateDisbursementPaymentReceiptPdf').DisbursementOverrides | null = null;
    let hasReceiptPdf = false;
    try {
        const r = await client.query(
            `SELECT pd.review_stage, pd.application_id::text, pd.receipt_file_path,
                    pd.amount, pd.external_code, pd.payment_method, pd.bank_name, pd.bank_branch,
                    pd.bank_account, pd.payee_name, pd.payee_relation, pd.payee_relation_other,
                    a.case_number
             FROM payment_disbursements pd
             JOIN applications a ON a.id = pd.application_id
             WHERE pd.id = $1::bigint`,
            [disbursementId],
        );
        if (r.rowCount === 0) return { success: false, error: '撥款紀錄不存在' };
        const row = r.rows[0];
        const stage = row.review_stage as ReviewStage;
        if (stage !== '1') return { success: false, error: `當前狀態為「${REVIEW_STAGE_LABEL[stage]}」，無法寄送通知` };
        applicationId = row.application_id;
        caseNumber = row.case_number ?? applicationId;
        hasReceiptPdf = !!row.receipt_file_path;
        overrides = {
            amount: Number(row.amount),
            externalCode: row.external_code ?? '',
            paymentMethod: row.payment_method,
            bankName: row.bank_name,
            bankBranch: row.bank_branch,
            bankAccount: row.bank_account,
            payeeName: row.payee_name,
            payeeRelation: row.payee_relation,
            payeeRelationOther: row.payee_relation_other,
        };
    } finally {
        client.release();
    }

    if (kind === 'receipt' && !hasReceiptPdf) {
        return { success: false, error: '請先產生領款收據 PDF，再寄送領據通知' };
    }

    const templateName = kind === 'receipt'
        ? 'email_case_payment_receipt_to_applicant'
        : 'email_case_disbursement_approval_to_applicant';
    const templateClient = await pool.connect();
    let templateId: number | null = null;
    try {
        const tr = await templateClient.query(
            `SELECT id FROM notification_templates WHERE name = $1 AND status = 1 LIMIT 1`,
            [templateName],
        );
        templateId = tr.rows[0]?.id ?? null;
    } finally {
        templateClient.release();
    }

    let attachments: import('./notificationActions').EmailAttachment[] | undefined;
    if (kind === 'receipt') {
        const adminClient = await pool.connect();
        let adminUserId = '';
        try {
            const ar = await adminClient.query(
                `SELECT u.id::text AS id
                 FROM users u
                 JOIN user_roles ur ON ur.user_id = u.id
                 JOIN roles r ON r.id = ur.role_id
                 WHERE r.code = 'admin' AND u.is_active = TRUE
                 ORDER BY u.id ASC LIMIT 1`,
            );
            adminUserId = ar.rows[0]?.id ?? '';
        } finally {
            adminClient.release();
        }
        if (!adminUserId) return { success: false, error: '系統找不到可產生領據 PDF 的 admin 帳號' };
        const { generateDisbursementPaymentReceiptPdf } = await import('../../lib/pdf/generateDisbursementPaymentReceiptPdf');
        const pdfBuffer = await generateDisbursementPaymentReceiptPdf(applicationId, adminUserId, overrides ?? undefined);
        attachments = [{
            filename: `領款收據_${caseNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
        }];
    }

    try {
        const { sendNotificationEmail } = await import('./notificationActions');
        const res = await sendNotificationEmail(
            applicationId,
            cleanRecipients,
            trimmedSubject,
            trimmedBody,
            templateId,
            operatorUserId,
            false,
            attachments,
            kind === 'receipt' ? disbursementId : null,
        );
        if (!res.success) return { success: false, error: res.error ?? '通知寄送失敗' };

        void writeAuditLog({
            userId: operatorUserId,
            action: kind === 'receipt'
                ? 'payment_disbursement.receipt_email_sent'
                : 'payment_disbursement.approval_email_sent',
            targetType: 'payment_disbursement',
            targetId: disbursementId,
            detail: {
                applicationId,
                recipients: cleanRecipients.map(r => ({ email: r.email, is_bcc: r.is_bcc })),
                notification_kind: kind,
            },
        });
        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('sendDisbursementNotificationEmail error:', err);
        return { success: false, error: err.message ?? '通知寄送失敗' };
    }
}

export async function sendDisbursementPaymentReceiptEmail(
    operatorUserId: string,
    disbursementId: string,
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };
    if (!(await hasAnyRole(operatorUserId, ['case_officer']))) {
        return { success: false, error: '僅個管師可寄送領款收據' };
    }

    const client = await pool.connect();
    let applicationId: string;
    try {
        const r = await client.query(
            `SELECT pd.review_stage, pd.application_id::text, pd.receipt_file_path
             FROM payment_disbursements pd
             WHERE pd.id = $1::bigint`,
            [disbursementId]
        );
        if (r.rowCount === 0) return { success: false, error: '撥款紀錄不存在' };
        const stage = r.rows[0].review_stage as ReviewStage;
        if (stage !== '1') return { success: false, error: `當前狀態為「${REVIEW_STAGE_LABEL[stage]}」，無法寄送 email` };
        if (!r.rows[0].receipt_file_path) {
            return { success: false, error: '尚未產生領款收據 PDF，請先按【產生領款收據】' };
        }
        applicationId = r.rows[0].application_id;
    } finally {
        client.release();
    }

    try {
        const { notifyEvent } = await import('./notificationDispatcher');
        // 以 disbursementId 作為 context，dispatcher 會用 disbursement.amount 渲染金額
        // 同時 sendNotificationEmail 會將 disbursement_id 寫入 notification_logs
        await notifyEvent('case_payment_receipt_to_applicant', { applicationId, disbursementId });

        // notifyEvent 是 fire-and-forget（SMTP 失敗也不 throw），所以不能光看 await 通過就回成功；
        // 改抓最近一筆對應 disbursement 的 notification_logs 確認 status='sent' 才算真的寄出。
        const checkClient = await pool.connect();
        let actualStatus: string | null = null;
        let actualError: string | null = null;
        try {
            const r = await checkClient.query(
                `SELECT status, error_message FROM notification_logs
                 WHERE disbursement_id = $1::bigint
                   AND template_id IN (SELECT id FROM notification_templates WHERE name = 'email_case_payment_receipt_to_applicant')
                 ORDER BY sent_at DESC LIMIT 1`,
                [disbursementId]
            );
            actualStatus = r.rows[0]?.status ?? null;
            actualError = r.rows[0]?.error_message ?? null;
        } finally {
            checkClient.release();
        }

        if (actualStatus !== 'sent') {
            return {
                success: false,
                error: actualStatus === 'failed'
                    ? `Email 寄送失敗：${actualError ?? '未知錯誤'}`
                    : '寄送結果未確認；請檢查 SMTP 設定或申請人 email 是否填寫',
            };
        }

        void writeAuditLog({
            userId: operatorUserId,
            action: 'payment_disbursement.receipt_email_sent',
            targetType: 'payment_disbursement',
            targetId: disbursementId,
            detail: { applicationId },
        });
        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('sendDisbursementPaymentReceiptEmail error:', err);
        return { success: false, error: err.message ?? '寄送失敗' };
    }
}

// ─── 各階段 checklist 勾選/取消（UI 在 row 上 toggle 用） ────────────

const CHECKLIST_FIELD_BY_STAGE: Record<ReviewStage, string[]> = {
    '1': ['officer_doc_check'],
    '2': ['supervisor_doc_check'],
    '3': [
        'accountant_medical_uploaded_check',
        'accountant_amount_match_check',
        'accountant_board_opinion_check',
        'accountant_bank_setup_check',
    ],
    '4': ['executive_final_check'],
    '9': [], 'X': [],
};

export async function setDisbursementChecklist(
    operatorUserId: string,
    disbursementId: string,
    field: string,
    value: boolean,
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };

    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT review_stage FROM payment_disbursements WHERE id = $1::bigint`,
            [disbursementId]
        );
        if (cur.rowCount === 0) return { success: false, error: '撥款紀錄不存在' };
        const stage = cur.rows[0].review_stage as ReviewStage;
        const allowedFields = CHECKLIST_FIELD_BY_STAGE[stage] ?? [];
        if (!allowedFields.includes(field)) {
            return { success: false, error: `欄位 ${field} 不屬於當前階段` };
        }
        const allowedRoles = rolesForStage(stage);
        if (!(await hasAnyRole(operatorUserId, allowedRoles))) {
            return { success: false, error: `僅 ${allowedRoles.join('/')} 可在此階段勾選` };
        }
        await client.query(
            `UPDATE payment_disbursements SET ${field} = $1, updated_at = NOW() WHERE id = $2::bigint`,
            [value, disbursementId]
        );
        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('setDisbursementChecklist error:', err);
        return { success: false, error: err.message ?? '更新失敗' };
    } finally {
        client.release();
    }
}

// ─── 設定捐贈者公開同意（officer only, stage='1'） ────────────────────

export async function setDisbursementDonorConsent(
    operatorUserId: string,
    disbursementId: string,
    consent: boolean,
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };
    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT review_stage FROM payment_disbursements WHERE id = $1::bigint`,
            [disbursementId]
        );
        if (cur.rowCount === 0) return { success: false, error: '撥款紀錄不存在' };
        const stage = cur.rows[0].review_stage as ReviewStage;
        if (stage !== '1') {
            return { success: false, error: '僅在「待送出」階段可設定' };
        }
        if (!(await hasAnyRole(operatorUserId, rolesForStage('1')))) {
            return { success: false, error: '僅承辦人可設定' };
        }
        await client.query(
            `UPDATE payment_disbursements SET donor_disclosure_consent = $1, updated_at = NOW() WHERE id = $2::bigint`,
            [consent, disbursementId]
        );
        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('setDisbursementDonorConsent error:', err);
        return { success: false, error: err.message ?? '更新失敗' };
    } finally {
        client.release();
    }
}

// ─── 設定醫療收據狀態（officer only, stage='1'） ────────────────────

export async function setDisbursementMedicalReceiptStatus(
    operatorUserId: string,
    disbursementId: string,
    status: 'official' | 'unpaid',
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };
    if (status !== 'official' && status !== 'unpaid') return { success: false, error: '不正確的醫療收據狀態' };
    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT review_stage FROM payment_disbursements WHERE id = $1::bigint`,
            [disbursementId]
        );
        if (cur.rowCount === 0) return { success: false, error: '撥款紀錄不存在' };
        const stage = cur.rows[0].review_stage as ReviewStage;
        if (stage !== '1') {
            return { success: false, error: '僅在個管師持有中階段可設定醫療收據狀態' };
        }
        if (!(await hasAnyRole(operatorUserId, rolesForStage('1')))) {
            return { success: false, error: '僅個管師可設定醫療收據狀態' };
        }
        await client.query(
            `UPDATE payment_disbursements
             SET medical_receipt_status = $1,
                 updated_at = NOW()
             WHERE id = $2::bigint`,
            [status, disbursementId]
        );
        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('setDisbursementMedicalReceiptStatus error:', err);
        return { success: false, error: err.message ?? '更新失敗' };
    } finally {
        client.release();
    }
}

// ─── 退件（退一層） ──────────────────────────────────────────────────

export async function rejectDisbursement(
    operatorUserId: string,
    disbursementId: string,
    reason: string,
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };
    const cleanReason = (reason ?? '').trim();
    if (!cleanReason) return { success: false, error: '退件原因必填' };

    // 退件原因最少字數（system_settings.disbursement_reject_reason_min_chars，預設 10）
    const minCharsRow = await pool.query(
        `SELECT value FROM system_settings WHERE key = 'disbursement_reject_reason_min_chars'`
    );
    const minChars = Number(minCharsRow.rows[0]?.value ?? 10) || 10;
    if (cleanReason.length < minChars) {
        return { success: false, error: `退件原因需至少 ${minChars} 字（目前 ${cleanReason.length} 字）` };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cur = await client.query(
            `SELECT review_stage, application_id::text, receipt_number
             FROM payment_disbursements WHERE id = $1::bigint FOR UPDATE`,
            [disbursementId]
        );
        if (cur.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '撥款紀錄不存在' };
        }
        const curStage = cur.rows[0].review_stage as ReviewStage;
        // 僅 2/3/4 可退件（1 是源頭、9/X 已終結）
        const REJECT_BACK: Partial<Record<ReviewStage, ReviewStage>> = {
            '2': '1', '3': '2', '4': '3',
        };
        const targetStage = REJECT_BACK[curStage];
        if (!targetStage) {
            await client.query('ROLLBACK');
            return { success: false, error: `當前狀態 ${REVIEW_STAGE_LABEL[curStage]} 不可退件` };
        }
        const allowed = rolesForStage(curStage);
        if (!(await hasAnyRole(operatorUserId, allowed))) {
            await client.query('ROLLBACK');
            return { success: false, error: `僅 ${allowed.join('/')} 可在 ${REVIEW_STAGE_LABEL[curStage]} 階段退件` };
        }

        // 退件時僅重置「目標 stage 之後」的 checklist 欄位，保留先前 stage 的勾選狀態
        // 對應 stage 順序：1 → 2 (officer) → 3 (supervisor) → 4 (accountant) → 9 (executive)
        // targetStage（被退回到的階段）：1 / 2 / 3
        //   退回到 1：重置 supervisor + accountant + executive
        //   退回到 2：重置 accountant + executive
        //   退回到 3：重置 executive
        const resetSnippets: string[] = [];
        if (Number(targetStage) <= 1) resetSnippets.push('supervisor_doc_check = FALSE');
        if (Number(targetStage) <= 2) resetSnippets.push(
            'accountant_medical_uploaded_check = FALSE',
            'accountant_amount_match_check = FALSE',
            'accountant_board_opinion_check = FALSE',
            'accountant_bank_setup_check = FALSE'
        );
        if (Number(targetStage) <= 3) resetSnippets.push('executive_final_check = FALSE');
        const resetSql = resetSnippets.length ? `, ${resetSnippets.join(', ')}` : '';

        await client.query(
            `UPDATE payment_disbursements
             SET review_stage = $1,
                 rejected_reason = $2,
                 rejected_at = NOW(),
                 rejected_by = $3::bigint,
                 rejected_from_stage = $4,
                 updated_at = NOW()
                 ${resetSql}
             WHERE id = $5::bigint`,
            [targetStage, cleanReason, operatorUserId, curStage, disbursementId]
        );
        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId,
            action: 'payment_disbursement.rejected',
            targetType: 'payment_disbursement',
            targetId: disbursementId,
            detail: {
                application_id: cur.rows[0].application_id,
                receipt_number: cur.rows[0].receipt_number,
                from_stage: curStage,
                back_to_stage: targetStage,
                reason: cleanReason,
            },
        });
        // 通知：被退回的層
        const roleMap: Record<string, string> = { '1': 'case_officer', '2': 'supervisor', '3': 'accountant' };
        logNotificationStub('rejected', cur.rows[0].application_id, disbursementId, [roleMap[targetStage] ?? '']);
        return { success: true, data: undefined };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('rejectDisbursement error:', err);
        return { success: false, error: err.message ?? '退件失敗' };
    } finally {
        client.release();
    }
}

// ─── 標記為已回收 + 上傳掃描檔（個管師於 stage='1' 操作） ──────────────

export async function markDisbursementReceived(
    operatorUserId: string,
    disbursementId: string,
    receivedAt: string,
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };
    if (!receivedAt || isNaN(new Date(receivedAt).getTime())) {
        return { success: false, error: '請填寫有效的收件日期' };
    }
    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT review_stage FROM payment_disbursements WHERE id = $1::bigint`,
            [disbursementId]
        );
        if (cur.rowCount === 0) return { success: false, error: '撥款紀錄不存在' };
        const stage = cur.rows[0].review_stage as ReviewStage;
        if (stage !== '1' && !(await hasAnyRole(operatorUserId, ['admin']))) {
            return { success: false, error: `撥款在 ${REVIEW_STAGE_LABEL[stage]}，無法修改回收資料` };
        }
        if (!(await hasAnyRole(operatorUserId, ['case_officer', 'admin']))) {
            return { success: false, error: '權限不足' };
        }
        // 只更新 received_at；不再覆寫 receipt_file_path（那是系統產生的 PDF，紙本掃描走 application_documents）
        const res = await client.query(
            `UPDATE payment_disbursements
             SET received_at = $1::date,
                 updated_at = NOW()
             WHERE id = $2::bigint
             RETURNING application_id::text, receipt_number, amount`,
            [receivedAt, disbursementId]
        );
        if (res.rowCount === 0) return { success: false, error: '撥款紀錄不存在' };

        void writeAuditLog({
            userId: operatorUserId,
            action: 'payment_disbursement.received_marked',
            targetType: 'payment_disbursement',
            targetId: disbursementId,
            detail: {
                application_id: res.rows[0].application_id,
                receipt_number: res.rows[0].receipt_number,
                received_at: receivedAt,
            },
        });
        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('markDisbursementReceived error:', err);
        return { success: false, error: err.message ?? '更新失敗' };
    } finally {
        client.release();
    }
}

// ─── 刪除撥款紀錄（僅 stage='1' 個管師可刪、admin 可隨時刪） ─────────

export async function updateDisbursementRemittanceSlip(
    operatorUserId: string,
    disbursementId: string,
    fileUrl: string,
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '不正確的撥款 ID' };
    const trimmedUrl = fileUrl.trim();
    if (!trimmedUrl) return { success: false, error: '請提供匯款單掃描檔' };
    if (!(await hasAnyRole(operatorUserId, ['case_officer', 'admin']))) {
        return { success: false, error: '權限不足' };
    }

    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT review_stage, application_id::text, receipt_number
             FROM payment_disbursements
             WHERE id = $1::bigint`,
            [disbursementId],
        );
        if (cur.rowCount === 0) return { success: false, error: '找不到撥款紀錄' };
        const row = cur.rows[0];
        const stage = row.review_stage as ReviewStage;
        if (stage !== '9') {
            return { success: false, error: '撥款完成後才能上傳匯款單掃描檔' };
        }

        await client.query(
            `UPDATE payment_disbursements
             SET remittance_slip_file_path = $1,
                 updated_at = NOW()
             WHERE id = $2::bigint`,
            [trimmedUrl, disbursementId],
        );

        void writeAuditLog({
            userId: operatorUserId,
            action: 'payment_disbursement.updated',
            targetType: 'payment_disbursement',
            targetId: disbursementId,
            detail: {
                application_id: row.application_id,
                receipt_number: row.receipt_number,
                changed_fields: ['remittance_slip_file_path'],
            },
        });

        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('updateDisbursementRemittanceSlip error:', err);
        return { success: false, error: err.message ?? '上傳匯款單掃描檔失敗' };
    } finally {
        client.release();
    }
}

export async function deleteDisbursement(
    operatorUserId: string,
    disbursementId: string,
): Promise<ActionResult> {
    if (!/^\d+$/.test(disbursementId)) return { success: false, error: '無效的撥款 ID' };
    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT review_stage, application_id::text, receipt_number, amount, received_at, created_by::text
             FROM payment_disbursements WHERE id = $1::bigint`,
            [disbursementId]
        );
        if (cur.rowCount === 0) return { success: false, error: '撥款紀錄不存在' };
        const row = cur.rows[0];
        const stage = row.review_stage as ReviewStage;
        const isAdmin = await hasAnyRole(operatorUserId, ['admin']);
        const isCreator = row.created_by === operatorUserId;
        const canDelete = isAdmin || (isCreator && stage === '1');
        if (!canDelete) {
            return { success: false, error: stage === '1' ? '只有建立者可刪除自己未送出的撥款' : `撥款已進入 ${REVIEW_STAGE_LABEL[stage]}，請改用退件` };
        }
        await client.query(
            `DELETE FROM payment_disbursements WHERE id = $1::bigint`,
            [disbursementId]
        );
        void writeAuditLog({
            userId: operatorUserId,
            action: 'payment_disbursement.deleted',
            targetType: 'payment_disbursement',
            targetId: disbursementId,
            detail: {
                application_id: row.application_id,
                receipt_number: row.receipt_number,
                amount: Number(row.amount),
                review_stage: stage,
                was_received: !!row.received_at,
            },
        });
        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('deleteDisbursement error:', err);
        return { success: false, error: err.message ?? '刪除失敗' };
    }
}
