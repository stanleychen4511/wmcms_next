'use client';

/**
 * 報表查詢頁 — 對齊「各補助案-申請案列表.xlsx」三張表
 *
 * Tab：
 *   - 自費醫療        （status IN '1','3','4'）
 *   - 自費醫療補助款項（status IN '3','4'，每筆撥款一列）
 *   - 自費醫療_未通過（status='2' + 結構化原因）
 *
 * 每個 tab 提供：
 *   - 篩選器（日期區間 / 子類型 / 結案原因）
 *   - 結果預覽（前 100 筆）
 *   - 「匯出 XLSX」按鈕（呼叫 /api/report-export）
 *
 * 權限由 server action 端 hasAnyRole 把守。
 */

import { ReactNode, useEffect, useRef, useState } from 'react';
import {
    FileSpreadsheet, Filter, Download, Loader2, ArrowLeft,
} from 'lucide-react';
import { AppHeader } from './AppHeader';
import { useToast } from './FloatingToast';
import {
    fetchSelfPayMedicalReport,
    fetchDisbursementReport,
    fetchRejectedReport,
    type SelfPayReportRow,
    type DisbursementReportRow,
    type RejectedReportRow,
} from '../app/actions/reportActions';
import { CLOSE_REASON_OPTIONS } from '../lib/closeReasonConstants';
import { DateInput } from './DateInput';
import { formatRocDateOnly as toRoc, formatRocDateTime as toRocDateTime } from '../lib/rocDate';

interface Props {
    operatorUserId: string;
    username: string;
    onBack: () => void;
    onGoHome: () => void;
    onLogout: () => void;
}

type Tab = 'self_pay' | 'disbursement' | 'rejected';

const TAB_LABEL: Record<Tab, string> = {
    self_pay: '自費醫療',
    disbursement: '自費醫療補助款項',
    rejected: '自費醫療_未通過',
};
const SUBSIDY_LABEL: Record<string, string> = { '1': '經濟弱勢', '2': '小康家庭' };
const APP_FORM_LABEL: Record<string, string> = { P: '紙本', E: '電子郵件' };
const PHASE_LABEL: Record<string, string> = { B: '治療前', A: '治療後', X: '治療前後' };
const STATUS_LABEL: Record<string, string> = { '1': '審核中', '2': '審核未通過', '3': '待核銷', '4': '核銷完成' };

function defaultDateRange(): { from: string; to: string } {
    const today = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return { from: fmt(oneYearAgo), to: fmt(today) };
}

type ColumnDef = { key: string; width: number };

