'use client';
import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { updateApplicationBasics, UpdateApplicationBasicsPatch } from '../app/actions/applicationActions';
import { fetchActiveReferralUnits, createReferralUnit } from '../app/actions/referralUnitActions';
import { useToast } from './FloatingToast';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { DateInput } from './DateInput';

export interface EditCaseBasicsInitial {
    applicantName: string;
    /** 申請人聯絡電話（必填） */
    applicantPhone?: string | null;
    /** 申請人戶籍地址（選填，但領款收據需要） */
    applicantAddress?: string | null;
    /** 出生年月日 YYYY-MM-DD（必填） */
    applicantDob?: string | null;
    /** 癌別（必填） */
    cancerType?: string | null;
    /** 癌症期數（必填） */
    cancerStage?: string | null;
    /** 申請形式：'P' 紙本 / 'E' 電子郵件（必填） */
    applicationForm?: 'P' | 'E' | null;
    /** 治療階段：'B' 治療前 / 'A' 治療後 / 'X' 治療前後（必填） */
    treatmentPhase?: 'B' | 'A' | 'X' | null;
    applicationType: 'A' | 'B' | 'C' | 'D' | string;  // 唯讀顯示用
    applicationWay: '1' | '2';
    referralUnitId: string | null;
    referralUnitName?: string | null;
    referralContactName?: string | null;
    referralContactTitle?: string | null;
    referralContactPhone?: string | null;
}

const TYPE_LABEL: Record<string, string> = {
    A: 'A 類－自費醫療補助',
    B: 'B 類－臨終安寧自費醫療補助',
    C: 'C 類－預立醫療照護諮商補助',
    D: 'D 類－醫事人員進修補助',
};

const OTHER_UNIT = 'other';

interface Props {
    applicationId: string;
    operatorUserId: string;
    initial: EditCaseBasicsInitial;
    onClose: () => void;
    onSaved: () => void;
}

