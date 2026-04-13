"use client";
import { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList,
    UserCheck,
    Home,
    Gavel,
    CreditCard,
    ShieldCheck,
    AlertTriangle,
    UserCircle,
    LogOut,
    Eye,
    Save,
    Send,
} from 'lucide-react';
import { RoleSwitcher } from './components/RoleSwitcher';
import { LoginPage } from './components/LoginPage';
import { HomePage } from './components/HomePage';
import { CaseListPage } from './components/CaseListPage';
import { ApplicantHistoryPage } from './components/ApplicantHistoryPage';
import { NewApplicationPage } from './components/NewApplicationPage';
import { ReviewList } from './components/ReviewList';
import { HomeVisitForm } from './components/HomeVisitForm';
import { SendNotificationModal, ChecklistDoc } from './components/SendNotificationModal';
import { fetchNotificationLogs, NotificationLog } from './app/actions/notificationActions';
import { ApplicationForm } from './components/ApplicationForm';
import { StageContainer } from './components/StageContainer';
import { Dashboard } from './components/Dashboard';
import { DataExport } from './components/DataExport';
import { AuditLogViewer } from './components/AuditLogViewer';
import { AdminPanel } from './components/AdminPanel';
import { TemplateDownloadPage } from './components/TemplateDownloadPage';
import { NotificationManager } from './components/NotificationManager';

import {
    getCaseSummaries,
    getApplicationsByPerson,
    getActiveApplication,
    getApplicationById,
    setApplicationStage,
    updateApplicationWorkflow,
    ApplicationEntry,
} from './store/appStore';

import {
    fetchApplicationDetail,
    advanceWorkflowStage,
    retreatWorkflowStage,
    saveQualificationData,
    saveBoardReviewData,
    closeCaseRejected,
    closeCase,
    ApplicationDetail,
} from './app/actions/workflowActions';

import { fetchApplicationDocuments, DocumentEntry } from './app/actions/documentActions';

import {
    fetchCaseSummaries,
    fetchApplicantHistory,
    assignOfficerBatch,
} from './app/actions/applicationActions';

import { fetchCaseOfficers, fetchCaseOfficersWithId } from './app/actions/userActions';

import { STATUS_TO_STAGE, STAGE_TO_STATUS } from './lib/stageMaps';

import { LoadingSpinner } from './components/LoadingSpinner';
import { CaseSummary, ApplicationRecord, WorkflowStage, Role, DocumentStatus } from './types';
import { checkEligibility } from './utils/eligibility';
import { clsx } from 'clsx';

// ── Stage metadata ────────────────────────────────────────────────────────────

const STAGES: WorkflowStage[] = ['admin_review', 'visit', 'board_review', 'reimbursement'];

const STAGE_LABEL_MAP: Record<WorkflowStage, string> = {
    admin_review: '行政初審',
    visit: '家庭訪視',
    board_review: '董事審選',
    reimbursement: '核銷撥款',
};