function useResizableColumns(columns: ColumnDef[]) {
    const [widths, setWidths] = useState<Record<string, number>>(
        () => Object.fromEntries(columns.map(c => [c.key, c.width])),
    );
    const dragRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

    const startResize = (key: string, e: React.MouseEvent) => {
        e.preventDefault();
        dragRef.current = { key, startX: e.clientX, startWidth: widths[key] ?? 120 };

        const onMove = (event: MouseEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const next = Math.max(56, drag.startWidth + event.clientX - drag.startX);
            setWidths(prev => ({ ...prev, [drag.key]: next }));
        };
        const onUp = () => {
            dragRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return { widths, startResize };
}

function ResizableColGroup({ columns, widths }: { columns: ColumnDef[]; widths: Record<string, number> }) {
    return (
        <colgroup>
            {columns.map(col => <col key={col.key} style={{ width: widths[col.key] ?? col.width }} />)}
        </colgroup>
    );
}

function ResizableTh({
    column,
    widths,
    onResizeStart,
    children,
}: {
    column: ColumnDef;
    widths: Record<string, number>;
    onResizeStart: (key: string, e: React.MouseEvent) => void;
    children: ReactNode;
}) {
    return (
        <th
            className="relative text-left px-2 py-2 pr-3 font-semibold text-slate-600 select-none"
            style={{ width: widths[column.key] ?? column.width }}
        >
            <span className="block truncate">{children}</span>
            <span
                role="separator"
                aria-orientation="vertical"
                title="拖曳調整欄寬"
                onMouseDown={e => onResizeStart(column.key, e)}
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none group"
            >
                <span className="absolute right-0.5 top-1/2 h-5 -translate-y-1/2 border-r border-slate-300 group-hover:border-blue-500" />
            </span>
        </th>
    );
}

export function ReportsPage({ operatorUserId, username, onBack, onGoHome, onLogout }: Props) {
    const { push: pushToast } = useToast();
    const [tab, setTab] = useState<Tab>('self_pay');
    const initialRange = defaultDateRange();
    const [from, setFrom] = useState(initialRange.from);
    const [to, setTo] = useState(initialRange.to);
    const [subsidy, setSubsidy] = useState<'1' | '2' | ''>('');
    const [reasonFilter, setReasonFilter] = useState<Set<string>>(new Set());
    const [flatten, setFlatten] = useState(false);

    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [selfPayRows, setSelfPayRows] = useState<SelfPayReportRow[]>([]);
    const [disbursementRows, setDisbursementRows] = useState<DisbursementReportRow[]>([]);
    const [rejectedRows, setRejectedRows] = useState<RejectedReportRow[]>([]);
    const [appliedFilter, setAppliedFilter] = useState({ from: initialRange.from, to: initialRange.to, subsidy: '' as '1' | '2' | '', reason: new Set<string>() });

    const buildFilter = () => ({
        from: appliedFilter.from || undefined,
        to: appliedFilter.to || undefined,
        subsidySubtype: appliedFilter.subsidy || undefined,
        reasonCodes: tab === 'rejected' && appliedFilter.reason.size > 0 ? Array.from(appliedFilter.reason) : undefined,
    });

    // 載入：tab / appliedFilter 變動時自動拉
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                if (tab === 'self_pay') {
                    const res = await fetchSelfPayMedicalReport(operatorUserId, buildFilter());
                    if (!cancelled) setSelfPayRows(res.success ? res.data : []);
                    if (!cancelled && !res.success) pushToast({ type: 'error', msg: res.error });
                } else if (tab === 'disbursement') {
                    const res = await fetchDisbursementReport(operatorUserId, buildFilter());
                    if (!cancelled) setDisbursementRows(res.success ? res.data : []);
                    if (!cancelled && !res.success) pushToast({ type: 'error', msg: res.error });
                } else {
                    const res = await fetchRejectedReport(operatorUserId, buildFilter());
                    if (!cancelled) setRejectedRows(res.success ? res.data : []);
                    if (!cancelled && !res.success) pushToast({ type: 'error', msg: res.error });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, appliedFilter, operatorUserId]);

    const runSearch = () => {
        setAppliedFilter({ from, to, subsidy, reason: new Set(reasonFilter) });
    };

    const resetSearch = () => {
        const nextRange = defaultDateRange();
        setFrom(nextRange.from);
        setTo(nextRange.to);
        setSubsidy('');
        setReasonFilter(new Set());
        setFlatten(false);
        setAppliedFilter({ from: nextRange.from, to: nextRange.to, subsidy: '', reason: new Set() });
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await fetch('/api/report-export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportType: tab,
                    operatorUserId,
                    filter: buildFilter(),
                    flatten: tab === 'disbursement' ? flatten : undefined,
                }),
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({} as any));
                pushToast({ type: 'error', msg: errBody?.error ?? `匯出失敗（${res.status}）` });
                return;
            }
            const blob = await res.blob();
            const cd = res.headers.get('content-disposition') ?? '';
            const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
            const filename = m ? decodeURIComponent(m[1]) : `${TAB_LABEL[tab]}.xlsx`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            pushToast({ type: 'success', msg: '已匯出' });
        } catch (e: any) {
            pushToast({ type: 'error', msg: e?.message ?? '匯出失敗' });
        } finally {
            setExporting(false);
        }
    };

    const totalCount = tab === 'self_pay' ? selfPayRows.length
                       : tab === 'disbursement' ? disbursementRows.length
                       : rejectedRows.length;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            <AppHeader username={username} onGoHome={onGoHome} onLogout={onLogout} />

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 space-y-6">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition font-medium mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        返回首頁
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                        報表查詢
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        對齊「各補助案-申請案列表」客戶報表；篩選後可匯出 Excel。
                    </p>
                </div>

                {/* Tab switcher */}
                <div className="border-b border-slate-200">
                    <div className="flex gap-1">
                        {(['self_pay', 'disbursement', 'rejected'] as Tab[]).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                                    tab === t
                                        ? 'border-emerald-600 text-emerald-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                            >
                                {TAB_LABEL[t]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 篩選器 */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <Filter className="w-4 h-4" />
                        篩選條件
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">起始日（申請日期）</label>
                            <DateInput value={from} onChange={setFrom}
                                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">結束日</label>
                            <DateInput value={to} onChange={setTo}
                                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
                        </div>
                        {tab !== 'rejected' && (
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">補助子類型</label>
                                <select value={subsidy} onChange={e => setSubsidy(e.target.value as '1' | '2' | '')}
                                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm">
                                    <option value="">全部</option>
                                    <option value="1">經濟弱勢</option>
                                    <option value="2">小康家庭</option>
                                </select>
                            </div>
                        )}
                        {tab === 'disbursement' && (
                            <div className="flex items-end">
                                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                    <input type="checkbox" checked={flatten} onChange={e => setFlatten(e.target.checked)}
                                        className="accent-emerald-600" />
                                    展開為平面格式（每列重複案件資訊）
                                </label>
                            </div>
                        )}
                    </div>
                    {tab === 'rejected' && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">未符合原因（多選）</label>
                            <div className="flex flex-wrap gap-2">
                                {CLOSE_REASON_OPTIONS.map(opt => {
                                    const checked = reasonFilter.has(opt.code);
                                    return (
                                        <label key={opt.code} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer border ${
                                            checked ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'
                                        }`}>
                                            <input type="checkbox" checked={checked} onChange={() => {
                                                setReasonFilter(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(opt.code)) next.delete(opt.code); else next.add(opt.code);
                                                    return next;
                                                });
                                            }} className="accent-emerald-600" />
                                            {opt.label}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={runSearch} disabled={loading}
                            className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50">
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                            查詢
                        </button>
                        <button type="button" onClick={resetSearch} disabled={loading}
                            className="px-4 py-1.5 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 rounded disabled:opacity-50">
                            重設查詢條件
                        </button>
                        <button type="button" onClick={handleExport} disabled={exporting || loading || totalCount === 0}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50">
                            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            匯出 XLSX
                        </button>
                    </div>
                </div>

                {/* 結果統計 */}
                <div className="text-xs text-slate-500">
                    共 {totalCount} 筆{totalCount > 100 ? '（畫面預覽前 100 筆，匯出含全部）' : ''}
                </div>

                {/* 表格 */}
                <div className={`bg-white border border-slate-200 rounded-lg overflow-x-auto transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
                    {tab === 'self_pay' && <SelfPayTable rows={selfPayRows.slice(0, 100)} />}
                    {tab === 'disbursement' && <DisbursementTable rows={disbursementRows.slice(0, 100)} flatten={flatten} />}
                    {tab === 'rejected' && <RejectedTable rows={rejectedRows.slice(0, 100)} />}
                </div>
            </main>
        </div>
    );
}

// ─── Tables ─────────────────────────────────────────────────────────────────

const SELF_PAY_COLUMNS: ColumnDef[] = [
    { key: 'officer', width: 76 },
    { key: 'caseNumber', width: 86 },
    { key: 'subsidy', width: 72 },
    { key: 'way', width: 56 },
    { key: 'applicant', width: 72 },
    { key: 'applyAt', width: 92 },
    { key: 'form', width: 72 },
    { key: 'phase', width: 72 },
    { key: 'stage', width: 64 },
    { key: 'adminText', width: 72 },
    { key: 'adminAt', width: 144 },
    { key: 'homeVisitAt', width: 144 },
    { key: 'boardReceivedAt', width: 144 },
    { key: 'boardReviewedAt', width: 144 },
    { key: 'boardText', width: 72 },
    { key: 'disclosure', width: 96 },
    { key: 'lastPaidAt', width: 110 },
    { key: 'pendingDocs', width: 160 },
    { key: 'status', width: 72 },
];

const DISBURSEMENT_COLUMNS: ColumnDef[] = [
    { key: 'caseNumber', width: 92 },
    { key: 'way', width: 72 },
    { key: 'applicant', width: 90 },
    { key: 'applyAt', width: 92 },
    { key: 'approvedAmount', width: 94 },
    { key: 'paymentMethod', width: 90 },
    { key: 'receiptNo', width: 110 },
    { key: 'paidAt', width: 96 },
    { key: 'amount', width: 98 },
    { key: 'notes', width: 220 },
];

const REJECTED_COLUMNS: ColumnDef[] = [
    { key: 'rowNo', width: 56 },
    { key: 'applicant', width: 120 },
    { key: 'applyAt', width: 96 },
    { key: 'form', width: 90 },
    { key: 'reasons', width: 240 },
    { key: 'officer', width: 90 },
    { key: 'notes', width: 220 },
];


function HeaderCells({ columns, labels, widths, startResize }: {
    columns: ColumnDef[];
    labels: string[];
    widths: Record<string, number>;
    startResize: (key: string, e: React.MouseEvent) => void;
}) {
    return (
        <>
            {columns.map((column, index) => (
                <ResizableTh key={column.key} column={column} widths={widths} onResizeStart={startResize}>
                    {labels[index] ?? column.key}
                </ResizableTh>
            ))}
        </>
    );
}

function SelfPayTable({ rows }: { rows: SelfPayReportRow[] }) {
    const columns = SELF_PAY_COLUMNS;
    const labels = ['承辦人', '案號', '案別', '自/轉', '申請者', '申請日', '形式', '階段', '期數', '行政審核', '行政通過時間', '家訪時間', '董事收到時間', '董事通過時間', '董事審核', '同意公開受補助', '最後補助款核發日', '待收文件', '狀態'];
    const { widths, startResize } = useResizableColumns(columns);
    return (
        <table className="w-full min-w-max text-xs table-fixed">
            <ResizableColGroup columns={columns} widths={widths} />
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr><HeaderCells columns={columns} labels={labels} widths={widths} startResize={startResize} /></tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr><td colSpan={columns.length} className="px-2 py-8 text-center text-slate-400">無資料</td></tr>
                ) : rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-2 py-1.5 truncate" title={r.officerName}>{r.officerName}</td>
                        <td className="px-2 py-1.5 font-mono truncate" title={r.caseNumber}>{r.caseNumber}</td>
                        <td className="px-2 py-1.5 truncate">{r.subsidySubtype ? SUBSIDY_LABEL[r.subsidySubtype] : ''}</td>
                        <td className="px-2 py-1.5 truncate">{r.applicationWay === '2' ? '轉介' : '自行'}</td>
                        <td className="px-2 py-1.5 truncate" title={r.applicantName}>{r.applicantName}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{toRoc(r.applyAt)}</td>
                        <td className="px-2 py-1.5 truncate">{r.applicationForm ? APP_FORM_LABEL[r.applicationForm] : ''}</td>
                        <td className="px-2 py-1.5 truncate">{r.treatmentPhase ? PHASE_LABEL[r.treatmentPhase] : ''}</td>
                        <td className="px-2 py-1.5 truncate">{r.cancerStage ?? ''}</td>
                        <td className="px-2 py-1.5 truncate" title={r.adminReviewText ?? ''}>{r.adminReviewText ?? ''}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{toRocDateTime(r.adminReviewAt)}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{toRocDateTime(r.homeVisitAt)}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{toRocDateTime(r.boardReceivedAt)}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{toRocDateTime(r.boardReviewedAt)}</td>
                        <td className="px-2 py-1.5 truncate" title={r.boardReviewText ?? ''}>{r.boardReviewText ?? ''}</td>
                        <td className="px-2 py-1.5 truncate">{r.beneficiaryDisclosureConsent == null ? '' : (r.beneficiaryDisclosureConsent ? '同意' : '不同意')}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{toRoc(r.lastDisbursementPaidAt)}</td>
                        <td className="px-2 py-1.5 truncate" title={r.pendingDocuments.join('、')}>{r.pendingDocuments.length > 0 ? r.pendingDocuments.join('、') : <span className="text-slate-400">已收齊</span>}</td>
                        <td className="px-2 py-1.5 truncate">{STATUS_LABEL[r.status] ?? r.status}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function DisbursementTable({ rows, flatten }: { rows: DisbursementReportRow[]; flatten: boolean }) {
    const columns = DISBURSEMENT_COLUMNS;
    const labels = ['案號', '自/轉', '申請者', '申請日', '通過額度', '給付方式', '收據編號', '給付日期', '給付費用', '備註'];
    const { widths, startResize } = useResizableColumns(columns);
    let lastCase: Pick<DisbursementReportRow, 'caseNumber' | 'applicationWay' | 'applicantName' | 'applyAt' | 'approvedAmount'> = {
        caseNumber: null,
        applicationWay: null,
        applicantName: null,
        applyAt: null,
        approvedAmount: null,
    };
    const displayRows = flatten ? rows.map(row => {
        if (row.caseNumber) {
            lastCase = {
                caseNumber: row.caseNumber,
                applicationWay: row.applicationWay,
                applicantName: row.applicantName,
                applyAt: row.applyAt,
                approvedAmount: row.approvedAmount,
            };
        }
        return {
            ...row,
            caseNumber: row.caseNumber ?? lastCase.caseNumber,
            applicationWay: row.applicationWay ?? lastCase.applicationWay,
            applicantName: row.applicantName ?? lastCase.applicantName,
            applyAt: row.applyAt ?? lastCase.applyAt,
            approvedAmount: row.approvedAmount ?? lastCase.approvedAmount,
        };
    }) : rows;
    const totalAmount = displayRows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const totalApproved = displayRows.reduce((sum, r) => sum + (r.approvedAmount ?? 0), 0);
    return (
        <table className="w-full min-w-max text-xs table-fixed">
            <ResizableColGroup columns={columns} widths={widths} />
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr><HeaderCells columns={columns} labels={labels} widths={widths} startResize={startResize} /></tr>
            </thead>
            <tbody>
                {displayRows.length === 0 ? (
                    <tr><td colSpan={columns.length} className="px-2 py-8 text-center text-slate-400">無資料</td></tr>
                ) : displayRows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-2 py-1.5 font-mono truncate" title={r.caseNumber ?? ''}>{r.caseNumber ?? ''}</td>
                        <td className="px-2 py-1.5 truncate">{r.applicationWay ? (r.applicationWay === '2' ? '轉介' : '自行') : ''}</td>
                        <td className="px-2 py-1.5 truncate" title={r.applicantName ?? ''}>{r.applicantName ?? ''}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{r.applyAt ? toRoc(r.applyAt) : ''}</td>
                        <td className="px-2 py-1.5 text-left">{r.approvedAmount != null ? r.approvedAmount.toLocaleString() : ''}</td>
                        <td className="px-2 py-1.5 truncate" title={r.paymentMethod ?? ''}>{r.paymentMethod ?? ''}</td>
                        <td className="px-2 py-1.5 font-mono truncate" title={r.receiptNo ?? ''}>{r.receiptNo ?? ''}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                            {r.paidAt ? toRoc(r.paidAt) : ''}
                        </td>
                        <td className="px-2 py-1.5 text-left">{r.amount != null ? 'NT$' + r.amount.toLocaleString() : ''}</td>
                        <td className="px-2 py-1.5 truncate" title={r.notes ?? ''}>{r.notes ?? ''}</td>
                    </tr>
                ))}
                {displayRows.length > 0 && (
                    <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                        <td className="px-2 py-2" colSpan={4}>合計</td>
                        <td className="px-2 py-2 text-left">{totalApproved.toLocaleString()}</td>
                        <td className="px-2 py-2" colSpan={3}></td>
                        <td className="px-2 py-2 text-left">{'NT$' + totalAmount.toLocaleString()}</td>
                        <td className="px-2 py-2"></td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}

function RejectedTable({ rows }: { rows: RejectedReportRow[] }) {
    const columns = REJECTED_COLUMNS;
    const labels = ['NO', '姓名', '申請日', '文件屬性', '未符合原因', '承辦人', '備註'];
    const { widths, startResize } = useResizableColumns(columns);
    return (
        <table className="w-full min-w-max text-xs table-fixed">
            <ResizableColGroup columns={columns} widths={widths} />
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr><HeaderCells columns={columns} labels={labels} widths={widths} startResize={startResize} /></tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr><td colSpan={columns.length} className="px-2 py-8 text-center text-slate-400">無資料</td></tr>
                ) : rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-2 py-1.5 text-right">{r.rowNo}</td>
                        <td className="px-2 py-1.5 truncate" title={r.applicantName}>{r.applicantName}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{toRoc(r.applyAt)}</td>
                        <td className="px-2 py-1.5 truncate">{r.applicationForm ? APP_FORM_LABEL[r.applicationForm] : ''}</td>
                        <td className="px-2 py-1.5 truncate" title={r.reasonsText}>{r.reasonsText}</td>
                        <td className="px-2 py-1.5 truncate" title={r.officerName}>{r.officerName}</td>
                        <td className="px-2 py-1.5 truncate" title={r.notes ?? ''}>{r.notes ?? ''}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
