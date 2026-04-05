"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, XCircle, Upload, FileText, AlertCircle, Loader2, Eye, RotateCcw, ExternalLink } from 'lucide-react';
import { DocumentEntry, uploadApplicationDocument, updateDocumentStatus, fetchApplicationDocuments } from '../app/actions/documentActions';

interface ReviewListProps {
    applicationId: string;
    caseNumber: string;
    readOnly?: boolean;
    onRefresh?: () => void;
}

function StatusBadge({ status }: { status: DocumentEntry['status'] }) {
    const map: Record<string, { label: string; className: string }> = {
        '0': { label: '待審核',     className: 'bg-amber-100 text-amber-700' },
        '1': { label: '符合 ✓',    className: 'bg-green-100 text-green-700' },
        '2': { label: '逾期/未符合', className: 'bg-red-100   text-red-700' },
    };
    const { label, className } = map[status] ?? map['0'];
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>{label}</span>;
}

function StatusIcon({ status }: { status: DocumentEntry['status'] }) {
    switch (status) {
        case '1': return <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />;
        case '2': return <XCircle    className="w-5 h-5 text-red-500   shrink-0" />;
        default:  return <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />;
    }
}

function isImageUrl(url: string) {
    return /\.(jpg|jpeg|png)$/i.test(url);
}

export function ReviewList({ applicationId, caseNumber, readOnly = false, onRefresh }: ReviewListProps) {
    const [docs, setDocs] = useState<DocumentEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<Record<string, boolean>>({});
    const [updating, setUpdating] = useState<Record<string, boolean>>({});
    const [rejectModal, setRejectModal] = useState<{ docId: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

    const loadDocs = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchApplicationDocuments(applicationId);
            setDocs(result);
        } finally {
            setLoading(false);
        }
    }, [applicationId]);

    useEffect(() => { loadDocs(); }, [loadDocs]);

    const handleUploadClick = (docId: string) => {
        setActiveUploadId(docId);
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeUploadId) return;
        e.target.value = '';

        setUploading(prev => ({ ...prev, [activeUploadId]: true }));
        try {
            const fd = new FormData();
            fd.append('file', file);
            // Pass doc label and case number so the server can generate the correct filename
            const docLabel = docs.find(d => d.id === activeUploadId)?.label ?? activeUploadId;
            await uploadApplicationDocument(applicationId, activeUploadId, docLabel, caseNumber, fd);
            await loadDocs();
            onRefresh?.();
        } finally {
            setUploading(prev => ({ ...prev, [activeUploadId]: false }));
            setActiveUploadId(null);
        }
    };

    const handleStatusChange = async (docId: string, status: DocumentEntry['status'], reason?: string) => {
        setUpdating(prev => ({ ...prev, [docId]: true }));
        try {
            await updateDocumentStatus(applicationId, docId, status, reason);
            await loadDocs();
            onRefresh?.();
        } finally {
            setUpdating(prev => ({ ...prev, [docId]: false }));
        }
    };

    const handleRejectConfirm = async () => {
        if (!rejectModal) return;
        await handleStatusChange(rejectModal.docId, '2', rejectReason); // '2' = 逾期/未符合
        setRejectModal(null);
        setRejectReason('');
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>載入文件清單中…</span>
            </div>
        );
    }

    // Status '1' = 符合 (approved)
    const approvedCount = docs.filter(d => d.status === '1').length;

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelected}
            />

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            應備文件檢核表
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {docs.filter(d => d.isRequired && d.status === '1').length} / {docs.filter(d => d.isRequired).length} 份必備文件已通過
                        </p>
                    </div>
                    <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ 
                                width: `${docs.filter(d => d.isRequired).length ? 
                                    (docs.filter(d => d.isRequired && d.status === '1').length / docs.filter(d => d.isRequired).length) * 100 : 0}%` 
                            }}
                        />
                    </div>
                </div>

                <ul className="divide-y divide-gray-100">
                    {docs.map((doc) => {
                        const isUploading = uploading[doc.id];
                        const isUpdating = updating[doc.id];
                        const busy = isUploading || isUpdating;
                        return (
                            <li key={doc.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                                <StatusIcon status={doc.status} />

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                        {doc.label}
                                        {!doc.isRequired && (
                                            <span className="ml-2 text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">非必填</span>
                                        )}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <StatusBadge status={doc.status} />
                                        {doc.uploadedAt && (
                                            <span className="text-xs text-gray-400">
                                                {new Date(doc.uploadedAt).toLocaleDateString('zh-TW')}
                                            </span>
                                        )}
                                        {doc.rejectReason && (
                                            <span className="text-xs text-red-500 italic">退件原因：{doc.rejectReason}</span>
                                        )}
                                    </div>
                                </div>

                                {/* File preview button */}
                                {doc.fileUrl && (
                                    <button
                                        onClick={() => setPreview({ url: doc.fileUrl!, label: doc.label })}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                        title="預覽檔案"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                )}

                                {busy ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-slate-400 shrink-0" />
                                ) : !readOnly && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Upload button: status '0' = 待上傳/未符合, '2' = 逾期可重新上傳 */}
                                        {(doc.status === '0' || doc.status === '2') && (
                                            <button
                                                onClick={() => handleUploadClick(doc.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                            >
                                                <Upload className="w-3.5 h-3.5" />
                                                上傳
                                            </button>
                                        )}

                                        {/* Re-upload for already conforming docs */}
                                        {doc.status === '1' && (
                                            <button
                                                onClick={() => handleUploadClick(doc.id)}
                                                className="p-1.5 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                title="重新上傳"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                        )}

                                        {/* Review actions: status '0' = 待審核 (檔案已上傳且有 fileUrl) */}
                                        {doc.status === '0' && doc.fileUrl && (
                                            <>
                                                <button
                                                    onClick={() => handleStatusChange(doc.id, '1')} // '1' = 符合
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition"
                                                >
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    符合
                                                </button>
                                                <button
                                                    onClick={() => setRejectModal({ docId: doc.id })}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    未符合
                                                </button>
                                            </>
                                        )}

                                        {/* Reset '1' = 符合 back to '0' = 待上傳 */}
                                        {doc.status === '1' && (
                                            <button
                                                onClick={() => handleStatusChange(doc.id, '0')}
                                                className="text-xs text-gray-400 hover:text-gray-600 underline"
                                            >
                                                重置
                                            </button>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* File preview modal */}
            {preview && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                    onClick={() => setPreview(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
                        style={{ maxHeight: '90vh' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                            <span className="font-semibold text-slate-700 text-sm truncate">{preview.label}</span>
                            <div className="flex items-center gap-1 ml-4 shrink-0">
                                <a
                                    href={preview.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    title="在新分頁開啟"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <button
                                    onClick={() => setPreview(null)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                    title="關閉"
                                >
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal content */}
                        <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center min-h-[60vh]">
                            {isImageUrl(preview.url) ? (
                                <img
                                    src={preview.url}
                                    alt={preview.label}
                                    className="max-w-full max-h-full object-contain p-4"
                                />
                            ) : (
                                <iframe
                                    src={preview.url}
                                    title={preview.label}
                                    className="w-full border-0"
                                    style={{ height: '75vh' }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reject reason modal */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
                        <h4 className="font-bold text-slate-800 mb-3 text-lg">填寫退件原因</h4>
                        <textarea
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 h-28 resize-none"
                            placeholder="請說明退件理由（例如：文件模糊、資料不符等）"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition"
                            >
                                取消
                            </button>
                            <button
                                disabled={!rejectReason.trim()}
                                onClick={handleRejectConfirm}
                                className="px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
                            >
                                確認退回
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
