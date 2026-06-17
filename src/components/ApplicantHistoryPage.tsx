import { useState, useEffect, useCallback } from 'react';
import {
    ChevronRight, FileText, ArrowLeft, Clock, CheckCircle, XCircle,
    Heart, Plus, Trash2, Loader2, ClipboardList,
} from 'lucide-react';
import { ApplicationRecord, WorkflowStage } from '../types';
import { AppHeader } from './AppHeader';
import { ContactRecordModal } from './ContactRecordModal';
import { InfoSheetModal, type InfoSection } from './InfoSheetModal';
import {
    fetchContactRecords,
    deleteContactRecord,
    type ContactRecord,
} from '../app/actions/contactRecordActions';
import {
    fetchApplicantHomeVisits,
    type ApplicantHomeVisit,
} from '../app/actions/homeVisitActions';
import { useToast } from './FloatingToast';

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

    // 角色判定 — 關懷紀錄角色重整後：supervisor / case_officer / admin 可看可建
    const canViewCare = ['supervisor', 'case_officer', 'admin'].some(r => userRoles.includes(r));
    const canCreateCare = ['supervisor', 'case_officer', 'admin'].some(r => userRoles.includes(r));
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
                        applicationRecords={records}
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
                                const isRejected = rec.status === 'closed' && !isCompleted;
                                const isClickable = true;
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
                                            isRejected ? 'cursor-pointer hover:bg-rose-50 group opacity-80' : '',
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
                                            <ChevronRight className={`w-4 h-4 transition-colors inline ${isActive ? 'text-gray-300 group-hover:text-blue-500' : isRejected ? 'text-gray-200 group-hover:text-rose-400' : 'text-gray-200 group-hover:text-gray-400'}`} />
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
    /** 此申請人的歷次案件（用於關懷紀錄綁定下拉） */
    applicationRecords: ApplicationRecord[];
}

