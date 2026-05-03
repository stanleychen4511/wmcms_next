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

    const client = await pool.connect();
    try {
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
             WHERE a.applicant_id = $1::bigint
             ORDER BY a.id DESC, hv.visit_date DESC NULLS LAST, hv.id DESC`,
            [applicantUserId]
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
    visit_photo_urls?: string[];  // 家訪照片雲端連結（至少 1 張）
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
    const client = await pool.connect();
    try {
        const existing = await client.query(
            `SELECT 1 FROM home_visit WHERE application_id = $1`,
            [applicationId]
        );

        const fields = [
            'visit_date', 'visitor_title', 'visitor_name', 'visit_photo_urls',
            'self_reported_condition',
            'disease_reaction_status', 'disease_reaction_other',
            'treatment_attitude_status', 'treatment_attitude_other',
            'other_status_notes', 'primary_caregiver', 'primary_caregiver_other',
            'family_interaction_status', 'family_interaction_other',
            'impacted_party_thoughts', 'treatment_support_status', 'treatment_support_other',
            'subsidy_need_reason', 'visitor_recommendations', 'visitor_recommendations_other',
        ] as const;

        // visit_photo_urls 是 TEXT[]；其他 nullable 欄位空值轉 NULL
        const values = fields.map(f => {
            const v = (data as any)[f];
            if (f === 'visit_photo_urls') return Array.isArray(v) ? v : [];
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
