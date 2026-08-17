'use server';

import { pool } from '../../lib/db';
import { formatDateOnly } from '../../lib/dateOnly';
import {
    DB_STAGE_TO_FRONTEND,
    FRONTEND_TO_DB_STAGE,
    ADVANCE_STAGE_TO_STATUS,
    STAGE_LABEL,
    STATUS_LABEL,
} from '../../lib/stageMaps';
import { writeAuditLog } from './auditActions';
import { fetchSetting } from './settingsActions';

export interface BoardReconsiderationRequest {
    id: string;
    status: 'pending_supervisor' | 'approved' | 'rejected';
    reason: string;
    attachmentUrl: string | null;
    attachmentUrls: string[];
    requestedBy: string | null;
    requestedAt: string;
    supervisorId: string | null;
    supervisorNote: string | null;
    supervisorReviewedAt: string | null;
    finalBoardReviewComments: string | null;
    finalApprovedAmount: number | null;
}

export interface BoardReviewRound {
    id: string;
    roundNo: number;
    isLatest: boolean;
    sourceReconsiderationId: string | null;
    approvedAmount: number | null;
    comments: string | null;
    completedAt: string | null;
    signatures: Array<{
        signerUserId: string | null;
        signerName: string;
        signedAt: string | null;
        memberApproved: boolean | null;
        memberAmount: number | null;
        memberComments: string | null;
        isChairman: boolean;
        isGroupMember: boolean;
    }>;
}

export interface ApplicationDetail {
    id: string;
    caseNumber: string;
    status: string;
    statusLabel: string;
    stage: string;
    applicantName: string;
    applicantEmail?: string | null;
    /** 申請人身分證字號（server 端解密後供案件頁顯示） */
    applicantIdNumber?: string | null;
    /** 申請人聯絡電話（內外部收件皆必填） */
    applicantPhone?: string | null;
    /** 申請人出生年月日（西元 YYYY-MM-DD） */
    applicantDob?: string | null;
    /** 癌別自由文字 */
    cancerType?: string | null;
    /** 癌症期數自由文字 */
    cancerStage?: string | null;
    /** 申請形式：'P' 紙本 / 'E' 電子郵件 */
    applicationForm?: 'P' | 'E' | null;
    /** 治療階段：'B' 治療前 / 'A' 治療後 / 'X' 治療前後 */
    treatmentPhase?: 'B' | 'A' | 'X' | null;
    /** 申請人戶籍地址（領款收據用） */
    applicantAddress?: string | null;
    /** 主管審核 → 送董事閘門：null=未審, true=已通過, false=已退件 */
    supervisorApprovedForBoard?: boolean | null;
    /** 主管審核 → 送會計閘門 */
    supervisorApprovedForAccounting?: boolean | null;
    /** 主管退件原因或通過備註 */
    supervisorReviewNote?: string | null;
    /** 是否目前等待主管審核中（個管已送主管、主管尚未通過/退件）
     *  邏輯：supervisor_approved_for_board IS NULL 且 audit_logs 有 application.request_supervisor_review_board 紀錄 */
    supervisorReviewPending?: boolean;
    officerName?: string;
    applyAt?: string;
    createdAt?: string;
    // Qualification pre-screening fields
    age?: number | null;
    moveableProperty?: number | null;
    immoveableProperty?: number | null;
    annualIncome?: number | null;
    maritalStatus?: string | null;
    hasChildren?: boolean | null;
    underageChildrenCount?: number | null;
    adultChildrenCount?: number | null;
    // Board review fields
    applyAmount?: number | null;
    approvedAmount?: number | null;
    /** 通過案件未全額撥款即結案時的原因；NULL 表示正常核銷結案 */
    earlyCloseReason?: string | null;
    boardReviewComments?: string | null;
    boardReviewRounds?: BoardReviewRound[];
    boardReconsideration?: BoardReconsiderationRequest | null;
    boardReconsiderationHistory?: BoardReconsiderationRequest[];
    // Workflow fields
    wfIsApproved?: boolean | null;
    wfComments?: string | null;
    // Application type (A/B/C/D), set at creation, read-only
    applicationType?: string | null;
    // Cumulative approved amount across all completed applications for this applicant
    totalApprovedAmount?: number;
    /** 累積核准補助金額（subsidy_subtype='1' 經濟弱勢 案件加總） */
    totalApprovedSubtype1?: number;
    /** 累積核准補助金額（subsidy_subtype='2' 小康家庭 案件加總） */
    totalApprovedSubtype2?: number;
    // Applicant user ID (for fetching historical receipts, etc.)
    applicantId?: string | null;
    // Officer user ID (for UI permission check — e.g. basics-edit button)
    officerId?: string | null;
    // Referral tracking
    applicationWay?: '1' | '2';
    referralUnitId?: string | null;
    referralUnitName?: string | null;   // 自由填寫的單位名稱（#6 改版後優先此欄；舊資料來自 referral_units join）
    referralContactName?: string | null;
    referralContactTitle?: string | null;
    referralContactPhone?: string | null;
    referralContactEmail?: string | null;
    // 家訪指派（#11）
    homeVisitAssigneeId?: string | null;
    homeVisitAssigneeName?: string | null;
    // 補助子類型（#2，115 年辦法）：'1'=經濟弱勢, '2'=小康家庭
    subsidySubtype?: '1' | '2' | null;
    // 經濟弱勢專屬欄位（萬元）
    econDeposit?: number | null;
    econMonthlyIncome?: number | null;
    // #17 個管師案件說明（建議 5 點條列）
    officerCaseSummary?: string | null;
    // 家庭訪視階段：家訪表是否已存（home_visit 列存在且 visit_date 有值，或 visit_skipped=true）
    homeVisitSaved?: boolean;
    // 家庭訪視階段：是否標記為「免家訪」（visit_skipped=true）。true 時免指派人員/免填家訪表
    homeVisitSkipped?: boolean;
}

function normalizeAttachmentUrls(legacyUrl: unknown, rawUrls: unknown): string[] {
    const urls: string[] = [];
    if (Array.isArray(rawUrls)) {
        for (const item of rawUrls) {
            const url = typeof item === 'string' ? item.trim() : '';
            if (url) urls.push(url);
        }
    } else if (typeof rawUrls === 'string') {
        try {
            const parsed = JSON.parse(rawUrls);
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    const url = typeof item === 'string' ? item.trim() : '';
                    if (url) urls.push(url);
                }
            }
        } catch { /* ignore */ }
    }
    const legacy = typeof legacyUrl === 'string' ? legacyUrl.trim() : '';
    if (legacy && !urls.includes(legacy)) urls.unshift(legacy);
    return urls;
}

// Guard: mock store IDs look like 'app-001-a', real DB IDs are numeric UUIDs or bigints.
// The applications table uses BIGSERIAL (bigint PK), so valid IDs are all-digit strings.
function isValidDbId(id: string): boolean {
    return /^\d+$/.test(id);
}

async function persistBoardReviewRoundSnapshot(
    client: any,
    applicationId: string,
    sourceReconsiderationId: string | null,
    approvedAmount: number,
    comments: string | null,
    signatureRows: any[],
): Promise<string | null> {
    const { decryptAES } = await import('../../lib/crypto');
    const signatures = signatureRows.map((r: any) => {
        const signerName = r.name_enc && r.name_iv
            ? (decryptAES(r.name_enc, r.name_iv) || r.account || '未知')
            : (r.account || '未知');
        return {
            signerUserId: r.uid != null ? String(r.uid) : null,
            signerName,
            signedAt: r.signed_at ? new Date(r.signed_at).toISOString() : null,
            memberApproved: r.member_approved ?? null,
            memberAmount: r.member_amount != null ? Number(r.member_amount) : null,
            memberComments: r.member_comments ?? null,
            isChairman: !!r.is_chairman,
            isGroupMember: !!r.is_group_member,
        };
    });

    if (sourceReconsiderationId) {
        const existing = await client.query(
            `SELECT id::text
             FROM board_review_rounds
             WHERE application_id = $1::bigint
               AND source_reconsideration_id = $2::bigint
             LIMIT 1`,
            [applicationId, sourceReconsiderationId],
        );
        if ((existing.rowCount ?? 0) > 0) {
            await client.query(
                `UPDATE board_review_rounds
                 SET approved_amount = $1,
                     comments = $2,
                     signatures = $3::jsonb,
                     completed_at = NOW(),
                     is_latest = TRUE
                 WHERE id = $4::bigint`,
                [approvedAmount, comments, JSON.stringify(signatures), existing.rows[0].id],
            );
            await client.query(
                `UPDATE board_review_rounds
                 SET is_latest = FALSE
                 WHERE application_id = $1::bigint AND id <> $2::bigint`,
                [applicationId, existing.rows[0].id],
            );
            return existing.rows[0].id;
        }
    }

    const roundRes = await client.query(
        `SELECT COALESCE(MAX(round_no), 0) + 1 AS next_round
         FROM board_review_rounds
         WHERE application_id = $1::bigint`,
        [applicationId],
    );
    const nextRound = Number(roundRes.rows[0]?.next_round ?? 1);
    await client.query(
        `UPDATE board_review_rounds
         SET is_latest = FALSE
         WHERE application_id = $1::bigint`,
        [applicationId],
    );
    const inserted = await client.query(
        `INSERT INTO board_review_rounds
            (application_id, round_no, source_reconsideration_id, approved_amount, comments, signatures, completed_at, is_latest)
         VALUES ($1::bigint, $2, $3::bigint, $4, $5, $6::jsonb, NOW(), TRUE)
         RETURNING id::text`,
        [
            applicationId,
            nextRound,
            sourceReconsiderationId,
            approvedAmount,
            comments,
            JSON.stringify(signatures),
        ],
    );
    return inserted.rows[0]?.id ?? null;
}

async function snapshotCurrentBoardReviewIfMissing(client: any, applicationId: string): Promise<void> {
    const existing = await client.query(
        `SELECT 1 FROM board_review_rounds WHERE application_id = $1::bigint LIMIT 1`,
        [applicationId],
    );
    if ((existing.rowCount ?? 0) > 0) return;

    const appRes = await client.query(
        `SELECT approved_amount, board_review_comments
         FROM applications
         WHERE id = $1::bigint
         LIMIT 1`,
        [applicationId],
    );
    const sigRes = await client.query(
        `SELECT s.signer_user_id::text AS uid,
                s.member_approved, s.member_amount, s.member_comments, s.signed_at,
                u.name_enc, u.name_iv, u.account,
                EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                        WHERE ur.user_id = s.signer_user_id AND r.code = 'chairman') AS is_chairman,
                EXISTS (SELECT 1 FROM board_review_assignments bra
                        JOIN board_group_members bgm
                             ON bgm.group_id = bra.group_id
                            AND bgm.user_id = s.signer_user_id
                        WHERE bra.application_id = s.application_id) AS is_group_member
         FROM board_review_signatures s
         JOIN users u ON u.id = s.signer_user_id
         WHERE s.application_id = $1::bigint
           AND s.signature_data_url IS NOT NULL
           AND s.signature_data_url <> ''`,
        [applicationId],
    );
    const approvedAmount = appRes.rows[0]?.approved_amount != null
        ? Number(appRes.rows[0].approved_amount)
        : 0;
    const comments = appRes.rows[0]?.board_review_comments ?? null;
    if ((sigRes.rowCount ?? 0) === 0 && !comments && approvedAmount === 0) return;
    await persistBoardReviewRoundSnapshot(
        client,
        applicationId,
        null,
        approvedAmount,
        comments,
        sigRes.rows,
    );
}

