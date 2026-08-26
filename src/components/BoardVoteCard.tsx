'use client';
import { useState, useEffect, useCallback } from 'react';
import { Gavel, Users2, Clock, AlertTriangle } from 'lucide-react';
import {
    CaseBoardInfo,
    fetchBoardGroupForCase,
} from '../app/actions/boardGroupActions';
import { formatRocDateTime } from '../lib/rocDate';

interface Props {
    applicationId: string;
    currentUserId: string;
    /** Forces re-fetch when parent signals a refresh (e.g. after re-assignment). */
    refreshKey?: number;
}

/**
 * Read-only card showing the board group assigned to a case and its members.
 * This component has NO vote interface — voting per member was removed in
 * favor of the collaborative draft model (see saveBoardReviewDraft).
 */
export function BoardVoteCard({ applicationId, currentUserId, refreshKey }: Props) {
    const [info, setInfo] = useState<CaseBoardInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await fetchBoardGroupForCase(applicationId, currentUserId);
        if (res.success) {
            setInfo(res.data ?? null);
            setError(null);
        } else {
            setError(res.error ?? '載入派組資訊失敗');
        }
        setLoading(false);
    }, [applicationId, currentUserId]);

    useEffect(() => { void load(); }, [load, refreshKey]);

    if (loading) return <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-400">載入董事派組資訊…</div>;
    if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>;
    if (!info) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>本案件尚未派組。請董事長或 admin 於「申請案件管理」頁面指派組別（或啟用自動派案）。</span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Gavel className="w-4 h-4 text-blue-600" />
                    董事審核派組
                </h3>
                <span className="text-xs text-slate-500 flex items-center gap-2">
                    <Users2 className="w-3.5 h-3.5" />
                    組別：<span className="font-semibold text-slate-700">{info.groupName}</span>
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                        {info.assignMode === 'auto' ? '自動派案' : '手動派案'}
                    </span>
                </span>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                派案時間：{info.assignedAt ? formatRocDateTime(info.assignedAt) : '—'}
            </div>

            <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500 self-center">組員：</span>
                {info.members.length === 0 ? (
                    <span className="text-xs text-red-500">（組別無成員，請洽董事長）</span>
                ) : info.members.map(m => (
                    <span key={m.userId} className="inline-flex items-center px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs">
                        {m.name} <span className="ml-1 text-blue-400">@{m.account}</span>
                    </span>
                ))}
            </div>

            <p className="text-[11px] text-slate-400">
                任一組員皆可於下方「董事審核」區塊編輯／儲存；達成共識後由組員按「通過」或「不通過結案」推進案件。
            </p>
        </div>
    );
}
