/**
 * 年度預算（WMCMS-8 #83）— 純函式，client/server 共用。
 *
 * 剩餘預算 = 年度預算 − 當年度已完成撥款。
 * 警示等級：
 *   unset    — 尚未設定該年度該類別預算
 *   ok       — 剩餘 > 警戒金額
 *   warning  — 0 ≤ 剩餘 ≤ 警戒金額
 *   exceeded — 剩餘 < 0（已超出預算）
 */

export type BudgetSubtype = '1' | '2';

export const BUDGET_SUBTYPE_LABEL: Record<BudgetSubtype, string> = {
    '1': '經濟弱勢',
    '2': '小康家庭',
};

export type BudgetLevel = 'unset' | 'ok' | 'warning' | 'exceeded';

export interface BudgetCategoryStatus {
    subsidySubtype: BudgetSubtype;
    budgetAmount: number | null;
    warningAmount: number | null;
    /** 當年度已完成撥款（review_stage='9'） */
    disbursedAmount: number;
    /** 撥款流程中（stage 1~4）的金額，僅供參考，不扣預算 */
    inFlightAmount: number;
    remainingAmount: number | null;
    level: BudgetLevel;
}

export function computeBudgetStatus(input: {
    subsidySubtype: BudgetSubtype;
    budgetAmount: number | null;
    warningAmount: number | null;
    disbursedAmount: number;
    inFlightAmount: number;
}): BudgetCategoryStatus {
    const { budgetAmount, warningAmount } = input;
    if (budgetAmount == null) {
        return { ...input, remainingAmount: null, level: 'unset' };
    }
    const remaining = budgetAmount - input.disbursedAmount;
    const level: BudgetLevel = remaining < 0 ? 'exceeded'
        : remaining <= (warningAmount ?? 0) ? 'warning'
        : 'ok';
    return { ...input, remainingAmount: remaining, level };
}

/** 西元年 → 民國年文字 */
export function rocYearLabel(year: number): string {
    return `${year - 1911} 年度`;
}
