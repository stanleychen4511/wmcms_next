'use server';

/**
 * 三張顧客報表的 server actions（對齊「各補助案-申請案列表.xlsx」）
 *
 * 1. fetchSelfPayMedicalReport     — 自費醫療（status IN '1','3','4'）
 * 2. fetchDisbursementReport       — 自費醫療補助款項（一筆撥款一列）
 * 3. fetchRejectedReport           — 自費醫療_未通過（status='2'）
 *
 * 權限：admin / supervisor / board_member / executive / chairman
 */

import { pool } from '../../lib/db';
import { decryptAES } from '../../lib/crypto';
import { CLOSE_REASON_LABEL } from '../../lib/closeReasonConstants';

const ALLOWED_ROLES = ['admin', 'supervisor', 'board_member', 'executive', 'chairman'];

async function hasAnyRole(operatorUserId: string, codes: string[]): Promise<boolean> {
    if (!/^\d+$/.test(operatorUserId)) return false;
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT 1 FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint AND r.code = ANY($2::text[])
             LIMIT 1`,
            [operatorUserId, codes]
        );
        return (res.rowCount ?? 0) > 0;
    } finally {
        client.release();
    }
}

type ActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

export interface ReportFilter {
    /** YYYY-MM-DD 起 */
    from?: string;
    /** YYYY-MM-DD 迄 */
    to?: string;
    /** '1' 經濟弱勢 / '2' 小康家庭 */
    subsidySubtype?: '1' | '2';
    /** officer user.id（顯示經辦人姓名）*/
    officerId?: string;
}

// ─── Row shapes ────────────────────────────────────────────────────────────

export interface SelfPayReportRow {
    /** A114001 */
    caseNumber: string;
    officerName: string;
    /** '1' 經濟弱勢 / '2' 小康家庭 */
    subsidySubtype: string | null;
    applicationWay: '1' | '2' | null;     // 自行/轉介
    referralUnitName: string | null;
    referralContactPhone: string | null;
    applicantName: string;
    applicantPhone: string | null;
    /** YYYY-MM-DD（西元） */
    applyAt: string | null;
    applicationForm: 'P' | 'E' | null;
    treatmentPhase: 'B' | 'A' | 'X' | null;
    cancerStage: string | null;
    /** 行政審核（admin_review）通過/未通過 + 說明 */
    adminReviewText: string | null;
    /** 行政審核通過時間（YYYY-MM-DD） */
    adminReviewAt: string | null;
    /** 家訪時間（YYYY-MM-DD） */
    homeVisitAt: string | null;
    /** 董事收到時間（board_review_assignments.assigned_at） */
    boardReceivedAt: string | null;
    /** 董事通過/結論時間 */
    boardReviewedAt: string | null;
    /** 董事審核（board_review）通過/未通過 + 說明 */
    boardReviewText: string | null;
    /** 待收到的資料（撥款 phase 必備但未上傳/未符合的文件 label 列表） */
    pendingDocuments: string[];
    /** 案件狀態 */
    status: string;
}

export interface DisbursementReportRow {
    caseNumber: string | null;        // 群組第一列才有；後續列為 null
    applicationWay: '1' | '2' | null;
    referralUnitName: string | null;
    applicantName: string | null;
    idNumber: string | null;          // 身分證
    applyAt: string | null;
    approvedAmount: number | null;    // 通過補助額度（每案總額）
    /** 給付方式：給付醫院 / 給付申請人 */
    paymentMethod: string | null;
    receiptNo: string | null;
    /** 給付日期（YYYY-MM-DD，西元；UI/匯出再轉民國）。
     *  優先 sent_at；NULL 時 fallback 到 executive_signed_at / created_at */
    paidAt: string | null;
    /** 此筆給付日期是 fallback 推估的（sent_at 沒填，用簽核時間估）；UI 可加個提示 icon */
    paidAtEstimated: boolean;
    /** 給付金額（原始 number；UI/匯出做千分位 format） */
    amount: number | null;
    notes: string | null;
}

export interface RejectedReportRow {
    rowNo: number;
    applicantName: string;
    applyAt: string | null;
    applicationForm: 'P' | 'E' | null;
    /** 多筆原因組成易讀文字 */
    reasonsText: string;
    /** 原始 codes（給統計用）*/
    reasonCodes: string[];
    officerName: string;
    notes: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function buildDateWhere(col: string, params: unknown[], from?: string, to?: string): string {
    const parts: string[] = [];
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
        params.push(from);
        parts.push(`${col} >= $${params.length}::date`);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
        params.push(to);
        parts.push(`${col} < ($${params.length}::date + INTERVAL '1 day')`);
    }
    return parts.join(' AND ');
}

function decryptName(enc: Buffer | null, iv: Buffer | null): string {
    if (!enc || !iv) return '未知';
    try {
        return decryptAES(enc, iv) || '未知';
    } catch {
        return '未知';
    }
}

function formatDate(d: unknown): string | null {
    if (!d) return null;
    const dt = new Date(d as string | number | Date);
    if (Number.isNaN(dt.getTime())) return null;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** YYYY-MM-DD HH:MM:SS（Asia/Taipei）— 給含時分秒的欄位用 */
function formatDateTime(d: unknown): string | null {
    if (!d) return null;
    const dt = new Date(d as string | number | Date);
    if (Number.isNaN(dt.getTime())) return null;
    // 用 Asia/Taipei 顯示，避免 UTC 截掉前一天
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(dt);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    // en-CA gives YYYY-MM-DD, time as HH:MM:SS
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

// ─── Report 1: 自費醫療 ──────────────────────────────────────────────────

export async function fetchSelfPayMedicalReport(
    operatorUserId: string,
    filter: ReportFilter,
): Promise<ActionResult<SelfPayReportRow[]>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    const params: unknown[] = [];
    const where: string[] = [`a.status IN ('1', '3', '4')`];

    const dateWhere = buildDateWhere('a.apply_at', params, filter.from, filter.to);
    if (dateWhere) where.push(dateWhere);
    if (filter.subsidySubtype === '1' || filter.subsidySubtype === '2') {
        params.push(filter.subsidySubtype);
        where.push(`a.subsidy_subtype = $${params.length}`);
    }
    if (filter.officerId && /^\d+$/.test(filter.officerId)) {
        params.push(filter.officerId);
        where.push(`a.officer_id = $${params.length}::bigint`);
    }

    const client = await pool.connect();
    try {
        // append-only workflow 語意：每筆 row 的 stage = 「案件推進到此 stage 的事件」（target stage）。
        // 「行政審核通過」記錄在 stage='home_visit' AND is_approved=true 的列（離開 admin_review、進入家訪）；
        // 「董事審核通過」記錄在 stage='reimbursement' AND is_approved=true 的列（離開董事審核、進入核銷）。
        //
        // 退回邏輯：若案件「目前」在 admin_review，代表曾被退回／尚未進家訪 → 報表不應顯示「行政審核通過」。
        // 同理：「目前」非在 reimbursement → 不顯示「董事審核通過」。
        // 用 current_stage CTE 取每案最新 workflow row 的 stage 來閘門。
        const sql = `
            WITH current_stage AS (
                SELECT DISTINCT ON (application_id) application_id, stage AS cur_stage
                FROM application_workflow
                ORDER BY application_id, id DESC
            ),
            wf_admin AS (
                SELECT DISTINCT ON (application_id) application_id, is_approved, comments, reviewed_at
                FROM application_workflow
                WHERE stage = 'home_visit' AND is_approved = true
                ORDER BY application_id, id DESC
            ),
            wf_board AS (
                SELECT DISTINCT ON (application_id) application_id, is_approved, comments, reviewed_at
                FROM application_workflow
                WHERE stage = 'reimbursement' AND is_approved = true
                ORDER BY application_id, id DESC
            )
            SELECT a.id, a.case_number, a.status, a.apply_at,
                   a.subsidy_subtype, a.application_way,
                   a.referral_unit_name, a.referral_contact_phone,
                   a.applicant_phone, a.application_form, a.treatment_phase, a.cancer_stage,
                   a.board_review_comments AS board_review_comments_permanent,
                   u_app.name_enc AS app_name_enc, u_app.name_iv AS app_name_iv,
                   u_off.name_enc AS off_name_enc, u_off.name_iv AS off_name_iv, u_off.account AS off_account,
                   CASE WHEN cs.cur_stage <> 'admin_review' THEN wfa.is_approved END AS admin_approved,
                   CASE WHEN cs.cur_stage <> 'admin_review' THEN wfa.comments    END AS admin_comments,
                   CASE WHEN cs.cur_stage <> 'admin_review' THEN wfa.reviewed_at END AS admin_at,
                   CASE WHEN cs.cur_stage = 'reimbursement' THEN wfb.is_approved END AS board_approved,
                   CASE WHEN cs.cur_stage = 'reimbursement' THEN wfb.reviewed_at END AS board_at,
                   bra.assigned_at AS board_received_at,
                   /* 家訪時間：home_visit.updated_at（真正含時分秒的 timestamp；visit_date 只有日期） */
                   hv.updated_at AS home_visit_at,
                   /* 待收文件：撥款 phase 必備、目前尚無任何 status='1'（符合）的文件 */
                   (SELECT array_agg(dtc.label ORDER BY dtc.id)
                      FROM document_type_config dtc
                     WHERE dtc.phase = 'reimbursement'
                       AND dtc.is_required = true
                       AND COALESCE(dtc.is_active, true) = true
                       AND NOT EXISTS (
                           SELECT 1 FROM application_documents ad
                            WHERE ad.application_id = a.id
                              AND ad.id = dtc.id
                              AND ad.status = '1'
                       )
                   ) AS pending_doc_labels
            FROM applications a
            LEFT JOIN users u_app  ON u_app.id  = a.applicant_id
            LEFT JOIN users u_off  ON u_off.id  = a.officer_id
            LEFT JOIN current_stage cs ON cs.application_id = a.id
            LEFT JOIN wf_admin wfa ON wfa.application_id = a.id
            LEFT JOIN wf_board wfb ON wfb.application_id = a.id
            LEFT JOIN board_review_assignments bra ON bra.application_id = a.id
            LEFT JOIN home_visit hv ON hv.application_id = a.id
            WHERE ${where.join(' AND ')}
            ORDER BY a.apply_at ASC, a.case_number ASC
            LIMIT 5000
        `;
        const res = await client.query(sql, params);

        const rows: SelfPayReportRow[] = res.rows.map(r => {
            // 行政審核 / 董事審核欄位只顯示「通過 / 未通過」；時間另列在「行政通過時間 / 董事通過時間」欄位
            const adminText = r.admin_approved == null
                ? null
                : (r.admin_approved ? '通過' : '未通過');
            const boardText = r.board_approved == null
                ? null
                : (r.board_approved ? '通過' : '未通過');
            return {
                caseNumber: r.case_number,
                officerName: r.off_name_enc ? decryptName(r.off_name_enc, r.off_name_iv) : (r.off_account ?? ''),
                subsidySubtype: r.subsidy_subtype ?? null,
                applicationWay: (r.application_way === '1' || r.application_way === '2') ? r.application_way : null,
                referralUnitName: r.referral_unit_name ?? null,
                referralContactPhone: r.referral_contact_phone ?? null,
                applicantName: decryptName(r.app_name_enc, r.app_name_iv),
                applicantPhone: r.applicant_phone ?? null,
                applyAt: formatDate(r.apply_at),
                applicationForm: (r.application_form === 'P' || r.application_form === 'E') ? r.application_form : null,
                treatmentPhase: (r.treatment_phase === 'B' || r.treatment_phase === 'A' || r.treatment_phase === 'X') ? r.treatment_phase : null,
                cancerStage: r.cancer_stage ?? null,
                adminReviewText: adminText,
                adminReviewAt: formatDateTime(r.admin_at),
                homeVisitAt: formatDateTime(r.home_visit_at),
                boardReceivedAt: formatDateTime(r.board_received_at),
                boardReviewedAt: formatDateTime(r.board_at),
                boardReviewText: boardText,
                pendingDocuments: Array.isArray(r.pending_doc_labels) ? r.pending_doc_labels.filter(Boolean) : [],
                status: r.status,
            };
        });
        return { success: true, data: rows };
    } catch (err: any) {
        console.error('fetchSelfPayMedicalReport', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

// ─── Report 2: 自費醫療補助款項 ──────────────────────────────────────────

export async function fetchDisbursementReport(
    operatorUserId: string,
    filter: ReportFilter,
): Promise<ActionResult<DisbursementReportRow[]>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    const params: unknown[] = [];
    // 篩選用 apply_at（試算表的 row 排序也是依 apply_at）
    const where: string[] = [`a.status IN ('3','4')`];
    const dateWhere = buildDateWhere('a.apply_at', params, filter.from, filter.to);
    if (dateWhere) where.push(dateWhere);
    if (filter.subsidySubtype === '1' || filter.subsidySubtype === '2') {
        params.push(filter.subsidySubtype);
        where.push(`a.subsidy_subtype = $${params.length}`);
    }

    const client = await pool.connect();
    try {
        // 先查每案的撥款記錄（包含 0 筆撥款的案件 → 仍出現在報表，撥款欄位空）
        const sql = `
            SELECT a.id, a.case_number, a.apply_at, a.application_way,
                   a.referral_unit_name, a.approved_amount,
                   u_app.name_enc AS app_name_enc, u_app.name_iv AS app_name_iv,
                   u_app.id_number_enc, u_app.id_number_iv,
                   pd.id AS pd_id,
                   pd.payment_method, pd.amount,
                   /* 給付日期：手動填的 sent_at 優先；沒填 fallback 到執行長簽核時間，再 fallback 到建立時間 */
                   COALESCE(pd.sent_at, pd.executive_signed_at, pd.created_at) AS paid_at,
                   pd.sent_at IS NULL AND pd.executive_signed_at IS NOT NULL AS paid_at_is_estimated,
                   pd.receipt_number, pd.external_code,
                   pd.notes
            FROM applications a
            LEFT JOIN users u_app ON u_app.id = a.applicant_id
            LEFT JOIN payment_disbursements pd ON pd.application_id = a.id
            WHERE ${where.join(' AND ')}
            ORDER BY a.apply_at ASC, a.case_number ASC,
                     COALESCE(pd.sent_at, pd.executive_signed_at, pd.created_at) NULLS LAST,
                     pd.id NULLS LAST
            LIMIT 10000
        `;
        const res = await client.query(sql, params);

        const out: DisbursementReportRow[] = [];
        let lastCase = '';
        for (const r of res.rows) {
            const isFirstOfGroup = r.case_number !== lastCase;
            lastCase = r.case_number;
            const idNumber = (r.id_number_enc && r.id_number_iv)
                ? (() => { try { return decryptAES(r.id_number_enc, r.id_number_iv) ?? ''; } catch { return ''; } })()
                : '';
            out.push({
                caseNumber: isFirstOfGroup ? r.case_number : null,
                applicationWay: isFirstOfGroup
                    ? ((r.application_way === '1' || r.application_way === '2') ? r.application_way : null)
                    : null,
                referralUnitName: isFirstOfGroup ? (r.referral_unit_name ?? null) : null,
                applicantName: isFirstOfGroup ? decryptName(r.app_name_enc, r.app_name_iv) : null,
                idNumber: isFirstOfGroup ? idNumber : null,
                applyAt: isFirstOfGroup ? formatDate(r.apply_at) : null,
                approvedAmount: isFirstOfGroup
                    ? (r.approved_amount != null ? Number(r.approved_amount) : null)
                    : null,
                paymentMethod: r.payment_method ?? null,
                receiptNo: r.receipt_number ?? r.external_code ?? null,
                paidAt: formatDate(r.paid_at),
                paidAtEstimated: !!r.paid_at_is_estimated,
                amount: r.amount != null ? Number(r.amount) : null,
                notes: r.notes ?? null,
            });
        }
        return { success: true, data: out };
    } catch (err: any) {
        console.error('fetchDisbursementReport', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

// ─── Report 3: 自費醫療_未通過 ───────────────────────────────────────────

export async function fetchRejectedReport(
    operatorUserId: string,
    filter: ReportFilter & { reasonCodes?: string[] },
): Promise<ActionResult<RejectedReportRow[]>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    const params: unknown[] = [];
    const where: string[] = [`a.status = '2'`];
    const dateWhere = buildDateWhere('a.apply_at', params, filter.from, filter.to);
    if (dateWhere) where.push(dateWhere);
    if (filter.officerId && /^\d+$/.test(filter.officerId)) {
        params.push(filter.officerId);
        where.push(`a.officer_id = $${params.length}::bigint`);
    }
    if (filter.reasonCodes && filter.reasonCodes.length > 0) {
        const valid = filter.reasonCodes.filter(c => /^[0-9]{2}$/.test(c));
        if (valid.length > 0) {
            params.push(valid);
            where.push(`EXISTS (
                SELECT 1 FROM application_close_reasons cr
                WHERE cr.application_id = a.id AND cr.reason_code = ANY($${params.length}::text[])
            )`);
        }
    }

    const client = await pool.connect();
    try {
        const sql = `
            WITH reasons AS (
                SELECT application_id,
                       array_agg(reason_code ORDER BY reason_code) AS codes,
                       array_agg(jsonb_build_object('code', reason_code, 'detail', detail_value)
                                 ORDER BY reason_code) AS rows
                FROM application_close_reasons
                GROUP BY application_id
            )
            SELECT a.id, a.case_number, a.apply_at, a.application_form,
                   a.board_review_comments,
                   u_app.name_enc AS app_name_enc, u_app.name_iv AS app_name_iv,
                   u_off.name_enc AS off_name_enc, u_off.name_iv AS off_name_iv, u_off.account AS off_account,
                   r.codes AS reason_codes, r.rows AS reason_rows,
                   (SELECT comments FROM application_workflow w
                     WHERE w.application_id = a.id
                     ORDER BY COALESCE(w.reviewed_at, w.created_at) DESC LIMIT 1) AS last_comments
            FROM applications a
            LEFT JOIN users u_app ON u_app.id = a.applicant_id
            LEFT JOIN users u_off ON u_off.id = a.officer_id
            LEFT JOIN reasons r   ON r.application_id = a.id
            WHERE ${where.join(' AND ')}
            ORDER BY a.apply_at ASC, a.case_number ASC
            LIMIT 5000
        `;
        const res = await client.query(sql, params);

        const out: RejectedReportRow[] = res.rows.map((r, idx) => {
            const reasonRows: Array<{ code: string; detail: string | null }> = Array.isArray(r.reason_rows)
                ? r.reason_rows.map((j: any) => ({ code: j.code, detail: j.detail ?? null }))
                : [];
            const reasonsText = reasonRows.length > 0
                ? reasonRows.map(rr => {
                    const label = CLOSE_REASON_LABEL[rr.code] ?? rr.code;
                    return rr.detail ? `${label}：${rr.detail}` : label;
                }).join('；')
                : (r.last_comments ?? '');
            return {
                rowNo: idx + 1,
                applicantName: decryptName(r.app_name_enc, r.app_name_iv),
                applyAt: formatDate(r.apply_at),
                applicationForm: (r.application_form === 'P' || r.application_form === 'E') ? r.application_form : null,
                reasonsText,
                reasonCodes: Array.isArray(r.reason_codes) ? r.reason_codes : [],
                officerName: r.off_name_enc ? decryptName(r.off_name_enc, r.off_name_iv) : (r.off_account ?? ''),
                notes: r.board_review_comments ?? null,
            };
        });
        return { success: true, data: out };
    } catch (err: any) {
        console.error('fetchRejectedReport', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}
