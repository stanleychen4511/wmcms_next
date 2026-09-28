'use client';

/**
 * 董事審核所需天數（WMCMS-9 #84）— 案件統計頁中的後台區塊。
 * 僅 admin／非董事身分的主管可見：元件先向 server 確認權限，無權限時不渲染任何內容，
 * 董事帳號即使進入案件統計頁也不會看到此區塊（server 端查詢亦會拒絕）。
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Timer } from 'lucide-react';
import {
    canViewBoardReviewDurations,
    fetchBoardReviewDurations,
    type BoardReviewDurationReport,
} from '../app/actions/boardReviewDurationActions';
import { formatRocDateOnly } from '../lib/rocDate';

interface Props {
    operatorUserId: string;
    /** 派案日區間（YYYY-MM-DD），與頁面日期篩選連動 */
    fromDate: string;
    toDate: string;
    /** 頁面「查詢」按鈕每按一次遞增，觸發重新載入 */
    reloadKey: number;
}

const dayText = (n: number | null) => (n == null ? '—' : `${n} 天`);

function toLocalDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return formatRocDateOnly(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
}

export function BoardReviewDurationSection({ operatorUserId, fromDate, toDate, reloadKey }: Props) {
    const [allowed, setAllowed] = useState(false);
    const [report, setReport] = useState<BoardReviewDurationReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void canViewBoardReviewDurations(operatorUserId).then(ok => { if (!cancelled) setAllowed(ok); });
        return () => { cancelled = true; };
    }, [operatorUserId]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetchBoardReviewDurations(operatorUserId, { from: fromDate, to: toDate });
            if (res.success) setReport(res.data);
            else { setError(res.error); setReport(null); }
        } finally {
            setLoading(false);
        }
        // 只在允許檢視或按下查詢時載入；日期變動需按查詢
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [operatorUserId, reloadKey]);

    useEffect(() => {
        if (allowed) void load();
    }, [allowed, load]);

    if (!allowed) return null;

    return (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
                <Timer className="w-5 h-5 text-purple-600" />
                <h2 className="text-base font-bold text-slate-800">董事審核所需天數</h2>
                <span className="text-xs text-slate-500">
                    依派案日篩選；天數 = 派案日到該董事首次完成簽核（改派後重新起算）。本區僅後台人員可見，董事無法查看。
                </span>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />}
            </div>
            {error ? (
                <p className="px-5 py-4 text-sm text-rose-600">{error}</p>
            ) : !report || report.members.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400 text-center">{loading ? '載入中…' : '此區間沒有董事審核紀錄'}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className={`w-full text-sm transition-opacity ${loading ? 'opacity-60' : ''}`}>
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="py-2.5 px-4 text-left">董事</th>
                                <th className="py-2.5 px-4 text-right">已完成</th>
                                <th className="py-2.5 px-4 text-right">平均</th>
                                <th className="py-2.5 px-4 text-right">中位數</th>
                                <th className="py-2.5 px-4 text-right">最長</th>
                                <th className="py-2.5 px-4 text-right">審核中</th>
                                <th className="py-2.5 px-4 text-right">審核中最久</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.members.map(m => {
                                const isOpen = expanded === m.signerUserId;
                                const cases = report.items.filter(i => i.signerUserId === m.signerUserId);
                                return (
                                    <Fragment key={m.signerUserId}>
                                        <tr className="border-b border-slate-50 hover:bg-slate-50">
                                            <td className="py-2.5 px-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpanded(isOpen ? null : m.signerUserId)}
                                                    className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-700"
                                                    aria-expanded={isOpen}
                                                >
                                                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    {m.signerName}
                                                    {m.isChairman && <span className="ml-1 text-[11px] text-purple-600">（董事長）</span>}
                                                </button>
                                            </td>
                                            <td className="py-2.5 px-4 text-right tabular-nums">{m.completedCount}</td>
                                            <td className="py-2.5 px-4 text-right tabular-nums">{dayText(m.avgDays)}</td>
                                            <td className="py-2.5 px-4 text-right tabular-nums">{dayText(m.medianDays)}</td>
                                            <td className="py-2.5 px-4 text-right tabular-nums">{dayText(m.maxDays)}</td>
                                            <td className="py-2.5 px-4 text-right tabular-nums">{m.pendingCount}</td>
                                            <td className={`py-2.5 px-4 text-right tabular-nums ${m.maxPendingDays != null && m.maxPendingDays >= 14 ? 'text-rose-600 font-semibold' : ''}`}>
                                                {dayText(m.maxPendingDays)}
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="bg-slate-50/60">
                                                <td colSpan={7} className="px-4 py-2">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="text-slate-500">
                                                                <th className="py-1 px-2 text-left">案號</th>
                                                                <th className="py-1 px-2 text-left">派案日</th>
                                                                <th className="py-1 px-2 text-left">簽核日</th>
                                                                <th className="py-1 px-2 text-right">天數</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {cases.map((c, idx) => (
                                                                <tr key={`${c.applicationId}-${c.assignedAt}-${idx}`} className="border-t border-slate-100">
                                                                    <td className="py-1 px-2 font-mono">{c.caseNumber}</td>
                                                                    <td className="py-1 px-2">{toLocalDate(c.assignedAt)}</td>
                                                                    <td className="py-1 px-2">{c.signedAt ? toLocalDate(c.signedAt) : <span className="text-amber-600">審核中</span>}</td>
                                                                    <td className="py-1 px-2 text-right tabular-nums">{c.days} 天</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
