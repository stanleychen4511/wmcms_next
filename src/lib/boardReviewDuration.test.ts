import { describe, expect, it } from 'vitest';
import { summarizeBoardReviewDurations, type BoardReviewDurationItem } from './boardReviewDuration';

const item = (over: Partial<BoardReviewDurationItem>): BoardReviewDurationItem => ({
    applicationId: '1',
    caseNumber: 'A115001',
    signerUserId: '10',
    signerName: '王董事',
    isChairman: false,
    assignedAt: '2026-09-01T02:00:00.000Z',
    signedAt: '2026-09-03T02:00:00.000Z',
    days: 2,
    ...over,
});

describe('summarizeBoardReviewDurations', () => {
    it('computes count, average, median, max and pending per member', () => {
        const [s] = summarizeBoardReviewDurations([
            item({ days: 1 }),
            item({ days: 4 }),
            item({ days: 10 }),
            item({ days: 5 }),
            item({ signedAt: null, days: 7 }),
            item({ signedAt: null, days: 3 }),
        ]);
        expect(s.completedCount).toBe(4);
        expect(s.avgDays).toBe(5);
        expect(s.medianDays).toBe(4.5);
        expect(s.maxDays).toBe(10);
        expect(s.pendingCount).toBe(2);
        expect(s.maxPendingDays).toBe(7);
    });

    it('handles members with only pending reviews and sorts slowest first', () => {
        const res = summarizeBoardReviewDurations([
            item({ signerUserId: '1', signerName: '甲', days: 2 }),
            item({ signerUserId: '2', signerName: '乙', days: 9 }),
            item({ signerUserId: '3', signerName: '丙', signedAt: null, days: 4 }),
        ]);
        expect(res.map(r => r.signerName)).toEqual(['乙', '甲', '丙']);
        const pendingOnly = res[2];
        expect(pendingOnly.completedCount).toBe(0);
        expect(pendingOnly.avgDays).toBeNull();
        expect(pendingOnly.maxPendingDays).toBe(4);
    });
});
