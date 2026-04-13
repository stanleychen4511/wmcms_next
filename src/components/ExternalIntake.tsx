'use client';

import { useState, useRef, useCallback } from 'react';
import { CheckCircle, XCircle, Loader2, Upload, X, FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { ApplicationForm } from './ApplicationForm';
import { ApplicantFormValues } from '../schemas/applicant';
import { queryApplicantEligibility, submitExternalApplication } from '../app/actions/intakeActions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'landing' | 'query' | 'checking' | 'ineligible' | 'form' | 'submitting' | 'success';

interface DocFile {
    docId: string;
    field: string;
    label: string;
    required: boolean;
    file: File | null;
}

const DEFAULT_QUALIFICATION: ApplicantFormValues = {
    type: 'single',
    age: 0,
    hasMinorChildren: false,
    underageChildrenCount: 0,
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
                {doc.required && <span className="ml-1 text-red-500 text-xs">*</span>}
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
                accept=".pdf,.doc,.docx"
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
    const [ineligibleReason, setIneligibleReason] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [caseNumber, setCaseNumber] = useState('');
    const [applicationType, setApplicationType] = useState('');
    const [qualFormValid, setQualFormValid] = useState(false);
    const [qualFormValues, setQualFormValues] = useState<ApplicantFormValues>(DEFAULT_QUALIFICATION);
    const [docs, setDocs] = useState<DocFile[]>([
        { docId: '1', field: 'doc_1', label: '自費醫療補助申請表', required: true, file: null },
        { docId: '3', field: 'doc_3', label: '身分證正反面影本', required: true, file: null },
        { docId: '4', field: 'doc_4', label: '個資同意書', required: true, file: null },
    ]);

    const handleQualValidation = useCallback((isValid: boolean, values: ApplicantFormValues) => {
        setQualFormValid(isValid);
        setQualFormValues(values);
    }, []);

    const updateDoc = (field: string, file: File | null) => {
        setDocs(prev => prev.map(d => d.field === field ? { ...d, file } : d));
    };

    const requiredDocsMissing = docs.filter(d => d.required && !d.file);

    // ── Step: Landing ─────────────────────────────────────────────────────────
    if (step === 'landing') {
        return (
            <div className="max-w-2xl mx-auto text-center py-8 px-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-3">線上補助申請</h2>
                <p className="text-gray-500 mb-2 leading-relaxed">
                    歡迎使用萬美基金會線上補助申請系統。<br />
                    請準備好以下文件後再開始填寫：
                </p>
                <ul className="text-sm text-gray-600 text-left inline-block mb-8 space-y-1">
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> 自費醫療補助申請表</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> 身分證正反面影本（掃描或拍照）</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> 個資同意書</li>
                </ul>
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
            if (!email.trim() || !idNumber.trim()) return;
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
        const canSubmit =
            name.trim() !== '' &&
            applicationType !== '' &&
            qualFormValid &&
            requiredDocsMissing.length === 0;

        const handleSubmit = async () => {
            if (!canSubmit) return;
            setErrorMsg('');
            setStep('submitting');

            const fd = new FormData();
            fd.append('name', name.trim());
            fd.append('idNumber', idNumber);
            fd.append('email', email);
            // Qualification fields
            fd.append('application_type', applicationType);
            fd.append('marital_status', qualFormValues.type === 'married' ? '2' : '1');
            fd.append('age', String(qualFormValues.age ?? 0));
            fd.append('annual_income', String(qualFormValues.annualIncome ?? 0));
            fd.append('moveable_property', String(qualFormValues.movableAssets ?? 0));
            fd.append('immoveable_property', String(qualFormValues.realEstateValue ?? 0));
            fd.append('has_children', String(qualFormValues.hasMinorChildren ?? false));
            fd.append('underage_children_count', String(
                qualFormValues.hasMinorChildren ? (qualFormValues.underageChildrenCount ?? 0) : 0
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
                        <ApplicationForm
                            initialValues={DEFAULT_QUALIFICATION}
                            onValidation={handleQualValidation}
                            readOnly={step === 'submitting'}
                        />
                    </div>

                    {/* Document Upload */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-base font-bold text-gray-800 mb-1">文件上傳</h3>
                        <p className="text-xs text-gray-400 mb-4">接受 PDF、Word 格式（.pdf、.doc、.docx）。標記 <span className="text-red-500">*</span> 為必傳文件。</p>
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
                                尚未上傳：{requiredDocsMissing.map(d => d.label).join('、')}
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
