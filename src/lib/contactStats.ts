/**
 * 來電紀錄統計（WMCMS-1 #75）— 純函式彙總，供報表頁與 Excel 匯出共用。
 *
 * 統計欄位：日期（月）、性別、聯絡方式類別、從何得知本補助、諮詢方案、無法申請原因。
 * 各選項固定列出（含 0 筆），方便跨期比較；空值歸入「未填」。
 * 無法申請原因為複選：每個原因各自計數（一筆紀錄可計入多個原因），另列「無」代表未勾選任何原因。
 */
import {
    GENDER_LABEL,
    FROM_SOURCE_OPTIONS,
    CONSULT_PROGRAM_OPTIONS,
    REJECT_REASON_OPTIONS,
} from './contactRecordConstants';

export interface ContactStatsRow {
    /** YYYY-MM-DD */
    contactDate: string;
    gender: 'M' | 'F' | 'U' | null;
    channelName: string | null;
    fromSource: string | null;
    consultProgram: string | null;
    rejectReasons: string[];
}

export interface CountItem {
    label: string;
    count: number;
}

export interface ContactStatsSummary {
    total: number;
    byMonth: CountItem[];
    byGender: CountItem[];
    byChannel: CountItem[];
    byFromSource: CountItem[];
    byConsultProgram: CountItem[];
    byRejectReason: CountItem[];
}

export const UNFILLED_LABEL = '未填';

function monthLabel(isoDate: string): string {
    const m = /^(\d{4})-(\d{2})/.exec(isoDate);
    if (!m) return UNFILLED_LABEL;
    return `${Number(m[1]) - 1911}年${Number(m[2])}月`;
}

/** 依固定選項順序計數；不在選項內的值依出現順序附加，最後是「未填」 */
function countByOptions(values: (string | null)[], options: readonly string[]): CountItem[] {
    const counts = new Map<string, number>(options.map(o => [o, 0]));
    let unfilled = 0;
    for (const v of values) {
        if (v == null || v === '') { unfilled++; continue; }
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const items = [...counts.entries()].map(([label, count]) => ({ label, count }));
    items.push({ label: UNFILLED_LABEL, count: unfilled });
    return items;
}

export function aggregateContactStats(rows: ContactStatsRow[], channelOrder: string[]): ContactStatsSummary {
    const months = new Map<string, number>();
    // 依日期排序後累計，確保月份遞增
    for (const r of [...rows].sort((a, b) => a.contactDate.localeCompare(b.contactDate))) {
        const label = monthLabel(r.contactDate);
        months.set(label, (months.get(label) ?? 0) + 1);
    }

    const genderLabels = (['M', 'F', 'U'] as const).map(g => GENDER_LABEL[g]);
    const fromSourceLabels = FROM_SOURCE_OPTIONS.map(o => o.label);
    const fromSourceMap = Object.fromEntries(FROM_SOURCE_OPTIONS.map(o => [o.value, o.label])) as Record<string, string>;
    const programLabels = CONSULT_PROGRAM_OPTIONS.map(o => o.label);
    const programMap = Object.fromEntries(CONSULT_PROGRAM_OPTIONS.map(o => [o.value, o.label])) as Record<string, string>;
    const reasonMap = Object.fromEntries(REJECT_REASON_OPTIONS.map(o => [o.value, o.label])) as Record<string, string>;

    const reasonCounts = new Map<string, number>(REJECT_REASON_OPTIONS.map(o => [o.label, 0]));
    let noReason = 0;
    for (const r of rows) {
        const codes = [...new Set(r.rejectReasons ?? [])];
        if (codes.length === 0) { noReason++; continue; }
        for (const code of codes) {
            const label = reasonMap[code] ?? code;
            reasonCounts.set(label, (reasonCounts.get(label) ?? 0) + 1);
        }
    }

    return {
        total: rows.length,
        byMonth: [...months.entries()].map(([label, count]) => ({ label, count })),
        byGender: countByOptions(rows.map(r => (r.gender ? GENDER_LABEL[r.gender] : null)), genderLabels),
        byChannel: countByOptions(rows.map(r => r.channelName), channelOrder),
        byFromSource: countByOptions(
            rows.map(r => (r.fromSource ? (fromSourceMap[r.fromSource] ?? r.fromSource) : null)),
            fromSourceLabels,
        ),
        byConsultProgram: countByOptions(
            rows.map(r => (r.consultProgram ? (programMap[r.consultProgram] ?? r.consultProgram) : null)),
            programLabels,
        ),
        byRejectReason: [
            ...[...reasonCounts.entries()].map(([label, count]) => ({ label, count })),
            { label: '無', count: noReason },
        ],
    };
}

/** 報表頁與 Excel 共用的區塊定義（標題 + 取值） */
export const CONTACT_STATS_SECTIONS: { key: keyof Omit<ContactStatsSummary, 'total'>; title: string }[] = [
    { key: 'byMonth', title: '日期（月份）' },
    { key: 'byGender', title: '性別' },
    { key: 'byChannel', title: '聯絡方式' },
    { key: 'byFromSource', title: '從何得知本補助' },
    { key: 'byConsultProgram', title: '諮詢方案' },
    { key: 'byRejectReason', title: '無法申請原因（複選，各自計數）' },
];
