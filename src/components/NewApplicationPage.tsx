import { useState, useEffect } from 'react';
import { ArrowLeft, FilePlus, Search, CheckCircle, XCircle, UserCircle, LogOut, AlertTriangle } from 'lucide-react';
import { addNewApplication } from '../store/appStore';
import { checkApplicationStatus } from '../app/actions/applicationActions';

interface NewApplicationPageProps {
    username: string;
    userAccount: string;
    onBack: () => void;
    onGoHome: () => void;
    onLogout: () => void;
    onSubmitSuccess: (newCaseId: string) => void;
}

// Taiwan national ID validation: 1 letter + 9 digits
function validateIdNumber(id: string): boolean {
    return /^[A-Za-z]\d{9}$/.test(id);
}

const AMOUNT_LIMIT = 350_000;

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
}

function LookupCard({ result, eligible }: LookupCardProps) {
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
                                <span className={`font-semibold ml-1 ${result.totalApprovedAmount >= AMOUNT_LIMIT ? 'text-red-600' : 'text-slate-800'}`}>
                                    NT${result.totalApprovedAmount.toLocaleString()}
                                    {result.totalApprovedAmount >= AMOUNT_LIMIT && (
                                        <span className="ml-1 text-xs font-normal text-red-500">（已達 35 萬上限）</span>
                                    )}
                                </span>
                            ) : (
                                <span className="font-medium text-slate-500 ml-1">—</span>
                            )}
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
    const [nameError, setNameError] = useState('');
    const [idError, setIdError] = useState('');
    const [lookupResult, setLookupResult] = useState<{ hasRecord: boolean; hasActive: boolean; totalApprovedAmount: number; applicantName?: string } | null>(null);
    const [eligible, setEligible] = useState(false);
    const [isLoadingQuery, setIsLoadingQuery] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'warning' } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [queried, setQueried] = useState(false);

    // Reset query result whenever form fields change
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

    const validate = (): boolean => {
        let ok = true;
        if (!name.trim()) {
            setNameError('請輸入申請人姓名');
            ok = false;
        } else {
            setNameError('');
        }
        if (!idNumber.trim()) {
            setIdError('請輸入身分證字號');
            ok = false;
        } else if (!validateIdNumber(idNumber.trim())) {
            setIdError('身分證字號格式有誤（須為 1 英文字母 + 9 位數字）');
            ok = false;
        } else {
            setIdError('');
        }
        return ok;
    };

    const handleLookup = async () => {
        if (!validate()) return;
        setIsLoadingQuery(true);
        setQueried(false);
        setLookupResult(null);

        try {
            const apiRes = await checkApplicationStatus(name.trim(), idNumber.trim());
            
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
            } else if (mappedResult.totalApprovedAmount >= AMOUNT_LIMIT) {
                setEligible(false);
                setToast({
                    message: `該申請人累積核准補助金額（NT$${mappedResult.totalApprovedAmount.toLocaleString()}）已達補助上限 35 萬元，無法再申請。`,
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
        if (!eligible) return;
        setIsSubmitting(true);
        try {
            const { createNewApplication } = await import('../app/actions/applicationActions');
            const res = await createNewApplication(name.trim(), idNumber.trim(), userAccount);
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
            <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0">W</div>
                        <h1
                            className="text-lg sm:text-xl font-bold tracking-tight cursor-pointer hover:text-blue-300 transition-colors truncate"
                            onClick={onGoHome}
                            title="返回首頁"
                        >
                            萬美基金會補助管理系統
                        </h1>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className="flex items-center gap-2 bg-slate-800 text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-700">
                            <UserCircle className="w-4 h-4 text-slate-400" />
                            <span className="text-xs sm:text-sm font-medium truncate max-w-[80px] sm:max-w-none">{username}</span>
                        </div>
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-red-400 transition px-1 sm:px-2 py-1.5"
                            title="登出"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">登出</span>
                        </button>
                    </div>
                </div>
            </header>

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
                        請填寫申請人基本資料，並點選「申請狀態查詢」確認資格後再送出申請。
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
                    <LookupCard result={lookupResult} eligible={eligible} />
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
