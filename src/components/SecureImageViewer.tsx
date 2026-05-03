'use client';

/**
 * 安全圖片預覽 — 支援滑鼠拖曳 + 滾輪縮放 + 浮水印 + 防右鍵 / 防下載。
 *
 * 用法：
 *   <SecureImageViewer
 *       url="/api/preview?path=..."
 *       label="身分證影本"
 *       zoom={zoom}
 *       onZoomChange={handleZoomChange}
 *   />
 *
 * 與 PdfViewer / DocxViewer 一致的拖曳 + 滾輪 UX：
 *   - 滑鼠左鍵按住拖移 → 改變容器 scrollLeft / scrollTop
 *   - 滾輪 → 縮放（不會傳到背景頁面）
 */
import { useEffect, useRef } from 'react';
import { WatermarkOverlay } from './WatermarkOverlay';

const ZOOM_STEPS = [50, 75, 100, 125, 150, 175, 200];
function stepZoom(current: number, delta: number): number {
    if (delta > 0) return ZOOM_STEPS.find(s => s > current) ?? current;
    return [...ZOOM_STEPS].reverse().find(s => s < current) ?? current;
}

interface Props {
    url: string;
    label: string;
    zoom: number;
    onZoomChange: (z: number) => void;
}

export function SecureImageViewer({ url, label, zoom, onZoomChange }: Props) {
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
            onWheel={e => {
                e.preventDefault();
                onZoomChange(stepZoom(zoom, -e.deltaY));
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