export function EditCaseBasicsModal({ applicationId, operatorUserId, initial, onClose, onSaved }: Props) {
    useModalDismiss(onClose);
    const { push: pushToast } = useToast();
    const [applicantName, setApplicantName] = useState(initial.applicantName ?? '');
    const [applicantPhone, setApplicantPhone] = useState(initial.applicantPhone ?? '');
    const [phoneError, setPhoneError] = useState('');
    const [applicantAddress, setApplicantAddress] = useState(initial.applicantAddress ?? '');
    const [applicantDob, setApplicantDob] = useState(initial.applicantDob ?? '');
    const [dobError, setDobError] = useState('');
    const [cancerType, setCancerType] = useState(initial.cancerType ?? '');
    const [cancerTypeError, setCancerTypeError] = useState('');
    const [cancerStage, setCancerStage] = useState(initial.cancerStage ?? '');
    const [cancerStageError, setCancerStageError] = useState('');
    const [applicationForm, setApplicationForm] = useState<'P' | 'E' | ''>(initial.applicationForm ?? '');
    const [applicationFormError, setApplicationFormError] = useState('');
    const [treatmentPhase, setTreatmentPhase] = useState<'B' | 'A' | 'X' | ''>(initial.treatmentPhase ?? '');
    const [treatmentPhaseError, setTreatmentPhaseError] = useState('');
    const [applicationWay, setApplicationWay] = useState<'1' | '2'>(initial.applicationWay ?? '1');
    const [referralUnitId, setReferralUnitId] = useState<string | null>(initial.referralUnitId ?? null);

    // #6 4 個轉介聯絡欄位
    const [referralUnitName, setReferralUnitName] = useState(initial.referralUnitName ?? '');
    const [referralContactName, setReferralContactName] = useState(initial.referralContactName ?? '');
    const [referralContactTitle, setReferralContactTitle] = useState(initial.referralContactTitle ?? '');
    const [referralContactPhone, setReferralContactPhone] = useState(initial.referralContactPhone ?? '');

    const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
    const [unitsLoaded, setUnitsLoaded] = useState(false);
    const [nameError, setNameError] = useState('');
    const [referralError, setReferralError] = useState('');
    const [referralFieldErrors, setReferralFieldErrors] = useState<{
        unit?: string; contactName?: string; title?: string; phone?: string;
    }>({});
    const [submitting, setSubmitting] = useState(false);

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

    /**
     * 自動將 dropdown 選項對齊「轉介單位名稱」：
     *   - 名稱在 active 單位清單中找得到 → 選該單位
     *   - 找不到 → 選「其他」
     *   - 完全沒有名稱 → 不動（讓使用者手選）
     *
     * 觸發時機：unitsLoaded 變為 true、或 applicationWay 切回 '2'。不依 referralUnitName 變動，
     * 避免使用者打字時把「其他」覆蓋掉。
     */
    useEffect(() => {
        if (applicationWay !== '2' || !unitsLoaded) return;
        const trimmedName = referralUnitName.trim();
        if (!trimmedName) return;
        const matched = units.find(u => u.name === trimmedName);
        const desiredId = matched ? matched.id : OTHER_UNIT;
        if (referralUnitId !== desiredId) {
            setReferralUnitId(desiredId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applicationWay, unitsLoaded]);

    function validate(): boolean {
        let ok = true;
        const trimmed = applicantName.trim();
        if (trimmed.length < 1) { setNameError('姓名為必填'); ok = false; }
        else if (trimmed.length > 50) { setNameError('姓名不可超過 50 字'); ok = false; }
        else { setNameError(''); }

        const trimmedPhone = applicantPhone.trim();
        if (!trimmedPhone) { setPhoneError('聯絡電話為必填'); ok = false; }
        else if (trimmedPhone.length > 50) { setPhoneError('聯絡電話過長'); ok = false; }
        else { setPhoneError(''); }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(applicantDob.trim())) { setDobError('請選擇出生年月日'); ok = false; }
        else { setDobError(''); }
        if (!cancerType.trim()) { setCancerTypeError('癌別為必填'); ok = false; }
        else { setCancerTypeError(''); }
        if (!cancerStage.trim()) { setCancerStageError('癌症期數為必填'); ok = false; }
        else { setCancerStageError(''); }
        if (applicationForm !== 'P' && applicationForm !== 'E') {
            setApplicationFormError('請選擇申請形式'); ok = false;
        } else { setApplicationFormError(''); }
        if (treatmentPhase !== 'B' && treatmentPhase !== 'A' && treatmentPhase !== 'X') {
            setTreatmentPhaseError('請選擇治療階段'); ok = false;
        } else { setTreatmentPhaseError(''); }

        if (applicationWay === '2') {
            if (!referralUnitId) {
                setReferralError('請選擇轉介單位（不在清單中請選「其他」）');
                ok = false;
            } else {
                setReferralError('');
            }
            const errs: typeof referralFieldErrors = {};
            if (!referralUnitName.trim())     errs.unit        = '單位名稱必填';
            if (!referralContactName.trim())  errs.contactName = '承辦人姓名必填';
            if (!referralContactTitle.trim()) errs.title       = '承辦人職稱必填';
            if (!referralContactPhone.trim()) errs.phone       = '承辦人聯絡電話必填';
            setReferralFieldErrors(errs);
            if (Object.keys(errs).length > 0) ok = false;
        } else {
            setReferralError('');
            setReferralFieldErrors({});
        }
        return ok;
    }

    async function handleSubmit() {
        if (!validate()) return;
        setSubmitting(true);

        try {
            // 若選「其他」→ 先建立新轉介單位
            let effectiveReferralUnitId: string | null = null;
            if (applicationWay === '2') {
                if (referralUnitId === OTHER_UNIT) {
                    const createRes = await createReferralUnit(
                        referralUnitName.trim(),
                        referralContactPhone.trim() || null,
                        9999,
                        operatorUserId,
                    );
                    if (!createRes.success || !createRes.data) {
                        pushToast({ type: 'error', msg: '新增轉介單位失敗：' + (createRes.success ? '系統錯誤' : createRes.error) });
                        setSubmitting(false);
                        return;
                    }
                    effectiveReferralUnitId = createRes.data.id;
                    // 重新載入清單
                    void fetchActiveReferralUnits().then(r => {
                        if (r.success && r.data) setUnits(r.data.map(u => ({ id: u.id, name: u.name })));
                    });
                } else {
                    effectiveReferralUnitId = referralUnitId;
                }
            }

            // Build patch with only fields that differ from initial
            const patch: UpdateApplicationBasicsPatch = {};
            const trimmedName = applicantName.trim();
            if (trimmedName !== (initial.applicantName ?? '')) patch.applicantName = trimmedName;
            const trimmedPhone = applicantPhone.trim();
            if (trimmedPhone !== (initial.applicantPhone ?? '')) patch.applicantPhone = trimmedPhone;
            const trimmedAddress = applicantAddress.trim();
            if (trimmedAddress !== (initial.applicantAddress ?? '').trim()) {
                patch.applicantAddress = trimmedAddress || null;
            }
            const trimmedDob = applicantDob.trim();
            if (trimmedDob !== (initial.applicantDob ?? '')) patch.applicantDob = trimmedDob;
            const trimmedCancerType = cancerType.trim();
            if (trimmedCancerType !== (initial.cancerType ?? '')) patch.cancerType = trimmedCancerType;
            const trimmedCancerStage = cancerStage.trim();
            if (trimmedCancerStage !== (initial.cancerStage ?? '')) patch.cancerStage = trimmedCancerStage;
            if (applicationForm && applicationForm !== (initial.applicationForm ?? '')) {
                patch.applicationForm = applicationForm;
            }
            if (treatmentPhase && treatmentPhase !== (initial.treatmentPhase ?? '')) {
                patch.treatmentPhase = treatmentPhase;
            }
            if (applicationWay !== initial.applicationWay) patch.applicationWay = applicationWay;
            const resolvedUnit = applicationWay === '2' ? effectiveReferralUnitId : null;
            if (resolvedUnit !== (initial.referralUnitId ?? null)) patch.referralUnitId = resolvedUnit;

            if (applicationWay === '2') {
                // way='2' 必填欄位皆送出（即使值未改變也無妨，server 自行 diff）
                patch.referralUnitName     = referralUnitName.trim();
                patch.referralContactName  = referralContactName.trim();
                patch.referralContactTitle = referralContactTitle.trim();
                patch.referralContactPhone = referralContactPhone.trim();
            }
            // 切回自提時不送 4 欄 → server 端保留原值，下次切回轉介可重用

            const res = await updateApplicationBasics(applicationId, patch, operatorUserId);
            setSubmitting(false);
            if (!res.success) {
                pushToast({ type: 'error', msg: res.error ?? '儲存失敗' });
                return;
            }
            onSaved();
        } catch (e) {
            setSubmitting(false);
            pushToast({ type: 'error', msg: e instanceof Error ? e.message : '系統錯誤' });
        }
    }

    const nameChanged = applicantName.trim() !== (initial.applicantName ?? '');
    const lockUnitName = !!referralUnitId && referralUnitId !== OTHER_UNIT;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
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

                    {/* 申請人聯絡電話 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            申請人聯絡電話 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            value={applicantPhone}
                            onChange={e => { setApplicantPhone(e.target.value); setPhoneError(''); }}
                            maxLength={50}
                            placeholder="例：0912-345-678"
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                                phoneError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                            }`}
                        />
                        {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                    </div>

                    {/* 申請人戶籍地址（領款收據用） */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            戶籍地址
                            <span className="text-xs text-slate-400 font-normal ml-2">（產生領款收據 PDF 時會填入）</span>
                        </label>
                        <input
                            type="text"
                            value={applicantAddress}
                            onChange={e => setApplicantAddress(e.target.value)}
                            maxLength={500}
                            placeholder="例：台北市信義區市府路1號"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
                        />
                    </div>

                    {/* 出生年月日 + 癌別 + 期數 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                出生年月日 <span className="text-red-500">*</span>
                            </label>
                            <DateInput
                                value={applicantDob}
                                onChange={value => { setApplicantDob(value); setDobError(''); }}
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                                    dobError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                                }`}
                            />
                            {dobError && <p className="text-xs text-red-500 mt-1">{dobError}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                癌別 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text" maxLength={100}
                                value={cancerType}
                                onChange={e => { setCancerType(e.target.value); setCancerTypeError(''); }}
                                placeholder="例：肺腺癌"
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                                    cancerTypeError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                                }`}
                            />
                            {cancerTypeError && <p className="text-xs text-red-500 mt-1">{cancerTypeError}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                癌症期數 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text" maxLength={50}
                                value={cancerStage}
                                onChange={e => { setCancerStage(e.target.value); setCancerStageError(''); }}
                                placeholder="例：第三期、IIIA"
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                                    cancerStageError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                                }`}
                            />
                            {cancerStageError && <p className="text-xs text-red-500 mt-1">{cancerStageError}</p>}
                        </div>
                    </div>

                    {/* 申請形式 + 治療階段 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                申請形式 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2">
                                {([
                                    { v: 'P', label: '紙本' },
                                    { v: 'E', label: '電子郵件' },
                                ] as const).map(opt => (
                                    <label key={opt.v} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-sm flex-1 justify-center ${
                                        applicationForm === opt.v
                                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}>
                                        <input
                                            type="radio"
                                            checked={applicationForm === opt.v}
                                            onChange={() => { setApplicationForm(opt.v); setApplicationFormError(''); }}
                                            className="accent-blue-600"
                                        />
                                        {opt.label}
                                    </label>
                                ))}
                            </div>
                            {applicationFormError && <p className="text-xs text-red-500 mt-1">{applicationFormError}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                治療階段 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2">
                                {([
                                    { v: 'B', label: '治療前' },
                                    { v: 'A', label: '治療後' },
                                    { v: 'X', label: '治療前後' },
                                ] as const).map(opt => (
                                    <label key={opt.v} className={`inline-flex items-center gap-1 px-2 py-2 rounded-lg border cursor-pointer text-sm flex-1 justify-center ${
                                        treatmentPhase === opt.v
                                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}>
                                        <input
                                            type="radio"
                                            checked={treatmentPhase === opt.v}
                                            onChange={() => { setTreatmentPhase(opt.v); setTreatmentPhaseError(''); }}
                                            className="accent-blue-600"
                                        />
                                        {opt.label}
                                    </label>
                                ))}
                            </div>
                            {treatmentPhaseError && <p className="text-xs text-red-500 mt-1">{treatmentPhaseError}</p>}
                        </div>
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
                                    onChange={() => {
                                        setApplicationWay('1');
                                        setReferralUnitId(null);
                                        setReferralError('');
                                        setReferralFieldErrors({});
                                    }}
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
                            <div className="mt-3 space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        轉介單位 <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={referralUnitId ?? ''}
                                        onChange={e => {
                                            const v = e.target.value || null;
                                            setReferralUnitId(v);
                                            setReferralError('');
                                            if (v && v !== OTHER_UNIT) {
                                                const matched = units.find(u => u.id === v);
                                                if (matched) {
                                                    setReferralUnitName(matched.name);
                                                    setReferralFieldErrors(p => ({ ...p, unit: undefined }));
                                                }
                                            } else if (v === OTHER_UNIT) {
                                                setReferralUnitName('');
                                            } else {
                                                setReferralUnitName('');
                                            }
                                        }}
                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                                            referralError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200 focus:border-blue-400'
                                        }`}
                                    >
                                        <option value="">{unitsLoaded ? '請選擇轉介單位' : '載入中…'}</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                        <option value={OTHER_UNIT}>其他（不在清單中，提交後將自動新增）</option>
                                    </select>
                                    {referralError && <p className="text-xs text-red-500 mt-1">{referralError}</p>}
                                </div>

                                {/* 4 個必填欄位 */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                                    <p className="text-xs text-slate-500">
                                        {referralUnitId === OTHER_UNIT
                                            ? '請輸入新轉介單位名稱（提交後將自動加入轉介單位清單）；承辦窗口資訊為必填。'
                                            : '選定既有轉介單位後其名稱會自動帶入；承辦窗口資訊為必填。'}
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                轉介單位名稱 <span className="text-red-500">*</span>
                                                {lockUnitName && (
                                                    <span className="ml-1 text-[11px] text-slate-400 font-normal">（自動帶入，不可修改）</span>
                                                )}
                                            </label>
                                            <input
                                                type="text" maxLength={100}
                                                value={referralUnitName}
                                                onChange={e => {
                                                    setReferralUnitName(e.target.value);
                                                    setReferralFieldErrors(p => ({ ...p, unit: undefined }));
                                                }}
                                                disabled={lockUnitName}
                                                placeholder="例：國泰綜合醫院 社工室"
                                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500 ${referralFieldErrors.unit ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                            />
                                            {referralFieldErrors.unit && <p className="text-xs text-red-500 mt-0.5">{referralFieldErrors.unit}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                承辦人姓名 <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text" maxLength={50}
                                                value={referralContactName}
                                                onChange={e => {
                                                    setReferralContactName(e.target.value);
                                                    setReferralFieldErrors(p => ({ ...p, contactName: undefined }));
                                                }}
                                                placeholder="例：王小明"
                                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 ${referralFieldErrors.contactName ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                            />
                                            {referralFieldErrors.contactName && <p className="text-xs text-red-500 mt-0.5">{referralFieldErrors.contactName}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                承辦人職稱 <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text" maxLength={50}
                                                value={referralContactTitle}
                                                onChange={e => {
                                                    setReferralContactTitle(e.target.value);
                                                    setReferralFieldErrors(p => ({ ...p, title: undefined }));
                                                }}
                                                placeholder="例：社工師／個管師"
                                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 ${referralFieldErrors.title ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                            />
                                            {referralFieldErrors.title && <p className="text-xs text-red-500 mt-0.5">{referralFieldErrors.title}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                承辦人聯絡電話 <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text" maxLength={30}
                                                value={referralContactPhone}
                                                onChange={e => {
                                                    setReferralContactPhone(e.target.value);
                                                    setReferralFieldErrors(p => ({ ...p, phone: undefined }));
                                                }}
                                                placeholder="例：(03) 5278999 #1234"
                                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 ${referralFieldErrors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                            />
                                            {referralFieldErrors.phone && <p className="text-xs text-red-500 mt-0.5">{referralFieldErrors.phone}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
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
