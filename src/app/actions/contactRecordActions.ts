'use server';

/**
 * 來電 / 關懷紀錄 server actions（#14）
 *
 * 表：contact_records
 * - record_type='1' 來電紀錄、record_type='2' 關懷紀錄
 * - 與案件流程解耦；可關聯 applicant_user_id（已是申請人）或 application_id（特定案件），均 NULLABLE
 *
 * 角色權限：
 *   建立 / 檢視：supervisor / case_officer / volunteer / admin
 *   編輯：原建立者本人
 *   刪除：原建立者本人 或 admin
 */

import { pool } from '../../lib/db';
import { decryptAES } from '../../lib/crypto';
import { writeAuditLog } from './auditActions';
import { normalizePhone } from '../../lib/contactRecordConstants';

export interface ContactRecord {
    id: string;
    recordType: '1' | '2';
    contactDate: string;       // yyyy-mm-dd
    handlerUserId: string | null;
    handlerName: string;

    applicantUserId: string | null;
    applicantName: string | null;     // 從 applicantUserId join + 解密；關懷紀錄時用此顯示對象
    callerName: string | null;
    callerGender: 'M' | 'F' | 'U' | null;
    callerPhone: string | null;
    callerPhoneFromCallerId: boolean;

    applicationId: string | null;
    caseNumber: string | null;

    fromSource: string | null;
    consultantType: string | null;
    consultProgram: string | null;
    rejectReasons: string[];

    summary: string | null;
    isSpecialAttention: boolean;
    hasSpecialAttention: boolean;
    specialAttentionNote: string | null;
    mediaUrls: string[];

    /** 關懷紀錄專用：聯絡對象（與申請人關係）'1'=本人 '2'=配偶 '9'=其他 */
    contactedParty: '1' | '2' | '9' | null;
    contactedPartyOther: string | null;

    createdAt: string;
    updatedAt: string;
}

export interface ContactRecordFollowup {
    id: string;
    contactRecordId: string;
    authorUserId: string | null;
    authorName: string;
    summary: string;
    createdAt: string;
    updatedAt: string;
}

export interface ContactRecordInput {
    recordType: '1' | '2';
    contactDate: string;       // yyyy-mm-dd
    applicantUserId?: string | null;
    callerName?: string | null;
    callerGender?: 'M' | 'F' | 'U' | null;
    callerPhone?: string | null;
    callerPhoneFromCallerId?: boolean;
    applicationId?: string | null;
    fromSource?: string | null;
    consultantType?: string | null;
    consultProgram?: string | null;
    rejectReasons?: string[];
    summary?: string | null;
    isSpecialAttention?: boolean;
    specialAttentionNote?: string | null;
    mediaUrls?: string[];
    contactedParty?: '1' | '2' | '9' | null;
    contactedPartyOther?: string | null;
}

type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// ─── 內部 helpers ─────────────────────────────────────────────────────────

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

// executive 也納入（user feedback #22）— 執行長要看關懷紀錄協助決策
const ALLOWED_ROLES = ['supervisor', 'case_officer', 'volunteer', 'admin', 'executive'];

function normUrls(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const out: string[] = [];
    for (const raw of input) {
        if (raw == null) continue;
        const s = String(raw).trim();
        if (s) out.push(s);
    }
    return out;
}

function normCodes(input: unknown, allowed: string[]): string[] {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    for (const raw of input) {
        const s = String(raw ?? '').trim();
        if (!s) continue;
        if (!allowed.includes(s)) continue;
        seen.add(s);
    }
    return Array.from(seen);
}

function normalizeSpecialAttention(input: ContactRecordInput): { isSpecialAttention: boolean; specialAttentionNote: string | null } | null {
    if (input.isSpecialAttention != null && typeof input.isSpecialAttention !== 'boolean') return null;
    if (input.specialAttentionNote != null && typeof input.specialAttentionNote !== 'string') return null;
    const isSpecialAttention = input.isSpecialAttention === true;
    const specialAttentionNote = (input.specialAttentionNote ?? '').trim();
    if (isSpecialAttention && !specialAttentionNote) return null;
    return {
        isSpecialAttention,
        specialAttentionNote: isSpecialAttention ? specialAttentionNote : null,
    };
}

const REJECT_REASON_CODES = ['1','2','3','4','5','6','7','8'];

function decryptName(enc: Buffer | null, iv: Buffer | null, fallback = '系統'): string {
    if (!enc || !iv) return fallback;
    try {
        return decryptAES(enc, iv) || fallback;
    } catch {
        return fallback;
    }
}

