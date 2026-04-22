import { useState, useEffect, useCallback } from 'react';
import {
    ChevronRight, FileText, ArrowLeft, Clock, CheckCircle, XCircle,
    Heart, Plus, Pencil, Trash2, ExternalLink, Loader2,
} from 'lucide-react';
import { ApplicationRecord, WorkflowStage } from '../types';
import { AppHeader } from './AppHeader';
import { CareRecordModal } from './CareRecordModal';
import {
    fetchCareRecordsByApplicant,
    deleteCareRecord,
    type CareRecord,
} from '../app/actions/careRecordActions';

interface ApplicantHistoryPageProps {
    applicantName: string;
    applicantUserId: string | null;
    records: ApplicationRecord[];
    isLoading?: boolean;
    username: string;
    userRoles: string[];
    loggedInUserId: string;
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

type Tab = 'applications' | 'care';

export function ApplicantHistoryPage({
    applicantName,
    applicantUserId,
    records,
    isLoading,
    username,
    userRoles,
    loggedInUserId,
    onSelectApplication,
    onBack,
    onGoHome,
    onLogout,
}: ApplicantHistoryPageProps) {
    const [activeTab, setActiveTab] = useState<Tab>('applications');

    // 角色判定（依 spec）
    const canViewCare = ['volunteer', 'social_worker', 'admin', 'supervisor'].some(r => userRoles.includes(r));
    const canCreateCare = ['volunteer', 'social_worker'].some(r => userRoles.includes(r));
    const isAdmin = userRoles.includes('admin');

    const sortedRecords = [...records].sort(
        (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
    );
    const totalApproved = records
        .filter((r) => r.amount != null && r.amount > 0)
        .reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const activeRecord = records.find((r) => r.status === 'active') ?? null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            <AppHeader username={username} onGoHome={onGoHome} onLogout={onLogout} />

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 space-y-6 overflow-x-hidden">
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

                {/* Tab switcher — 只有能看關懷紀錄的角色才會看到第二個 tab */}
                {canViewCare && (
                    <div className="border-b border-slate-200 -mb-2">
                        <div className="flex gap-1">
                            <TabButton active={activeTab === 'applications'} onClick={() => setActiveTab('applications')}>
                                <FileText className="w-4 h-4" />
                                申請紀錄
                            </TabButton>
                            <TabButton active={activeTab === 'care'} onClick={() => setActiveTab('care')}>
                                <Heart className="w-4 h-4" />
                                關懷紀錄
                            </TabButton>
                        </div>
                    </div>
                )}

                {activeTab === 'applications' && (
                    <ApplicationsSection
                        activeRecord={activeRecord}
                        sortedRecords={sortedRecords}
                        isLoading={isLoading}
                        onSelectApplication={onSelectApplication}
                    />
                )}

                {activeTab === 'care' && canViewCare && (
                    <CareSection
                        applicantUserId={applicantUserId}
                        applicantName={applicantName}
                        loggedInUserId={loggedInUserId}
                        canCreate={canCreateCare}
                        isAdmin={isAdmin}
                    />
                )}
            </main>
        </div>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition border-b-2 -mb-px',
                active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
            ].join(' ')}
        >
            {children}
        </button>
    );
}

// ─── 申請紀錄分頁（保留原本內容） ───────────────────────────────────────

interface AppsSectionProps {
    activeRecord: ApplicationRecord | null;
    sortedRecords: ApplicationRecord[];
    isLoading?: boolean;
    onSelectApplication: (record: ApplicationRecord) => void;
}

function ApplicationsSection({ activeRecord, sortedRecords, isLoading, onSelectApplication }: AppsSectionProps) {
    return (
        <>
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
                                const isCompleted = rec.status === 'closed' && rec.closedReason === '核銷完成';
                                const isClickable = isActive || isCompleted;
                                const isLast = idx === sortedRecords.length - 1;
                                return (
                                    <tr
                                        key={rec.id}
                                        onClick={isClickable ? () => onSelectApplication(rec) : undefined}
                                        className={[
                                            'transition-colors',
                                            !isLast ? 'border-b border-gray-50' : '',
                                            isActive ? 'cursor-pointer hover:bg-blue-50 group' : '',
                                            isCompleted ? 'cursor-pointer hover:bg-gray-50 group opacity-80' : '',
                                            !isClickable ? 'opacity-60' : '',
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
                                            {isClickable && (
                                                <ChevronRight className={`w-4 h-4 transition-colors inline ${isActive ? 'text-gray-300 group-hover:text-blue-500' : 'text-gray-200 group-hover:text-gray-400'}`} />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}

// ─── 關懷紀錄分頁 ─────────────────────────────────────────────────────

interface CareSectionProps {
    applicantUserId: string | null;
    applicantName: string;
    loggedInUserId: string;
    canCreate: boolean;
    isAdmin: boolean;
}

function CareSection({ applicantUserId, applicantName, loggedInUserId, canCreate, isAdmin }: CareSectionProps) {
    const [records, setRecords] = useState<CareRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<CareRecord | null>(null);

    const loadRecords = useCallback(async () => {
        if (!applicantUserId) {
            setRecords([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        const res = await fetchCareRecordsByApplicant(loggedInUserId, applicantUserId);
        setLoading(false);
        if (res.success) {
            setRecords(res.data);
        } else {
            setError(res.error);
        }
    }, [applicantUserId, loggedInUserId]);

    useEffect(() => {
        void loadRecords();
    }, [loadRecords]);

    const handleOpenCreate = () => {
        setEditingRecord(null);
        setModalOpen(true);
    };
    const handleOpenEdit = (r: CareRecord) => {
        setEditingRecord(r);
        setModalOpen(true);
    };
    const handleDelete = async (r: CareRecord) => {
        if (!confirm(`確定刪除 ${r.careDate} 的關懷紀錄？`)) return;
        const res = await deleteCareRecord(loggedInUserId, r.id);
        if (res.success) {
            await loadRecords();
        } else {
            alert(res.error);
        }
    };

    if (!applicantUserId) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-slate-400">
                無法取得申請人 ID
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-500" />
                    共 {records.length} 筆關懷紀錄
                </h3>
                {canCreate && (
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition"
                    >
                        <Plus className="w-4 h-4" />
                        新增關懷紀錄
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    載入中…
                </div>
            ) : records.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-slate-400">
                    <Heart className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    尚無關懷紀錄{canCreate && '，可點右上角「新增關懷紀錄」開始追蹤'}
                </div>
            ) : (
                <div className="space-y-3">
                    {records.map(r => {
                        const canEdit = r.careUserId === loggedInUserId;
                        const canDelete = canEdit || isAdmin;
                        return (
                            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-semibold text-slate-800">{r.careDate}</span>
                                            <span className="text-slate-400">·</span>
                                            <span className="text-slate-600">{r.careUserName}</span>
                                            {r.createdAt !== r.updatedAt && (
                                                <span className="text-[10px] text-slate-400">（已編輯）</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit(r)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                                title="編輯"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(r)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                title="刪除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.summary}</p>
                                {r.mediaUrls.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {r.mediaUrls.map((url, idx) => (
                                            <a
                                                key={idx}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded transition"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                連結 {idx + 1}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {modalOpen && (
                <CareRecordModal
                    mode={editingRecord ? 'edit' : 'create'}
                    applicantUserId={applicantUserId}
                    applicantName={applicantName}
                    existingRecord={editingRecord ?? undefined}
                    operatorUserId={loggedInUserId}
                    onSaved={loadRecords}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </div>
    );
}
