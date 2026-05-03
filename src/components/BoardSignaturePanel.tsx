'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FileSignature, Check, AlertTriangle, Clock, Eraser } from 'lucide-react';
import { clsx } from 'clsx';
import SignatureCanvas from 'react-signature-canvas';
import {
    BoardReviewSignatureStatus,
    fetchBoardReviewSignatures,
    submitBoardSignature,
} from '../app/actions/boardSignatureActions';
import { ModalEscapeListener } from '../hooks/useModalDismiss';

interface Props {
    applicationId: string;
    currentUserId: string;
    /** Parent can pass a nonce to force re-fetch (e.g. after save / reassign). */
    refreshKey?: number;
    /** Notify parent that signature status changed (for enabling advance button). */
    onChange?: (status: BoardReviewSignatureStatus) => void;
}

export function BoardSignaturePanel({ applicationId, currentUserId, refreshKey, onChange }: Props) {
    const [status, setStatus] = useState<BoardReviewSignatureStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const sigRef = useRef<SignatureCanvas>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await fetchBoardReviewSignatures(applicationId);
        if (res.success && res.data) {
            setStatus(res.data);
            setError(null);
            onChange?.(res.data);
        } else {
            setError(res.error ?? '載入簽章狀態失敗');
        }
        setLoading(false);
    }, [applicationId, onChange]);

    useEffect(() => { void load(); }, [load, refreshKey]);

    function openModal() {
        setPassword('');
        setSubmitError(null);
        setShowModal(true);
        // Clear canvas after modal mounts
        setTimeout(() => sigRef.current?.clear(), 50);
    }

    async function handleSubmit() {
        if (!sigRef.current || sigRef.current.isEmpty()) {
            setSubmitError('請先在畫布上簽名');
            return;
        }
        if (!password.trim()) {
            setSubmitError('請輸入登入密碼');
            return;
        }
        const dataUrl = sigRef.current.toDataURL('image/png');
        setSubmitting(true);
        setSubmitError(null);
        const res = await submitBoardSignature(
            applicationId,
            dataUrl,
            password,
            currentUserId,
            typeof window !== 'undefined' ? { userAgent: navigator.userAgent } : undefined,
        );
        setSubmitting(false);
        if (!res.success) {
            setSubmitError(res.error ?? '簽章失敗');
            return;
        }
        setShowModal(false);
        await load();
    }

    if (loading) return <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-400">載入簽章狀態…</div>;
    if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>;
    if (!status || status.memberCount === 0) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>尚未派組或派組無成員，暫無法蒐集簽章。</span>
            </div>
        );
    }

    const myRow = status.members.find(m => m.signerUserId === String(currentUserId));
    const allSigned = status.memberCount === status.signedCount;

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <FileSignature className="w-4 h-4 text-purple-600" />
                    董事審核簽章
                </h3>
                <span className={clsx(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    allSigned
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                )}>
                    {status.signedCount} / {status.memberCount} 人已簽
                </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {status.members.map(m => {
                    const isMe = m.signerUserId === String(currentUserId);
                    return (
                        <div key={m.signerUserId} className="flex items-center gap-3 px-3 py-2 text-sm">
                            <span className="flex-1">
                                <span className="font-medium text-slate-800">{m.name}</span>
                                <span className="ml-1.5 text-xs text-slate-400">@{m.account}</span>
                                {isMe && <span className="ml-2 text-xs text-blue-600">（您）</span>}
                            </span>
                            {m.status === 'signed' && (
                                <>
                                    {m.signedAt && (
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(m.signedAt).toLocaleString('zh-TW')}
                                        </span>
                                    )}
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                                        <Check className="w-3 h-3" />已簽
                                    </span>
                                </>
                            )}
                            {m.status === 'invalid' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium" title="內容已變動，原簽章失效">
                                    <AlertTriangle className="w-3 h-3" />已失效
                                </span>
                            )}
                            {m.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs">
                                    未簽
                                </span>
                            )}
                            {isMe && m.status !== 'signed' && (
                                <button
                                    type="button"
                                    onClick={openModal}
                                    className="px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 transition cursor-pointer"
                                >
                                    {m.status === 'invalid' ? '重新簽章' : '簽章'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <p className="text-[11px] text-slate-400">
                依《電子簽章法》第 9 條「當事人同意採用」之效力；簽章時需重新輸入登入密碼確認本人意思表示，簽章綁定當下案件內容，內容變更即作廢需重簽。
            </p>

            {/* Signature Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setShowModal(false)}
                >
                    <ModalEscapeListener onClose={() => setShowModal(false)} />
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start gap-2">
                            <FileSignature className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">請簽名並輸入密碼</h3>
                                <p className="text-xs text-slate-500 mt-1">簽章將綁定當前案件內容；若日後內容有變動，此簽章將自動作廢並需重簽。</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">簽名 <span className="text-red-500">*</span></label>
                            <div className="border border-slate-300 rounded-lg bg-white relative">
                                <SignatureCanvas
                                    ref={sigRef}
                                    penColor="black"
                                    canvasProps={{
                                        width: 400,
                                        height: 200,
                                        className: 'rounded-lg',
                                        style: { touchAction: 'none' },
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => sigRef.current?.clear()}
                                    className="absolute top-1 right-1 p-1 text-slate-400 hover:text-slate-600 transition"
                                    title="清除重畫"
                                >
                                    <Eraser className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">建議使用觸控螢幕或手寫筆以獲得較佳筆跡</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">登入密碼 <span className="text-red-500">*</span></label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="請輸入您的登入密碼"
                                autoComplete="off"
                            />
                        </div>

                        {submitError && (
                            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{submitError}</span>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                disabled={submitting}
                                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="px-4 py-2 text-sm bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50 cursor-pointer"
                            >
                                {submitting ? '送出中…' : '確認簽章'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
