import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronRight, FileText, UserCheck, AlertTriangle, ArrowUp, ArrowDown, Plus, X, RefreshCw, Lock } from 'lucide-react';
import { CaseSummary, Role, WorkflowStage } from '../types';
import { AppHeader } from './AppHeader';
import { DateInput } from './DateInput';
import { todayDateOnly } from '../lib/dateOnly';

interface OfficerOption { id: string; name: string; }

interface CaseListPageProps {
    username: string;
    userId: string;
    userRoles: Role[];
    cases: CaseSummary[];
    allOfficers: string[];
    officersWithId: OfficerOption[];
    isLoading?: boolean;
    pendingAlertIds?: Set<string>;
    /** Map of applicationId → reminderCount, only includes cases at/over threshold */
    thresholdReminderCounts?: Map<string, number>;
    /** 「輪到我處理」案件 id 集合（user feedback #12） */
    myTurnAppIds?: Set<string>;
    /** 「輪到我處理」filter 開關 */
    myTurnFilterActive?: boolean;
    onToggleMyTurnFilter?: (v: boolean) => void;
    /** 「未補件」filter 開關（從首頁未補件 modal 點進來自動勾起） */
    pendingOnlyActive?: boolean;
    onTogglePendingOnly?: (v: boolean) => void;
    /** 「未派案」filter 開關（從首頁未派案 modal 點進來自動勾起） */
    unassignedFilterActive?: boolean;
    onToggleUnassignedFilter?: (v: boolean) => void;
    /** 各子類型補助上限（依 115 辦法）：'1'=經濟弱勢、'2'=小康家庭。每張 case 依 subsidySubtype 取對應值 */
    subtypeMaxAmounts?: Record<'1' | '2', number>;
    onMount?: () => void;
    onAssign: (applicationIds: string[], officerUserId: string) => Promise<void>;
    onSelectCase: (caseId: string) => void;
    onLogout: () => void;
    onGoHome: () => void;
}

const ASSIGN_ROLES: Role[] = ['supervisor', 'board_member', 'admin'];

const STAGE_LABELS: Record<WorkflowStage, string> = {
    admin_review: '行政初審',
    visit: '家庭訪視',
    board_review: '董事審核',
    reimbursement: '核銷撥款',
};

const STAGE_COLORS: Record<WorkflowStage, string> = {
    admin_review: 'bg-yellow-100 text-yellow-700',
    visit: 'bg-indigo-100 text-indigo-700',
    board_review: 'bg-purple-100 text-purple-700',
    reimbursement: 'bg-green-100 text-green-700',
};

const SUBSIDY_SUBTYPE_LABEL: Record<'1' | '2', string> = {
    '1': '經濟弱勢',
    '2': '小康家庭',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    '1': { label: '審核中', className: 'bg-blue-100 text-blue-700' },
    '2': { label: '結案（未通過）', className: 'bg-rose-100 text-rose-700' },
    '3': { label: '待核銷', className: 'bg-amber-100 text-amber-700' },
    '4': { label: '結案（通過）', className: 'bg-emerald-100 text-emerald-700' },
    '5': { label: '結案（通過）', className: 'bg-emerald-100 text-emerald-700' },
};

function getCurrentYearRange(): { first: string; last: string } {
    const year = todayDateOnly().slice(0, 4);
    return {
        first: `${year}-01-01`,
        last:  `${year}-12-31`,
    };
}

type SortKey = 'appliedAt' | 'pending' | 'totalAmount' | 'applicantName' | 'applicationCount' | 'remaining' | 'stage' | 'officer';
type SortDir = 'asc' | 'desc';
interface SortEntry { key: SortKey; dir: SortDir; }

const SORT_LABELS: Record<SortKey, string> = {
    appliedAt:        '申請時間',
    pending:          '缺件狀態',
    totalAmount:      '累積金額',
    applicantName:    '申請人姓名',
    applicationCount: '申請次數',
    remaining:        '剩餘金額',
    stage:            '當前流程',
    officer:          '經辦人',
};

const DEFAULT_SORT: SortEntry[] = [
    { key: 'appliedAt',   dir: 'asc' },
    { key: 'pending',     dir: 'asc' },
    { key: 'totalAmount', dir: 'asc' },
];

