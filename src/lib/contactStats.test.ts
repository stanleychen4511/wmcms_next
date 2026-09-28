import { describe, expect, it } from 'vitest';
import { aggregateContactStats, type ContactStatsRow } from './contactStats';

const row = (over: Partial<ContactStatsRow>): ContactStatsRow => ({
    contactDate: '2026-09-01',
    gender: null,
    channelName: null,
    fromSource: null,
    consultProgram: null,
    rejectReasons: [],
    ...over,
});

const countOf = (items: { label: string; count: number }[], label: string) =>
    items.find(i => i.label === label)?.count;

describe('aggregateContactStats', () => {
    const rows = [
        row({ contactDate: '2026-09-15', gender: 'F', channelName: '電話', fromSource: '01', consultProgram: '1', rejectReasons: ['1', '4'] }),
        row({ contactDate: '2026-08-02', gender: 'M', channelName: 'LINE', fromSource: '03', consultProgram: '2' }),
        row({ contactDate: '2026-09-20', gender: 'F', channelName: '電話', rejectReasons: ['1'] }),
        row({ contactDate: '2026-09-21' }),
    ];
    const s = aggregateContactStats(rows, ['電話', 'LINE', 'Email']);

    it('counts total and months in ROC, ascending', () => {
        expect(s.total).toBe(4);
        expect(s.byMonth).toEqual([
            { label: '115年8月', count: 1 },
            { label: '115年9月', count: 3 },
        ]);
    });

    it('keeps every option (including zeros) plus 未填', () => {
        expect(countOf(s.byGender, '女')).toBe(2);
        expect(countOf(s.byGender, '未知')).toBe(0);
        expect(countOf(s.byGender, '未填')).toBe(1);
        expect(countOf(s.byChannel, 'Email')).toBe(0);
        expect(countOf(s.byChannel, '電話')).toBe(2);
        expect(countOf(s.byChannel, '未填')).toBe(1);
    });

    it('maps codes to labels for source and program', () => {
        expect(countOf(s.byFromSource, '醫院社工')).toBe(1);
        expect(countOf(s.byFromSource, '網路')).toBe(1);
        expect(countOf(s.byFromSource, '未填')).toBe(2);
        expect(countOf(s.byConsultProgram, '小康家庭')).toBe(1);
        expect(countOf(s.byConsultProgram, '經濟弱勢')).toBe(1);
    });

    it('counts multi-select reject reasons per reason, with 無 for none', () => {
        expect(countOf(s.byRejectReason, '收入不符')).toBe(2);
        expect(countOf(s.byRejectReason, '年齡不符')).toBe(1);
        expect(countOf(s.byRejectReason, '無')).toBe(2);
    });

    it('appends channels that are not in the active option list', () => {
        const t = aggregateContactStats([row({ channelName: '已停用類別' })], ['電話']);
        expect(t.byChannel.map(i => i.label)).toEqual(['電話', '已停用類別', '未填']);
    });
});
