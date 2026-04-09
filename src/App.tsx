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
} from 'lucide-react';
import { RoleSwitcher } from './components/RoleSwitcher';
import { LoginPage } from './components/LoginPage';
import { HomePage } from './components/HomePage';
import { CaseListPage } from './components/CaseListPage';
import { ApplicantHistoryPage } from './components/ApplicantHistoryPage';
import { NewApplicationPage } from './components/NewApplicationPage';
import { ReviewList } from './components/ReviewList';
import { HomeVisitForm } from './components/HomeVisitForm';
import { NotificationModalTrigger } from './components/NotificationModal';
import { ApplicationForm } from './components/ApplicationForm';
import { StageContainer } from './components/StageContainer';
import { Dashboard } from './components/Dashboard';
import { DataExport } from './components/DataExport';
import { AuditLogViewer } from './components/AuditLogViewer';
import { AdminPanel } from './components/AdminPanel';

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
    ApplicationDetail,
} from './app/actions/workflowActions';

import {
    fetchCaseSummaries,
    fetchApplicantHistory
} from './app/actions/applicationActions';

import { fetchCaseOfficers } from './app/actions/userActions';

import { STATUS_TO_STAGE, STAGE_TO_STATUS } from './lib/stageMaps';

import { LoadingSpinner } from './components/LoadingSpinner';
import { CaseSummary, ApplicationRecord, WorkflowStage, Role, DocumentStatus } from './types';
import { checkEligibility } from './utils/eligibility';
import { clsx } from 'clsx';

// ── Stage metadata ────────────────────────────────────────────────────────────

const STAGES: WorkflowStage[] = ['application', 'admin_review', 'visit', 'board_review', 'reimbursement'];

const STAGE_LABEL_MAP: Record<WorkflowStage, string> = {
    application: '申請收件',
    admin_review: '行政初審',
    visit: '家庭訪視',
    board_review: '董事審選',
    reimbursement: '核銷撥款',
};

