'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    CheckCircle, CheckCircle2, XCircle, Loader2, Upload, X, FileText, ChevronRight, ArrowLeft,
    AlertTriangle, ShieldQuestion, Lock, Info,
} from 'lucide-react';
import { clsx } from 'clsx';
import { ApplicationForm } from './ApplicationForm';
import { fetchEligibilityRules } from '../app/actions/eligibilityRulesActions';
import { fetchSetting } from '../app/actions/settingsActions';
import { checkEligibility, type ApplicantData } from '../utils/eligibility';
import { ApplicantFormValues } from '../schemas/applicant';
import { fetchApplicantQuota, queryApplicantEligibility, submitExternalApplication, type ApplicantQuota } from '../app/actions/intakeActions';
import { twIdError } from '../lib/validateTwId';
import { fetchDocumentTypeConfigs, type DocumentTypeConfig } from '../app/actions/documentActions';
import { uploadFileToBlob } from '../lib/uploadClient';
import { EmailVerificationControl } from './EmailVerificationControl';
import { DateInput } from './DateInput';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'landing' | 'query' | 'checking' | 'ineligible' | 'form' | 'submitting' | 'success';

interface DocFile {
    docId: string;
    field: string;
    label: string;
    required: boolean;
    allowSupplement: boolean;
    file: File | null;
    files: UploadedDocFile[];
    /** 上傳狀態 — 客戶端直接 PUT 到 Vercel Blob（避開 4.5 MB function 上限） */
    uploadStatus: 'idle' | 'uploading' | 'done' | 'error';
    uploadProgress: number;        // 0–100
    url?: string;                  // 上傳完成後的 Blob URL
    mimeType?: string;
    size?: number;
    errorMsg?: string;
    tooltipText?: string | null;
}

interface UploadedDocFile {
    file: File;
    uploadStatus: 'uploading' | 'done' | 'error';
    uploadProgress: number;
    url?: string;
    mimeType?: string;
    size?: number;
    errorMsg?: string;
}

const PAPER_REQUIREMENT_LABEL: Record<NonNullable<DocumentTypeConfig['paper_requirement']>, string> = {
    original: '正本',
    copy: '影本',
    original_or_copy: '正本或影本',
    none: '不須紙本',
};

function formatDocumentConfigLabel(doc: DocumentTypeConfig) {
    const label = PAPER_REQUIREMENT_LABEL[doc.paper_requirement ?? 'original'];
    return label ? `${doc.label}（${label}）` : doc.label;
}

const DEFAULT_QUALIFICATION: ApplicantFormValues = {
    subsidyType: undefined,
    type: '3',  // 預設單身（115 編碼）
    age: 0,
    hasChildren: false,
    underageChildrenCount: 0,
    adultChildrenCount: 0,
    annualIncome: 0,
    movableAssets: 0,
    realEstateValue: 0,
    econDeposit: undefined,
    econMonthlyIncome: undefined,
};

