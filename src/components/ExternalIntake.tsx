'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Upload, X, FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { ApplicationForm } from './ApplicationForm';
import { ApplicantFormValues } from '../schemas/applicant';
import { queryApplicantEligibility, submitExternalApplication } from '../app/actions/intakeActions';
import { twIdError } from '../lib/validateTwId';
import { fetchSetting } from '../app/actions/settingsActions';
import { fetchDocumentTypeConfigs } from '../app/actions/documentActions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'landing' | 'query' | 'checking' | 'ineligible' | 'form' | 'submitting' | 'success';

interface DocFile {
    docId: string;
    field: string;
    label: string;
    required: boolean;
    allowSupplement: boolean;
    file: File | null;
}

const DEFAULT_QUALIFICATION: ApplicantFormValues = {
    type: 'single',
    age: 0,
    hasChildren: false,
    underageChildrenCount: 0,
    adultChildrenCount: 0,
    annualIncome: 0,
    movableAssets: 0,
    realEstateValue: 0,
};

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ['查詢資格', '填寫資料', '提交申請'];

function StepIndicator({ current }: { current: number }) {
    return (
        <div className="flex items-center justify-center gap-0 mb-8">
            {STEP_LABELS.map((label, i) => (
                <div key={i} className="flex items-center">
                    <div className="flex flex-col items-center">
                        <div
                            className={clsx(
                                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                                i < current
                                    ? 'bg-green-500 text-white'
                                    : i === current
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-500'
                            )}
                        >
                            {i < current ? <CheckCircle className="w-5 h-5" /> : i + 1}
                        </div>
                        <span className={clsx('text-xs mt-1 whitespace-nowrap', i === current ? 'text-blue-600 font-semibold' : 'text-gray-400')}>
                            {label}
                        </span>
                    </div>
                    {i < STEP_LABELS.length - 1 && (
                        <div className={clsx('w-16 h-0.5 mx-1 mb-5', i < current ? 'bg-green-400' : 'bg-gray-200')} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Document Upload Row ──────────────────────────────────────────────────────

function DocUploadRow({ doc, onChange }: { doc: DocFile; onChange: (file: File | null) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
            <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-700">{doc.label}</span>
                {doc.required && !doc.allowSupplement && (
                    <span className="ml-1 text-red-500 text-xs" title="送出前必須上傳">*</span>
                )}
                {doc.required && doc.allowSupplement && (
                    <span className="ml-1.5 inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none" title="必填，可於送出後補件">
                        可補件
                    </span>
                )}
                {doc.file && (
                    <p className="text-xs text-green-600 mt-0.5 truncate">{doc.file.name}</p>
                )}
            </div>
            {doc.file ? (
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 shrink-0"
                >
                    <X className="w-3.5 h-3.5" />
                    移除
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded px-2 py-1 transition shrink-0"
                >
                    <Upload className="w-3.5 h-3.5" />
                    上傳
                </button>
            )}
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => onChange(e.target.files?.[0] ?? null)}
            />
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExternalIntake() {
    const [step, setStep] = useState<Step>('landing');
    const [email, setEmail] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [name, setName] = useState('');
    const [applyAmount, setApplyAmount] = useState<number | ''>('');
    const [applyAmountError, setApplyAmountError] = useState('');
    const [maxApplyAmount, setMaxApplyAmount] = useState<number>(350000);
    useEffect(() => {
        fetchSetting('max_apply_amount', '350000').then(v => setMaxApplyAmount(Number(v) || 350000));
    }, []);
    useEffect(() => {
        fetchDocumentTypeConfigs().then(configs => {
            const applyDocs = configs
                .filter(c => c.phase === 'apply' && c.is_active)
                .map(c => ({
                    docId: String(c.id),
                    field: `doc_${c.id}`,
                    label: c.label,
                    required: c.is_required,
                    allowSupplement: c.allow_supplement,
                    file: null as File | null,
                }));
            if (applyDocs.length > 0) setDocs(applyDocs);
        });
    }, []);
    const [ineligibleReason, setIneligibleReason] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [caseNumber, setCaseNumber] = useState('');
    const [applicationType, setApplicationType] = useState('');
    const [qualFormValid, setQualFormValid] = useState(false);
    const [qualFormValues, setQualFormValues] = useState<ApplicantFormValues>(DEFAULT_QUALIFICATION);
    const [docs, setDocs] = useState<DocFile[]>([]);
    const [quota, setQuota] = useState<{ cumulativeApproved: number; maxAmount: number; remaining: number } | null>(null);

    const handleQualValidation = useCallback((isValid: boolean, values: ApplicantFormValues) => {
        setQualFormValid(isValid);
        setQualFormValues(values);
    }, []);

    const updateDoc = (field: string, file: File | null) => {
        setDocs(prev => prev.map(d => d.field === field ? { ...d, file } : d));
    };

    // Only non-supplementable required docs block initial submission
    const requiredDocsMissing = docs.filter(d => d.required && !d.allowSupplement && !d.file);

    // ── Step: Landing ─────────────────────────────────────────────────────────
    if (step === 'landing') {
        const mustAttach   = docs.filter(d => d.required && !d.allowSupplement);
        const canSupp      = docs.filter(d => d.required && d.allowSupplement);
        const optional     = docs.filter(d => !d.required);

        return (
            <div className="max-w-2xl mx-auto text-center py-8 px-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-3">線上補助申請</h2>
                <p className="text-gray-500 mb-4 leading-relaxed">
                    歡迎使用萬美基金會線上補助申請系統。<br />
                    請準備好以下文件後再開始填寫：
                </p>

                {docs.length === 0 ? (
                    <div className="text-sm text-gray-400 mb-8">載入文件清單中…</div>
                ) : (
                    <div className="text-left inline-block mb-8 space-y-4 w-full max-w-md mx-auto">
                        {mustAttach.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1.5">送出前必須上傳</p>
                                <ul className="space-y-1">
                                    {mustAttach.map(d => (
                                        <li key={d.docId} className="flex items-center gap-2 text-sm text-gray-700">
                                            <CheckCircle className="w-4 h-4 text-red-400 shrink-0" />
                                            {d.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {canSupp.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1.5">可於送出後補件（建議事先準備）</p>
                                <ul className="space-y-1">
                                    {canSupp.map(d => (
                                        <li key={d.docId} className="flex items-center gap-2 text-sm text-gray-600">
                                            <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                            {d.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {optional.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">選填文件</p>
                                <ul className="space-y-1">
                                    {optional.map(d => (
                                        <li key={d.docId} className="flex items-center gap-2 text-sm text-gray-500">
                                            <CheckCircle className="w-4 h-4 text-gray-300 shrink-0" />
                                            {d.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-sm text-amber-700 text-left">
                    <strong>注意事項：</strong>每位申請人僅限申請一次（進行中案件），累計補助上限為 35 萬元。
                </div>
                <button
                    onClick={() => setStep('query')}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition shadow-sm"
                >
                    開始申請
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        );
    }

    // ── Step: Query ───────────────────────────────────────────────────────────
    if (step === 'query') {
        const handleQuery = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!email.trim()) return;
            const idErr = twIdError(idNumber.trim());
            if (idErr) { setErrorMsg(idErr); return; }
            setErrorMsg('');
            setStep('checking');

            const result = await queryApplicantEligibility(idNumber.trim().toUpperCase());

            if (result.error) {
                setErrorMsg(result.error);
                setStep('query');
            } else if (!result.eligible) {
                setIneligibleReason(result.reason ?? '不符合申請資格');
                setStep('ineligible');
            } else {
                setStep('form');
                // Use quota data already returned by eligibility check (avoids redundant DB call).
                // For first-time applicants result.remaining is undefined → show full max amount.
                if (result.remaining !== undefined && result.maxAmount !== undefined) {
                    setQuota({
                        cumulativeApproved: result.cumulativeApproved ?? 0,
                        maxAmount: result.maxAmount,
                        remaining: result.remaining,
                    });
                } else {
                    // First-time applicant: no prior history
                    fetchSetting('max_apply_amount', '350000').then(v => {
                        const max = Number(v) || 350000;
                        setQuota({ cumulativeApproved: 0, maxAmount: max, remaining: max });
                    });
                }
            }
        };

        return (
            <div className="max-w-md mx-auto py-6 px-4">
                <StepIndicator current={0} />
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">資格查詢</h3>
                    <p className="text-sm text-gray-500 mb-6">請輸入您的電子郵件及身分證字號以確認申請資格。</p>
                    <form onSubmit={handleQuery} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                placeholder="your@email.com"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">身分證字號</label>
                            <input
                                type="text"
                                value={idNumber}
                                onChange={e => setIdNumber(e.target.value.toUpperCase())}
                                required
                                placeholder="A123456789"
                                maxLength={10}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        {errorMsg && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{errorMsg}</div>
                        )}
                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition"
                        >
                            查詢資格
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── Step: Checking ────────────────────────────────────────────────────────
    if (step === 'checking') {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-500">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <span className="text-sm">正在確認申請資格…</span>
            </div>
        );
    }

    // ── Step: Ineligible ──────────────────────────────────────────────────────
    if (step === 'ineligible') {
        return (
            <div className="max-w-md mx-auto py-12 px-4 text-center">
                <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">不符合申請資格</h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">{ineligibleReason}</p>
                <button
                    onClick={() => setStep('landing')}
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg px-4 py-2 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回首頁
                </button>
            </div>
        );
    }

    // ── Step: Form ────────────────────────────────────────────────────────────
    if (step === 'form' || step === 'submitting') {
        const amountNum = applyAmount === '' ? 0 : Number(applyAmount);
        const effectiveMax = quota ? Math.min(quota.remaining, maxApplyAmount) : maxApplyAmount;
        const amountValid = amountNum > 0 && amountNum <= effectiveMax;
        const canSubmit =
            name.trim() !== '' &&
            applicationType !== '' &&
            qualFormValid &&
            amountValid &&
            requiredDocsMissing.length === 0;

        const handleSubmit = async () => {
            if (!canSubmit) return;
            // Validate amount before submit
            if (!amountValid) {
                setApplyAmountError(amountNum <= 0 ? '請輸入申請金額' : `申請金額不可超過 ${effectiveMax.toLocaleString()} 元`);
                return;
            }
            setErrorMsg('');
            setStep('submitting');

            const fd = new FormData();
            fd.append('name', name.trim());
            fd.append('idNumber', idNumber);
            fd.append('email', email);
            fd.append('apply_amount', String(amountNum));
            // Qualification fields
            fd.append('application_type', applicationType);
            fd.append('marital_status', qualFormValues.type === 'married' ? '2' : '1');
            fd.append('age', String(qualFormValues.age ?? 0));
            fd.append('annual_income', String(qualFormValues.annualIncome ?? 0));
            fd.append('moveable_property', String(qualFormValues.movableAssets ?? 0));
            fd.append('immoveable_property', String(qualFormValues.realEstateValue ?? 0));
            fd.append('has_children', String(qualFormValues.hasChildren ?? false));
            fd.append('underage_children_count', String(
                qualFormValues.hasChildren ? (qualFormValues.underageChildrenCount ?? 0) : 0
            ));
            fd.append('adult_children_count', String(
                qualFormValues.hasChildren ? (qualFormValues.adultChildrenCount ?? 0) : 0
            ));

            for (const doc of docs) {
                if (doc.file) fd.append(doc.field, doc.file);
            }

            const result = await submitExternalApplication(fd);

            if (result.success && result.caseNumber) {
                setCaseNumber(result.caseNumber);
                setStep('success');
            } else {
                setErrorMsg(result.error ?? '提交失敗，請稍後再試');
                setStep('form');
            }
        };

        return (
            <div className="max-w-2xl mx-auto py-6 px-4">
                <StepIndicator current={1} />
                <div className="space-y-6">
                    {/* Personal Info */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-base font-bold text-gray-800 mb-4">申請人基本資料</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    姓名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                    maxLength={50}
                                    placeholder="請輸入真實姓名"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">身分證字號</label>
                                <input
                                    type="text"
                                    value={idNumber}
                                    readOnly
                                    className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm font-mono text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件</label>
                                <input
                                    type="email"
                                    value={email}
                                    readOnly
                                    className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    申請類別 <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={applicationType}
                                    onChange={e => setApplicationType(e.target.value)}
                                    disabled={step === 'submitting'}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                                >
                                    <option value="">請選擇申請類別</option>
                                    <option value="A">A 類－自費醫療補助</option>
                                    <option value="B">B 類－臨終安寧自費醫療補助</option>
                                    <option value="C">C 類－預立醫療照護諮商補助</option>
                                    <option value="D">D 類－醫事人員進修補助</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Qualification Form */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-base font-bold text-gray-800 mb-4">資格預審資料</h3>
                        {/* Quota display */}
                        {quota && (
                            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm space-y-1">
                                <p className="text-slate-600">
                                    <span className="text-slate-500">累積已獲補助：</span>
                                    <span className="font-semibold text-slate-800">NT${quota.cumulativeApproved.toLocaleString()} 元</span>
                                </p>
                                <p className="text-slate-600">
                                    <span className="text-slate-500">尚可申請額度：</span>
                                    <span className={`font-semibold ${quota.remaining <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                        NT${quota.remaining.toLocaleString()} 元
                                    </span>
                                </p>
                            </div>
                        )}
                        {/* 申請金額 */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                申請金額 <span className="text-red-500">*</span>
                            </label>
                            <div className="relative max-w-xs">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={String(effectiveMax).length}
                                    value={applyAmount}
                                    onChange={e => {
                                        const raw = e.target.value.replace(/\D/g, '');
                                        const v = raw === '' ? '' : Number(raw);
                                        setApplyAmount(v as number | '');
                                        if (v !== '' && Number(v) > effectiveMax) {
                                            setApplyAmountError(`申請金額不可超過 ${effectiveMax.toLocaleString()} 元`);
                                        } else {
                                            setApplyAmountError('');
                                        }
                                    }}
                                    disabled={step === 'submitting'}
                                    placeholder={`上限 ${effectiveMax.toLocaleString()} 元`}
                                    className={clsx(
                                        'block w-full rounded-md shadow-sm p-2 border pr-8 text-sm',
                                        applyAmountError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                    )}
                                />
                                <span className="absolute right-3 top-2 text-gray-400 text-sm">元</span>
                            </div>
                            {applyAmountError && <p className="text-xs text-red-500 mt-1">{applyAmountError}</p>}
                        </div>
                        <ApplicationForm
                            initialValues={DEFAULT_QUALIFICATION}
                            onValidation={handleQualValidation}
                            readOnly={step === 'submitting'}
                        />
                    </div>

                    {/* Document Upload */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-base font-bold text-gray-800 mb-1">文件上傳</h3>
                        <p className="text-xs text-gray-400 mb-4">
                            接受 PDF、Word、圖片格式（.pdf .doc .docx .jpg .jpeg .png）。
                            標記 <span className="text-red-500 font-bold">*</span> 為送出前必須上傳；標記
                            <span className="mx-1 inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none">可補件</span>
                            者可於送出後補交。
                        </p>
                        <div>
                            {docs.map(doc => (
                                <DocUploadRow
                                    key={doc.field}
                                    doc={doc}
                                    onChange={file => updateDoc(doc.field, file)}
                                />
                            ))}
                        </div>
                        {requiredDocsMissing.length > 0 && (
                            <p className="text-xs text-red-500 mt-2">
                                送出前必須上傳：{requiredDocsMissing.map(d => d.label).join('、')}
                            </p>
                        )}
                        {docs.some(d => d.required && d.allowSupplement && !d.file) && (
                            <p className="text-xs text-amber-600 mt-1.5">
                                標示「可補件」的文件可於送出後補交，建議盡早提供以利審核。
                            </p>
                        )}
                    </div>

                    {errorMsg && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{errorMsg}</div>
                    )}

                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setStep('query')}
                            disabled={step === 'submitting'}
                            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            返回
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSubmit || step === 'submitting'}
                            className={clsx(
                                'inline-flex items-center gap-2 font-semibold px-6 py-2.5 rounded-lg transition shadow-sm text-sm',
                                canSubmit && step !== 'submitting'
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            )}
                        >
                            {step === 'submitting' ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    提交中…
                                </>
                            ) : (
                                <>
                                    送出申請
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Step: Success ─────────────────────────────────────────────────────────
    return (
        <div className="max-w-md mx-auto py-12 px-4 text-center">
            <StepIndicator current={2} />
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-5" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">申請已成功送出！</h3>
            <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                您的申請案件已建立，案件編號如下。
                <br />承辦人員將盡快與您聯繫，請留意相關通知。
            </p>
            <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg px-6 py-3 mb-8">
                <p className="text-xs text-blue-400 mb-0.5">案件編號</p>
                <p className="text-2xl font-mono font-bold text-blue-700">{caseNumber}</p>
            </div>
            <div className="text-xs text-gray-400">
                請記錄此案件編號，如有需要請聯繫萬美基金會承辦人員。
            </div>
        </div>
    );
}
