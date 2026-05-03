/**
 * 撥款審核流程常數（#12，純 client/共用，無 'use server'）
 *
 * review_stage 對照：
 *   '1' 個管師持有中（officer）
 *   '2' 主管審核中（supervisor）
 *   '3' 會計審核中（accountant）
 *   '4' 執行長審核中（executive）
 *   '9' 已完成（completed）
 *   'X' 已退件廢棄（rejected and abandoned）
 */

export type ReviewStage = '1' | '2' | '3' | '4' | '9' | 'X';

export const REVIEW_STAGE_LABEL: Record<ReviewStage, string> = {
    '1': '個管師持有中',
    '2': '主管審核中',
    '3': '會計審核中',
    '4': '執行長審核中',
    '9': '已完成',
    'X': '已退件廢棄',
};
