import { describe, it, expect } from 'vitest';
import { checkEligibility, type ApplicantData } from './eligibility';
import type { EligibilityRulesSnapshot } from '../app/actions/eligibilityRulesActions';

// 模擬 115 年辦法的 snapshot（測試專用，避免依賴 DB）
const RULES_115: EligibilityRulesSnapshot = {
    common: {
        ageMin: 25,
        ageMax: 65,
        realEstateMax: 2500,
        econDepositMax: 16,
        econMonthlyIncomeMax: 3,
    },
    amountLimits: [
        { subsidyType: '1', amountMax: 30000 },
        { subsidyType: '2', amountMax: 350000 },
    ],
    midClassMatrix: [
        { maritalStatus: '1', childrenStatus: '1', incomeMin: 70, incomeMax: 164, assetsMax: 120 },
        { maritalStatus: '1', childrenStatus: '2', incomeMin: 70, incomeMax: 164, assetsMax: 60 },
        { maritalStatus: '1', childrenStatus: '3', incomeMin: 70, incomeMax: 164, assetsMax: 60 },
        { maritalStatus: '2', childrenStatus: '1', incomeMin: 32, incomeMax: 105, assetsMax: 65 },
        { maritalStatus: '2', childrenStatus: '2', incomeMin: 32, incomeMax: 105, assetsMax: 32 },
        { maritalStatus: '3', childrenStatus: '1', incomeMin: 32, incomeMax: 105, assetsMax: 65 },
        { maritalStatus: '3', childrenStatus: '2', incomeMin: 32, incomeMax: 105, assetsMax: 32 },
        { maritalStatus: '3', childrenStatus: '3', incomeMin: 32, incomeMax: 105, assetsMax: 32 },
    ],
};

describe('Eligibility Check (115 辦法)', () => {
    // ── 經濟弱勢 ────────────────────────────────────────────────────────
    it('經濟弱勢：符合資格', () => {
        const data: ApplicantData = {
            subsidyType: '1',
            age: 40,
            realEstateValue: 1000,
            deposit: 10,
            monthlyIncome: 2,
        };
        const result = checkEligibility(data, RULES_115);
        expect(result.isEligible).toBe(true);
        expect(result.reasons).toHaveLength(0);
    });

    it('經濟弱勢：存款超標', () => {
        const data: ApplicantData = {
            subsidyType: '1',
            age: 40,
            realEstateValue: 1000,
            deposit: 20, // > 16
            monthlyIncome: 2,
        };
        const result = checkEligibility(data, RULES_115);
        expect(result.isEligible).toBe(false);
        expect(result.reasons.some(r => r.includes('存款'))).toBe(true);
    });

    // ── 小康家庭 ────────────────────────────────────────────────────────
    it('小康家庭-已婚未成年：符合', () => {
        const data: ApplicantData = {
            subsidyType: '2',
            age: 35,
            realEstateValue: 1000,
            maritalStatus: '1',
            childrenStatus: '1',
            annualIncome: 100,
            movableAssets: 50,
        };
        const result = checkEligibility(data, RULES_115);
        expect(result.isEligible).toBe(true);
    });

    it('小康家庭-已婚未成年：年收太低', () => {
        const data: ApplicantData = {
            subsidyType: '2',
            age: 35,
            realEstateValue: 1000,
            maritalStatus: '1',
            childrenStatus: '1',
            annualIncome: 50, // < 70
            movableAssets: 50,
        };
        const result = checkEligibility(data, RULES_115);
        expect(result.isEligible).toBe(false);
        expect(result.reasons.some(r => r.includes('年收入'))).toBe(true);
    });

    it('小康家庭-單身有未成年：適用單親矩陣外', () => {
        // 單親 + 無子女 不在辦法的矩陣中
        const data: ApplicantData = {
            subsidyType: '2',
            age: 30,
            realEstateValue: 100,
            maritalStatus: '2',
            childrenStatus: '3', // 無子女 + 單親 → 不存在
            annualIncome: 60,
            movableAssets: 30,
        };
        const result = checkEligibility(data, RULES_115);
        expect(result.isEligible).toBe(false);
    });

    it('小康家庭-單身無子女：存款超標', () => {
        const data: ApplicantData = {
            subsidyType: '2',
            age: 30,
            realEstateValue: 100,
            maritalStatus: '3',
            childrenStatus: '3',
            annualIncome: 60,
            movableAssets: 50, // > 32
        };
        const result = checkEligibility(data, RULES_115);
        expect(result.isEligible).toBe(false);
        expect(result.reasons.some(r => r.includes('存款＋有價證券'))).toBe(true);
    });

    // ── 共同條件 ────────────────────────────────────────────────────────
    it('年齡超出範圍', () => {
        const data: ApplicantData = {
            subsidyType: '2',
            age: 70,
            realEstateValue: 100,
            maritalStatus: '3',
            childrenStatus: '3',
            annualIncome: 50,
            movableAssets: 10,
        };
        const result = checkEligibility(data, RULES_115);
        expect(result.isEligible).toBe(false);
        expect(result.reasons.some(r => r.includes('年齡'))).toBe(true);
    });

    it('不動產超標', () => {
        const data: ApplicantData = {
            subsidyType: '2',
            age: 30,
            realEstateValue: 3000, // > 2500
            maritalStatus: '3',
            childrenStatus: '3',
            annualIncome: 50,
            movableAssets: 10,
        };
        const result = checkEligibility(data, RULES_115);
        expect(result.isEligible).toBe(false);
        expect(result.reasons.some(r => r.includes('不動產'))).toBe(true);
    });
});
