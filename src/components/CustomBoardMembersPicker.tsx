'use client';

import { useEffect, useState } from 'react';
import {
    assignCaseToCustomBoardMembers,
    fetchBoardGroupForCase,
    fetchBoardMemberCandidates,
} from '../app/actions/boardGroupActions';

interface Candidate {
    id: string;
    name: string;
    account: string;
}

interface Props {
    applicationId: string;
    operatorUserId: string;
    onAssigned: (reassigned: boolean) => void | Promise<void>;
    onError: (msg: string) => void;
    onCancel: () => void;
}

/**
 * 案件專屬董事組合：勾選任意董事組成本案的審核小組（不受一般組別「一人一組」限制）。
 * 預設勾選目前派組的成員，方便在原組基礎上增減。
 */
export function CustomBoardMembersPicker({ applicationId, operatorUserId, onAssigned, onError, onCancel }: Props) {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [candRes, caseRes] = await Promise.all([
                fetchBoardMemberCandidates(),
                fetchBoardGroupForCase(applicationId, operatorUserId),
            ]);
            if (cancelled) return;
            if (!candRes.success) {
                onError(candRes.error ?? '讀取董事名單失敗');
            } else {
                setCandidates((candRes.data ?? []).map(c => ({ id: c.id, name: c.name, account: c.account })));
            }
            if (caseRes.success && caseRes.data) {
                setSelected(new Set(caseRes.data.members.map(m => m.userId)));
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applicationId, operatorUserId]);

    const toggle = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleConfirm = async () => {
        if (selected.size === 0) {
            onError('至少需選擇一位董事');
            return;
        }
        setBusy(true);
        const res = await assignCaseToCustomBoardMembers(applicationId, Array.from(selected), operatorUserId);
        setBusy(false);
        if (!res.success) {
            onError(res.error ?? '設定專屬董事組合失敗');
            return;
        }
        await onAssigned(!!res.data?.reassigned);
    };

    return (
        <div className="w-full bg-white border border-purple-200 rounded-lg p-3 space-y-3">
            <div>
                <h5 className="text-sm font-bold text-slate-800">自訂本案審核董事</h5>
                <p className="text-xs text-slate-500 mt-0.5">
                    勾選的董事將組成本案專屬審核小組，不影響一般組別設定；重新設定後既有簽章會失效。
                </p>
            </div>
            {loading ? (
                <p className="text-sm text-slate-500">載入董事名單中…</p>
            ) : candidates.length === 0 ? (
                <p className="text-sm text-slate-500">目前沒有在職的董事帳號。</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {candidates.map(c => (
                        <label
                            key={c.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm cursor-pointer transition ${
                                selected.has(c.id)
                                    ? 'bg-purple-50 border-purple-300 text-purple-800'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={selected.has(c.id)}
                                onChange={() => toggle(c.id)}
                                disabled={busy}
                                className="accent-purple-600"
                            />
                            {c.name}
                            <span className="text-xs text-slate-400">{c.account}</span>
                        </label>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={busy || loading || selected.size === 0}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    {busy ? '設定中…' : `確認派給 ${selected.size} 位董事`}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition"
                >
                    取消
                </button>
            </div>
        </div>
    );
}
