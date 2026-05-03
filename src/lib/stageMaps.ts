// Stage mapping constants per 需求規格書
// ============================================================
// applications.status VARCHAR(1):
//   1 = 審核中        (案件進行中，尚未結案)
//   2 = 審核未通過(結案) (董事審核不通過，案件終止)
//   3 = 待核銷        (董事審核通過，等待會計撥款核銷)
//   4 = 核銷完成(結案) (核銷完成，案件結束)
//
// application_workflow.stage VARCHAR(20) — DB 儲存的英文 key:
//   'admin_review'  = 行政初審
//   'home_visit'    = 家庭訪視
//   'board_review'  = 董事審核
//   'reimbursement' = 核銷撥款
//
// Front-end WorkflowStage keys (App.tsx STAGES array):
//   'admin_review' | 'visit' | 'board_review' | 'reimbursement'
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
    'apply':         'admin_review', // legacy: 'apply' maps to merged 行政初審
    'admin_review':  'admin_review',
    'home_visit':    'visit',
    'board_review':  'board_review',
    'reimbursement': 'reimbursement',
};

// front-end WorkflowStage key → DB workflow.stage string
export const FRONTEND_TO_DB_STAGE: Record<string, string> = {
    'admin_review': 'admin_review',
    'visit':        'home_visit',
    'board_review': 'board_review',
    'reimbursement':'reimbursement',
};

// front-end WorkflowStage key → applications.status when ADVANCING (board_review approved path)
export const ADVANCE_STAGE_TO_STATUS: Record<string, string> = {
    'admin_review': '1', // 行政初審 → 審核中
    'visit':        '1', // 家庭訪視 → 審核中
    'board_review': '1', // 董事審核 → 仍為審核中
    'reimbursement':'3', // 進入核銷撥款 → 待核銷（由 closeCase 才設為 '4'）
};

// Alias for backward compat
export const STAGE_TO_STATUS = ADVANCE_STAGE_TO_STATUS;

// DB status code → human-readable label
export const STATUS_LABEL: Record<string, string> = {
    '1': '審核中',
    '2': '審核未通過',
    '3': '待核銷',
    '4': '核銷完成',
};

// WorkflowStage → human-readable Chinese label
export const STAGE_LABEL: Record<string, string> = {
    'admin_review': '行政初審',
    'visit':        '家庭訪視',
    'board_review': '董事審核',
    'reimbursement':'核銷撥款',
};

// application_documents.status VARCHAR(1) labels
export const DOC_STATUS_LABEL: Record<string, string> = {
    '0': '待上傳/未符合',
    '1': '符合',
    '2': '逾期',
};

export const STATUS_TO_STAGE: Record<string, string> = {
    '1': 'admin_review',
    '2': 'admin_review', // 結案但仍顯示最後停留階段
    '3': 'reimbursement',
    '4': 'reimbursement',
};