/** 將 PG DATE（pg 解析為 local-midnight Date）轉為 'YYYY-MM-DD' 字串。
 *  注意：不能用 toISOString().split('T')[0]，那會跑到 UTC，使台灣 +08 的 2026-05-01 變成 2026-04-30。 */
function formatLocalDate(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function rowToContactRecord(r: any): ContactRecord {
    return {
        id: String(r.id),
        recordType: r.record_type,
        contactDate: r.contact_date ? formatLocalDate(r.contact_date) : '',
        handlerUserId: r.handler_user_id != null ? String(r.handler_user_id) : null,
        handlerName: decryptName(r.handler_name_enc, r.handler_name_iv, r.handler_account ?? '（已移除）'),
        applicantUserId: r.applicant_user_id != null ? String(r.applicant_user_id) : null,
        applicantName: r.applicant_user_id != null
            ? decryptName(r.applicant_name_enc, r.applicant_name_iv, r.applicant_account ?? '未知')
            : null,
        callerName: r.caller_name ?? null,
        callerGender: r.caller_gender ?? null,
        callerPhone: r.caller_phone ?? null,
        callerPhoneFromCallerId: r.caller_phone_from_caller_id === true,
        applicationId: r.application_id != null ? String(r.application_id) : null,
        caseNumber: r.case_number ?? null,
        fromSource: r.from_source ?? null,
        consultantType: r.consultant_type ?? null,
        consultProgram: r.consult_program ?? null,
        rejectReasons: Array.isArray(r.reject_reasons) ? r.reject_reasons : [],
        summary: r.summary ?? null,
        isSpecialAttention: r.is_special_attention === true,
        hasSpecialAttention: r.is_special_attention === true,
        specialAttentionNote: r.special_attention_note ?? null,
        mediaUrls: Array.isArray(r.media_urls) ? r.media_urls : [],
        contactedParty: r.contacted_party ?? null,
        contactedPartyOther: r.contacted_party_other ?? null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : '',
    };
}

const SELECT_COLS = `
    cr.id,
    cr.record_type,
    cr.contact_date,
    cr.handler_user_id,
    cr.applicant_user_id,
    cr.caller_name,
    cr.caller_gender,
    cr.caller_phone,
    cr.caller_phone_from_caller_id,
    cr.application_id,
    a.case_number,
    cr.from_source,
    cr.consultant_type,
    cr.consult_program,
    cr.reject_reasons,
    cr.summary,
    cr.is_special_attention,
    cr.special_attention_note,
    cr.media_urls,
    cr.contacted_party,
    cr.contacted_party_other,
    cr.created_at,
    cr.updated_at,
    u.name_enc AS handler_name_enc,
    u.name_iv  AS handler_name_iv,
    u.account  AS handler_account,
    u_app.name_enc AS applicant_name_enc,
    u_app.name_iv  AS applicant_name_iv,
    u_app.account  AS applicant_account
`;
const FROM_JOIN = `
    FROM contact_records cr
    LEFT JOIN users u     ON u.id     = cr.handler_user_id
    LEFT JOIN users u_app ON u_app.id = cr.applicant_user_id
    LEFT JOIN applications a ON a.id  = cr.application_id
`;

// ─── 申請人搜尋（給首頁「新增關懷」flow 用） ────────────────────────────

export interface ApplicantSearchResult {
    userId: string;
    name: string;
    applications: { id: string; caseNumber: string; status: string }[];
}

/**
 * 用姓名 fuzzy search 找申請人；只回有過案件紀錄的 users。
 * 同時帶回每個申請人的案件清單，方便後續關懷紀錄綁定。
 * Fuzzy 比對用 blind index（hash） — 完全相符才能比對，所以這是「精確姓名查詢」。
 *
 * 開放角色：與 ALLOWED_ROLES 相同。
 */
export async function searchApplicantsForCare(
    operatorUserId: string,
    nameQuery: string,
): Promise<ActionResult<ApplicantSearchResult[]>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    const cleanQuery = (nameQuery ?? '').trim();
    if (cleanQuery.length < 1) return { success: true, data: [] };

    const client = await pool.connect();
    try {
        // 撈所有有案件的申請人 + 解密姓名 + 與 query 比對
        // 因為姓名是 AES 加密 + blind index 是精確比對，這裡用 in-memory filter
        const res = await client.query(
            `SELECT u.id::text AS user_id, u.name_enc, u.name_iv,
                    COALESCE(json_agg(json_build_object(
                        'id',         a.id::text,
                        'caseNumber', a.case_number,
                        'status',     a.status
                    ) ORDER BY a.apply_at DESC) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS applications
             FROM users u
             JOIN applications a ON a.applicant_id = u.id
             GROUP BY u.id, u.name_enc, u.name_iv
             ORDER BY MAX(a.apply_at) DESC NULLS LAST
             LIMIT 200`
        );
        const out: ApplicantSearchResult[] = [];
        for (const r of res.rows) {
            const name = decryptName(r.name_enc, r.name_iv, '未知');
            if (name.includes(cleanQuery)) {
                out.push({
                    userId: r.user_id,
                    name,
                    applications: r.applications,
                });
                if (out.length >= 20) break;
            }
        }
        return { success: true, data: out };
    } catch (err: any) {
        console.error('searchApplicantsForCare error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

// ─── Create ───────────────────────────────────────────────────────────────

export async function createContactRecord(
    operatorUserId: string,
    input: ContactRecordInput,
): Promise<ActionResult<{ id: string }>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    if (input.recordType !== '1' && input.recordType !== '2') {
        return { success: false, error: '紀錄類型無效' };
    }
    if (!input.contactDate || isNaN(new Date(input.contactDate).getTime())) {
        return { success: false, error: '日期無效' };
    }
    const summary = (input.summary ?? '').trim();
    const callerName = (input.callerName ?? '').trim();
    const callerPhone = (input.callerPhone ?? '').trim();
    const callerPhoneFromCallerId = input.recordType === '1'
        && !!callerPhone
        && input.callerPhoneFromCallerId === true;
    // 來電紀錄：caller_name 與 caller_phone 至少一項；關懷紀錄：applicant_user_id 必填
    if (input.recordType === '1' && !callerName && !callerPhone) {
        return { success: false, error: '來電紀錄至少需填寫姓名或聯絡方式' };
    }
    if (input.recordType === '2' && !input.applicantUserId) {
        return { success: false, error: '關懷紀錄必須選擇申請人' };
    }
    if (input.applicantUserId && !/^\d+$/.test(input.applicantUserId)) {
        return { success: false, error: '申請人 ID 無效' };
    }
    if (input.applicationId && !/^\d+$/.test(input.applicationId)) {
        return { success: false, error: '案件 ID 無效' };
    }

    const cleanReasons = normCodes(input.rejectReasons, REJECT_REASON_CODES);
    const cleanMedia = normUrls(input.mediaUrls);
    const specialAttention = normalizeSpecialAttention(input);
    if (!specialAttention) {
        return { success: false, error: '特殊注意時請填寫說明' };
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // 關懷紀錄專屬：聯絡對象 — 限 record_type='2' 才寫入；'9'(其他) 才有 contacted_party_other
        const contactedParty = input.recordType === '2' && input.contactedParty
            ? input.contactedParty : null;
        const contactedPartyOther = contactedParty === '9'
            ? ((input.contactedPartyOther ?? '').trim() || null) : null;

        const insRes = await client.query(
            `INSERT INTO contact_records
                (record_type, contact_date, handler_user_id,
                 applicant_user_id, caller_name, caller_gender, caller_phone, caller_phone_from_caller_id,
                 application_id, from_source, consultant_type, consult_program,
                 reject_reasons, summary, is_special_attention, special_attention_note, media_urls,
                 contacted_party, contacted_party_other)
             VALUES ($1, $2::date, $3::bigint,
                     $4, $5, $6, $7, $8,
                     $9, $10, $11, $12,
                     $13::text[], $14, $15, $16, $17::text[],
                     $18, $19)
             RETURNING id::text`,
            [
                input.recordType, input.contactDate, operatorUserId,
                input.applicantUserId ?? null,
                callerName || null,
                input.callerGender ?? null,
                callerPhone || null,
                callerPhoneFromCallerId,
                input.applicationId ?? null,
                input.fromSource ?? null,
                input.consultantType ?? null,
                input.consultProgram ?? null,
                cleanReasons, summary || null,
                specialAttention.isSpecialAttention, specialAttention.specialAttentionNote, cleanMedia,
                contactedParty, contactedPartyOther,
            ],
        );
        const id = insRes.rows[0].id as string;

        if (input.recordType === '1' && summary) {
            await client.query(
                `INSERT INTO contact_record_followups
                    (contact_record_id, author_user_id, summary, kind)
                 VALUES ($1::bigint, $2::bigint, $3, 'followup')`,
                [id, operatorUserId, `首次：${summary}`],
            );
        }

        await client.query('COMMIT');
        void writeAuditLog({
            userId: operatorUserId,
            action: 'contact_record.created',
            targetType: 'contact_record',
            targetId: id,
            detail: {
                record_type: input.recordType,
                contact_date: input.contactDate,
                applicant_user_id: input.applicantUserId ?? null,
                application_id: input.applicationId ?? null,
                is_special_attention: specialAttention.isSpecialAttention,
            },
        });
        return { success: true, data: { id } };
    } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('createContactRecord error:', err);
        return { success: false, error: err.message ?? '建立失敗' };
    } finally {
        client.release();
    }
}

// ─── Read ─────────────────────────────────────────────────────────────────

export interface FetchOptions {
    applicantUserId?: string;
    applicationId?: string;
    recordType?: '1' | '2';
    /** 部分電話比對；過濾掉非數字後做 substring（caller_phone 也過濾非數字） */
    callerPhoneContains?: string;
    /** contact_date >= 此日期（'YYYY-MM-DD'） */
    contactDateFrom?: string;
    /** contact_date <= 此日期（'YYYY-MM-DD'） */
    contactDateTo?: string;
    specialAttentionOnly?: boolean;
    limit?: number;
}

export interface SpecialAttentionCase {
    applicationId: string;
    caseNumber: string;
    applicantName: string;
    specialAttentionNote: string;
    contactDate: string;
}

export async function fetchSpecialAttentionCases(
    operatorUserId: string,
    options?: { volunteerOnly?: boolean },
): Promise<ActionResult<SpecialAttentionCase[]>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }

    const canViewAllCases = await hasAnyRole(operatorUserId, ['supervisor', 'case_officer', 'admin', 'executive']);
    const volunteerOnly = options?.volunteerOnly === true || !canViewAllCases;
    const client = await pool.connect();
    try {
        const res = await client.query(
            `WITH latest_cases AS (
                SELECT DISTINCT ON (a.applicant_id)
                    a.id::text AS application_id,
                    a.applicant_id,
                    a.case_number,
                    u.name_enc,
                    u.name_iv,
                    attention.special_attention_note,
                    attention.contact_date
                 FROM applications a
                 JOIN users u ON u.id = a.applicant_id
                 JOIN LATERAL (
                    SELECT cr.special_attention_note, cr.contact_date, cr.created_at
                    FROM contact_records cr
                    WHERE cr.applicant_user_id = a.applicant_id
                      AND cr.is_special_attention = TRUE
                    ORDER BY cr.contact_date DESC, cr.created_at DESC
                    LIMIT 1
                 ) attention ON TRUE
                 ${volunteerOnly ? 'WHERE a.home_visit_assignee_id = $1::bigint' : ''}
                 ORDER BY a.applicant_id, a.apply_at DESC
             )
             SELECT *
             FROM latest_cases
             ORDER BY contact_date DESC, application_id DESC`,
            volunteerOnly ? [operatorUserId] : [],
        );
        return {
            success: true,
            data: res.rows.map(row => ({
                applicationId: String(row.application_id),
                caseNumber: row.case_number ?? '',
                applicantName: decryptName(row.name_enc, row.name_iv, '未知'),
                specialAttentionNote: row.special_attention_note ?? '',
                contactDate: row.contact_date ? formatLocalDate(row.contact_date) : '',
            })),
        };
    } catch (err: any) {
        console.error('fetchSpecialAttentionCases error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

export async function fetchContactRecords(
    operatorUserId: string,
    opts: FetchOptions = {},
): Promise<ActionResult<ContactRecord[]>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.applicantUserId) {
        params.push(opts.applicantUserId);
        where.push(`cr.applicant_user_id = $${params.length}::bigint`);
    }
    if (opts.applicationId) {
        params.push(opts.applicationId);
        where.push(`cr.application_id = $${params.length}::bigint`);
    }
    if (opts.recordType) {
        params.push(opts.recordType);
        where.push(`cr.record_type = $${params.length}`);
    }
    if (opts.callerPhoneContains) {
        const digits = opts.callerPhoneContains.replace(/[^0-9]/g, '');
        if (digits) {
            // 用 generated column caller_phone_digits（已建 B-tree index）；
            // LIKE '%...%' 中間比對仍會走 index scan + filter，比 regexp_replace 全表掃快
            params.push(`%${digits}%`);
            where.push(`cr.caller_phone_digits LIKE $${params.length}`);
        }
    }
    if (opts.contactDateFrom && /^\d{4}-\d{2}-\d{2}$/.test(opts.contactDateFrom)) {
        params.push(opts.contactDateFrom);
        where.push(`cr.contact_date >= $${params.length}::date`);
    }
    if (opts.contactDateTo && /^\d{4}-\d{2}-\d{2}$/.test(opts.contactDateTo)) {
        params.push(opts.contactDateTo);
        where.push(`cr.contact_date <= $${params.length}::date`);
    }
    if (opts.specialAttentionOnly === true) {
        where.push('cr.is_special_attention = TRUE');
    }
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT ${SELECT_COLS}
             ${FROM_JOIN}
             ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
             ORDER BY cr.is_special_attention DESC, cr.contact_date DESC, cr.created_at DESC
             LIMIT ${limit}`,
            params,
        );
        return { success: true, data: res.rows.map(rowToContactRecord) };
    } catch (err: any) {
        console.error('fetchContactRecords error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

/**
 * 依電話號碼回溯歷史紀錄。比對時忽略空白與符號（用 regexp_replace 純數字比對）。
 * 短於 7 碼不查詢避免過度匹配。
 */
export async function fetchPhoneHistory(
    operatorUserId: string,
    rawPhone: string,
    /** 編輯模式下傳入正在編輯的紀錄 id，避免把自己列入「過往紀錄」 */
    excludeRecordId?: string | null,
): Promise<ActionResult<ContactRecord[]>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    const digits = normalizePhone(rawPhone);
    if (digits.length < 7) {
        return { success: true, data: [] };
    }
    const params: unknown[] = [digits];
    let extra = '';
    if (excludeRecordId && /^\d+$/.test(excludeRecordId)) {
        params.push(excludeRecordId);
        extra = ` AND cr.id <> $${params.length}::bigint`;
    }
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT ${SELECT_COLS}
             ${FROM_JOIN}
             WHERE cr.caller_phone_digits = $1${extra}
             ORDER BY cr.is_special_attention DESC, cr.contact_date DESC, cr.created_at DESC
             LIMIT 50`,
            params,
        );
        return { success: true, data: res.rows.map(rowToContactRecord) };
    } catch (err: any) {
        console.error('fetchPhoneHistory error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

// ─── 身分證查詢（首頁聯絡紀錄查詢 / 新增案件頁面用） ─────────────────────
//
// 流程：用 id_number_bidx 找到 applicant_user_id → 拉申請摘要 + 聯絡紀錄。
// 隱私：若 operator 不是該申請人「任一案件」的承辦，回傳精簡版（隱藏姓名／案號），
//       只保留申請日期與次數，但聯絡紀錄全部可看。

export interface IdNumberSearchApplication {
    applicationId: string | null;   // 隱藏時為 null
    caseNumber: string | null;      // 隱藏時為 null
    applyAt: string;                // 一律顯示
    status: string | null;          // 隱藏時為 null
}

export interface IdNumberSearchResult {
    found: boolean;
    applicantUserId: string | null;
    /** operator 是否為該申請人任一案件的承辦人 */
    isOperatorOfficer: boolean;
    /** 申請人姓名 — 只有 isOperatorOfficer=true 時才回傳 */
    applicantName: string | null;
    /** 申請摘要 — 隱私模式時 applications 仍會帶日期，但 caseNumber/status 為 null */
    applicationCount: number;
    earliestApplyAt: string | null;
    latestApplyAt: string | null;
    applications: IdNumberSearchApplication[];
    /** 聯絡紀錄 — 全部回傳；若隱私模式，applicantName 已被遮罩 */
    contactRecords: ContactRecord[];
}

export async function searchContactsByIdNumber(
    operatorUserId: string,
    idNumber: string,
): Promise<ActionResult<IdNumberSearchResult>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    const trimmed = (idNumber ?? '').trim().toUpperCase();
    if (!trimmed) {
        return { success: false, error: '請輸入身分證字號' };
    }

    // 1) 用 blind index 查 applicant_user_id
    const { findApplicantIdByIdNumber } = await import('./applicationActions');
    const applicantUserId = await findApplicantIdByIdNumber(trimmed);
    if (!applicantUserId) {
        return {
            success: true,
            data: {
                found: false,
                applicantUserId: null,
                isOperatorOfficer: false,
                applicantName: null,
                applicationCount: 0,
                earliestApplyAt: null,
                latestApplyAt: null,
                applications: [],
                contactRecords: [],
            },
        };
    }

    const client = await pool.connect();
    try {
        // 2) 抓申請清單 + 判斷 operator 是否為任一案件的承辦
        const appsRes = await client.query(
            `SELECT a.id::text AS id, a.case_number, a.apply_at, a.status,
                    a.officer_id::text AS officer_id
             FROM applications a
             WHERE a.applicant_id = $1::bigint
             ORDER BY a.apply_at DESC NULLS LAST`,
            [applicantUserId]
        );
        const allApps = appsRes.rows;
        const isOperatorOfficer = allApps.some(r => String(r.officer_id) === String(operatorUserId));

        // 3) 抓申請人姓名（僅 isOperatorOfficer 才暴露）
        let applicantName: string | null = null;
        if (isOperatorOfficer) {
            const nameRes = await client.query(
                `SELECT name_enc, name_iv FROM users WHERE id = $1::bigint`,
                [applicantUserId]
            );
            if (nameRes.rows[0]) {
                applicantName = decryptName(nameRes.rows[0].name_enc, nameRes.rows[0].name_iv, '未知');
            }
        }

        // 4) 抓聯絡紀錄（包含來電 + 關懷，凡是 applicant_user_id 對到此人的）
        const crRes = await client.query(
            `SELECT ${SELECT_COLS}
             ${FROM_JOIN}
             WHERE cr.applicant_user_id = $1::bigint
             ORDER BY cr.is_special_attention DESC, cr.contact_date DESC, cr.created_at DESC
             LIMIT 500`,
            [applicantUserId]
        );
        let contactRecords = crRes.rows.map(rowToContactRecord);
        // 隱私模式：聯絡紀錄中的 applicantName 也遮罩
        if (!isOperatorOfficer) {
            contactRecords = contactRecords.map(r => ({ ...r, applicantName: null }));
        }

        // 5) 統計
        const applyDates = allApps
            .map(r => r.apply_at ? formatLocalDate(r.apply_at) : '')
            .filter(Boolean);
        const earliestApplyAt = applyDates.length > 0 ? applyDates[applyDates.length - 1] : null;
        const latestApplyAt   = applyDates.length > 0 ? applyDates[0] : null;

        const applications: IdNumberSearchApplication[] = allApps.map(r => ({
            applicationId: isOperatorOfficer ? r.id : null,
            caseNumber:    isOperatorOfficer ? (r.case_number ?? null) : null,
            applyAt:       r.apply_at ? formatLocalDate(r.apply_at) : '',
            status:        isOperatorOfficer ? (r.status ?? null) : null,
        }));

        return {
            success: true,
            data: {
                found: true,
                applicantUserId,
                isOperatorOfficer,
                applicantName,
                applicationCount: allApps.length,
                earliestApplyAt,
                latestApplyAt,
                applications,
                contactRecords,
            },
        };
    } catch (err: any) {
        console.error('searchContactsByIdNumber error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

export async function fetchContactRecordFollowups(
    operatorUserId: string,
    contactRecordId: string,
): Promise<ActionResult<ContactRecordFollowup[]>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    if (!/^\d+$/.test(contactRecordId)) {
        return { success: false, error: '紀錄 ID 不正確' };
    }

    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT f.id::text,
                    f.contact_record_id::text,
                    f.author_user_id::text,
                    f.summary,
                    f.created_at,
                    f.updated_at,
                    u.name_enc AS author_name_enc,
                    u.name_iv AS author_name_iv,
                    u.account AS author_account
             FROM contact_record_followups f
             LEFT JOIN users u ON u.id = f.author_user_id
             WHERE f.contact_record_id = $1::bigint
               AND f.kind = 'followup'
             ORDER BY f.created_at ASC, f.id ASC`,
            [contactRecordId],
        );
        const data: ContactRecordFollowup[] = res.rows.map(r => ({
            id: r.id,
            contactRecordId: r.contact_record_id,
            authorUserId: r.author_user_id ?? null,
            authorName: decryptName(r.author_name_enc, r.author_name_iv, r.author_account ?? '未知人員'),
            summary: r.summary ?? '',
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : '',
        }));
        return { success: true, data };
    } catch (err: any) {
        console.error('fetchContactRecordFollowups error:', err);
        return { success: false, error: err.message ?? '讀取追蹤摘要失敗' };
    } finally {
        client.release();
    }
}

export async function createContactRecordFollowup(
    operatorUserId: string,
    contactRecordId: string,
    summary: string,
): Promise<ActionResult<ContactRecordFollowup>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    if (!/^\d+$/.test(contactRecordId)) {
        return { success: false, error: '紀錄 ID 不正確' };
    }
    const trimmed = summary.trim();
    if (!trimmed) {
        return { success: false, error: '請填寫追蹤摘要' };
    }

    const client = await pool.connect();
    try {
        const exists = await client.query(
            `SELECT 1 FROM contact_records WHERE id = $1::bigint LIMIT 1`,
            [contactRecordId],
        );
        if (exists.rowCount === 0) {
            return { success: false, error: '找不到此紀錄' };
        }

        const res = await client.query(
            `WITH inserted AS (
                 INSERT INTO contact_record_followups
                     (contact_record_id, author_user_id, summary, kind)
                 VALUES ($1::bigint, $2::bigint, $3, 'followup')
                 RETURNING id::text, contact_record_id::text, author_user_id::text, summary, created_at, updated_at
             )
             SELECT inserted.*,
                    u.name_enc AS author_name_enc,
                    u.name_iv AS author_name_iv,
                    u.account AS author_account
             FROM inserted
             LEFT JOIN users u ON u.id = inserted.author_user_id::bigint`,
            [contactRecordId, operatorUserId, trimmed],
        );
        const r = res.rows[0];
        const followup: ContactRecordFollowup = {
            id: r.id,
            contactRecordId: r.contact_record_id,
            authorUserId: r.author_user_id ?? null,
            authorName: decryptName(r.author_name_enc, r.author_name_iv, r.author_account ?? '未知人員'),
            summary: r.summary ?? '',
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : '',
        };

        void writeAuditLog({
            userId: operatorUserId,
            action: 'contact_record.updated',
            targetType: 'contact_record',
            targetId: contactRecordId,
            detail: { field: 'followup_summary', followup_id: followup.id },
        });
        return { success: true, data: followup };
    } catch (err: any) {
        console.error('createContactRecordFollowup error:', err);
        return { success: false, error: err.message ?? '新增追蹤摘要失敗' };
    } finally {
        client.release();
    }
}

export async function updateContactRecordFollowup(
    operatorUserId: string,
    followupId: string,
    summary: string,
): Promise<ActionResult<ContactRecordFollowup>> {
    if (!(await hasAnyRole(operatorUserId, ALLOWED_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    if (!/^\d+$/.test(followupId)) {
        return { success: false, error: '追蹤摘要 ID 不合法' };
    }
    const trimmed = summary.trim();
    if (!trimmed) {
        return { success: false, error: '請填寫追蹤摘要' };
    }

    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT author_user_id::text
             FROM contact_record_followups
             WHERE id = $1::bigint AND kind = 'followup'`,
            [followupId],
        );
        if (cur.rowCount === 0) {
            return { success: false, error: '找不到追蹤摘要' };
        }
        if (cur.rows[0].author_user_id !== operatorUserId) {
            return { success: false, error: '只有本人可以修改此追蹤摘要' };
        }

        const res = await client.query(
            `WITH updated AS (
                 UPDATE contact_record_followups
                 SET summary = $2,
                     updated_at = NOW()
                 WHERE id = $1::bigint AND kind = 'followup'
                 RETURNING id::text, contact_record_id::text, author_user_id::text, summary, created_at, updated_at
             )
             SELECT updated.*,
                    u.name_enc AS author_name_enc,
                    u.name_iv AS author_name_iv,
                    u.account AS author_account
             FROM updated
             LEFT JOIN users u ON u.id = updated.author_user_id::bigint`,
            [followupId, trimmed],
        );
        const r = res.rows[0];
        const followup: ContactRecordFollowup = {
            id: r.id,
            contactRecordId: r.contact_record_id,
            authorUserId: r.author_user_id ?? null,
            authorName: decryptName(r.author_name_enc, r.author_name_iv, r.author_account ?? '未知人員'),
            summary: r.summary ?? '',
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : '',
        };

        void writeAuditLog({
            userId: operatorUserId,
            action: 'contact_record.updated',
            targetType: 'contact_record',
            targetId: followup.contactRecordId,
            detail: { field: 'followup_summary', followup_id: followup.id, operation: 'edit' },
        });
        return { success: true, data: followup };
    } catch (err: any) {
        console.error('updateContactRecordFollowup error:', err);
        return { success: false, error: err.message ?? '修改追蹤摘要失敗' };
    } finally {
        client.release();
    }
}

// ─── Update ───────────────────────────────────────────────────────────────

export async function updateContactRecord(
    operatorUserId: string,
    recordId: string,
    input: ContactRecordInput,
): Promise<ActionResult> {
    if (!/^\d+$/.test(recordId)) return { success: false, error: '紀錄不存在' };
    if (input.recordType !== '1' && input.recordType !== '2') {
        return { success: false, error: '紀錄類型無效' };
    }
    if (!input.contactDate || isNaN(new Date(input.contactDate).getTime())) {
        return { success: false, error: '日期無效' };
    }
    const summary = (input.summary ?? '').trim();
    const callerName = (input.callerName ?? '').trim();
    const callerPhone = (input.callerPhone ?? '').trim();
    const callerPhoneFromCallerId = input.recordType === '1'
        && !!callerPhone
        && input.callerPhoneFromCallerId === true;
    if (input.recordType === '1' && !callerName && !callerPhone) {
        return { success: false, error: '來電紀錄至少需填寫姓名或聯絡方式' };
    }
    if (input.recordType === '2' && !input.applicantUserId) {
        return { success: false, error: '關懷紀錄必須選擇申請人' };
    }
    const cleanReasons = normCodes(input.rejectReasons, REJECT_REASON_CODES);
    const cleanMedia = normUrls(input.mediaUrls);
    const specialAttention = normalizeSpecialAttention(input);
    if (!specialAttention) {
        return { success: false, error: '特殊注意時請填寫說明' };
    }

    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT handler_user_id::text, summary FROM contact_records WHERE id = $1::bigint`,
            [recordId],
        );
        if (cur.rowCount === 0) return { success: false, error: '紀錄不存在' };
        if (cur.rows[0].handler_user_id !== operatorUserId) {
            return { success: false, error: '只有建立者可以編輯此紀錄' };
        }
        const contactedParty = input.recordType === '2' && input.contactedParty
            ? input.contactedParty : null;
        const contactedPartyOther = contactedParty === '9'
            ? ((input.contactedPartyOther ?? '').trim() || null) : null;
        await client.query(
            `UPDATE contact_records
             SET record_type = $1, contact_date = $2::date,
                 applicant_user_id = $3, caller_name = $4, caller_gender = $5, caller_phone = $6,
                 caller_phone_from_caller_id = $7,
                 application_id = $8, from_source = $9, consultant_type = $10, consult_program = $11,
                 reject_reasons = $12::text[], summary = $13,
                 is_special_attention = $14, special_attention_note = $15, media_urls = $16::text[],
                 contacted_party = $17, contacted_party_other = $18,
                 updated_at = NOW()
              WHERE id = $19::bigint`,
            [
                input.recordType, input.contactDate,
                input.applicantUserId ?? null,
                callerName || null,
                input.callerGender ?? null,
                callerPhone || null,
                callerPhoneFromCallerId,
                input.applicationId ?? null,
                input.fromSource ?? null,
                input.consultantType ?? null,
                input.consultProgram ?? null,
                cleanReasons, cur.rows[0].summary ?? null,
                specialAttention.isSpecialAttention, specialAttention.specialAttentionNote, cleanMedia,
                contactedParty, contactedPartyOther,
                recordId,
            ],
        );
        void writeAuditLog({
            userId: operatorUserId,
            action: 'contact_record.updated',
            targetType: 'contact_record',
            targetId: recordId,
            detail: { record_type: input.recordType, is_special_attention: specialAttention.isSpecialAttention },
        });
        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('updateContactRecord error:', err);
        return { success: false, error: err.message ?? '更新失敗' };
    } finally {
        client.release();
    }
}

// ─── Delete ───────────────────────────────────────────────────────────────

export async function deleteContactRecord(
    operatorUserId: string,
    recordId: string,
): Promise<ActionResult> {
    if (!/^\d+$/.test(recordId)) return { success: false, error: '紀錄不存在' };
    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT handler_user_id::text, applicant_user_id::text, record_type
             FROM contact_records WHERE id = $1::bigint`,
            [recordId],
        );
        if (cur.rowCount === 0) return { success: false, error: '紀錄不存在' };
        const row = cur.rows[0];
        const isCreator = row.handler_user_id === operatorUserId;
        const isAdmin = await hasAnyRole(operatorUserId, ['admin']);
        if (!isCreator && !isAdmin) return { success: false, error: '權限不足' };
        await client.query(`DELETE FROM contact_records WHERE id = $1::bigint`, [recordId]);
        void writeAuditLog({
            userId: operatorUserId,
            action: 'contact_record.deleted',
            targetType: 'contact_record',
            targetId: recordId,
            detail: {
                record_type: row.record_type,
                handler_user_id: row.handler_user_id,
                applicant_user_id: row.applicant_user_id,
                deleted_by_role: isCreator ? 'creator' : 'admin',
            },
        });
        return { success: true, data: undefined };
    } catch (err: any) {
        console.error('deleteContactRecord error:', err);
        return { success: false, error: err.message ?? '刪除失敗' };
    } finally {
        client.release();
    }
}