function CareSection({ applicantUserId, applicantName, loggedInUserId, canCreate, isAdmin, applicationRecords }: CareSectionProps) {
    const { push: pushToast } = useToast();
    const [records, setRecords] = useState<ContactRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<ContactRecord | null>(null);
    // 家訪關懷紀錄表（home_visit；每案 0~1 筆）
    const [homeVisits, setHomeVisits] = useState<ApplicantHomeVisit[]>([]);
    const [openHomeVisit, setOpenHomeVisit] = useState<ApplicantHomeVisit | null>(null);

    const loadRecords = useCallback(async () => {
        if (!applicantUserId) {
            setRecords([]);
            setHomeVisits([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        const [crRes, hvRes] = await Promise.all([
            fetchContactRecords(loggedInUserId, { applicantUserId }),
            fetchApplicantHomeVisits(loggedInUserId, applicantUserId),
        ]);
        setLoading(false);
        if (crRes.success) setRecords(crRes.data);
        else setError(crRes.error);
        if (hvRes.success) setHomeVisits(hvRes.data);
    }, [applicantUserId, loggedInUserId]);

    useEffect(() => {
        void loadRecords();
    }, [loadRecords]);

    /** 開啟「新增」modal — 預設類型由 createType 決定（'1'=來電 / '2'=關懷） */
    const [createType, setCreateType] = useState<'1' | '2'>('1');
    const handleOpenCreatePhone = () => {
        setEditingRecord(null);
        setCreateType('1');
        setModalOpen(true);
    };
    const handleOpenCreateCare = () => {
        setEditingRecord(null);
        setCreateType('2');
        setModalOpen(true);
    };
    const handleOpenEdit = (r: ContactRecord) => {
        setEditingRecord(r);
        setModalOpen(true);
    };
    const handleDelete = async (r: ContactRecord) => {
        if (!confirm(`確定刪除 ${r.contactDate} 的紀錄？`)) return;
        const res = await deleteContactRecord(loggedInUserId, r.id);
        if (res.success) {
            await loadRecords();
        } else {
            pushToast({ type: 'error', msg: res.error });
        }
    };

    if (!applicantUserId) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-slate-400">
                無法取得申請人 ID
            </div>
        );
    }

    const phoneCount = records.filter(r => r.recordType === '1').length;
    const careCount  = records.filter(r => r.recordType === '2').length;
    const visitCount = homeVisits.length;
    const totalEvents = phoneCount + careCount + visitCount;

    // 把三種事件合併成單一時間軸，依日期 desc 排序（最新在上）
    type Event =
        | { kind: 'phone' | 'care'; date: string; raw: ContactRecord }
        | { kind: 'visit';          date: string; raw: ApplicantHomeVisit };
    const events: Event[] = [
        ...records.map<Event>(r => ({
            kind: r.recordType === '1' ? 'phone' : 'care',
            date: r.contactDate || '',
            raw: r,
        })),
        ...homeVisits.map<Event>(hv => ({
            kind: 'visit',
            date: hv.visitDate || '',
            raw: hv,
        })),
    ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const STATUS_LABEL_HERE: Record<string, string> = {
        '1': '審核中', '2': '審核未通過', '3': '待核銷', '4': '核銷完成',
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-emerald-600" />
                    共 {totalEvents} 筆紀錄
                    {totalEvents > 0 && (
                        <span className="text-xs text-slate-400 font-normal ml-1">
                            （來電 {phoneCount} / 關懷 {careCount} / 家訪 {visitCount}）
                        </span>
                    )}
                </h3>
                {canCreate && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleOpenCreatePhone}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                            title="紀錄一通與此申請人有關的來電（不需綁案件）"
                        >
                            <Plus className="w-4 h-4" />
                            新增來電紀錄
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenCreateCare}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition"
                            title="紀錄一次對申請人的主動關懷（需綁定特定案件）"
                        >
                            <Plus className="w-4 h-4" />
                            新增關懷紀錄
                        </button>
                    </div>
                )}
            </div>
            <p className="text-xs text-slate-500 -mt-2">
                依日期排序（最新在上）顯示此申請人歷次案件的所有事件 — 來電、關懷、家訪。
                本頁可新增「來電」與「關懷」；「家訪」請於對應案件的家訪步驟建立。
            </p>

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
            ) : events.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-slate-400">
                    <Heart className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    尚無紀錄{canCreate && '，可點右上角「新增來電紀錄」'}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="space-y-1">
                        {events.map(ev => {
                            // 家訪 home_visit 渲染（先檢查 visit 讓 TS narrowing 正確）
                            if (ev.kind === 'visit') {
                                const hv = ev.raw;
                                return (
                                    <button
                                        key={`v-${hv.homeVisitId}`}
                                        type="button"
                                        onClick={() => setOpenHomeVisit(hv)}
                                        className="w-full flex items-center gap-3 p-2 rounded hover:bg-emerald-50 text-left transition"
                                    >
                                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-emerald-100 text-emerald-700">
                                            家訪
                                        </span>
                                        <span
                                            className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-100 text-emerald-700 shrink-0"
                                            title="所屬案件編號"
                                        >
                                            {hv.caseNumber}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                                            hv.caseStatus === '4' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : hv.caseStatus === '2' ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}>
                                            {STATUS_LABEL_HERE[hv.caseStatus] ?? hv.caseStatus}
                                        </span>
                                        <span className="text-xs text-slate-600 font-mono shrink-0">{hv.visitDate ?? '—'}</span>
                                        {hv.visitorName && (
                                            <span className="text-xs text-slate-500 shrink-0">
                                                · 訪視者：{hv.visitorName}{hv.visitorTitle ? `（${hv.visitorTitle}）` : ''}
                                            </span>
                                        )}
                                        <span className="text-xs text-slate-700 truncate">
                                            {hv.subsidyNeedReason?.trim() || hv.selfReportedCondition?.trim() || '（無摘要）'}
                                        </span>
                                    </button>
                                );
                            }
                            // 來電 / 關懷 contact_record 共用渲染
                            {
                                const r = ev.raw;
                                const canDelete = (r.handlerUserId === loggedInUserId) || isAdmin;
                                const tagClass = ev.kind === 'phone'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-rose-100 text-rose-700';
                                const tagLabel = ev.kind === 'phone' ? '來電' : '關懷';
                                const summary = r.summary?.trim() || '（無摘要）';
                                return (
                                    <div
                                        key={`c-${r.id}`}
                                        className="group flex items-center gap-3 p-2 rounded hover:bg-slate-50 transition"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(r)}
                                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                                        >
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${tagClass}`}>
                                                {tagLabel}
                                            </span>
                                            {r.caseNumber && (
                                                <span
                                                    className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-100 text-emerald-700 shrink-0"
                                                    title="此紀錄關聯之案件編號"
                                                >
                                                    {r.caseNumber}
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-600 font-mono shrink-0">{r.contactDate}</span>
                                            <span className="text-xs text-slate-500 shrink-0">· {r.handlerName}</span>
                                            <span className="text-xs text-slate-700 truncate">{summary}</span>
                                            {r.createdAt !== r.updatedAt && (
                                                <span className="text-[10px] text-slate-400 shrink-0">（已編輯）</span>
                                            )}
                                        </button>
                                        {canDelete && (
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(r)}
                                                className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition"
                                                title="刪除此紀錄"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                );
                            }
                        })}
                    </div>
                </div>
            )}

            {modalOpen && (
                <ContactRecordModal
                    mode={editingRecord ? 'edit' : 'create'}
                    applicantUserId={applicantUserId}
                    applicantName={applicantName}
                    defaultRecordType={createType}
                    existingRecord={editingRecord ?? undefined}
                    /* 提供此申請人的歷次案件供關懷模式下拉選擇 */
                    applications={applicationRecords
                        .filter(r => !!r.caseNumber)
                        .map(r => ({
                            id: r.id,
                            caseNumber: r.caseNumber!,
                            // 前端 ApplicationStatus 只有 active/closed；近似 mapping
                            status: r.status === 'active' ? '1' : '4',
                        }))}
                    operatorUserId={loggedInUserId}
                    onSaved={loadRecords}
                    onClose={() => setModalOpen(false)}
                />
            )}

            {/* 家訪紀錄表詳情 modal */}
            {openHomeVisit && (() => {
                const hv = openHomeVisit;
                const sections: InfoSection[] = [
                    { label: '訪視日期', value: hv.visitDate },
                    { label: '訪視員', value: [hv.visitorName, hv.visitorTitle].filter(Boolean).join('・') || null },
                    { label: '本人陳述', value: hv.selfReportedCondition, multiline: true },
                    { label: '對病情的反應', value: [hv.diseaseReactionStatus, hv.diseaseReactionOther].filter(Boolean).join('｜') || null },
                    { label: '治療態度', value: [hv.treatmentAttitudeStatus, hv.treatmentAttitudeOther].filter(Boolean).join('｜') || null },
                    { label: '主要照顧者', value: [hv.primaryCaregiver, hv.primaryCaregiverOther].filter(Boolean).join('｜') || null },
                    { label: '家庭互動', value: [hv.familyInteractionStatus, hv.familyInteractionOther].filter(Boolean).join('｜') || null },
                    { label: '當事人想法', value: hv.impactedPartyThoughts, multiline: true },
                    { label: '治療支持', value: [hv.treatmentSupportStatus, hv.treatmentSupportOther].filter(Boolean).join('｜') || null },
                    { label: '其他狀況', value: hv.otherStatusNotes, multiline: true },
                    { label: '需要補助原因', value: hv.subsidyNeedReason, multiline: true },
                    { label: '訪視員建議', value: [hv.visitorRecommendations, hv.visitorRecommendationsOther].filter(Boolean).join('｜') || null, multiline: true },
                ];
                return (
                    <InfoSheetModal
                        title={`家訪關懷紀錄表 — ${hv.caseNumber}`}
                        headline={`${STATUS_LABEL_HERE[hv.caseStatus] ?? hv.caseStatus}　訪視日期：${hv.visitDate ?? '—'}`}
                        sections={sections}
                        images={hv.photoUrls}
                        onClose={() => setOpenHomeVisit(null)}
                    />
                );
            })()}
        </div>
    );
}
