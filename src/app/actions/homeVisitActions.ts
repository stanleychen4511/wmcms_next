'use server';

import { pool } from '../../lib/db';
import { writeAuditLog } from './auditActions';

const VIEW_ROLES_FOR_HISTORY = ['case_officer', 'supervisor', 'accountant', 'executive', 'admin', 'volunteer'];

async function userHasAnyRoleLocal(operatorUserId: string, codes: string[]): Promise<boolean> {
    if (!operatorUserId || !/^\d+$/.test(operatorUserId)) return false;
    const r = await pool.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint AND r.code = ANY($2::text[]) LIMIT 1`,
        [operatorUserId, codes]
    );
    return (r.rowCount ?? 0) > 0;
}

export interface ApplicantHomeVisit {
    homeVisitId: string;
    applicationId: string;
    caseNumber: string;
    caseStatus: string;
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
}

/** 撈某申請人歷次案件的家訪關懷紀錄表（每案 0~1 筆，取最新） */
export async function fetchApplicantHomeVisits(
    operatorUserId: string,
    applicantUserId: string,
): Promise<{ success: true; data: ApplicantHomeVisit[] } | { success: false; error: string }> {
    if (!(await userHasAnyRoleLocal(operatorUserId, VIEW_ROLES_FOR_HISTORY))) {
        return { success: false, error: '權限不足' };
    }
    if (!/^\d+$/.test(applicantUserId)) return { success: false, error: '無效的申請人 ID' };

    // 志工只能看自己負責的家訪（user feedback #7）；其他角色看全部
    const roleRes = await pool.query(
        `SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint`,
        [operatorUserId]
    );
    const userRoles = roleRes.rows.map((r: any) => r.code);
    const isVolunteerOnly = userRoles.includes('volunteer')
        && !userRoles.some((r: string) => ['admin', 'supervisor', 'case_officer', 'executive', 'chairman', 'board_member', 'accountant'].includes(r));

    const client = await pool.connect();
    try {
        const params: unknown[] = [applicantUserId];
        let visitorFilter = '';
        if (isVolunteerOnly) {
            params.push(operatorUserId);
            visitorFilter = `AND hv.visitor_id = $${params.length}::bigint`;
        }
        const r = await client.query(
            `SELECT DISTINCT ON (a.id)
                hv.id, hv.application_id, hv.visit_date,
                hv.visitor_name, hv.visitor_title,
                hv.self_reported_condition, hv.disease_reaction_status, hv.disease_reaction_other,
                hv.treatment_attitude_status, hv.treatment_attitude_other,
                hv.primary_caregiver, hv.primary_caregiver_other,
                hv.family_interaction_status, hv.family_interaction_other,
                hv.impacted_party_thoughts, hv.treatment_support_status, hv.treatment_support_other,
                hv.subsidy_need_reason, hv.visitor_recommendations, hv.visitor_recommendations_other,
                hv.other_status_notes, hv.visit_photo_urls,
                a.case_number, a.status AS case_status
             FROM home_visit hv
             JOIN applications a ON a.id = hv.application_id
             WHERE a.applicant_id = $1::bigint ${visitorFilter}
             ORDER BY a.id DESC, hv.visit_date DESC NULLS LAST, hv.id DESC`,
            params
        );
        const data: ApplicantHomeVisit[] = r.rows.map((row: any) => ({
            homeVisitId: String(row.id),
            applicationId: String(row.application_id),
            caseNumber: row.case_number,
            caseStatus: row.case_status,
            visitDate: row.visit_date ? new Date(row.visit_date).toISOString().split('T')[0] : null,
            visitorName: row.visitor_name ?? null,
            visitorTitle: row.visitor_title ?? null,
            selfReportedCondition: row.self_reported_condition ?? null,
            diseaseReactionStatus: row.disease_reaction_status ?? null,
            diseaseReactionOther: row.disease_reaction_other ?? null,
            treatmentAttitudeStatus: row.treatment_attitude_status ?? null,
            treatmentAttitudeOther: row.treatment_attitude_other ?? null,
            primaryCaregiver: row.primary_caregiver ?? null,
            primaryCaregiverOther: row.primary_caregiver_other ?? null,
            familyInteractionStatus: row.family_interaction_status ?? null,
            familyInteractionOther: row.family_interaction_other ?? null,
            impactedPartyThoughts: row.impacted_party_thoughts ?? null,
            treatmentSupportStatus: row.treatment_support_status ?? null,
            treatmentSupportOther: row.treatment_support_other ?? null,
            subsidyNeedReason: row.subsidy_need_reason ?? null,
            visitorRecommendations: row.visitor_recommendations ?? null,
            visitorRecommendationsOther: row.visitor_recommendations_other ?? null,
            otherStatusNotes: row.other_status_notes ?? null,
            photoUrls: Array.isArray(row.visit_photo_urls) ? row.visit_photo_urls : [],
        }));
        return { success: true, data };
    } catch (err: any) {
        console.error('fetchApplicantHomeVisits error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

export interface HomeVisitData {
    visit_date?: string;
    visitor_title?: string;       // 志工 / 個管師
    visitor_name?: string;
    visit_photo_urls?: string[];  // 家訪照片 URL（至少 1 張；不家訪時免）
    /** user feedback #18：經濟弱勢可選不家訪 */
    visit_skipped?: boolean;
    skip_reason?: string;
    self_reported_condition?: string;
    disease_reaction_status?: string;
    disease_reaction_other?: string;
    treatment_attitude_status?: string;
    treatment_attitude_other?: string;
    other_status_notes?: string;
    primary_caregiver?: string;
    primary_caregiver_other?: string;
    family_interaction_status?: string;
    family_interaction_other?: string;
    impacted_party_thoughts?: string;
    treatment_support_status?: string;
    treatment_support_other?: string;
    subsidy_need_reason?: string;
    visitor_recommendations?: string;
    visitor_recommendations_other?: string;
}

export async function fetchHomeVisit(applicationId: string): Promise<HomeVisitData | null> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT * FROM home_visit WHERE application_id = $1 LIMIT 1`,
            [applicationId]
        );
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            visit_date: row.visit_date ? new Date(row.visit_date).toISOString().split('T')[0] : undefined,
            visitor_title: row.visitor_title ?? undefined,
            visitor_name: row.visitor_name ?? undefined,
            visit_photo_urls: Array.isArray(row.visit_photo_urls) ? row.visit_photo_urls : [],
            visit_skipped: !!row.visit_skipped,
            skip_reason: row.skip_reason ?? undefined,
            self_reported_condition: row.self_reported_condition,
            disease_reaction_status: row.disease_reaction_status,
            disease_reaction_other: row.disease_reaction_other,
            treatment_attitude_status: row.treatment_attitude_status,
            treatment_attitude_other: row.treatment_attitude_other,
            other_status_notes: row.other_status_notes,
            primary_caregiver: row.primary_caregiver,
            primary_caregiver_other: row.primary_caregiver_other,
            family_interaction_status: row.family_interaction_status,
            family_interaction_other: row.family_interaction_other,
            impacted_party_thoughts: row.impacted_party_thoughts,
            treatment_support_status: row.treatment_support_status,
            treatment_support_other: row.treatment_support_other,
            subsidy_need_reason: row.subsidy_need_reason,
            visitor_recommendations: row.visitor_recommendations,
            visitor_recommendations_other: row.visitor_recommendations_other,
        };
    } finally {
        client.release();
    }
}

