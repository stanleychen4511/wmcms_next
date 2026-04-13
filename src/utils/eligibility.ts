export type ApplicantType = 'married' | 'single';

export interface ApplicantData {
    type: ApplicantType;
    age: number;
    hasChildren: boolean;
    annualIncome: number; // In Wan (10k TWD)
    movableAssets: number; // In Wan
    realEstateValue: number; // In Wan
}

export interface EligibilityResult {
    isEligible: boolean;
    reasons: string[];
}

export const checkEligibility = (data: ApplicantData): EligibilityResult => {
    const reasons: string[] = [];

    // Safely coerce values — if undefined/NaN, use -1 so range checks will naturally fail
    const age        = isNaN(Number(data.age))             ? -1 : Number(data.age);
    const income     = isNaN(Number(data.annualIncome))    ? -1 : Number(data.annualIncome);
    const assets     = isNaN(Number(data.movableAssets))   ? -1 : Number(data.movableAssets);
    const realEstate = isNaN(Number(data.realEstateValue)) ? -1 : Number(data.realEstateValue);
    const hasChildren = !!data.hasChildren;
    const isMarried  = data.type === 'married';

    // ── 條件 1：年齡 25~65 歲 ─────────────────────────────────────────────────
    if (age < 25 || age > 65) {
        reasons.push(`年齡 ${age} 歲不符資格範圍（須為 25～65 歲）`);
    }

    // ── 條件 2：不動產未超過 2500 萬 ──────────────────────────────────────────
    if (realEstate < 0 || realEstate > 2500) {
        reasons.push(`不動產總值 ${realEstate < 0 ? '未填寫' : `${realEstate} 萬`}，須未超過 2500 萬`);
    }

    // ── 條件 3：至少符合以下四項情境之一 ─────────────────────────────────────
    //
    //   3.1 已婚 + 有未成年子女 + 家戶年收入 70~195 萬 + 動產 ≤ 80 萬
    //   3.2 已婚 + 無子女     + 家戶年收入 70~195 萬 + 動產 ≤ 40 萬
    //   3.3 單親 + 有未成年子女 + 個人年收入 40~105 萬 + 動產 ≤ 50 萬
    //   3.4 單身 + 無子女     + 個人年收入 40~105 萬

    const scenario31 = isMarried  &&  hasChildren && income >= 70 && income <= 195 && assets >= 0 && assets <= 80;
    const scenario32 = isMarried  && !hasChildren && income >= 70 && income <= 195 && assets >= 0 && assets <= 40;
    const scenario33 = !isMarried &&  hasChildren && income >= 40 && income <= 105 && assets >= 0 && assets <= 50;
    const scenario34 = !isMarried && !hasChildren && income >= 40 && income <= 105;

    if (!scenario31 && !scenario32 && !scenario33 && !scenario34) {
        // Build a helpful message explaining which scenario they are closest to
        const scenarioMessages: string[] = [];

        if (isMarried && hasChildren) {
            // Tried 3.1
            const incomeOk = income >= 70 && income <= 195;
            const assetsOk = assets >= 0 && assets <= 80;
            const msgs = [];
            if (!incomeOk) msgs.push(`家戶年收入 ${income < 0 ? '未填寫' : `${income} 萬`}（須 70～195 萬）`);
            if (!assetsOk) msgs.push(`動產 ${assets < 0 ? '未填寫' : `${assets} 萬`}（須不超過 80 萬）`);
            scenarioMessages.push(`【情境 3.1 已婚有子女】：${msgs.join('；')}`);
        } else if (isMarried && !hasChildren) {
            // Tried 3.2
            const incomeOk = income >= 70 && income <= 195;
            const assetsOk = assets >= 0 && assets <= 40;
            const msgs = [];
            if (!incomeOk) msgs.push(`家戶年收入 ${income < 0 ? '未填寫' : `${income} 萬`}（須 70～195 萬）`);
            if (!assetsOk) msgs.push(`動產 ${assets < 0 ? '未填寫' : `${assets} 萬`}（須不超過 40 萬）`);
            scenarioMessages.push(`【情境 3.2 已婚無子女】：${msgs.join('；')}`);
        } else if (!isMarried && hasChildren) {
            // Tried 3.3
            const incomeOk = income >= 40 && income <= 105;
            const assetsOk = assets >= 0 && assets <= 50;
            const msgs = [];
            if (!incomeOk) msgs.push(`個人年收入 ${income < 0 ? '未填寫' : `${income} 萬`}（須 40～105 萬）`);
            if (!assetsOk) msgs.push(`動產 ${assets < 0 ? '未填寫' : `${assets} 萬`}（須不超過 50 萬）`);
            scenarioMessages.push(`【情境 3.3 單親有子女】：${msgs.join('；')}`);
        } else {
            // Tried 3.4
            const incomeOk = income >= 40 && income <= 105;
            const msgs = [];
            if (!incomeOk) msgs.push(`個人年收入 ${income < 0 ? '未填寫' : `${income} 萬`}（須 40～105 萬）`);
            scenarioMessages.push(`【情境 3.4 單身無子女】：${msgs.join('；')}`);
        }

        reasons.push(`不符合任何適用情境：${scenarioMessages.join(' / ')}`);
    }

    return {
        isEligible: reasons.length === 0,
        reasons,
    };
};
