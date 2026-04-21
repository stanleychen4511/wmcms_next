import { useState, useEffect } from 'react';
import { ArrowLeft, FilePlus, Search, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { checkApplicationStatus } from '../app/actions/applicationActions';
import { twIdError } from '../lib/validateTwId';
import { AppHeader } from './AppHeader';

interface NewApplicationPageProps {
    username: string;
    userAccount: string;
    onBack: () => void;
    onGoHome: () => void;
    onLogout: () => void;
    onSubmitSuccess: (newCaseId: string) => void;
}


// ── Toast component ────────────────────────────────────────────────────────────

interface ToastProps {
    message: string;
    type: 'error' | 'warning';
    onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div
            className={[
                'fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex items-start gap-3 px-5 py-4 rounded-xl shadow-xl border text-sm font-medium max-w-full sm:max-w-sm',
                'animate-slide-in-up',
                type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800',
            ].join(' ')}
        >
            {type === 'error' ? (
                <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
            )}
            <span className="flex-1 leading-relaxed">{message}</span>
            <button
                onClick={onClose}
                className="ml-2 text-current opacity-50 hover:opacity-100 transition leading-none text-base"
                aria-label="關閉"
            >
                ✕
            </button>
        </div>
    );
}

// ── Lookup result card ─────────────────────────────────────────────────────────

interface LookupCardProps {
    result: {
        hasRecord: boolean;
        hasActive: boolean;
        totalApprovedAmount: number;
        applicantName?: string;
    };
    eligible: boolean;
    maxApplyAmount: number;
    remaining: number;
}

