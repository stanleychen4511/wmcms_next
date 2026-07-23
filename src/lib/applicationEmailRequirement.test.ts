import { describe, expect, it } from 'vitest';
import { isApplicantEmailRequired } from './applicationEmailRequirement';

describe('applicant email requirement', () => {
    it('requires an applicant email only for self applications', () => {
        expect(isApplicantEmailRequired('1')).toBe(true);
        expect(isApplicantEmailRequired('2')).toBe(false);
    });
});
