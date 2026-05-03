'use client';

/**
 * 申請人選擇 Modal — 給「快速新增關懷紀錄」flow 用。
 *
 * 流程：
 *   1. 輸入姓名 → debounced 搜尋
 *   2. 列出申請人 + 各自的案件數
 *   3. 點申請人 → 把 (userId, name, applications) 回傳給 caller
 *   4. caller 自行接下去開 ContactRecordModal(type='2')
 */

import { useEffect, useState } from 'react';
import { Search, X, Loader2, User } from 'lucide-react';
import {
    searchApplicantsForCare,
    type ApplicantSearchResult,
} from '../app/actions/contactRecordActions';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface Props {
    operatorUserId: string;
    onPick: (applicant: ApplicantSearchResult) => void;
    onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
    '1': '審核中', '2': '審核未通過', '3': '待核銷', '4': '核銷完成',
};

export function ApplicantPickerModal({ operatorUserId, onPick, onClose }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ApplicantSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [touched, setTouched] = useState(false);

    // debounce 搜尋
    useEffect(() => {
        const id = setTimeout(async () => {
            const trimmed = query.trim();
            if (trimmed.length < 1) { setResults([]); return; }
            setTouched(true);
            setLoading(true);
            const res = await searchApplicantsForCare(operatorUserId, trimmed);
            setLoading(false);
            setResults(res.success ? res.data : []);
        }, 300);
        return () => clearTimeout(id);
    }, [query, operatorUserId]);

    useModalDismiss(onClose);

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <User className="w-5 h-5 text-rose-600" />
                        選擇關懷對象（申請人）
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-5 py-3 border-b border-slate-100">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="輸入申請人姓名..."
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-400 outline-none"
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                        姓名輸入後自動搜尋（300ms）
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center py-8 text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            搜尋中…
                        </div>
                    )}
                    {!loading && touched && results.length === 0 && query.trim() && (
                        <p className="text-center text-slate-400 text-sm py-8">
                            找不到符合「{query}」的申請人
                        </p>
                    )}
                    {!loading && results.length > 0 && (
                        <div className="divide-y divide-slate-100">
                            {results.map(r => (
                                <button
                                    key={r.userId}
                                    type="button"
                                    onClick={() => onPick(r)}
                                    className="w-full text-left px-5 py-3 hover:bg-rose-50 transition"
                                >
                                    <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="text-xs text-slate-500">
                                            共 {r.applications.length} 筆案件：
                                        </span>
                                        {r.applications.slice(0, 4).map(a => (
                                            <span
                                                key={a.id}
                                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono"
                                            >
                                                {a.caseNumber}
                                                <span className={`ml-1 ${
                                                    a.status === '4' ? 'text-emerald-600'
                                                    : a.status === '2' ? 'text-rose-600'
                                                    : 'text-amber-600'
                                                }`}>
                                                    {STATUS_LABEL[a.status]}
                                                </span>
                                            </span>
                                        ))}
                                        {r.applications.length > 4 && (
                                            <span className="text-xs text-slate-400">+{r.applications.length - 4}</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}