function calculateAgeFromDob(value: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const dob = new Date(`${value}T00:00:00`);
    if (Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDelta = today.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : null;
}

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

function DocUploadRow({ doc, onChange }: { doc: DocFile; onChange: (files: File[] | null) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const isUploading = doc.uploadStatus === 'uploading';
    const isError = doc.uploadStatus === 'error';
    const hasFiles = doc.files.length > 0;

    return (
        <div className="py-2.5 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-700">
                        {doc.label}
                        {doc.tooltipText && (
                            <span className="ml-1 inline-flex align-middle text-slate-400" title={doc.tooltipText}>
                                <Info className="w-3.5 h-3.5" />
                            </span>
                        )}
                    </span>
                    {doc.required && !doc.allowSupplement && (
                        <span className="ml-1 text-red-500 text-xs" title="送出前必須上傳">*</span>
                    )}
                    {doc.required && doc.allowSupplement && (
                        <span className="ml-1.5 inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none" title="必填，可於送出後補件">
                            可補件
                        </span>
                    )}
                    {hasFiles && (
                        <div className="mt-1 space-y-0.5">
                            {doc.files.map((item, index) => (
                                <p
                                    key={`${item.file.name}-${index}`}
                                    className={clsx(
                                        'text-xs truncate',
                                        item.uploadStatus === 'done' ? 'text-green-600' :
                                        item.uploadStatus === 'error' ? 'text-red-600' :
                                        'text-gray-500'
                                    )}
                                >
                                    {item.file.name}
                                    {item.uploadStatus === 'done' && '（已就緒 ✓）'}
                                    {item.uploadStatus === 'uploading' && `（上傳中 ${item.uploadProgress}%）`}
                                    {item.uploadStatus === 'error' && `（${item.errorMsg ?? '上傳失敗'}）`}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
                {hasFiles ? (
                    <div className="flex items-center gap-2 shrink-0">
                        {isError && (
                            <button
                                type="button"
                                onClick={() => onChange(doc.files.filter(item => item.uploadStatus === 'error').map(item => item.file))}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                title="重新上傳"
                            >
                                <Upload className="w-3.5 h-3.5" />重試
                            </button>
                        )}
                        {!isUploading && (
                            <button
                                type="button"
                                onClick={() => onChange(null)}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                            >
                                <X className="w-3.5 h-3.5" />
                                移除
                            </button>
                        )}
                        {isUploading && (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        )}
                    </div>
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
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={e => {
                        onChange(e.target.files ? Array.from(e.target.files) : null);
                        e.currentTarget.value = '';
                    }}
                />
            </div>
            {isUploading && (
                <div className="mt-1 h-1 bg-slate-100 rounded overflow-hidden">
                    <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${doc.uploadProgress}%` }}
                    />
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExternalIntake() {
    const [step, setStep] = useState<Step>('landing');
    const [email, setEmail] = useState('');
    const [emailVerificationToken, setEmailVerificationToken] = useState('');
    const [applicantPhone, setApplicantPhone] = useState('');
    const [applicantPhoneError, setApplicantPhoneError] = useState('');
    const [applicantDob, setApplicantDob] = useState('');
    const [applicantDobError, setApplicantDobError] = useState('');
    const [cancerType, setCancerType] = useState('');
    const [cancerTypeError, setCancerTypeError] = useState('');
    const [cancerStage, setCancerStage] = useState('');
    const [cancerStageError, setCancerStageError] = useState('');
    const [treatmentPhase, setTreatmentPhase] = useState<'B' | 'A' | 'X' | ''>('');
    const [treatmentPhaseError, setTreatmentPhaseError] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [name, setName] = useState('');
    const [applyAmount, setApplyAmount] = useState<number | ''>('');
    const [applyAmountError, setApplyAmountError] = useState('');
    /** 各子類型補助上限（依 115 辦法）；未選子類型時 UI 顯示用兩者較大值 */
    const [subtypeMaxAmounts, setSubtypeMaxAmounts] = useState<Record<'1' | '2', number>>({ '1': 30000, '2': 350000 });
    useEffect(() => {
        import('../app/actions/eligibilityRulesActions')
            .then(m => m.fetchSubsidyAmountLimitsMap())
            .then(setSubtypeMaxAmounts)
            .catch(err => console.error('fetchSubsidyAmountLimitsMap error:', err));
    }, []);
    const [ineligibleReason, setIneligibleReason] = useState('');
    const [activeApplicationStatus, setActiveApplicationStatus] = useState<{ caseNumber: string; progress: string } | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [caseNumber, setCaseNumber] = useState('');
    const [applicationType, setApplicationType] = useState('A');
    // 轉介模式 + 轉介窗口（user feedback #1 + #6）
    // 經濟弱勢 → 強制 way='2' 轉介；小康 → 預設 '1' 自提，可改 '2' 轉介
    const [applicationWay, setApplicationWay] = useState<'1' | '2'>('1');
    const [referralUnitName, setReferralUnitName] = useState('');
    const [referralContactName, setReferralContactName] = useState('');
    const [referralContactTitle, setReferralContactTitle] = useState('');
    const [referralContactPhone, setReferralContactPhone] = useState('');
    const [referralContactEmail, setReferralContactEmail] = useState('');
    const [referralEmailVerificationToken, setReferralEmailVerificationToken] = useState('');
    const [referralErrors, setReferralErrors] = useState<{ unit?: string; name?: string; title?: string; phone?: string; email?: string }>({});
    const [qualFormValid, setQualFormValid] = useState(false);
    const [qualFormValues, setQualFormValues] = useState<ApplicantFormValues>(DEFAULT_QUALIFICATION);
    const [documentConfigs, setDocumentConfigs] = useState<DocumentTypeConfig[]>([]);
    const [docs, setDocs] = useState<DocFile[]>([]);
    const [quota, setQuota] = useState<ApplicantQuota | null>(null);

    useEffect(() => {
        fetchDocumentTypeConfigs()
            .then(setDocumentConfigs)
            .catch(err => console.error('fetchDocumentTypeConfigs error:', err));
    }, []);

    useEffect(() => {
        const selectedSubtype = qualFormValues.subsidyType;
        const applyDocs: DocFile[] = documentConfigs
            .filter(c => (
                c.phase === 'apply'
                && c.is_active
                && (!c.subsidy_subtype || c.subsidy_subtype === selectedSubtype)
            ))
            .map(c => ({
                docId: String(c.id),
                field: `doc_${c.id}`,
                label: formatDocumentConfigLabel(c),
                required: c.is_required,
                allowSupplement: c.allow_supplement,
                file: null,
                files: [],
                uploadStatus: 'idle',
                uploadProgress: 0,
                tooltipText: c.tooltip_text,
            }));
        setDocs(applyDocs);
    }, [documentConfigs, qualFormValues.subsidyType]);

    /** 資格判定狀態：null = 尚未執行；checked + eligible 兩段式 */
    const [eligibilityCheck, setEligibilityCheck] =
        useState<{ checked: boolean; eligible: boolean; reasons: string[] } | null>(null);
    const [eligibilityChecking, setEligibilityChecking] = useState(false);

    /** 後台設定的萬美聯絡方式（LINE 官方帳號 + 電話 + QR code） */
    const [orgContact, setOrgContact] = useState<{ lineId: string; phone: string; qrUrl: string }>({ lineId: '', phone: '', qrUrl: '' });
    useEffect(() => {
        Promise.all([
            fetchSetting('line_official_account_id', ''),
            fetchSetting('org_phone', ''),
            fetchSetting('org_line_qr_url', ''),
        ]).then(([lineId, phone, qrUrl]) => setOrgContact({ lineId, phone, qrUrl }));
    }, []);

    /** 動態計算當前 form 適用的最大值：選了子類型就用該值，否則取較大者 */
    const maxApplyAmount = (() => {
        const st = qualFormValues?.subsidyType;
        if (st === '1' || st === '2') return subtypeMaxAmounts[st];
        return Math.max(subtypeMaxAmounts['1'], subtypeMaxAmounts['2']);
    })();

    const currentQuota = (() => {
        if (!quota) return null;
        const st = qualFormValues?.subsidyType;
        if (st === '1') {
            return {
                cumulativeApproved: quota.econUsed,
                maxAmount: quota.econMax,
                remaining: quota.econRemaining,
            };
        }
        if (st === '2') {
            return {
                cumulativeApproved: quota.midUsed,
                maxAmount: quota.midMax,
                remaining: quota.midRemaining,
            };
        }
        return {
            cumulativeApproved: quota.cumulativeApproved,
            maxAmount: quota.maxAmount,
            remaining: quota.remaining,
        };
    })();

    const effectiveMax = currentQuota ? Math.min(currentQuota.remaining, maxApplyAmount) : maxApplyAmount;

    useEffect(() => {
        if (applyAmount === '') {
            setApplyAmountError('');
            return;
        }
        const amount = Number(applyAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setApplyAmountError('請輸入申請金額');
            return;
        }
        if (amount > effectiveMax) {
            setApplyAmountError(`申請金額不可超過 ${effectiveMax.toLocaleString()} 元`);
            return;
        }
        setApplyAmountError('');
    }, [applyAmount, effectiveMax]);

    const handleQualValidation = useCallback((isValid: boolean, values: ApplicantFormValues) => {
        setQualFormValid(isValid);
        setQualFormValues(values);
        // 表單一變動就作廢先前的資格判定，強制使用者重新執行
        setEligibilityCheck(null);
    }, []);

    /** 執行資格判定 — 抓 DB 規則 snapshot + 呼叫 checkEligibility */
    const handleRunEligibilityCheck = useCallback(async () => {
        if (eligibilityChecking) return;
        if (!qualFormValues.subsidyType) {
            setEligibilityCheck({ checked: true, eligible: false, reasons: ['請先選擇補助子類型（經濟弱勢／小康家庭）'] });
            return;
        }
        setEligibilityChecking(true);
        try {
            const rules = await fetchEligibilityRules();
            const f = qualFormValues;
            const maritalStatus = (f.type === '1' || f.type === '2' || f.type === '3') ? f.type : '3';
            const hasUnderage = Number(f.underageChildrenCount ?? 0) > 0;
            const childrenStatus = !f.hasChildren ? '3' : hasUnderage ? '1' : '2';
            const data: ApplicantData = {
                subsidyType: f.subsidyType as '1' | '2',  // 上方已守門 subtype 存在
                age: Number(f.age ?? 0),
                realEstateValue: Number(f.realEstateValue ?? 0),
                maritalStatus,
                childrenStatus,
                annualIncome:  Number(f.annualIncome ?? 0),
                movableAssets: Number(f.movableAssets ?? 0),
                deposit:       f.econDeposit       != null ? Number(f.econDeposit)       : undefined,
                monthlyIncome: f.econMonthlyIncome != null ? Number(f.econMonthlyIncome) : undefined,
            };
            const result = checkEligibility(data, rules);
            setEligibilityCheck({ checked: true, eligible: result.isEligible, reasons: result.reasons });
        } catch (e) {
            setEligibilityCheck({
                checked: true,
                eligible: false,
                reasons: [e instanceof Error ? e.message : '資格判定失敗，請稍後重試'],
            });
        } finally {
            setEligibilityChecking(false);
        }
    }, [qualFormValues, eligibilityChecking]);

    /** 選檔（或重試）→ 立刻在背景上傳到 Vercel Blob，UI 顯示進度 */
    const updateDoc = async (field: string, files: File[] | null) => {
        // 移除檔案
        if (!files || files.length === 0) {
            setDocs(prev => prev.map(d => d.field === field ? {
                ...d, file: null, files: [], uploadStatus: 'idle', uploadProgress: 0,
                url: undefined, mimeType: undefined, size: undefined, errorMsg: undefined,
            } : d));
            return;
        }

        // 進入上傳中狀態
        const uploadItems: UploadedDocFile[] = files.map(file => ({
            file,
            uploadStatus: 'uploading',
            uploadProgress: 0,
        }));
        setDocs(prev => prev.map(d => d.field === field ? {
            ...d, file: files[0], files: uploadItems, uploadStatus: 'uploading', uploadProgress: 0,
            url: undefined, errorMsg: undefined,
        } : d));

        const safeId = (idNumber || 'anonymous').replace(/[^A-Z0-9]/gi, '');

        for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            try {
                const uploaded = await uploadFileToBlob(file, {
                    pathPrefix: `intake/${safeId}`,
                    onProgress: (pct) => {
                        setDocs(prev => prev.map(d => {
                            if (d.field !== field) return d;
                            const nextFiles = d.files.map((item, itemIndex) => (
                                itemIndex === index ? { ...item, uploadProgress: pct } : item
                            ));
                            const avgProgress = Math.round(nextFiles.reduce((sum, item) => sum + item.uploadProgress, 0) / nextFiles.length);
                            return { ...d, files: nextFiles, uploadProgress: avgProgress };
                        }));
                    },
                });
                setDocs(prev => prev.map(d => {
                    if (d.field !== field) return d;
                    const nextFiles = d.files.map((item, itemIndex) => (
                        itemIndex === index
                            ? {
                                ...item,
                                uploadStatus: 'done' as const,
                                uploadProgress: 100,
                                url: uploaded.url,
                                mimeType: uploaded.mimeType,
                                size: uploaded.size,
                            }
                            : item
                    ));
                    const hasUploading = nextFiles.some(item => item.uploadStatus === 'uploading');
                    const hasError = nextFiles.some(item => item.uploadStatus === 'error');
                    const firstDone = nextFiles.find(item => item.uploadStatus === 'done');
                    return {
                        ...d,
                        files: nextFiles,
                        uploadStatus: hasUploading ? 'uploading' : hasError ? 'error' : 'done',
                        uploadProgress: hasUploading ? d.uploadProgress : 100,
                        file: firstDone?.file ?? nextFiles[0]?.file ?? null,
                        url: firstDone?.url,
                        mimeType: firstDone?.mimeType,
                        size: firstDone?.size,
                        errorMsg: hasError ? '部分檔案上傳失敗，請重試' : undefined,
                    };
                }));
            } catch (err: unknown) {
                console.error('blob upload failed for', field, err);
                setDocs(prev => prev.map(d => {
                    if (d.field !== field) return d;
                    const message = err instanceof Error ? err.message : '上傳失敗，請重試';
                    const nextFiles = d.files.map((item, itemIndex) => (
                        itemIndex === index
                            ? { ...item, uploadStatus: 'error' as const, errorMsg: message }
                            : item
                    ));
                    const hasUploading = nextFiles.some(item => item.uploadStatus === 'uploading');
                    return {
                        ...d,
                        files: nextFiles,
                        uploadStatus: hasUploading ? 'uploading' : 'error',
                        errorMsg: message,
                    };
                }));
            }
        }
    };

    // 必填且不可補件的文件，需要「已成功上傳」才算有
    const requiredDocsMissing = docs.filter(d =>
        d.required && !d.allowSupplement && !d.files.some(file => file.uploadStatus === 'done')
    );
    /** 還有檔案上傳中或上傳失敗 → 暫時不允許送出 */
    const hasInflightUploads = docs.some(d => d.files.some(file => file.uploadStatus === 'uploading'));
    const hasFailedUploads = docs.some(d => d.files.some(file => file.uploadStatus === 'error'));

    // ── Step: Landing ─────────────────────────────────────────────────────────
    if (step === 'landing') {
        const econMax = subtypeMaxAmounts['1'] ?? 30000;
        const midMax  = subtypeMaxAmounts['2'] ?? 350000;
        const formatDocList = (
            subtype: '1' | '2',
            predicate: (doc: DocumentTypeConfig) => boolean,
        ) => {
            const labels = documentConfigs
                .filter(doc => (
                    doc.phase === 'apply'
                    && doc.is_active
                    && (!doc.subsidy_subtype || doc.subsidy_subtype === subtype)
                    && predicate(doc)
                ))
                .map(formatDocumentConfigLabel);
            return labels.length > 0 ? labels.join(' / ') : '無';
        };
        const startApplication = (subtype: '1' | '2') => {
            setQualFormValues(prev => ({ ...prev, subsidyType: subtype }));
            setStep('query');
        };
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">線上補助申請</h2>
                    <p className="text-gray-500">萬美基金會自費醫療補助案 — 請點選您欲申請的類別開始填寫。</p>
                </div>

                {/* #1：兩種補助案說明卡（直接點擊進入申請流程） */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {/* 經濟弱勢 */}
                    <button
                        type="button"
                        onClick={() => startApplication('1')}
                        className="text-left border-2 border-rose-200 bg-rose-50/50 rounded-xl p-5 space-y-3 transition-all duration-150 hover:border-rose-400 hover:bg-rose-50 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-rose-700">經濟弱勢</h3>
                            <span className="text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">僅接受轉介</span>
                        </div>
                        <p className="text-2xl font-bold text-rose-700">NT${econMax.toLocaleString()}<span className="text-xs font-normal text-rose-500 ml-1">／人累計上限</span></p>
                        <div className="text-xs text-slate-600 space-y-1">
                            <p>‧ 申請人為癌症且持有重大傷病卡之 25–65 歲本國人</p>
                            <p>‧ 存款（配偶取平均）≤ 16 萬</p>
                            <p>‧ 月收入（配偶取平均）≤ 3 萬</p>
                            {/* 不動產：經濟弱勢不限制（user feedback #1） */}
                        </div>
                        <div className="border-t border-rose-200 pt-2">
                            <p className="text-[11px] font-semibold text-rose-600 mb-1">送出前必備文件</p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                {formatDocList('1', doc => doc.is_required && !doc.allow_supplement)}
                            </p>
                            <p className="text-[11px] font-semibold text-amber-600 mt-2 mb-1">可送出後補件</p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                {formatDocList('1', doc => doc.is_required && doc.allow_supplement)}
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-1 pt-2 text-xs font-semibold text-rose-600 group-hover:text-rose-700">
                            <span>點此申請經濟弱勢補助</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                    </button>

                    {/* 小康家庭 */}
                    <button
                        type="button"
                        onClick={() => startApplication('2')}
                        className="text-left border-2 border-blue-200 bg-blue-50/50 rounded-xl p-5 space-y-3 transition-all duration-150 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-blue-700">小康家庭</h3>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">自提或轉介</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">NT${midMax.toLocaleString()}<span className="text-xs font-normal text-blue-500 ml-1">／人累計上限</span></p>
                        <div className="text-xs text-slate-600 space-y-1">
                            <p>‧ 申請人為癌症且持有重大傷病卡之 25–65 歲本國人</p>
                            <p>‧ 收入與動產上限依「婚姻 × 子女」矩陣判定</p>
                            <p>‧ 不動產上限（戶籍內直系合計）≤ 2,500 萬</p>
                            <p>‧ 詳細門檻請參 115 年辦法第四條</p>
                        </div>
                        <div className="border-t border-blue-200 pt-2">
                            <p className="text-[11px] font-semibold text-blue-600 mb-1">送出前必備文件</p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                {formatDocList('2', doc => doc.is_required && !doc.allow_supplement)}
                            </p>
                            <p className="text-[11px] font-semibold text-amber-600 mt-2 mb-1">可送出後補件</p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                {formatDocList('2', doc => doc.is_required && doc.allow_supplement)}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500 mt-2 mb-1">選填</p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                {formatDocList('2', doc => !doc.is_required)}
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-1 pt-2 text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                            <span>點此申請小康家庭補助</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                    </button>
                </div>

                <div className="mb-6 text-center">
                    <a
                        href="https://wan-mei.org/service/#self-paid-medical-subsidy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                    >
                        <FileText className="w-4 h-4" />
                        申請文件下載處
                    </a>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-800">
                    <strong>注意事項：</strong>每位申請人「同時間僅可有一個進行中案件」；累計補助上限依您選擇的子類型而定（如上）。
                </div>

            </div>
        );
    }

    // ── Step: Query ───────────────────────────────────────────────────────────
    if (step === 'query') {
        const handleQuery = async (e: React.FormEvent) => {
            e.preventDefault();
            const idErr = twIdError(idNumber.trim());
            if (idErr) { setErrorMsg(idErr); return; }
            setErrorMsg('');
            setStep('checking');

            const selectedSubtype =
                qualFormValues.subsidyType === '1' || qualFormValues.subsidyType === '2'
                    ? qualFormValues.subsidyType
                    : undefined;
            const result = await queryApplicantEligibility(idNumber.trim().toUpperCase(), selectedSubtype);

            if (result.error) {
                setErrorMsg(result.error);
                setStep('query');
            } else if (!result.eligible) {
                setIneligibleReason(result.reason ?? '不符合申請資格');
                setActiveApplicationStatus(result.activeApplication ?? null);
                setStep('ineligible');
            } else {
                setActiveApplicationStatus(null);
                setStep('form');
                const latestQuota = await fetchApplicantQuota(idNumber.trim().toUpperCase());
                setQuota(latestQuota);
            }
        };

        return (
            <div className="max-w-md mx-auto py-6 px-4">
                <StepIndicator current={0} />
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">資格查詢</h3>
                    <p className="text-sm text-gray-500 mb-6">請輸入您的身分證字號以確認申請資格。</p>
                    <form onSubmit={handleQuery} className="space-y-4">
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
        const ineligibleTitle = activeApplicationStatus
            ? '您已正在申請中'
            : /額度|上限/.test(ineligibleReason)
                ? '您申請額度已滿'
                : '目前無法送出申請';
        return (
            <div className="max-w-md mx-auto py-12 px-4 text-center">
                <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">{ineligibleTitle}</h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">{ineligibleReason}</p>
                {activeApplicationStatus && (
                    <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-left">
                        <p className="text-xs font-semibold text-blue-600 mb-2">目前申請進度</p>
                        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                            <span className="text-blue-700/70">案件編號</span>
                            <span className="font-mono font-bold text-blue-900 break-all">{activeApplicationStatus.caseNumber || '—'}</span>
                            <span className="text-blue-700/70">目前狀態</span>
                            <span className="font-semibold text-blue-900">{activeApplicationStatus.progress}</span>
                        </div>
                    </div>
                )}
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
        const amountValid = amountNum > 0 && amountNum <= effectiveMax;
        const eligibilityPassed = !!(eligibilityCheck?.checked && eligibilityCheck?.eligible);
        const canUpload = eligibilityPassed;
        const canSubmit =
            name.trim() !== '' &&
            applicationType !== '' &&
            qualFormValid &&
            amountValid &&
            eligibilityPassed &&
            requiredDocsMissing.length === 0 &&
            !hasInflightUploads &&
            !hasFailedUploads;

        const handleSubmit = async () => {
            if (!canSubmit) return;
            // Validate amount before submit
            if (!amountValid) {
                setApplyAmountError(amountNum <= 0 ? '請輸入申請金額' : `申請金額不可超過 ${effectiveMax.toLocaleString()} 元`);
                return;
            }
            // 申請人電話 / 出生年月日 / 癌別 / 期數 必填
            let formOk = true;
            const trimmedEmail = email.trim();
            if (!trimmedEmail) {
                setErrorMsg('請填寫申請人 Email');
                formOk = false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
                setErrorMsg('請填寫有效的申請人 Email 地址');
                formOk = false;
            } else {
                setErrorMsg('');
            }
            if (!emailVerificationToken) {
                setErrorMsg('請先完成申請人 Email 驗證');
                formOk = false;
            }
            if (!applicantPhone.trim()) { setApplicantPhoneError('請填寫聯絡電話'); formOk = false; } else setApplicantPhoneError('');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(applicantDob.trim())) { setApplicantDobError('請選擇出生年月日'); formOk = false; } else setApplicantDobError('');
            if (!cancerType.trim()) { setCancerTypeError('請填寫癌別'); formOk = false; } else setCancerTypeError('');
            if (!cancerStage.trim()) { setCancerStageError('請填寫癌症期數'); formOk = false; } else setCancerStageError('');
            if (treatmentPhase !== 'B' && treatmentPhase !== 'A' && treatmentPhase !== 'X') {
                setTreatmentPhaseError('請選擇治療階段'); formOk = false;
            } else setTreatmentPhaseError('');

            // 轉介窗口驗證：經濟弱勢強制轉介，小康看 applicationWay
            const isTransferRequired = qualFormValues.subsidyType === '1' || applicationWay === '2';
            if (isTransferRequired) {
                const refErrs: typeof referralErrors = {};
                if (!referralUnitName.trim())     refErrs.unit  = '請填寫轉介單位';
                if (!referralContactName.trim())  refErrs.name  = '請填寫轉介人姓名';
                if (!referralContactTitle.trim()) refErrs.title = '請填寫轉介人職稱';
                if (!referralContactPhone.trim()) refErrs.phone = '請填寫轉介人聯絡電話';
                if (!referralContactEmail.trim()) {
                    refErrs.email = '請填寫轉介人 Email';
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referralContactEmail.trim())) {
                    refErrs.email = '請填寫有效的轉介人 Email 地址';
                } else if (!referralEmailVerificationToken) {
                    refErrs.email = '請先完成轉介人 Email 驗證';
                }
                setReferralErrors(refErrs);
                if (Object.keys(refErrs).length > 0) formOk = false;
            } else {
                setReferralErrors({});
            }
            if (!formOk) return;
            setErrorMsg('');
            setStep('submitting');

            const fd = new FormData();
            fd.append('name', name.trim());
            fd.append('idNumber', idNumber);
            fd.append('email', email);
            fd.append('email_verification_token', emailVerificationToken);
            fd.append('applicant_phone', applicantPhone.trim());
            fd.append('applicant_dob', applicantDob.trim());
            fd.append('cancer_type', cancerType.trim());
            fd.append('cancer_stage', cancerStage.trim());
            fd.append('treatment_phase', treatmentPhase);
            fd.append('apply_amount', String(amountNum));
            // Qualification fields
            fd.append('application_type', applicationType);
            // 婚姻狀態：form.type 已是 '1'/'2'/'3'（115 編碼）
            fd.append('marital_status', qualFormValues.type ?? '3');
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
            // 補助子類型 + 經濟弱勢專屬欄位
            if (qualFormValues.subsidyType) {
                fd.append('subsidy_subtype', qualFormValues.subsidyType);
            }
            if (qualFormValues.econDeposit != null) {
                fd.append('econ_deposit', String(qualFormValues.econDeposit));
            }
            if (qualFormValues.econMonthlyIncome != null) {
                fd.append('econ_monthly_income', String(qualFormValues.econMonthlyIncome));
            }
            // 經濟弱勢強制 way='2'（user feedback #1）；小康依使用者選擇
            const effectiveWay = qualFormValues.subsidyType === '1' ? '2' : applicationWay;
            fd.append('application_way', effectiveWay);
            if (effectiveWay === '2') {
                fd.append('referral_unit_name', referralUnitName.trim());
                fd.append('referral_contact_name', referralContactName.trim());
                fd.append('referral_contact_title', referralContactTitle.trim());
                fd.append('referral_contact_phone', referralContactPhone.trim());
                fd.append('referral_contact_email', referralContactEmail.trim());
                fd.append('referral_email_verification_token', referralEmailVerificationToken);
            }

            // 文件已在背景上傳到 Blob；此處只送 metadata + URL
            const documentsPayload = docs
                .flatMap(d => d.files
                    .filter(file => file.uploadStatus === 'done' && file.url)
                    .map(file => ({
                        docId: d.docId,
                        url: file.url,
                        originalName: file.file.name,
                        mimeType: file.mimeType,
                        size: file.size,
                    })));
            fd.append('documents', JSON.stringify(documentsPayload));

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
                                <EmailVerificationControl
                                    email={email}
                                    purpose="applicant_application"
                                    verifiedToken={emailVerificationToken}
                                    onVerified={setEmailVerificationToken}
                                    onReset={() => setEmailVerificationToken('')}
                                    label="申請人 Email"
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    申請人 Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
                                    placeholder="applicant@example.com"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-slate-400 mt-1">案件通知與後續聯絡會寄至此信箱。</p>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    聯絡電話 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={applicantPhone}
                                    onChange={e => { setApplicantPhone(e.target.value); setApplicantPhoneError(''); }}
                                    maxLength={50}
                                    placeholder="例：0912-345-678"
                                    className={[
                                        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2',
                                        applicantPhoneError
                                            ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                            : 'border-gray-300 focus:ring-blue-500',
                                    ].join(' ')}
                                />
                                {applicantPhoneError && (
                                    <p className="text-xs text-red-500 mt-1">{applicantPhoneError}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    出生年月日（西元）<span className="text-red-500">*</span>
                                </label>
                                <DateInput
                                    value={applicantDob}
                                    onChange={value => {
                                        setApplicantDob(value);
                                        setApplicantDobError('');
                                        const age = calculateAgeFromDob(value);
                                        if (age !== null) {
                                            setQualFormValues(prev => ({ ...prev, age }));
                                        }
                                    }}
                                    className={[
                                        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2',
                                        applicantDobError ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:ring-blue-500',
                                    ].join(' ')}
                                />
                                {applicantDobError && <p className="text-xs text-red-500 mt-1">{applicantDobError}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    癌別 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={cancerType}
                                    onChange={e => { setCancerType(e.target.value); setCancerTypeError(''); }}
                                    placeholder="例：肺腺癌"
                                    maxLength={100}
                                    className={[
                                        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2',
                                        cancerTypeError ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:ring-blue-500',
                                    ].join(' ')}
                                />
                                {cancerTypeError && <p className="text-xs text-red-500 mt-1">{cancerTypeError}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    癌症期數 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={cancerStage}
                                    onChange={e => { setCancerStage(e.target.value); setCancerStageError(''); }}
                                    placeholder="例：第三期、IIIA"
                                    maxLength={50}
                                    className={[
                                        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2',
                                        cancerStageError ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:ring-blue-500',
                                    ].join(' ')}
                                />
                                {cancerStageError && <p className="text-xs text-red-500 mt-1">{cancerStageError}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    申請形式 <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed text-sm flex-1 justify-center">
                                        <input type="radio" disabled className="accent-gray-400" />
                                        紙本
                                    </label>
                                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-blue-300 bg-blue-50 text-blue-700 text-sm flex-1 justify-center">
                                        <input type="radio" checked readOnly className="accent-blue-600" />
                                        電子郵件
                                    </label>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">線上收件一律為電子郵件</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    欲申請治療項目 <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    {([
                                        { v: 'A', label: '治療完成（三個月以內）' },
                                        { v: 'B', label: '治療未開始' },
                                        { v: 'X', label: '兩者皆有' },
                                    ] as const).map(opt => (
                                        <label key={opt.v} className={`inline-flex items-center gap-1 px-2 py-2 rounded-md border cursor-pointer text-sm flex-1 justify-center ${
                                            treatmentPhase === opt.v
                                                ? 'bg-blue-50 border-blue-300 text-blue-700'
                                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
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
                                    <option value="A">A 類－自費醫療補助</option>
                                </select>
                            </div>
                            {/* 申請方式 + 轉介窗口（user feedback #1 #6）
                                經濟弱勢強制轉介；小康預設自提、可改轉介 */}
                            {(() => {
                                const isEcon = qualFormValues.subsidyType === '1';
                                const showTransferForm = isEcon || applicationWay === '2';
                                return (
                                <div className="md:col-span-2 space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            申請方式 <span className="text-red-500">*</span>
                                            {isEcon && <span className="text-xs text-rose-600 font-normal ml-2">（經濟弱勢僅接受轉介）</span>}
                                        </label>
                                        <div className="flex gap-2">
                                            <label className={clsx(
                                                'inline-flex items-center gap-1.5 px-3 py-2 rounded-md border cursor-pointer text-sm flex-1 justify-center',
                                                isEcon ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                                                       : (applicationWay === '1' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600')
                                            )}>
                                                <input type="radio" checked={!isEcon && applicationWay === '1'}
                                                    disabled={isEcon}
                                                    onChange={() => !isEcon && setApplicationWay('1')}
                                                    className="accent-blue-600" />
                                                自行申請
                                            </label>
                                            <label className={clsx(
                                                'inline-flex items-center gap-1.5 px-3 py-2 rounded-md border cursor-pointer text-sm flex-1 justify-center',
                                                (isEcon || applicationWay === '2') ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600'
                                            )}>
                                                <input type="radio" checked={isEcon || applicationWay === '2'}
                                                    onChange={() => setApplicationWay('2')}
                                                    className="accent-blue-600" />
                                                轉介（社工/個管師等代為申請)
                                            </label>
                                        </div>
                                    </div>
                                    {showTransferForm && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                                            <p className="text-xs text-blue-700 font-medium">
                                                請填寫轉介窗口資訊（後續審核與通知會以下方資料聯繫）
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        轉介單位／機構 <span className="text-red-500">*</span>
                                                    </label>
                                                    <input type="text" value={referralUnitName}
                                                        onChange={e => { setReferralUnitName(e.target.value); setReferralErrors(p => ({...p, unit: undefined})); }}
                                                        placeholder="例：國泰綜合醫院 社工室"
                                                        maxLength={100}
                                                        className={clsx('w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2',
                                                            referralErrors.unit ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:ring-blue-500')} />
                                                    {referralErrors.unit && <p className="text-xs text-red-500 mt-0.5">{referralErrors.unit}</p>}
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        轉介人姓名 <span className="text-red-500">*</span>
                                                    </label>
                                                    <input type="text" value={referralContactName}
                                                        onChange={e => { setReferralContactName(e.target.value); setReferralErrors(p => ({...p, name: undefined})); }}
                                                        placeholder="例：王小明"
                                                        maxLength={50}
                                                        className={clsx('w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2',
                                                            referralErrors.name ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:ring-blue-500')} />
                                                    {referralErrors.name && <p className="text-xs text-red-500 mt-0.5">{referralErrors.name}</p>}
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        轉介人職稱 <span className="text-red-500">*</span>
                                                    </label>
                                                    <input type="text" value={referralContactTitle}
                                                        onChange={e => { setReferralContactTitle(e.target.value); setReferralErrors(p => ({...p, title: undefined})); }}
                                                        placeholder="例：社工師／個管師"
                                                        maxLength={50}
                                                        className={clsx('w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2',
                                                            referralErrors.title ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:ring-blue-500')} />
                                                    {referralErrors.title && <p className="text-xs text-red-500 mt-0.5">{referralErrors.title}</p>}
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        轉介人聯絡電話 <span className="text-red-500">*</span>
                                                    </label>
                                                    <input type="tel" value={referralContactPhone}
                                                        onChange={e => { setReferralContactPhone(e.target.value); setReferralErrors(p => ({...p, phone: undefined})); }}
                                                        placeholder="例：(03) 5278999 #1234"
                                                        maxLength={30}
                                                        className={clsx('w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2',
                                                            referralErrors.phone ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:ring-blue-500')} />
                                                    {referralErrors.phone && <p className="text-xs text-red-500 mt-0.5">{referralErrors.phone}</p>}
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        轉介人 Email <span className="text-red-500">*</span>
                                                    </label>
                                                    <input type="email" value={referralContactEmail}
                                                        onChange={e => {
                                                            setReferralContactEmail(e.target.value);
                                                            setReferralErrors(p => ({ ...p, email: undefined }));
                                                        }}
                                                        placeholder="請填寫轉介人 Email"
                                                        maxLength={100}
                                                        className={clsx('w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2',
                                                            referralErrors.email ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:ring-blue-500')} />
                                                    <EmailVerificationControl
                                                        email={referralContactEmail}
                                                        purpose="referral_application"
                                                        verifiedToken={referralEmailVerificationToken}
                                                        onVerified={setReferralEmailVerificationToken}
                                                        onReset={() => setReferralEmailVerificationToken('')}
                                                        label="轉介人 Email"
                                                    />
                                                    {referralErrors.email && <p className="text-xs text-red-500 mt-0.5">{referralErrors.email}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Qualification Form */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-base font-bold text-gray-800 mb-4">資格預審資料</h3>
                        {/* Quota display */}
                        {currentQuota && (
                            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm space-y-1">
                                <p className="text-slate-600">
                                    <span className="text-slate-500">累積已獲補助：</span>
                                    <span className="font-semibold text-slate-800">NT${currentQuota.cumulativeApproved.toLocaleString()} 元</span>
                                </p>
                                <p className="text-slate-600">
                                    <span className="text-slate-500">尚可申請額度：</span>
                                    <span className={`font-semibold ${currentQuota.remaining <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                        NT${currentQuota.remaining.toLocaleString()} 元
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
                            // 帶入 landing 卡片預選的子類型（qualFormValues.subsidyType）
                            initialValues={qualFormValues}
                            onValidation={handleQualValidation}
                            readOnly={step === 'submitting'}
                            subtypeMaxAmounts={subtypeMaxAmounts}
                        />
                        {/* #4：手動「資格判定」按鈕 + 結果顯示（必須通過才能上傳文件） */}
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <ShieldQuestion className="w-3.5 h-3.5" />
                                    完成填寫上方資料後，點選「執行資格判定」確認是否符合 115 年辦法資格。
                                </p>
                                <button
                                    type="button"
                                    onClick={handleRunEligibilityCheck}
                                    disabled={eligibilityChecking || step === 'submitting'}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 shrink-0"
                                >
                                    {eligibilityChecking
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <ShieldQuestion className="w-3.5 h-3.5" />}
                                    執行資格判定
                                </button>
                            </div>

                            {/* 結果卡 */}
                            {!eligibilityCheck && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600 flex items-start gap-2">
                                    <ShieldQuestion className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                                    <span>尚未執行資格判定 — 須通過判定後才能上傳文件與送出申請。</span>
                                </div>
                            )}
                            {eligibilityCheck?.eligible && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium">符合 115 年辦法之申請資格</p>
                                        <p className="text-xs text-emerald-600 mt-0.5">最終仍須由承辦人覆核與文件查驗。</p>
                                    </div>
                                </div>
                            )}
                            {eligibilityCheck && !eligibilityCheck.eligible && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-2">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                                        <p className="font-medium">不符合 115 年辦法之申請資格 — 暫不可上傳文件與送出</p>
                                    </div>
                                    <ul className="list-disc list-inside space-y-1 text-xs ml-1">
                                        {eligibilityCheck.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                    <div className="rounded border border-amber-200 bg-amber-100/50 px-3 py-2 text-[11px] text-amber-800 space-y-1">
                                        <p>建議您可以在另一補助類型輸入資料，可能您符合另一補助。</p>
                                        {qualFormValues.subsidyType === '2' && (
                                            <p>因治療可能影響工作，若您最新年度收入未達最低標準，可由近三年綜所稅中任選一年有達標的年收入提出申請。</p>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-amber-700">請調整上方資料後再次按「執行資格判定」。</p>
                                    {(orgContact.lineId || orgContact.phone || orgContact.qrUrl) && (
                                        <div className="border-t border-amber-200 pt-2 mt-2 text-xs text-amber-800">
                                            <p className="font-semibold mb-2">如有疑問或特殊狀況請聯繫萬美基金會：</p>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                {orgContact.qrUrl && (
                                                    <img
                                                        src={orgContact.qrUrl}
                                                        alt="萬美官方 LINE QR code"
                                                        className="h-24 w-24 rounded-lg border border-amber-200 bg-white p-1 object-contain"
                                                    />
                                                )}
                                                <div className="space-y-1 min-w-0">
                                                    {orgContact.lineId && (
                                                        <p>
                                                            ‧ 官方 LINE：
                                                            <a
                                                                href={`https://line.me/R/ti/p/${encodeURIComponent(orgContact.lineId)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="ml-1 font-mono text-amber-900 underline hover:text-amber-950 break-all"
                                                            >
                                                                {orgContact.lineId}
                                                            </a>
                                                        </p>
                                                    )}
                                                    {orgContact.phone && (
                                                        <p>
                                                            ‧ 聯絡電話：
                                                            <a
                                                                href={`tel:${orgContact.phone.replace(/[^0-9+]/g, '')}`}
                                                                className="ml-1 font-mono text-amber-900 underline hover:text-amber-950"
                                                            >
                                                                {orgContact.phone}
                                                            </a>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Document Upload — 必須通過資格判定才開放 */}
                    <div className={clsx(
                        'bg-white rounded-xl border shadow-sm p-6 relative',
                        canUpload ? 'border-gray-200' : 'border-slate-200'
                    )}>
                        <h3 className="text-base font-bold text-gray-800 mb-1">文件上傳</h3>
                        <p className="text-xs text-gray-400 mb-4">
                            接受 PDF、Word、圖片格式（.pdf .doc .docx .jpg .jpeg .png）。
                            標記 <span className="text-red-500 font-bold">*</span> 為送出前必須上傳；標記
                            <span className="mx-1 inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none">可補件</span>
                            者可於送出後補交。
                        </p>
                        <div className={clsx(!canUpload && 'pointer-events-none select-none opacity-40')}>
                            {docs.map(doc => (
                                <DocUploadRow
                                    key={doc.field}
                                    doc={doc}
                                    onChange={files => updateDoc(doc.field, files)}
                                />
                            ))}
                        </div>
                        {!canUpload && (
                            <div className="absolute inset-0 rounded-xl bg-slate-50/70 backdrop-blur-[1px] flex items-center justify-center">
                                <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-4 py-3 flex items-start gap-2 max-w-sm">
                                    <Lock className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
                                    <div className="text-xs text-slate-700">
                                        <p className="font-semibold">請先通過資格判定</p>
                                        <p className="text-slate-500 mt-0.5">完成上方「資格預審資料」並點選「執行資格判定」。判定為符合資格後才能上傳文件。</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {canUpload && requiredDocsMissing.length > 0 && (
                            <p className="text-xs text-red-500 mt-2">
                                送出前必須上傳：{requiredDocsMissing.map(d => d.label).join('、')}
                            </p>
                        )}
                        {canUpload && docs.some(d => d.required && d.allowSupplement && !d.files.some(file => file.uploadStatus === 'done')) && (
                            <p className="text-xs text-amber-600 mt-1.5">
                                標示「可補件」的文件可於送出後補交，建議盡早提供以利審核。
                            </p>
                        )}
                        {hasInflightUploads && (
                            <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />檔案上傳中，請稍候…
                            </p>
                        )}
                        {hasFailedUploads && (
                            <p className="text-xs text-red-600 mt-2">有檔案上傳失敗，請點上方「重試」</p>
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
    const contactLineId = orgContact.lineId.trim();
    const contactPhone = orgContact.phone.trim();
    const contactQrUrl = orgContact.qrUrl.trim();
    const lineHref = contactLineId
        ? `https://line.me/R/ti/p/${encodeURIComponent(contactLineId)}`
        : '';
    const phoneHref = contactPhone
        ? `tel:${contactPhone.replace(/[^0-9+]/g, '')}`
        : '';
    const hasContactInfo = Boolean(contactQrUrl || contactLineId || contactPhone);

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
            {hasContactInfo && (
                <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left">
                    <div className="flex items-center gap-4">
                        {contactQrUrl && (
                            <img
                                src={contactQrUrl}
                                alt="萬美官方 LINE QR code"
                                className="h-24 w-24 rounded-lg border border-white bg-white p-1"
                            />
                        )}
                        <div className="min-w-0 text-sm text-emerald-900">
                            <p className="font-semibold">後續聯絡資訊</p>
                            {contactLineId && (
                                <a
                                    href={lineHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 block break-all text-emerald-800 underline"
                                >
                                    加入萬美官方 LINE
                                </a>
                            )}
                            {contactPhone && (
                                <a href={phoneHref} className="mt-1 block font-mono text-emerald-800 underline">
                                    {contactPhone}
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div className="text-xs text-gray-400">
                請記錄此案件編號，如有需要請聯繫萬美基金會承辦人員。
            </div>
        </div>
    );
}
