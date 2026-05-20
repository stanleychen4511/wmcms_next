"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, XCircle, Upload, FileText, AlertCircle, Loader2, Eye, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import dynamic from 'next/dynamic';
import { WatermarkOverlay, WATERMARK_BG, usePreviewGuards } from './WatermarkOverlay';
import { SecureImageViewer } from './SecureImageViewer';

const PdfViewer = dynamic(
    () => import('./PdfViewer').then(m => m.PdfViewer),
    { ssr: false, loading: () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#94a3b8' }}>
            <span className="text-sm">載入 PDF 中…</span>
        </div>
    )}
);
import { DocumentEntry, linkApplicationDocumentByUrl, updateDocumentStatus, fetchApplicationDocuments } from '../app/actions/documentActions';
import { uploadFileToBlob } from '../lib/uploadClient';
import { writeAuditLog } from '../app/actions/auditActions';
import { ModalEscapeListener } from '../hooks/useModalDismiss';

function getPreviewUrl(fileUrl: string): string {
    return `/api/preview?path=${encodeURIComponent(fileUrl)}`;
}

function isWordFile(url: string) {
    return /\.(docx?)$/i.test(url);
}

function isPdfFile(url: string) {
    return /\.pdf$/i.test(url);
}

const ZOOM_STEPS = [50, 75, 100, 125, 150, 175, 200];

function clampZoom(z: number) {
    return Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], z));
}

function stepZoom(current: number, delta: number): number {
    // delta > 0 = zoom in, delta < 0 = zoom out
    if (delta > 0) return ZOOM_STEPS.find(s => s > current) ?? current;
    return [...ZOOM_STEPS].reverse().find(s => s < current) ?? current;
}



/** Renders a .docx file into a container div using docx-preview (client-side only) */
function DocxViewer({ fileUrl, zoom = 100, onZoomChange }: {
    fileUrl: string; zoom?: number; onZoomChange?: (z: number) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const outerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const dragging = useRef(false);
    const last = useRef({ x: 0, y: 0 });

    // Drag-to-scroll
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!dragging.current || !outerRef.current) return;
            outerRef.current.scrollLeft -= e.clientX - last.current.x;
            outerRef.current.scrollTop  -= e.clientY - last.current.y;
            last.current = { x: e.clientX, y: e.clientY };
        };
        const onMouseUp = () => {
            dragging.current = false;
            document.body.style.cursor = '';
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        async function render() {
            try {
                setLoading(true);
                setError(null);
                // Dynamically import to avoid SSR issues
                const { renderAsync } = await import('docx-preview');
                const res = await fetch(getPreviewUrl(fileUrl));
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                if (cancelled || !containerRef.current) return;
                await renderAsync(blob, containerRef.current, containerRef.current, {
                    className: 'docx-preview',
                    inWrapper: true,
                    ignoreWidth: true,
                    ignoreHeight: false,
                    ignoreFonts: false,
                    breakPages: true,
                    useBase64URL: true,
                    renderHeaders: true,
                    renderFooters: true,
                    renderFootnotes: true,
                    renderEndnotes: true,
                });
            } catch (e: any) {
                if (!cancelled) {
                    const msg: string = e.message ?? '';
                    setError(
                        msg.includes('data length = 0') || msg.includes('Corrupted zip')
                            ? '文件中無內容'
                            : msg || '無法渲染文件'
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        render();
        return () => { cancelled = true; };
    }, [fileUrl]);

    usePreviewGuards();

    const scale = zoom / 100;

    return (
        <div
            ref={outerRef}
            onMouseDown={e => {
                if (e.button !== 0) return;
                dragging.current = true;
                last.current = { x: e.clientX, y: e.clientY };
                document.body.style.cursor = 'grabbing';
                e.preventDefault();
            }}
            onWheel={e => {
                e.preventDefault();
                onZoomChange?.(stepZoom(zoom, -e.deltaY));
            }}
            style={{
                position: 'relative', width: '100%', height: '100%', minHeight: '200px',
                overflowY: 'auto', overflowX: 'auto', background: '#e5e7eb',
                cursor: 'grab',
            }}
        >
            {/* Scaled inner wrapper */}
            <div
                style={{
                    position: 'relative',
                    transformOrigin: 'top center',
                    transform: `scale(${scale})`,
                    width: scale < 1 ? `${100 / scale}%` : '100%',
                    minHeight: '100%',
                    padding: '16px',
                    boxSizing: 'border-box',
                }}
                onContextMenu={e => e.preventDefault()}
            >
                <div
                    ref={containerRef}
                    style={{ userSelect: 'none', width: '100%' }}
                />
                {/* Watermark inside the scaled div — grows with content, covers all pages */}
                {!loading && !error && <WatermarkOverlay />}
            </div>
            {/* Loading overlay */}
            {loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', gap: '12px', color: '#94a3b8' }}>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">載入文件中…</span>
                </div>
            )}
            {/* Error overlay */}
            {error && !loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: '40px', textAlign: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '24px' }}>📄</span>
                    <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: 600 }}>無法顯示文件</span>
                    <span style={{ color: '#9ca3af', fontSize: '13px', maxWidth: '320px', lineHeight: 1.6 }}>{error}</span>
                </div>
            )}
        </div>
    );
}

