import { useState, useEffect } from 'react';
import { ArrowLeft, FilePlus, Search, CheckCircle, XCircle, Phone, AlertTriangle } from 'lucide-react';
import { checkApplicationStatus } from '../app/actions/applicationActions';
import { twIdError } from '../lib/validateTwId';
import { AppHeader } from './AppHeader';
import { useToast } from './FloatingToast';
import { ApplicationForm } from './ApplicationForm';
import { ContactSearchModal } from './ContactSearchModal';
import type { ApplicantFormValues } from '../schemas/applicant';

interface NewApplicationPageProps {
    username: string;
    userAccount: string;
    /** 當前操作者 user.id — 給聯絡紀錄查詢 modal 用 */
    userId: string;
    onBack: () => void;
    onGoHome: () => void;
    onLogout: () => void;
    onSubmitSuccess: (newCaseId: string) => void;
}


// ── Lookup result card ─────────────────────────────────────────────────────────

interface LookupCardProps {
    result: {
        hasRecord: boolean;
        hasActive: boolean;
        totalApprovedSubtype1: number;
        totalApprovedSubtype2: number;
        applicantName?: string;
    };
    eligible: boolean;
    /** 後台動態管理的子類型上限 */
    subtypeMaxAmounts: Record<'1' | '2', number>;
    /** 當前選擇的子類型 — 高亮對應列；空字串時不高亮 */
    selectedSubtype: '1' | '2' | '';
}

