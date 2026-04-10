import { ChevronRight, FileText, ArrowLeft, UserCircle, LogOut, Clock, CheckCircle, XCircle } from 'lucide-react';
import { ApplicationRecord, WorkflowStage } from '../types';

interface ApplicantHistoryPageProps {
    applicantName: string;
    records: ApplicationRecord[];
    isLoading?: boolean;
    username: string;
    onSelectApplication: (record: ApplicationRecord) => void;
    onBack: () => void;
    onGoHome: () => void;
    onLogout: () => void;
}

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

export function ApplicantHistoryPage({
    applicantName,
    records,
    isLoading,
    username,
    onSelectApplication,
    onBack,
    onGoHome,
    onLogout,
}: ApplicantHistoryPageProps) {
    const sortedRecords = [...records].sort(
        (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
    );
    const totalApproved = records
        .filter((r) => r.status === 'closed' && r.amount)
        .reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const activeRecord = records.find((r) => r.status === 'active') ?? null;

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
                        >
                            萬美基金會補助管理系統
                        </h1>
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
                {/* Back + title */}
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition font-medium mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        返回查詢列表
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-600" />
                        歷史申請紀錄 — {applicantName}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        共 {records.length} 筆申請，歷史核准累積金額：
                        {totalApproved > 0 ? (
                            <span className="text-emerald-600 font-semibold ml-1">${totalApproved.toLocaleString()}</span>
                        ) : (
                            <span className="text-slate-400 ml-1">—</span>
                        )}
                    </p>
                </div>

                {/* Active application banner */}
                {activeRecord && (
                    <div
                        className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-blue-100 transition group"
                        onClick={() => onSelectApplication(activeRecord)}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="font-semibold text-blue-800">目前進行中的申請</p>
                                <p className="text-sm text-blue-600">
                                    申請日期 {activeRecord.appliedAt}・目前進度：
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ml-1 ${STAGE_COLORS[activeRecord.stage]}`}>
                                        {STAGE_LABELS[activeRecord.stage]}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition" />
                    </div>
                )}

                {/* History table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 min-w-[700px] lg:min-w-0">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">申請紀錄一覽</h3>
                    </div>
                    <table className="w-full text-sm min-w-[700px] lg:min-w-0">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">申請日期</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">最終流程</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">經辦人</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">狀態</th>
                                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">核准金額</th>
                                <th className="py-3 px-4 w-10" />
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-gray-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p>正在從資料庫同步紀錄...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : sortedRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-gray-400">
                                        <p>尚無申請紀錄</p>
                                    </td>
                                </tr>
                            ) : (
                                sortedRecords.map((rec, idx) => {
                                    const isActive = rec.status === 'active';
                                    const isLast = idx === sortedRecords.length - 1;
                                    return (
                                        <tr
                                            key={rec.id}
                                            onClick={isActive ? () => onSelectApplication(rec) : undefined}
                                            className={[
                                                'transition-colors',
                                                !isLast ? 'border-b border-gray-50' : '',
                                                isActive ? 'cursor-pointer hover:bg-blue-50 group' : 'opacity-70',
                                            ].join(' ')}
                                        >
                                            <td className="py-3.5 px-4 text-gray-700 font-medium">{rec.appliedAt}</td>
                                            <td className="py-3.5 px-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[rec.stage]}`}>
                                                    {STAGE_LABELS[rec.stage]}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-600">{rec.officer}</td>
                                            <td className="py-3.5 px-4">
                                                {isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                                        <Clock className="w-3 h-3" />
                                                        進行中
                                                    </span>
                                                ) : rec.closedReason === '核准補助' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                        <CheckCircle className="w-3 h-3" />
                                                        {rec.closedReason}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                                                        <XCircle className="w-3 h-3" />
                                                        {rec.closedReason ?? '結案'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-medium">
                                                {rec.amount ? (
                                                    <span className="text-emerald-700">${rec.amount.toLocaleString()}</span>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                {isActive && (
                                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors inline" />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
