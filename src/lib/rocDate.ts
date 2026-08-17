/**
 * 西元年 → 民國年（ROC year = Gregorian year - 1911）。
 * 用於列印頁面顯示審核日期等。
 */

const TAIPEI_TIME_ZONE = 'Asia/Taipei';

/** 解析輸入為 Date；無效或 null 回 null。 */
function toDate(input: Date | string | null | undefined): Date | null {
    if (input == null) return null;
    const d = input instanceof Date ? input : new Date(input);
    return isNaN(d.getTime()) ? null : d;
}

export function toRocDate(input: Date | string | null | undefined):
    | { year: number; month: number; day: number }
    | null {
    if (typeof input === 'string') {
        const localDate = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.exec(input);
        if (localDate) {
            return {
                year: Number(localDate[1]) - 1911,
                month: Number(localDate[2]),
                day: Number(localDate[3]),
            };
        }
    }

    const d = toDate(input);
    if (!d) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TAIPEI_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(d);
    const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
    return {
        year: part('year') - 1911,
        month: part('month'),
        day: part('day'),
    };
}

const pad = (value: number) => String(value).padStart(2, '0');
const padRocYear = (value: number) => String(value).padStart(3, '0');

/** 畫面用民國日期：YYY/MM/DD。 */
export function formatRocDateOnly(input: Date | string | null | undefined): string {
    const r = toRocDate(input);
    return r ? `${padRocYear(r.year)}/${pad(r.month)}/${pad(r.day)}` : '';
}

/** 畫面用民國日期時間：YYY/MM/DD HH:mm:ss（台北時區）。 */
export function formatRocDateTime(input: Date | string | null | undefined): string {
    if (typeof input === 'string') {
        const localTime = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input);
        if (localTime) {
            return `${padRocYear(Number(localTime[1]) - 1911)}/${localTime[2]}/${localTime[3]} ${localTime[4]}:${localTime[5]}:${localTime[6] ?? '00'}`;
        }
    }
    const d = toDate(input);
    if (!d) return '';
    const date = formatRocDateOnly(d);
    const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: TAIPEI_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(d);
    return date ? `${date} ${time}` : '';
}

/** 畫面用民國年月：YYY/MM；查詢值仍保留西元 YYYY-MM。 */
export function formatRocYearMonth(value: string | null | undefined): string {
    if (!value) return '';
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    return match ? `${padRocYear(Number(match[1]) - 1911)}/${match[2]}` : value;
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
