/**
 * Shared in-memory store — single source of truth for all pages.
 *
 * Replaces the disconnected MOCK_CASES / MOCK_APPLICATION_RECORDS static arrays
 * AND the isolated localStorage-based workflow state. All three pages (case list,
 * history, workflow detail) read from and write to this module-level object.
 */

import { CaseSummary, ApplicationRecord, WorkflowStage, DocumentStatus, UserAccount, Role } from '../types';
import { DOCUMENT_LIST } from '../types';

// ── Applicant base data ───────────────────────────────────────────────────────

export interface ApplicantInfo {
    type: 'single' | 'married';
    age: number;
    hasMinorChildren: boolean;
    annualIncome: number;
    movableAssets: number;
    realEstateValue: number;
}

// ── Per-application workflow state ────────────────────────────────────────────

export interface ApplicationWorkflowState {
    documents: { id: string; name: string; required: boolean; status: DocumentStatus }[];
    applicant: ApplicantInfo;
    boardOpinion: string;
    auditLog: string[];
}

// ── Combined record ───────────────────────────────────────────────────────────

export interface ApplicationEntry extends ApplicationRecord {
    workflow?: ApplicationWorkflowState;
}

// ── Initial data ──────────────────────────────────────────────────────────────

const defaultWorkflow = (): ApplicationWorkflowState => ({
    documents: DOCUMENT_LIST.map(d => ({ ...d })),
    applicant: {
        type: 'married',
        age: 40,
        hasMinorChildren: true,
        annualIncome: 80,
        movableAssets: 50,
        realEstateValue: 1000,
    },
    boardOpinion: '',
    auditLog: [],
});

// Module-level mutable data — this survives page navigation within the SPA
let _applications: ApplicationEntry[] = [
    // 陳大明 — 3 applications
    { id: 'app-001-a', applicantId: 'person-001', applicantName: '陳大明', appliedAt: '2024-03-10', stage: 'reimbursement', officer: '林志明', status: 'closed', closedReason: '核准補助', amount: 20000 },
    { id: 'app-001-b', applicantId: 'person-001', applicantName: '陳大明', appliedAt: '2025-02-14', stage: 'reimbursement', officer: '林志明', status: 'closed', closedReason: '核准補助', amount: 25000 },
    { id: 'app-001-c', applicantId: 'person-001', applicantName: '陳大明', appliedAt: '2026-02-25', stage: 'board_review', officer: '林志明', status: 'active', workflow: defaultWorkflow() },

    // 王小芬 — 2 applications
    { id: 'app-002-a', applicantId: 'person-002', applicantName: '王小芬', appliedAt: '2024-09-05', stage: 'reimbursement', officer: '林志明', status: 'closed', closedReason: '核准補助', amount: 18000 },
    { id: 'app-002-b', applicantId: 'person-002', applicantName: '王小芬', appliedAt: '2026-01-10', stage: 'visit', officer: '林志明', status: 'active', workflow: defaultWorkflow() },

    // 李建國 — 1 application
    { id: 'app-003-a', applicantId: 'person-003', applicantName: '李建國', appliedAt: '2025-11-20', stage: 'visit', officer: '黃美玲', status: 'active', workflow: defaultWorkflow() },

    // 張淑惠 — 1 application
    { id: 'app-004-a', applicantId: 'person-004', applicantName: '張淑惠', appliedAt: '2025-12-01', stage: 'admin_review', officer: '黃美玲', status: 'active', workflow: defaultWorkflow() },

    // 劉俊傑 — 1 application
    { id: 'app-005-a', applicantId: 'person-005', applicantName: '劉俊傑', appliedAt: '2025-12-15', stage: 'admin_review', officer: '陳雅婷', status: 'active', workflow: defaultWorkflow() },

    // 吳秀英 — 2 applications
    { id: 'app-006-a', applicantId: 'person-006', applicantName: '吳秀英', appliedAt: '2024-11-20', stage: 'reimbursement', officer: '陳雅婷', status: 'closed', closedReason: '核准補助', amount: 22000 },
    { id: 'app-006-b', applicantId: 'person-006', applicantName: '吳秀英', appliedAt: '2026-02-03', stage: 'admin_review', officer: '陳雅婷', status: 'active', workflow: defaultWorkflow() },

    // 蔡志豪 — 1 application
    { id: 'app-007-a', applicantId: 'person-007', applicantName: '蔡志豪', appliedAt: '2026-01-18', stage: 'admin_review', officer: '林志明', status: 'active', workflow: defaultWorkflow() },

    // 林美華 — 1 application
    { id: 'app-008-a', applicantId: 'person-008', applicantName: '林美華', appliedAt: '2026-02-02', stage: 'admin_review', officer: '黃美玲', status: 'active', workflow: defaultWorkflow() },

    // 趙志遠 — 1 application
    { id: 'app-009-a', applicantId: 'person-009', applicantName: '趙志遠', appliedAt: '2026-02-10', stage: 'admin_review', officer: '系統管理員', status: 'active', workflow: defaultWorkflow() },

    // 許雅筑 — 1 application
    { id: 'app-010-a', applicantId: 'person-010', applicantName: '許雅筑', appliedAt: '2026-02-14', stage: 'admin_review', officer: '系統管理員', status: 'active', workflow: defaultWorkflow() },

    // 鄭家豪 — 2 applications
    { id: 'app-011-a', applicantId: 'person-011', applicantName: '鄭家豪', appliedAt: '2024-07-22', stage: 'reimbursement', officer: '系統管理員', status: 'closed', closedReason: '核准補助', amount: 15000 },
    { id: 'app-011-b', applicantId: 'person-011', applicantName: '鄭家豪', appliedAt: '2026-03-01', stage: 'reimbursement', officer: '系統管理員', status: 'active', workflow: defaultWorkflow() },
];

