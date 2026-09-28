import { describe, expect, it } from 'vitest';
import { computeBudgetStatus } from './annualBudget';

const base = { subsidySubtype: '1' as const, inFlightAmount: 0 };

describe('computeBudgetStatus', () => {
    it('is unset without a budget', () => {
        const s = computeBudgetStatus({ ...base, budgetAmount: null, warningAmount: null, disbursedAmount: 500 });
        expect(s.level).toBe('unset');
        expect(s.remainingAmount).toBeNull();
    });

    it('warns when remaining is at or below the warning amount', () => {
        expect(computeBudgetStatus({ ...base, budgetAmount: 1000, warningAmount: 200, disbursedAmount: 700 }).level).toBe('ok');
        expect(computeBudgetStatus({ ...base, budgetAmount: 1000, warningAmount: 200, disbursedAmount: 800 }).level).toBe('warning');
        expect(computeBudgetStatus({ ...base, budgetAmount: 1000, warningAmount: 200, disbursedAmount: 1000 }).level).toBe('warning');
    });

    it('flags exceeded budgets and keeps the negative remaining amount', () => {
        const s = computeBudgetStatus({ ...base, budgetAmount: 1000, warningAmount: 200, disbursedAmount: 1250 });
        expect(s.level).toBe('exceeded');
        expect(s.remainingAmount).toBe(-250);
    });

    it('does not deduct in-flight amounts', () => {
        const s = computeBudgetStatus({ ...base, budgetAmount: 1000, warningAmount: 100, disbursedAmount: 0, inFlightAmount: 950 });
        expect(s.remainingAmount).toBe(1000);
        expect(s.level).toBe('ok');
    });
});
