"use client";
import { useEffect } from 'react';

const TEXT = '僅供萬美基金會申請補助使用';

function buildWatermarkDataUrl(): string {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180">
  <text
    x="150" y="90"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="'Microsoft JhengHei', 'PingFang TC', sans-serif"
    font-size="15"
    font-weight="bold"
    fill="rgba(120,120,120,0.18)"
    transform="rotate(-30, 150, 90)"
    letter-spacing="2"
  >${TEXT}</text>
</svg>`.trim();
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

export const WATERMARK_BG = buildWatermarkDataUrl();

/**
 * Mounts global guards: blocks Ctrl+P / Cmd+P (print) and right-click inside the preview.
 * Call once per preview session.
 */
export function usePreviewGuards() {
    useEffect(() => {
        const blockPrint = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        const blockContext = (e: MouseEvent) => e.preventDefault();

        window.addEventListener('keydown', blockPrint, true);
        window.addEventListener('contextmenu', blockContext, true);
        return () => {
            window.removeEventListener('keydown', blockPrint, true);
            window.removeEventListener('contextmenu', blockContext, true);
        };
    }, []);
}

/**
 * Transparent overlay that tiles a diagonal watermark over the visible area.
 * Use for PDF pages where each page is a fixed-size element.
 */
export function WatermarkOverlay() {
    return (
        <>
            {/* Screen watermark */}
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 10,
                    backgroundImage: WATERMARK_BG,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '300px 180px',
                }}
            />
            {/* Print blocker — hides everything when printing */}
            <style>{`@media print { body { display: none !important; } }`}</style>
        </>
    );
}