export function getSpecialAttentionTooltipPosition(
    anchor: { left: number; top: number },
    viewportWidth: number,
    viewportHeight: number,
) {
    return {
        left: Math.max(8, Math.min(anchor.left, viewportWidth - 336)),
        bottom: viewportHeight - anchor.top + 4,
    };
}

export function CaseListPage({
    username, userId, userRoles, cases, allOfficers, officersWithId,
    isLoading, pendingAlertIds = new Set(), thresholdReminderCounts = new Map(),
    myTurnAppIds = new Set<string>(), myTurnFilterActive = false, onToggleMyTurnFilter,
    pendingOnlyActive, onTogglePendingOnly,
    unassignedFilterActive, onToggleUnassignedFilter,
    subtypeMaxAmounts = { '1': 30000, '2': 350000 },
    onMount, onAssign, onSelectCase, onLogout, onGoHome,
}: CaseListPageProps) {
    const { first, last } = getCurrentYearRange();

    const canAssign = userRoles.some(r => ASSIGN_ROLES.includes(r));

    // Role-based filter restrictions
    const isOfficer   = userRoles.includes('case_officer') && !canAssign;
    const lockAssign  = userRoles.includes('accountant') || userRoles.includes('volunteer');
    const lockOfficer = false;

    // 🐛 DEBUG
    console.log('[CaseListPage roles debug]', {
        userRoles, canAssign, isOfficer, lockAssign, lockOfficer,
    });

    useEffect(() => { onMount?.(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const [nameQuery,      setNameQuery]      = useState<string>('');
    /** #24: 當 nameQuery 為身分證格式時，server-side 查到的 applicant id（null = 未查或查無此人） */
    const [idMatchApplicantId, setIdMatchApplicantId] = useState<string | null>(null);
    useEffect(() => {
        const q = nameQuery.trim().toUpperCase();
        if (!/^[A-Z]\d{9}$/.test(q)) { setIdMatchApplicantId(null); return; }
        let cancelled = false;
        import('../app/actions/applicationActions').then(async m => {
            const r = await m.findApplicantIdByIdNumber(q);
            if (!cancelled) setIdMatchApplicantId(r);
        });
        return () => { cancelled = true; };
    }, [nameQuery]);
    const [dateFrom,       setDateFrom]       = useState<string>(first);
    const [dateTo,         setDateTo]         = useState<string>(last);
    const [stageFilter,    setStageFilter]    = useState<WorkflowStage | ''>('');
    const [officerFilter,  setOfficerFilter]  = useState<string>('');
    const [assignFilter,   setAssignFilter]   = useState<'all' | 'unassigned' | 'assigned'>('all');
    const [pendingOnly,    setPendingOnly]    = useState<boolean>(false);
    const [specialAttentionOnly, setSpecialAttentionOnly] = useState<boolean>(false);
    const [specialAttentionTooltip, setSpecialAttentionTooltip] = useState<{ note: string; left: number; bottom: number } | null>(null);
    // 從外部（首頁 modal）打開時自動勾起未補件 filter
    useEffect(() => {
        if (pendingOnlyActive !== undefined) setPendingOnly(pendingOnlyActive);
    }, [pendingOnlyActive]);
    // 從外部（首頁 modal）打開時自動勾起未派案 filter（assignFilter='unassigned'）
    useEffect(() => {
        if (unassignedFilterActive === true) setAssignFilter('unassigned');
        else if (unassignedFilterActive === false) setAssignFilter('all');
    }, [unassignedFilterActive]);
    const [thresholdOnly,  setThresholdOnly]  = useState<boolean>(false);
    const [boardUnassignedOnly, setBoardUnassignedOnly] = useState<boolean>(false);
    const [batchAssignResult, setBatchAssignResult] = useState<string | null>(null);
    const [batchAssignBusy, setBatchAssignBusy] = useState(false);

    const isChairmanOrAdminView = userRoles.includes('admin') || userRoles.includes('chairman' as Role);

    // Sort conditions (min 3)
    const [sortStack, setSortStack] = useState<SortEntry[]>(DEFAULT_SORT);

    const updateSort = (idx: number, patch: Partial<SortEntry>) =>
        setSortStack(prev => {
            // If changing key and the new key is already used elsewhere, swap
            if (patch.key !== undefined) {
                const conflictIdx = prev.findIndex((e, i) => i !== idx && e.key === patch.key);
                if (conflictIdx !== -1) {
                    const next = [...prev];
                    const oldKey = next[idx].key;
                    next[idx] = { ...next[idx], ...patch };
                    next[conflictIdx] = { ...next[conflictIdx], key: oldKey };
                    return next;
                }
            }
            return prev.map((e, i) => i === idx ? { ...e, ...patch } : e);
        });

    const removeSort = (idx: number) =>
        setSortStack(prev => prev.length > 3 ? prev.filter((_, i) => i !== idx) : prev);

    const addSort = () =>
        setSortStack(prev => {
            const used = new Set(prev.map(e => e.key));
            const next = (Object.keys(SORT_LABELS) as SortKey[]).find(k => !used.has(k));
            return next ? [...prev, { key: next, dir: 'asc' }] : prev;
        });

    // Effective filter values — locked roles override user-selected values
    const effectiveOfficerFilter = lockOfficer ? username : officerFilter;
    const effectiveAssignFilter  = lockAssign  ? 'assigned' : assignFilter;

    // Batch selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [assignOfficerId, setAssignOfficerId] = useState<string>('');
    const [assigning, setAssigning] = useState(false);
    const [assignError, setAssignError] = useState('');

    const showSpecialAttentionTooltip = (event: React.MouseEvent<HTMLSpanElement>, note: string) => {
        const position = getSpecialAttentionTooltipPosition(
            event.currentTarget.getBoundingClientRect(),
            window.innerWidth,
            window.innerHeight,
        );
        setSpecialAttentionTooltip({ note, ...position });
    };

    // Clear selection when filter changes
    useEffect(() => { setSelectedIds(new Set()); }, [nameQuery, dateFrom, dateTo, stageFilter, officerFilter, assignFilter, pendingOnly, specialAttentionOnly, thresholdOnly]);

    const filteredCases = useMemo(() => {
        return cases.filter((c) => {
            if (nameQuery) {
                const q = nameQuery.trim();
                const looksLikeId = /^[A-Za-z]\d{9}$/.test(q);
                if (looksLikeId) {
                    if (!idMatchApplicantId || String(c.id) !== String(idMatchApplicantId)) return false;
                } else {
                    const inName = c.applicantName.includes(q);
                    const inPhone = !!c.applicantPhone && c.applicantPhone.includes(q);
                    if (!inName && !inPhone) return false;
                }
            }
            if (stageFilter && c.stage !== stageFilter) return false;
            if (effectiveOfficerFilter && c.officer !== effectiveOfficerFilter) return false;
            if (dateFrom && c.appliedAt < dateFrom) return false;
            if (dateTo && c.appliedAt > dateTo) return false;
            if (effectiveAssignFilter === 'unassigned' && c.officerId !== null) return false;
            if (effectiveAssignFilter === 'assigned'   && c.officerId === null) return false;
            if (pendingOnly && !pendingAlertIds.has(c.applicationId)) return false;
            if (specialAttentionOnly && !c.hasSpecialAttention) return false;
            if (thresholdOnly && !thresholdReminderCounts.has(c.applicationId)) return false;
            if (myTurnFilterActive && !myTurnAppIds.has(c.applicationId)) return false;
            if (boardUnassignedOnly) {
                if (c.stage !== 'board_review') return false;
                if (c.assignedBoardGroupId) return false;
            }
            return true;
        }).sort((a, b) => {
            for (const { key, dir } of sortStack) {
                const d = dir === 'asc' ? 1 : -1;
                let cmp = 0;
                switch (key) {
                    case 'appliedAt':        cmp = a.appliedAt.localeCompare(b.appliedAt); break;
                    case 'pending':          cmp = (pendingAlertIds.has(a.applicationId) ? 1 : 0) - (pendingAlertIds.has(b.applicationId) ? 1 : 0); break;
                    case 'totalAmount':      cmp = (a.totalAmount ?? 0) - (b.totalAmount ?? 0); break;
                    case 'applicantName':    cmp = a.applicantName.localeCompare(b.applicantName, 'zh-TW'); break;
                    case 'applicationCount': cmp = (a.applicationCount ?? 0) - (b.applicationCount ?? 0); break;
                    case 'remaining': {
                        const maxA = subtypeMaxAmounts[a.subsidySubtype as '1' | '2'] ?? Math.max(subtypeMaxAmounts['1'], subtypeMaxAmounts['2']);
                        const maxB = subtypeMaxAmounts[b.subsidySubtype as '1' | '2'] ?? Math.max(subtypeMaxAmounts['1'], subtypeMaxAmounts['2']);
                        cmp = (maxA - (a.totalAmount ?? 0)) - (maxB - (b.totalAmount ?? 0));
                        break;
                    }
                    case 'stage':            cmp = a.stage.localeCompare(b.stage); break;
                    case 'officer':          cmp = (a.officer ?? '').localeCompare(b.officer ?? '', 'zh-TW'); break;
                }
                if (cmp !== 0) return d * cmp;
            }
            return 0;
        });
    }, [cases, nameQuery, idMatchApplicantId, stageFilter, effectiveOfficerFilter, dateFrom, dateTo, effectiveAssignFilter, pendingOnly, pendingAlertIds, specialAttentionOnly, thresholdOnly, thresholdReminderCounts, myTurnFilterActive, myTurnAppIds, boardUnassignedOnly, sortStack, subtypeMaxAmounts]);

    const allFilteredSelected = filteredCases.length > 0 &&
        filteredCases.every(c => selectedIds.has(c.applicationId));

    const toggleSelectAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredCases.map(c => c.applicationId)));
        }
    };

    const toggleOne = (appId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(appId) ? next.delete(appId) : next.add(appId);
            return next;
        });
    };

    const handleAssign = async () => {
        if (!assignOfficerId) { setAssignError('請選擇承辦人'); return; }
        setAssigning(true);
        setAssignError('');
        try {
            await onAssign(Array.from(selectedIds), assignOfficerId);
            setSelectedIds(new Set());
            setAssignOfficerId('');
        } catch (e: any) {
            setAssignError(e.message ?? '派案失敗');
        } finally {
            setAssigning(false);
        }
    };

    const colSpan = canAssign ? 12 : 11;

    const [refreshing, setRefreshing] = useState(false);
    const handleRefresh = async () => {
        if (!onMount) return;
        setRefreshing(true);
        try { await onMount(); } finally { setRefreshing(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800 pb-24">
            {/* Header */}
            <AppHeader username={username} onGoHome={onGoHome} onLogout={onLogout} />

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 space-y-6 overflow-x-hidden">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-600" />
                        申請案件管理
                    </h2>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || isLoading}
                        className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-lg transition disabled:opacity-50 shadow-sm"
                        title="重新載入最新資料"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing || isLoading ? 'animate-spin' : ''}`} />
                        重新整理
                    </button>
                </div>

                {/* Filter Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                        {/* Name search */}
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">姓名 / 電話 / 身分證</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={nameQuery}
                                    onChange={(e) => setNameQuery(e.target.value)}
                                    placeholder="姓名 / 電話 / 身分證..."
                                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Date range */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">申請時間</label>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                <DateInput value={dateFrom} onChange={setDateFrom}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                <span className="text-gray-400 text-sm shrink-0 hidden sm:inline">至</span>
                                <DateInput value={dateTo} onChange={setDateTo}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                            </div>
                        </div>

                        {/* Stage dropdown */}
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">當前申請流程</label>
                            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as WorkflowStage | '')}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                                <option value="">全部流程</option>
                                {(Object.entries(STAGE_LABELS) as [WorkflowStage, string][]).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Officer dropdown */}
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                                經辦人{lockOfficer && <span className="ml-1 text-orange-400">（鎖定）</span>}
                            </label>
                            <select
                                value={effectiveOfficerFilter}
                                onChange={(e) => setOfficerFilter(e.target.value)}
                                disabled={lockOfficer}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                <option value="">全部經辦人</option>
                                {allOfficers.map((o) => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </select>
                        </div>

                        {/* Assignment status */}
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                                派案狀態{lockAssign && <span className="ml-1 text-orange-400">（鎖定）</span>}
                            </label>
                            <select
                                value={effectiveAssignFilter}
                                onChange={(e) => setAssignFilter(e.target.value as typeof assignFilter)}
                                disabled={lockAssign}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                <option value="all">全部</option>
                                <option value="unassigned">未派案</option>
                                <option value="assigned">已派案</option>
                            </select>
                        </div>

                        {cases.some(c => c.hasSpecialAttention) && (
                            <div className="sm:col-span-1 flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer select-none w-full border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 hover:bg-amber-100 transition">
                                    <input
                                        type="checkbox"
                                        checked={specialAttentionOnly}
                                        onChange={e => setSpecialAttentionOnly(e.target.checked)}
                                        className="w-4 h-4 accent-amber-600"
                                    />
                                    <span className="text-sm font-medium text-amber-800 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        僅特殊注意
                                    </span>
                                </label>
                            </div>
                        )}

                        {/* Pending doc filter — only shown when there are alerts */}
                        {pendingAlertIds.size > 0 && (
                            <div className="sm:col-span-1 flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer select-none w-full border border-orange-200 bg-orange-50 rounded-lg px-3 py-2 hover:bg-orange-100 transition">
                                    <input
                                        type="checkbox"
                                        checked={pendingOnly}
                                        onChange={e => { setPendingOnly(e.target.checked); onTogglePendingOnly?.(e.target.checked); }}
                                        className="w-4 h-4 accent-orange-500"
                                    />
                                    <span className="text-sm font-medium text-orange-700 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        僅顯示未補件
                                        <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                                            {pendingAlertIds.size}
                                        </span>
                                    </span>
                                </label>
                            </div>
                        )}

                        {/* Board-review unassigned filter (chairman/admin only) */}
                        {isChairmanOrAdminView && (
                            <div className="sm:col-span-1 flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer select-none w-full border border-purple-200 bg-purple-50 rounded-lg px-3 py-2 hover:bg-purple-100 transition">
                                    <input
                                        type="checkbox"
                                        checked={boardUnassignedOnly}
                                        onChange={e => setBoardUnassignedOnly(e.target.checked)}
                                        className="w-4 h-4 accent-purple-500"
                                    />
                                    <span className="text-sm font-medium text-purple-700">
                                        僅顯示未派案的董事審核案件
                                    </span>
                                </label>
                            </div>
                        )}

                        {/* 「輪到我處理」filter — user feedback #12 */}
                        {myTurnAppIds.size > 0 && (
                            <div className="sm:col-span-1 flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer select-none w-full border border-indigo-200 bg-indigo-50 rounded-lg px-3 py-2 hover:bg-indigo-100 transition">
                                    <input
                                        type="checkbox"
                                        checked={myTurnFilterActive}
                                        onChange={e => onToggleMyTurnFilter?.(e.target.checked)}
                                        className="w-4 h-4 accent-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-indigo-700 flex items-center gap-1">
                                        僅顯示輪到我處理
                                        <span className="ml-1 bg-indigo-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                                            {myTurnAppIds.size}
                                        </span>
                                    </span>
                                </label>
                            </div>
                        )}

                        {/* Threshold-reached filter */}
                        {thresholdReminderCounts.size > 0 && (
                            <div className="sm:col-span-1 flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer select-none w-full border border-red-200 bg-red-50 rounded-lg px-3 py-2 hover:bg-red-100 transition">
                                    <input
                                        type="checkbox"
                                        checked={thresholdOnly}
                                        onChange={e => setThresholdOnly(e.target.checked)}
                                        className="w-4 h-4 accent-red-500"
                                    />
                                    <span className="text-sm font-medium text-red-700 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        已達補件提醒門檻
                                        <span className="ml-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                                            {thresholdReminderCounts.size}
                                        </span>
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sort conditions editor */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">排序條件</span>
                        <button
                            onClick={addSort}
                            disabled={sortStack.length >= Object.keys(SORT_LABELS).length}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-30 disabled:cursor-not-allowed transition font-medium"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            新增條件
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {sortStack.map((entry, idx) => {
                            const isFixed = idx < 3;
                            return (
                                <div key={idx} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                                    {/* Priority badge */}
                                    <span className="text-[11px] font-bold text-gray-400 w-4 text-center shrink-0">
                                        {idx + 1}
                                    </span>
                                    {/* Field selector */}
                                    <select
                                        value={entry.key}
                                        onChange={e => updateSort(idx, { key: e.target.value as SortKey })}
                                        className="text-xs border-0 bg-transparent text-slate-700 font-medium focus:outline-none focus:ring-0 cursor-pointer pr-1"
                                    >
                                        {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([k, label]) => (
                                            <option key={k} value={k}>{label}</option>
                                        ))}
                                    </select>
                                    {/* Asc / Desc toggle */}
                                    <button
                                        onClick={() => updateSort(idx, { dir: entry.dir === 'asc' ? 'desc' : 'asc' })}
                                        className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-blue-600 transition px-1 py-0.5 rounded hover:bg-blue-50"
                                        title={entry.dir === 'asc' ? '升冪（點擊切換）' : '降冪（點擊切換）'}
                                    >
                                        {entry.dir === 'asc'
                                            ? <><ArrowUp className="w-3 h-3" /><span>升冪</span></>
                                            : <><ArrowDown className="w-3 h-3" /><span>降冪</span></>}
                                    </button>
                                    {/* Remove (only non-fixed rows) */}
                                    {!isFixed && (
                                        <button
                                            onClick={() => removeSort(idx)}
                                            className="text-gray-300 hover:text-red-400 transition ml-0.5"
                                            title="移除此條件"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Result count */}
                <div className="flex justify-end">
                    <span className="text-sm text-slate-500">
                        共 <span className="font-semibold text-slate-700">{filteredCases.length}</span> 筆結果
                        {canAssign && selectedIds.size > 0 && (
                            <span className="ml-2 text-blue-600 font-semibold">（已勾選 {selectedIds.size} 筆）</span>
                        )}
                    </span>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm min-w-[1080px] lg:min-w-0">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                {canAssign && (
                                    <th className="py-3 px-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={allFilteredSelected}
                                            onChange={toggleSelectAll}
                                            disabled={filteredCases.length === 0}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </th>
                                )}
                                <Th>案件編號</Th>
                                <Th>子類別</Th>
                                <Th>申請人姓名</Th>
                                <Th>申請次數</Th>
                                <ThCenter>累積金額</ThCenter>
                                <ThCenter>剩餘金額</ThCenter>
                                <Th>申請時間</Th>
                                <Th>當前申請流程</Th>
                                <Th>案件狀態</Th>
                                <Th>經辦人</Th>
                                <th className="py-3 px-4 w-10" />
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={colSpan} className="text-center py-16 text-gray-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p>正在載入資料庫資料...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCases.length === 0 ? (
                                <tr>
                                    <td colSpan={colSpan} className="text-center py-16 text-gray-400">
                                        <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                        <p>查無符合條件的資料</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredCases.map((c, idx) => {
                                    const isMyTurnCase = myTurnAppIds.has(c.applicationId);
                                    const isOwnOfficerCase = String(c.officerId ?? '') === String(userId);
                                    const canOpenCase = !isOfficer || isOwnOfficerCase || isMyTurnCase;
                                    return (
                                        <CaseRow
                                            key={c.applicationId}
                                            case={c}
                                            isLast={idx === filteredCases.length - 1}
                                            canAssign={canAssign}
                                            canOpen={canOpenCase}
                                            lockReason="非此案承辦人，僅可查看列表基礎資料"
                                            selected={selectedIds.has(c.applicationId)}
                                            isPending={pendingAlertIds.has(c.applicationId)}
                                            thresholdReminderCount={thresholdReminderCounts.get(c.applicationId) ?? 0}
                                            maxApplyAmount={subtypeMaxAmounts[c.subsidySubtype as '1' | '2']
                                                ?? Math.max(subtypeMaxAmounts['1'], subtypeMaxAmounts['2'])}
                                            onToggle={() => toggleOne(c.applicationId)}
                                            onClick={() => onSelectCase(c.id)}
                                            onSpecialAttentionEnter={showSpecialAttentionTooltip}
                                            onSpecialAttentionLeave={() => setSpecialAttentionTooltip(null)}
                                        />
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Board-review batch auto-assign bar (chairman/admin with filter on) */}
            {isChairmanOrAdminView && boardUnassignedOnly && selectedIds.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-purple-200 shadow-xl px-4 sm:px-6 py-4">
                    <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2 text-purple-700 font-semibold shrink-0">
                            <UserCheck className="w-5 h-5" />
                            <span>批次董事派案（已選 {selectedIds.size} 筆）</span>
                        </div>
                        {batchAssignResult && <span className="text-sm text-slate-600">{batchAssignResult}</span>}
                        <div className="flex-1" />
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => { setSelectedIds(new Set()); setBatchAssignResult(null); }}
                                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                取消
                            </button>
                            <button
                                disabled={batchAssignBusy}
                                onClick={async () => {
                                    setBatchAssignBusy(true);
                                    setBatchAssignResult(null);
                                    const ids = Array.from(selectedIds);
                                    const { batchAutoAssignCases } = await import('../app/actions/boardGroupActions');
                                    const res = await batchAutoAssignCases(ids, userId);
                                    setBatchAssignBusy(false);
                                    setBatchAssignResult(`成功 ${res.success} / 失敗 ${res.failed}`);
                                    // Reload cases to reflect new assignment badges
                                    onMount?.();
                                    setSelectedIds(new Set());
                                }}
                                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 cursor-pointer"
                            >
                                {batchAssignBusy ? '處理中…' : '批次自動派案'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch assignment bar */}
            {canAssign && selectedIds.size > 0 && !boardUnassignedOnly && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-blue-200 shadow-xl px-4 sm:px-6 py-4">
                    <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2 text-blue-700 font-semibold shrink-0">
                            <UserCheck className="w-5 h-5" />
                            <span>批次派案（已選 {selectedIds.size} 筆）</span>
                        </div>
                        <div className="flex flex-1 items-center gap-3 flex-wrap">
                            <select
                                value={assignOfficerId}
                                onChange={e => { setAssignOfficerId(e.target.value); setAssignError(''); }}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
                            >
                                <option value="">── 選擇承辦人 ──</option>
                                {officersWithId.map(o => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                            </select>
                            {assignError && <span className="text-red-500 text-sm">{assignError}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => { setSelectedIds(new Set()); setAssignOfficerId(''); setAssignError(''); }}
                                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleAssign}
                                disabled={assigning}
                                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-60 flex items-center gap-2"
                            >
                                {assigning && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                {assigning ? '派案中…' : '確認派案'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {specialAttentionTooltip && createPortal(
                <div
                    role="tooltip"
                    className="pointer-events-none fixed z-[60] w-max max-w-xs whitespace-pre-wrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs text-white shadow-lg"
                    style={{ left: specialAttentionTooltip.left, bottom: specialAttentionTooltip.bottom }}
                >
                    {specialAttentionTooltip.note}
                </div>,
                document.body,
            )}
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {children}
        </th>
    );
}

function ThCenter({ children }: { children: React.ReactNode }) {
    return (
        <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {children}
        </th>
    );
}

function CaseRow({
    case: c, isLast, canAssign, canOpen, lockReason, selected, isPending, thresholdReminderCount, maxApplyAmount, onToggle, onClick, onSpecialAttentionEnter, onSpecialAttentionLeave,
}: {
    case: CaseSummary; isLast: boolean;
    canAssign: boolean; canOpen: boolean; lockReason: string; selected: boolean; isPending: boolean;
    thresholdReminderCount: number;
    maxApplyAmount: number;
    onToggle: () => void; onClick: () => void;
    onSpecialAttentionEnter: (event: React.MouseEvent<HTMLSpanElement>, note: string) => void;
    onSpecialAttentionLeave: () => void;
}) {
    const remaining = maxApplyAmount - (c.totalAmount ?? 0);
    const handleClick = () => {
        if (canOpen) onClick();
    };
    const cellCursor = canOpen ? 'cursor-pointer' : 'cursor-not-allowed';
    const rowTone = selected
        ? 'bg-blue-50'
        : isPending
            ? (canOpen ? 'bg-orange-50 hover:bg-orange-100' : 'bg-orange-50/60')
            : (canOpen ? 'hover:bg-blue-50' : 'bg-slate-50/70');
    return (
        <tr className={`transition-colors group ${!isLast ? 'border-b border-gray-100' : ''} ${rowTone}`} title={canOpen ? undefined : lockReason}>
            {canAssign && (
                <td className="py-3.5 px-4" onClick={e => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={onToggle}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                </td>
            )}
            <td className={`py-3.5 px-4 font-mono text-xs text-slate-500 ${cellCursor} whitespace-nowrap`} onClick={handleClick}>
                {c.caseNumber || <span className="text-slate-300">—</span>}
            </td>
            <td className={`py-3.5 px-4 ${cellCursor}`} onClick={handleClick}>
                {c.subsidySubtype ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {SUBSIDY_SUBTYPE_LABEL[c.subsidySubtype]}
                    </span>
                ) : (
                    <span className="text-slate-300">—</span>
                )}
            </td>
            <td className={`py-3.5 px-4 font-medium text-slate-800 transition-colors ${canOpen ? 'group-hover:text-blue-700 cursor-pointer' : 'cursor-not-allowed'}`} onClick={handleClick}>
                <span className="flex items-center gap-2">
                    {c.applicantName}
                    {c.hasSpecialAttention && (
                        <span
                            className="inline-flex shrink-0"
                            onMouseEnter={event => c.specialAttentionNote && onSpecialAttentionEnter(event, c.specialAttentionNote)}
                            onMouseLeave={onSpecialAttentionLeave}
                        >
                            <span className="inline-flex items-center gap-0.5 text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded-full px-1.5 py-0.5 font-medium">
                                <AlertTriangle className="w-3 h-3" />特殊注意
                            </span>
                        </span>
                    )}
                    {isPending && (
                        <span className="inline-flex items-center gap-0.5 text-xs bg-orange-100 text-orange-600 border border-orange-200 rounded-full px-1.5 py-0.5 font-medium shrink-0">
                            <AlertTriangle className="w-3 h-3" />未補件
                        </span>
                    )}
                    {thresholdReminderCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs bg-red-100 text-red-700 border border-red-300 rounded-full px-1.5 py-0.5 font-medium shrink-0" title="已達補件提醒次數門檻，建議結案">
                            <AlertTriangle className="w-3 h-3" />已提醒 {thresholdReminderCount} 次
                        </span>
                    )}
                </span>
            </td>
            <td className={`py-3.5 px-4 text-center ${cellCursor}`} onClick={handleClick}>
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                    {c.applicationCount}
                </span>
            </td>
            <td className={`py-3.5 px-4 text-center text-sm font-medium text-emerald-700 ${cellCursor}`} onClick={handleClick}>
                {c.totalAmount > 0 ? `$${c.totalAmount.toLocaleString()}` : <span className="text-slate-400">—</span>}
            </td>
            <td className={`py-3.5 px-4 text-center text-sm font-medium ${cellCursor}`} onClick={handleClick}>
                {remaining > 0
                    ? <span className="text-blue-700">${remaining.toLocaleString()}</span>
                    : <span className="text-red-500">${remaining.toLocaleString()}</span>}
            </td>
            <td className={`py-3.5 px-4 text-gray-500 ${cellCursor}`} onClick={handleClick}>{c.appliedAt}</td>
            <td className={`py-3.5 px-4 ${cellCursor}`} onClick={handleClick}>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[c.stage]}`}>
                    {STAGE_LABELS[c.stage]}
                </span>
            </td>
            <td className={`py-3.5 px-4 ${cellCursor}`} onClick={handleClick}>
                {(() => {
                    const badge = STATUS_BADGE[c.statusCode ?? '1'] ?? STATUS_BADGE['1'];
                    return (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                            {c.isEarlyClosed ? '中途結案（通過）' : badge.label}
                        </span>
                    );
                })()}
            </td>
            <td className={`py-3.5 px-4 ${cellCursor}`} onClick={handleClick}>
                {c.officerId
                    ? <span className="text-gray-600">{c.officer}</span>
                    : <span className="text-orange-500 font-medium">未派案</span>}
            </td>
            <td className={`py-3.5 px-4 text-right ${cellCursor}`} onClick={handleClick}>
                {canOpen ? (
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors inline" />
                ) : (
                    <Lock className="w-4 h-4 text-slate-300 inline" />
                )}
            </td>
        </tr>
    );
}
