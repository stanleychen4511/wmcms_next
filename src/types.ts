export type Role = 'applicant' | 'case_officer' | 'social_worker' | 'supervisor' | 'accountant' | 'board_member' | 'admin' | 'volunteer';
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
    applicantName: string;
    applicationCount: number;
    totalAmount: number;
    appliedAt: string; // ISO date string e.g. "2025-11-03"
    stage: WorkflowStage;
    officer: string;
    officerId: string | null;    // null = 未派案
}

export type ApplicationStatus = 'active' | 'closed';

export interface ApplicationRecord {
    id: string;             // unique application id
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

export const DOCUMENT_LIST: DocumentItem[] = [
    { id: 'd1', name: '申請書', required: true, status: 'pending' },
    { id: 'd2', name: '全戶戶籍謄本', required: true, status: 'pending' },
    { id: 'd3', name: '低收入戶證明/清寒證明', required: true, status: 'pending' },
    { id: 'd4', name: '身心障礙手冊', required: false, status: 'pending' },
    { id: 'd5', name: '診斷證明書', required: true, status: 'pending' },
    { id: 'd6', name: '醫療收據正本', required: true, status: 'pending' },
    { id: 'd7', name: '全戶財產證明', required: true, status: 'pending' },
    { id: 'd8', name: '全戶所得證明', required: true, status: 'pending' },
    { id: 'd9', name: '切結書', required: true, status: 'pending' },
    { id: 'd10', name: '領據', required: false, status: 'pending' }, // Usually for reimbursement
    { id: 'd11', name: '訪視報告', required: false, status: 'pending' }, // Internal
];