const STAGE_ICON_MAP: Record<WorkflowStage, React.ReactNode> = {
    application: <ClipboardList className="w-4 h-4" />,
    admin_review: <UserCheck className="w-4 h-4" />,
    visit: <Home className="w-4 h-4" />,
    board_review: <Gavel className="w-4 h-4" />,
    reimbursement: <CreditCard className="w-4 h-4" />,
};

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
    const [role, setRole] = useState<Role>('case_officer');
    const [loggedInUser, setLoggedInUser] = useState<{ username: string; roles: Role[]; account: string; id: string } | null>(null);

    useEffect(() => {
        try {
            const saved = sessionStorage.getItem('loggedInUser');
            if (saved) {
                const user = JSON.parse(saved);
                setLoggedInUser(user);
                setRole(user.roles[0]);
            }
        } catch { /* ignore */ }
    }, []);
    const [view, setView] = useState<'home' | 'list' | 'history' | 'detail' | 'audit' | 'new_application' | 'admin'>('home');

    // Force re-render when store data changes
    const [_tick, setTick] = useState(0);
    const refresh = () => setTick(t => t + 1);

    // Person-level selection (for history page)
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

    // Application-level selection (for detail/workflow page)
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

    // DB-driven application detail (loaded when entering detail view)
    const [appDetail, setAppDetail] = useState<ApplicationDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const loadAppDetail = useCallback(async (id: string) => {
        setDetailLoading(true);
        try {
            const detail = await fetchApplicationDetail(id);
            setAppDetail(detail);
            if (detail) setViewedStage(detail.stage as WorkflowStage);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view === 'detail' && selectedAppId) {
            loadAppDetail(selectedAppId);
        }
    }, [view, selectedAppId, loadAppDetail]);

    // Viewed stage for read-only browsing (separate from true stage)
    const [viewedStage, setViewedStage] = useState<WorkflowStage | null>(null);

    // Board opinion - kept local
    const [boardOpinion, setBoardOpinion] = useState('');
    const [eligibilityCheck, setEligibilityCheck] = useState<{ checked: boolean; eligible: boolean; reasons: string[] }>({
        checked: false, eligible: false, reasons: [],
    });
    // Tracks the latest values from the ApplicationForm for use in eligibility check
    const [liveApplicantValues, setLiveApplicantValues] = useState<any>(null);
    const [isSavingQualification, setIsSavingQualification] = useState(false);

    // DB state for inquiry pages
    const [dbCases, setDbCases] = useState<CaseSummary[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [dbHistory, setDbHistory] = useState<ApplicationRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [officerList, setOfficerList] = useState<string[]>([]);

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
            
            // Also fetch officer list for filtering
            const oList = await fetchCaseOfficers();
            setOfficerList(oList);
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
        setLoggedInUser(null);
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
                    setViewedStage('application');
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
                    <AuditLogViewer logs={allLogs} className="h-[calc(100vh-220px)]" />
                </main>
            </div>
        );
    }

    if (view === 'admin') {
        return (
            <AdminPanel 
                userRoles={loggedInUser.roles as Role[]} 
                onBack={() => setView('home')} 
            />
        );
    }

    if (view === 'list') {
        return (
            <CaseListPage
                username={loggedInUser.username}
                cases={dbCases}
                allOfficers={officerList}
                isLoading={listLoading}
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
        : (appEntry?.stage as WorkflowStage ?? 'application');

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
        if (!selectedAppId || !liveApplicantValues) return;
        setIsSavingQualification(true);
        try {
            const v = liveApplicantValues;
            const result = await saveQualificationData(selectedAppId, {
                age:                    v.age != null ? Number(v.age) : null,
                moveable_property:      v.movableAssets != null ? Number(v.movableAssets) : null,
                immoveable_property:    v.realEstateValue != null ? Number(v.realEstateValue) : null,
                annual_income:          v.annualIncome != null ? Number(v.annualIncome) : null,
                marital_status:         v.type === 'married' ? '2' : v.type === 'single' ? '1' : null,
                has_children:           v.hasMinorChildren ?? null,
                underage_children_count: v.hasMinorChildren && v.underageChildrenCount != null
                                            ? Number(v.underageChildrenCount) : null,
            });
            if (result.success) {
                addLog('儲存資格預審資料');
            }
        } finally {
            setIsSavingQualification(false);
        }
    };

    /**
     * Advance the TRUE workflow stage by one step with DB write.
     */
    const handleAdvanceStage = async () => {
        if (currentStageIndex < STAGES.length - 1) {
            const next = STAGES[currentStageIndex + 1];
            if (selectedAppId) {
                // 從申請收件推進時，將資格預審資料寫入 applications
                if (stage === 'application' && liveApplicantValues) {
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
                    });
                }
                await advanceWorkflowStage(
                    selectedAppId,
                    stage,
                    next,
                    loggedInUser?.id ?? null,
                );
                await loadAppDetail(selectedAppId);
            }
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
            case 'application':
                return (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 relative">

                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <ClipboardList className="w-5 h-5 text-blue-600" />
                                資格預審
                            </h3>
                            <ApplicationForm
                                initialValues={qualificationInitialValues}
                                readOnly={contentReadOnly || (!hasPermission('board_member') && !hasPermission('admin') && (role === 'board_member' || role === 'accountant'))}
                                onValidation={(_isValid, values) => {
                                    // Always track the latest form values for eligibility check
                                    setLiveApplicantValues(values);
                                    // Also sync to mock store if content is editable
                                    if (!contentReadOnly && JSON.stringify(values) !== JSON.stringify(applicant)) {
                                        updateApplicationWorkflow(selectedAppId!, { applicant: values });
                                        refresh();
                                    }
                                }}
                            />
                            {!contentReadOnly && (
                                <div className="mt-6 border-t pt-4 flex items-center gap-3">
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
                    </div>
                );

            case 'admin_review':
                return (
                    <div className="space-y-6 relative">
                        <ReviewList
                            applicationId={selectedAppId!}
                            caseNumber={appDetail?.caseNumber ?? ''}
                            readOnly={contentReadOnly || (!hasPermission('case_officer') && !hasPermission('admin'))}
                            onRefresh={refresh}
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

            case 'board_review':
                return (
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 relative">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Gavel className="w-5 h-5 text-purple-600" />
                            董事審核
                        </h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                審核意見 (至少 50 字)
                            </label>
                            <textarea
                                className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="請輸入審核意見..."
                                value={boardOpinion}
                                onChange={(e) => setBoardOpinion(e.target.value)}
                                disabled={contentReadOnly || (!hasPermission('board_member') && !hasPermission('admin'))}
                            />
                            <div className="text-right text-xs text-gray-500 mt-1">
                                目前的字數: {boardOpinion.length} / 50
                            </div>
                        </div>
                        {!contentReadOnly && (hasPermission('board_member') || hasPermission('admin')) && (
                            <div className="flex gap-3">
                                <button
                                    disabled={boardOpinion.length < 50}
                                    className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => addLog('董事核決: 通過')}
                                >
                                    核決通過
                                </button>
                                <button
                                    className="flex-1 bg-red-600 text-white py-2 rounded-md hover:bg-red-700"
                                    onClick={() => addLog('董事核決: 退回')}
                                >
                                    退回重審
                                </button>
                            </div>
                        )}
                    </div>
                );

            case 'reimbursement':
                return (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-emerald-600" />
                                核銷撥款
                            </h3>
                            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg text-emerald-900">
                                <span className="font-medium">撥款狀態</span>
                                <span className="bg-emerald-200 text-emerald-800 px-3 py-1 rounded-full text-sm font-bold">待撥款</span>
                            </div>
                        </div>
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

                    {/* Standalone Notification Button */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex justify-center">
                        <NotificationModalTrigger
                            applicantName={personName}
                            stageName={STAGE_LABEL_MAP[stage]}
                            onSend={(channels, message) => {
                                alert(`已發送通知至: ${channels.join(', ')}${message ? `\n內容: ${message}` : ''}`);
                                addLog(`發送通知至: ${channels.join(', ')}`);
                            }}
                        />
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 space-y-6 overflow-hidden">
                    <Dashboard state={legacyState} applicantName={personName} />

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
                                <button
                                    onClick={handleRetreatStage}
                                    disabled={currentStageIndex === 0 || isViewingPastStep}
                                    title={isViewingPastStep ? '請先返回目前步驟再操作流程' : currentStageIndex === 0 ? '已是第一個步驟' : `確認後退回至「${retreatLabel}」`}
                                    className="flex flex-col items-center bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm"
                                >
                                    <span>退回上一階段</span>
                                    {retreatLabel && !isViewingPastStep && currentStageIndex > 0 && (
                                        <span className="text-xs font-normal text-gray-400">→ {retreatLabel}</span>
                                    )}
                                </button>
                                <button
                                    onClick={handleAdvanceStage}
                                    disabled={currentStageIndex === STAGES.length - 1 || isViewingPastStep}
                                    title={isViewingPastStep ? '請先返回目前步驟再操作流程' : currentStageIndex === STAGES.length - 1 ? '已是最後一個步驟' : `前進至「${advanceLabel}」`}
                                    className="flex flex-col items-center bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm"
                                >
                                    <span>進入下一階段</span>
                                    {advanceLabel && !isViewingPastStep && currentStageIndex < STAGES.length - 1 && (
                                        <span className="text-xs font-normal text-slate-400">→ {advanceLabel}</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
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