function LookupCard({ result, eligible, maxApplyAmount, remaining }: LookupCardProps) {
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
                        <p>
                            <span className="text-slate-500">累積核准補助金額：</span>
                            {result.totalApprovedAmount > 0 ? (
                                <span className={`font-semibold ml-1 ${result.totalApprovedAmount >= maxApplyAmount ? 'text-red-600' : 'text-slate-800'}`}>
                                    NT${result.totalApprovedAmount.toLocaleString()}
                                    {result.totalApprovedAmount >= maxApplyAmount && (
                                        <span className="ml-1 text-xs font-normal text-red-500">（已達 35 萬上限）</span>
                                    )}
                                </span>
                            ) : (
                                <span className="font-medium text-slate-500 ml-1">—</span>
                            )}
                        </p>
                        <p>
                            <span className="text-slate-500">尚可申請餘額：</span>
                            <span className={`font-semibold ml-1 ${remaining <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                NT${remaining.toLocaleString()}
                            </span>
                        </p>
                    </>
                ) : (
                    <p className="text-slate-600">
                        查無任何申請紀錄，可受理新申請。
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function NewApplicationPage({
    username,
    userAccount,
    onBack,
    onGoHome,
    onLogout,
    onSubmitSuccess,
}: NewApplicationPageProps) {
    const [name, setName] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [applicationType, setApplicationType] = useState('');
    const [applyAmount, setApplyAmount] = useState<number | ''>('');
    const [applicationWay, setApplicationWay] = useState<'1' | '2'>('1');
    const [referralUnitId, setReferralUnitId] = useState<string | null>(null);
    const [referralUnits, setReferralUnits] = useState<{ id: string; name: string }[]>([]);
    const [referralUnitsLoaded, setReferralUnitsLoaded] = useState(false);
    const [referralError, setReferralError] = useState('');
    const [applyAmountError, setApplyAmountError] = useState('');
    const [appTypeError, setAppTypeError] = useState('');
    const [nameError, setNameError] = useState('');
    const [idError, setIdError] = useState('');
    const [lookupResult, setLookupResult] = useState<{ hasRecord: boolean; hasActive: boolean; totalApprovedAmount: number; applicantName?: string } | null>(null);
    const [eligible, setEligible] = useState(false);
    const [isLoadingQuery, setIsLoadingQuery] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'warning' } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [queried, setQueried] = useState(false);
    const [maxApplyAmount, setMaxApplyAmount] = useState(350000);
    useEffect(() => {
        import('../app/actions/settingsActions').then(m =>
            m.fetchSetting('max_apply_amount', '350000').then(v => setMaxApplyAmount(Number(v) || 350000))
        );
    }, []);

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

    // Validate fields needed for lookup (id + type)
    const validateForLookup = (): boolean => {
        let ok = true;
        const idErr = twIdError(idNumber.trim());
        if (idErr) { setIdError(idErr); ok = false; } else { setIdError(''); }
        if (!applicationType) { setAppTypeError('請選擇申請類別'); ok = false; } else { setAppTypeError(''); }
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
        const amtNum = applyAmount === '' ? 0 : Number(applyAmount);
        if (amtNum <= 0) {
            setApplyAmountError('請輸入申請金額');
            ok = false;
        } else if (amtNum > maxApplyAmount) {
            setApplyAmountError(`申請金額不可超過 ${maxApplyAmount.toLocaleString()} 元`);
            ok = false;
        } else {
            setApplyAmountError('');
        }
        if (applicationWay === '2') {
            if (!referralUnitId) { setReferralError('請選擇轉介單位'); ok = false; }
            else { setReferralError(''); }
        } else {
            setReferralError('');
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
                setToast({ message: apiRes.error, type: 'error' });
                setEligible(false);
                setIsLoadingQuery(false);
                return;
            }

            const mappedResult = {
                hasRecord: apiRes.found,
                hasActive: !!apiRes.hasActiveApplication,
                totalApprovedAmount: apiRes.totalApprovedAmount || 0,
                applicantName: apiRes.found ? name.trim() : undefined,
            };

            setLookupResult(mappedResult);
            setQueried(true);

            // Determine eligibility
            if (mappedResult.hasActive) {
                setEligible(false);
                setToast({
                    message: '該申請人目前已有進行中的申請案件，無法重複申請，請待現有案件結案後再行申請。',
                    type: 'error',
                });
            } else if (mappedResult.totalApprovedAmount >= maxApplyAmount) {
                setEligible(false);
                setToast({
                    message: `該申請人累積核准補助金額（NT$${mappedResult.totalApprovedAmount.toLocaleString()}）已達補助上限 NT$${maxApplyAmount.toLocaleString()} 元，無法再申請。`,
                    type: 'warning',
                });
            } else {
                setEligible(true);
            }
        } catch (err) {
            setToast({ message: '連線錯誤，請稍後重試。', type: 'error' });
        } finally {
            setIsLoadingQuery(false);
        }
    };

    const handleSubmit = async () => {
        if (!eligible || !validateForSubmit()) return;
        setIsSubmitting(true);
        try {
            const { createNewApplication } = await import('../app/actions/applicationActions');
            const res = await createNewApplication(
                name.trim(),
                idNumber.trim(),
                userAccount,
                applicationType,
                applyAmount === '' ? null : Number(applyAmount),
                applicationWay,
                applicationWay === '2' ? referralUnitId : null,
            );
            if (res.success && res.caseId) {
                onSubmitSuccess(res.caseId);
            } else {
                setToast({ message: res.error || '建立案件失敗', type: 'error' });
            }
        } catch (err) {
            setToast({ message: '系統錯誤', type: 'error' });
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
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FilePlus className="w-6 h-6 text-green-600" />
                        新增申請案件
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        填寫身分證字號與申請類別後可先查詢申請資格；姓名與金額於確認資格後填寫即可。
                    </p>
                </div>

                {/* Form card */}
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

                    {/* 案件來源 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            案件來源
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="flex items-center gap-4">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="application_way"
                                    value="1"
                                    checked={applicationWay === '1'}
                                    onChange={() => { setApplicationWay('1'); setReferralUnitId(null); setReferralError(''); }}
                                    className="w-4 h-4 accent-blue-600"
                                />
                                <span className="text-sm text-slate-700">自提</span>
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
                            <div className="mt-3">
                                {referralUnitsLoaded && referralUnits.length === 0 ? (
                                    <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                        請先至後台建立轉介單位（管理員 → 轉介單位管理）
                                    </div>
                                ) : (
                                    <>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">轉介單位</label>
                                        <select
                                            value={referralUnitId ?? ''}
                                            onChange={e => { setReferralUnitId(e.target.value || null); setReferralError(''); }}
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
                                        </select>
                                        {referralError && (
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                <XCircle className="w-3 h-3" />
                                                {referralError}
                                            </p>
                                        )}
                                    </>
                                )}
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
                                    const v = raw === '' ? '' : Number(raw);
                                    setApplyAmount(v as number | '');
                                    if (v !== '' && Number(v) > maxApplyAmount) {
                                        setApplyAmountError(`申請金額不可超過 ${maxApplyAmount.toLocaleString()} 元`);
                                    } else {
                                        setApplyAmountError('');
                                    }
                                }}
                                placeholder={`上限 ${maxApplyAmount.toLocaleString()} 元`}
                                className={[
                                    'w-full px-3 py-2.5 pr-8 rounded-lg border text-sm focus:outline-none focus:ring-2 transition',
                                    applyAmountError
                                        ? 'border-red-400 focus:ring-red-200 bg-red-50'
                                        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400',
                                ].join(' ')}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">元</span>
                        </div>
                        {applyAmountError && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {applyAmountError}
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

                {/* Lookup result */}
                {queried && lookupResult !== null && (
                    <LookupCard result={lookupResult} eligible={eligible} maxApplyAmount={maxApplyAmount} remaining={maxApplyAmount - lookupResult.totalApprovedAmount} />
                )}

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

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Inline style for toast animation */}
            <style>{`
                @keyframes slideInUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-in-up {
                    animation: slideInUp 0.25s ease-out both;
                }
            `}</style>
        </div>
    );
}
