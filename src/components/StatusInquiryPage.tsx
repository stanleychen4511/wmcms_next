import { useState } from 'react';
import { Search, AlertCircle, CheckCircle2, FileText, ArrowLeft, Loader2, ShieldCheck, DollarSign } from 'lucide-react';
import { checkApplicationStatus, ApplicationStatusResult } from '../app/actions/applicationActions';
import { clsx } from 'clsx';
import { twIdError } from '../lib/validateTwId';

interface StatusInquiryPageProps {
    onBack: () => void;
}

export function StatusInquiryPage({ onBack }: StatusInquiryPageProps) {
    const [name, setName] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [idError, setIdError] = useState('');
    const [result, setResult] = useState<ApplicationStatusResult | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        const err = twIdError(idNumber.trim());
        if (err) { setIdError(err); return; }
        setIdError('');

        setIsLoading(true);
        setResult(null);

        try {
            const res = await checkApplicationStatus(name.trim(), idNumber.trim());
            setResult(res);
        } catch (err) {
            setResult({ found: false, error: '連線失敗或伺服器異常，請重試。' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative font-sans text-slate-800">
            {/* Background Decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-50/60 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="w-full max-w-xl z-10 space-y-6">
                {/* Header Back Button */}
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium mb-2 group"
                >
                    <span className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-200 group-hover:border-blue-200">
                        <ArrowLeft className="w-4 h-4" />
                    </span>
                    返回首頁
                </button>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                    <div className="bg-slate-900 px-8 py-6 text-white text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <ShieldCheck className="w-24 h-24" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight relative z-10 flex items-center justify-center gap-2">
                            <Search className="w-6 h-6 text-blue-400" />
                            申請狀態防呆查詢
                        </h2>
                        <p className="text-slate-400 text-sm mt-2 relative z-10">
                            輸入申請人的身分證字號與姓名進行狀態確認，以避免重複遞案。
                        </p>
                    </div>

                    <div className="p-8">
                        <form onSubmit={handleSearch} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">真實姓名</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="請輸入申請人姓名"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
                                    required
                                    disabled={isLoading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">身分證字號</label>
                                <input
                                    type="text"
                                    value={idNumber}
                                    onChange={(e) => { setIdNumber(e.target.value.toUpperCase()); setIdError(''); }}
                                    placeholder="請輸入完整身分證字號 (包含英文字母)"
                                    className={clsx('w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 uppercase', idError ? 'border-red-400' : 'border-slate-200')}
                                    disabled={isLoading}
                                />
                                {idError && <p className="text-xs text-red-500 mt-1">{idError}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !name.trim() || !idNumber.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>加密查詢中...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>送出查詢</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Result Section */}
                {result && (
                    <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                        {result.error ? (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <h3 className="text-red-800 font-bold text-lg mb-1">發生錯誤</h3>
                                <p className="text-red-600 text-sm">{result.error}</p>
                            </div>
                        ) : !result.found ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col items-center text-center shadow-sm">
                                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <h3 className="text-emerald-800 font-bold text-lg mb-1">查無送件中的申請</h3>
                                <p className="text-emerald-600">
                                    目前資料庫中找不到該身分資料或沒有進行中的案件，
                                    <strong>您可以安心提出新的申請。</strong>
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white border text-center border-slate-200 shadow-xl shadow-slate-200/40 rounded-2xl p-8 relative overflow-hidden">
                                {result.hasActiveApplication ? (
                                    <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
                                ) : (
                                    <div className="absolute top-0 inset-x-0 h-1 bg-green-500" />
                                )}
                                
                                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center justify-center gap-2">
                                    <FileText className="w-6 h-6 text-slate-400" />
                                    查詢結果
                                </h3>

                                <div className="space-y-4 text-left border border-slate-200 rounded-xl p-5 bg-slate-50">
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                                        <span className="text-sm font-bold text-slate-500 uppercase">申請人身分比對</span>
                                        <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 className="w-4 h-4" /> 符合
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-500 uppercase">最新案件狀態</span>
                                        <span className={clsx(
                                            "text-sm font-bold px-3 py-1 rounded-full",
                                            result.hasActiveApplication 
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-slate-200 text-slate-700"
                                        )}>
                                            {result.status || '未知狀態'}
                                        </span>
                                    </div>
                                    
                                    {result.approvedAmount != null && (
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-sm font-bold text-slate-500 uppercase">核准補助金額</span>
                                            <span className="text-lg font-black text-emerald-600 flex items-center gap-0.5">
                                                <DollarSign className="w-5 h-5" />
                                                {result.approvedAmount.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 text-sm">
                                    {result.hasActiveApplication ? (
                                        <p className="text-amber-700 bg-amber-50 py-3 px-4 outline outline-amber-100 opacity-90 rounded-lg font-bold flex items-center justify-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            目前有一筆申請正在進行中，無法重複申請。
                                        </p>
                                    ) : (
                                        <p className="text-emerald-700 bg-emerald-50 py-3 px-4 outline outline-emerald-100 rounded-lg font-bold">
                                            此案已結案或終止，您可以提出新申請。
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
