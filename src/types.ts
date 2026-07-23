export type Role = 'applicant' | 'case_officer' | 'supervisor' | 'accountant' | 'board_member' | 'admin' | 'volunteer' | 'chairman' | 'executive' | 'social_worker';
export interface UserAccount {
    id: string;
    account: string; // The login account
    username: string; // Real name (decrypted)
    id_number?: string; // Decrypted ID
    password?: string; // Hashed (usually not sent to client, but kept here for type compat if needed)
    roles: Role[];
    createdAt: string;
}


export type WorkflowStage = 'admin_review' | 'visit' | 'board_review' | 'reimbursement';

export interface CaseSummary {
    id: string;
    applicationId: string;       // latest application's DB id
    caseNumber: string;          // latest application's case_number
    applicantName: string;
    /** 申請人聯絡電話（latest application 的 applicant_phone；可能為空） */
    applicantPhone?: string | null;
    applicationCount: number;
    totalAmount: number;
    appliedAt: string; // ISO date string e.g. "2025-11-03"
    stage: WorkflowStage;
    officer: string;
    officerId: string | null;    // null = 未派案
    /** Board group id if case is currently in board_review with an assignment; null otherwise. */
    assignedBoardGroupId?: string | null;
    /** 補助子類型（115 年辦法）：'1'=經濟弱勢, '2'=小康家庭；NULL = 舊資料未分類 */
    subsidySubtype?: '1' | '2' | null;
    /** DB applications.status：'1'=審核中, '2'=審核未通過, '3'=待核銷, '4'=核銷完成 */
    statusCode?: string | null;
    isEarlyClosed?: boolean;
}

export type ApplicationStatus = 'active' | 'closed';

export interface ApplicationRecord {
    id: string;             // unique application id
    caseNumber?: string;    // 案件編號（A115001 等）
    applicantId: string;    // links to CaseSummary.id (the person)
    applicantName: string;
    appliedAt: string;
    stage: WorkflowStage;
    officer: string;
    status: ApplicationStatus;
    closedReason?: string;  // e.g. '核准補助' | '不符資格' | '撤件'
    amount?: number;
}

export type DocumentStatus = 'pending' | 'uploaded' | 'verified' | 'rejected';

export interface DocumentItem {
    id: string;
    name: string;
    required: boolean;
    status: DocumentStatus;
}
