'use server';

import { pool } from '../../lib/db';
import {
    DB_STAGE_TO_FRONTEND,
    FRONTEND_TO_DB_STAGE,
    ADVANCE_STAGE_TO_STATUS,
    STAGE_LABEL,
    STATUS_LABEL,
} from '../../lib/stageMaps';
import { writeAuditLog } from './auditActions';
import { fetchSetting } from './settingsActions';

export interface ApplicationDetail {
    id: string;
    caseNumber: string;
    status: string;
    statusLabel: string;
    stage: string;
    applicantName: string;
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
    // Workflow fields
    wfIsApproved?: boolean | null;
    wfComments?: string | null;
    // Application type (A/B/C/D), set at creation, read-only
    applicationType?: string | null;
    // Cumulative approved amount across all completed applications for this applicant
    totalApprovedAmount?: number;
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
    // 家庭訪視階段：家訪表是否已存（home_visit 列存在且 visit_date 有值）
    homeVisitSaved?: boolean;
}

// Guard: mock store IDs look like 'app-001-a', real DB IDs are numeric UUIDs or bigints.
// The applications table uses BIGSERIAL (bigint PK), so valid IDs are all-digit strings.
function isValidDbId(id: string): boolean {
    return /^\d+$/.test(id);
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
    }
    if (unsignedCount > 0 || invalidCount > 0) {
        const parts: string[] = [];
        if (unsignedCount > 0) parts.push(`${unsignedCount} 位未簽署`);
        if (invalidCount > 0)  parts.push(`${invalidCount} 位簽章因內容變動已失效`);
        return { ok: false, error: `尚有 ${parts.join('、')}，請該組員重新簽章` };
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
                a.application_form, a.treatment_phase,
                (SELECT COALESCE(SUM(a2.approved_amount), 0) FROM applications a2
                 WHERE a2.applicant_id = a.applicant_id AND a2.status = '4') AS total_approved_amount,
                a.age, a.moveable_property, a.immoveable_property,
                a.annual_income, a.marital_status, a.has_children, a.underage_children_count, a.adult_children_count,
                a.apply_amount, a.approved_amount,
                a.application_way, a.referral_unit_id,
                ru.name AS referral_unit_name_legacy,
                a.referral_unit_name      AS referral_unit_name_text,
                a.referral_contact_name, a.referral_contact_title, a.referral_contact_phone,
                a.subsidy_subtype, a.econ_deposit, a.econ_monthly_income,
                a.officer_case_summary,
                a.home_visit_assignee_id,
                EXISTS (SELECT 1 FROM home_visit hv
                        WHERE hv.application_id = a.id AND hv.visit_date IS NOT NULL
                        LIMIT 1) AS home_visit_saved,
                u_hva.name_enc AS hva_name_enc, u_hva.name_iv AS hva_name_iv, u_hva.account AS hva_account,
                w.stage as wf_stage,
                w.is_approved as wf_is_approved,
                w.comments as wf_comments,
                u_app.name_enc as app_name_enc, u_app.name_iv  as app_name_iv,
                u_off.name_enc as off_name_enc, u_off.name_iv  as off_name_iv
            FROM applications a
            LEFT JOIN application_workflow w ON w.application_id = a.id
            LEFT JOIN users u_app ON u_app.id = a.applicant_id
            LEFT JOIN users u_off ON u_off.id = a.officer_id
            LEFT JOIN users u_hva ON u_hva.id = a.home_visit_assignee_id
            LEFT JOIN referral_units ru ON ru.id = a.referral_unit_id
            WHERE a.id = $1
            LIMIT 1
        `, [applicationId]);

        if (res.rows.length === 0) return null;
        const row = res.rows[0];

        const { decryptAES } = await import('../../lib/crypto');
        const applicantName = row.app_name_enc && row.app_name_iv
            ? decryptAES(row.app_name_enc, row.app_name_iv) || '未知'
            : '未知';
        const officerName = row.off_name_enc && row.off_name_iv
            ? decryptAES(row.off_name_enc, row.off_name_iv) || undefined
            : undefined;

        const dbStatus = row.status ?? '1';
        const statusLabel = STATUS_LABEL[dbStatus] ?? '審核中';

        // Use workflow.stage (DB key) to determine the exact frontend stage.
        // Falls back to 'application' if no workflow row yet.
        const dbWfStage = row.wf_stage ?? 'apply';
        const stage = DB_STAGE_TO_FRONTEND[dbWfStage] ?? 'application';

        return {
            id: row.id,
            caseNumber: row.case_number,
            status: dbStatus,
            statusLabel,
            stage,
            applicantName,
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
            officerName,
            applyAt: row.apply_at ? new Date(row.apply_at).toISOString().split('T')[0] : undefined,
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
            wfIsApproved: row.wf_is_approved ?? null,
            wfComments: row.wf_comments ?? null,
            applicationType: row.application_type ?? null,
            totalApprovedAmount: Number(row.total_approved_amount ?? 0),
            applicantId: row.applicant_id ? String(row.applicant_id) : null,
            officerId: row.officer_id ? String(row.officer_id) : null,
            applicationWay: (row.application_way === '2' ? '2' : '1') as '1' | '2',
            referralUnitId: row.referral_unit_id != null ? String(row.referral_unit_id) : null,
            // 自由填寫欄位優先；舊資料 fallback 到 referral_units join
            referralUnitName: row.referral_unit_name_text ?? row.referral_unit_name_legacy ?? null,
            referralContactName: row.referral_contact_name ?? null,
            referralContactTitle: row.referral_contact_title ?? null,
            referralContactPhone: row.referral_contact_phone ?? null,
            subsidySubtype: (row.subsidy_subtype === '1' || row.subsidy_subtype === '2')
                ? row.subsidy_subtype : null,
            econDeposit: row.econ_deposit != null ? Number(row.econ_deposit) : null,
            econMonthlyIncome: row.econ_monthly_income != null ? Number(row.econ_monthly_income) : null,
            officerCaseSummary: row.officer_case_summary ?? null,
            homeVisitSaved: !!row.home_visit_saved,
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

        // 0. 若自 board_review 推進，須驗證全員簽章完整且 hash 有效
        if (fromStage === 'board_review') {
            const gate = await checkBoardSignatureGate(client, applicationId);
            if (!gate.ok) {
                await client.query('ROLLBACK');
                return { success: false, error: gate.error };
            }
        }

        // 1. Update applications.status
        await client.query(
            `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2`,
            [toStatus, applicationId]
        );

        // 2. UPSERT the single workflow row (one per application per spec)
        const existRes = await client.query(
            `SELECT 1 FROM application_workflow WHERE application_id = $1 LIMIT 1`,
            [applicationId]
        );

        if (existRes.rows.length > 0) {
            await client.query(`
                UPDATE application_workflow
                SET stage = $1,
                    reviewer_id = $2,
                    is_approved = true,
                    comments = $3,
                    reviewed_at = NOW()
                WHERE application_id = $4
            `, [dbStage, reviewerUserId, comments ?? `推進至${stageLabel}`, applicationId]);
        } else {
            await client.query(`
                INSERT INTO application_workflow
                    (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
                VALUES ($1, $2, $3, true, $4, NOW())
            `, [applicationId, dbStage, reviewerUserId, comments ?? `建立並進入${stageLabel}`]);
        }

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
        //   1) 個別獨立簽章模式 — 計算 MAX(member_amount where approved) → 寫到 applications.approved_amount
        //      consolidate 全部 member_comments 到 applications.board_review_comments
        //   （refine-disbursement-flow：原 (2) 自動寄領款收據已移除；改由個管師於每筆撥款手動觸發）
        if (fromStage === 'board_review' && toStage === 'reimbursement') {
            try {
                const aggClient = await pool.connect();
                try {
                    const aggRes = await aggClient.query(
                        `SELECT s.signer_user_id::text AS uid,
                                s.member_approved, s.member_amount, s.member_comments,
                                u.name_enc, u.name_iv, u.account
                         FROM board_review_signatures s
                         JOIN users u ON u.id = s.signer_user_id
                         WHERE s.application_id = $1::bigint`,
                        [applicationId]
                    );
                    const { decryptAES } = await import('../../lib/crypto');
                    let maxAmount: number | null = null;
                    const opinionLines: string[] = [];
                    for (const r of aggRes.rows) {
                        const name = r.name_enc && r.name_iv
                            ? decryptAES(r.name_enc, r.name_iv) || r.account
                            : r.account;
                        if (r.member_approved === true && r.member_amount != null) {
                            const a = Number(r.member_amount);
                            if (maxAmount === null || a > maxAmount) maxAmount = a;
                        }
                        if (r.member_comments && r.member_comments.trim() !== '') {
                            const verdict = r.member_approved === true ? '通過' : r.member_approved === false ? '不通過' : '未表態';
                            const amt = r.member_amount != null ? `（${Number(r.member_amount).toLocaleString()} 元）` : '';
                            opinionLines.push(`【${name}・${verdict}${amt}】${r.member_comments}`);
                        }
                    }
                    const consolidatedComments = opinionLines.join('\n\n');
                    await aggClient.query(
                        `UPDATE applications
                         SET approved_amount = $1, board_review_comments = $2, updated_at = NOW()
                         WHERE id = $3::bigint`,
                        [maxAmount, consolidatedComments || null, applicationId]
                    );
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
    /** 經濟弱勢專屬：存款（夫妻取平均，萬元） */
    econ_deposit?: number | null;
    /** 經濟弱勢專屬：每月收入（夫妻取平均，萬元） */
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

        await client.query(
            `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2`,
            [toStatus, applicationId]
        );

        const existRes = await client.query(
            `SELECT 1 FROM application_workflow WHERE application_id = $1 LIMIT 1`,
            [applicationId]
        );

        if (existRes.rows.length > 0) {
            await client.query(`
                UPDATE application_workflow
                SET stage = $1,
                    reviewer_id = $2,
                    is_approved = false,
                    comments = $3,
                    reviewed_at = NOW()
                WHERE application_id = $4
            `, [dbStage, reviewerUserId, comments ?? `退回至${stageLabel}`, applicationId]);
        } else {
            await client.query(`
                INSERT INTO application_workflow
                    (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
                VALUES ($1, $2, $3, false, $4, NOW())
            `, [applicationId, dbStage, reviewerUserId, comments ?? `退回至${stageLabel}`]);
        }

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
            await client.query(
                `UPDATE applications SET board_review_comments = NULL
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
            `SELECT stage FROM application_workflow WHERE application_id = $1 LIMIT 1`,
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
            `UPDATE applications SET status = '2', approved_amount = 0, updated_at = NOW() WHERE id = $1`,
            [applicationId]
        );
        const existRes = await client.query(
            `SELECT 1 FROM application_workflow WHERE application_id = $1 LIMIT 1`,
            [applicationId]
        );
        if (existRes.rows.length > 0) {
            await client.query(`
                UPDATE application_workflow
                SET stage = 'board_review', reviewer_id = $1, is_approved = false,
                    comments = $2, reviewed_at = NOW()
                WHERE application_id = $3
            `, [reviewerUserId, comments, applicationId]);
        } else {
            await client.query(`
                INSERT INTO application_workflow
                    (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
                VALUES ($1, 'board_review', $2, false, $3, NOW())
            `, [applicationId, reviewerUserId, comments]);
        }
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

        // 取當下 stage（若 caller 沒傳）
        let actualStage = stage ?? null;
        if (!actualStage) {
            const sRes = await client.query(
                `SELECT stage FROM application_workflow WHERE application_id = $1 LIMIT 1`,
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

        // workflow row：upsert
        const exist = await client.query(
            `SELECT 1 FROM application_workflow WHERE application_id = $1 LIMIT 1`,
            [applicationId]
        );
        if (exist.rows.length > 0) {
            await client.query(`
                UPDATE application_workflow
                SET stage = $1, reviewer_id = $2, is_approved = false,
                    comments = $3, reviewed_at = NOW()
                WHERE application_id = $4
            `, [actualStage, operatorUserId, comments, applicationId]);
        } else {
            await client.query(`
                INSERT INTO application_workflow
                    (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
                VALUES ($1, $2, $3, false, $4, NOW())
            `, [applicationId, actualStage, operatorUserId, comments]);
        }

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
        await client.query(
            `UPDATE application_workflow SET comments = $1, reviewed_at = NOW() WHERE application_id = $2`,
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
        await client.query(
            `UPDATE applications
             SET status = '4',
                 approved_amount = COALESCE($2, approved_amount),
                 updated_at = NOW()
             WHERE id = $1`,
            [applicationId, approvedAmount ?? null]
        );
        await client.query(`
            UPDATE application_workflow
            SET stage = 'reimbursement', reviewer_id = $1, is_approved = true,
                comments = '核銷完成，案件結案', reviewed_at = NOW()
            WHERE application_id = $2
        `, [reviewerUserId, applicationId]);
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

export async function fetchWorkflowRecord(applicationId: string) {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT w.stage, w.is_approved, w.comments, w.created_at, w.reviewed_at,
                   u.name_enc, u.name_iv
            FROM application_workflow w
            LEFT JOIN users u ON u.id = w.reviewer_id
            WHERE w.application_id = $1
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
 * 由 case_officer / supervisor / admin 在家訪或行政初審階段填寫；董事審核時唯讀顯示。
 * 不限階段（推進到董事審核後仍可由主管／admin 補充）；只擋結案案件。
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
        // 角色驗證
        const roleRes = await client.query<{ code: string }>(
            `SELECT r.code FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint`,
            [operatorUserId]
        );
        const roles = roleRes.rows.map(r => r.code);
        const allowed = ['case_officer', 'supervisor', 'admin'];
        if (!roles.some(r => allowed.includes(r))) {
            return { success: false, error: '僅個管師、主管、admin 可填寫案件說明' };
        }
        // 結案不可改
        const statRes = await client.query<{ status: string }>(
            `SELECT status FROM applications WHERE id = $1::bigint`,
            [applicationId]
        );
        if (statRes.rowCount === 0) return { success: false, error: '案件不存在' };
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
