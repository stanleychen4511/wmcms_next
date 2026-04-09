import { useState, useMemo } from 'react';
import { Search, ChevronRight, FileText, ArrowUpDown, UserCircle, LogOut } from 'lucide-react';
import { CaseSummary, WorkflowStage } from '../types';

interface CaseListPageProps {
    username: string;
    cases: CaseSummary[];
    allOfficers: string[];
    isLoading?: boolean;
    onSelectCase: (caseId: string) => void;
    onLogout: () => void;
    onGoHome: () => void;
}

const STAGE_LABELS: Record<WorkflowStage, string> = {
    application: '申請收件',
    admin_review: '行政初審',
    visit: '家庭訪視',
    board_review: '董事審核',
    reimbursement: '核銷撥款',
};

const STAGE_COLORS: Record<WorkflowStage, string> = {
    application: 'bg-blue-100 text-blue-700',
    admin_review: 'bg-yellow-100 text-yellow-700',
    visit: 'bg-indigo-100 text-indigo-700',
    board_review: 'bg-purple-100 text-purple-700',
    reimbursement: 'bg-green-100 text-green-700',
};

export function CaseListPage({ username, cases, allOfficers, isLoading, onSelectCase, onLogout, onGoHome }: CaseListPageProps) {
    const [nameQuery, setNameQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stageFilter, setStageFilter] = useState<WorkflowStage | ''>('');
    const [officerFilter, setOfficerFilter] = useState(''); // Default to All


    const filteredCases = useMemo(() => {
        return cases.filter((c) => {
            if (nameQuery && !c.applicantName.includes(nameQuery)) return false;
            if (stageFilter && c.stage !== stageFilter) return false;
            if (officerFilter && c.officer !== officerFilter) return false;
            if (dateFrom && c.appliedAt < dateFrom) return false;
            if (dateTo && c.appliedAt > dateTo) return false;
            return true;
        });
    }, [nameQuery, stageFilter, officerFilter, dateFrom, dateTo]);


    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
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
                {/* Page title */}
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-600" />
                        申請人資料查詢
                    </h2>
                </div>

                {/* Filter Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <span className="text-gray-400 text-sm shrink-0 hidden sm:inline">至</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Stage dropdown */}
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">當前申請流程</label>
                            <select
                                value={stageFilter}
                                onChange={(e) => setStageFilter(e.target.value as WorkflowStage | '')}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                                <option value="" className="text-black">全部流程</option>
                                {(Object.entries(STAGE_LABELS) as [WorkflowStage, string][]).map(([val, label]) => (
                                    <option key={val} value={val} className="text-black">{label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Officer dropdown */}
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">經辦人</label>
                            <select
                                value={officerFilter}
                                onChange={(e) => setOfficerFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                                <option value="" className="text-black">全部經辦人</option>
                                {allOfficers.map((o) => (
                                    <option key={o} value={o} className="text-black">{o}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Result count */}
                <div className="flex justify-end">
                    <span className="text-sm text-slate-500">
                        共 <span className="font-semibold text-slate-700">{filteredCases.length}</span> 筆結果
                    </span>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm min-w-[800px] lg:min-w-0">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <Th>申請人姓名</Th>
                                <Th>申請次數</Th>
                                <Th>累積金額</Th>
                                <Th>申請時間</Th>
                                <Th>當前申請流程</Th>
                                <Th>經辦人</Th>
                                <th className="py-3 px-4 w-10" />
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-gray-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p>正在載入資料庫資料...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCases.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-gray-400">
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
                                        onClick={() => onSelectCase(c.id)}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
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

function CaseRow({ case: c, isLast, onClick }: { case: CaseSummary; isLast: boolean; onClick: () => void }) {
    return (
        <tr
            onClick={onClick}
            className={`cursor-pointer hover:bg-blue-50 transition-colors group ${!isLast ? 'border-b border-gray-100' : ''}`}
        >
            <td className="py-3.5 px-4 font-medium text-slate-800 group-hover:text-blue-700 transition-colors">
                {c.applicantName}
            </td>
            <td className="py-3.5 px-4 text-center">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                    {c.applicationCount}
                </span>
            </td>
            <td className="py-3.5 px-4 text-right text-sm font-medium text-emerald-700">
                {c.totalAmount > 0
                    ? `$${c.totalAmount.toLocaleString()}`
                    : <span className="text-slate-400">—</span>}
            </td>
            <td className="py-3.5 px-4 text-gray-500">{c.appliedAt}</td>
            <td className="py-3.5 px-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[c.stage]}`}>
                    {STAGE_LABELS[c.stage]}
                </span>
            </td>
            <td className="py-3.5 px-4 text-gray-600">{c.officer}</td>
            <td className="py-3.5 px-4 text-right">
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors inline" />
            </td>
        </tr>
    );
}
