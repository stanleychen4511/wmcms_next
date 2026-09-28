'use client';

/**
 * 安全圖片預覽 — 支援滑鼠拖曳 + 按鈕縮放 + 浮水印 + 防右鍵 / 防下載。
 *
 * 用法：
 *   <SecureImageViewer
 *       url="/api/preview?path=..."
 *       label="身分證影本"
 *       zoom={zoom}
 *   />
 *
 * 與 PdfViewer / DocxViewer 一致的拖曳 UX：
 *   - 滑鼠左鍵按住拖移 → 改變容器 scrollLeft / scrollTop
 *   - 滾輪 → 捲動（縮放只透過工具列 +/- 按鈕，避免捲頁時誤觸縮放）
 */
import { useEffect, useRef } from 'react';
import { WatermarkOverlay } from './WatermarkOverlay';

interface Props {
    url: string;
    label: string;
    zoom: number;
}

export function SecureImageViewer({ url, label, zoom }: Props) {
    const outerRef = useRef<HTMLDivElement>(null);
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

    return (
        <div
            ref={outerRef}
            onContextMenu={e => e.preventDefault()}
            onMouseDown={e => {
                if (e.button !== 0) return;
                dragging.current = true;
                last.current = { x: e.clientX, y: e.clientY };
                document.body.style.cursor = 'grabbing';
                e.preventDefault();
            }}
            className="w-full h-full overflow-auto select-none"
            style={{ cursor: 'grab', background: '#e5e7eb' }}
        >
            <div
                className="flex items-start justify-center p-4"
                style={{ minWidth: '100%', minHeight: '100%' }}
            >
                <div
                    className="relative inline-block"
                    style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={url}
                        alt={label}
                        draggable={false}
                        style={{ maxWidth: '100%', display: 'block', pointerEvents: 'none' }}
                    />
                    <WatermarkOverlay />
                </div>
            </div>
        </div>
    );
}
