/**
 * 資格判定（115 年辦法）
 *
 * 全部門檻來自 DB（subsidy_amount_limits、mid_class_eligibility_matrix、
 * system_settings 中 elig_* keys），本檔案不存任何預設值。
 *
 * 呼叫方須先用 `fetchEligibilityRules()` 取得 snapshot，再傳入 `checkEligibility`。
 */

import type { EligibilityRulesSnapshot } from '../app/actions/eligibilityRulesActions';
import {
    SUBSIDY_SUBTYPE_LABEL,
    MARITAL_STATUS_LABEL,
    CHILDREN_STATUS_LABEL,
    type SubsidySubtype,
    type MaritalStatus,
    type ChildrenStatus,
} from '../lib/eligibilityConstants';

export interface ApplicantData {
    /** 補助子類型（必填）— 決定走經濟弱勢規則或小康家庭矩陣 */
    subsidyType: SubsidySubtype;
    age: number;
    realEstateValue: number;    // 萬
    /** 經濟弱勢用：存款（夫妻取平均，萬） */
    deposit?: number;
    /** 經濟弱勢用：每月收入（夫妻取平均，萬） */
    monthlyIncome?: number;
    /** 小康家庭用：婚姻狀態 */
    maritalStatus?: MaritalStatus;
    /** 小康家庭用：子女狀態 */
    childrenStatus?: ChildrenStatus;
    /** 小康家庭用：年收入（已婚=夫妻合計、單親/單身=個人，萬） */
    annualIncome?: number;
    /** 小康家庭用：存款＋有價證券（萬） */
    movableAssets?: number;
}

export interface EligibilityResult {
    isEligible: boolean;
    reasons: string[];
    /**
     * 結構化原因（給結案 modal 自動帶入用）。
     * code 對齊 application_close_reasons.reason_code（CLOSE_REASON_OPTIONS）：
     *   '02' 年收入過低 / '03' 年收入過高 / '04' 存款過高 / '05' 房產價值過高
     *   '06' 年齡過低 / '07' 年齡過高
     * value 為實際數值（金額轉元、年齡為歲）；非數值不填。
     */
    reasonCodes: Array<{ code: string; value?: string }>;
}

const num = (v: number | undefined): number => {
    if (v == null || isNaN(Number(v))) return -1;
    return Number(v);
};

