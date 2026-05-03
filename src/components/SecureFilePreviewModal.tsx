'use client';

/**
 * 安全檔案預覽 modal — 與行政初審階段檔案 preview 同樣機制：
 *   ✓ 浮水印
 *   ✓ 縮放（按鈕 + 滾輪）
 *   ✓ 防右鍵
 *   ✓ 防 Ctrl+P 列印
 *   ✓ 防下載（透過 /api/preview Content-Disposition: inline）
 *
 * 支援格式：PDF / DOCX / DOC / 圖片
 *
 * 用法：
 *   {url && (
 *       <SecureFilePreviewModal
 *           url={url}
 *           label="醫療收據"
 *           onClose={() => setUrl(null)}
 *       />
 *   )}
 */
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FileText, ZoomIn, ZoomOut, XCircle, Loader2 } from 'lucide-react';
import { WatermarkOverlay, usePreviewGuards } from './WatermarkOverlay';
import { SecureImageViewer } from './SecureImageViewer';
import { useModalDismiss } from '../hooks/useModalDismiss';

const PdfViewer = dynamic(
    () => import('./PdfViewer').then(m => m.PdfViewer),
    { ssr: false }
);

// ─── Helpers ──────────────────────────────────────────────────────────────

function getPreviewUrl(fileUrl: string): string {
    return `/api/preview?path=${encodeURIComponent(fileUrl)}`;
}
function isPdfFile(url: string)   { return /\.pdf(\?|$)/i.test(url); }
function isWordFile(url: string)  { return /\.docx?(\?|$)/i.test(url); }
function isImageFile(url: string) { return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url); }

const ZOOM_STEPS = [50, 75, 100, 125, 150, 175, 200];
function clampZoom(z: number) {
    return Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], z));
}
function stepZoom(current: number, delta: number): number {
    if (delta > 0) return ZOOM_STEPS.find(s => s > current) ?? current;
    return [...ZOOM_STEPS].reverse().find(s => s < current) ?? current;
}

// ─── DOCX viewer ──────────────────────────────────────────────────────────

function DocxViewer({ fileUrl, zoom = 100, onZoomChange }: {
    fileUrl: string; zoom?: number; onZoomChange?: (z: number) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const outerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const dragging = useRef(false);
    const last = useRef({ x: 0, y: 0 });

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
                <div ref={containerRef} style={{ userSelect: 'none', width: '100%' }} />
                {!loading && !error && <WatermarkOverlay />}
            </div>
            {loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', gap: '12px', color: '#94a3b8' }}>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">載入文件中…</span>
                </div>
            )}
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

// ─── Main modal ───────────────────────────────────────────────────────────

interface Props {
    url: string;
    label: string;
    onClose: () => void;
}

export function SecureFilePreviewModal({ url, label, onClose }: Props) {
    useModalDismiss(onClose);
    const [zoom, setZoom] = useState(100);

    // 開新檔案時重設縮放
    useEffect(() => { setZoom(100); }, [url]);

    const zoomIn = () => setZoom(z => stepZoom(z, 1));
    const zoomOut = () => setZoom(z => stepZoom(z, -1));
    const handleZoomChange = (z: number) => setZoom(clampZoom(z));

    return (
        <div
            className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
            onClick={onClose}
            onContextMenu={e => e.preventDefault()}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
                style={{ height: '90vh', minHeight: '80vh' }}
                onClick={e => e.stopPropagation()}
                onContextMenu={e => e.preventDefault()}
                onKeyDown={e => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') e.preventDefault();
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0 gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700 text-sm truncate">{label}</span>
                    </div>
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
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                        title="關閉"
                    >
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 bg-slate-100 relative" style={{ overflow: 'hidden', minHeight: 0 }}>
                    {isPdfFile(url) && (
                        <PdfViewer url={getPreviewUrl(url)} zoom={zoom} label={label} onZoomChange={handleZoomChange} />
                    )}
                    {isWordFile(url) && (
                        <DocxViewer fileUrl={url} zoom={zoom} onZoomChange={handleZoomChange} />
                    )}
                    {isImageFile(url) && (
                        <SecureImageViewer
                            url={getPreviewUrl(url)}
                            label={label}
                            zoom={zoom}
                            onZoomChange={handleZoomChange}
                        />
                    )}
                    {!isPdfFile(url) && !isWordFile(url) && !isImageFile(url) && (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                            不支援的檔案格式
                        </div>
                    )}
                </div>

                <div className="px-5 py-2 border-t border-slate-100 shrink-0 bg-slate-50">
                    <p className="text-xs text-slate-400 text-center">此文件僅供線上檢視，不支援下載或另存</p>
                </div>
            </div>
        </div>
    );
}
