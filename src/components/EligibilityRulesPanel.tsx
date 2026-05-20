'use client';

/**
 * 申請規則設定（後台 admin tab）— 對應修改計畫 #2 + #3
 *
 * 4 個區塊：
 *   1. 補助金額上限（依子類型）
 *   2. 共同條件（年齡 / 不動產）
 *   3. 經濟弱勢資格（存款 / 月收入）
 *   4. 小康家庭資格矩陣（8 列）
 *
 * 全部來自 DB（無 hardcode 預設）；所有變更需 admin 角色。
 */

import { useCallback, useEffect, useState } from 'react';
import { Save, RefreshCw, FileText } from 'lucide-react';
import { useToast } from './FloatingToast';
import {
    fetchEligibilityRules,
    updateSubsidyAmountLimit,
    updateMidClassMatrixEntry,
    updateCommonEligibility,
    type EligibilityRulesSnapshot,
    type MidClassMatrixEntry,
} from '../app/actions/eligibilityRulesActions';
import {
    SUBSIDY_SUBTYPE_LABEL,
    MARITAL_STATUS_LABEL,
    CHILDREN_STATUS_LABEL,
    type SubsidySubtype,
    type MaritalStatus,
    type ChildrenStatus,
} from '../lib/eligibilityConstants';

interface Props { operatorUserId: string; }