interface ReviewListProps {
    applicationId: string;
    caseNumber: string;
    /** Legacy read-only flag — kept for non-document-related uses; does NOT affect upload or review. */
    readOnly?: boolean;
    /** When true, hides upload AND review buttons. Set only when case is fully closed ('2'/'4'). */
    caseClosed?: boolean;
    /** When true, shows 符合/未符合/重置 review actions. Should encode role permission + case-not-closed. */
    canReview?: boolean;
    onRefresh?: () => void;
    /** Filter docs by phase. Omit to show all. */
    phase?: string;
    /** Current logged-in user ID for audit logging */
    userId?: string | null;
    /** 申請日期（ISO string），用於判斷是否逾期需補件 */
    applyAt?: string;
    /** 未補件提示門檻天數（來自 system_settings） */
    pendingThresholdDays?: number;
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


function isImageFile(url: string) {
    return /\.(jpe?g|png|gif|webp)$/i.test(url);
}

export function ReviewList({ applicationId, caseNumber, readOnly = false, caseClosed = false, canReview = false, onRefresh, phase, userId, applyAt, pendingThresholdDays = 7 }: ReviewListProps) {
    // 判斷申請日是否已過門檻天數（逾期補件判斷基準）
    const isOverduePastThreshold = (() => {
        if (!applyAt) return false;
        const applyMs = new Date(applyAt).getTime();
        if (isNaN(applyMs)) return false;
        const daysSince = (Date.now() - applyMs) / (1000 * 60 * 60 * 24);
        return daysSince >= pendingThresholdDays;
    })();
    const [docs, setDocs] = useState<DocumentEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<Record<string, boolean>>({});
    const [updating, setUpdating] = useState<Record<string, boolean>>({});
    const [rejectModal, setRejectModal] = useState<{ docId: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
    const [zoom, setZoom] = useState(100);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

    const zoomIn  = () => setZoom(z => stepZoom(z, 1));
    const zoomOut = () => setZoom(z => stepZoom(z, -1));
    const handleZoomChange = (z: number) => setZoom(clampZoom(z));

    // Reset zoom when a new file is opened
    useEffect(() => { if (preview) setZoom(100); }, [preview?.url]);

    // 註：ESC 關閉 + 鎖背景捲動已由 preview modal 內的 useModalDismiss(onClose) 統一接管，
    //     此處不再重複實作。早期重複實作會踩到 prev value 污染：
    //     modal mount 時把 body.overflow='' 改成 'hidden'，這個 effect 此時才執行
    //     就會把 'hidden' 當成 prev 記下；modal 關閉時 modal 還原 ''，這個 effect 接著
    //     把 'hidden' 寫回 → 主畫面 scrollbar 消失。

    const loadDocs = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const result = await fetchApplicationDocuments(applicationId);
            setDocs(result);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [applicationId]);

    useEffect(() => { loadDocs(false); }, [loadDocs]);

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
            const docLabel = docs.find(d => d.id === activeUploadId)?.label ?? activeUploadId;
            // 1. Browser 直接上傳到 Vercel Blob（避開 Vercel function 4.5 MB payload 上限）
            const uploaded = await uploadFileToBlob(file, {
                pathPrefix: `uploads/${applicationId}`,
            });
            // 2. Server 收到 URL → scope/role 守門 → 寫 application_documents
            await linkApplicationDocumentByUrl(
                applicationId,
                activeUploadId,
                docLabel,
                uploaded.url,
                uploaded.originalName,
                uploaded.mimeType,
            );
            void caseNumber; // caseNumber 已不需要傳給 server（檔名由 client 上傳路徑決定）
            await loadDocs(true);
            onRefresh?.();
        } catch (err) {
            console.error('upload failed', err);
        } finally {
            setUploading(prev => ({ ...prev, [activeUploadId]: false }));
            setActiveUploadId(null);
        }
    };

    const handleStatusChange = async (docId: string, status: DocumentEntry['status'], reason?: string) => {
        setUpdating(prev => ({ ...prev, [docId]: true }));
        try {
            await updateDocumentStatus(applicationId, docId, status, reason);
            await loadDocs(true);
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

    // Filter by phase if specified
    const visibleDocs = phase ? docs.filter(d => d.phase === phase) : docs;

    // Status '1' = 符合 (approved)
    const approvedCount = visibleDocs.filter(d => d.status === '1').length;

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
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
                            {visibleDocs.filter(d => d.isRequired && d.status === '1').length} / {visibleDocs.filter(d => d.isRequired).length} 份必備文件已通過
                        </p>
                    </div>
                    <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{
                                width: `${visibleDocs.filter(d => d.isRequired).length ?
                                    (visibleDocs.filter(d => d.isRequired && d.status === '1').length / visibleDocs.filter(d => d.isRequired).length) * 100 : 0}%`
                            }}
                        />
                    </div>
                </div>

                <ul className="divide-y divide-gray-100">
                    {visibleDocs.map((doc) => {
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
                                        {doc.isRequired && doc.allowSupplement && doc.status !== '1' && (
                                            <span
                                                className="ml-2 text-[10px] font-normal text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                                                title="此文件為必備，但允許延後補件 — 可先進入家訪階段，於送董事審核前補齊即可"
                                            >
                                                可延後補件
                                            </span>
                                        )}
                                    </p>
                                    {doc.storageLocationPath && (
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            📍 {doc.storageLocationPath}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <StatusBadge status={doc.status} />
                                        {/* 逾期補件警示：已過門檻天數、必備文件、且尚未通過審核 */}
                                        {isOverduePastThreshold && doc.isRequired && doc.status !== '1' && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full" title={`申請已超過 ${pendingThresholdDays} 天`}>
                                                <AlertCircle className="w-3 h-3" />
                                                逾期補件
                                            </span>
                                        )}
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
                                        onClick={() => {
                                            setPreview({ url: doc.fileUrl!, label: doc.label });
                                            void writeAuditLog({
                                                userId: userId ?? null,
                                                action: 'document.preview',
                                                targetType: 'document',
                                                targetId: doc.id,
                                                detail: { applicationId, documentLabel: doc.label },
                                            });
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                        title="預覽檔案"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                )}

                                {busy ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-slate-400 shrink-0" />
                                ) : (
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* ── Upload / re-upload: available as long as case is not closed ── */}
                                        {!caseClosed && (
                                            <>
                                                {(doc.status === '0' || doc.status === '2') && (
                                                    <button
                                                        onClick={() => handleUploadClick(doc.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                                    >
                                                        <Upload className="w-3.5 h-3.5" />
                                                        上傳
                                                    </button>
                                                )}
                                                {doc.status === '1' && (
                                                    <button
                                                        onClick={() => handleUploadClick(doc.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
                                                        title="重新上傳此文件"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                        重新上傳
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* ── Review actions: role permission + case not closed, independent of step view ── */}
                                        {canReview && (
                                            <>
                                                {doc.status === '0' && doc.fileUrl && (
                                                    <>
                                                        <button
                                                            onClick={() => handleStatusChange(doc.id, '1')}
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
                                                {doc.status === '1' && (
                                                    <button
                                                        onClick={() => handleStatusChange(doc.id, '0')}
                                                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                                                    >
                                                        重置
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* File preview modal — no download allowed */}
            {preview && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                    onClick={() => setPreview(null)}
                    onContextMenu={e => e.preventDefault()}
                >
                    <ModalEscapeListener onClose={() => setPreview(null)} />
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
                        style={{ height: '90vh', minHeight: '80vh' }}
                        onClick={e => e.stopPropagation()}
                        onContextMenu={e => e.preventDefault()}
                        onKeyDown={e => {
                            // Block Ctrl+S / Cmd+S
                            if ((e.ctrlKey || e.metaKey) && e.key === 's') e.preventDefault();
                        }}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0 gap-4">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-700 text-sm truncate">{preview.label}</span>
                            </div>
                            {/* Zoom controls */}
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={zoomOut}
                                    disabled={zoom <= ZOOM_STEPS[0]}
                                    className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
                                    title="縮小"
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setZoom(100)}
                                    className="px-2.5 py-1 text-xs font-mono font-medium text-slate-600 hover:bg-slate-100 rounded-md transition min-w-[52px] text-center"
                                    title="重設為 100%"
                                >
                                    {zoom}%
                                </button>
                                <button
                                    onClick={zoomIn}
                                    disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                                    className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
                                    title="放大"
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </button>
                            </div>
                            <button
                                onClick={() => setPreview(null)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                                title="關閉"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal content — flex-1 fills remaining height, overflow-hidden lets children manage their own scroll */}
                        <div className="flex-1 bg-slate-100 relative" style={{ overflow: 'hidden', minHeight: 0 }}>
                            {isPdfFile(preview.url) && (
                                <PdfViewer url={getPreviewUrl(preview.url)} zoom={zoom} label={preview.label} onZoomChange={handleZoomChange} />
                            )}
                            {isWordFile(preview.url) && (
                                <DocxViewer fileUrl={preview.url} zoom={zoom} onZoomChange={handleZoomChange} />
                            )}
                            {isImageFile(preview.url) && (
                                <SecureImageViewer
                                    url={getPreviewUrl(preview.url)}
                                    label={preview.label}
                                    zoom={zoom}
                                    onZoomChange={handleZoomChange}
                                />
                            )}
                        </div>

                        <div className="px-5 py-2 border-t border-slate-100 shrink-0 bg-slate-50">
                            <p className="text-xs text-slate-400 text-center">此文件僅供線上檢視，不支援下載或另存</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject reason modal */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setRejectModal(null)}
                >
                    <ModalEscapeListener onClose={() => setRejectModal(null)} />
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
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