const STAGE_ICON_MAP: Record<WorkflowStage, React.ReactNode> = {
    admin_review: <UserCheck className="w-4 h-4" />,
    visit: <Home className="w-4 h-4" />,
    board_review: <Gavel className="w-4 h-4" />,
    reimbursement: <CreditCard className="w-4 h-4" />,
};

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
    const [role, setRole] = useState<Role>('case_officer');
    const [loggedInUser, setLoggedInUser] = useState<{ username: string; roles: Role[]; account: string; id: string } | null>(null);

    const [view, setView] = useState<'home' | 'list' | 'history' | 'detail' | 'audit' | 'new_application' | 'admin' | 'template_download' | 'notification_manager'>('home');
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

    // Restore login + navigation state from sessionStorage (runs once on mount)
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem('loggedInUser');
            if (saved) {
                const user = JSON.parse(saved);
                setLoggedInUser(user);
                setRole(user.roles[0]);
            }
            const nav = sessionStorage.getItem('navState');
            if (nav) {
                const n = JSON.parse(nav);
                if (n.view)             setView(n.view);
                if (n.selectedPersonId) setSelectedPersonId(n.selectedPersonId);
                if (n.selectedAppId)    setSelectedAppId(n.selectedAppId);
            }
        } catch { /* ignore */ }
    }, []);

    // Persist navigation state whenever it changes
    useEffect(() => {
        try {
            sessionStorage.setItem('navState', JSON.stringify({ view, selectedPersonId, selectedAppId }));
        } catch { /* ignore */ }
    }, [view, selectedPersonId, selectedAppId]);

    // Force re-render when store data changes
    const [_tick, setTick] = useState(0);
    const refresh = () => setTick(t => t + 1);

    // Viewed stage for read-only browsing (separate from true stage)
    const [viewedStage, setViewedStage] = useState<WorkflowStage | null>(null);

    // Board review state
    const [boardApproved, setBoardApproved] = useState<boolean | null>(null); // null = 未選擇
    const [boardApprovedAmount, setBoardApprovedAmount] = useState<number>(0);
    const [boardOpinion, setBoardOpinion] = useState('');
    const [eligibilityCheck, setEligibilityCheck] = useState<{ checked: boolean; eligible: boolean; reasons: string[] }>({
        checked: false, eligible: false, reasons: [],
    });
    // Tracks the latest values from the ApplicationForm for use in eligibility check
    const [liveApplicantValues, setLiveApplicantValues] = useState<any>(null);
    const [isSavingQualification, setIsSavingQualification] = useState(false);
    const [saveQualToast, setSaveQualToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [applyAmount, setApplyAmount] = useState<number>(0);

    // Notification state
    const [showNotifModal, setShowNotifModal] = useState(false);
    const [notifLogs, setNotifLogs] = useState<NotificationLog[]>([]);

    const loadNotifLogs = useCallback(async (appId: string) => {
        const res = await fetchNotificationLogs(appId);
        if (res.success && res.data) setNotifLogs(res.data);
    }, []);

    // DB-driven application detail (loaded when entering detail view)
    const [appDetail, setAppDetail] = useState<ApplicationDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [dbDocs, setDbDocs] = useState<DocumentEntry[]>([]);

    const loadAppDetail = useCallback(async (id: string) => {
        setDetailLoading(true);
        try {
            const [detail, docs] = await Promise.all([
                fetchApplicationDetail(id),
                fetchApplicationDocuments(id),
            ]);
            setAppDetail(detail);
            setDbDocs(docs);
            if (detail) {
                setViewedStage(detail.stage as WorkflowStage);
                if (detail.applyAmount != null) setApplyAmount(detail.applyAmount);
                // Restore board review state from DB so closed cases still display correctly
                if (detail.wfIsApproved !== null && detail.wfIsApproved !== undefined) {
                    setBoardApproved(detail.wfIsApproved);
                }
                if (detail.approvedAmount != null) {
                    setBoardApprovedAmount(detail.approvedAmount);
                }
                if (detail.wfComments) {
                    setBoardOpinion(detail.wfComments);
                }
            }
        } finally {
            setDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view === 'detail' && selectedAppId) {
            loadAppDetail(selectedAppId);
            loadNotifLogs(selectedAppId);
        }
    }, [view, selectedAppId, loadAppDetail, loadNotifLogs]);

    // DB state for inquiry pages
    const [dbCases, setDbCases] = useState<CaseSummary[]>([]);
    const [listLoading, setListLoading] = useState(true); // start true so first render shows spinner
    const [dbHistory, setDbHistory] = useState<ApplicationRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [officerList, setOfficerList] = useState<string[]>([]);
    const [officersWithId, setOfficersWithId] = useState<{ id: string; name: string }[]>([]);

    // Helper to check if user HAS a specific role (regardless of current active mode)
    const hasPermission = useCallback((target: Role) => {
        if (!loggedInUser) return false;
        return (loggedInUser.roles as Role[]).includes(target);
    }, [loggedInUser]);

    // Fetch summaries when entering list view
    const refreshCaseSummaries = useCallback(async () => {
        setListLoading(true);
        try {
            const data = await fetchCaseSummaries();
            setDbCases(data);
            
            // Also fetch officer list for filtering and assignment
            const [oList, oWithId] = await Promise.all([
                fetchCaseOfficers(),
                fetchCaseOfficersWithId(),
            ]);
            setOfficerList(oList);
            setOfficersWithId(oWithId);
        } finally {
            setListLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view === 'list') {
            refreshCaseSummaries();
        }
    }, [view, refreshCaseSummaries]);

    // Fetch history when a person is selected
    const loadApplicantHistory = useCallback(async (id: string) => {
        setHistoryLoading(true);
        try {
            const data = await fetchApplicantHistory(id);
            setDbHistory(data);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view === 'history' && selectedPersonId) {
            loadApplicantHistory(selectedPersonId);
        }
    }, [view, selectedPersonId, loadApplicantHistory]);

    const handleLogout = () => {
        sessionStorage.removeItem('loggedInUser');
        sessionStorage.removeItem('navState');
        setLoggedInUser(null);
        setSelectedAppId(null);
        setSelectedPersonId(null);
        setView('home');
    };

    // ── Early returns for non-detail views ────────────────────────────────────

    if (!loggedInUser) {
        return (
            <LoginPage onLogin={(user) => {
                sessionStorage.setItem('loggedInUser', JSON.stringify(user));
                setLoggedInUser(user);
                setRole(user.roles[0]); // Default to first role
                setView('home');
            }} />
        );
    }

    if (view === 'home') {
        return (
            <HomePage
                username={loggedInUser.username}
                userRoles={loggedInUser.roles as Role[]}
                onNavigateToCases={() => setView('list')}
                onGoAudit={() => setView('audit')}
                onGoAdmin={() => setView('admin')}
                onNewApplication={() => setView('new_application')}
                onGoTemplates={() => setView('template_download')}
                onGoNotifications={() => setView('notification_manager')}
                onLogout={handleLogout}
            />
        );
    }

    if (view === 'new_application') {
        return (
            <NewApplicationPage
                username={loggedInUser.username}
                userAccount={loggedInUser.account}
                onBack={() => setView('home')}
                onGoHome={() => setView('home')}
                onLogout={handleLogout}
                onSubmitSuccess={(newCaseId) => {
                    // Navigate directly to the newly created detail mode
                    setSelectedAppId(newCaseId);
                    setViewedStage('admin_review');
                    setView('detail');
                }}
            />
        );
    }

    if (view === 'audit') {
        // Collect all audit logs from all active applications
        const allLogs = getCaseSummaries().flatMap(cs => {
            const active = getActiveApplication(cs.id);
            return active?.workflow?.auditLog ?? [];
        });
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
                <header className="bg-slate-900 text-white shadow-md">
                    <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0">W</div>
                            <h1
                                className="text-lg sm:text-xl font-bold tracking-tight cursor-pointer hover:text-blue-300 transition-colors truncate"
                                onClick={() => setView('home')}
                                title="返回首頁"
                            >萬美基金會補助管理系統</h1>
                        </div>
                        <button onClick={() => setView('home')} className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-blue-400 transition px-2 py-1.5 shrink-0">
                            <span className="text-base leading-none">←</span><span className="hidden sm:inline">返回首頁</span>
                        </button>
                    </div>
                </header>
                <main className="flex-1 container mx-auto px-6 py-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        系統操作紀錄
                    </h2>
                    <AuditLogViewer />
                </main>
            </div>
        );
    }

    if (view === 'admin') {
        return (
            <AdminPanel
                userRoles={loggedInUser.roles as Role[]}
                userId={loggedInUser.id}
                onBack={() => setView('home')}
            />
        );
    }

    if (view === 'template_download') {
        return (
            <TemplateDownloadPage
                userId={loggedInUser.id}
                onBack={() => setView('home')}
            />
        );
    }

    if (view === 'notification_manager') {
        return (
            <NotificationManager
                userId={loggedInUser.id}
                onBack={() => setView('home')}
            />
        );
    }

    if (view === 'list') {
        return (
            <CaseListPage
                username={loggedInUser.username}
                userRoles={loggedInUser.roles as Role[]}
                cases={dbCases}
                allOfficers={officerList}
                officersWithId={officersWithId}
                isLoading={listLoading}
                onMount={refreshCaseSummaries}
                onAssign={async (applicationIds, officerUserId) => {
                    const res = await assignOfficerBatch(applicationIds, officerUserId);
                    if (!res.success) throw new Error(res.error ?? '派案失敗');
                    await refreshCaseSummaries();
                }}
                onSelectCase={(personId) => {
                    setSelectedPersonId(personId);
                    setView('history');
                }}
                onLogout={handleLogout}
                onGoHome={() => setView('home')}
            />
        );
    }

    if (view === 'history') {
        const personName = selectedPersonId
            ? (dbCases.find(c => c.id === selectedPersonId)?.applicantName ?? 
               dbHistory[0]?.applicantName ?? '')
            : '';
        return (
            <ApplicantHistoryPage
                applicantName={personName}
                records={dbHistory}
                isLoading={historyLoading}
                username={loggedInUser.username}
                onSelectApplication={(record: ApplicationRecord) => {
                    setSelectedAppId(record.id);
                    // Reset viewed stage to the application's true stage
                    setViewedStage(record.stage);
                    setView('detail');
                }}
                onBack={() => setView('list')}
                onGoHome={() => setView('home')}
                onLogout={handleLogout}
            />
        );
    }

    // ── Detail / Workflow view ────────────────────────────────────────────────

    // Show spinner while loading DB data for detail view
    if (view === 'detail' && detailLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <LoadingSpinner />
            </div>
        );
    }

    // Determine stage: prefer DB-driven appDetail, fallback to legacy mock store
    const appEntry: ApplicationEntry | null = selectedAppId ? getApplicationById(selectedAppId) : null;

    // The true current stage — from DB if available, else from mock store
    const stage: WorkflowStage = appDetail
        ? (appDetail.stage as WorkflowStage)
        : (appEntry?.stage as WorkflowStage ?? 'admin_review');

    const workflow = appEntry?.workflow ?? null;
    const { documents = [], applicant = {} as any, auditLog = [] } = workflow ?? {};

    // Build qualification form initial values: DB data takes priority over mock store
    const qualificationInitialValues = appDetail && (
        appDetail.age != null ||
        appDetail.moveableProperty != null ||
        appDetail.immoveableProperty != null ||
        appDetail.annualIncome != null
    ) ? {
        type: appDetail.maritalStatus === '2' ? 'married' as const : 'single' as const,
        age: appDetail.age ?? 0,
        hasMinorChildren: appDetail.hasChildren ?? false,
        underageChildrenCount: appDetail.underageChildrenCount ?? undefined,
        annualIncome: appDetail.annualIncome ?? 0,
        movableAssets: appDetail.moveableProperty ?? 0,
        realEstateValue: appDetail.immoveableProperty ?? 0,
    } : applicant;
    const currentStageIndex = STAGES.indexOf(stage);

    // Viewed stage (for read-only browsing) — defaults to true stage
    const displayedStage: WorkflowStage = viewedStage ?? stage;
    const isViewingPastStep = displayedStage !== stage;


    // Use DB applicant name if available; fallback to mock store lookup
    const personName = appDetail?.applicantName
        ?? getCaseSummaries().find(c => c.id === appEntry?.applicantId)?.applicantName
        ?? '';

    const addLog = (action: string) => {
        const timestamp = new Date().toLocaleString();
        const newLog = [`[${timestamp}] [${role}] ${action}`, ...auditLog];
        updateApplicationWorkflow(selectedAppId!, { auditLog: newLog });
        refresh();
    };

    const handleDocumentChange = (id: string, status: DocumentStatus) => {
        const newDocs = documents.map(d => d.id === id ? { ...d, status } : d);
        updateApplicationWorkflow(selectedAppId!, { documents: newDocs });
        addLog(`更新文件 ${id} 狀態為 ${status}`);
    };

    const checkEligibilityAction = () => {
        // Use liveApplicantValues (from form) if available, fallback to store data
        const dataToCheck = liveApplicantValues ?? applicant;
        const result = checkEligibility(dataToCheck);
        setEligibilityCheck({ checked: true, eligible: result.isEligible, reasons: result.reasons });
        addLog(`執行資格判定: ${result.isEligible ? '符合' : '不符合'}`);
    };

    const handleSaveQualification = async () => {
        if (!selectedAppId) return;
        setIsSavingQualification(true);
        setSaveQualToast(null);
        try {
            // Use liveApplicantValues if available, otherwise fall back to DB-loaded values
            const v = liveApplicantValues ?? qualificationInitialValues;
            const result = await saveQualificationData(selectedAppId, {
                age:                    v?.age != null ? Number(v.age) : null,
                moveable_property:      v?.movableAssets != null ? Number(v.movableAssets) : null,
                immoveable_property:    v?.realEstateValue != null ? Number(v.realEstateValue) : null,
                annual_income:          v?.annualIncome != null ? Number(v.annualIncome) : null,
                marital_status:         v?.type === 'married' ? '2' : v?.type === 'single' ? '1' : null,
                has_children:           v?.hasMinorChildren ?? null,
                underage_children_count: v?.hasMinorChildren && v?.underageChildrenCount != null
                                            ? Number(v.underageChildrenCount) : null,
                apply_amount:           applyAmount != null ? Number(applyAmount) : null,
            });
            if (result.success) {
                addLog('儲存資格預審資料');
                setSaveQualToast({ type: 'success', msg: '資格預審資料已儲存' });
            } else {
                setSaveQualToast({ type: 'error', msg: result.error ?? '儲存失敗，請稍後再試' });
            }
        } catch {
            setSaveQualToast({ type: 'error', msg: '儲存失敗，請稍後再試' });
        } finally {
            setIsSavingQualification(false);
            setTimeout(() => setSaveQualToast(null), 3000);
        }
    };

    /**
     * Advance the TRUE workflow stage by one step with DB write.
     */
    const handleAdvanceStage = async () => {
        if (!selectedAppId) return;

        // ── 核銷結案 ──────────────────────────────────────────────────
        if (stage === 'reimbursement') {
            await closeCase(selectedAppId, loggedInUser?.id ?? null);
            addLog('核銷完成，案件結案');
            await loadAppDetail(selectedAppId);
            refresh();
            return;
        }

        if (currentStageIndex < STAGES.length - 1) {
            const next = STAGES[currentStageIndex + 1];

            // 從行政初審推進時，將資格預審資料寫入 applications
            if (stage === 'admin_review' && liveApplicantValues) {
                const v = liveApplicantValues;
                await saveQualificationData(selectedAppId, {
                    age:                    v.age != null ? Number(v.age) : null,
                    moveable_property:      v.movableAssets != null ? Number(v.movableAssets) : null,
                    immoveable_property:    v.realEstateValue != null ? Number(v.realEstateValue) : null,
                    annual_income:          v.annualIncome != null ? Number(v.annualIncome) : null,
                    marital_status:         v.type === 'married' ? '2' : v.type === 'single' ? '1' : null,
                    has_children:           v.hasMinorChildren ?? null,
                    underage_children_count: v.hasMinorChildren && v.underageChildrenCount != null
                                                ? Number(v.underageChildrenCount) : null,
                    apply_amount:           applyAmount != null ? Number(applyAmount) : null,
                });
            }

            // 董事審核：不通過 → 結案 (status='2')；通過 → 前進核銷 (status='3')
            if (stage === 'board_review') {
                if (!boardApproved) {
                    await closeCaseRejected(selectedAppId, boardOpinion, loggedInUser?.id ?? null);
                    addLog('董事審核未通過，案件結案');
                    await loadAppDetail(selectedAppId);
                    setViewedStage('board_review');
                    refresh();
                    return;
                }
                await saveBoardReviewData(selectedAppId, boardApprovedAmount, boardOpinion);
                addLog(`董事審核通過，通過金額 ${boardApprovedAmount.toLocaleString()} 元`);
            }

            await advanceWorkflowStage(
                selectedAppId,
                stage,
                next,
                loggedInUser?.id ?? null,
            );
            await loadAppDetail(selectedAppId);
            setViewedStage(next);
            addLog(`推進流程至 ${STAGE_LABEL_MAP[next]}`);
            refresh();
        }
    };

    /**
     * Retreat the TRUE workflow stage by one step (with confirmation) with DB write.
     */
    const handleRetreatStage = async () => {
        if (currentStageIndex > 0) {
            const prev = STAGES[currentStageIndex - 1];
            const confirmed = window.confirm(
                `確定要將流程退回至「${STAGE_LABEL_MAP[prev]}」嗎？\n此操作將使目前進度倒退，請謹慎操作。`
            );
            if (!confirmed) return;
            if (selectedAppId) {
                await retreatWorkflowStage(
                    selectedAppId,
                    prev,
                    loggedInUser?.id ?? null,
                );
                await loadAppDetail(selectedAppId);
            }
            setViewedStage(prev);
            addLog(`退回流程至 ${STAGE_LABEL_MAP[prev]}`);
            refresh();
        }
    };

    // Read-only when the user is browsing a step other than the current true stage
    const contentReadOnly = isViewingPastStep;

    const renderStageContent = () => {
        switch (displayedStage) {
            case 'admin_review':
                return (
                    <div className="space-y-6 relative">
                        {/* ── 上半部：資格預審 ── */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <ClipboardList className="w-5 h-5 text-blue-600" />
                                資格預審
                            </h3>
                            {/* 申請金額欄位 */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">申請金額</label>
                                <div className="relative max-w-xs">
                                    <input
                                        type="number"
                                        min={0}
                                        value={applyAmount}
                                        onChange={e => setApplyAmount(Number(e.target.value))}
                                        disabled={contentReadOnly || appDetail?.status === '2' || appDetail?.status === '4'}
                                        className={clsx(
                                            'block w-full rounded-md shadow-sm p-2 border pr-12',
                                            (contentReadOnly || appDetail?.status === '2' || appDetail?.status === '4')
                                                ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed'
                                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                        )}
                                    />
                                    <span className="absolute right-3 top-2 text-gray-400 text-sm">元</span>
                                </div>
                            </div>

                            <ApplicationForm
                                initialValues={qualificationInitialValues}
                                readOnly={contentReadOnly || (!hasPermission('board_member') && !hasPermission('admin') && (role === 'board_member' || role === 'accountant'))}
                                onValidation={(_isValid, values) => {
                                    setLiveApplicantValues(values);
                                    if (!contentReadOnly && JSON.stringify(values) !== JSON.stringify(applicant)) {
                                        updateApplicationWorkflow(selectedAppId!, { applicant: values });
                                        refresh();
                                    }
                                }}
                            />
                            {!contentReadOnly && (
                                <div className="mt-6 border-t pt-4 flex items-center gap-3 flex-wrap">
                                    <button
                                        onClick={checkEligibilityAction}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition flex items-center gap-2"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        執行資格判定
                                    </button>
                                    <button
                                        onClick={handleSaveQualification}
                                        disabled={isSavingQualification}
                                        className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isSavingQualification ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        儲存
                                    </button>
                                    {saveQualToast && (
                                        <span className={clsx(
                                            'text-sm font-medium px-3 py-1.5 rounded-md',
                                            saveQualToast.type === 'success'
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : 'bg-red-50 text-red-700 border border-red-200'
                                        )}>
                                            {saveQualToast.type === 'success' ? '✓ ' : '✗ '}{saveQualToast.msg}
                                        </span>
                                    )}
                                </div>
                            )}
                            {eligibilityCheck.checked && (
                                <div className={clsx('mt-4 p-4 rounded-md', eligibilityCheck.eligible ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800')}>
                                    <p className="font-bold flex items-center gap-2">
                                        {eligibilityCheck.eligible ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                        判定結果: {eligibilityCheck.eligible ? '符合資格' : '不符合資格'}
                                    </p>
                                    {!eligibilityCheck.eligible && (
                                        <ul className="list-disc list-inside mt-2 text-sm">
                                            {eligibilityCheck.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* ── 下半部：文件審核（申請類） ── */}
                        <ReviewList
                            applicationId={selectedAppId!}
                            caseNumber={appDetail?.caseNumber ?? ''}
                            phase="apply"
                            userId={loggedInUser?.id}
                            readOnly={contentReadOnly || (!hasPermission('case_officer') && !hasPermission('admin'))}
                            onRefresh={() => {
                                refresh();
                                if (selectedAppId) {
                                    fetchApplicationDocuments(selectedAppId).then(setDbDocs);
                                }
                            }}
                        />
                    </div>
                );

            case 'visit':
                return (
                    <div className="space-y-6 relative">
                        <HomeVisitForm
                            applicationId={selectedAppId!}
                            visitorUserId={loggedInUser?.id}
                            readOnly={contentReadOnly || (!hasPermission('social_worker') && !hasPermission('case_officer') && !hasPermission('admin'))}
                        />
                    </div>
                );

            case 'board_review': {
                const boardReadOnly = contentReadOnly || (!hasPermission('board_member') && !hasPermission('admin'));
                const dbApplyAmount = appDetail?.applyAmount ?? null;
                return (
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 relative space-y-6">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Gavel className="w-5 h-5 text-purple-600" />
                            董事審核
                        </h3>

                        {/* 1. 審核結果 toggle */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">審核結果</label>
                            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                                <button
                                    type="button"
                                    disabled={boardReadOnly}
                                    onClick={() => { setBoardApproved(true); }}
                                    className={clsx(
                                        'px-5 py-2 text-sm font-medium transition',
                                        boardApproved === true
                                            ? 'bg-green-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50',
                                        boardReadOnly && 'cursor-not-allowed opacity-60'
                                    )}
                                >
                                    審核通過
                                </button>
                                <button
                                    type="button"
                                    disabled={boardReadOnly}
                                    onClick={() => { setBoardApproved(false); setBoardApprovedAmount(0); }}
                                    className={clsx(
                                        'px-5 py-2 text-sm font-medium border-l border-gray-200 transition',
                                        boardApproved === false
                                            ? 'bg-red-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50',
                                        boardReadOnly && 'cursor-not-allowed opacity-60'
                                    )}
                                >
                                    審核未通過
                                </button>
                            </div>
                        </div>

                        {/* 2. 申請金額 (read-only from DB) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">申請金額</label>
                            <div className={clsx(
                                'w-full max-w-xs border rounded-md px-3 py-2 text-sm',
                                boardReadOnly
                                    ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                            )}>
                                {dbApplyAmount != null
                                    ? `NT$ ${dbApplyAmount.toLocaleString()}`
                                    : <span className="text-gray-400">—</span>}
                            </div>
                        </div>

                        {/* 3. 通過金額 (editable only when approved) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">通過金額</label>
                            <div className="relative max-w-xs">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">NT$</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={boardApproved ? boardApprovedAmount : 0}
                                    onChange={(e) => setBoardApprovedAmount(Number(e.target.value))}
                                    disabled={boardReadOnly || !boardApproved}
                                    className={clsx(
                                        'w-full border rounded-md pl-10 pr-3 py-2 text-sm',
                                        (!boardApproved || boardReadOnly)
                                            ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                            : 'border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                                    )}
                                />
                            </div>
                        </div>

                        {/* 4. 審核意見 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                審核意見 <span className="text-gray-400 font-normal">(至少 50 字)</span>
                            </label>
                            <textarea
                                className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                                placeholder="請輸入審核意見..."
                                value={boardOpinion}
                                onChange={(e) => setBoardOpinion(e.target.value)}
                                disabled={boardReadOnly}
                            />
                            <div className="text-right text-xs text-gray-500 mt-1">
                                {boardOpinion.length} / 50 字
                            </div>
                        </div>

                        {boardApproved === null && !boardReadOnly && (
                            <p className="text-xs text-amber-600">請先選擇審核結果</p>
                        )}
                    </div>
                );
            }

            case 'reimbursement':
                return (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-emerald-600" />
                                核銷撥款
                            </h3>
                            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg text-emerald-900 mb-2">
                                <span className="font-medium">撥款狀態</span>
                                <span className="bg-emerald-200 text-emerald-800 px-3 py-1 rounded-full text-sm font-bold">待撥款</span>
                            </div>
                        </div>
                        {/* 核銷類文件上傳 */}
                        <ReviewList
                            applicationId={selectedAppId!}
                            caseNumber={appDetail?.caseNumber ?? ''}
                            phase="reimbursement"
                            userId={loggedInUser?.id}
                            readOnly={contentReadOnly || (!hasPermission('accountant') && !hasPermission('case_officer') && !hasPermission('admin'))}
                            onRefresh={() => {
                                refresh();
                                if (selectedAppId) {
                                    fetchApplicationDocuments(selectedAppId).then(setDbDocs);
                                }
                            }}
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    const retreatLabel = currentStageIndex > 0 ? STAGE_LABEL_MAP[STAGES[currentStageIndex - 1]] : null;
    const advanceLabel = currentStageIndex < STAGES.length - 1 ? STAGE_LABEL_MAP[STAGES[currentStageIndex + 1]] : null;

    // Build a fake state object for Dashboard/DataExport compatibility
    const legacyState = {
        stage,
        documents,
        applicant,
        auditLog,
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col font-sans text-slate-800">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0">W</div>
                        <h1
                            className="text-lg sm:text-xl font-bold tracking-tight cursor-pointer hover:text-blue-300 transition-colors truncate"
                            onClick={() => setView('home')}
                            title="返回首頁"
                        >萬美基金會補助管理系統</h1>
                        <div className="hidden lg:flex items-center gap-1.5 text-xs text-green-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-600 ml-2 shrink-0">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                            <span>連線正常</span>
                            <span className="text-slate-400">&#183;</span>
                            <span>Encryption On</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="hidden md:block">
                            <DataExport state={legacyState} onLog={addLog} />
                        </div>
                        <div className="flex items-center gap-2 bg-slate-800 text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-700">
                            <UserCircle className="w-4 h-4 text-slate-400" />
                            <span className="text-xs sm:text-sm font-medium truncate max-w-[80px] sm:max-w-none">{loggedInUser.username}</span>
                        </div>
                        <RoleSwitcher 
                            currentRole={role} 
                            availableRoles={loggedInUser.roles} 
                            onChange={setRole} 
                        />
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-red-400 transition px-1 sm:px-2 py-1.5"
                            title="登出"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">登出</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col md:flex-row gap-6 md:gap-8 overflow-x-hidden">
                {/* Sidebar / Stepper */}
                <div className="w-full md:w-64 shrink-0 space-y-4">
                    <button
                        onClick={() => setView('history')}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition font-medium"
                    >
                        <span className="text-base leading-none">←</span>
                        返回歷史紀錄
                    </button>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">申請流程</h4>
                        <div className="space-y-1 relative">
                            <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gray-100 -z-10"></div>
                            {STAGES.map((s, idx) => {
                                const isCurrentTrue = s === stage;
                                const isViewing = s === displayedStage;
                                const isCompleted = idx < currentStageIndex;
                                const isFuture = idx > currentStageIndex;
                                return (
                                    <StepItem
                                        key={s}
                                        isCurrentTrue={isCurrentTrue}
                                        isViewing={isViewing}
                                        completed={isCompleted}
                                        isFuture={isFuture}
                                        label={STAGE_LABEL_MAP[s]}
                                        icon={STAGE_ICON_MAP[s]}
                                        onClick={() => { if (!isFuture) setViewedStage(s); }}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Notification block */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
                        <button
                            onClick={() => setShowNotifModal(true)}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                            <Send className="w-4 h-4" />
                            發送通知
                        </button>

                        {/* Notification log */}
                        {notifLogs.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">通知紀錄</p>
                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                    {notifLogs.map(log => (
                                        <div key={log.id} className={clsx(
                                            'rounded-lg px-3 py-2 text-xs border',
                                            log.status === 'sent'
                                                ? 'bg-green-50 border-green-100'
                                                : 'bg-red-50 border-red-100'
                                        )}>
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <span className={clsx(
                                                    'font-semibold',
                                                    log.status === 'sent' ? 'text-green-700' : 'text-red-700'
                                                )}>
                                                    {log.status === 'sent' ? '✓ 已發送' : '✗ 失敗'}
                                                </span>
                                                <span className="text-slate-400 shrink-0">
                                                    {log.sent_at?.slice(0, 16).replace('T', ' ')}
                                                </span>
                                            </div>
                                            {log.subject && (
                                                <p className="text-slate-600 truncate">{log.subject}</p>
                                            )}
                                            <p className="text-slate-400">
                                                收件人：{log.recipients.map(r => r.name).join('、')}
                                            </p>
                                            {log.sender_name && (
                                                <p className="text-slate-400">發送者：{log.sender_name}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 space-y-6 overflow-hidden">
                    <Dashboard
                        state={legacyState}
                        applicantName={personName}
                        dbAnnualIncome={appDetail?.annualIncome}
                        applyAmount={appDetail?.applyAmount ?? null}
                        approvedAmount={appDetail?.approvedAmount ?? null}
                    />

                    {/* 結案 banner */}
                    {(appDetail?.status === '2' || appDetail?.status === '4') && (
                        <div className={clsx(
                            'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border',
                            appDetail.status === '2'
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        )}>
                            <span className="text-base">
                                {appDetail.status === '2' ? '🔴' : '✅'}
                            </span>
                            <span>
                                {appDetail.status === '2'
                                    ? '此案件已結案（審核未通過），不可再繼續流程。'
                                    : '此案件已結案（核銷完成），補助流程已結束。'}
                            </span>
                        </div>
                    )}

                    {/* Read-only banner */}
                    {isViewingPastStep && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700">
                            <Eye className="w-4 h-4 shrink-0" />
                            <span>
                                您正在查看 <strong>{STAGE_LABEL_MAP[displayedStage]}</strong> 的資料（唯讀）。
                                目前實際進度為 <strong>{STAGE_LABEL_MAP[stage]}</strong>。
                            </span>
                            <button
                                onClick={() => setViewedStage(stage)}
                                className="ml-auto text-amber-600 underline hover:text-amber-800 font-medium whitespace-nowrap"
                            >
                                返回目前步驟
                            </button>
                        </div>
                    )}

                    <StageContainer stageKey={displayedStage}>
                        {renderStageContent()}
                    </StageContainer>

                    {/* Flow Controls */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
                            {isViewingPastStep && (
                                <p className="text-xs text-amber-500">請先返回目前步驟再操作流程</p>
                            )}
                            <div className="flex gap-2 items-center">
                                {(() => {
                                    const isClosed = appDetail?.status === '2' || appDetail?.status === '4';
                                    const retreatDisabled = currentStageIndex === 0 || isViewingPastStep || !!isClosed;
                                    const retreatTitle = isClosed ? '此案件已結案，不可退回'
                                        : isViewingPastStep ? '請先返回目前步驟再操作流程'
                                        : currentStageIndex === 0 ? '已是第一個步驟'
                                        : `確認後退回至「${retreatLabel}」`;
                                    return (
                                        <button
                                            onClick={handleRetreatStage}
                                            disabled={retreatDisabled}
                                            title={retreatTitle}
                                            className="flex flex-col items-center bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm"
                                        >
                                            <span>退回上一階段</span>
                                            {retreatLabel && !isViewingPastStep && !isClosed && currentStageIndex > 0 && (
                                                <span className="text-xs font-normal text-gray-400">→ {retreatLabel}</span>
                                            )}
                                        </button>
                                    );
                                })()}
                                {(() => {
                                    const isBoardReview  = stage === 'board_review';
                                    const isReimbursement = stage === 'reimbursement';
                                    const isClosed = appDetail?.status === '2' || appDetail?.status === '4';
                                    const boardIncomplete = isBoardReview && (boardApproved === null || boardOpinion.length < 50);
                                    const advanceDisabled = isClosed || isViewingPastStep || boardIncomplete;

                                    // 按鈕文字
                                    const btnLabel =
                                        isReimbursement ? '結案' :
                                        isBoardReview && boardApproved === false ? '結案' :
                                        '進入下一階段';

                                    const btnClass =
                                        (isReimbursement || (isBoardReview && boardApproved === false))
                                            ? 'flex flex-col items-center bg-red-700 text-white px-4 py-2 rounded-md hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm'
                                            : 'flex flex-col items-center bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm';

                                    const advanceTitle =
                                        isViewingPastStep ? '請先返回目前步驟再操作流程' :
                                        isClosed ? '此案件已結案' :
                                        boardIncomplete ? '請選擇審核結果並填寫至少 50 字審核意見' :
                                        isReimbursement ? '確認核銷完成並結案' :
                                        isBoardReview && boardApproved === false ? '確認董事審核未通過並結案' :
                                        `前進至「${advanceLabel}」`;

                                    return (
                                        <button
                                            onClick={handleAdvanceStage}
                                            disabled={advanceDisabled}
                                            title={advanceTitle}
                                            className={btnClass}
                                        >
                                            <span>{btnLabel}</span>
                                            {!isClosed && !isViewingPastStep && !isReimbursement && !(isBoardReview && boardApproved === false) && advanceLabel && (
                                                <span className="text-xs font-normal text-slate-400">→ {advanceLabel}</span>
                                            )}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                </div>
            </main>

            {/* Send Notification Modal */}
            {showNotifModal && selectedAppId && (
                <SendNotificationModal
                    applicationId={selectedAppId}
                    placeholderVars={{
                        案號: appDetail?.caseNumber ?? '',
                        申請人: personName,
                        階段: STAGE_LABEL_MAP[stage],
                        申請日期: appDetail?.applyAt ?? '',
                        申請金額: appDetail?.applyAmount != null ? `NT$ ${appDetail.applyAmount.toLocaleString()}` : '—',
                        承辦人: appDetail?.officerName ?? '',
                    }}
                    checklistDocs={dbDocs.map((d): ChecklistDoc => ({ id: d.id, label: d.label }))}
                    senderUserId={loggedInUser?.id ?? ''}
                    onClose={() => setShowNotifModal(false)}
                    onSent={() => {
                        setShowNotifModal(false);
                        loadNotifLogs(selectedAppId);
                    }}
                />
            )}
        </div>
    );
}

// ── StepItem component ────────────────────────────────────────────────────────

interface StepItemProps {
    isCurrentTrue: boolean;
    isViewing: boolean;
    completed: boolean;
    isFuture: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

function StepItem({ isCurrentTrue, isViewing, completed, isFuture, label, icon, onClick }: StepItemProps) {
    return (
        <button
            onClick={onClick}
            disabled={isFuture}
            title={isFuture ? '尚未到達此步驟' : undefined}
            className={clsx(
                'flex items-center gap-3 w-full p-2 rounded-lg transition-colors text-left',
                isFuture ? 'opacity-40 cursor-not-allowed'
                    : isViewing ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50 text-gray-600'
            )}
        >
            <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm transition-all',
                isViewing && isCurrentTrue ? 'bg-blue-600 scale-110'
                    : isViewing ? 'bg-amber-500 scale-110'
                        : isCurrentTrue ? 'bg-blue-600'
                            : completed ? 'bg-green-500'
                                : 'bg-gray-300'
            )}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <span className={clsx('text-sm font-medium block', isViewing && 'font-bold')}>{label}</span>
                {isCurrentTrue && <span className="text-xs text-blue-500 font-medium">進行中</span>}
                {!isCurrentTrue && isViewing && <span className="text-xs text-amber-500 font-medium">查看中</span>}
            </div>
        </button>
    );
}

export default App;