export function EligibilityRulesPanel({ operatorUserId }: Props) {
    const [snapshot, setSnapshot] = useState<EligibilityRulesSnapshot | null>(null);
    const [loading, setLoading] = useState(true);

    // ── 編輯緩存（dirty tracking） ──────────────────────────────────────
    const [amountEdits, setAmountEdits] = useState<Record<SubsidySubtype, string>>({} as never);
    const [commonEdits, setCommonEdits] = useState<{
        ageMin: string; ageMax: string; realEstateMax: string;
        econDepositMax: string; econMonthlyIncomeMax: string;
    }>({ ageMin: '', ageMax: '', realEstateMax: '', econDepositMax: '', econMonthlyIncomeMax: '' });
    const [matrixEdits, setMatrixEdits] = useState<Record<string, { incomeMin: string; incomeMax: string; assetsMax: string }>>({});

    const [savingKey, setSavingKey] = useState<string>('');
    const { push: pushToast } = useToast();

    /**
     * 載入規則 snapshot。
     * silent=true 時不切換 loading 狀態（避免儲存後整個面板被替換成「載入中…」造成捲頁回頂）。
     * 第一次掛載 / 使用者按「重新載入」按鈕才用 silent=false。
     */
    const load = useCallback(async (silent: boolean = false) => {
        if (!silent) setLoading(true);
        try {
            const s = await fetchEligibilityRules();
            setSnapshot(s);
            setAmountEdits({
                '1': String(s.amountLimits.find(x => x.subsidyType === '1')?.amountMax ?? 0),
                '2': String(s.amountLimits.find(x => x.subsidyType === '2')?.amountMax ?? 0),
            });
            setCommonEdits({
                ageMin: String(s.common.ageMin),
                ageMax: String(s.common.ageMax),
                realEstateMax: String(s.common.realEstateMax),
                econDepositMax: String(s.common.econDepositMax),
                econMonthlyIncomeMax: String(s.common.econMonthlyIncomeMax),
            });
            const m: typeof matrixEdits = {};
            s.midClassMatrix.forEach(e => {
                m[`${e.maritalStatus}-${e.childrenStatus}`] = {
                    incomeMin: String(e.incomeMin),
                    incomeMax: String(e.incomeMax),
                    assetsMax: String(e.assetsMax),
                };
            });
            setMatrixEdits(m);
        } catch (e) {
            pushToast({ type: 'error', msg: e instanceof Error ? e.message : '載入失敗' });
        } finally {
            if (!silent) setLoading(false);
        }
    }, [pushToast]);

    useEffect(() => { void load(false); }, [load]);

    const handleSaveAmount = async (subtype: SubsidySubtype) => {
        setSavingKey(`amount:${subtype}`);
        const res = await updateSubsidyAmountLimit(operatorUserId, subtype, Number(amountEdits[subtype]));
        setSavingKey('');
        if (res.success) {
            pushToast({ type: 'success', msg: `已儲存 ${SUBSIDY_SUBTYPE_LABEL[subtype]} 補助上限` });
            void load(true);  // silent reload — 避免儲存後捲頁回頂
        } else pushToast({ type: 'error', msg: res.error ?? '儲存失敗' });
    };

    const handleSaveCommon = async () => {
        setSavingKey('common');
        const res = await updateCommonEligibility(operatorUserId, {
            ageMin: Number(commonEdits.ageMin),
            ageMax: Number(commonEdits.ageMax),
            realEstateMax: Number(commonEdits.realEstateMax),
            econDepositMax: Number(commonEdits.econDepositMax),
            econMonthlyIncomeMax: Number(commonEdits.econMonthlyIncomeMax),
        });
        setSavingKey('');
        if (res.success) {
            pushToast({ type: 'success', msg: '已儲存共同條件 + 經濟弱勢門檻' });
            void load(true);  // silent reload — 避免儲存後捲頁回頂
        } else pushToast({ type: 'error', msg: res.error ?? '儲存失敗' });
    };

    const handleSaveMatrixRow = async (m: MaritalStatus, c: ChildrenStatus) => {
        const key = `${m}-${c}`;
        const v = matrixEdits[key];
        if (!v) return;
        setSavingKey(`matrix:${key}`);
        const res = await updateMidClassMatrixEntry(
            operatorUserId, m, c,
            Number(v.incomeMin), Number(v.incomeMax), Number(v.assetsMax),
        );
        setSavingKey('');
        if (res.success) {
            pushToast({ type: 'success', msg: `已儲存 ${MARITAL_STATUS_LABEL[m]}/${CHILDREN_STATUS_LABEL[c]}` });
            void load(true);  // silent reload — 避免儲存後捲頁回頂
        } else pushToast({ type: 'error', msg: res.error ?? '儲存失敗' });
    };

    if (loading || !snapshot) {
        return (
            <div className="flex items-center justify-center py-20 text-sm text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />載入中…
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-700">申請規則設定（115 年辦法）</h2>
                </div>
                <button
                    type="button"
                    onClick={() => void load(false)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                    <RefreshCw className="w-3 h-3" />重新載入
                </button>
            </div>

            {/* ── 1. 補助金額上限 ─────────────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-700">① 補助金額上限（115 辦法第三條）</h3>
                <p className="text-xs text-slate-500">每一申請人不限年度累計補助上限（單位：元）</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['1', '2'] as SubsidySubtype[]).map(st => (
                        <div key={st} className="border border-slate-200 rounded-lg p-3 space-y-2">
                            <label className="text-xs font-medium text-slate-700">{SUBSIDY_SUBTYPE_LABEL[st]}</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={amountEdits[st] ?? ''}
                                    onChange={e => setAmountEdits(p => ({ ...p, [st]: e.target.value }))}
                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                />
                                <span className="text-xs text-slate-500">元</span>
                                <button
                                    onClick={() => handleSaveAmount(st)}
                                    disabled={savingKey === `amount:${st}`}
                                    className="inline-flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                                >
                                    <Save className="w-3 h-3" />儲存
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 2. 共同條件 + 經濟弱勢 ─────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-700">② 共同條件 + 經濟弱勢資格</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="年齡下限" unit="歲" value={commonEdits.ageMin}
                        onChange={v => setCommonEdits(p => ({ ...p, ageMin: v }))} />
                    <Field label="年齡上限" unit="歲" value={commonEdits.ageMax}
                        onChange={v => setCommonEdits(p => ({ ...p, ageMax: v }))} />
                    <Field label="不動產上限" unit="萬" value={commonEdits.realEstateMax}
                        onChange={v => setCommonEdits(p => ({ ...p, realEstateMax: v }))}
                        hint="戶籍內直系合計：土地公告現值＋房屋評定價" />
                    <Field label="【經濟弱勢】存款上限" unit="萬" value={commonEdits.econDepositMax}
                        onChange={v => setCommonEdits(p => ({ ...p, econDepositMax: v }))}
                        hint="配偶取平均" />
                    <Field label="【經濟弱勢】月收入上限" unit="萬" value={commonEdits.econMonthlyIncomeMax}
                        onChange={v => setCommonEdits(p => ({ ...p, econMonthlyIncomeMax: v }))}
                        hint="配偶取平均" />
                </div>
                <div>
                    <button
                        onClick={handleSaveCommon}
                        disabled={savingKey === 'common'}
                        className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                    >
                        <Save className="w-3.5 h-3.5" />儲存共同條件
                    </button>
                </div>
            </section>

            {/* ── 3. 小康家庭矩陣 ─────────────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-700">③ 小康家庭資格矩陣（115 辦法第四條第三項第 2 款）</h3>
                <p className="text-xs text-slate-500">收入下限 ~ 上限（萬元）；單位：萬元。已婚 = 配偶合計；單親/單身 = 個人收入。</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 text-xs">
                                <th className="px-3 py-2 text-left">婚姻狀態</th>
                                <th className="px-3 py-2 text-left">子女</th>
                                <th className="px-3 py-2 text-right">年收入下限（萬）</th>
                                <th className="px-3 py-2 text-right">年收入上限（萬）</th>
                                <th className="px-3 py-2 text-right">存款＋有價證券（萬）</th>
                                <th className="px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {snapshot.midClassMatrix.map((e: MidClassMatrixEntry) => {
                                const key = `${e.maritalStatus}-${e.childrenStatus}`;
                                const v = matrixEdits[key] ?? { incomeMin: '', incomeMax: '', assetsMax: '' };
                                return (
                                    <tr key={key} className="border-b border-slate-100">
                                        <td className="px-3 py-2 text-slate-700">{MARITAL_STATUS_LABEL[e.maritalStatus]}</td>
                                        <td className="px-3 py-2 text-slate-700">{CHILDREN_STATUS_LABEL[e.childrenStatus]}</td>
                                        <td className="px-2 py-1">
                                            <input type="number" value={v.incomeMin}
                                                onChange={ev => setMatrixEdits(p => ({ ...p, [key]: { ...v, incomeMin: ev.target.value } }))}
                                                className="w-24 border border-slate-300 rounded px-2 py-1 text-right text-sm" />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input type="number" value={v.incomeMax}
                                                onChange={ev => setMatrixEdits(p => ({ ...p, [key]: { ...v, incomeMax: ev.target.value } }))}
                                                className="w-24 border border-slate-300 rounded px-2 py-1 text-right text-sm" />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input type="number" value={v.assetsMax}
                                                onChange={ev => setMatrixEdits(p => ({ ...p, [key]: { ...v, assetsMax: ev.target.value } }))}
                                                className="w-24 border border-slate-300 rounded px-2 py-1 text-right text-sm" />
                                        </td>
                                        <td className="px-2 py-1">
                                            <button
                                                onClick={() => handleSaveMatrixRow(e.maritalStatus, e.childrenStatus)}
                                                disabled={savingKey === `matrix:${key}`}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-40"
                                            >
                                                <Save className="w-3 h-3" />存
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-slate-400">※ 矩陣為固定 8 列（已婚 3 + 單親 2 + 單身 3）；如需新增/移除列，請聯絡開發者調整 schema。</p>
            </section>
        </div>
    );
}

// ── 子元件 ────────────────────────────────────────────────────────────
function Field({
    label, value, unit, hint, onChange,
}: {
    label: string; value: string; unit: string; hint?: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">{label}</label>
            <div className="flex items-center gap-1">
                <input type="number" value={value} onChange={e => onChange(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <span className="text-xs text-slate-500 w-6">{unit}</span>
            </div>
            {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
        </div>
    );
}
