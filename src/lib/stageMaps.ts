// Stage mapping constants per 需求規格書
// ============================================================
// applications.status VARCHAR(1):
//   1 = 審核中   (案件在申請收件或行政初審中)
//   2 = 審核未通過
//   3 = 審核通過  (行政初審通過，進入家訪)
//   4 = 待補助    (家訪通過，進入董事審選/核銷)
//   5 = 補助完成
//
// application_workflow.stage VARCHAR(20) — DB 儲存的英文 key:
//   'apply'         = 申請收件
//   'admin_review'  = 行政初審
//   'home_visit'    = 家庭訪視
//   'board_review'  = 董事審選
//   'reimbursement' = 核銷撥款
//
// Front-end WorkflowStage keys (App.tsx STAGES array):
//   'application' | 'admin_review' | 'visit' | 'board_review' | 'reimbursement'
//
// application_workflow.is_approved BOOLEAN:
//   NULL  = 尚未審核
//   false = 退件/未通過
//   true  = 同意/通過
//
// application_documents.status VARCHAR(1):
//   0 = 待上傳/未符合
//   1 = 符合
//   2 = 逾期
// ============================================================

// DB workflow.stage → front-end WorkflowStage key
export const DB_STAGE_TO_FRONTEND: Record<string, string> = {
    'apply':         'application',
    'admin_review':  'admin_review',
    'home_visit':    'visit',
    'board_review':  'board_review',
    'reimbursement': 'reimbursement',
};

// front-end WorkflowStage key → DB workflow.stage string
export const FRONTEND_TO_DB_STAGE: Record<string, string> = {
    'application':  'apply',
    'admin_review': 'admin_review',
    'visit':        'home_visit',
    'board_review': 'board_review',
    'reimbursement':'reimbursement',
};

// front-end WorkflowStage key → applications.status code when ADVANCING forward
// Retreating always keeps/uses '1' for 申請收件/行政初審, or '2' for any rejection
export const ADVANCE_STAGE_TO_STATUS: Record<string, string> = {
    'application':  '1', // 送件後 → 審核中
    'admin_review': '1', // 行政初審 → 審核中
    'visit':        '3', // 家訪 → 審核通過
    'board_review': '4', // 董事審選 → 待補助
    'reimbursement':'5', // 核銷 → 補助完成
};

// Alias for backward compat
export const STAGE_TO_STATUS = ADVANCE_STAGE_TO_STATUS;

// DB status code → human-readable label
export const STATUS_LABEL: Record<string, string> = {
    '1': '審核中',
    '2': '審核未通過',
    '3': '審核通過',
    '4': '待補助',
    '5': '補助完成',
};

// WorkflowStage → human-readable Chinese label
export const STAGE_LABEL: Record<string, string> = {
    'application':  '申請收件',
    'admin_review': '行政初審',
    'visit':        '家庭訪視',
    'board_review': '董事審選',
    'reimbursement':'核銷撥款',
};

// application_documents.status VARCHAR(1) labels
export const DOC_STATUS_LABEL: Record<string, string> = {
    '0': '待上傳/未符合',
    '1': '符合',
    '2': '逾期',
};

// Legacy alias kept so existing imports don't break
export const STATUS_TO_STAGE: Record<string, string> = {
    '1': 'admin_review',
    '2': 'admin_review',
    '3': 'visit',
    '4': 'board_review',
    '5': 'reimbursement',
};
