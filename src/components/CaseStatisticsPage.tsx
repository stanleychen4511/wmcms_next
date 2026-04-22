'use client';

import { useState, useCallback, useEffect } from 'react';
import {
    BarChart3, ArrowLeft, Calendar, Download, Loader2, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { AppHeader } from './AppHeader';
import {
    fetchCaseStatistics,
    type CaseStatistics,
    type StatsDimension,
    type StatsOutcome,
} from '../app/actions/caseStatisticsActions';
import { CaseStatisticsDrillDownModal } from './CaseStatisticsDrillDownModal';

interface Props {
    operatorUserId: string;
    username: string;
    onGoHome: () => void;
    onLogout: () => void;
}

const CATEGORY_LABEL_MAP: Record<string, string> = {
    A: 'A：自費醫療',
    B: 'B：臨終安寧自費醫療',
    C: 'C：預立醫療照護諮商',
    D: 'D：醫事人員進修',
    unknown: '（未知/無類別）',
};

function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function firstOfMonthIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

interface DrillDownRequest {
    dimension: StatsDimension;
    dimensionValue: string;
    outcome: StatsOutcome;
    title: string;
}

export function CaseStatisticsPage({ operatorUserId, username, onGoHome, onLogout }: Props) {
    const [fromDate, setFromDate] = useState(firstOfMonthIso());
    const [toDate, setToDate] = useState(todayIso());
    const [stats, setStats] = useState<CaseStatistics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [drillDown, setDrillDown] = useState<DrillDownRequest | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        setError('');
        const res = await fetchCaseStatistics(operatorUserId, fromDate, toDate);
        setLoading(false);
        if (res.success) setStats(res.data);
        else { setError(res.error); setStats(null); }
    }, [operatorUserId, fromDate, toDate]);

    // 首次自動載入
    useEffect(() => {
        void loadStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openDrillDown = (req: DrillDownRequest) => setDrillDown(req);
    const closeDrillDown = () => setDrillDown(null);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            <AppHeader username={username} onGoHome={onGoHome} onLogout={onLogout} />

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 space-y-6">
                <div>
                    <button
                        onClick={onGoHome}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition font-medium mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        返回首頁
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-blue-600" />
                        案件統計
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        以收件日期（apply_at）為基準，統計通過 / 不通過案件分布。
                    </p>
                </div>

                {/* 日期區間 */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">開始日期</label>
                        <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <input
                                type="date"
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                                className="text-sm outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">結束日期</label>
                        <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <input
                                type="date"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                                className="text-sm outline-none"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => void loadStats()}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        查詢
                    </button>
                    {stats && (
                        <button
                            onClick={() => exportToCsv(stats)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition ml-auto"
                        >
                            <Download className="w-4 h-4" />
                            下載 CSV
                        </button>
                    )}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                {loading && !stats && (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        載入中…
                    </div>
                )}

                {stats && (
                    <>
                        {/* Summary */}
                        <SummaryCard stats={stats} />

                        {/* 4 個 dimension tables */}
                        <DimensionSection title="依案件類別">
                            <SimpleTable
                                headers={['類別', '通過', '不通過', '通過率']}
                                rows={stats.byCategory.map(c => {
                                    const total = c.approved + c.rejected;
                                    const rate = total === 0 ? '—' : `${((c.approved / total) * 100).toFixed(1)}%`;
                                    return {
                                        cells: [
                                            { value: CATEGORY_LABEL_MAP[c.category] ?? c.category },
                                            { value: c.approved, onClick: c.approved > 0 ? () => openDrillDown({ dimension: 'category', dimensionValue: c.category, outcome: 'approved', title: `類別 ${c.category} - 通過案件` }) : undefined },
                                            { value: c.rejected, onClick: c.rejected > 0 ? () => openDrillDown({ dimension: 'category', dimensionValue: c.category, outcome: 'rejected', title: `類別 ${c.category} - 不通過案件` }) : undefined },
                                            { value: rate },
                                        ],
                                    };
                                })}
                            />
                        </DimensionSection>

                        <DimensionSection title="依承辦人">
                            <SimpleTable
                                headers={['承辦人', '通過', '不通過', '通過率']}
                                rows={stats.byOfficer.length === 0 ? [{ cells: [{ value: '（區間內無承辦人案件）', colSpan: 4 }] }] :
                                    stats.byOfficer.map(o => {
                                        const total = o.approved + o.rejected;
                                        const rate = total === 0 ? '—' : `${((o.approved / total) * 100).toFixed(1)}%`;
                                        const officerKey = o.officerId ?? 'null';
                                        return {
                                            cells: [
                                                { value: o.officerName },
                                                { value: o.approved, onClick: o.approved > 0 ? () => openDrillDown({ dimension: 'officer', dimensionValue: officerKey, outcome: 'approved', title: `承辦人 ${o.officerName} - 通過案件` }) : undefined },
                                                { value: o.rejected, onClick: o.rejected > 0 ? () => openDrillDown({ dimension: 'officer', dimensionValue: officerKey, outcome: 'rejected', title: `承辦人 ${o.officerName} - 不通過案件` }) : undefined },
                                                { value: rate },
                                            ],
                                        };
                                    })}
                            />
                        </DimensionSection>

                        <DimensionSection title="依案件來源">
                            <SimpleTable
                                headers={['來源', '通過', '不通過', '通過率']}
                                rows={[
                                    (() => {
                                        const s = stats.bySource.selfApply;
                                        const total = s.approved + s.rejected;
                                        const rate = total === 0 ? '—' : `${((s.approved / total) * 100).toFixed(1)}%`;
                                        return {
                                            cells: [
                                                { value: '自提' },
                                                { value: s.approved, onClick: s.approved > 0 ? () => openDrillDown({ dimension: 'source', dimensionValue: 'self', outcome: 'approved', title: '自提 - 通過案件' }) : undefined },
                                                { value: s.rejected, onClick: s.rejected > 0 ? () => openDrillDown({ dimension: 'source', dimensionValue: 'self', outcome: 'rejected', title: '自提 - 不通過案件' }) : undefined },
                                                { value: rate },
                                            ],
                                        };
                                    })(),
                                    ...stats.bySource.referrals.map(r => {
                                        const total = r.approved + r.rejected;
                                        const rate = total === 0 ? '—' : `${((r.approved / total) * 100).toFixed(1)}%`;
                                        const ruKey = `referral:${r.referralUnitId ?? 'null'}`;
                                        return {
                                            cells: [
                                                { value: `轉介 - ${r.referralUnitName}` },
                                                { value: r.approved, onClick: r.approved > 0 ? () => openDrillDown({ dimension: 'source', dimensionValue: ruKey, outcome: 'approved', title: `${r.referralUnitName} - 通過案件` }) : undefined },
                                                { value: r.rejected, onClick: r.rejected > 0 ? () => openDrillDown({ dimension: 'source', dimensionValue: ruKey, outcome: 'rejected', title: `${r.referralUnitName} - 不通過案件` }) : undefined },
                                                { value: rate },
                                            ],
                                        };
                                    }),
                                ]}
                            />
                        </DimensionSection>

                        <DimensionSection title="依月份">
                            <SimpleTable
                                headers={['月份', '通過', '不通過', '通過率']}
                                rows={stats.byMonth.map(m => {
                                    const total = m.approved + m.rejected;
                                    const rate = total === 0 ? '—' : `${((m.approved / total) * 100).toFixed(1)}%`;
                                    return {
                                        cells: [
                                            { value: m.yearMonth },
                                            { value: m.approved, onClick: m.approved > 0 ? () => openDrillDown({ dimension: 'month', dimensionValue: m.yearMonth, outcome: 'approved', title: `${m.yearMonth} - 通過案件` }) : undefined },
                                            { value: m.rejected, onClick: m.rejected > 0 ? () => openDrillDown({ dimension: 'month', dimensionValue: m.yearMonth, outcome: 'rejected', title: `${m.yearMonth} - 不通過案件` }) : undefined },
                                            { value: rate },
                                        ],
                                    };
                                })}
                            />
                        </DimensionSection>
                    </>
                )}

                {drillDown && stats && (
                    <CaseStatisticsDrillDownModal
                        fromDate={stats.fromDate}
                        toDate={stats.toDate}
                        dimension={drillDown.dimension}
                        dimensionValue={drillDown.dimensionValue}
                        outcome={drillDown.outcome}
                        operatorUserId={operatorUserId}
                        title={drillDown.title}
                        onClose={closeDrillDown}
                    />
                )}
            </main>
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function SummaryCard({ stats }: { stats: CaseStatistics }) {
    const t = stats.total;
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="通過" value={t.approved} color="text-emerald-600" />
            <Stat label="不通過" value={t.rejected} color="text-red-600" />
            <Stat label="通過率" value={`${(t.approvalRate * 100).toFixed(1)}%`} color="text-blue-600" />
            <Stat label="進行中（不列入統計）" value={t.inProgress} color="text-slate-400" small />
        </div>
    );
}

function Stat({ label, value, color, small }: { label: string; value: number | string; color: string; small?: boolean }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`${small ? 'text-2xl' : 'text-3xl'} font-bold ${color}`}>{value}</p>
        </div>
    );
}

function DimensionSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
            </div>
            {children}
        </section>
    );
}

interface TableCell {
    value: number | string;
    onClick?: () => void;
    colSpan?: number;
}
interface TableRow { cells: TableCell[]; }

function SimpleTable({ headers, rows }: { headers: string[]; rows: TableRow[] }) {
    return (
        <table className="w-full text-sm table-fixed">
            {/* 固定欄寬：第一欄 40%（類別/承辦人/來源/月份），其餘三欄（通過/不通過/通過率）平分剩餘 60%，
                讓四張表橫向數字欄對齊且不擠在右側。 */}
            <colgroup>
                <col style={{ width: '40%' }} />
                {headers.slice(1).map((_, i) => (
                    <col key={i} style={{ width: '20%' }} />
                ))}
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                    {headers.map((h, i) => (
                        <th key={i} className={`py-2.5 px-4 text-xs font-semibold text-slate-500 ${i === 0 ? 'text-left' : 'text-right'}`}>
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((r, ri) => (
                    <tr key={ri} className="border-b border-slate-50 hover:bg-slate-50">
                        {r.cells.map((c, ci) => (
                            <td key={ci} colSpan={c.colSpan} className={`py-2.5 px-4 ${ci === 0 ? 'text-left text-slate-700' : 'text-right'}`}>
                                {c.onClick ? (
                                    <button
                                        type="button"
                                        onClick={c.onClick}
                                        className="text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline cursor-pointer"
                                    >
                                        {c.value}
                                    </button>
                                ) : (
                                    <span className={typeof c.value === 'number' && c.value === 0 ? 'text-slate-300' : 'text-slate-700'}>
                                        {c.value}
                                    </span>
                                )}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// ─── CSV export ───────────────────────────────────────────────────────────

/** 把 CSV cell 轉義（雙引號 + 包裹） */
function csvCell(v: string | number): string {
    const s = String(v);
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}
function csvRow(...cells: (string | number)[]): string {
    return cells.map(csvCell).join(',');
}

function exportToCsv(stats: CaseStatistics): void {
    const lines: string[] = [];

    // 1. 總覽
    lines.push(csvRow('總覽'));
    lines.push(csvRow('區間', `${stats.fromDate} ~ ${stats.toDate}`));
    lines.push(csvRow('指標', '數值'));
    lines.push(csvRow('通過', stats.total.approved));
    lines.push(csvRow('不通過', stats.total.rejected));
    lines.push(csvRow('通過率', `${(stats.total.approvalRate * 100).toFixed(2)}%`));
    lines.push(csvRow('進行中（不列入統計）', stats.total.inProgress));
    lines.push('');

    // 2. 依類別
    lines.push(csvRow('依類別'));
    lines.push(csvRow('類別', '通過', '不通過'));
    for (const c of stats.byCategory) {
        lines.push(csvRow(CATEGORY_LABEL_MAP[c.category] ?? c.category, c.approved, c.rejected));
    }
    lines.push('');

    // 3. 依承辦人
    lines.push(csvRow('依承辦人'));
    lines.push(csvRow('承辦人', '通過', '不通過'));
    if (stats.byOfficer.length === 0) {
        lines.push(csvRow('（無資料）', 0, 0));
    } else {
        for (const o of stats.byOfficer) {
            lines.push(csvRow(o.officerName, o.approved, o.rejected));
        }
    }
    lines.push('');

    // 4. 依案件來源
    lines.push(csvRow('依案件來源'));
    lines.push(csvRow('來源', '通過', '不通過'));
    lines.push(csvRow('自提', stats.bySource.selfApply.approved, stats.bySource.selfApply.rejected));
    for (const r of stats.bySource.referrals) {
        lines.push(csvRow(`轉介 - ${r.referralUnitName}`, r.approved, r.rejected));
    }
    lines.push('');

    // 5. 依月份
    lines.push(csvRow('依月份'));
    lines.push(csvRow('月份', '通過', '不通過'));
    for (const m of stats.byMonth) {
        lines.push(csvRow(m.yearMonth, m.approved, m.rejected));
    }

    // 加 BOM + 觸發下載
    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `case_statistics_${stats.fromDate}_to_${stats.toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
