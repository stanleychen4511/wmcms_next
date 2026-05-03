/**
 * 結構化結案原因常數（對齊 application_close_reasons.reason_code）
 *
 * - 01–10：行政審核未通過原因（可同時勾多項）
 * - 99：申請人取消申請（自由原因）
 *
 * detailHint 表示這個 code 的 detail_value 要填什麼類型：
 *   - 'amount'  → 金額（元）
 *   - 'age'     → 年齡
 *   - 'text'    → 自由文字
 *   - undefined → 不需要 detail
 */

export type CloseReasonCode =
    | '01' | '02' | '03' | '04' | '05'
    | '06' | '07' | '08' | '09' | '10'
    | '98' | '99';

export interface CloseReasonOption {
    code: CloseReasonCode;
    label: string;
    detailHint?: 'amount' | 'age' | 'text';
    detailLabel?: string;   // input placeholder / label
}

export const CLOSE_REASON_OPTIONS: CloseReasonOption[] = [
    { code: '01', label: '低收入戶／中低收入戶' },
    { code: '02', label: '年收入過低', detailHint: 'amount', detailLabel: '實際年收入（元）' },
    { code: '03', label: '年收入過高', detailHint: 'amount', detailLabel: '實際年收入（元）' },
    { code: '04', label: '存款過高',  detailHint: 'amount', detailLabel: '存款（元）' },
    { code: '05', label: '房產價值過高', detailHint: 'amount', detailLabel: '房產價值（元）' },
    { code: '06', label: '年齡過低', detailHint: 'age', detailLabel: '實際年齡' },
    { code: '07', label: '年齡過高', detailHint: 'age', detailLabel: '實際年齡' },
    { code: '08', label: '補助項目不符', detailHint: 'text', detailLabel: '欲申請項目' },
    { code: '09', label: '非癌症' },
    { code: '10', label: '非本國籍' },
    { code: '98', label: '補件超時', detailHint: 'text', detailLabel: '結案說明' },
    { code: '99', label: '申請人取消申請', detailHint: 'text', detailLabel: '取消原因' },
];

export const CLOSE_REASON_LABEL: Record<string, string> =
    Object.fromEntries(CLOSE_REASON_OPTIONS.map(o => [o.code, o.label]));

/** 報表用：把多筆 reason 組成易讀的單行文字 */
export function formatCloseReasons(rows: Array<{ code: string; detail?: string | null }>): string {
    if (rows.length === 0) return '';
    return rows.map(r => {
        const label = CLOSE_REASON_LABEL[r.code] ?? r.code;
        const opt = CLOSE_REASON_OPTIONS.find(o => o.code === r.code);
        if (!opt?.detailHint || !r.detail) return label;
        if (opt.detailHint === 'amount') return `${label}（${Number(r.detail).toLocaleString()} 元）`;
        if (opt.detailHint === 'age')    return `${label}（${r.detail} 歲）`;
        return `${label}：${r.detail}`;
    }).join('；');
}
