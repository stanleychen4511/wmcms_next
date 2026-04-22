/**
 * 西元年 → 民國年（ROC year = Gregorian year - 1911）。
 * 用於列印頁面顯示審核日期等。
 */

/** 解析輸入為 Date；無效或 null 回 null。 */
function toDate(input: Date | string | null | undefined): Date | null {
    if (input == null) return null;
    const d = input instanceof Date ? input : new Date(input);
    return isNaN(d.getTime()) ? null : d;
}

export function toRocDate(input: Date | string | null | undefined):
    | { year: number; month: number; day: number }
    | null {
    const d = toDate(input);
    if (!d) return null;
    return {
        year: d.getFullYear() - 1911,
        month: d.getMonth() + 1,
        day: d.getDate(),
    };
}

/**
 * 格式化為「民國YY 年 M 月 D 日」字串；null/undefined 回空字串。
 */
export function formatRocDate(
    input: Date | string | null | undefined,
    sep: string = ' 年 '
): string {
    const r = toRocDate(input);
    if (!r) return '';
    return `民國${r.year}${sep}${r.month} 月 ${r.day} 日`;
}
