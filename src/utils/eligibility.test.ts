import { describe, it, expect } from 'vitest';
import { checkEligibility, ApplicantData } from './eligibility';

describe('Eligibility Check', () => {
    it('should approve eligible single applicant', () => {
        const data: ApplicantData = {
            type: 'single',
            hasChildren: false,
            annualIncome: 50, // within 40-105
            movableAssets: 10, // < 50
            realEstateValue: 1000 // < 2500
        };
        const result = checkEligibility(data);
        expect(result.isEligible).toBe(true);
        expect(result.reasons).toHaveLength(0);
    });

    it('should reject single applicant with low income', () => {
        const data: ApplicantData = {
            type: 'single',
            hasChildren: false,
            annualIncome: 30, // < 40
            movableAssets: 10,
            realEstateValue: 1000
        };
        const result = checkEligibility(data);
        expect(result.isEligible).toBe(false);
        expect(result.reasons).toContain('年收入 30 萬不符範圍 (40-105 萬)');
    });

    it('should reject single applicant with high income', () => {
        const data: ApplicantData = {
            type: 'single',
            hasChildren: false,
            annualIncome: 120, // > 105
            movableAssets: 10,
            realEstateValue: 1000
        };
        const result = checkEligibility(data);
        expect(result.isEligible).toBe(false);
        expect(result.reasons).toContain('年收入 120 萬不符範圍 (40-105 萬)');
    });

    it('should reject single applicant with high movable assets', () => {
        const data: ApplicantData = {
            type: 'single',
            hasChildren: false,
            annualIncome: 50,
            movableAssets: 60, // > 50
            realEstateValue: 1000
        };
        const result = checkEligibility(data);
        expect(result.isEligible).toBe(false);
        expect(result.reasons).toContain('動產 60 萬超過上限 50 萬');
    });

    it('should approve eligible married applicant', () => {
        const data: ApplicantData = {
            type: 'married',
            hasChildren: true,
            annualIncome: 80, // within 70-195
            movableAssets: 20, // < 80
            realEstateValue: 1000
        };
        const result = checkEligibility(data);
        expect(result.isEligible).toBe(true);
    });

    it('should reject married applicant without minor children', () => {
        const data: ApplicantData = {
            type: 'married',
            hasChildren: false,
            annualIncome: 80,
            movableAssets: 20,
            realEstateValue: 1000
        };
        const result = checkEligibility(data);
        expect(result.isEligible).toBe(false);
        expect(result.reasons).toContain('已婚申請者必須育有未成年子女');
    });

    it('should reject applicant with high real estate value', () => {
        const data: ApplicantData = {
            type: 'single',
            hasChildren: false,
            annualIncome: 50,
            movableAssets: 10,
            realEstateValue: 3000 // > 2500
        };
        const result = checkEligibility(data);
        expect(result.isEligible).toBe(false);
        expect(result.reasons).toContain('不動產價值 3000 萬超過上限 2500 萬');
    });
});
