'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import {
    fetchCaseStatisticsDrillDown,
    type StatsDimension,
    type StatsOutcome,
    type StatsDrillDownRow,
} from '../app/actions/caseStatisticsActions';

interface Props {
    fromDate: string;
    toDate: string;
    dimension: StatsDimension;
    dimensionValue: string;
    outcome: StatsOutcome;
    operatorUserId: string;
    title: string;
    onClose: () => void;
}

function truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    return s.slice(0, max) + '…';
}

export function CaseStatisticsDrillDownModal({
    fromDate,
    toDate,
    dimension,
    dimensionValue,
    outcome,
    operatorUserId,
    title,
    onClose,
}: Props) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [rows, setRows] = useState<StatsDrillDownRow[]>([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            const res = await fetchCaseStatisticsDrillDown(
                operatorUserId,
                fromDate,
                toDate,
                dimension,
                dimensionValue,
                outcome
            );
            if (cancelled) return;
            setLoading(false);
            if (res.success) setRows(res.data);
            else setError(res.error);
        })();
        return () => { cancelled = true; };
    }, [fromDate, toDate, dimension, dimensionValue, outcome, operatorUserId]);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                    <h3 className="text-base font-bold text-slate-800">
                        {title}
                        {!loading && !error && (
                            <span className="ml-2 text-xs text-slate-500 font-normal">（{rows.length} 筆）</span>
                        )}
                    </h3>
                    <button onClick={onClose} type="button">
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            載入中…
                        </div>
                    ) : error ? (
                        <div className="m-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            {error}
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">（無資料）</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                <tr>
                                    <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500">案號</th>
                                    <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500">申請人</th>
                                    <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500">收件日期</th>
                                    <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500">核准金額</th>
                                    <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500">最近審核意見</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.caseId} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="py-2.5 px-4 font-mono text-xs">{r.caseNumber}</td>
                                        <td className="py-2.5 px-4">{r.applicantName}</td>
                                        <td className="py-2.5 px-4 text-slate-600">{r.applyAt}</td>
                                        <td className="py-2.5 px-4 text-right">
                                            {r.approvedAmount != null && r.approvedAmount > 0 ? (
                                                <span className="text-emerald-700 font-medium">${r.approvedAmount.toLocaleString()}</span>
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-4 text-xs text-slate-600 max-w-md">
                                            {r.latestComment ? truncate(r.latestComment, 60) : <span className="text-slate-300">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-slate-100 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
                    >
                        關閉
                    </button>
                </div>
            </div>
        </div>
    );
}