function LookupCard({ result, eligible, subtypeMaxAmounts, selectedSubtype }: LookupCardProps) {
    const maxA = subtypeMaxAmounts['1'] ?? 0;
    const maxB = subtypeMaxAmounts['2'] ?? 0;
    const remainA = Math.max(0, maxA - (result.totalApprovedSubtype1 ?? 0));
    const remainB = Math.max(0, maxB - (result.totalApprovedSubtype2 ?? 0));

    const renderRow = (
        label: string, code: '1' | '2',
        max: number, cum: number, remain: number,
    ) => {
        const highlight = selectedSubtype === code;
        const atLimit = remain <= 0;
        return (
            <div className={[
                'flex items-baseline gap-2 px-2 py-1 rounded',
                highlight ? 'bg-blue-50 ring-1 ring-blue-200' : '',
            ].join(' ')}>
                <span className={`text-xs ${highlight ? 'font-semibold text-blue-700' : 'text-slate-500'} shrink-0`}>
                    {label}
                </span>
                <span className="text-xs text-slate-400 shrink-0">上限</span>
                <span className="text-sm font-medium text-slate-700 shrink-0">NT$ {max.toLocaleString()}</span>
                <span className="text-xs text-slate-400 shrink-0 ml-1">已累積</span>
                <span className={`text-sm font-medium shrink-0 ${cum > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                    {cum > 0 ? `NT$ ${cum.toLocaleString()}` : '—'}
                </span>
                <span className="ml-auto text-xs text-slate-400 shrink-0">尚可申請</span>
                <span className={`text-sm font-bold shrink-0 ${atLimit ? 'text-red-600' : 'text-emerald-700'}`}>
                    {atLimit ? '已達上限' : `NT$ ${remain.toLocaleString()}`}
                </span>
            </div>
        );
    };

    return (
        <div
            className={[
                'rounded-xl border p-5 space-y-3 transition-all',
                eligible
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200',
            ].join(' ')}
        >
            <div className="flex items-center gap-2 font-semibold text-sm">
                {eligible ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={eligible ? 'text-emerald-800' : 'text-red-800'}>
                    {eligible ? '申請人符合申請資格' : '申請人目前不符合申請資格'}
                </span>
            </div>

            <div className="text-sm space-y-1 text-slate-700">
                {result.hasRecord ? (
                    <>
                        <p>
                            <span className="text-slate-500">申請紀錄：</span>
                            <span className="font-medium">有申請紀錄</span>
                            {result.applicantName && (
                                <span className="ml-1 text-slate-500">（{result.applicantName}）</span>
                            )}
                        </p>
                        <p>
                            <span className="text-slate-500">進行中案件：</span>
                            {result.hasActive ? (
                                <span className="font-medium text-red-600">是（目前仍有案件審核中）</span>
                            ) : (
                                <span className="font-medium text-emerald-700">無</span>
                            )}
                        </p>
                    </>
                ) : (
                    <p className="text-slate-600">查無任何申請紀錄，可受理新申請。</p>
                )}
                {/* 個別顯示兩子類型的累積與剩餘 — 選中的子類型高亮 */}
                <div className="pt-2 mt-2 border-t border-white/40 space-y-1">
                    {renderRow('經濟弱勢', '1', maxA, result.totalApprovedSubtype1 ?? 0, remainA)}
                    {renderRow('小康家庭', '2', maxB, result.totalApprovedSubtype2 ?? 0, remainB)}
                </div>
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function NewApplicationPage({
    username,
    userAccount,
    userId,
    onBack,
    onGoHome,
    onLogout,
    onSubmitSuccess,
}: NewApplicationPageProps) {
    /** 聯絡紀錄查詢 modal — 新增案件前可先用身分證查申請人是否有過聯絡紀錄 */
    const [contactSearchOpen, setContactSearchOpen] = useState(false);
    const { push: pushToast } = useToast();
    const [name, setName] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [applicantPhone, setApplicantPhone] = useState('');
    const [applicantPhoneError, setApplicantPhoneError] = useState('');
    const [applicantDob, setApplicantDob] = useState('');
    const [applicantDobError, setApplicantDobError] = useState('');
    const [cancerType, setCancerType] = useState('');
    const [cancerTypeError, setCancerTypeError] = useState('');
    const [cancerStage, setCancerStage] = useState('');
    const [cancerStageError, setCancerStageError] = useState('');
    const [applicationForm, setApplicationForm] = useState<'P' | 'E' | ''>('');
    const [applicationFormError, setApplicationFormError] = useState('');
    const [treatmentPhase, setTreatmentPhase] = useState<'B' | 'A' | 'X' | ''>('');
    const [treatmentPhaseError, setTreatmentPhaseError] = useState('');
    const [applicationType, setApplicationType] = useState('');
    const [applyAmount, setApplyAmount] = useState<number | ''>('');
    const [applicationWay, setApplicationWay] = useState<'1' | '2'>('1');
    const [subsidySubtype, setSubsidySubtype] = useState<'1' | '2' | ''>('');
    const [subsidySubtypeError, setSubsidySubtypeError] = useState('');
    const [referralUnitId, setReferralUnitId] = useState<string | null>(null);
    const [referralUnits, setReferralUnits] = useState<{ id: string; name: string }[]>([]);
    const [referralUnitsLoaded, setReferralUnitsLoaded] = useState(false);
    const [referralError, setReferralError] = useState('');
    /** #6 轉介單位自由填寫 + 承辦人聯絡欄位 */
    const [referralUnitName, setReferralUnitName] = useState('');
    const [referralContactName, setReferralContactName] = useState('');
    const [referralContactTitle, setReferralContactTitle] = useState('');
    const [referralContactPhone, setReferralContactPhone] = useState('');
    /** 4 個轉介必填欄位的個別錯誤訊息 */
    const [referralFieldErrors, setReferralFieldErrors] = useState<{
        unit?: string; name?: string; title?: string; phone?: string;
    }>({});
    /** referralUnitId 特殊值 'other' 表示「其他/不在清單中」，提交時將該名稱新建為 referral_unit */
    const OTHER_UNIT = 'other';
    /** 資格預審表單值（婚姻 / 子女 / 收入 / 動產 / 不動產 / 經濟弱勢專屬） */
    const DEFAULT_QUAL: ApplicantFormValues = {
        subsidyType: undefined,
        type: '3',
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
    const [qualFormValues, setQualFormValues] = useState<ApplicantFormValues>(DEFAULT_QUAL);
    const [qualFormValid, setQualFormValid]   = useState(false);

    /** 資格判定狀態：null = 尚未執行；checked + eligible 兩段式（仿 ExternalIntake） */
    const [eligibilityCheck, setEligibilityCheck] =
        useState<{ checked: boolean; eligible: boolean; reasons: string[] } | null>(null);
    const [eligibilityChecking, setEligibilityChecking] = useState(false);

    const handleQualValidation = (isValid: boolean, values: ApplicantFormValues) => {
        setQualFormValid(isValid);
        setQualFormValues(values);
        // 資料一變動就作廢先前的資格判定，強制使用者重新執行
        setEligibilityCheck(null);
    };
    /** 子類型外層 radio 變動 → 也作廢資格判定 */
    useEffect(() => {
        setEligibilityCheck(null);
    }, [subsidySubtype]);

    const handleRunEligibilityCheck = async () => {
        if (eligibilityChecking) return;
        if (!subsidySubtype) {
            setEligibilityCheck({ checked: true, eligible: false, reasons: ['請先選擇補助子類型（經濟弱勢／小康家庭）'] });
            return;
        }
        if (!qualFormValid) {
            setEligibilityCheck({ checked: true, eligible: false, reasons: ['請先填寫資格預審資料（婚姻、年齡、收入等）'] });
            return;
        }
        setEligibilityChecking(true);
        try {
            const { fetchEligibilityRules } = await import('../app/actions/eligibilityRulesActions');
            const { checkEligibility } = await import('../utils/eligibility');
            const rules = await fetchEligibilityRules();
            const f = qualFormValues;
            const maritalStatus = (f.type === '1' || f.type === '2' || f.type === '3') ? f.type : '3';
            const hasUnderage = Number(f.underageChildrenCount ?? 0) > 0;
            const childrenStatus = !f.hasChildren ? '3' : hasUnderage ? '1' : '2';
            const result = checkEligibility({
                subsidyType: subsidySubtype,
                age: Number(f.age ?? 0),
                realEstateValue: Number(f.realEstateValue ?? 0),
                maritalStatus,
                childrenStatus,
                annualIncome:  Number(f.annualIncome ?? 0),
                movableAssets: Number(f.movableAssets ?? 0),
                deposit:       f.econDeposit       != null ? Number(f.econDeposit)       : undefined,
                monthlyIncome: f.econMonthlyIncome != null ? Number(f.econMonthlyIncome) : undefined,
            }, rules);
            setEligibilityCheck({ checked: true, eligible: result.isEligible, reasons: result.reasons });
        } catch (e) {
            setEligibilityCheck({
                checked: true, eligible: false,
                reasons: [e instanceof Error ? e.message : '資格判定失敗，請稍後重試'],
            });
        } finally {
            setEligibilityChecking(false);
        }
    };
    const eligibilityPassed = !!(eligibilityCheck?.checked && eligibilityCheck?.eligible);
    const [applyAmountError, setApplyAmountError] = useState('');
    const [appTypeError, setAppTypeError] = useState('');
    const [nameError, setNameError] = useState('');
    const [idError, setIdError] = useState('');
    const [lookupResult, setLookupResult] = useState<{
        hasRecord: boolean;
        hasActive: boolean;
        totalApprovedAmount: number;
        totalApprovedSubtype1: number;
        totalApprovedSubtype2: number;
        applicantName?: string;
    } | null>(null);
    const [eligible, setEligible] = useState(false);
    const [isLoadingQuery, setIsLoadingQuery] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [queried, setQueried] = useState(false);
    /** 各子類型補助上限（依 115 辦法）；未選子類型時 UI 顯示用兩者較大值 */
    const [subtypeMaxAmounts, setSubtypeMaxAmounts] = useState<Record<'1' | '2', number>>({ '1': 30000, '2': 350000 });
    useEffect(() => {
        import('../app/actions/eligibilityRulesActions')
            .then(m => m.fetchSubsidyAmountLimitsMap())
            .then(setSubtypeMaxAmounts)
            .catch(err => console.error('fetchSubsidyAmountLimitsMap error:', err));
    }, []);
    /** 動態計算當前 form 適用的最大值：依 subsidySubtype；尚未選擇時取兩子類型較大值 */
    const maxApplyAmount = subsidySubtype === '1' || subsidySubtype === '2'
        ? subtypeMaxAmounts[subsidySubtype]
        : Math.max(subtypeMaxAmounts['1'], subtypeMaxAmounts['2']);

    /** 依「目前選擇的子類型 + 該子類型已累積核准金額」算出本次可申請金額上限 */
    const effectiveApplyCap = (() => {
        if (!subsidySubtype) return 0;
        const max = subtypeMaxAmounts[subsidySubtype] ?? 0;
        const cum = subsidySubtype === '1'
            ? (lookupResult?.totalApprovedSubtype1 ?? 0)
            : (lookupResult?.totalApprovedSubtype2 ?? 0);
        return Math.max(0, max - cum);
    })();

    /** #24 申請金額預設為當前子類型的剩餘額度；當使用者尚未手動修改時自動填入 */
    useEffect(() => {
        if (applyAmount !== '' && applyAmount !== 0) return; // 已輸入則不覆蓋
        if (!lookupResult || !subsidySubtype) return;
        if (effectiveApplyCap > 0) setApplyAmount(effectiveApplyCap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lookupResult, subsidySubtype, effectiveApplyCap]);

    // Lazy-load referral units only when user picks '轉介'
    useEffect(() => {
        if (applicationWay !== '2' || referralUnitsLoaded) return;
        import('../app/actions/referralUnitActions').then(async m => {
            const res = await m.fetchActiveReferralUnits();
            if (res.success && res.data) {
                setReferralUnits(res.data.map(u => ({ id: u.id, name: u.name })));
            }
            setReferralUnitsLoaded(true);
        });
    }, [applicationWay, referralUnitsLoaded]);

    // Reset query result whenever identity fields change
    const handleNameChange = (v: string) => {
        setName(v);
        setLookupResult(null);
        setEligible(false);
        setQueried(false);
    };
    const handleIdChange = (v: string) => {
        setIdNumber(v);
        setLookupResult(null);
        setEligible(false);
        setQueried(false);
    };

    // Validate fields needed for lookup (id + subtype + type)
    const validateForLookup = (): boolean => {
        let ok = true;
        const idErr = twIdError(idNumber.trim());
        if (idErr) { setIdError(idErr); ok = false; } else { setIdError(''); }
        if (!applicationType) { setAppTypeError('請選擇申請類別'); ok = false; } else { setAppTypeError(''); }
        if (!subsidySubtype) { setSubsidySubtypeError('請選擇補助子類型'); ok = false; } else { setSubsidySubtypeError(''); }
        return ok;
    };

    // Validate all fields before final submit
    const validateForSubmit = (): boolean => {
        let ok = validateForLookup();
        if (!name.trim()) {
            setNameError('請輸入申請人姓名');
            ok = false;
        } else if (name.trim().length > 50) {
            setNameError('申請人姓名不可超過 50 個字');
            ok = false;
        } else {
            setNameError('');
        }
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setEmailError('請填寫 Email');
            ok = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setEmailError('請填寫有效的 Email 地址');
            ok = false;
        } else {
            setEmailError('');
        }
        const trimmedPhone = applicantPhone.trim();
        if (!trimmedPhone) {
            setApplicantPhoneError('請填寫申請人聯絡電話');
            ok = false;
        } else {
            setApplicantPhoneError('');
        }
        const trimmedDob = applicantDob.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDob)) {
            setApplicantDobError('請選擇出生年月日');
            ok = false;
        } else {
            setApplicantDobError('');
        }
        if (!cancerType.trim()) { setCancerTypeError('請填寫癌別'); ok = false; }
        else { setCancerTypeError(''); }
        if (!cancerStage.trim()) { setCancerStageError('請填寫癌症期數'); ok = false; }
        else { setCancerStageError(''); }
        if (applicationForm !== 'P' && applicationForm !== 'E') {
            setApplicationFormError('請選擇申請形式'); ok = false;
        } else { setApplicationFormError(''); }
        if (treatmentPhase !== 'B' && treatmentPhase !== 'A' && treatmentPhase !== 'X') {
            setTreatmentPhaseError('請選擇治療階段'); ok = false;
        } else { setTreatmentPhaseError(''); }
        const amtNum = applyAmount === '' ? 0 : Number(applyAmount);
        if (amtNum <= 0) {
            setApplyAmountError('請輸入申請金額');
            ok = false;
        } else if (amtNum > effectiveApplyCap) {
            // 雙保險：理論上 input 即時 clamp 不會發生，仍保留 server-side 保護
            setApplyAmount(effectiveApplyCap);
            setApplyAmountError(`上限為 NT$${effectiveApplyCap.toLocaleString()} 元`);
            ok = false;
        } else {
            setApplyAmountError('');
        }
        // 子類型必填
        if (!subsidySubtype) {
            setSubsidySubtypeError('請選擇補助子類型');
            ok = false;
        } else {
            setSubsidySubtypeError('');
        }
        // 經濟弱勢 → 強制轉介
        if (subsidySubtype === '1' && applicationWay !== '2') {
            setSubsidySubtypeError('經濟弱勢補助依 115 辦法僅接受「轉介」管道');
            ok = false;
        }
        // 資格預審欄位完整性
        if (!qualFormValid) {
            pushToast({ type: 'error', msg: '請填寫資格預審資料（婚姻、年齡、收入等）' });
            ok = false;
        }
        // 必須通過資格判定才能送出
        if (!eligibilityPassed) {
            pushToast({
                type: 'error',
                msg: eligibilityCheck
                    ? '資格判定未通過，請依提示調整資料後重新判定'
                    : '請先點選「執行資格判定」',
            });
            ok = false;
        }
        if (applicationWay === '2') {
            // 必須先選擇下拉（特定單位 / 其他）
            if (!referralUnitId) {
                setReferralError('請選擇轉介單位（不在清單中請選「其他」）');
                ok = false;
            } else {
                setReferralError('');
            }
            // 4 個欄位皆必填
            const errs: typeof referralFieldErrors = {};
            if (!referralUnitName.trim())    errs.unit  = '單位名稱必填';
            if (!referralContactName.trim()) errs.name  = '承辦人姓名必填';
            if (!referralContactTitle.trim()) errs.title = '承辦人職稱必填';
            if (!referralContactPhone.trim()) errs.phone = '承辦人聯絡電話必填';
            setReferralFieldErrors(errs);
            if (Object.keys(errs).length > 0) ok = false;
        } else {
            setReferralError('');
            setReferralFieldErrors({});
        }
        return ok;
    };

    const handleLookup = async () => {
        if (!validateForLookup()) return;
        setIsLoadingQuery(true);
        setQueried(false);
        setLookupResult(null);

        try {
            const apiRes = await checkApplicationStatus(idNumber.trim().toUpperCase());
            
            if (apiRes.error) {
                pushToast({ type: 'error', msg: apiRes.error });
                setEligible(false);
                setIsLoadingQuery(false);
                return;
            }

            const mappedResult = {
                hasRecord: apiRes.found,
                hasActive: !!apiRes.hasActiveApplication,
                totalApprovedAmount: apiRes.totalApprovedAmount || 0,
                totalApprovedSubtype1: apiRes.totalApprovedSubtype1 || 0,
                totalApprovedSubtype2: apiRes.totalApprovedSubtype2 || 0,
                applicantName: apiRes.found && name.trim() ? name.trim() : undefined,
            };

            setLookupResult(mappedResult);
            setQueried(true);

            // Determine eligibility — 以「選擇的子類型」的累積 vs 該子類型上限判斷
            const selectedCum = subsidySubtype === '1'
                ? mappedResult.totalApprovedSubtype1
                : subsidySubtype === '2'
                    ? mappedResult.totalApprovedSubtype2
                    : 0;
            const selectedMax = subsidySubtype ? (subtypeMaxAmounts[subsidySubtype] ?? 0) : 0;
            if (mappedResult.hasActive) {
                setEligible(false);
                pushToast({
                    type: 'error',
                    msg: '該申請人目前已有進行中的申請案件，無法重複申請，請待現有案件結案後再行申請。',
                });
            } else if (selectedMax > 0 && selectedCum >= selectedMax) {
                setEligible(false);
                const label = subsidySubtype === '1' ? '經濟弱勢' : '小康家庭';
                pushToast({
                    type: 'info',
                    msg: `該申請人在「${label}」累積核准補助金額（NT$${selectedCum.toLocaleString()}）已達上限 NT$${selectedMax.toLocaleString()} 元，此子類型無法再申請。`,
                });
            } else {
                setEligible(true);
            }
        } catch (err) {
            pushToast({ type: 'error', msg: '連線錯誤，請稍後重試。' });
        } finally {
            setIsLoadingQuery(false);
        }
    };

    const handleSubmit = async () => {
        if (!eligible || !validateForSubmit()) return;
        setIsSubmitting(true);
        try {
            // 若選「其他」→ 先建立新轉介單位、取得新 id
            let effectiveReferralUnitId: string | null = null;
            if (applicationWay === '2') {
                if (referralUnitId === OTHER_UNIT) {
                    const { createReferralUnit, fetchActiveReferralUnits } =
                        await import('../app/actions/referralUnitActions');
                    const createRes = await createReferralUnit(
                        referralUnitName.trim(),
                        referralContactPhone.trim() || null,
                        9999,
                        userAccount,
                    );
                    if (!createRes.success || !createRes.data) {
                        pushToast({ type: 'error', msg: '新增轉介單位失敗：' + (createRes.success ? '系統錯誤' : createRes.error) });
                        setIsSubmitting(false);
                        return;
                    }
                    effectiveReferralUnitId = createRes.data.id;
                    // 重新載入清單供日後新增案件可看到
                    void fetchActiveReferralUnits().then(r => {
                        if (r.success && r.data) setReferralUnits(r.data.map(u => ({ id: u.id, name: u.name })));
                    });
                } else {
                    effectiveReferralUnitId = referralUnitId;
                }
            }

            const { createNewApplication } = await import('../app/actions/applicationActions');
            const res = await createNewApplication(
                name.trim(),
                idNumber.trim(),
                userAccount,
                applicationType,
                applyAmount === '' ? null : Number(applyAmount),
                applicationWay,
                effectiveReferralUnitId,
                email.trim(),
                applicationWay === '2' ? {
                    unitName:     referralUnitName.trim() || undefined,
                    contactName:  referralContactName.trim() || undefined,
                    contactTitle: referralContactTitle.trim() || undefined,
                    contactPhone: referralContactPhone.trim() || undefined,
                } : undefined,
                subsidySubtype === '' ? null : subsidySubtype,
                applicantPhone.trim(),
                applicantDob.trim(),
                cancerType.trim(),
                cancerStage.trim(),
                applicationForm || '',
                treatmentPhase || '',
            );
            if (res.success && res.caseId) {
                // 寫入資格預審資料（婚姻 / 子女 / 收入 / 動產 / 不動產 / 經濟弱勢專屬）
                const v = qualFormValues;
                const maritalNew: '1' | '2' | '3' | null =
                    (v.type === '1' || v.type === '2' || v.type === '3') ? v.type : null;
                const { saveQualificationData } = await import('../app/actions/workflowActions');
                await saveQualificationData(res.caseId, {
                    age:                    v.age != null ? Number(v.age) : null,
                    moveable_property:      v.movableAssets != null ? Number(v.movableAssets) : null,
                    immoveable_property:    v.realEstateValue != null ? Number(v.realEstateValue) : null,
                    annual_income:          v.annualIncome != null ? Number(v.annualIncome) : null,
                    marital_status:         maritalNew,
                    has_children:           v.hasChildren ?? null,
                    underage_children_count: v.hasChildren && v.underageChildrenCount != null
                                                ? Number(v.underageChildrenCount) : null,
                    adult_children_count:   v.hasChildren && v.adultChildrenCount != null
                                                ? Number(v.adultChildrenCount) : null,
                    apply_amount:           applyAmount === '' ? null : Number(applyAmount),
                    subsidy_subtype:        (subsidySubtype === '1' || subsidySubtype === '2') ? subsidySubtype : null,
                    econ_deposit:           v.econDeposit       != null ? Number(v.econDeposit)       : null,
                    econ_monthly_income:    v.econMonthlyIncome != null ? Number(v.econMonthlyIncome) : null,
                });
                onSubmitSuccess(res.caseId);
            } else {
                pushToast({ type: 'error', msg: res.error || '建立案件失敗' });
            }
        } catch (err) {
            pushToast({ type: 'error', msg: '系統錯誤' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            {/* Header */}
            <AppHeader username={username} onGoHome={onGoHome} onLogout={onLogout} />

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 max-w-2xl space-y-6 overflow-x-hidden">
                {/* Back + title */}
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition font-medium mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        返回首頁
                    </button>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <FilePlus className="w-6 h-6 text-green-600" />
                                新增申請案件
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">
                                填寫身分證字號與申請類別後可先查詢申請資格；姓名與金額於確認資格後填寫即可。
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setContactSearchOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
                            title="以身分證 / 姓名 / 電話查申請人是否有過聯絡或關懷紀錄"
                        >
                            <Phone className="w-4 h-4" />
                            聯絡記錄查詢
                        </button>
                    </div>
                </div>

                {/* ===== 查詢區 card：身分證 + 申請類別 + 補助子類型 + 查詢按鈕 ===== */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
                    <div>
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <Search className="w-5 h-5 text-blue-600" />
                            申請狀態查詢
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            請先輸入身分證、選擇申請類別與補助子類型，按下「申請狀態查詢」確認可申請金額後再填寫其他資料。
                        </p>
                    </div>

                    {/* 身分證 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            申請人身分證字號
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="text"
                            value={idNumber}
                            onChange={e => handleIdChange(e.target.value)}
                            placeholder="例：A123456789"
                            maxLength={10}
                            className={[
                                'w-full px-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 transition',
                                idError
                                    ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                    : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                            ].join(' ')}
                        />
                        {idError && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {idError}
                            </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">格式：1 個大寫英文字母 + 9 位數字，共 10 碼</p>
                    </div>

                    {/* 申請類別 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            申請類別
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                            value={applicationType}
                            onChange={e => { setApplicationType(e.target.value); setAppTypeError(''); }}
                            className={[
                                'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition',
                                appTypeError
                                    ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                    : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                            ].join(' ')}
                        >
                            <option value="">請選擇申請類別</option>
                            <option value="A">A 類－自費醫療補助</option>
                            <option value="B">B 類－臨終安寧自費醫療補助</option>
                            <option value="C">C 類－預立醫療照護諮商補助</option>
                            <option value="D">D 類－醫事人員進修補助</option>
                        </select>
                        {appTypeError && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {appTypeError}
                            </p>
                        )}
                    </div>

                    {/* 補助子類型（115 年辦法） */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            補助子類型（115 年辦法）
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="space-y-2">
                            {[
                                { v: '1' as const, label: '經濟弱勢', limit: subtypeMaxAmounts['1'], extra: '僅接受轉介' },
                                { v: '2' as const, label: '小康家庭', limit: subtypeMaxAmounts['2'], extra: '自提或轉介均可' },
                            ].map(opt => (
                                <label key={opt.v} className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="subsidy_subtype_top"
                                        value={opt.v}
                                        checked={subsidySubtype === opt.v}
                                        onChange={() => {
                                            setSubsidySubtype(opt.v);
                                            setSubsidySubtypeError('');
                                            if (opt.v === '1') setApplicationWay('2');
                                            // 子類型變動 → 重新查詢以更新可申請金額
                                            setLookupResult(null);
                                            setEligible(false);
                                            setQueried(false);
                                        }}
                                        className="mt-0.5 w-4 h-4 accent-blue-600"
                                    />
                                    <span className="text-sm">
                                        <span className="font-medium text-slate-700">
                                            {opt.label}
                                            {opt.limit > 0 && (
                                                <span className="font-normal text-slate-500 ml-1">
                                                    （補助上限 NT${opt.limit.toLocaleString()}）
                                                </span>
                                            )}
                                        </span>
                                        <span className="block text-xs text-slate-500">{opt.extra}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        {subsidySubtypeError && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {subsidySubtypeError}
                            </p>
                        )}
                    </div>

                    {/* Query button */}
                    <div className="pt-1">
                        <button
                            onClick={handleLookup}
                            disabled={isLoadingQuery}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
                        >
                            {isLoadingQuery ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                                    </svg>
                                    查詢中…
                                </>
                            ) : (
                                <>
                                    <Search className="w-4 h-4" />
                                    申請狀態查詢
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Lookup result (top) — 查詢後立即顯示 */}
                {queried && lookupResult !== null && (
                    <LookupCard
                        result={lookupResult}
                        eligible={eligible}
                        subtypeMaxAmounts={subtypeMaxAmounts}
                        selectedSubtype={subsidySubtype}
                    />
                )}

                {/* ===== 詳細資料 card — 查詢後再填寫 ===== */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
                    {/* 姓名 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            申請人姓名
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => handleNameChange(e.target.value)}
                            maxLength={50}
                            placeholder="請輸入申請人全名"
                            className={[
                                'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition',
                                nameError
                                    ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                    : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                            ].join(' ')}
                        />
                        {nameError && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {nameError}
                            </p>
                        )}
                    </div>

                    {/* (身分證已移至上方查詢區，下方不重複；保留位置註解供開發查找) */}
                    {/* (申請類別已移至上方查詢區) */}
                    {/* (補助子類型已移至上方查詢區) */}

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            申請人 Email
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                            placeholder="applicant@example.com"
                            className={[
                                'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition',
                                emailError
                                    ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                    : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                            ].join(' ')}
                        />
                        {emailError && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {emailError}
                            </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">核銷階段將寄送領款收據至此信箱</p>
                    </div>

                    {/* 申請人聯絡電話 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            申請人聯絡電話
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="tel"
                            value={applicantPhone}
                            onChange={e => { setApplicantPhone(e.target.value); setApplicantPhoneError(''); }}
                            placeholder="例：0912-345-678 或 02-2321-2777"
                            maxLength={50}
                            className={[
                                'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition',
                                applicantPhoneError
                                    ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                    : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                            ].join(' ')}
                        />
                        {applicantPhoneError && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {applicantPhoneError}
                            </p>
                        )}
                    </div>

                    {/* 出生年月日 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            出生年月日（西元）<span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="date"
                            value={applicantDob}
                            onChange={e => { setApplicantDob(e.target.value); setApplicantDobError(''); }}
                            className={[
                                'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition',
                                applicantDobError
                                    ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                    : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                            ].join(' ')}
                        />
                        {applicantDobError && <p className="text-xs text-red-500 mt-1">{applicantDobError}</p>}
                    </div>

                    {/* 癌別 + 期數（同列） */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                癌別 <span className="text-red-500 ml-1">*</span>
                            </label>
                            <input
                                type="text"
                                value={cancerType}
                                onChange={e => { setCancerType(e.target.value); setCancerTypeError(''); }}
                                placeholder="例：肺腺癌"
                                maxLength={100}
                                className={[
                                    'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition',
                                    cancerTypeError
                                        ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                                ].join(' ')}
                            />
                            {cancerTypeError && <p className="text-xs text-red-500 mt-1">{cancerTypeError}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                癌症期數 <span className="text-red-500 ml-1">*</span>
                            </label>
                            <input
                                type="text"
                                value={cancerStage}
                                onChange={e => { setCancerStage(e.target.value); setCancerStageError(''); }}
                                placeholder="例：第三期、IIIA"
                                maxLength={50}
                                className={[
                                    'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition',
                                    cancerStageError
                                        ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                                ].join(' ')}
                            />
                            {cancerStageError && <p className="text-xs text-red-500 mt-1">{cancerStageError}</p>}
                        </div>
                    </div>

                    {/* 申請形式 + 治療階段（兩個 radio group 同列） */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                申請形式 <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="flex gap-3 mt-1">
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
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                治療階段 <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="flex gap-2 mt-1">
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

                    {/* 資格預審資料（婚姻 / 子女 / 收入 / 動產 / 不動產 / 經濟弱勢專屬） */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-700">資格預審資料</h3>
                        <p className="text-xs text-slate-500">
                            請依申請人實際狀況填寫；後續可在「行政初審」階段檢視或調整。
                        </p>
                        <ApplicationForm
                            // key 綁 subsidySubtype：當外層 radio 切換時強制 form 重新 mount，
                            // 同步 econ/midclass 專屬欄位顯示。
                            key={subsidySubtype || 'unset'}
                            initialValues={{
                                ...DEFAULT_QUAL,
                                subsidyType: subsidySubtype || undefined,
                            }}
                            onValidation={handleQualValidation}
                            subtypeMaxAmounts={subtypeMaxAmounts}
                            hideSubsidyType={true}  // 子類型由外層 radio 管
                        />

                        {/* 資格判定按鈕 + 結果（仿外部收件） */}
                        <div className="border-t border-slate-100 pt-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-slate-500">
                                    填寫完成後，點選「執行資格判定」確認是否符合 115 年辦法資格。
                                </p>
                                <button
                                    type="button"
                                    onClick={handleRunEligibilityCheck}
                                    disabled={eligibilityChecking || isSubmitting}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 shrink-0"
                                >
                                    {eligibilityChecking ? '判定中…' : '執行資格判定'}
                                </button>
                            </div>
                            {!eligibilityCheck && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600 flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                                    <span>尚未執行資格判定 — 須通過判定後才能送出申請。</span>
                                </div>
                            )}
                            {eligibilityCheck?.eligible && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium">符合 115 年辦法之申請資格</p>
                                        <p className="text-xs text-emerald-600 mt-0.5">最終仍須由承辦人覆核與文件查驗。</p>
                                    </div>
                                </div>
                            )}
                            {eligibilityCheck && !eligibilityCheck.eligible && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-2">
                                    <div className="flex items-start gap-2">
                                        <XCircle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                                        <p className="font-medium">不符合 115 年辦法之申請資格 — 暫不可送出</p>
                                    </div>
                                    <ul className="list-disc list-inside space-y-1 text-xs ml-1">
                                        {eligibilityCheck.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                    <p className="text-[11px] text-amber-700">請調整上方資料後再次按「執行資格判定」。</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 案件來源 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            案件來源
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="flex items-center gap-4">
                            <label className={`inline-flex items-center gap-2 ${subsidySubtype === '1' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                <input
                                    type="radio"
                                    name="application_way"
                                    value="1"
                                    checked={applicationWay === '1'}
                                    disabled={subsidySubtype === '1'}
                                    onChange={() => { setApplicationWay('1'); setReferralUnitId(null); setReferralError(''); }}
                                    className="w-4 h-4 accent-blue-600"
                                />
                                <span className="text-sm text-slate-700">自提</span>
                                {subsidySubtype === '1' && <span className="text-xs text-slate-400">(經濟弱勢不可選)</span>}
                            </label>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="application_way"
                                    value="2"
                                    checked={applicationWay === '2'}
                                    onChange={() => setApplicationWay('2')}
                                    className="w-4 h-4 accent-blue-600"
                                />
                                <span className="text-sm text-slate-700">轉介</span>
                            </label>
                        </div>

                        {applicationWay === '2' && (
                            <div className="mt-3 space-y-3">
                                <>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        轉介單位 <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={referralUnitId ?? ''}
                                        onChange={e => {
                                            const v = e.target.value || null;
                                            setReferralUnitId(v);
                                            setReferralError('');
                                            // 選了既有單位 → 自動帶入名稱（且鎖死下方輸入框）
                                            if (v && v !== OTHER_UNIT) {
                                                const matched = referralUnits.find(u => u.id === v);
                                                if (matched) {
                                                    setReferralUnitName(matched.name);
                                                    setReferralFieldErrors(prev => ({ ...prev, unit: undefined }));
                                                }
                                            } else if (v === OTHER_UNIT) {
                                                // 切換到「其他」→ 清空讓使用者自填
                                                setReferralUnitName('');
                                            } else {
                                                setReferralUnitName('');
                                            }
                                        }}
                                        className={[
                                            'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition',
                                            referralError
                                                ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                                : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                                        ].join(' ')}
                                    >
                                        <option value="">{referralUnitsLoaded ? '請選擇轉介單位' : '載入中…'}</option>
                                        {referralUnits.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                        <option value={OTHER_UNIT}>其他（不在清單中，提交後將自動新增）</option>
                                    </select>
                                    {referralError && (
                                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                            <XCircle className="w-3 h-3" />
                                            {referralError}
                                        </p>
                                    )}
                                </>

                                {/* #6 轉介單位／承辦人聯絡（必填） */}
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
                                                {referralUnitId && referralUnitId !== OTHER_UNIT && (
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
                                                disabled={!!referralUnitId && referralUnitId !== OTHER_UNIT}
                                                placeholder="例：國泰綜合醫院 社工室"
                                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500 ${referralFieldErrors.unit ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                            />
                                            {referralFieldErrors.unit && (
                                                <p className="text-xs text-red-500 mt-0.5">{referralFieldErrors.unit}</p>
                                            )}
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
                                                    setReferralFieldErrors(p => ({ ...p, name: undefined }));
                                                }}
                                                placeholder="例：王小明"
                                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 ${referralFieldErrors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                            />
                                            {referralFieldErrors.name && (
                                                <p className="text-xs text-red-500 mt-0.5">{referralFieldErrors.name}</p>
                                            )}
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
                                                placeholder="例:社工師／個管師"
                                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 ${referralFieldErrors.title ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                            />
                                            {referralFieldErrors.title && (
                                                <p className="text-xs text-red-500 mt-0.5">{referralFieldErrors.title}</p>
                                            )}
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
                                                placeholder="例:(03) 5278999 #1234"
                                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 ${referralFieldErrors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                            />
                                            {referralFieldErrors.phone && (
                                                <p className="text-xs text-red-500 mt-0.5">{referralFieldErrors.phone}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 申請金額 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            申請金額
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="relative max-w-xs">
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={applyAmount}
                                onChange={e => {
                                    const raw = e.target.value.replace(/\D/g, '');
                                    let v: number | '' = raw === '' ? '' : Number(raw);
                                    // 即時 clamp：超過上限直接修正為上限
                                    if (v !== '' && effectiveApplyCap > 0 && v > effectiveApplyCap) {
                                        v = effectiveApplyCap;
                                    }
                                    setApplyAmount(v);
                                    if (v !== '' && effectiveApplyCap > 0 && Number(v) >= effectiveApplyCap) {
                                        setApplyAmountError(`上限為 NT$${effectiveApplyCap.toLocaleString()} 元`);
                                    } else {
                                        setApplyAmountError('');
                                    }
                                }}
                                placeholder={effectiveApplyCap > 0
                                    ? `上限 ${effectiveApplyCap.toLocaleString()} 元`
                                    : '請先執行申請狀態查詢並選擇補助子類型'}
                                disabled={!queried || !subsidySubtype || effectiveApplyCap <= 0}
                                className={[
                                    'w-full px-3 py-2.5 pr-8 rounded-lg border text-sm focus:outline-none focus:ring-2 transition disabled:bg-slate-100 disabled:cursor-not-allowed',
                                    // 「上限為...」屬於資訊提示而非錯誤，欄位維持灰色；其他訊息才標紅
                                    applyAmountError && !applyAmountError.startsWith('上限為')
                                        ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                                ].join(' ')}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">元</span>
                        </div>
                        {applyAmountError && (
                            applyAmountError.startsWith('上限為') ? (
                                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                    {applyAmountError}
                                </p>
                            ) : (
                                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <XCircle className="w-3 h-3" />
                                    {applyAmountError}
                                </p>
                            )
                        )}
                    </div>

                </div>

                {/* Submit section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-slate-700">確定申請</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {!queried
                                ? '請先執行「申請狀態查詢」後才能提交申請'
                                : eligible
                                    ? '申請人符合資格，可提交申請'
                                    : '申請人不符合申請資格，無法提交'}
                        </p>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={!eligible || isSubmitting}
                        className={[
                            'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm',
                            eligible && !isSubmitting
                                ? 'bg-green-600 hover:bg-green-700 active:scale-95 text-white cursor-pointer'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                        ].join(' ')}
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                                </svg>
                                提交中…
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                確定申請
                            </>
                        )}
                    </button>
                </div>
            </main>

            {/* 聯絡記錄查詢 modal — 與首頁同一個元件，可用身分證查申請人過往聯絡 / 關懷紀錄 */}
            {contactSearchOpen && (
                <ContactSearchModal
                    operatorUserId={userId}
                    onClose={() => setContactSearchOpen(false)}
                />
            )}
        </div>
    );
}