export function checkEligibility(
    data: ApplicantData,
    rules: EligibilityRulesSnapshot,
): EligibilityResult {
    const reasons: string[] = [];
    const reasonCodes: Array<{ code: string; value?: string }> = [];
    const c = rules.common;
    /** 萬 → 元 字串 */
    const wanToYuan = (v: number) => String(v * 10000);

    // ── 共同條件 1：年齡 ───────────────────────────────────────────────────
    const age = num(data.age);
    if (age >= 0 && age < c.ageMin) {
        reasons.push(`年齡 ${age} 歲不符（須 ${c.ageMin}～${c.ageMax} 歲）`);
        reasonCodes.push({ code: '06', value: String(age) });
    } else if (age > c.ageMax) {
        reasons.push(`年齡 ${age} 歲不符（須 ${c.ageMin}～${c.ageMax} 歲）`);
        reasonCodes.push({ code: '07', value: String(age) });
    } else if (age < 0) {
        reasons.push(`年齡未填寫（須 ${c.ageMin}～${c.ageMax} 歲）`);
    }

    // ── 共同條件 2：不動產 ─────────────────────────────────────────────────
    const realEstate = num(data.realEstateValue);
    if (realEstate < 0) {
        reasons.push(`不動產未填寫（須未超過 ${c.realEstateMax} 萬）`);
    } else if (realEstate > c.realEstateMax) {
        reasons.push(`不動產 ${realEstate} 萬（須未超過 ${c.realEstateMax} 萬）`);
        reasonCodes.push({ code: '05', value: wanToYuan(realEstate) });
    }

    // ── 子類型專屬條件 ─────────────────────────────────────────────────────
    if (data.subsidyType === '1') {
        // 經濟弱勢
        const deposit = num(data.deposit);
        const monthlyIncome = num(data.monthlyIncome);
        if (deposit < 0) {
            reasons.push(`【經濟弱勢】存款未填寫（須 ≤ ${c.econDepositMax} 萬，夫妻取平均）`);
        } else if (deposit > c.econDepositMax) {
            reasons.push(`【經濟弱勢】存款 ${deposit} 萬（須 ≤ ${c.econDepositMax} 萬，夫妻取平均）`);
            reasonCodes.push({ code: '04', value: wanToYuan(deposit) });
        }
        if (monthlyIncome < 0) {
            reasons.push(`【經濟弱勢】月收入未填寫（須 ≤ ${c.econMonthlyIncomeMax} 萬，夫妻取平均）`);
        } else if (monthlyIncome > c.econMonthlyIncomeMax) {
            // 月收入 → 推算年收入過高（×12）
            reasons.push(`【經濟弱勢】月收入 ${monthlyIncome} 萬（須 ≤ ${c.econMonthlyIncomeMax} 萬，夫妻取平均）`);
            reasonCodes.push({ code: '03', value: wanToYuan(monthlyIncome * 12) });
        }
    } else if (data.subsidyType === '2') {
        // 小康家庭：查矩陣
        const m = data.maritalStatus;
        const ch = data.childrenStatus;
        if (!m || !ch) {
            reasons.push('【小康家庭】須填寫婚姻狀態與子女狀態');
        } else {
            const entry = rules.midClassMatrix.find(
                e => e.maritalStatus === m && e.childrenStatus === ch
            );
            if (!entry) {
                reasons.push(
                    `【小康家庭】${MARITAL_STATUS_LABEL[m]}＋${CHILDREN_STATUS_LABEL[ch]} 不在資格矩陣中（115 辦法不適用此組合）`
                );
            } else {
                const income = num(data.annualIncome);
                const assets = num(data.movableAssets);
                const incomeLabel = m === '1' ? '夫妻合計年收入' : '個人年收入';
                if (income < 0) {
                    reasons.push(`【小康家庭】${incomeLabel}未填寫（須 ${entry.incomeMin}～${entry.incomeMax} 萬）`);
                } else if (income < entry.incomeMin) {
                    reasons.push(`【小康家庭】${incomeLabel} ${income} 萬過低（須 ${entry.incomeMin}～${entry.incomeMax} 萬）`);
                    reasonCodes.push({ code: '02', value: wanToYuan(income) });
                } else if (income > entry.incomeMax) {
                    reasons.push(`【小康家庭】${incomeLabel} ${income} 萬過高（須 ${entry.incomeMin}～${entry.incomeMax} 萬）`);
                    reasonCodes.push({ code: '03', value: wanToYuan(income) });
                }
                if (assets < 0) {
                    reasons.push(`【小康家庭】存款＋有價證券未填寫（須 ≤ ${entry.assetsMax} 萬）`);
                } else if (assets > entry.assetsMax) {
                    reasons.push(`【小康家庭】存款＋有價證券 ${assets} 萬（須 ≤ ${entry.assetsMax} 萬）`);
                    reasonCodes.push({ code: '04', value: wanToYuan(assets) });
                }
            }
        }
    } else {
        reasons.push(`未知的補助子類型：${data.subsidyType as string}`);
    }

    return {
        isEligible: reasons.length === 0,
        reasons,
        reasonCodes,
    };
}

/** 依子類型取得補助上限（元）。回傳 0 表示尚未設定。 */
export function getAmountMaxFor(
    subsidyType: SubsidySubtype,
    rules: EligibilityRulesSnapshot,
): number {
    return rules.amountLimits.find(x => x.subsidyType === subsidyType)?.amountMax ?? 0;
}

export { SUBSIDY_SUBTYPE_LABEL, MARITAL_STATUS_LABEL, CHILDREN_STATUS_LABEL };
export type { SubsidySubtype, MaritalStatus, ChildrenStatus };