/**
 * Verify that every current member of the case's assigned board group has a
 * signature row whose content_hash equals the freshly recomputed current hash.
 * Invoked within existing transactions before status updates.
 */
async function checkBoardSignatureGate(
    client: any,
    applicationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    // Must have an assignment first
    const asg = await client.query(
        `SELECT group_id FROM board_review_assignments WHERE application_id = $1::bigint LIMIT 1`,
        [applicationId]
    );
    if (asg.rowCount === 0) {
        return { ok: false, error: '案件尚未派組，無法推進（請董事長先派組並由組員簽章）' };
    }
    const groupId = String(asg.rows[0].group_id);

    // Per-member hash 模式（v2）：每位組員依自己的 member_approved/amount/comments 計算雜湊
    // 並比對該成員 board_review_signatures.content_hash 是否相符 + 簽章圖檔非空。
    const rows = await client.query(
        `SELECT
            m.user_id::text AS user_id,
            s.signature_data_url, s.content_hash,
            s.member_approved, s.member_amount, s.member_comments
         FROM board_group_members m
         LEFT JOIN board_review_signatures s
                ON s.signer_user_id = m.user_id AND s.application_id = $2::bigint
         WHERE m.group_id = $1::bigint`,
        [groupId, applicationId]
    );
    if (rows.rowCount === 0) {
        return { ok: false, error: '派組無任何成員，無法推進' };
    }
    const { createHash } = await import('crypto');
    const computeHash = (uid: string, approved: boolean | null, amount: number | null, comments: string | null) => {
        const parts = [
            'v2',
            String(applicationId),
            uid,
            approved != null ? String(approved) : 'null',
            amount != null ? String(amount) : 'null',
            comments != null ? comments : 'null',
            groupId,
        ];
        return createHash('sha256').update(parts.join('|')).digest('hex');
    };

    let invalidCount = 0;
    let unsignedCount = 0;
    const memberDecisions: Array<boolean | null> = [];
    const memberAmounts: Array<number | null> = [];
    for (const r of rows.rows) {
        const sig = r.signature_data_url;
        if (!sig || sig === '') {
            unsignedCount += 1;
            continue;
        }
        const expected = computeHash(
            r.user_id,
            r.member_approved ?? null,
            r.member_amount != null ? Number(r.member_amount) : null,
            r.member_comments ?? null,
        );
        if (r.content_hash !== expected) invalidCount += 1;
        memberDecisions.push(r.member_approved ?? null);
        memberAmounts.push(r.member_amount != null ? Number(r.member_amount) : null);
    }
    if (unsignedCount > 0 || invalidCount > 0) {
        const parts: string[] = [];
        if (unsignedCount > 0) parts.push(`${unsignedCount} 位未簽署`);
        if (invalidCount > 0)  parts.push(`${invalidCount} 位簽章因內容變動已失效`);
        return { ok: false, error: `尚有 ${parts.join('、')}，請該組員重新簽章` };
    }

    // user feedback #9：兩位董事意見不一致（同意/否 OR 金額不同）→ 須董事長簽章為第 3 人
    const uniqueDecisions = new Set(memberDecisions.map(d => d === true ? 't' : d === false ? 'f' : 'n'));
    const uniqueAmounts   = new Set(memberAmounts.map(a => a == null ? 'null' : String(a)));
    const decisionsDiffer = uniqueDecisions.size > 1;
    const amountsDiffer   = uniqueAmounts.size > 1;
    if (decisionsDiffer || amountsDiffer) {
        // 找出 chairman；檢查是否已有 chairman 的有效簽章
        const chairmanRes = await client.query(
            `SELECT u.id::text AS uid,
                    bs.signature_data_url, bs.content_hash,
                    bs.member_approved, bs.member_amount, bs.member_comments
             FROM users u
             JOIN user_roles ur ON ur.user_id = u.id
             JOIN roles r ON r.id = ur.role_id AND r.code = 'chairman'
             LEFT JOIN board_review_signatures bs
                    ON bs.signer_user_id = u.id AND bs.application_id = $1::bigint
             WHERE u.is_active = true`,
            [applicationId]
        );
        const disagreeReason = decisionsDiffer
            ? (amountsDiffer ? '意見與金額皆不一致' : '同意/不同意意見不一致')
            : '金額不一致';
        const chairman = chairmanRes.rows[0];
        if (!chairman) {
            return { ok: false, error: `兩位董事${disagreeReason}，系統內無啟用中的董事長帳號可作第三審` };
        }
        if (!chairman.signature_data_url || chairman.signature_data_url === '') {
            return { ok: false, error: `兩位董事${disagreeReason}，請董事長以第三審身分審核並簽章後才能推進` };
        }
        const chairExpected = computeHash(
            chairman.uid,
            chairman.member_approved ?? null,
            chairman.member_amount != null ? Number(chairman.member_amount) : null,
            chairman.member_comments ?? null,
        );
        if (chairman.content_hash !== chairExpected) {
            return { ok: false, error: '董事長簽章已因內容變動而失效，請董事長重新簽章' };
        }
    }
    return { ok: true };
}

