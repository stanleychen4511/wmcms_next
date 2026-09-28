'use client';
/**
 * 後台「年度預算」設定（WMCMS-8 #83）：依年度設定經濟弱勢／小康家庭的預算與警戒金額，
 * 並即時顯示當年度已撥款、撥款中與剩餘預算。
 */
import { useCallback, useEffect, useState } from 'react';
import { Wallet, Save, Loader2 } from 'lucide-react';
import { fetchBudgetStatus, upsertAnnualBudget } from '../app/actions/budgetActions';
import {
    BUDGET_SUBTYPE_LABEL,
    rocYearLabel,
    type BudgetCategoryStatus,
    type BudgetLevel,
    type BudgetSubtype,
} from '../lib/annualBudget';
import { useToast } from './FloatingToast';

const LEVEL_BADGE: Record<BudgetLevel, { text: string; cls: string }> = {
    unset: { text: '未設定', cls: 'bg-slate-100 text-slate-600' },
    ok: { text: '正常', cls: 'bg-emerald-100 text-emerald-700' },
    warning: { text: '已達警戒', cls: 'bg-amber-100 text-amber-800' },
    exceeded: { text: '已超出預算', cls: 'bg-rose-100 text-rose-700' },
};

const money = (n: number | null) => (n == null ? '—' : `NT$ ${n.toLocaleString()}`);

function currentYear(): number {
    return new Date().getFullYear();
}

interface Draft { budget: string; warning: string }

export function AnnualBudgetManager({ operatorUserId }: { operatorUserId: string }) {
    const { push: pushToast } = useToast();
    const [year, setYear] = useState(currentYear());
    const [categories, setCategories] = useState<BudgetCategoryStatus[]>([]);
    const [drafts, setDrafts] = useState<Record<BudgetSubtype, Draft>>({ '1': { budget: '', warning: '' }, '2': { budget: '', warning: '' } });
    const [loading, setLoading] = useState(true);
    const [savingSub, setSavingSub] = useState<BudgetSubtype | null>(null);

    // silent=true：儲存後背景刷新，保留 DOM 避免捲動回頂端
    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetchBudgetStatus(operatorUserId, year);
            if (!res.success) { pushToast({ type: 'error', msg: res.error }); return; }
            setCategories(res.data.categories);
            setDrafts(prev => {
                const next = { ...prev };
                for (const c of res.data.categories) {
                    next[c.subsidySubtype] = {
                        budget: c.budgetAmount == null ? '' : String(c.budgetAmount),
                        warning: c.warningAmount == null ? '' : String(c.warningAmount),
                    };
                }
                return next;
            });
        } finally {
            if (!silent) setLoading(false);
        }
    }, [operatorUserId, year, pushToast]);

    useEffect(() => { void load(); }, [load]);

    const save = async (sub: BudgetSubtype) => {
        const budget = Number(drafts[sub].budget.replace(/,/g, ''));
        const warning = Number(drafts[sub].warning.replace(/,/g, ''));
        if (!drafts[sub].budget.trim() || !drafts[sub].warning.trim()) {
            pushToast({ type: 'error', msg: '請填寫年度預算與警戒金額' });
            return;
        }
        setSavingSub(sub);
        const res = await upsertAnnualBudget(operatorUserId, year, sub, budget, warning);
        setSavingSub(null);
        if (!res.success) { pushToast({ type: 'error', msg: res.error }); return; }
        pushToast({ type: 'success', msg: '已儲存' });
        await load(true);
    };

    const years = Array.from({ length: 5 }, (_, i) => currentYear() - 2 + i);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                        <Wallet className="w-5 h-5 text-blue-600" />
                        年度預算
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        剩餘預算 = 年度預算 − 當年度已完成撥款（依核發日期）；剩餘 ≤ 警戒金額時，首頁會提醒內部人員。撥款中的金額僅供參考，不扣預算。
                    </p>
                </div>
                <select
                    value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    aria-label="年度"
                >
                    {years.map(y => <option key={y} value={y}>{rocYearLabel(y)}</option>)}
                </select>
            </div>

            <div className="overflow-x-auto">
                <table className={`w-full text-sm ${loading ? 'opacity-60' : ''}`}>
                    <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                            <th className="py-2 px-3">類別</th>
                            <th className="py-2 px-3">年度預算（元）</th>
                            <th className="py-2 px-3">警戒金額（元）</th>
                            <th className="py-2 px-3 text-right">已撥款</th>
                            <th className="py-2 px-3 text-right">撥款中</th>
                            <th className="py-2 px-3 text-right">剩餘預算</th>
                            <th className="py-2 px-3">狀態</th>
                            <th className="py-2 px-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(['1', '2'] as BudgetSubtype[]).map(sub => {
                            const c = categories.find(x => x.subsidySubtype === sub);
                            const badge = LEVEL_BADGE[c?.level ?? 'unset'];
                            return (
                                <tr key={sub}>
                                    <td className="py-2 px-3 font-medium text-slate-800">{BUDGET_SUBTYPE_LABEL[sub]}</td>
                                    <td className="py-2 px-3">
                                        <input
                                            inputMode="numeric"
                                            value={drafts[sub].budget}
                                            onChange={e => setDrafts(d => ({ ...d, [sub]: { ...d[sub], budget: e.target.value } }))}
                                            className="w-36 border border-slate-300 rounded-lg px-2 py-1 text-sm text-right"
                                            placeholder="例：1000000"
                                            aria-label={`${BUDGET_SUBTYPE_LABEL[sub]}年度預算`}
                                        />
                                    </td>
                                    <td className="py-2 px-3">
                                        <input
                                            inputMode="numeric"
                                            value={drafts[sub].warning}
                                            onChange={e => setDrafts(d => ({ ...d, [sub]: { ...d[sub], warning: e.target.value } }))}
                                            className="w-36 border border-slate-300 rounded-lg px-2 py-1 text-sm text-right"
                                            placeholder="例：200000"
                                            aria-label={`${BUDGET_SUBTYPE_LABEL[sub]}警戒金額`}
                                        />
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">{money(c?.disbursedAmount ?? 0)}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-slate-500">{money(c?.inFlightAmount ?? 0)}</td>
                                    <td className={`py-2 px-3 text-right tabular-nums font-semibold ${c?.level === 'exceeded' ? 'text-rose-600' : c?.level === 'warning' ? 'text-amber-700' : 'text-slate-800'}`}>
                                        {money(c?.remainingAmount ?? null)}
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.text}</span>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => void save(sub)}
                                            disabled={savingSub !== null}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                                        >
                                            {savingSub === sub ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            儲存
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
