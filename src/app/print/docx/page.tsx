'use client';

/**
 * DOCX 列印頁 — 用 docx-preview 把 .docx 渲染成 HTML，可在瀏覽器內列印。
 *
 * 用法：
 *   /print/docx?fileUrl=<url>&autoPrint=1
 *
 * - fileUrl：要列印的 docx 檔案 URL（會經過 /api/preview 代理）
 * - autoPrint=1：載入完成後自動觸發 window.print()
 *
 * 會由 ReimbursementPrintPanel 在使用者選擇「醫療收據（docx）」時呼叫。
 */
import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function getPreviewUrl(fileUrl: string): string {
    if (fileUrl.startsWith('https://')) {
        // Vercel Blob 等公開 URL 直接走代理（避免 CORS）
        return `/api/preview?path=${encodeURIComponent(fileUrl)}`;
    }
    // 相對路徑（本地開發 /uploads/...）走 preview API
    return `/api/preview?path=${encodeURIComponent(fileUrl)}`;
}

export default function DocxPrintPage() {
    return (
        <Suspense fallback={<div className="text-center text-slate-400 py-12">載入中…</div>}>
            <DocxPrintInner />
        </Suspense>
    );
}

function DocxPrintInner() {
    const params = useSearchParams();
    const fileUrl = params.get('fileUrl');
    const autoPrint = params.get('autoPrint') === '1';

    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!fileUrl) {
            setError('缺少 fileUrl 參數');
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const { renderAsync } = await import('docx-preview');
                const res = await fetch(getPreviewUrl(fileUrl));
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                if (cancelled || !containerRef.current) return;
                await renderAsync(blob, containerRef.current, containerRef.current, {
                    className: 'docx-preview',
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    ignoreFonts: false,
                    breakPages: true,
                    useBase64URL: true,
                    renderHeaders: true,
                    renderFooters: true,
                    renderFootnotes: true,
                    renderEndnotes: true,
                });
                if (cancelled) return;
                setLoading(false);

                if (autoPrint) {
                    // 等渲染完整 layout 一個 tick 再呼叫 print
                    setTimeout(() => {
                        try {
                            window.focus();
                            window.print();
                        } catch (e) {
                            console.error('[autoPrint] failed', e);
                        }
                    }, 500);
                }
            } catch (e: any) {
                if (cancelled) return;
                console.error('[DocxPrintPage] render failed', e);
                setError(e?.message ?? '渲染失敗');
                setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [fileUrl, autoPrint]);

    return (
        <main className="mx-auto max-w-[210mm] p-6 bg-white">
            {!autoPrint && (
                <div className="no-print mb-4 flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition cursor-pointer"
                    >
                        列印 / 存為 PDF
                    </button>
                    <button
                        type="button"
                        onClick={() => window.close()}
                        className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition cursor-pointer"
                    >
                        關閉視窗
                    </button>
                </div>
            )}

            {loading && (
                <div className="text-center text-slate-400 py-12">DOCX 渲染中…</div>
            )}
            {error && (
                <div className="text-center text-red-600 py-12">
                    渲染失敗：{error}
                </div>
            )}

            <div ref={containerRef} className="docx-container" />

            <style>{`
                @page { size: A4; margin: 0; }
                @media print {
                    html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
                    main { padding: 1cm !important; max-width: none !important; }
                    .no-print { display: none !important; }
                }
                /* docx-preview 渲染樣式微調 */
                .docx-container :global(.docx-wrapper) {
                    background: white;
                    padding: 0;
                }
                .docx-container :global(section.docx) {
                    box-shadow: none !important;
                    margin: 0 auto !important;
                }
            `}</style>
        </main>
    );
}