export async function fetchApplicationDetail(applicationId: string): Promise<ApplicationDetail | null> {
    // Reject mock store IDs (e.g. 'app-010-a') which are not valid bigints
    if (!isValidDbId(applicationId)) return null;
    const client = await pool.connect();
    try {
        // Join with application_workflow to get the ACTUAL current stage
        const res = await client.query(`
            SELECT
                a.id, a.case_number, a.status, a.apply_at, a.created_at,
                a.application_type, a.applicant_id, a.officer_id, a.applicant_phone,
                a.applicant_dob, a.cancer_type, a.cancer_stage,
                a.application_form, a.treatment_phase, a.applicant_address,
                a.supervisor_approved_for_board, a.supervisor_approved_for_accounting, a.supervisor_review_note,
                /* 是否等待主管審核中：尚未通過/退件 + 有任何「請主管審核」audit log */
                (a.supervisor_approved_for_board IS NULL AND EXISTS (
                    SELECT 1 FROM audit_logs al
                    WHERE al.target_type = 'application'
                      AND al.target_id = a.id::text
                      AND al.action = 'application.request_supervisor_review_board'
                )) AS supervisor_review_pending,
                totals.total_approved_amount,
                totals.total_approved_subtype1,
                totals.total_approved_subtype2,
                a.age, a.moveable_property, a.immoveable_property,
                a.annual_income, a.marital_status, a.has_children, a.underage_children_count, a.adult_children_count,
                a.apply_amount, a.approved_amount, a.early_close_reason, a.board_review_comments,
                a.application_way, a.referral_unit_id,
                ru.name AS referral_unit_name_legacy,
                a.referral_unit_name      AS referral_unit_name_text,
                a.referral_contact_name, a.referral_contact_title, a.referral_contact_phone, a.referral_contact_email,
                a.subsidy_subtype, a.econ_deposit, a.econ_monthly_income,
                a.officer_case_summary,
                a.home_visit_assignee_id,
                EXISTS (SELECT 1 FROM home_visit hv
                        WHERE hv.application_id = a.id
                          AND (hv.visit_date IS NOT NULL OR hv.visit_skipped = true)
                        LIMIT 1) AS home_visit_saved,
                EXISTS (SELECT 1 FROM home_visit hv2
                        WHERE hv2.application_id = a.id AND hv2.visit_skipped = true
                        LIMIT 1) AS home_visit_skipped,
                u_hva.name_enc AS hva_name_enc, u_hva.name_iv AS hva_name_iv, u_hva.account AS hva_account,
                w.stage as wf_stage,
                w.is_approved as wf_is_approved,
                w.comments as wf_comments,
                bw.comments as latest_board_workflow_comments,
                bsig.member_comments as board_signature_comments,
                br.id::text AS br_id,
                br.status AS br_status,
                br.reason AS br_reason,
                br.attachment_url AS br_attachment_url,
                br.attachment_urls AS br_attachment_urls,
                br.requested_by::text AS br_requested_by,
                br.requested_at AS br_requested_at,
                br.supervisor_id::text AS br_supervisor_id,
                br.supervisor_note AS br_supervisor_note,
                br.supervisor_reviewed_at AS br_supervisor_reviewed_at,
                br.final_board_review_comments AS br_final_board_review_comments,
                br.final_approved_amount AS br_final_approved_amount,
                u_app.name_enc as app_name_enc, u_app.name_iv  as app_name_iv,
                u_app.email as app_email,
                u_app.id_number_enc as app_id_number_enc, u_app.id_number_iv as app_id_number_iv,
                u_off.name_enc as off_name_enc, u_off.name_iv  as off_name_iv
            FROM applications a
            LEFT JOIN LATERAL (
                SELECT stage, is_approved, comments
                FROM application_workflow
                WHERE application_id = a.id
                ORDER BY id DESC LIMIT 1
            ) w ON TRUE
            LEFT JOIN LATERAL (
                SELECT comments
                FROM application_workflow
                WHERE application_id = a.id
                  AND stage = 'board_review'
                  AND comments IS NOT NULL
                  AND btrim(comments) <> ''
                ORDER BY id DESC LIMIT 1
            ) bw ON TRUE
            LEFT JOIN LATERAL (
                SELECT string_agg(
                    concat(
                        COALESCE(NULLIF(u.account, ''), '董事'),
                        '：',
                        CASE
                            WHEN s.member_approved IS TRUE THEN '通過'
                            WHEN s.member_approved IS FALSE THEN '不通過'
                            ELSE '未填寫決議'
                        END,
                        CASE
                            WHEN s.member_amount IS NOT NULL THEN '，核定金額 NT$' || trim(to_char(s.member_amount, 'FM999,999,999,999'))
                            ELSE ''
                        END,
                        E'\n',
                        s.member_comments
                    ),
                    E'\n\n' ORDER BY s.signed_at NULLS LAST, s.signer_user_id
                ) AS member_comments
                FROM board_review_signatures s
                LEFT JOIN users u ON u.id = s.signer_user_id
                WHERE s.application_id = a.id
                  AND s.member_comments IS NOT NULL
                  AND btrim(s.member_comments) <> ''
            ) bsig ON TRUE
            LEFT JOIN LATERAL (
                SELECT id, status, reason, attachment_url, attachment_urls, requested_by, requested_at,
                       supervisor_id, supervisor_note, supervisor_reviewed_at,
                       final_board_review_comments, final_approved_amount
                FROM board_reconsideration_requests
                WHERE application_id = a.id
                ORDER BY requested_at DESC, id DESC
                LIMIT 1
            ) br ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(SUM(amount), 0) AS total_approved_amount,
                    COALESCE(SUM(amount) FILTER (WHERE subsidy_subtype = '1'), 0) AS total_approved_subtype1,
                    COALESCE(SUM(amount) FILTER (WHERE subsidy_subtype = '2'), 0) AS total_approved_subtype2
                FROM (
                    SELECT
                        a2.subsidy_subtype,
                        CASE
                            WHEN pd.total_amount IS NOT NULL THEN pd.total_amount
                            WHEN a2.status = '4' THEN COALESCE(a2.approved_amount, 0)
                            ELSE 0
                        END AS amount
                    FROM applications a2
                    LEFT JOIN LATERAL (
                        SELECT SUM(amount) AS total_amount
                        FROM payment_disbursements pd
                        WHERE pd.application_id = a2.id
                          AND pd.review_stage IS DISTINCT FROM 'X'
                    ) pd ON TRUE
                    WHERE a2.applicant_id = a.applicant_id
                      AND a2.status IN ('3', '4')
                ) consumed
                WHERE amount > 0
            ) totals ON TRUE
            LEFT JOIN users u_app ON u_app.id = a.applicant_id
            LEFT JOIN users u_off ON u_off.id = a.officer_id
            LEFT JOIN users u_hva ON u_hva.id = a.home_visit_assignee_id
            LEFT JOIN referral_units ru ON ru.id = a.referral_unit_id
            WHERE a.id = $1
            LIMIT 1
        `, [applicationId]);

        if (res.rows.length === 0) return null;
        const row = res.rows[0];

        const sigRes = await client.query(`
            SELECT u.account, u.name_enc, u.name_iv,
                   s.member_approved, s.member_amount, s.member_comments
            FROM board_review_signatures s
            LEFT JOIN users u ON u.id = s.signer_user_id
            WHERE s.application_id = $1::bigint
              AND s.member_comments IS NOT NULL
              AND btrim(s.member_comments) <> ''
            ORDER BY s.signed_at NULLS LAST, s.signer_user_id
        `, [applicationId]);

        const reconsiderHistoryRes = await client.query(`
            SELECT id::text, status, reason, attachment_url, attachment_urls,
                   requested_by::text, requested_at,
                   supervisor_id::text, supervisor_note, supervisor_reviewed_at,
                   final_board_review_comments, final_approved_amount
            FROM board_reconsideration_requests
            WHERE application_id = $1::bigint
            ORDER BY requested_at DESC, id DESC
        `, [applicationId]);

        const boardRoundRes = await client.query(`
            SELECT id::text, round_no, source_reconsideration_id::text,
                   approved_amount, comments, signatures, completed_at, is_latest
            FROM board_review_rounds
            WHERE application_id = $1::bigint
            ORDER BY round_no DESC
        `, [applicationId]);

        const { decryptAES } = await import('../../lib/crypto');
        const applicantName = row.app_name_enc && row.app_name_iv
            ? decryptAES(row.app_name_enc, row.app_name_iv) || '未知'
            : '未知';
        const applicantIdNumber = row.app_id_number_enc && row.app_id_number_iv
            ? decryptAES(row.app_id_number_enc, row.app_id_number_iv) || null
            : null;
        const officerName = row.off_name_enc && row.off_name_iv
            ? decryptAES(row.off_name_enc, row.off_name_iv) || undefined
            : undefined;

        const dbStatus = row.status ?? '1';
        const statusLabel = STATUS_LABEL[dbStatus] ?? '審核中';

        // Use workflow.stage (DB key) to determine the exact frontend stage.
        // Falls back to 'application' if no workflow row yet.
        const dbWfStage = row.wf_stage ?? 'apply';
        const stage = DB_STAGE_TO_FRONTEND[dbWfStage] ?? 'application';
        const boardSignatureComments = sigRes.rows.length > 0
            ? sigRes.rows.map(sig => {
                const signerName = sig.name_enc && sig.name_iv
                    ? (decryptAES(sig.name_enc, sig.name_iv) || sig.account || '董事')
                    : (sig.account || '董事');
                const decision = sig.member_approved === true
                    ? '通過'
                    : sig.member_approved === false
                        ? '不通過'
                        : '未填寫決議';
                const amount = sig.member_amount != null
                    ? `，核定金額 NT$${Number(sig.member_amount).toLocaleString()}`
                    : '';
                return `${signerName}：${decision}${amount}\n${sig.member_comments}`;
            }).join('\n\n')
            : null;
        const boardReviewComments =
            [row.board_review_comments, boardSignatureComments, row.latest_board_workflow_comments]
                .map(v => (v == null ? '' : String(v).trim()))
                .find(v => v.length > 0) || null;
        const normalizeAttachmentUrls = (legacyUrl: unknown, rawUrls: unknown): string[] => {
            const urls: string[] = [];
            if (Array.isArray(rawUrls)) {
                for (const item of rawUrls) {
                    const url = typeof item === 'string' ? item.trim() : '';
                    if (url) urls.push(url);
                }
            } else if (typeof rawUrls === 'string') {
                try {
                    const parsed = JSON.parse(rawUrls);
                    if (Array.isArray(parsed)) {
                        for (const item of parsed) {
                            const url = typeof item === 'string' ? item.trim() : '';
                            if (url) urls.push(url);
                        }
                    }
                } catch { /* ignore */ }
            }
            const legacy = typeof legacyUrl === 'string' ? legacyUrl.trim() : '';
            if (legacy && !urls.includes(legacy)) urls.unshift(legacy);
            return urls;
        };
        const mapReconsideration = (r: any): BoardReconsiderationRequest => {
            const attachmentUrls = normalizeAttachmentUrls(r.attachment_url, r.attachment_urls);
            return {
                id: String(r.id),
                status: r.status,
                reason: r.reason ?? '',
                attachmentUrl: attachmentUrls[0] ?? null,
                attachmentUrls,
                requestedBy: r.requested_by != null ? String(r.requested_by) : null,
                requestedAt: r.requested_at ? new Date(r.requested_at).toISOString() : '',
                supervisorId: r.supervisor_id != null ? String(r.supervisor_id) : null,
                supervisorNote: r.supervisor_note ?? null,
                supervisorReviewedAt: r.supervisor_reviewed_at ? new Date(r.supervisor_reviewed_at).toISOString() : null,
                finalBoardReviewComments: r.final_board_review_comments ?? null,
                finalApprovedAmount: r.final_approved_amount != null ? Number(r.final_approved_amount) : null,
            };
        };
        const boardReconsiderationHistory = reconsiderHistoryRes.rows.map(mapReconsideration);
        const boardReviewRounds: BoardReviewRound[] = boardRoundRes.rows.map((r: any) => ({
            id: String(r.id),
            roundNo: Number(r.round_no),
            isLatest: !!r.is_latest,
            sourceReconsiderationId: r.source_reconsideration_id != null ? String(r.source_reconsideration_id) : null,
            approvedAmount: r.approved_amount != null ? Number(r.approved_amount) : null,
            comments: r.comments ?? null,
            completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
            signatures: Array.isArray(r.signatures) ? r.signatures : [],
        }));

        return {
            id: row.id,
            caseNumber: row.case_number,
            status: dbStatus,
            statusLabel,
            stage,
            applicantName,
            applicantEmail: row.app_email ?? null,
            applicantIdNumber,
            applicantPhone: row.applicant_phone ?? null,
            // pg DATE → local Date midnight；用 local components 避免 toISOString 跨時區掉一天
            applicantDob: row.applicant_dob
                ? (() => { const d = new Date(row.applicant_dob);
                    const p = (n: number) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })()
                : null,
            cancerType: row.cancer_type ?? null,
            cancerStage: row.cancer_stage ?? null,
            applicationForm: (row.application_form === 'P' || row.application_form === 'E') ? row.application_form : null,
            treatmentPhase: (row.treatment_phase === 'B' || row.treatment_phase === 'A' || row.treatment_phase === 'X') ? row.treatment_phase : null,
            applicantAddress: row.applicant_address ?? null,
            supervisorApprovedForBoard: row.supervisor_approved_for_board ?? null,
            supervisorApprovedForAccounting: row.supervisor_approved_for_accounting ?? null,
            supervisorReviewNote: row.supervisor_review_note ?? null,
            supervisorReviewPending: !!row.supervisor_review_pending,
            officerName,
            applyAt: formatDateOnly(row.apply_at) ?? undefined,
            createdAt: row.created_at ? row.created_at.toISOString() : undefined,
            age: row.age != null ? Number(row.age) : null,
            moveableProperty: row.moveable_property != null ? Number(row.moveable_property) : null,
            immoveableProperty: row.immoveable_property != null ? Number(row.immoveable_property) : null,
            annualIncome: row.annual_income != null ? Number(row.annual_income) : null,
            maritalStatus: row.marital_status ?? null,
            hasChildren: row.has_children ?? null,
            underageChildrenCount: row.underage_children_count != null ? Number(row.underage_children_count) : null,
            adultChildrenCount: row.adult_children_count != null ? Number(row.adult_children_count) : null,
            applyAmount: row.apply_amount != null ? Number(row.apply_amount) : null,
            approvedAmount: row.approved_amount != null ? Number(row.approved_amount) : null,
            earlyCloseReason: row.early_close_reason ?? null,
            boardReviewComments,
            boardReviewRounds,
            boardReconsideration: boardReconsiderationHistory[0] ?? null,
            boardReconsiderationHistory,
            wfIsApproved: row.wf_is_approved ?? null,
            wfComments: row.wf_comments ?? null,
            applicationType: row.application_type ?? null,
            totalApprovedAmount: Number(row.total_approved_amount ?? 0),
            totalApprovedSubtype1: Number(row.total_approved_subtype1 ?? 0),
            totalApprovedSubtype2: Number(row.total_approved_subtype2 ?? 0),
            applicantId: row.applicant_id ? String(row.applicant_id) : null,
            officerId: row.officer_id ? String(row.officer_id) : null,
            applicationWay: (row.application_way === '2' ? '2' : '1') as '1' | '2',
            referralUnitId: row.referral_unit_id != null ? String(row.referral_unit_id) : null,
            // 自由填寫欄位優先；舊資料 fallback 到 referral_units join
            referralUnitName: row.referral_unit_name_text ?? row.referral_unit_name_legacy ?? null,
            referralContactName: row.referral_contact_name ?? null,
            referralContactTitle: row.referral_contact_title ?? null,
            referralContactPhone: row.referral_contact_phone ?? null,
            referralContactEmail: row.referral_contact_email ?? null,
            subsidySubtype: (row.subsidy_subtype === '1' || row.subsidy_subtype === '2')
                ? row.subsidy_subtype : null,
            econDeposit: row.econ_deposit != null ? Number(row.econ_deposit) : null,
            econMonthlyIncome: row.econ_monthly_income != null ? Number(row.econ_monthly_income) : null,
            officerCaseSummary: row.officer_case_summary ?? null,
            homeVisitSaved: !!row.home_visit_saved,
            homeVisitSkipped: !!row.home_visit_skipped,
            homeVisitAssigneeId: row.home_visit_assignee_id != null ? String(row.home_visit_assignee_id) : null,
            homeVisitAssigneeName: row.hva_name_enc && row.hva_name_iv
                ? (decryptAES(row.hva_name_enc, row.hva_name_iv) || row.hva_account)
                : (row.hva_account ?? null),
        };
    } finally {
        client.release();
    }
}

/**
 * Advance stage forward. Updates applications.status and UPSERTS the single workflow row.
 */
