'use client';
/**
 * 首頁年度預算警示（WMCMS-8 #83）：任一類別剩餘預算 ≤ 警戒金額（或已超出）時，
 * 顯示常駐橫幅，並於本次登入階段首次看到時跳出提醒視窗。
 * 資料權限由 server 把守（僅內部人員），無權限或無警示時不渲染任何內容。
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { fetchBudgetStatus } from '../app/actions/budgetActions';
import { BUDGET_SUBTYPE_LABEL, rocYearLabel, type BudgetCategoryStatus } from '../lib/annualBudget';

const money = (n: number | null) => (n == null ? '—' : `NT$ ${n.toLocaleString()}`);

function readSeen(key: string): boolean {
    try { return window.sessionStorage.getItem(key) === '1'; } catch { return false; }
}
function markSeen(key: string) {
    try { window.sessionStorage.setItem(key, '1'); } catch { /* ignore */ }
}

export function BudgetAlertBanner({ operatorUserId }: { operatorUserId: string }) {
    const [year, setYear] = useState<number | null>(null);
    const [alerts, setAlerts] = useState<BudgetCategoryStatus[]>([]);
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void fetchBudgetStatus(operatorUserId).then(res => {
            if (cancelled || !res.success) return;
            const hits = res.data.categories.filter(c => c.level === 'warning' || c.level === 'exceeded');
            setYear(res.data.fiscalYear);
            setAlerts(hits);
            const key = `budgetAlert:${res.data.fiscalYear}:${hits.map(h => `${h.subsidySubtype}-${h.level}`).join(',')}`;
            if (hits.length > 0 && !readSeen(key)) {
                setShowPopup(true);
                markSeen(key);
            }
        });
        return () => { cancelled = true; };
    }, [operatorUserId]);

    if (alerts.length === 0 || year == null) return null;

    const lines = alerts.map(a => (
        <li key={a.subsidySubtype}>
            <span className="font-semibold">{BUDGET_SUBTYPE_LABEL[a.subsidySubtype]}</span>
            {a.level === 'exceeded' ? '已超出預算' : '已達警戒'}：
            剩餘 {money(a.remainingAmount)}（預算 {money(a.budgetAmount)}、已撥 {money(a.disbursedAmount)}、警戒 {money(a.warningAmount)}）
        </li>
    ));

    return (
        <>
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-3 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    {rocYearLabel(year)}補助預算提醒
                </div>
                <ul className="mt-1 space-y-0.5 text-xs">{lines}</ul>
            </div>

            {showPopup && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPopup(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <h3 className="text-base font-bold text-slate-800">{rocYearLabel(year)}補助預算已達警戒</h3>
                            <button type="button" onClick={() => setShowPopup(false)} className="ml-auto text-slate-400 hover:text-slate-600" aria-label="關閉">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <ul className="p-4 space-y-2 text-sm text-slate-700">{lines}</ul>
                        <div className="px-4 pb-4 flex justify-end">
                            <button type="button" onClick={() => setShowPopup(false)}
                                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg">
                                我知道了
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
