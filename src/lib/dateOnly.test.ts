import { describe, expect, it } from 'vitest';
import { formatDateOnly, formatTaipeiDateTime } from './dateOnly';

describe('Taipei date formatting', () => {
    it('converts stored UTC instants before displaying their date and time', () => {
        const utc = '2026-07-19T16:34:56.000Z';

        expect(formatDateOnly(utc)).toBe('2026-07-20');
        expect(formatTaipeiDateTime(utc)).toBe('2026-07-20 00:34:56');
    });
});
