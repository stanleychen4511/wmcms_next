/**
 * 申請規則常數與型別（純 client/共用，無 'use server'）
 * 對應 contact_records 配對風格 — 把 enum label 從 server actions 抽出來
 * 以避免 Next.js 'use server' 限制（不可 export 非 async function 之物件）。
 */

export type SubsidySubtype = '1' | '2';
export type MaritalStatus  = '1' | '2' | '3';
export type ChildrenStatus = '1' | '2' | '3';

export const SUBSIDY_SUBTYPE_LABEL: Record<SubsidySubtype, string> = {
    '1': '經濟弱勢',
    '2': '小康家庭',
};

export const MARITAL_STATUS_LABEL: Record<MaritalStatus, string> = {
    '1': '已婚',
    '2': '單親',
    '3': '單身',
};

export const CHILDREN_STATUS_LABEL: Record<ChildrenStatus, string> = {
    '1': '未成年子女',
    '2': '已成年子女',
    '3': '無子女',
};
