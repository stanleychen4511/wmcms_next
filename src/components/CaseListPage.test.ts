import { describe, expect, it } from 'vitest';
import { getSpecialAttentionTooltipPosition } from './CaseListPage';

describe('special-attention tooltip position', () => {
    it('uses viewport-fixed coordinates so a tooltip above the first row is not clipped by the table', () => {
        expect(getSpecialAttentionTooltipPosition({ left: 400, top: 250 }, 1600, 900))
            .toEqual({ left: 400, bottom: 654 });
    });

    it('keeps the tooltip inside the viewport horizontally', () => {
        expect(getSpecialAttentionTooltipPosition({ left: 1590, top: 10 }, 1600, 900))
            .toEqual({ left: 1264, bottom: 894 });
    });
});
