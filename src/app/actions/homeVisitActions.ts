'use server';

import { pool } from '../../lib/db';
import { writeAuditLog } from './auditActions';

export interface HomeVisitData {
    visit_date?: string;
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
            'visit_date', 'self_reported_condition',
            'disease_reaction_status', 'disease_reaction_other',
            'treatment_attitude_status', 'treatment_attitude_other',
            'other_status_notes', 'primary_caregiver', 'primary_caregiver_other',
            'family_interaction_status', 'family_interaction_other',
            'impacted_party_thoughts', 'treatment_support_status', 'treatment_support_other',
            'subsidy_need_reason', 'visitor_recommendations', 'visitor_recommendations_other',
        ] as const;

        const values = fields.map(f => (data as any)[f] ?? null);

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