export async function saveHomeVisit(
    applicationId: string,
    visitorUserId: string | null,
    data: HomeVisitData,
    visitorAccount?: string
): Promise<{ success: boolean; error?: string }> {
    // user feedback #8 #18 — 守門：不家訪須有原因；家訪則須填滿（含照片至少 1 張）
    if (data.visit_skipped) {
        if (!data.skip_reason || data.skip_reason.trim().length < 3) {
            return { success: false, error: '不家訪原因至少需 3 字' };
        }
    } else {
        if (!data.visit_date) return { success: false, error: '請填寫訪視日期' };
        if (!data.visitor_title || (data.visitor_title !== '志工' && data.visitor_title !== '個管師')) {
            return { success: false, error: '請選擇訪視員職稱（志工 / 個管師）' };
        }
        if (!data.visitor_name || data.visitor_name.trim().length < 1) {
            return { success: false, error: '請填寫訪視員姓名' };
        }
        if (!Array.isArray(data.visit_photo_urls) || data.visit_photo_urls.length < 1) {
            return { success: false, error: '家訪照片至少需上傳 1 張' };
        }
        // 其他欄位也必填（user 要求所有欄位都必填）
        const required: Array<[string, unknown]> = [
            ['本人陳述', data.self_reported_condition],
            ['對病情的反應', data.disease_reaction_status],
            ['治療態度', data.treatment_attitude_status],
            ['主要照顧者', data.primary_caregiver],
            ['家庭互動', data.family_interaction_status],
            ['當事人想法', data.impacted_party_thoughts],
            ['治療支持', data.treatment_support_status],
            ['需要補助原因', data.subsidy_need_reason],
            ['訪視員建議', data.visitor_recommendations],
        ];
        for (const [label, v] of required) {
            if (!v || String(v).trim() === '') {
                return { success: false, error: `欄位「${label}」必填` };
            }
        }
    }

    const client = await pool.connect();
    try {
        const existing = await client.query(
            `SELECT 1 FROM home_visit WHERE application_id = $1`,
            [applicationId]
        );

        const fields = [
            'visit_date', 'visitor_title', 'visitor_name', 'visit_photo_urls',
            'visit_skipped', 'skip_reason',
            'self_reported_condition',
            'disease_reaction_status', 'disease_reaction_other',
            'treatment_attitude_status', 'treatment_attitude_other',
            'other_status_notes', 'primary_caregiver', 'primary_caregiver_other',
            'family_interaction_status', 'family_interaction_other',
            'impacted_party_thoughts', 'treatment_support_status', 'treatment_support_other',
            'subsidy_need_reason', 'visitor_recommendations', 'visitor_recommendations_other',
        ] as const;

        // visit_photo_urls 是 TEXT[]；visit_skipped 是 BOOLEAN；其他 nullable 欄位空值轉 NULL
        const values = fields.map(f => {
            const v = (data as any)[f];
            if (f === 'visit_photo_urls') return Array.isArray(v) ? v : [];
            if (f === 'visit_skipped') return !!v;
            return v ?? null;
        });

        const isUpdate = existing.rows.length > 0;
        if (isUpdate) {
            const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
            await client.query(
                `UPDATE home_visit SET visitor_id = $1, ${setClauses}, updated_at = NOW() WHERE application_id = $${fields.length + 2}`,
                [visitorUserId, ...values, applicationId]
            );
        } else {
            const cols = ['application_id', 'visitor_id', ...fields].join(', ');
            const placeholders = [applicationId, visitorUserId, ...values].map((_, i) => `$${i + 1}`).join(', ');
            await client.query(
                `INSERT INTO home_visit (${cols}) VALUES (${placeholders})`,
                [applicationId, visitorUserId, ...values]
            );
        }

        void writeAuditLog({
            userId: visitorUserId,
            action: isUpdate ? 'home_visit.update' : 'home_visit.create',
            targetType: 'home_visit',
            targetId: applicationId,
        });

        return { success: true };
    } catch (err: any) {
        console.error('saveHomeVisit error', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
