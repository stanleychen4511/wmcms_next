import { describe, expect, it } from 'vitest';
import { formatRocDateOnly, formatRocDateTime, formatRocYearMonth } from './rocDate';

describe('ROC date formatting', () => {
    it('formats date-only values, Taipei instants, and year-month values', () => {
        expect(formatRocDateOnly('2026-08-14')).toBe('115/08/14');
        expect(formatRocDateTime('2026-08-13T16:34:56.000Z')).toBe('115/08/14 00:34:56');
        expect(formatRocDateTime('2026-08-14 12:34:56')).toBe('115/08/14 12:34:56');
        expect(formatRocYearMonth('2026-08')).toBe('115/08');
        expect(formatRocDateOnly('1961-08-14')).toBe('050/08/14');
    });
});