export async function advanceWorkflowStage(
    applicationId: string,
    fromStage: string,
    toStage: string,
    reviewerUserId: string | null,
    comments?: string
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID（mock 資料不支援資料庫操作）' };
    const toStatus   = ADVANCE_STAGE_TO_STATUS[toStage]  ?? '1';
    const dbStage    = FRONTEND_TO_DB_STAGE[toStage]     ?? toStage;
    const stageLabel = STAGE_LABEL[toStage]               ?? toStage;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 0a. 角色閘門：board_review → reimbursement 僅 supervisor / admin 可推進
        //     董事 / 董事長僅負責簽章意見，不負責推進到撥款階段
        if (fromStage === 'board_review' && toStage === 'reimbursement') {
            if (!reviewerUserId || !/^\d+$/.test(reviewerUserId)) {
                await client.query('ROLLBACK');
                return { success: false, error: '缺少操作者身分，無法推進' };
            }
            const roleRes = await client.query(
                `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = $1::bigint AND r.code IN ('supervisor', 'admin') LIMIT 1`,
                [reviewerUserId]
            );
            if ((roleRes.rowCount ?? 0) === 0) {
                await client.query('ROLLBACK');
                return { success: false, error: '僅主管或系統管理員可將案件推進到撥款階段' };
            }
        }

        // 0. 若自 board_review 推進，須驗證全員簽章完整且 hash 有效
        if (fromStage === 'board_review') {
            const gate = await checkBoardSignatureGate(client, applicationId);
            if (!gate.ok) {
                await client.query('ROLLBACK');
                return { success: false, error: gate.error };
            }
        }

        // 0b. 文件齊備閘門：
        //    所有推進到 visit / board_review 的事件都只擋「不可延後補件」(allow_supplement=false) 的必備文件。
        //    「可延後補件」(allow_supplement=true) 的文件不阻擋流程推進；
        //    這類文件由系統其他機制（補件警示／報表「待收文件」欄）持續提醒個管補齊。
        const isAdvancingToVisit = toStage === 'visit';
        const isAdvancingToBoard = toStage === 'board_review';
        if (isAdvancingToVisit || isAdvancingToBoard) {
            const docGate = await client.query(
                `SELECT dtc.id, dtc.label
                 FROM document_type_config dtc
                 WHERE dtc.phase = 'apply'
                   AND dtc.is_required = true
                   AND dtc.allow_supplement = false
                   AND COALESCE(dtc.is_active, true) = true
                   AND (
                       dtc.subsidy_subtype IS NULL
                       OR dtc.subsidy_subtype = (
                           SELECT a.subsidy_subtype
                           FROM applications a
                           WHERE a.id = $1::bigint
                       )
                   )
                   AND NOT EXISTS (
                       SELECT 1 FROM application_documents ad
                       WHERE ad.application_id = $1::bigint
                         AND ad.id = dtc.id
                         AND ad.status = '1'
                   )
                 ORDER BY dtc.sort_order, dtc.id`,
                [applicationId]
            );
            if ((docGate.rowCount ?? 0) > 0) {
                const missing = docGate.rows.map(r => r.label).join('、');
                await client.query('ROLLBACK');
                const gateLabel = isAdvancingToBoard ? '送董事審核前' : '進入家訪前';
                return {
                    success: false,
                    error: `${gateLabel}尚有「不可延後補件」的必備文件未上傳或未核過：${missing}`,
                };
            }
        }

        // 0c. 推進到 board_review 必須先經過主管審核（user feedback #7 主管雙閘門）
        if (toStage === 'board_review') {
            const supRes = await client.query(
                `SELECT supervisor_approved_for_board, supervisor_review_note, officer_case_summary
                 FROM applications WHERE id = $1::bigint`,
                [applicationId]
            );
            const officerCaseSummary = supRes.rows[0]?.officer_case_summary;
            if (!officerCaseSummary || !String(officerCaseSummary).trim()) {
                await client.query('ROLLBACK');
                return { success: false, error: '送董事審核前須先填寫個管師案件說明' };
            }
            const supApproved = supRes.rows[0]?.supervisor_approved_for_board;
            if (supApproved !== true) {
                await client.query('ROLLBACK');
                if (supApproved === false) {
                    const note = supRes.rows[0]?.supervisor_review_note ?? '';
                    return { success: false, error: `主管已退件，請修正後重送：${note}` };
                }
                return { success: false, error: '請先按【送主管審核】等主管通過後才能推進到董事審核' };
            }
        }

        // 1. Update applications.status
        await client.query(
            `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2`,
            [toStatus, applicationId]
        );

        // 2. Append-only：每次推進階段都 INSERT 一列新紀錄，保留完整歷史。
        //    讀取「目前階段」改用 `ORDER BY id DESC LIMIT 1`。
        await client.query(`
            INSERT INTO application_workflow
                (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
            VALUES ($1, $2, $3, true, $4, NOW())
        `, [applicationId, dbStage, reviewerUserId, comments ?? null]);

        await client.query('COMMIT');
        void writeAuditLog({
            userId: reviewerUserId,
            action: 'application.stage_advance',
            targetType: 'application',
            targetId: applicationId,
            detail: { from: fromStage, to: toStage, comments },
        });

        // 進入 board_review 階段時，若系統設定 board_auto_assign='true'，觸發自動派組
        if (toStage === 'board_review') {
            const { maybeAutoAssignOnBoardReviewEntry } = await import('./boardGroupActions');
            void maybeAutoAssignOnBoardReviewEntry(applicationId);

            // Phase 3: 觸發 case_entered_board_review 事件通知（fire-and-forget）
            // 自動派組模式下，董事長不需手動派組，故略過此通知；改由事件 B
            // (case_assigned_to_board_group) 直接通知組員。
            const autoAssign = await fetchSetting('board_auto_assign', 'false');
            if (autoAssign !== 'true') {
                const { notifyEvent } = await import('./notificationDispatcher');
                void notifyEvent('case_entered_board_review', { applicationId })
                    .catch(err => console.error('[notify] case_entered_board_review failed:', err));
            }
        }

        // 從 board_review 推進到 reimbursement 時：
        //   1) 彙整審核意見到 applications.board_review_comments（供列印）
        //   2) approved_amount 由 chairman 第三審 / 派組多數決決定（規則與
        //      boardSignatureActions.recomputeApplicationApprovedAmount 一致）
        //   （refine-disbursement-flow：原自動寄領款收據已移除；改由個管師於每筆撥款手動觸發）
        if (fromStage === 'board_review' && toStage === 'reimbursement') {
            try {
                const aggClient = await pool.connect();
                try {
                    // 取得所有有簽章的 signatures + 該員角色（用來識別 chairman）+ 派組身分
                    const aggRes = await aggClient.query(
                        `SELECT s.signer_user_id::text AS uid,
                                s.member_approved, s.member_amount, s.member_comments, s.signed_at,
                                u.name_enc, u.name_iv, u.account,
                                EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                                        WHERE ur.user_id = s.signer_user_id AND r.code = 'chairman') AS is_chairman,
                                EXISTS (SELECT 1 FROM board_review_assignments bra
                                        JOIN board_group_members bgm
                                             ON bgm.group_id = bra.group_id
                                            AND bgm.user_id = s.signer_user_id
                                        WHERE bra.application_id = s.application_id) AS is_group_member
                         FROM board_review_signatures s
                         JOIN users u ON u.id = s.signer_user_id
                         WHERE s.application_id = $1::bigint
                           AND s.signature_data_url IS NOT NULL
                           AND s.signature_data_url <> ''`,
                        [applicationId]
                    );
                    const { decryptAES } = await import('../../lib/crypto');
                    const opinionLines: string[] = [];
                    // 彙整審核意見字串（含 chairman）
                    for (const r of aggRes.rows) {
                        const name = r.name_enc && r.name_iv
                            ? decryptAES(r.name_enc, r.name_iv) || r.account
                            : r.account;
                        if (r.member_comments && r.member_comments.trim() !== '') {
                            const roleTag = r.is_chairman && !r.is_group_member ? '・董事長第三審'
                                          : r.is_chairman ? '・董事長'
                                          : '';
                            const verdict = r.member_approved === true ? '通過' : r.member_approved === false ? '不通過' : '未表態';
                            const amt = r.member_amount != null ? `（${Number(r.member_amount).toLocaleString()} 元）` : '';
                            opinionLines.push(`【${name}${roleTag}・${verdict}${amt}】${r.member_comments}`);
                        }
                    }
                    const consolidatedComments = opinionLines.join('\n\n');

                    // approved_amount 的決定規則：
                    //   1) 若 chairman 已簽（chairman 為第三審裁決者）→ 採 chairman 的 member_amount
                    //   2) 否則 → 派組成員多數決，通過時取已同意者最高金額
                    const chairmanRow = aggRes.rows.find((r: any) => r.is_chairman === true);
                    let newAmount: number = 0;
                    if (chairmanRow) {
                        newAmount = chairmanRow.member_approved === true && chairmanRow.member_amount != null
                            ? Number(chairmanRow.member_amount)
                            : 0;
                    } else {
                        const groupRows = aggRes.rows.filter((r: any) => r.is_group_member === true);
                        if (groupRows.length > 0) {
                            const yes = groupRows.filter((r: any) => r.member_approved === true).length;
                            const approved = yes > groupRows.length / 2;
                            if (approved) {
                                newAmount = Math.max(
                                    ...groupRows.filter((r: any) => r.member_approved === true)
                                                .map((r: any) => r.member_amount != null ? Number(r.member_amount) : 0)
                                );
                            }
                        }
                    }

                    const reconsiderRes = await aggClient.query(
                        `SELECT id, reason, attachment_url, requested_at
                         FROM board_reconsideration_requests
                         WHERE application_id = $1::bigint
                           AND status = 'approved'
                           AND final_board_review_comments IS NULL
                         ORDER BY requested_at DESC, id DESC
                         LIMIT 1`,
                        [applicationId]
                    );

                    if ((reconsiderRes.rowCount ?? 0) > 0) {
                        const reconsider = reconsiderRes.rows[0];
                        const existingRes = await aggClient.query(
                            `SELECT board_review_comments
                             FROM applications
                             WHERE id = $1::bigint
                             LIMIT 1`,
                            [applicationId]
                        );
                        const existingComments = String(existingRes.rows[0]?.board_review_comments ?? '').trim();
                        const requestedDate = reconsider.requested_at
                            ? formatDateOnly(reconsider.requested_at)
                            : formatDateOnly(new Date());
                        const reconsiderHeader = [
                            `【再次董事審核 ${requestedDate}】`,
                            `退回原因：${reconsider.reason ?? ''}`,
                            reconsider.attachment_url ? `附件：${reconsider.attachment_url}` : null,
                        ].filter(Boolean).join('\n');
                        const reconsiderComments = [reconsiderHeader, consolidatedComments]
                            .filter(part => part && String(part).trim())
                            .join('\n\n');
                        const nextComments = [reconsiderComments]
                            .filter(part => part && String(part).trim())
                            .join('\n\n');

                        await persistBoardReviewRoundSnapshot(
                            aggClient,
                            applicationId,
                            String(reconsider.id),
                            newAmount,
                            consolidatedComments || null,
                            aggRes.rows,
                        );

                        await aggClient.query(
                            `UPDATE applications
                             SET approved_amount = $1, board_review_comments = $2, updated_at = NOW()
                             WHERE id = $3::bigint`,
                            [newAmount, consolidatedComments || null, applicationId]
                        );
                        await aggClient.query(
                            `UPDATE board_reconsideration_requests
                             SET final_board_review_comments = $1,
                                 final_approved_amount = $2
                             WHERE id = $3`,
                            [consolidatedComments || null, newAmount, reconsider.id]
                        );
                    } else {
                        await persistBoardReviewRoundSnapshot(
                            aggClient,
                            applicationId,
                            null,
                            newAmount,
                            consolidatedComments || null,
                            aggRes.rows,
                        );
                        await aggClient.query(
                            `UPDATE applications
                             SET approved_amount = $1, board_review_comments = $2, updated_at = NOW()
                             WHERE id = $3::bigint`,
                            [newAmount, consolidatedComments || null, applicationId]
                        );
                    }
                } finally {
                    aggClient.release();
                }
            } catch (e) {
                console.error('[advanceWorkflowStage] aggregate member opinions failed:', e);
            }

            // refine-disbursement-flow（2026-04）：移除 case_payment_receipt_to_applicant 自動觸發。
            // 改由個管師於每筆 payment_disbursements 手動觸發 sendDisbursementPaymentReceiptEmail。
        }

        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('advanceWorkflowStage error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export interface QualificationData {
    age?: number | null;
    moveable_property?: number | null;
    immoveable_property?: number | null;
    annual_income?: number | null;
    /** 婚姻狀態（115 年辦法）：'1'=已婚、'2'=單親、'3'=單身 */
    marital_status?: '1' | '2' | '3' | null;
    has_children?: boolean | null;
    underage_children_count?: number | null;
    adult_children_count?: number | null;
    apply_amount?: number | null;
    /** 補助子類型（115 年辦法）：'1'=經濟弱勢、'2'=小康家庭 */
    subsidy_subtype?: '1' | '2' | null;
    /** 經濟弱勢專屬：存款（配偶取平均，萬元） */
    econ_deposit?: number | null;
    /** 經濟弱勢專屬：每月收入（配偶取平均，萬元） */
    econ_monthly_income?: number | null;
}

/**
 * Save qualification pre-screening data into applications table.
 * Called when advancing FROM the 申請收件 (application) stage.
 */
export async function saveQualificationData(
    applicationId: string,
    data: QualificationData
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID（mock 資料不支援資料庫操作）' };
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE applications
             SET age                    = $1,
                 moveable_property      = $2,
                 immoveable_property    = $3,
                 annual_income          = $4,
                 marital_status         = $5,
                 has_children           = $6,
                 underage_children_count = $7,
                 adult_children_count   = $8,
                 apply_amount           = $9,
                 subsidy_subtype        = COALESCE($10, subsidy_subtype),
                 econ_deposit           = $11,
                 econ_monthly_income    = $12,
                 updated_at             = NOW()
             WHERE id = $13`,
            [
                data.age ?? null,
                data.moveable_property ?? null,
                data.immoveable_property ?? null,
                data.annual_income ?? null,
                data.marital_status ?? null,
                data.has_children ?? null,
                data.underage_children_count ?? null,
                data.adult_children_count ?? null,
                data.apply_amount ?? null,
                data.subsidy_subtype ?? null,
                data.econ_deposit ?? null,
                data.econ_monthly_income ?? null,
                applicationId,
            ]
        );
        return { success: true };
    } catch (err: any) {
        console.error('saveQualificationData error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Retreat stage backward.
 * - If retreating to 'application' or 'admin_review': keep status '1' (審核中)
 * - Otherwise: set status '2' (審核未通過) to indicate rejection
 * - is_approved → false
 */
export async function retreatWorkflowStage(
    applicationId: string,
    toStage: string,
    reviewerUserId: string | null,
    comments?: string
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID（mock 資料不支援資料庫操作）' };
    // When retreating to early stages, keep '1' (審核中). 
    // For deeper stages being rejected, use '2' (審核未通過).
    // Retreating always puts the case back to '1' (審核中)
    // Status '2' is reserved for board rejection (結案), never set via retreat
    const toStatus = '1';
    const dbStage    = FRONTEND_TO_DB_STAGE[toStage]  ?? toStage;
    const stageLabel = STAGE_LABEL[toStage]            ?? toStage;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const curStageRes = await client.query<{ stage: string | null }>(
            `SELECT stage FROM application_workflow
             WHERE application_id = $1::bigint
             ORDER BY id DESC LIMIT 1`,
            [applicationId]
        );
        const currentDbStage = curStageRes.rows[0]?.stage ?? null;
        if (currentDbStage === 'board_review' && dbStage === 'home_visit') {
            const roleRes = await client.query<{ code: string }>(
                `SELECT r.code FROM user_roles ur
                 JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = $1::bigint`,
                [reviewerUserId]
            );
            const allowedRoles = new Set(['board_member', 'executive', 'supervisor', 'chairman']);
            if (!roleRes.rows.some(r => allowedRoles.has(r.code))) {
                await client.query('ROLLBACK');
                return { success: false, error: '僅董事、執行長、主管或董事長可將董事審核退回家庭訪視' };
            }
        }

        await client.query(
            `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2`,
            [toStatus, applicationId]
        );

        // 退回不再自動寫 "退回至XXX" 進 comments 欄位（會被 UI 誤回填到審核意見 textarea）；
        // 改成只有 caller 明確帶 comments 時才寫入，否則設 NULL。
        // 退回的「系統 note」記在 audit_logs，比放這裡更合適。
        //
        // Append-only：退回也插入一列新紀錄（is_approved=false 代表退回事件）。
        await client.query(`
            INSERT INTO application_workflow
                (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
            VALUES ($1, $2, $3, false, $4, NOW())
        `, [applicationId, dbStage, reviewerUserId, comments ?? null]);

        // 退回至 board_review 之前的階段時，清除既有的董事組派案 + 簽章 + 永久審核意見。
        // 否則再推進回 board_review 時 maybeAutoAssign 會走 reassign 路徑而非首次派組，
        // 通知事件 B 的觸發語意也會混亂；並且舊的審核意見會殘留在永久欄位中誤導列印。
        if (dbStage === 'admin_review' || dbStage === 'home_visit') {
            const delAssign = await client.query(
                `DELETE FROM board_review_assignments
                 WHERE application_id = $1::bigint
                 RETURNING group_id::text AS gid`,
                [applicationId]
            );
            if ((delAssign.rowCount ?? 0) > 0) {
                const { clearStaleSignatures } = await import('./boardSignatureActions');
                await clearStaleSignatures(client, applicationId, 'reassigned');
                void writeAuditLog({
                    userId: reviewerUserId,
                    action: 'board_review.reassign',
                    targetType: 'board_assignment',
                    targetId: applicationId,
                    detail: { cleared_on_retreat: true, previous_group_id: delAssign.rows[0]?.gid ?? null, to_stage: dbStage },
                });
            }
            // 同步清空永久審核意見欄位（與派組/簽章一致：重新進 board_review = 全新一張白紙）
            //
            // 同時 reset 主管雙閘門 supervisor_approved_for_board ← NULL；
            // 這樣案件再次推進到「待送董事」前，主管必須重新確認狀況（再次審核並決定通過或退件）。
            // 否則主管早先按過「通過」會殘留，但案件已被推回前一階段，狀態與真實流程脫節。
            await client.query(
                `UPDATE applications
                 SET board_review_comments = NULL,
                     supervisor_approved_for_board = NULL,
                     supervisor_review_note = NULL
                 WHERE id = $1::bigint`,
                [applicationId]
            );
        }

        await client.query('COMMIT');
        void writeAuditLog({
            userId: reviewerUserId,
            action: 'application.stage_rollback',
            targetType: 'application',
            targetId: applicationId,
            detail: { to: toStage, comments },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('retreatWorkflowStage error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── 主管審核閘門（user feedback #7 主管雙閘門 — 進董事前的審核） ──────
// 「給會計前」的審核已經在 payment_disbursements.review_stage='1'→'2'→'3' 自然存在；
// 此處只新增「給董事前」的審核，發生在 visit/admin_review 推進到 board_review 之前。

/** 個管按下「送主管審核」— 將 supervisor_approved_for_board 設為 NULL（待審）
 *
 *  閘門設計：避免主管收到還沒準備好的案件，但允許「可延後補件」的文件延後處理：
 *    1) apply phase 必備文件 status='1'（符合）— **但只擋 allow_supplement=false（不可延後補件）的文件**
 *       allow_supplement=true 的文件可等主管審核期間 / 進入董事審核前再補（送董事前的 advance 閘門才擋全部）
 *    2) 若 stage = home_visit：家訪表已存（visit_date 或 visit_skipped）+ 個管案件說明已填
 */
export async function requestSupervisorReviewForBoard(
    applicationId: string,
    operatorUserId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        // 任何進行中且當前 stage 為 visit/admin_review 的案件都可送
        const r = await client.query(
            `SELECT a.status, a.officer_case_summary, w.stage,
                    EXISTS (SELECT 1 FROM home_visit hv
                            WHERE hv.application_id = a.id
                              AND (hv.visit_date IS NOT NULL OR hv.visit_skipped = true)) AS home_visit_saved
             FROM applications a
             LEFT JOIN LATERAL (
                 SELECT stage FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY id DESC LIMIT 1
             ) w ON TRUE
             WHERE a.id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (r.rowCount === 0) return { success: false, error: '案件不存在' };
        const { status, stage, officer_case_summary, home_visit_saved } = r.rows[0];
        if (status !== '1') return { success: false, error: '案件已結案，無法送主管' };
        if (stage !== 'admin_review' && stage !== 'home_visit' && stage !== 'visit') {
            return { success: false, error: `當前階段「${stage}」不需主管審核` };
        }

        // 閘門 1：apply phase 必備文件 status='1' — 只擋 allow_supplement=false（不可延後補件）
        const docGate = await client.query(
            `SELECT dtc.label
             FROM document_type_config dtc
             WHERE dtc.phase = 'apply'
               AND dtc.is_required = true
               AND dtc.allow_supplement = false
               AND COALESCE(dtc.is_active, true) = true
               AND (
                   dtc.subsidy_subtype IS NULL
                   OR dtc.subsidy_subtype = (
                       SELECT a.subsidy_subtype
                       FROM applications a
                       WHERE a.id = $1::bigint
                   )
               )
               AND NOT EXISTS (
                   SELECT 1 FROM application_documents ad
                   WHERE ad.application_id = $1::bigint
                     AND ad.id = dtc.id
                     AND ad.status = '1'
               )
             ORDER BY dtc.sort_order, dtc.id`,
            [applicationId]
        );
        if ((docGate.rowCount ?? 0) > 0) {
            const missing = docGate.rows.map(x => x.label).join('、');
            return {
                success: false,
                error: `送主管審核前尚有必備文件未上傳或未核過：${missing}`,
            };
        }

        // 閘門 2：家訪階段需家訪表 + 個管案件說明
        if (stage === 'home_visit' || stage === 'visit') {
            if (!home_visit_saved) {
                return { success: false, error: '送主管審核前須先完成家訪表（或標記免家訪）' };
            }
            if (!officer_case_summary || !String(officer_case_summary).trim()) {
                return { success: false, error: '送主管審核前須先填寫個管師案件說明' };
            }
        }

        await client.query(
            `UPDATE applications
             SET supervisor_approved_for_board = NULL,
                 supervisor_review_note = NULL,
                 updated_at = NOW()
             WHERE id = $1::bigint`,
            [applicationId]
        );
        void writeAuditLog({
            userId: operatorUserId,
            action: 'application.request_supervisor_review_board',
            targetType: 'application',
            targetId: applicationId,
            detail: { from_stage: stage },
        });
        return { success: true };
    } finally {
        client.release();
    }
}

/** 主管 approve/reject — approved=true 直接 advance 至 board_review；false 退件留註記 */
export async function supervisorReviewForBoard(
    applicationId: string,
    approved: boolean,
    note: string,
    operatorUserId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const trimmedNote = (note ?? '').trim();
    if (!approved && trimmedNote.length < 3) {
        return { success: false, error: '不通過原因至少 3 字' };
    }

    // 角色守門：admin / supervisor
    const roleCheck = await pool.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint AND r.code IN ('admin','supervisor') LIMIT 1`,
        [operatorUserId]
    );
    if ((roleCheck.rowCount ?? 0) === 0) {
        return { success: false, error: '僅主管或系統管理員可執行此審核' };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 先標記 approve/reject
        await client.query(
            `UPDATE applications
             SET supervisor_approved_for_board = $1,
                 supervisor_review_note = $2,
                 updated_at = NOW()
             WHERE id = $3::bigint`,
            [approved, trimmedNote || null, applicationId]
        );

        // approved → 自動 advance 到 board_review
        if (approved) {
            // 直接呼叫 advanceWorkflowStage 邏輯（已經會檢查文件閘門等）
            // 但這裡 fromStage 要動態取得
            const sRes = await client.query(
                `SELECT w.stage FROM application_workflow w
                 WHERE w.application_id = $1::bigint
                 ORDER BY w.id DESC LIMIT 1`,
                [applicationId]
            );
            const curStage = sRes.rows[0]?.stage ?? 'visit';
            // map db_stage → frontend stage
            const frontStage = curStage === 'admin_review' ? 'admin_review'
                             : (curStage === 'home_visit' || curStage === 'visit') ? 'visit'
                             : curStage;
            await client.query('COMMIT');
            // 出 transaction 後呼叫 advanceWorkflowStage（它自己有 transaction）
            const advRes = await advanceWorkflowStage(
                applicationId, frontStage, 'board_review', operatorUserId,
                trimmedNote ? `主管審核通過：${trimmedNote}` : '主管審核通過'
            );
            if (!advRes.success) return advRes;
        } else {
            await client.query('COMMIT');
        }

        void writeAuditLog({
            userId: operatorUserId,
            action: approved ? 'application.supervisor_approve_board' : 'application.supervisor_reject_board',
            targetType: 'application',
            targetId: applicationId,
            detail: { approved, note: trimmedNote },
        });
        return { success: true };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('supervisorReviewForBoard error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function requestBoardReconsideration(
    applicationId: string,
    operatorUserId: string,
    reason: string,
    attachmentUrls?: string[] | string | null,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    if (!operatorUserId || !/^\d+$/.test(operatorUserId)) return { success: false, error: '缺少操作者身分' };
    const trimmedReason = (reason ?? '').trim();
    if (trimmedReason.length < 3) return { success: false, error: '退回原因至少 3 字' };
    const cleanAttachments = (Array.isArray(attachmentUrls) ? attachmentUrls : [attachmentUrls])
        .map(url => (url ?? '').trim())
        .filter((url): url is string => url.length > 0);
    const cleanAttachment = cleanAttachments[0] ?? null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const appRes = await client.query(
            `SELECT a.officer_id::text AS officer_id, a.status, w.stage,
                    EXISTS (
                        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                        WHERE ur.user_id = $2::bigint AND r.code = 'admin'
                    ) AS is_admin
             FROM applications a
             LEFT JOIN LATERAL (
                 SELECT stage FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY id DESC LIMIT 1
             ) w ON TRUE
             WHERE a.id = $1::bigint
             LIMIT 1`,
            [applicationId, operatorUserId]
        );
        if ((appRes.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件不存在' };
        }
        const app = appRes.rows[0];
        if (app.status !== '3') {
            await client.query('ROLLBACK');
            return { success: false, error: '案件已結案，無法退回董事審核' };
        }
        if (app.stage !== 'reimbursement') {
            await client.query('ROLLBACK');
            return { success: false, error: '僅核銷撥款階段可申請退回董事再次審核' };
        }
        if (String(app.officer_id ?? '') !== String(operatorUserId) && app.is_admin !== true) {
            await client.query('ROLLBACK');
            return { success: false, error: '僅本案承辦人或系統管理員可送出退回董事再審申請' };
        }

        const pendingRes = await client.query(
            `SELECT 1
             FROM board_reconsideration_requests
             WHERE application_id = $1::bigint
               AND status = 'pending_supervisor'
             LIMIT 1`,
            [applicationId]
        );
        if ((pendingRes.rowCount ?? 0) > 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '已有待主管審核的退回董事再審申請' };
        }

        await client.query(
            `INSERT INTO board_reconsideration_requests
                (application_id, reason, attachment_url, attachment_urls, requested_by)
             VALUES ($1::bigint, $2, $3, $4::jsonb, $5::bigint)`,
            [applicationId, trimmedReason, cleanAttachment, JSON.stringify(cleanAttachments), operatorUserId]
        );
        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId,
            action: 'application.board_reconsideration_request',
            targetType: 'application',
            targetId: applicationId,
            detail: { reason: trimmedReason, attachmentUrls: cleanAttachments },
        });
        return { success: true };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('requestBoardReconsideration error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function reviewBoardReconsideration(
    applicationId: string,
    requestId: string,
    operatorUserId: string,
    approved: boolean,
    note?: string,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId) || !isValidDbId(requestId)) return { success: false, error: '無效的申請 ID' };
    if (!operatorUserId || !/^\d+$/.test(operatorUserId)) return { success: false, error: '缺少操作者身分' };
    const trimmedNote = (note ?? '').trim();
    if (!approved && trimmedNote.length < 3) {
        return { success: false, error: '退回原因至少 3 字' };
    }

    const roleCheck = await pool.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint AND r.code IN ('admin','supervisor') LIMIT 1`,
        [operatorUserId]
    );
    if ((roleCheck.rowCount ?? 0) === 0) {
        return { success: false, error: '僅主管或系統管理員可審核退回董事再審申請' };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const reqRes = await client.query(
            `SELECT id, reason, attachment_url, attachment_urls
             FROM board_reconsideration_requests
             WHERE id = $1::bigint
               AND application_id = $2::bigint
             FOR UPDATE`,
            [requestId, applicationId]
        );
        if ((reqRes.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '找不到退回董事再審申請' };
        }
        const req = reqRes.rows[0];
        const reqAttachmentUrls = normalizeAttachmentUrls(req.attachment_url, req.attachment_urls);

        const appRes = await client.query(
            `SELECT a.status, w.stage
             FROM applications a
             LEFT JOIN LATERAL (
                 SELECT stage FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY id DESC LIMIT 1
             ) w ON TRUE
             WHERE a.id = $1::bigint
             LIMIT 1`,
            [applicationId]
        );
        if ((appRes.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件不存在' };
        }
        if (appRes.rows[0].status !== '3') {
            await client.query('ROLLBACK');
            return { success: false, error: '案件已結案，無法退回董事審核' };
        }
        if (appRes.rows[0].stage !== 'reimbursement') {
            await client.query('ROLLBACK');
            return { success: false, error: '案件目前不在核銷撥款階段，無法審核此申請' };
        }

        if (!approved) {
            await client.query(
                `UPDATE board_reconsideration_requests
                 SET status = 'rejected',
                     supervisor_id = $1::bigint,
                     supervisor_note = $2,
                     supervisor_reviewed_at = NOW()
                 WHERE id = $3::bigint`,
                [operatorUserId, trimmedNote, requestId]
            );
            await client.query('COMMIT');
            void writeAuditLog({
                userId: operatorUserId,
                action: 'application.board_reconsideration_reject',
                targetType: 'application',
                targetId: applicationId,
                detail: { requestId, note: trimmedNote },
            });
            return { success: true };
        }

        await client.query(
            `UPDATE board_reconsideration_requests
             SET status = 'approved',
                 supervisor_id = $1::bigint,
                 supervisor_note = $2,
                 supervisor_reviewed_at = NOW()
             WHERE id = $3::bigint`,
            [operatorUserId, trimmedNote || null, requestId]
        );
        await client.query(
            `UPDATE applications
             SET status = '1',
                 updated_at = NOW()
             WHERE id = $1::bigint`,
            [applicationId]
        );
        await client.query(
            `INSERT INTO application_workflow
                (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
             VALUES ($1::bigint, 'board_review', $2::bigint, true, $3, NOW())`,
            [
                applicationId,
                operatorUserId,
                [
                    '主管核准退回董事再次審核',
                    `退回原因：${req.reason ?? ''}`,
                    trimmedNote ? `主管備註：${trimmedNote}` : null,
                    reqAttachmentUrls.length > 0 ? `附件：${reqAttachmentUrls.join('、')}` : null,
                ].filter(Boolean).join('\n'),
            ]
        );
        await snapshotCurrentBoardReviewIfMissing(client, applicationId);
        await client.query(
            `DELETE FROM board_review_assignments WHERE application_id = $1::bigint`,
            [applicationId]
        );
        const { clearStaleSignatures } = await import('./boardSignatureActions');
        await clearStaleSignatures(client, applicationId, 'reassigned');
        await client.query('COMMIT');

        const { maybeAutoAssignOnBoardReviewEntry } = await import('./boardGroupActions');
        void maybeAutoAssignOnBoardReviewEntry(applicationId);
        const autoAssign = await fetchSetting('board_auto_assign', 'false');
        if (autoAssign !== 'true') {
            const { notifyEvent } = await import('./notificationDispatcher');
            void notifyEvent('case_entered_board_review', { applicationId })
                .catch(err => console.error('[notify] case_entered_board_review failed:', err));
        }
        void writeAuditLog({
            userId: operatorUserId,
            action: 'application.board_reconsideration_approve',
            targetType: 'application',
            targetId: applicationId,
            detail: { requestId, note: trimmedNote },
        });
        return { success: true };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('reviewBoardReconsideration error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * 取消「不通過結案」(`status='2'`) → 將案件還原為審核中 (`status='1'`)，
 * 並依當前 workflow stage 保留所在階段（通常是 board_review）。
 *
 * 用途：使用者誤按結案 / 主管/admin 事後想復原。
 * 限制：僅 admin / supervisor / chairman 可操作；status 必須為 '2'。
 *      不還原 application_close_reasons（caller 若需要可另外刪除）。
 */
export async function reopenRejectedCase(
    applicationId: string,
    operatorUserId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const roleCheck = await pool.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint AND r.code IN ('admin','supervisor','chairman') LIMIT 1`,
        [operatorUserId]
    );
    if ((roleCheck.rowCount ?? 0) === 0) {
        return { success: false, error: '僅主管、董事長或系統管理員可復原結案' };
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cur = await client.query(
            `SELECT status FROM applications WHERE id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (cur.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件不存在' };
        }
        if (cur.rows[0].status !== '2') {
            await client.query('ROLLBACK');
            return { success: false, error: '此案件不是「審核未通過結案」狀態，無法復原' };
        }
        // 還原 status；保留 workflow.stage 不動（通常停在 board_review）
        await client.query(
            `UPDATE applications SET status = '1', updated_at = NOW() WHERE id = $1::bigint`,
            [applicationId]
        );
        // 清掉之前結案時寫入的結構化原因（若有），讓後續可重新處理
        await client.query(
            `DELETE FROM application_close_reasons WHERE application_id = $1::bigint`,
            [applicationId]
        );
        // Append-only：以「最新一列」為基底，INSERT 一列「復原結案」事件
        // （stage 保持原階段、is_approved=NULL 代表「待重新決定」）
        await client.query(
            `INSERT INTO application_workflow
                (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
             SELECT application_id, stage, $1::bigint, NULL, '復原結案，重新審核', NOW()
             FROM application_workflow
             WHERE application_id = $2::bigint
             ORDER BY id DESC
             LIMIT 1`,
            [operatorUserId, applicationId]
        );
        await client.query('COMMIT');
        void writeAuditLog({
            userId: operatorUserId,
            action: 'application.reopen',
            targetType: 'application',
            targetId: applicationId,
            detail: { from_status: '2', to_status: '1' },
        });
        return { success: true };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('reopenRejectedCase error', err);
        return { success: false, error: err.message ?? '復原失敗' };
    } finally {
        client.release();
    }
}

/**
 * Close case as rejected after board review failure.
 * Sets applications.status = '2' (審核未通過/結案),
 * writes approved_amount = 0 and comments into workflow.
 */
export async function closeCaseRejected(
    applicationId: string,
    comments: string,
    reviewerUserId: string | null,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 若案件目前在 board_review 階段才呼叫此結案，須驗全員簽章
        const stageRes = await client.query(
            `SELECT stage FROM application_workflow
             WHERE application_id = $1
             ORDER BY id DESC LIMIT 1`,
            [applicationId]
        );
        const curStage = stageRes.rows[0]?.stage;
        if (curStage === 'board_review') {
            const gate = await checkBoardSignatureGate(client, applicationId);
            if (!gate.ok) {
                await client.query('ROLLBACK');
                return { success: false, error: gate.error };
            }
        }

        await client.query(
            `UPDATE applications
             SET status = '2',
                 approved_amount = 0,
                 board_review_comments = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [applicationId, comments]
        );
        // Append-only：結案以董事審核 stage 寫入一列 is_approved=false 紀錄
        await client.query(`
            INSERT INTO application_workflow
                (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
            VALUES ($1, 'board_review', $2, false, $3, NOW())
        `, [applicationId, reviewerUserId, comments]);
        await client.query('COMMIT');
        void writeAuditLog({
            userId: reviewerUserId,
            action: 'application.close',
            targetType: 'application',
            targetId: applicationId,
            detail: { result: 'rejected', comments },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('closeCaseRejected error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * 通用結構化結案（任何 stage 皆可用）。
 *
 * - 將 status 設為 '2'（審核未通過）；workflow.comments 寫入彙整原因文字
 * - 在 application_close_reasons 寫入結構化 reason rows（多筆）
 * - reasonRows 至少要有 1 筆
 *
 * 取代舊的 closeCaseByPendingDocThreshold，特殊場景由 caller 預先帶入對應 code：
 *   - 補件超時：code = '98'（detail 帶結案說明 + reminderCount/lastReminderAt 寫進 audit detail）
 *   - 申請人取消：code = '99'
 *   - 行政初審不符資格：code 01–10（可由資格判定結果預帶）
 */
export interface CloseReasonRow {
    code: string;          // '01'–'10' / '98' / '99'
    detail?: string | null; // 金額/年齡/說明
}
export async function closeCaseWithReasons(
    applicationId: string,
    reasonRows: CloseReasonRow[],
    operatorUserId: string,
    /** 結案發生於哪個 workflow stage（admin_review/visit/board_review/reimbursement）；空字串時用當下 stage */
    stage?: string,
    /** 自由補充說明（會併入 workflow.comments） */
    extraNote?: string,
    /** 補件超時專用：寫進 audit log 的 metadata */
    auditExtra?: { reminderCount?: number; lastReminderAt?: string | null },
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const validRows = (reasonRows ?? []).filter(r => r.code && /^[0-9]{2}$/.test(r.code));
    if (validRows.length === 0) {
        return { success: false, error: '請至少勾選一項結案原因' };
    }

    // 組 workflow.comments：彙整 reason labels + extraNote
    const { CLOSE_REASON_LABEL } = await import('../../lib/closeReasonConstants');
    const labelLines = validRows.map(r => {
        const label = CLOSE_REASON_LABEL[r.code] ?? r.code;
        return r.detail ? `${label}：${r.detail}` : label;
    });
    const comments = [labelLines.join('；'), extraNote?.trim()].filter(Boolean).join('\n');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 取當下 stage（若 caller 沒傳）；append-only 後須取「最新一列」
        let actualStage = stage ?? null;
        if (!actualStage) {
            const sRes = await client.query(
                `SELECT stage FROM application_workflow
                 WHERE application_id = $1
                 ORDER BY id DESC LIMIT 1`,
                [applicationId]
            );
            actualStage = sRes.rows[0]?.stage ?? 'admin_review';
        }

        // board_review 階段結案仍須驗簽章閘
        if (actualStage === 'board_review') {
            const gate = await checkBoardSignatureGate(client, applicationId);
            if (!gate.ok) {
                await client.query('ROLLBACK');
                return { success: false, error: gate.error };
            }
        }

        // status → '2'，approved_amount → 0
        await client.query(
            `UPDATE applications SET status = '2', approved_amount = 0, updated_at = NOW() WHERE id = $1`,
            [applicationId]
        );

        // Append-only：每次結案 INSERT 新紀錄
        await client.query(`
            INSERT INTO application_workflow
                (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
            VALUES ($1, $2, $3, false, $4, NOW())
        `, [applicationId, actualStage, operatorUserId, comments]);

        // 結構化原因：先清空再寫入（允許重新結案時覆蓋）
        await client.query(
            `DELETE FROM application_close_reasons WHERE application_id = $1`,
            [applicationId]
        );
        for (const r of validRows) {
            await client.query(
                `INSERT INTO application_close_reasons
                    (application_id, reason_code, detail_value, closed_at_stage)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (application_id, reason_code) DO UPDATE
                    SET detail_value = EXCLUDED.detail_value,
                        closed_at_stage = EXCLUDED.closed_at_stage`,
                [applicationId, r.code, r.detail ?? null, actualStage]
            );
        }

        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId,
            action: 'application.close',
            targetType: 'application',
            targetId: applicationId,
            detail: {
                result: 'rejected',
                stage: actualStage,
                reason_codes: validRows.map(r => r.code),
                reason_details: validRows.map(r => ({ code: r.code, detail: r.detail ?? null })),
                comments,
                ...(auditExtra ?? {}),
            },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('closeCaseWithReasons error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/** @deprecated 請改用 closeCaseWithReasons；保留 wrapper 維持 backward compat（內部仍呼叫 closeCaseWithReasons + code='98'） */
export async function closeCaseByPendingDocThreshold(
    applicationId: string,
    reason: string,
    officerUserId: string | null,
    reminderCount: number,
    lastReminderAt: string | null,
): Promise<{ success: boolean; error?: string }> {
    const trimmed = (reason ?? '').trim();
    if (trimmed.length < 5) {
        return { success: false, error: '結案原因至少需 5 字' };
    }
    return closeCaseWithReasons(
        applicationId,
        [{ code: '98', detail: trimmed }],
        officerUserId ?? '',
        undefined,
        undefined,
        { reminderCount, lastReminderAt },
    );
}

/** 讀取案件的結構化結案原因（給編輯/檢視/報表用） */
export async function fetchCloseReasons(
    applicationId: string,
): Promise<{ success: true; data: CloseReasonRow[] } | { success: false; error: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT reason_code, detail_value FROM application_close_reasons
             WHERE application_id = $1
             ORDER BY reason_code`,
            [applicationId]
        );
        return {
            success: true,
            data: res.rows.map(r => ({ code: r.reason_code, detail: r.detail_value })),
        };
    } finally {
        client.release();
    }
}

/**
 * #24: 行政初審階段允許 case_officer/admin/supervisor 調整 apply_amount。
 * 限制：案件 status='1' 且當前 workflow stage='admin_review'，新金額 >= 0 且 <= 子類型上限。
 */
export async function updateApplyAmount(
    applicationId: string,
    newAmount: number,
    operatorUserId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    if (!Number.isFinite(newAmount) || newAmount < 0) {
        return { success: false, error: '金額必須為非負數' };
    }
    const roleCheck = await pool.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint AND r.code IN ('admin','supervisor','case_officer') LIMIT 1`,
        [operatorUserId]
    );
    if ((roleCheck.rowCount ?? 0) === 0) {
        return { success: false, error: '權限不足' };
    }
    const client = await pool.connect();
    try {
        const cur = await client.query(
            `SELECT a.status, a.subsidy_subtype, a.officer_id, a.apply_amount, w.stage
             FROM applications a
             LEFT JOIN LATERAL (
                 SELECT stage FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY id DESC LIMIT 1
             ) w ON TRUE
             WHERE a.id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (cur.rowCount === 0) return { success: false, error: '案件不存在' };
        const { status, stage, subsidy_subtype, apply_amount, officer_id } = cur.rows[0];
        if (status !== '1') return { success: false, error: '案件已結案，無法調整' };
        if (stage !== 'admin_review') return { success: false, error: '僅在行政初審階段可調整' };
        // case_officer 必須為被指派的承辦人
        const isAdminOrSup = (await pool.query(
            `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint AND r.code IN ('admin','supervisor') LIMIT 1`,
            [operatorUserId]
        )).rowCount ?? 0;
        if (!isAdminOrSup && String(officer_id) !== String(operatorUserId)) {
            return { success: false, error: '僅指派之承辦人或主管/系統管理員可調整' };
        }
        // 子類型上限檢查
        if (subsidy_subtype) {
            const { fetchSubsidyAmountLimitsMap } = await import('./eligibilityRulesActions');
            const limits = await fetchSubsidyAmountLimitsMap();
            const max = limits[subsidy_subtype as '1' | '2'] ?? 0;
            if (newAmount > max) {
                return { success: false, error: `超過子類型上限 NT$${max.toLocaleString()}` };
            }
        }
        await client.query(
            `UPDATE applications SET apply_amount = $1, updated_at = NOW() WHERE id = $2::bigint`,
            [newAmount, applicationId]
        );
        void writeAuditLog({
            userId: operatorUserId,
            action: 'application.update_amount',
            targetType: 'application',
            targetId: applicationId,
            detail: { old_amount: apply_amount, new_amount: newAmount, stage },
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message ?? '更新失敗' };
    } finally {
        client.release();
    }
}

/**
 * Save board review result: approved_amount + workflow comments.
 * approved_amount = 0 when not approved.
 */
export async function saveBoardReviewData(
    applicationId: string,
    approvedAmount: number,
    comments: string,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE applications SET approved_amount = $1, updated_at = NOW() WHERE id = $2`,
            [approvedAmount, applicationId]
        );
        // 草稿存檔不 INSERT 新列，只 UPDATE 最新一列（append-only 模式：意見編輯期間共用同一列）
        await client.query(
            `UPDATE application_workflow
             SET comments = $1, reviewed_at = NOW()
             WHERE id = (
                 SELECT id FROM application_workflow
                 WHERE application_id = $2
                 ORDER BY id DESC LIMIT 1
             )`,
            [comments, applicationId]
        );
        await client.query('COMMIT');
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('saveBoardReviewData error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Close case after reimbursement (核銷完成).
 * Sets applications.status = '4' (核銷完成/結案).
 */
export async function closeCase(
    applicationId: string,
    reviewerUserId: string | null,
    approvedAmount?: number | null,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pendingOfficialReceiptConfirmation = await client.query<{ receipt_number: string; external_code: string | null }>(
            `SELECT receipt_number, external_code
             FROM payment_disbursements
             WHERE application_id = $1::bigint
               AND review_stage = '9'
               AND official_receipt_replaced_at IS NOT NULL
               AND official_receipt_accountant_confirmed_at IS NULL
             ORDER BY created_at ASC
             LIMIT 1`,
            [applicationId],
        );
        if ((pendingOfficialReceiptConfirmation.rowCount ?? 0) > 0) {
            await client.query('ROLLBACK');
            const row = pendingOfficialReceiptConfirmation.rows[0];
            return {
                success: false,
                error: `撥款單號${row.external_code || row.receipt_number}正式收據已更新，等待會計確認`,
            };
        }
        const missingRemittance = await client.query<{ receipt_number: string }>(
            `SELECT receipt_number
             FROM payment_disbursements
             WHERE application_id = $1::bigint
               AND review_stage = '9'
               AND NOT is_legacy_import
               AND NULLIF(TRIM(COALESCE(remittance_slip_file_path, '')), '') IS NULL
             ORDER BY created_at ASC
             LIMIT 1`,
            [applicationId],
        );
        if ((missingRemittance.rowCount ?? 0) > 0) {
            await client.query('ROLLBACK');
            return {
                success: false,
                error: `撥款單號${missingRemittance.rows[0].receipt_number}未上傳匯款單掃描檔`,
            };
        }
        await client.query(
            `UPDATE applications
             SET status = '4',
                 approved_amount = COALESCE($2, approved_amount),
                 updated_at = NOW()
             WHERE id = $1`,
            [applicationId, approvedAmount ?? null]
        );
        // 核銷完成不再寫 workflow row：
        //   - 「進入核銷」的 stage='reimbursement' 列已在 advance(board_review→reimbursement) 時 INSERT；
        //   - 「核銷完成」=狀態變更（status 3→4），非 stage 推進，audit_logs 已記錄事件。
        // 若這裡也 INSERT，會與「進入核銷」列同 stage / is_approved，導致報表分不出「董事通過時間 vs 核銷完成時間」。
        await client.query('COMMIT');
        void writeAuditLog({
            userId: reviewerUserId,
            action: 'application.close',
            targetType: 'application',
            targetId: applicationId,
            detail: { result: 'completed' },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('closeCase error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Close an active case early from any workflow stage.
 * Completed payments remain unchanged; an in-flight payment must be completed or returned first.
 */
export async function closeCaseEarly(
    applicationId: string,
    reason: string,
    operatorUserId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) return { success: false, error: '無效的案件 ID' };
    if (!isValidDbId(operatorUserId)) return { success: false, error: '無效的操作人員 ID' };
    const trimmedReason = reason.trim();
    if (!trimmedReason) return { success: false, error: '請填寫中途結案原因' };
    if (trimmedReason.length > 2_000) return { success: false, error: '中途結案原因不可超過 2,000 字' };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const appRes = await client.query<{ status: string; officer_id: string | null; stage: string | null; approved_amount: string | null }>(
            `SELECT a.status, a.officer_id::text, a.approved_amount,
                    (SELECT stage FROM application_workflow WHERE application_id = a.id ORDER BY id DESC LIMIT 1) AS stage
             FROM applications a
             WHERE a.id = $1::bigint
             FOR UPDATE`,
            [applicationId],
        );
        if ((appRes.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件不存在' };
        }
        const app = appRes.rows[0];
        if (app.status !== '1' && app.status !== '3') {
            await client.query('ROLLBACK');
            return { success: false, error: '案件已結案，無法再次中途結案' };
        }

        const rolesRes = await client.query<{ code: string }>(
            `SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1::bigint`,
            [operatorUserId],
        );
        const roles = new Set(rolesRes.rows.map(row => row.code));
        const isAdminOrSupervisor = roles.has('admin') || roles.has('supervisor');
        const isAssignedOfficer = roles.has('case_officer') && String(app.officer_id ?? '') === operatorUserId;
        if (!isAdminOrSupervisor && !isAssignedOfficer) {
            await client.query('ROLLBACK');
            return { success: false, error: '僅案件承辦人、主管或系統管理員可中途結案' };
        }

        const inFlight = await client.query<{ receipt_number: string }>(
            `SELECT receipt_number FROM payment_disbursements
             WHERE application_id = $1::bigint AND review_stage IN ('1', '2', '3', '4')
             ORDER BY created_at ASC LIMIT 1`,
            [applicationId],
        );
        if ((inFlight.rowCount ?? 0) > 0) {
            await client.query('ROLLBACK');
            return { success: false, error: `撥款單號${inFlight.rows[0].receipt_number}仍在審核中，請先完成或退回該筆撥款` };
        }

        const pendingOfficialReceiptConfirmation = await client.query<{ receipt_number: string; external_code: string | null }>(
            `SELECT receipt_number, external_code FROM payment_disbursements
             WHERE application_id = $1::bigint AND review_stage = '9'
               AND official_receipt_replaced_at IS NOT NULL AND official_receipt_accountant_confirmed_at IS NULL
             ORDER BY created_at ASC LIMIT 1`,
            [applicationId],
        );
        if ((pendingOfficialReceiptConfirmation.rowCount ?? 0) > 0) {
            await client.query('ROLLBACK');
            const row = pendingOfficialReceiptConfirmation.rows[0];
            return { success: false, error: `撥款單號${row.external_code || row.receipt_number}正式收據已更新，等待會計確認` };
        }
        const missingRemittance = await client.query<{ receipt_number: string }>(
            `SELECT receipt_number FROM payment_disbursements
             WHERE application_id = $1::bigint AND review_stage = '9'
               AND NOT is_legacy_import
               AND NULLIF(TRIM(COALESCE(remittance_slip_file_path, '')), '') IS NULL
             ORDER BY created_at ASC LIMIT 1`,
            [applicationId],
        );
        if ((missingRemittance.rowCount ?? 0) > 0) {
            await client.query('ROLLBACK');
            return { success: false, error: `撥款單號${missingRemittance.rows[0].receipt_number}未上傳匯款單掃描檔` };
        }

        const paidRes = await client.query<{ total_disbursed: string }>(
            `SELECT COALESCE(SUM(amount), 0) AS total_disbursed FROM payment_disbursements
             WHERE application_id = $1::bigint AND review_stage = '9'`,
            [applicationId],
        );
        const totalDisbursed = Number(paidRes.rows[0]?.total_disbursed ?? 0);
        const approvedAmount = Number(app.approved_amount ?? 0);
        await client.query(
            `UPDATE applications SET status = '4', early_close_reason = $2, updated_at = NOW() WHERE id = $1::bigint`,
            [applicationId, trimmedReason],
        );
        await client.query(
            `INSERT INTO application_workflow (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
             VALUES ($1::bigint, $2, $3::bigint, true, $4, NOW())`,
            [applicationId, app.stage ?? 'admin_review', operatorUserId, `中途結案：${trimmedReason}`],
        );
        await client.query('COMMIT');
        void writeAuditLog({
            userId: operatorUserId,
            action: 'application.close_early',
            targetType: 'application',
            targetId: applicationId,
            detail: { reason: trimmedReason, approvedAmount, totalDisbursed },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('closeCaseEarly error', err);
        return { success: false, error: err.message ?? '中途結案失敗' };
    } finally {
        client.release();
    }
}

export async function fetchWorkflowRecord(applicationId: string) {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT w.stage, w.is_approved, w.comments, w.created_at, w.reviewed_at,
                   u.name_enc, u.name_iv
            FROM application_workflow w
            LEFT JOIN users u ON u.id = w.reviewer_id
            WHERE w.application_id = $1
            ORDER BY w.id DESC
            LIMIT 1
        `, [applicationId]);

        if (res.rows.length === 0) return null;
        const row = res.rows[0];

        const { decryptAES } = await import('../../lib/crypto');
        return {
            stage: row.stage,
            isApproved: row.is_approved,
            comments: row.comments,
            createdAt: row.created_at?.toISOString(),
            reviewedAt: row.reviewed_at?.toISOString(),
            reviewerName: row.name_enc && row.name_iv
                ? decryptAES(row.name_enc, row.name_iv) || '系統'
                : '系統',
        };
    } finally {
        client.release();
    }
}

/**
 * 儲存個管師案件說明（#17）。
 * 僅案件承辦個管師可填寫；其他角色只能閱讀。只擋結案案件。
 */
export async function saveOfficerCaseSummary(
    applicationId: string,
    summary: string,
    operatorUserId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!isValidDbId(applicationId)) {
        return { success: false, error: '無效的案件 ID' };
    }
    const client = await pool.connect();
    try {
        // 角色驗證：必須具 case_officer，且必須是本案 officer。
        const roleRes = await client.query<{ code: string }>(
            `SELECT r.code FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint`,
            [operatorUserId]
        );
        const roles = roleRes.rows.map(r => r.code);
        if (!roles.includes('case_officer')) {
            return { success: false, error: '僅個管師可填寫案件說明' };
        }
        // 結案不可改
        const statRes = await client.query<{ status: string; officer_id: string | null }>(
            `SELECT status, officer_id::text FROM applications WHERE id = $1::bigint`,
            [applicationId]
        );
        if (statRes.rowCount === 0) return { success: false, error: '案件不存在' };
        if (String(statRes.rows[0].officer_id ?? '') !== String(operatorUserId)) {
            return { success: false, error: '僅本案承辦個管師可填寫案件說明' };
        }
        if (statRes.rows[0].status === '2' || statRes.rows[0].status === '4') {
            return { success: false, error: '案件已結案，不可修改案件說明' };
        }
        const trimmed = summary.trim();
        if (!trimmed) {
            return { success: false, error: '案件說明不可為空' };
        }
        await client.query(
            `UPDATE applications
             SET officer_case_summary = $2,
                 updated_at = NOW()
             WHERE id = $1::bigint`,
            [applicationId, trimmed]
        );
        await writeAuditLog({
            userId: operatorUserId,
            action: 'application.update',
            targetType: 'application',
            targetId: applicationId,
            detail: { field: 'officer_case_summary', length: trimmed.length },
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : '儲存失敗' };
    } finally {
        client.release();
    }
}
