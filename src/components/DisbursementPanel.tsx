'use client';

/**
 * 多次撥款管理區塊（核銷階段使用，#12 多層審核版）
 *
 * 角色視角：
 *  - case_officer：建立新撥款；自己持有的撥款（stage='1'）可編輯、上傳紙本、按【送出】到 stage='2'
 *  - supervisor： stage='2' 撥款可【檢核】文件、按【送出】到 stage='3' 或【退件】回 stage='1'
 *  - accountant： stage='3' 撥款可勾 3 項【檢核】、按【送出】到 stage='4' 或【退件】回 stage='2'
 *  - executive：  stage='4' 撥款可【完成】到 stage='9' 或【退件】回 stage='3'
 *  - admin：不再覆蓋；各階段僅該角色可動作（避免越權）
 *
 * 串行守門：每案最多一筆「進行中」（stage 1~4）；in-flight 期間不能建立新撥款。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Wallet, Plus, Trash2, AlertTriangle, Loader2, CheckCircle, FileText, Upload, RefreshCw,
    ChevronRight, XCircle, History, ClipboardCheck, Send, Eye, Mail, Printer, FileCheck2,
} from 'lucide-react';
import { SecureFilePreviewModal } from './SecureFilePreviewModal';
import {
    fetchDisbursements,
    createDisbursement,
    markDisbursementReceived,
    deleteDisbursement,
    submitOfficerStage,
    submitSupervisorStage,
    submitAccountantStage,
    submitExecutiveStage,
    rejectDisbursement,
    setDisbursementChecklist,
    generateDisbursementPaymentReceipt,
    sendDisbursementPaymentReceiptEmail,
    fetchLastPrintMeta,
    fetchCaseAuxiliaryData,
    fetchApplicantHistoricalMedicalReceipts,
    type PaymentDisbursement,
    type DisbursementSummary,
    type CaseAuxiliaryData,
    type HistoricalMedicalReceipt,
} from '../app/actions/paymentDisbursementActions';
import { InfoSheetModal, type InfoSection } from './InfoSheetModal';
import { REVIEW_STAGE_LABEL, type ReviewStage } from '../lib/paymentDisbursementConstants';
import { linkApplicationDocumentByUrl } from '../app/actions/documentActions';
import { uploadFileToBlob } from '../lib/uploadClient';
import { Role } from '../types';
import { useToast } from './FloatingToast';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface Props {
    applicationId: string;
    applicantId?: string;        // 用於 accountant 查看該申請人歷史醫療收據
    operatorUserId: string;
    operatorRoles: Role[];
    onCanCloseChange?: (canClose: boolean) => void;
}

// ─── 角色 → 可操作 stage 對照 ────────────────────────────────────────
function canActOnStage(roles: Role[], stage: ReviewStage): boolean {
    // admin 不再 bypass — 與 server-side rolesForStage() 保持一致
    switch (stage) {
        case '1': return roles.includes('case_officer');
        case '2': return roles.includes('supervisor');
        case '3': return roles.includes('accountant');
        case '4': return roles.includes('executive');
        default:  return false;
    }
}

// ─── 主元件 ──────────────────────────────────────────────────────────

export function DisbursementPanel({ applicationId, applicantId, operatorUserId, operatorRoles, onCanCloseChange }: Props) {
    const { push: pushToast } = useToast();
    const [summary, setSummary] = useState<DisbursementSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    // 歷史醫療收據（accountant only）
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyRows, setHistoryRows] = useState<HistoricalMedicalReceipt[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPreviewUrl, setHistoryPreviewUrl] = useState<string | null>(null);
    const [historyPreviewLabel, setHistoryPreviewLabel] = useState<string>('');

    // Create form state
    const [amount, setAmount] = useState<number | ''>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('代付醫院');
    const [payeeName, setPayeeName] = useState('');
    const [payeeRelation, setPayeeRelation] = useState('本人');
    const [payeeRelationOther, setPayeeRelationOther] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankBranch, setBankBranch] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [sentAt, setSentAt] = useState('');
    const [notes, setNotes] = useState('');

    /** silent=true 時不切 loading，背景刷新避免 unmount 整個面板（CLAUDE.md UI 規則） */
    const load = useCallback(async (silent: boolean = false) => {
        if (!silent) setLoading(true);
        setError('');
        const res = await fetchDisbursements(operatorUserId, applicationId);
        if (!silent) setLoading(false);
        if (res.success) {
            setSummary(res.data);
            onCanCloseChange?.(res.data.canCloseCase);
        } else {
            setError(res.error);
        }
    }, [operatorUserId, applicationId, onCanCloseChange]);

    const reload = useCallback(() => load(true), [load]);

    useEffect(() => { void load(); }, [load]);

    const resetForm = () => {
        setAmount(''); setPaymentMethod('代付醫院'); setPayeeName(''); setPayeeRelation('本人'); setPayeeRelationOther('');
        setBankName(''); setBankBranch(''); setBankAccount(''); setSentAt(''); setNotes('');
    };

    const handleCreate = async () => {
        if (typeof amount !== 'number' || amount <= 0) {
            pushToast({ type: 'error', msg: '請輸入正確金額' });
            return;
        }
        setCreating(true);
        const res = await createDisbursement(operatorUserId, {
            applicationId, amount,
            payeeName: payeeName || undefined,
            payeeRelation: payeeRelation || undefined,
            payeeRelationOther: payeeRelation === '其他' ? (payeeRelationOther.trim() || undefined) : undefined,
            paymentMethod: paymentMethod || undefined,
            bankName: paymentMethod === '匯款' ? (bankName || undefined) : undefined,
            bankBranch: paymentMethod === '匯款' ? (bankBranch || undefined) : undefined,
            bankAccount: paymentMethod === '匯款' ? (bankAccount || undefined) : undefined,
            sentAt: sentAt || undefined,
            notes: notes || undefined,
        });
        if (!res.success) {
            setCreating(false);
            pushToast({ type: 'error', msg: res.error });
            return;
        }
        // 建立成功後，自動產生領款收據 PDF（refine：不再要求使用者手動點【產生領款收據】）
        const newDisbursementId = res.data.id;
        const genRes = await generateDisbursementPaymentReceipt(operatorUserId, newDisbursementId);
        setCreating(false);
        if (genRes.success) {
            pushToast({ type: 'success', msg: '撥款已建立、領款收據已產生' });
        } else {
            pushToast({ type: 'error', msg: `撥款已建立，但領款收據產生失敗：${genRes.error}` });
        }
        resetForm();
        setShowCreateForm(false);
        await reload();
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                載入撥款紀錄中…
            </div>
        );
    }
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
            </div>
        );
    }
    if (!summary) return null;

    const isOfficer = operatorRoles.includes('case_officer');
    const isAccountantPanel = operatorRoles.includes('accountant');

    const handleOpenHistory = async () => {
        if (!applicantId) {
            pushToast({ type: 'error', msg: '無法取得申請人 ID' });
            return;
        }
        setHistoryLoading(true);
        const r = await fetchApplicantHistoricalMedicalReceipts(operatorUserId, applicantId);
        setHistoryLoading(false);
        if (!r.success) {
            pushToast({ type: 'error', msg: r.error });
            return;
        }
        setHistoryRows(r.data);
        setShowHistoryModal(true);
    };
    const canAddMore = isOfficer && summary.remaining > 0 && !summary.hasInFlight;
    const blockReasonNoAdd = !isOfficer
        ? '僅個管師可建立撥款'
        : summary.hasInFlight
        ? '本案已有一筆撥款在審核流程中，待該筆完成或退件後才能建立新撥款'
        : summary.remaining <= 0
        ? '已無剩餘可撥金額'
        : '';

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                    撥款紀錄（多層審核）
                </h3>
                <div className="flex items-center gap-2">
                    {isAccountantPanel && applicantId && (
                        <button
                            type="button"
                            onClick={handleOpenHistory}
                            disabled={historyLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 text-slate-700 hover:bg-slate-50 rounded disabled:opacity-50"
                            title="查看此申請人在所有案件中的歷史醫療收據"
                        >
                            <History className="w-3.5 h-3.5" />
                            {historyLoading ? '載入中…' : '查看歷史醫療收據'}
                        </button>
                    )}
                    <button
                        onClick={() => void load()}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
                        title="重新整理"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <SummaryCard label="核定金額" value={summary.approvedAmount} color="text-slate-700" />
                <SummaryCard label="已撥（完成）" value={summary.totalDisbursed} color="text-blue-600" />
                <SummaryCard label="審核中" value={summary.totalInFlight} color="text-amber-600" />
                <SummaryCard label="已收回紙本" value={summary.totalReceived} color="text-emerald-600" />
                <SummaryCard
                    label="剩餘可撥"
                    value={summary.remaining}
                    color={summary.remaining > 0 ? 'text-amber-600' : 'text-slate-400'}
                />
            </div>
            {summary.canCloseCase && (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    核定金額已全數撥款且回收完畢，可結案。
                </div>
            )}
            {summary.hasInFlight && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded-lg flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5" />
                    本案有 1 筆撥款正在審核流程中；完成或退件後方可新增下一筆。
                </div>
            )}

            {/* Disbursements list */}
            {summary.disbursements.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-6">尚無撥款紀錄</p>
            ) : (
                <div className="space-y-2">
                    {summary.disbursements.map((d, i) => (
                        <DisbursementRow
                            key={d.id}
                            seqNo={i + 1}
                            disbursement={d}
                            applicationId={applicationId}
                            operatorUserId={operatorUserId}
                            operatorRoles={operatorRoles}
                            onChanged={reload}
                        />
                    ))}
                </div>
            )}

            {/* Add new disbursement */}
            {canAddMore ? (
                !showCreateForm ? (
                    <button
                        type="button"
                        onClick={() => setShowCreateForm(true)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"
                    >
                        <Plus className="w-4 h-4" />
                        新增撥款
                    </button>
                ) : (
                    <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-semibold text-slate-700">新增撥款（剩餘可撥 {summary.remaining.toLocaleString()} 元）</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="金額（元）" required>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                    max={summary.remaining}
                                    min={1}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </Field>
                            <Field label="撥款方式">
                                <select
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="代付醫院">代付醫院</option>
                                    <option value="匯款">匯款</option>
                                </select>
                            </Field>
                            <Field label="具領人姓名">
                                <input value={payeeName} onChange={e => setPayeeName(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                            </Field>
                            <Field label="具領人關係">
                                <select value={payeeRelation} onChange={e => setPayeeRelation(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                    <option value="本人">本人</option>
                                    <option value="配偶">配偶</option>
                                    <option value="子女">子女</option>
                                    <option value="父母">父母</option>
                                    <option value="其他">其他</option>
                                </select>
                            </Field>
                            {payeeRelation === '其他' && (
                                <Field label="關係描述（選填）">
                                    <input
                                        type="text" maxLength={50}
                                        value={payeeRelationOther}
                                        onChange={e => setPayeeRelationOther(e.target.value)}
                                        placeholder="例：鄰居 / 社工"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                </Field>
                            )}
                            {paymentMethod === '匯款' && (
                                <>
                                    <Field label="銀行">
                                        <input value={bankName} onChange={e => setBankName(e.target.value)}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                                    </Field>
                                    <Field label="分行">
                                        <input value={bankBranch} onChange={e => setBankBranch(e.target.value)}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                                    </Field>
                                    <Field label="帳號">
                                        <input value={bankAccount} onChange={e => setBankAccount(e.target.value)}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                                    </Field>
                                </>
                            )}
                            <Field label="寄出日期（選填）">
                                <input type="date" value={sentAt} onChange={e => setSentAt(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                            </Field>
                            <Field label="備註" wide>
                                <input value={notes} onChange={e => setNotes(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                            </Field>
                        </div>
                        <p className="text-xs text-slate-500">
                            建立後系統會自動產生收據編號，本筆撥款進入「個管師持有中」階段，需經主管 → 會計 → 執行長三層審核才會撥出。
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { resetForm(); setShowCreateForm(false); }}
                                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={creating || amount === '' || amount <= 0}
                                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                            >
                                {creating ? '建立中…' : '建立並產生收據編號'}
                            </button>
                        </div>
                    </div>
                )
            ) : (
                blockReasonNoAdd && (
                    <p className="text-xs text-slate-400 text-center pt-2">{blockReasonNoAdd}</p>
                )
            )}

            {/* 歷史醫療收據 modal（accountant only） */}
            {showHistoryModal && (
                <HistoricalMedicalReceiptsModal
                    rows={historyRows}
                    onClose={() => setShowHistoryModal(false)}
                    onPreview={(url, label) => { setHistoryPreviewUrl(url); setHistoryPreviewLabel(label); }}
                />
            )}
            {historyPreviewUrl && (
                <SecureFilePreviewModal
                    url={historyPreviewUrl}
                    label={historyPreviewLabel}
                    onClose={() => { setHistoryPreviewUrl(null); setHistoryPreviewLabel(''); }}
                />
            )}
        </div>
    );
}

// ─── 歷史醫療收據 modal ───────────────────────────────────────────

const STATUS_LABEL_HISTORY: Record<string, string> = {
    '1': '審核中', '2': '審核未通過', '3': '待核銷', '4': '核銷完成',
};

interface HistoryModalProps {
    rows: HistoricalMedicalReceipt[];
    onClose: () => void;
    onPreview: (url: string, label: string) => void;
}

function HistoricalMedicalReceiptsModal({ rows, onClose, onPreview }: HistoryModalProps) {
    useModalDismiss(onClose);
    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <History className="w-5 h-5 text-amber-600" />
                        歷史醫療收據（共 {rows.length} 張）
                    </h3>
                    <button type="button" onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded transition" aria-label="關閉">
                        <XCircle className="w-5 h-5 text-slate-500" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {rows.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-10">此申請人尚無歷史醫療收據紀錄</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-600">
                                <tr>
                                    <th className="text-left px-2 py-2">案件編號</th>
                                    <th className="text-left px-2 py-2">案件狀態</th>
                                    <th className="text-left px-2 py-2">領款收據</th>
                                    <th className="text-right px-2 py-2">撥款金額</th>
                                    <th className="text-left px-2 py-2">上傳時間</th>
                                    <th className="text-center px-2 py-2">動作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={i} className="border-b border-slate-100 hover:bg-amber-50/30">
                                        <td className="px-2 py-2 font-mono text-slate-800">{r.caseNumber}</td>
                                        <td className="px-2 py-2">
                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                r.caseStatus === '4'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {STATUS_LABEL_HISTORY[r.caseStatus] ?? r.caseStatus}
                                            </span>
                                        </td>
                                        <td className="px-2 py-2 font-mono text-xs text-slate-700">
                                            <div>{r.receiptNumber}</div>
                                            {r.externalCode && (
                                                <div className="text-slate-400">（{r.externalCode}）第 {r.disbursementSeq} 次</div>
                                            )}
                                        </td>
                                        <td className="px-2 py-2 text-right text-slate-700">
                                            ${r.disbursementAmount.toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-slate-500">
                                            {r.uploadedAt ? new Date(r.uploadedAt).toLocaleString('zh-TW') : '—'}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => onPreview(
                                                    r.fileUrl,
                                                    `${r.caseNumber}　領款收據 ${r.externalCode || r.receiptNumber}　醫療收據`
                                                )}
                                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                            >
                                                <Eye className="w-3 h-3" />檢視
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
                    <button type="button" onClick={onClose}
                        className="px-4 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50">
                        關閉
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── 子元件：摘要卡 / 欄位 ──────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-lg font-bold ${color} mt-1`}>${value.toLocaleString()}</p>
        </div>
    );
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
    return (
        <div className={wide ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-medium text-slate-600 mb-1">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

// ─── 子元件：每筆撥款行 ──────────────────────────────────────────────

interface RowProps {
    seqNo: number;
    disbursement: PaymentDisbursement;
    applicationId: string;
    operatorUserId: string;
    operatorRoles: Role[];
    onChanged: () => void;
}

const STAGE_COLORS: Record<ReviewStage, string> = {
    '1': 'bg-blue-100 text-blue-700',
    '2': 'bg-purple-100 text-purple-700',
    '3': 'bg-amber-100 text-amber-700',
    '4': 'bg-pink-100 text-pink-700',
    '9': 'bg-emerald-100 text-emerald-700',
    'X': 'bg-slate-200 text-slate-500',
};

function DisbursementRow({ seqNo, disbursement: d, applicationId, operatorUserId, operatorRoles, onChanged }: RowProps) {
    const { push: pushToast } = useToast();
    const [showReceiveForm, setShowReceiveForm] = useState(false);
    const [receivedAt, setReceivedAt] = useState(d.receivedAt ?? new Date().toISOString().split('T')[0]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    /** 已選但尚未上傳的檔案 — 點【確認】時才真正 POST 到 server。
     *  個管階段（stage='1'）= 領款收據紙本掃描；會計階段（stage='3'）= 醫療收據。 */
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    /** 預覽 modal */
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLabel, setPreviewLabel] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    // 案件輔助資料（申請表 / 家訪 / 董事審核）— lazy fetch
    const [auxData, setAuxData] = useState<CaseAuxiliaryData | null>(null);
    const [auxLoading, setAuxLoading] = useState(false);
    const [showHomeVisit, setShowHomeVisit] = useState(false);
    const [showBoardReview, setShowBoardReview] = useState(false);
    // 會計列印勾選清單
    const [printOpinion, setPrintOpinion] = useState(true);
    const [printMedical, setPrintMedical] = useState(true);
    const [printPayment, setPrintPayment] = useState(true);
    const [printing, setPrinting] = useState(false);
    const [printOperatorTooltip, setPrintOperatorTooltip] = useState<string>('');

    const canActHere = canActOnStage(operatorRoles, d.reviewStage);
    const isOfficerHolder = d.reviewStage === '1' && operatorRoles.includes('case_officer');
    const isFinal = d.reviewStage === '9';
    const isAccountant = operatorRoles.includes('accountant');
    // 完成後仍可檢視已上傳資料的角色：撥款流程任一參與角色（case_officer/supervisor/accountant/executive）
    const canViewArchive =
        operatorRoles.includes('case_officer') ||
        operatorRoles.includes('supervisor') ||
        operatorRoles.includes('accountant') ||
        operatorRoles.includes('executive');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // 只暫存 File 物件，不立刻 POST 到 server。
        // 個管階段：點【確認】時連同 markDisbursementReceived 一起送
        // 會計階段：點【確認上傳】時才送
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    /** 真正把 pendingFile 上傳：browser → Vercel Blob → server 連結 URL */
    const uploadPendingFile = async (): Promise<{ success: boolean; error?: string }> => {
        if (!pendingFile) return { success: false, error: '尚未選擇檔案' };
        setUploading(true);
        try {
            const docTypeId = (d.reviewStage === '3' && isAccountant) ? '17' : '18';
            const docLabel = `${docTypeId === '17' ? '醫療收據' : '領款收據'}_${d.receiptNumber}`;
            // 1. browser 直接上傳到 Blob（避開 Vercel function 4.5 MB 上限）
            const uploaded = await uploadFileToBlob(pendingFile, {
                pathPrefix: `uploads/${applicationId}/disb${d.id}`,
            });
            // 2. server 連結 URL → scope/role 守門 → 寫 application_documents
            const upRes = await linkApplicationDocumentByUrl(
                applicationId,
                docTypeId,
                docLabel,
                uploaded.url,
                uploaded.originalName,
                uploaded.mimeType,
                { disbursementId: d.id, operatorUserId },
            );
            return upRes.success
                ? { success: true }
                : { success: false, error: upRes.error ?? '上傳失敗' };
        } catch (err: any) {
            return { success: false, error: '上傳失敗：' + (err?.message ?? err) };
        } finally {
            setUploading(false);
        }
    };

    /** 會計階段：確認上傳醫療收據（無 markReceived 流程，獨立按鈕觸發） */
    const handleConfirmMedicalUpload = async () => {
        const r = await uploadPendingFile();
        if (r.success) {
            pushToast({ type: 'success', msg: '醫療收據已上傳' });
            setPendingFile(null);
            onChanged();
        } else {
            pushToast({ type: 'error', msg: r.error ?? '上傳失敗' });
        }
    };

    // 切換 checklist 欄位
    const handleToggleCheck = async (field: string, value: boolean) => {
        const res = await setDisbursementChecklist(operatorUserId, d.id, field, value);
        if (res.success) onChanged();
        else pushToast({ type: 'error', msg: res.error });
    };

    // 個管：重新產生領款收據 PDF
    //   - 預設情況下，建立撥款時系統會自動產一份；按此按鈕會覆蓋為新版
    //   - 主要用於：(1) 自動產生失敗時重試 (2) 重新整理日期或樣板
    const handleRegenerateReceipt = async () => {
        if (busy) return;
        setBusy(true);
        const res = await generateDisbursementPaymentReceipt(operatorUserId, d.id);
        setBusy(false);
        if (res.success) {
            pushToast({ type: 'success', msg: d.receiptFilePath ? '領款收據已重新產生' : '領款收據已產生' });
            onChanged();
        } else {
            pushToast({ type: 'error', msg: res.error });
        }
    };

    // 個管:寄送 email 給申請人
    const handleSendReceiptEmail = async () => {
        if (busy) return;
        setBusy(true);
        const res = await sendDisbursementPaymentReceiptEmail(operatorUserId, d.id);
        setBusy(false);
        if (res.success) {
            pushToast({ type: 'success', msg: '已寄送領款收據 email' });
            onChanged();
        } else {
            pushToast({ type: 'error', msg: res.error });
        }
    };

    // 會計：合併列印
    const handlePrint = async () => {
        const documents = [
            printOpinion ? 'opinion' : null,
            printMedical ? 'medical' : null,
            printPayment ? 'payment' : null,
        ].filter(Boolean);
        if (documents.length === 0) {
            pushToast({ type: 'error', msg: '請至少勾選一項' });
            return;
        }
        setPrinting(true);
        try {
            const resp = await fetch('/api/disbursement-print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    disbursementId: d.id,
                    operatorUserId,
                    documents,
                }),
            });
            if (!resp.ok) {
                pushToast({ type: 'error', msg: `列印失敗 (${resp.status})` });
                return;
            }
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            // 回收 URL（瀏覽器 tab 關閉前）
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
            onChanged();
        } catch (err: any) {
            pushToast({ type: 'error', msg: '列印失敗：' + (err?.message ?? err) });
        } finally {
            setPrinting(false);
        }
    };

    const ensureAuxData = async (): Promise<CaseAuxiliaryData | null> => {
        if (auxData) return auxData;
        setAuxLoading(true);
        const r = await fetchCaseAuxiliaryData(operatorUserId, applicationId);
        setAuxLoading(false);
        if (!r.success) {
            pushToast({ type: 'error', msg: r.error });
            return null;
        }
        setAuxData(r.data);
        return r.data;
    };

    const handleViewApplicationForm = async () => {
        const data = await ensureAuxData();
        if (!data) return;
        if (!data.applicationFormUrl) {
            pushToast({ type: 'error', msg: '尚未上傳申請表' });
            return;
        }
        setPreviewUrl(data.applicationFormUrl);
        setPreviewLabel(`申請表`);
    };

    const handleViewHomeVisit = async () => {
        const data = await ensureAuxData();
        if (!data) return;
        if (!data.homeVisit) {
            pushToast({ type: 'error', msg: '尚無家訪紀錄' });
            return;
        }
        setShowHomeVisit(true);
    };

    const handleViewBoardReview = async () => {
        const data = await ensureAuxData();
        if (!data) return;
        setShowBoardReview(true);
    };

    const handlePrintTooltipHover = async () => {
        if (printOperatorTooltip || !d.lastPrintedAt) return;
        const r = await fetchLastPrintMeta(operatorUserId, d.id);
        if (r.success && r.data) {
            const t = r.data.printedAt ? new Date(r.data.printedAt).toLocaleString('zh-TW') : '';
            setPrintOperatorTooltip(`${t}　by ${r.data.operatorName ?? '—'}`);
        }
    };

    const handleMarkReceived = async () => {
        // 若有暫存的紙本掃描檔，先上傳；上傳失敗則整個操作中止
        if (pendingFile) {
            const upRes = await uploadPendingFile();
            if (!upRes.success) {
                pushToast({ type: 'error', msg: upRes.error ?? '上傳失敗' });
                return;
            }
        }
        const res = await markDisbursementReceived(operatorUserId, d.id, receivedAt);
        if (res.success) {
            setShowReceiveForm(false);
            setPendingFile(null);
            pushToast({ type: 'success', msg: '已記錄回收' });
            onChanged();
        } else {
            pushToast({ type: 'error', msg: res.error });
        }
    };

    // 各階段【送出】按鈕的啟用條件（與 server gate 一致）
    const submitGateMissing: string | null = (() => {
        if (d.reviewStage === '1') {
            if (!d.officerDocCheck) return '請先勾選「線上/紙本文件齊全」';
            if (!d.paymentReceiptScanUploaded) return '尚未上傳領款收據紙本掃描';
            if (d.lastReceiptEmailStatus !== 'sent') return '尚未成功寄送領款收據 email';
        } else if (d.reviewStage === '2') {
            if (!d.supervisorDocCheck) return '請先勾選「領款收據確認無誤」';
        } else if (d.reviewStage === '3') {
            if (!d.accountantMedicalUploadedCheck) return '請先勾選「醫療收據已上傳」';
            if (!d.accountantAmountMatchCheck)     return '請先勾選「金額核對無誤」';
            if (!d.accountantBoardOpinionCheck)    return '請先勾選「董事意見表 2 份」';
            if (!d.accountantBankSetupCheck)       return '請先勾選「銀行已設定」';
        } else if (d.reviewStage === '4') {
            if (!d.executiveFinalCheck) return '請先勾選「申請表/家訪/審核意見表確認」';
        }
        return null;
    })();

    const handleSubmit = async () => {
        if (busy) return;
        if (submitGateMissing) {
            pushToast({ type: 'error', msg: submitGateMissing });
            return;
        }
        const fns: Record<ReviewStage, typeof submitOfficerStage | null> = {
            '1': submitOfficerStage,
            '2': submitSupervisorStage,
            '3': submitAccountantStage,
            '4': submitExecutiveStage,
            '9': null, 'X': null,
        };
        const fn = fns[d.reviewStage];
        if (!fn) return;
        setBusy(true);
        const res = await fn(operatorUserId, d.id);
        setBusy(false);
        if (res.success) onChanged();
        else pushToast({ type: 'error', msg: res.error });
    };

    const handleReject = async () => {
        const reason = rejectReason.trim();
        if (!reason) { pushToast({ type: 'error', msg: '請填寫退件原因' }); return; }
        setBusy(true);
        const res = await rejectDisbursement(operatorUserId, d.id, reason);
        setBusy(false);
        if (res.success) {
            setShowReject(false);
            setRejectReason('');
            onChanged();
        } else {
            pushToast({ type: 'error', msg: res.error });
        }
    };

    const handleDelete = async () => {
        if (!confirm(`確認刪除撥款紀錄 ${d.receiptNumber}（金額 ${d.amount.toLocaleString()} 元）？`)) return;
        const res = await deleteDisbursement(operatorUserId, d.id);
        if (res.success) onChanged();
        else pushToast({ type: 'error', msg: res.error });
    };

    const stageBadgeColor = STAGE_COLORS[d.reviewStage];
    const stageLabel = REVIEW_STAGE_LABEL[d.reviewStage];

    return (
        <div className={`border rounded-lg p-3 ${
            isFinal ? 'border-emerald-200 bg-emerald-50/30'
            : d.rejectedReason ? 'border-rose-200 bg-rose-50/30'
            : 'border-slate-200 bg-white'
        }`}>
            {/* 上行：基本資料 + stage badge */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">
                            第 {seqNo} 次撥款
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-800" title={`內碼 ${d.receiptNumber} / 外碼 ${d.externalCode}`}>
                            {d.receiptNumber}
                            {d.externalCode && <span className="text-slate-500 font-normal ml-1">（{d.externalCode}）</span>}
                        </span>
                        <span className="text-base font-bold text-emerald-700">${d.amount.toLocaleString()}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${stageBadgeColor}`}>
                            {stageLabel}
                        </span>
                        {d.receivedAt && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                <CheckCircle className="w-3 h-3" />
                                已回收 {d.receivedAt}
                            </span>
                        )}
                        {d.lastPrintedAt && (
                            <span
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded cursor-help"
                                onMouseEnter={handlePrintTooltipHover}
                                title={printOperatorTooltip || `已列印 ${new Date(d.lastPrintedAt).toLocaleString('zh-TW')}`}
                            >
                                📄 已列印
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 space-x-2">
                        {d.paymentMethod && <span>{d.paymentMethod}</span>}
                        {d.payeeName && (
                            <span>· 具領：{d.payeeName}（{d.payeeRelation ?? ''}{d.payeeRelation === '其他' && d.payeeRelationOther ? `：${d.payeeRelationOther}` : ''}）</span>
                        )}
                        {d.sentAt && <span>· 寄出 {d.sentAt}</span>}
                    </div>
                    {d.notes && <p className="text-xs text-slate-600 mt-1">備註：{d.notes}</p>}
                    {/* 「檢視」按鈕群（領款收據 / 醫療收據 / 申請表 / 家訪 / 董事審核）：
                        - 進行中（reviewStage 1~4）的當事人可看
                        - 已完成（reviewStage='9'）：所有撥款流程參與角色均可繼續檢視
                          （case_officer / supervisor / accountant / executive）
                    */}
                    {(isFinal ? canViewArchive : true) && (
                        <div className="flex items-center gap-3 flex-wrap mt-1">
                            {/* 領款收據「回函」= 申請人簽回的紙本掃描（id=18, application_documents），由個管上傳 */}
                            {d.paymentReceiptScanUrl && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPreviewUrl(d.paymentReceiptScanUrl!);
                                        setPreviewLabel(`領款收據回函（${d.externalCode || d.receiptNumber}）`);
                                    }}
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                >
                                    <Eye className="w-3 h-3" />檢視領款收據回函
                                </button>
                            )}
                            {d.medicalReceipts.map((mr, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => { setPreviewUrl(mr.fileUrl); setPreviewLabel(`醫療收據 ${i + 1} / ${d.medicalReceipts.length}`); }}
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                >
                                    <Eye className="w-3 h-3" />
                                    檢視醫療收據{d.medicalReceipts.length > 1 ? ` (${i + 1})` : ''}
                                </button>
                            ))}
                            {/* 申請表 / 家訪 / 董事審核 — 案件層級輔助資料 */}
                            {(d.paymentReceiptScanUrl || d.medicalReceipts.length > 0) && (
                                <span className="h-3 w-px bg-slate-300 mx-1" aria-hidden />
                            )}
                            <button
                                type="button"
                                onClick={handleViewApplicationForm}
                                disabled={auxLoading}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
                            >
                                <Eye className="w-3 h-3" />檢視申請表
                            </button>
                            <button
                                type="button"
                                onClick={handleViewHomeVisit}
                                disabled={auxLoading}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
                            >
                                <Eye className="w-3 h-3" />檢視家訪紀錄
                            </button>
                            <button
                                type="button"
                                onClick={handleViewBoardReview}
                                disabled={auxLoading}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
                            >
                                <Eye className="w-3 h-3" />檢視董事審核意見
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {isOfficerHolder && (
                        <button
                            onClick={handleDelete}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="刪除此撥款"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Stage progress bar */}
            <StageProgressBar current={d.reviewStage} />

            {/* 退件原因（如有） */}
            {d.rejectedReason && (
                <div className="mt-2 bg-rose-50 border border-rose-200 rounded p-2 text-xs text-rose-800 flex items-start gap-1.5">
                    <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                        <span className="font-semibold">退件原因：</span>{d.rejectedReason}
                        {d.rejectedFromStage && (
                            <span className="ml-1 text-rose-500">
                                （由 {REVIEW_STAGE_LABEL[d.rejectedFromStage as ReviewStage] ?? d.rejectedFromStage} 退回）
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* 個管師（stage='1'）：三步驟 mailer + 紙本回收 */}
            {isOfficerHolder && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                    {/* 動作列：系統產生的領款收據 PDF
                        - 重新產生：覆蓋舊版 PDF
                        - 檢視：預覽該系統 PDF
                        - 寄送 email：把該 PDF 寄給申請人
                        ※ 申請人簽回的紙本掃描另由 row 上方「檢視領款收據回函」按鈕提供 */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleRegenerateReceipt}
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded disabled:opacity-50"
                            title={d.receiptFilePath ? '重新產生(覆蓋舊版 PDF)' : '此撥款尚未產生 PDF — 請按此產出'}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            {d.receiptFilePath ? '重新產生領款收據' : '產生領款收據'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (d.receiptFilePath) {
                                    setPreviewUrl(d.receiptFilePath);
                                    setPreviewLabel(`領款收據（${d.externalCode || d.receiptNumber}）`);
                                }
                            }}
                            disabled={!d.receiptFilePath}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 text-slate-700 hover:bg-slate-50 rounded disabled:opacity-50"
                            title="檢視系統產生的 PDF 收據（不是申請人寄回的紙本）"
                        >
                            <Eye className="w-3.5 h-3.5" />檢視領款收據
                        </button>
                        <button
                            type="button"
                            onClick={handleSendReceiptEmail}
                            disabled={busy || !d.receiptFilePath}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-blue-300 text-blue-700 hover:bg-blue-50 rounded disabled:opacity-50"
                            title={!d.receiptFilePath ? '請先產生 PDF' : '寄送 email 給申請人'}
                        >
                            <Mail className="w-3.5 h-3.5" />寄送 email
                        </button>
                    </div>
                    {/* 三個狀態 badge */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        {d.receiptFilePath && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                                <CheckCircle className="w-3 h-3" />已產生
                            </span>
                        )}
                        {d.lastReceiptEmailStatus === 'sent' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                <Mail className="w-3 h-3" />已寄送
                            </span>
                        )}
                        {d.lastReceiptEmailStatus === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded">
                                <XCircle className="w-3 h-3" />寄送失敗（請重新寄送）
                            </span>
                        )}
                        {d.paymentReceiptScanUploaded && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                <FileCheck2 className="w-3 h-3" />紙本掃描完成
                            </span>
                        )}
                    </div>
                    {/* 紙本回收 / 上傳掃描檔（個管階段一律可用，即使已標記回收仍可補上傳） */}
                    {!showReceiveForm ? (
                        <button
                            onClick={() => setShowReceiveForm(true)}
                            className="text-xs text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded inline-flex items-center gap-1"
                        >
                            <Upload className="w-3 h-3" />
                            {d.receivedAt
                                ? (d.paymentReceiptScanUploaded ? '重新上傳掃描 / 修改回收日期' : '補上傳紙本掃描')
                                : '標記紙本回收 / 上傳掃描'}
                        </button>
                    ) : (
                        <div className="space-y-2">
                            {!d.paymentReceiptScanUploaded && d.receivedAt && (
                                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                    ⚠ 已標記回收日期但尚未上傳掃描檔，請補上傳後才能送出至主管。
                                </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                                <label className="text-xs text-slate-600">收件日期：</label>
                                <input type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)}
                                    className="border border-slate-300 rounded px-2 py-1 text-xs" />
                                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">
                                    <Upload className="w-3 h-3" />
                                    {pendingFile
                                        ? '重新選擇檔案'
                                        : (d.paymentReceiptScanUploaded ? '重新選擇紙本掃描' : '選擇紙本掃描（領款收據）')}
                                </button>
                                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />
                            </div>
                            {pendingFile && (
                                <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                                    已選取：<span className="font-mono">{pendingFile.name}</span>　<span className="text-slate-500">（{Math.round(pendingFile.size / 1024)} KB）</span>　— 按【確認】後才會真正上傳
                                </p>
                            )}
                            <div className="flex gap-2">
                                <button onClick={handleMarkReceived} disabled={uploading}
                                    className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50">
                                    {uploading ? '上傳中…' : '確認'}
                                </button>
                                <button onClick={() => { setShowReceiveForm(false); setPendingFile(null); }}
                                    disabled={uploading}
                                    className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">
                                    取消
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Officer 檢核 */}
                    {canActHere && (
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer pt-1 border-t border-slate-100">
                            <input
                                type="checkbox"
                                checked={d.officerDocCheck}
                                onChange={e => handleToggleCheck('officer_doc_check', e.target.checked)}
                                className="accent-indigo-600"
                            />
                            <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600" />
                            線上 / 紙本文件齊全（送出至主管前必勾）
                        </label>
                    )}
                </div>
            )}

            {/* 主管（stage='2'）— 單一檢核 */}
            {d.reviewStage === '2' && canActHere && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={d.supervisorDocCheck}
                            onChange={e => handleToggleCheck('supervisor_doc_check', e.target.checked)}
                            className="accent-purple-600"
                        />
                        <ClipboardCheck className="w-3.5 h-3.5 text-purple-600" />
                        領款收據確認無誤（送出至會計前必勾）
                    </label>
                </div>
            )}

            {/* 會計（stage='3'）— 4 項檢核 + 醫療收據上傳 + 合併列印 */}
            {d.reviewStage === '3' && canActHere && (
                <div className="mt-2 pt-2 border-t border-slate-100 bg-amber-50/60 -m-3 mt-2 p-3 rounded-b-lg space-y-2">
                    <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                        <ClipboardCheck className="w-3.5 h-3.5" />會計檢核（4 項皆勾選後才能送出）
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-amber-300 rounded hover:bg-amber-50 disabled:opacity-50">
                            <Upload className="w-3 h-3" />{pendingFile ? '重新選擇檔案' : '選擇醫療收據'}
                        </button>
                        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />
                        <span className="text-[11px] text-amber-700">支援 PDF / JPG / PNG（不接受 docx）</span>
                    </div>
                    {pendingFile && (
                        <div className="space-y-2 bg-emerald-50 border border-emerald-200 rounded p-2">
                            <p className="text-[11px] text-emerald-800">
                                已選取：<span className="font-mono">{pendingFile.name}</span>　<span className="text-slate-500">({Math.round(pendingFile.size / 1024)} KB)</span>　— 按【確認上傳】後才會真正上傳
                            </p>
                            <div className="flex gap-2">
                                <button type="button" onClick={handleConfirmMedicalUpload} disabled={uploading}
                                    className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50">
                                    {uploading ? '上傳中…' : '確認上傳'}
                                </button>
                                <button type="button" onClick={() => setPendingFile(null)} disabled={uploading}
                                    className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">
                                    取消
                                </button>
                            </div>
                        </div>
                    )}
                    {d.medicalReceipts.length > 0 && (
                        <p className="text-[11px] text-amber-700 pl-1">
                            已上傳 {d.medicalReceipts.length} 份醫療收據（請至上方「檢視醫療收據」查看）
                        </p>
                    )}
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={d.accountantMedicalUploadedCheck}
                            onChange={e => handleToggleCheck('accountant_medical_uploaded_check', e.target.checked)}
                            className="accent-amber-600" />
                        醫療收據已上傳
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={d.accountantAmountMatchCheck}
                            onChange={e => handleToggleCheck('accountant_amount_match_check', e.target.checked)}
                            className="accent-amber-600" />
                        醫療單據與領款收據金額核對無誤
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={d.accountantBoardOpinionCheck}
                            onChange={e => handleToggleCheck('accountant_board_opinion_check', e.target.checked)}
                            className="accent-amber-600" />
                        董事審核意見表 2 份齊備
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={d.accountantBankSetupCheck}
                            onChange={e => handleToggleCheck('accountant_bank_setup_check', e.target.checked)}
                            className="accent-amber-600" />
                        已設定銀行補助款
                    </label>

                    {/* 文件列印（合併 PDF） */}
                    <div className="pt-2 mt-2 border-t border-amber-200">
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-1 mb-1">
                            <Printer className="w-3.5 h-3.5" />文件列印（勾選項目合併為一份 PDF）
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                                <input type="checkbox" checked={printOpinion} onChange={e => setPrintOpinion(e.target.checked)} />
                                審核意見表
                            </label>
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                                <input type="checkbox" checked={printMedical} onChange={e => setPrintMedical(e.target.checked)} />
                                醫療收據（本次撥款）
                            </label>
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                                <input type="checkbox" checked={printPayment} onChange={e => setPrintPayment(e.target.checked)} />
                                領款收據（本次撥款）
                            </label>
                            <button
                                type="button"
                                onClick={handlePrint}
                                disabled={printing || (!printOpinion && !printMedical && !printPayment)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50"
                            >
                                <Printer className="w-3.5 h-3.5" />{printing ? '產生中…' : '列印'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 執行長（stage='4'）— 單一檢核 */}
            {d.reviewStage === '4' && canActHere && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={d.executiveFinalCheck}
                            onChange={e => handleToggleCheck('executive_final_check', e.target.checked)}
                            className="accent-pink-600"
                        />
                        <ClipboardCheck className="w-3.5 h-3.5 text-pink-600" />
                        申請表 / 家訪 / 審核意見表已確認（按【完成】撥款前必勾）
                    </label>
                </div>
            )}

            {/* 送出守門訊息（套用所有階段） — 當無法送出時，把缺少的條件清楚秀出來 */}
            {canActHere && !isFinal && submitGateMissing && (
                <div className="mt-3 pt-2 border-t border-slate-100">
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                        <div>
                            <span className="font-semibold">尚無法{d.reviewStage === '4' ? '完成撥款' : '送出至下一階段'}：</span>
                            <span>{submitGateMissing}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 操作按鈕區 */}
            {canActHere && !isFinal && (
                <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    {/* 退件（stage 2/3/4 才可退） */}
                    {(d.reviewStage === '2' || d.reviewStage === '3' || d.reviewStage === '4') && (
                        showReject ? (
                            <div className="flex-1 flex items-center gap-2 flex-wrap">
                                <input
                                    type="text" maxLength={500} value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    placeholder="退件原因（必填）"
                                    className="flex-1 min-w-[200px] border border-rose-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-rose-400 outline-none"
                                />
                                <button onClick={handleReject} disabled={busy}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded disabled:opacity-50">
                                    <XCircle className="w-3.5 h-3.5" />確認退件
                                </button>
                                <button onClick={() => { setShowReject(false); setRejectReason(''); }}
                                    className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50">取消</button>
                            </div>
                        ) : (
                            <button onClick={() => setShowReject(true)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-rose-700 border border-rose-200 rounded hover:bg-rose-50">
                                <XCircle className="w-3.5 h-3.5" />退件
                            </button>
                        )
                    )}
                    {/* 送出 / 完成 */}
                    {!showReject && (
                        <button
                            onClick={handleSubmit}
                            disabled={busy || !!submitGateMissing}
                            title={submitGateMissing ?? ''}
                            className="ml-auto inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            {d.reviewStage === '1' ? '送出至主管'
                            : d.reviewStage === '2' ? '送出至會計'
                            : d.reviewStage === '3' ? '送出至執行長'
                            : '【完成】撥款'}
                        </button>
                    )}
                </div>
            )}

            {/* 簽核歷程顯示 */}
            {(d.officerSignedAt || d.supervisorSignedAt || d.accountantSignedAt || d.executiveSignedAt) && (
                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-0.5">
                    <div className="flex items-center gap-1 font-medium text-slate-600">
                        <History className="w-3 h-3" />簽核歷程
                    </div>
                    {d.officerSignedAt    && <div>個管師送出：{new Date(d.officerSignedAt).toLocaleString('zh-TW')}</div>}
                    {d.supervisorSignedAt && <div>主管送出：{new Date(d.supervisorSignedAt).toLocaleString('zh-TW')}</div>}
                    {d.accountantSignedAt && <div>會計送出：{new Date(d.accountantSignedAt).toLocaleString('zh-TW')}</div>}
                    {d.executiveSignedAt  && <div>執行長完成：{new Date(d.executiveSignedAt).toLocaleString('zh-TW')}</div>}
                </div>
            )}
            {/* 紙本掃描檔預覽 modal — 與行政初審文件預覽相同機制（浮水印 + 防右鍵 + 防下載） */}
            {previewUrl && (
                <SecureFilePreviewModal
                    url={previewUrl}
                    label={previewLabel || `領款收據 ${d.receiptNumber}`}
                    onClose={() => { setPreviewUrl(null); setPreviewLabel(''); }}
                />
            )}

            {/* 家訪紀錄 modal */}
            {showHomeVisit && auxData?.homeVisit && (() => {
                const hv = auxData.homeVisit;
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
                        title="家訪紀錄"
                        sections={sections}
                        images={hv.photoUrls}
                        onClose={() => setShowHomeVisit(false)}
                    />
                );
            })()}

            {/* 董事審核意見 modal */}
            {showBoardReview && auxData && (() => {
                const br = auxData.boardReview;
                const sections: InfoSection[] = [
                    { label: '核定金額', value: br.approvedAmount != null ? `NT$ ${br.approvedAmount.toLocaleString()}` : null },
                    { label: '審核意見', value: br.boardReviewComments, multiline: true },
                    ...br.signatures.map((s, i) => ({
                        label: `簽章 ${i + 1}`,
                        value: `${s.signerName}　${s.signedAt ? new Date(s.signedAt).toLocaleString('zh-TW') : ''}`,
                    })),
                ];
                return (
                    <InfoSheetModal
                        title="董事審核意見"
                        headline={br.signatures.length === 0 ? '（尚無董事簽章）' : `已簽章 ${br.signatures.length} 位董事`}
                        sections={sections}
                        onClose={() => setShowBoardReview(false)}
                    />
                );
            })()}
        </div>
    );
}

// ─── 進度條 ───────────────────────────────────────────────────────────

function StageProgressBar({ current }: { current: ReviewStage }) {
    const stages: { key: ReviewStage; label: string }[] = [
        { key: '1', label: '個管師' },
        { key: '2', label: '主管' },
        { key: '3', label: '會計' },
        { key: '4', label: '執行長' },
        { key: '9', label: '完成' },
    ];
    const currentIdx = stages.findIndex(s => s.key === current);
    return (
        <div className="mt-2 flex items-center gap-1 text-[10px]">
            {stages.map((s, i) => {
                const passed = i < currentIdx || current === '9';
                const here = i === currentIdx;
                return (
                    <span key={s.key} className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded ${
                            here ? 'bg-indigo-600 text-white font-bold'
                            : passed ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                            {s.label}
                        </span>
                        {i < stages.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                    </span>
                );
            })}
        </div>
    );
}