// ── Account management (Moved to Server Actions) ────────────────────────────
// The local mock account storage has been removed.
// All user authentication and management should now use the API in \`src/app/actions/userActions.ts\`.

// ── Person summary view (derived from applications) ───────────────────────────

const PERSON_META: Record<string, { name: string; officer: string }> = {
    'person-001': { name: '陳大明', officer: '林志明' },
    'person-002': { name: '王小芬', officer: '林志明' },
    'person-003': { name: '李建國', officer: '黃美玲' },
    'person-004': { name: '張淑惠', officer: '黃美玲' },
    'person-005': { name: '劉俊傑', officer: '陳雅婷' },
    'person-006': { name: '吳秀英', officer: '陳雅婷' },
    'person-007': { name: '蔡志豪', officer: '林志明' },
    'person-008': { name: '林美華', officer: '黃美玲' },
    'person-009': { name: '趙志遠', officer: '系統管理員' },
    'person-010': { name: '許雅筑', officer: '系統管理員' },
    'person-011': { name: '鄭家豪', officer: '系統管理員' },
};

// ── ID-number → personId lookup (mock mapping for demo) ──────────────────────
// In a real system this would be a backend lookup.
const _idNumberToPersonId: Record<string, string> = {
    // 陳大明 (has active + 2 closed, total approved = 45000)
    'A123456789': 'person-001',
    // 王小芬 (has active + 1 closed, total approved = 18000)
    'B234567890': 'person-002',
    // 李建國 (has 1 active only)
    'C345678901': 'person-003',
    // 張淑惠 (has 1 active only)
    'D456789012': 'person-004',
    // 劉俊傑 (has 1 active only)
    'E567890123': 'person-005',
    // 吳秀英 (has active + 1 closed, total approved = 22000)
    'F678901234': 'person-006',
    // 蔡志豪 (has 1 active only)
    'G789012345': 'person-007',
    // 林美華 (has 1 active only)
    'H890123456': 'person-008',
    // 趙志遠 (has 1 active only)
    'I901234567': 'person-009',
    // 許雅筑 (has 1 active only)
    'J012345678': 'person-010',
    // 鄭家豪 (has active + 1 closed, total approved = 15000)
    'K123456780': 'person-011',
};

// ── Store API ─────────────────────────────────────────────────────────────────

