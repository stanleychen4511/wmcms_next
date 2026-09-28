'use server';

/**
 * 年度預算與警戒金額（WMCMS-8 #83）
 *
 * - 讀取（fetchBudgetStatus）：萬美內部人員；申請人、志工與未登入者不可看
 * - 設定（upsertAnnualBudget）：僅 admin
 *
 * 已撥款金額 = 該年度、該子類型、review_stage='9' 的撥款合計。
 * 年度依「核發日期」sent_at；sent_at 未填（僅最後一筆撥款強制填寫）時退回執行長完成日，再退回建立日。
 * 撥款流程中（stage 1~4）金額另列供參考，不扣預算。未分類（applications.subsidy_subtype 為 NULL）不計入。
 */

import { pool } from '../../lib/db';
import { writeAuditLog } from './auditActions';
import { computeBudgetStatus, type BudgetCategoryStatus, type BudgetSubtype } from '../../lib/annualBudget';

const INTERNAL_ROLES = ['admin', 'supervisor', 'case_officer', 'social_worker', 'accountant', 'executive', 'chairman', 'board_member'];

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export interface BudgetStatusReport {
    fiscalYear: number;
    categories: BudgetCategoryStatus[];
}

async function operatorRoles(operatorUserId: string): Promise<Set<string>> {
    if (!/^\d+$/.test(operatorUserId ?? '')) return new Set();
    const res = await pool.query(
        `SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id
          JOIN users u ON u.id = ur.user_id
         WHERE ur.user_id = $1::bigint AND u.is_active = TRUE`,
        [operatorUserId]
    );
    return new Set(res.rows.map((r: { code: string }) => r.code));
}

function currentTaipeiYear(): number {
    return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric' }).format(new Date()));
}

function validYear(year: unknown): year is number {
    return Number.isInteger(year) && (year as number) >= 2000 && (year as number) <= 2200;
}

export async function fetchBudgetStatus(
    operatorUserId: string,
    fiscalYear?: number,
): Promise<ActionResult<BudgetStatusReport>> {
    const roles = await operatorRoles(operatorUserId);
    if (!INTERNAL_ROLES.some(r => roles.has(r))) return { success: false, error: '權限不足' };
    const year = validYear(fiscalYear) ? fiscalYear : currentTaipeiYear();
    try {
        const budgetRes = await pool.query(
            `SELECT subsidy_subtype, budget_amount, warning_amount
               FROM annual_subsidy_budgets WHERE fiscal_year = $1`,
            [year]
        );
        const amountRes = await pool.query(
            `SELECT a.subsidy_subtype,
                    COALESCE(SUM(pd.amount) FILTER (WHERE pd.review_stage = '9'), 0) AS disbursed,
                    COALESCE(SUM(pd.amount) FILTER (WHERE pd.review_stage IN ('1','2','3','4')), 0) AS in_flight
               FROM payment_disbursements pd
               JOIN applications a ON a.id = pd.application_id
              WHERE a.subsidy_subtype IN ('1', '2')
                AND EXTRACT(YEAR FROM COALESCE(
                        pd.sent_at,
                        (pd.executive_signed_at AT TIME ZONE 'Asia/Taipei')::date,
                        (pd.created_at AT TIME ZONE 'Asia/Taipei')::date
                    )) = $1
              GROUP BY a.subsidy_subtype`,
            [year]
        );
        const budgets = new Map(budgetRes.rows.map((r: { subsidy_subtype: string; budget_amount: string; warning_amount: string }) =>
            [r.subsidy_subtype, { budget: Number(r.budget_amount), warning: Number(r.warning_amount) }]));
        const amounts = new Map(amountRes.rows.map((r: { subsidy_subtype: string; disbursed: string; in_flight: string }) =>
            [r.subsidy_subtype, { disbursed: Number(r.disbursed), inFlight: Number(r.in_flight) }]));
        const categories = (['1', '2'] as BudgetSubtype[]).map(sub => computeBudgetStatus({
            subsidySubtype: sub,
            budgetAmount: budgets.get(sub)?.budget ?? null,
            warningAmount: budgets.get(sub)?.warning ?? null,
            disbursedAmount: amounts.get(sub)?.disbursed ?? 0,
            inFlightAmount: amounts.get(sub)?.inFlight ?? 0,
        }));
        return { success: true, data: { fiscalYear: year, categories } };
    } catch (err) {
        console.error('fetchBudgetStatus error:', err);
        return { success: false, error: err instanceof Error ? err.message : '查詢失敗' };
    }
}

export async function upsertAnnualBudget(
    operatorUserId: string,
    fiscalYear: number,
    subsidySubtype: BudgetSubtype,
    budgetAmount: number,
    warningAmount: number,
): Promise<ActionResult<undefined>> {
    const roles = await operatorRoles(operatorUserId);
    if (!roles.has('admin')) return { success: false, error: '僅系統管理員可設定年度預算' };
    if (!validYear(fiscalYear)) return { success: false, error: '年度不正確' };
    if (subsidySubtype !== '1' && subsidySubtype !== '2') return { success: false, error: '類別不正確' };
    if (!Number.isInteger(budgetAmount) || budgetAmount < 0) return { success: false, error: '預算金額需為 0 以上的整數' };
    if (!Number.isInteger(warningAmount) || warningAmount < 0) return { success: false, error: '警戒金額需為 0 以上的整數' };
    if (warningAmount > budgetAmount) return { success: false, error: '警戒金額不可大於年度預算' };
    try {
        await pool.query(
            `INSERT INTO annual_subsidy_budgets (fiscal_year, subsidy_subtype, budget_amount, warning_amount, updated_by)
             VALUES ($1, $2, $3, $4, $5::bigint)
             ON CONFLICT (fiscal_year, subsidy_subtype) DO UPDATE SET
                 budget_amount = EXCLUDED.budget_amount,
                 warning_amount = EXCLUDED.warning_amount,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = NOW()`,
            [fiscalYear, subsidySubtype, budgetAmount, warningAmount, operatorUserId]
        );
        void writeAuditLog({
            userId: operatorUserId,
            action: 'setting.update',
            targetType: 'setting',
            targetId: `annual_budget:${fiscalYear}:${subsidySubtype}`,
            detail: { fiscal_year: fiscalYear, subsidy_subtype: subsidySubtype, budget_amount: budgetAmount, warning_amount: warningAmount },
        });
        return { success: true, data: undefined };
    } catch (err) {
        console.error('upsertAnnualBudget error:', err);
        return { success: false, error: err instanceof Error ? err.message : '儲存失敗' };
    }
}
