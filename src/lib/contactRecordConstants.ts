/**
 * 來電 / 關懷紀錄（#14）共用常數與型別
 *
 * Schema 對齊 contact_records 表。
 */

export type RecordType = '1' | '2';
export const RECORD_TYPE_LABEL: Record<RecordType, string> = {
    '1': '來電紀錄',
    '2': '關懷紀錄',
};

export type Gender = 'M' | 'F' | 'U';
export const GENDER_LABEL: Record<Gender, string> = {
    M: '男', F: '女', U: '未知',
};

/** 從何得知本補助（單選） */
export const FROM_SOURCE_OPTIONS = [
    { value: '01', label: '醫院社工' },
    { value: '02', label: '醫師' },
    { value: '03', label: '網路' },
    { value: '04', label: '病友' },
    { value: '05', label: '親友' },
    { value: '06', label: '鄉鎮市公所' },
    { value: '07', label: '他會' },
    { value: '08', label: '合作的個管師' },
    { value: '09', label: '公文' },
    { value: '10', label: 'FB' },
    { value: '11', label: 'Hope基金會' },
    { value: '12', label: '癌資中心' },
    { value: '13', label: '醫院個管' },
] as const;

/** 諮詢人（單選） */
export const CONSULTANT_TYPE_OPTIONS = [
    { value: '1', label: '本人諮詢' },
    { value: '2', label: '親友諮詢' },
    { value: '3', label: '轉介個案' },
] as const;

/** 諮詢方案（單選；對齊 #2 子類型） */
export const CONSULT_PROGRAM_OPTIONS = [
    { value: '1', label: '小康家庭' },
    { value: '2', label: '經濟弱勢' },
] as const;

/** 無法申請原因（多選） */
export const REJECT_REASON_OPTIONS = [
    { value: '1', label: '收入不符' },
    { value: '2', label: '存款證券不符' },
    { value: '3', label: '補助項目不符' },
    { value: '4', label: '年齡不符' },
    { value: '5', label: '非癌症' },
    { value: '6', label: '非本國籍' },
    { value: '7', label: '中低收入' },
] as const;

export const FROM_SOURCE_LABEL: Record<string, string> =
    Object.fromEntries(FROM_SOURCE_OPTIONS.map(o => [o.value, o.label]));
export const CONSULTANT_TYPE_LABEL: Record<string, string> =
    Object.fromEntries(CONSULTANT_TYPE_OPTIONS.map(o => [o.value, o.label]));
export const CONSULT_PROGRAM_LABEL: Record<string, string> =
    Object.fromEntries(CONSULT_PROGRAM_OPTIONS.map(o => [o.value, o.label]));
export const REJECT_REASON_LABEL: Record<string, string> =
    Object.fromEntries(REJECT_REASON_OPTIONS.map(o => [o.value, o.label]));

/** 將電話 / 聯絡方式 normalize 為純數字串供比對使用 */
export function normalizePhone(raw: string): string {
    return (raw ?? '').replace(/[^0-9]/g, '');
}
