/**
 * 案件類別 A/B/C/D 解析工具。
 *
 * 系統 schema 已有 applications.application_type CHAR(1) 欄位（comment：申請類別 A/B/C/D），
 * 是欄位語意上的權威來源。但既有資料可能 NULL（無 NOT NULL 約束），
 * 同時 case_number 第一碼本身就帶類別資訊（規則：[A-D]+民國年3碼+流水號3碼），
 * 所以 fallback 提供向後相容。
 *
 * 印表頁直接呼叫 resolveCategory(applicationRow) 即可，不必關心是哪個來源。
 */

export type CaseCategory = 'A' | 'B' | 'C' | 'D';

export const CATEGORY_LABEL: Record<CaseCategory, string> = {
    A: '自費醫療補助',
    B: '臨終安寧自費醫療補助',
    C: '預立醫療照護諮商補助',
    D: '醫事人員進修補助',
};

/** Lower-level helper：從 case_number 第一碼解析類別。null/空字串/非 A-D 都回 null。 */
export function parseCategory(caseNumber: string | null | undefined): CaseCategory | null {
    if (!caseNumber) return null;
    const c = caseNumber[0] as CaseCategory;
    return CATEGORY_LABEL[c] ? c : null;
}

/**
 * 優先讀 application_type 欄位（schema 權威來源）；
 * 若 NULL 或非 A-D 才 fallback 解析 case_number 第一碼。
 */
export function resolveCategory(app: {
    application_type: string | null | undefined;
    case_number: string | null | undefined;
}): CaseCategory | null {
    const t = app.application_type as CaseCategory | null | undefined;
    if (t && CATEGORY_LABEL[t]) return t;
    return parseCategory(app.case_number);
}
