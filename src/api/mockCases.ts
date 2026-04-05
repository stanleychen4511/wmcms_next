import { CaseSummary, ApplicationRecord } from '../types';

export const MOCK_CASES: CaseSummary[] = [
    { id: 'person-001', applicantName: '陳大明', applicationCount: 3, totalAmount: 45000, appliedAt: '2026-02-25', stage: 'board_review', officer: '林志明' },
    { id: 'person-002', applicantName: '王小芬', applicationCount: 2, totalAmount: 18000, appliedAt: '2026-01-10', stage: 'visit', officer: '林志明' },
    { id: 'person-003', applicantName: '李建國', applicationCount: 1, totalAmount: 0, appliedAt: '2025-11-20', stage: 'visit', officer: '黃美玲' },
    { id: 'person-004', applicantName: '張淑惠', applicationCount: 1, totalAmount: 0, appliedAt: '2025-12-01', stage: 'admin_review', officer: '黃美玲' },
    { id: 'person-005', applicantName: '劉俊傑', applicationCount: 1, totalAmount: 0, appliedAt: '2025-12-15', stage: 'application', officer: '陳雅婷' },
    { id: 'person-006', applicantName: '吳秀英', applicationCount: 2, totalAmount: 22000, appliedAt: '2026-02-03', stage: 'admin_review', officer: '陳雅婷' },
    { id: 'person-007', applicantName: '蔡志豪', applicationCount: 1, totalAmount: 0, appliedAt: '2026-01-18', stage: 'application', officer: '林志明' },
    { id: 'person-008', applicantName: '林美華', applicationCount: 1, totalAmount: 0, appliedAt: '2026-02-02', stage: 'application', officer: '黃美玲' },
    { id: 'person-009', applicantName: '趙志遠', applicationCount: 1, totalAmount: 0, appliedAt: '2026-02-10', stage: 'application', officer: '系統管理員' },
    { id: 'person-010', applicantName: '許雅筑', applicationCount: 1, totalAmount: 0, appliedAt: '2026-02-14', stage: 'admin_review', officer: '系統管理員' },
    { id: 'person-011', applicantName: '鄭家豪', applicationCount: 2, totalAmount: 15000, appliedAt: '2026-03-01', stage: 'reimbursement', officer: '系統管理員' },
];

// All application records keyed by applicantId (person ID)
export const MOCK_APPLICATION_RECORDS: ApplicationRecord[] = [
    // 陳大明 — 3 applications
    { id: 'app-001-a', applicantId: 'person-001', applicantName: '陳大明', appliedAt: '2024-03-10', stage: 'reimbursement', officer: '林志明', status: 'closed', closedReason: '核准補助', amount: 20000 },
    { id: 'app-001-b', applicantId: 'person-001', applicantName: '陳大明', appliedAt: '2025-02-14', stage: 'reimbursement', officer: '林志明', status: 'closed', closedReason: '核准補助', amount: 25000 },
    { id: 'app-001-c', applicantId: 'person-001', applicantName: '陳大明', appliedAt: '2026-02-25', stage: 'board_review', officer: '林志明', status: 'active' },

    // 王小芬 — 2 applications
    { id: 'app-002-a', applicantId: 'person-002', applicantName: '王小芬', appliedAt: '2024-09-05', stage: 'reimbursement', officer: '林志明', status: 'closed', closedReason: '核准補助', amount: 18000 },
    { id: 'app-002-b', applicantId: 'person-002', applicantName: '王小芬', appliedAt: '2026-01-10', stage: 'visit', officer: '林志明', status: 'active' },

    // 李建國 — 1 application
    { id: 'app-003-a', applicantId: 'person-003', applicantName: '李建國', appliedAt: '2025-11-20', stage: 'visit', officer: '黃美玲', status: 'active' },

    // 張淑惠 — 1 application
    { id: 'app-004-a', applicantId: 'person-004', applicantName: '張淑惠', appliedAt: '2025-12-01', stage: 'admin_review', officer: '黃美玲', status: 'active' },

    // 劉俊傑 — 1 application
    { id: 'app-005-a', applicantId: 'person-005', applicantName: '劉俊傑', appliedAt: '2025-12-15', stage: 'application', officer: '陳雅婷', status: 'active' },

    // 吳秀英 — 2 applications
    { id: 'app-006-a', applicantId: 'person-006', applicantName: '吳秀英', appliedAt: '2024-11-20', stage: 'reimbursement', officer: '陳雅婷', status: 'closed', closedReason: '核准補助', amount: 22000 },
    { id: 'app-006-b', applicantId: 'person-006', applicantName: '吳秀英', appliedAt: '2026-02-03', stage: 'admin_review', officer: '陳雅婷', status: 'active' },

    // 蔡志豪 — 1 application
    { id: 'app-007-a', applicantId: 'person-007', applicantName: '蔡志豪', appliedAt: '2026-01-18', stage: 'application', officer: '林志明', status: 'active' },

    // 林美華 — 1 application
    { id: 'app-008-a', applicantId: 'person-008', applicantName: '林美華', appliedAt: '2026-02-02', stage: 'application', officer: '黃美玲', status: 'active' },

    // 趙志遠 — 1 application
    { id: 'app-009-a', applicantId: 'person-009', applicantName: '趙志遠', appliedAt: '2026-02-10', stage: 'application', officer: '系統管理員', status: 'active' },

    // 許雅筑 — 1 application
    { id: 'app-010-a', applicantId: 'person-010', applicantName: '許雅筑', appliedAt: '2026-02-14', stage: 'admin_review', officer: '系統管理員', status: 'active' },

    // 鄭家豪 — 2 applications
    { id: 'app-011-a', applicantId: 'person-011', applicantName: '鄭家豪', appliedAt: '2024-07-22', stage: 'reimbursement', officer: '系統管理員', status: 'closed', closedReason: '核准補助', amount: 15000 },
    { id: 'app-011-b', applicantId: 'person-011', applicantName: '鄭家豪', appliedAt: '2026-03-01', stage: 'reimbursement', officer: '系統管理員', status: 'active' },
];
