'use client';
import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { updateApplicationBasics, UpdateApplicationBasicsPatch } from '../app/actions/applicationActions';
import { fetchActiveReferralUnits } from '../app/actions/referralUnitActions';

export interface EditCaseBasicsInitial {
    applicantName: string;
    applicationType: 'A' | 'B' | 'C' | 'D' | string;  // 唯讀顯示用
    applicationWay: '1' | '2';
    referralUnitId: string | null;
}

const TYPE_LABEL: Record<string, string> = {
    A: 'A 類－自費醫療補助',
    B: 'B 類－臨終安寧自費醫療補助',
    C: 'C 類－預立醫療照護諮商補助',
    D: 'D 類－醫事人員進修補助',
};

interface Props {
    applicationId: string;
    operatorUserId: string;
    initial: EditCaseBasicsInitial;
    onClose: () => void;
    onSaved: () => void;
}

export function EditCaseBasicsModal({ applicationId, operatorUserId, initial, onClose, onSaved }: Props) {
    const [applicantName, setApplicantName] = useState(initial.applicantName ?? '');
    const [applicationWay, setApplicationWay] = useState<'1' | '2'>(initial.applicationWay ?? '1');
    const [referralUnitId, setReferralUnitId] = useState<string | null>(initial.referralUnitId ?? null);

    const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
    const [unitsLoaded, setUnitsLoaded] = useState(false);
    const [nameError, setNameError] = useState('');
    const [referralError, setReferralError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // Lazy-load active referral units only when user picks 轉介
    useEffect(() => {
        if (applicationWay !== '2' || unitsLoaded) return;
        (async () => {
            const res = await fetchActiveReferralUnits();
            if (res.success && res.data) {
                setUnits(res.data.map(u => ({ id: u.id, name: u.name })));
            }
            setUnitsLoaded(true);
        })();
    }, [applicationWay, unitsLoaded]);

    function validate(): boolean {
        let ok = true;
        const trimmed = applicantName.trim();
        if (trimmed.length < 1) { setNameError('姓名為必填'); ok = false; }
        else if (trimmed.length > 50) { setNameError('姓名不可超過 50 字'); ok = false; }
        else { setNameError(''); }

        if (applicationWay === '2' && !referralUnitId) {
            setReferralError('請選擇轉介單位'); ok = false;
        } else {
            setReferralError('');
        }
        return ok;
    }

    async function handleSubmit() {
        if (!validate()) return;
        setSubmitting(true);
        setServerError(null);

        // Build patch with only fields that differ from initial — keeps audit log minimal
        const patch: UpdateApplicationBasicsPatch = {};
        const trimmedName = applicantName.trim();
        if (trimmedName !== (initial.applicantName ?? '')) patch.applicantName = trimmedName;
        if (applicationWay !== initial.applicationWay) patch.applicationWay = applicationWay;
        // Always send resolved referralUnitId so server enforces the way='1' → null rule
        const resolvedUnit = applicationWay === '2' ? referralUnitId : null;
        if (resolvedUnit !== (initial.referralUnitId ?? null)) patch.referralUnitId = resolvedUnit;

        const res = await updateApplicationBasics(applicationId, patch, operatorUserId);
        setSubmitting(false);
        if (!res.success) {
            setServerError(res.error ?? '儲存失敗');
            return;
        }
        onSaved();
    }

    const nameChanged = applicantName.trim() !== (initial.applicantName ?? '');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900">編輯案件基本資訊</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="p-1 text-slate-400 hover:text-slate-600 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto">
                    {/* 姓名 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            申請人姓名 <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={applicantName}
                            onChange={e => { setApplicantName(e.target.value); setNameError(''); }}
                            maxLength={50}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                                nameError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                            }`}
                            placeholder="請輸入姓名"
                        />
                        {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
                        {nameChanged && (
                            <p className="text-xs text-amber-700 mt-1 flex items-start gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>修改姓名會同步更新此申請人名下<strong>所有案件</strong>的顯示名稱</span>
                            </p>
                        )}
                    </div>

                    {/* 申請類別（唯讀） */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">申請類別</label>
                        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600">
                            {TYPE_LABEL[initial.applicationType] ?? initial.applicationType}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>申請類別不可修改（案號已綁定首字母）。類別有誤請以「不通過結案」並重新建立新案件。</span>
                        </p>
                    </div>

                    {/* 案件來源 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">案件來源 <span className="text-red-500">*</span></label>
                        <div className="flex items-center gap-4">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="edit_app_way"
                                    value="1"
                                    checked={applicationWay === '1'}
                                    onChange={() => { setApplicationWay('1'); setReferralUnitId(null); setReferralError(''); }}
                                    className="w-4 h-4 accent-blue-600"
                                />
                                <span className="text-sm">自提</span>
                            </label>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="edit_app_way"
                                    value="2"
                                    checked={applicationWay === '2'}
                                    onChange={() => setApplicationWay('2')}
                                    className="w-4 h-4 accent-blue-600"
                                />
                                <span className="text-sm">轉介</span>
                            </label>
                        </div>

                        {applicationWay === '2' && (
                            <div className="mt-2">
                                {unitsLoaded && units.length === 0 ? (
                                    <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                        請先至後台建立轉介單位
                                    </div>
                                ) : (
                                    <>
                                        <select
                                            value={referralUnitId ?? ''}
                                            onChange={e => { setReferralUnitId(e.target.value || null); setReferralError(''); }}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                                                referralError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                                            }`}
                                        >
                                            <option value="">{unitsLoaded ? '請選擇轉介單位' : '載入中…'}</option>
                                            {units.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                        {referralError && <p className="text-xs text-red-500 mt-1">{referralError}</p>}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {serverError && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{serverError}</span>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
                    >
                        <Save className="w-4 h-4" />
                        {submitting ? '儲存中…' : '儲存'}
                    </button>
                </div>
            </div>
        </div>
    );
}
