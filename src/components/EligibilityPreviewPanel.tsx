'use client';

/**
 * 民眾自助資格初步篩選面板（修改計畫 #4）
 *
 * 用途：在 ExternalIntake / NewApplicationPage 的資格表單填寫過程中，
 * 即時呼叫 `checkEligibility(form, rules)` 顯示是否符合 115 年辦法資格。
 *
 * - 預設僅在 form 值變動時 re-render；rules 只在 mount 時 fetch 一次。
 * - 不阻擋送出（仍允許不符資格者送件，由承辦人複審）。
 */

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, ShieldQuestion } from 'lucide-react';
import { fetchEligibilityRules, type EligibilityRulesSnapshot } from '../app/actions/eligibilityRulesActions';
import { checkEligibility, type ApplicantData } from '../utils/eligibility';
import type { ApplicantFormValues } from '../schemas/applicant';

interface Props {
    /** 目前資格表單的值（即時 watch）；可為 undefined（form 尚未初始化） */
    formValues: ApplicantFormValues | null | undefined;
    /** 是否要顯示（例如尚未選擇子類型可隱藏） */
    show?: boolean;
}

export function EligibilityPreviewPanel({ formValues, show = true }: Props) {
    const [rules, setRules] = useState<EligibilityRulesSnapshot | null>(null);
    const [rulesError, setRulesError] = useState('');

    useEffect(() => {
        let alive = true;
        fetchEligibilityRules()
            .then(r => { if (alive) setRules(r); })
            .catch(e => { if (alive) setRulesError(e instanceof Error ? e.message : '無法載入資格規則'); });
        return () => { alive = false; };
    }, []);

    const result = useMemo(() => {
        if (!rules || !formValues) return null;
        const subtype = formValues.subsidyType;
        if (subtype !== '1' && subtype !== '2') return null; // 尚未選子類型不評估

        // 推導 maritalStatus 與 childrenStatus（form 上 type 已是 '1'/'2'/'3'）
        const maritalStatus = (formValues.type === '1' || formValues.type === '2' || formValues.type === '3')
            ? formValues.type : '3';
        const hasUnderage = Number(formValues.underageChildrenCount ?? 0) > 0;
        const childrenStatus = !formValues.hasChildren
            ? '3'
            : hasUnderage ? '1' : '2';

        const data: ApplicantData = {
            subsidyType: subtype,
            age: Number(formValues.age ?? 0),
            realEstateValue: Number(formValues.realEstateValue ?? 0),
            maritalStatus,
            childrenStatus,
            annualIncome:  Number(formValues.annualIncome ?? 0),
            movableAssets: Number(formValues.movableAssets ?? 0),
            deposit:       formValues.econDeposit       != null ? Number(formValues.econDeposit)       : undefined,
            monthlyIncome: formValues.econMonthlyIncome != null ? Number(formValues.econMonthlyIncome) : undefined,
        };
        return checkEligibility(data, rules);
    }, [rules, formValues]);

    if (!show) return null;

    if (rulesError) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                資格規則載入失敗：{rulesError}
            </div>
        );
    }

    // 尚未選擇子類型 → 提示
    if (!formValues || (formValues.subsidyType !== '1' && formValues.subsidyType !== '2')) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600 flex items-start gap-2">
                <ShieldQuestion className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <div>
                    <p className="font-medium">資格初步篩選</p>
                    <p className="text-xs text-slate-500 mt-0.5">請先選擇補助子類型（經濟弱勢／小康家庭），系統將即時提示資格判定結果。</p>
                </div>
            </div>
        );
    }

    if (!result) return null;

    if (result.isEligible) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                    <p className="font-medium">目前資料符合 115 年辦法之申請資格</p>
                    <p className="text-xs text-emerald-600 mt-0.5">最終仍須由承辦人覆核與文件查驗。</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-2">
            <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                <div>
                    <p className="font-medium">目前資料不符合 115 年辦法之申請資格（仍可送出，由承辦人覆核）</p>
                </div>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs ml-1">
                {result.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                ))}
            </ul>
        </div>
    );
}
