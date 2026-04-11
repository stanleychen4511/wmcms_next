import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronRight, FileText, ArrowUpDown, UserCircle, LogOut, UserCheck } from 'lucide-react';
import { CaseSummary, Role, WorkflowStage } from '../types';

interface OfficerOption { id: string; name: string; }

interface CaseListPageProps {
    username: string;
    userRoles: Role[];
    cases: CaseSummary[];
    allOfficers: string[];
    officersWithId: OfficerOption[];
    isLoading?: boolean;
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

function getMonthRange(): { first: string; last: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
        first: `${y}-${pad(m + 1)}-01`,
        last:  `${y}-${pad(m + 1)}-${pad(lastDay)}`,
    };
}

const FILTER_STORAGE_KEY = 'caseListFilters';

function loadSavedFilters() {
    try {
        const raw = localStorage.getItem(FILTER_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
}

export function CaseListPage({
    username, userRoles, cases, allOfficers, officersWithId,
    isLoading, onMount, onAssign, onSelectCase, onLogout, onGoHome,
}: CaseListPageProps) {
    const { first, last } = getMonthRange();
    const saved = loadSavedFilters();

    const canAssign = userRoles.some(r => ASSIGN_ROLES.includes(r));

    // Role-based filter restrictions
    const isOfficer   = userRoles.includes('case_officer') && !canAssign;
    const lockAssign  = isOfficer || userRoles.includes('accountant') || userRoles.includes('volunteer');
    const lockOfficer = isOfficer;

    useEffect(() => { onMount?.(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const [nameQuery,      setNameQuery]      = useState<string>(saved?.nameQuery      ?? '');
    const [dateFrom,       setDateFrom]       = useState<string>(saved?.dateFrom       ?? first);
    const [dateTo,         setDateTo]         = useState<string>(saved?.dateTo         ?? last);
    const [stageFilter,    setStageFilter]    = useState<WorkflowStage | ''>(saved?.stageFilter    ?? '');
    const [officerFilter,  setOfficerFilter]  = useState<string>(saved?.officerFilter  ?? '');
    const [assignFilter,   setAssignFilter]   = useState<'all' | 'unassigned' | 'assigned'>(saved?.assignFilter ?? 'all');

    // Effective filter values — locked roles override user-selected values
    const effectiveOfficerFilter = lockOfficer ? username : officerFilter;
    const effectiveAssignFilter  = lockAssign  ? 'assigned' : assignFilter;

    // Batch selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [assignOfficerId, setAssignOfficerId] = useState<string>('');
    const [assigning, setAssigning] = useState(false);
    const [assignError, setAssignError] = useState('');

    useEffect(() => {
        try {
            localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
                nameQuery, dateFrom, dateTo, stageFilter, officerFilter, assignFilter,
            }));
        } catch { /* ignore */ }
    }, [nameQuery, dateFrom, dateTo, stageFilter, officerFilter, assignFilter]);

    // Clear selection when filter changes
    useEffect(() => { setSelectedIds(new Set()); }, [nameQuery, dateFrom, dateTo, stageFilter, officerFilter, assignFilter]);

    const filteredCases = useMemo(() => {
        return cases.filter((c) => {
            if (nameQuery && !c.applicantName.includes(nameQuery)) return false;
            if (stageFilter && c.stage !== stageFilter) return false;
            if (effectiveOfficerFilter && c.officer !== effectiveOfficerFilter) return false;
            if (dateFrom && c.appliedAt < dateFrom) return false;
            if (dateTo && c.appliedAt > dateTo) return false;
            if (effectiveAssignFilter === 'unassigned' && c.officerId !== null) return false;
            if (effectiveAssignFilter === 'assigned'   && c.officerId === null) return false;
            return true;
        });
    }, [cases, nameQuery, stageFilter, effectiveOfficerFilter, dateFrom, dateTo, effectiveAssignFilter]);

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

    const colSpan = canAssign ? 9 : 8;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800 pb-24">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0">W</div>
                        <h1
                            className="text-lg sm:text-xl font-bold tracking-tight cursor-pointer hover:text-blue-300 transition-colors truncate"
                            onClick={onGoHome}
                            title="返回首頁"
                        >萬美基金會補助管理系統</h1>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className="flex items-center gap-2 bg-slate-800 text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-700">
                            <UserCircle className="w-4 h-4 text-slate-400" />
                            <span className="text-xs sm:text-sm font-medium truncate max-w-[80px] sm:max-w-none">{username}</span>
                        </div>
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-red-400 transition px-1 sm:px-2 py-1.5"
                            title="登出"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">登出</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 space-y-6 overflow-x-hidden">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-600" />
                        申請人資料查詢
                    </h2>
                </div>

                {/* Filter Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                        {/* Name search */}
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">申請人姓名</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={nameQuery}
                                    onChange={(e) => setNameQuery(e.target.value)}
                                    placeholder="搜尋姓名..."
                                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Date range */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">申請時間</label>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                <span className="text-gray-400 text-sm shrink-0 hidden sm:inline">至</span>
                                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
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
                    <table className="w-full text-sm min-w-[860px] lg:min-w-0">
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
                                <Th>申請人姓名</Th>
                                <Th>申請次數</Th>
                                <ThCenter>累積金額</ThCenter>
                                <ThCenter>剩餘金額</ThCenter>
                                <Th>申請時間</Th>
                                <Th>當前申請流程</Th>
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
                                filteredCases.map((c, idx) => (
                                    <CaseRow
                                        key={c.id}
                                        case={c}
                                        isLast={idx === filteredCases.length - 1}
                                        canAssign={canAssign}
                                        selected={selectedIds.has(c.applicationId)}
                                        onToggle={() => toggleOne(c.applicationId)}
                                        onClick={() => onSelectCase(c.id)}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Batch assignment bar */}
            {canAssign && selectedIds.size > 0 && (
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
        </div>
    );
}

function ThCenter({ children }: { children: React.ReactNode }) {
    return (
        <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <span className="flex items-center justify-center gap-1">
                {children}
                <ArrowUpDown className="w-3 h-3 opacity-40" />
            </span>
        </th>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <span className="flex items-center gap-1">
                {children}
                <ArrowUpDown className="w-3 h-3 opacity-40" />
            </span>
        </th>
    );
}

function CaseRow({
    case: c, isLast, canAssign, selected, onToggle, onClick,
}: {
    case: CaseSummary; isLast: boolean;
    canAssign: boolean; selected: boolean;
    onToggle: () => void; onClick: () => void;
}) {
    const remaining = 350000 - (c.totalAmount ?? 0);
    return (
        <tr className={`transition-colors group ${!isLast ? 'border-b border-gray-100' : ''} ${selected ? 'bg-blue-50' : 'hover:bg-blue-50'}`}>
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
            <td className="py-3.5 px-4 font-medium text-slate-800 group-hover:text-blue-700 transition-colors cursor-pointer" onClick={onClick}>
                {c.applicantName}
            </td>
            <td className="py-3.5 px-4 text-center cursor-pointer" onClick={onClick}>
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                    {c.applicationCount}
                </span>
            </td>
            <td className="py-3.5 px-4 text-center text-sm font-medium text-emerald-700 cursor-pointer" onClick={onClick}>
                {c.totalAmount > 0 ? `$${c.totalAmount.toLocaleString()}` : <span className="text-slate-400">—</span>}
            </td>
            <td className="py-3.5 px-4 text-center text-sm font-medium cursor-pointer" onClick={onClick}>
                {remaining > 0
                    ? <span className="text-blue-700">${remaining.toLocaleString()}</span>
                    : <span className="text-red-500">${remaining.toLocaleString()}</span>}
            </td>
            <td className="py-3.5 px-4 text-gray-500 cursor-pointer" onClick={onClick}>{c.appliedAt}</td>
            <td className="py-3.5 px-4 cursor-pointer" onClick={onClick}>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[c.stage]}`}>
                    {STAGE_LABELS[c.stage]}
                </span>
            </td>
            <td className="py-3.5 px-4 cursor-pointer" onClick={onClick}>
                {c.officerId
                    ? <span className="text-gray-600">{c.officer}</span>
                    : <span className="text-orange-500 font-medium">未派案</span>}
            </td>
            <td className="py-3.5 px-4 text-right cursor-pointer" onClick={onClick}>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors inline" />
            </td>
        </tr>
    );
}
