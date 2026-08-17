import { describe, expect, it } from 'vitest';
import { dateTextToIso, isoDateToText } from './DateInput';

describe('DateInput ROC display conversion', () => {
    it('keeps ISO values internally while showing ROC dates', () => {
        expect(isoDateToText('2026-08-14')).toBe('115/08/14');
        expect(dateTextToIso('115/08/14')).toBe('2026-08-14');
        expect(isoDateToText('1961-08-14')).toBe('050/08/14');
        expect(dateTextToIso('050/08/14')).toBe('1961-08-14');
        expect(dateTextToIso('115/02/29')).toBe('');
    });
});