/** Get derived CaseSummary list (what the case-list page needs) */
export function getCaseSummaries(): CaseSummary[] {
    const personIds = Object.keys(PERSON_META);
    return personIds.map((personId) => {
        const apps = _applications.filter(a => a.applicantId === personId);
        const active = apps.find(a => a.status === 'active');
        const totalAmount = apps
            .filter(a => a.status === 'closed' && a.amount)
            .reduce((s, a) => s + (a.amount ?? 0), 0);

        return {
            id: personId,
            applicantName: PERSON_META[personId].name,
            applicationCount: apps.length,
            totalAmount,
            appliedAt: active?.appliedAt ?? apps[apps.length - 1]?.appliedAt ?? '',
            stage: (active?.stage ?? apps[apps.length - 1]?.stage ?? 'admin_review') as WorkflowStage,
            officer: active?.officer ?? PERSON_META[personId].officer,
        };
    });
}

/** Get all application records for a specific person */
export function getApplicationsByPerson(personId: string): ApplicationEntry[] {
    return _applications.filter(a => a.applicantId === personId);
}

/** Get the active application for a person */
export function getActiveApplication(personId: string): ApplicationEntry | null {
    return _applications.find(a => a.applicantId === personId && a.status === 'active') ?? null;
}

/** Get a specific application by its id */
export function getApplicationById(appId: string): ApplicationEntry | null {
    return _applications.find(a => a.id === appId) ?? null;
}

/** Update the stage of an application */
export function setApplicationStage(appId: string, stage: WorkflowStage): void {
    _applications = _applications.map(a =>
        a.id === appId ? { ...a, stage } : a
    );
}

/** Update the workflow state (documents, applicant info, etc.) of an application */
export function updateApplicationWorkflow(appId: string, updates: Partial<ApplicationWorkflowState>): void {
    _applications = _applications.map(a =>
        a.id === appId
            ? { ...a, workflow: { ...(a.workflow ?? defaultWorkflow()), ...updates } }
            : a
    );
}

// ── New application submission helpers ────────────────────────────────────────

export interface LookupResult {
    hasRecord: boolean;      // has any application record at all
    hasActive: boolean;      // has a currently active (in-progress) application
    totalApprovedAmount: number; // sum of all closed+approved applications
    applicantName?: string;  // populated only when found
}

/**
 * Look up a person's application history by their ID number.
 * Returns a LookupResult describing eligibility to apply.
 */
export function lookupByIdNumber(idNumber: string): LookupResult {
    const personId = _idNumberToPersonId[idNumber.toUpperCase()];
    if (!personId) {
        return { hasRecord: false, hasActive: false, totalApprovedAmount: 0 };
    }
    const apps = _applications.filter(a => a.applicantId === personId);
    const hasActive = apps.some(a => a.status === 'active');
    const totalApprovedAmount = apps
        .filter(a => a.status === 'closed' && a.closedReason === '核准補助' && a.amount)
        .reduce((sum, a) => sum + (a.amount ?? 0), 0);
    return {
        hasRecord: apps.length > 0,
        hasActive,
        totalApprovedAmount,
        applicantName: PERSON_META[personId]?.name,
    };
}

/**
 * Create a new application for a person.
 * If the person does not exist yet, a new person entry is created in PERSON_META
 * and in the ID map.
 * Returns the new application id.
 */
export function addNewApplication(
    name: string,
    idNumber: string,
    officer: string
): string {
    const normalizedId = idNumber.toUpperCase();

    // Resolve or create personId
    let personId = _idNumberToPersonId[normalizedId];
    if (!personId) {
        // Generate a new unique person id
        const existingCount = Object.keys(PERSON_META).length;
        personId = `person-${String(existingCount + 1).padStart(3, '0')}`;
        (PERSON_META as Record<string, { name: string; officer: string }>)[personId] = { name, officer };
        _idNumberToPersonId[normalizedId] = personId;
    }

    // Generate a unique application id
    const newAppId = `app-new-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);

    const newApp: ApplicationEntry = {
        id: newAppId,
        applicantId: personId,
        applicantName: name,
        appliedAt: today,
        stage: 'admin_review',
        officer,
        status: 'active',
        workflow: defaultWorkflow(),
    };

    _applications = [..._applications, newApp];
    return newAppId;
}
