"use client";
import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { WatermarkOverlay, usePreviewGuards } from './WatermarkOverlay';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const ZOOM_STEPS = [50, 75, 100, 125, 150, 175, 200];

function stepZoom(current: number, delta: number): number {
    if (delta > 0) return ZOOM_STEPS.find(s => s > current) ?? current;
    return [...ZOOM_STEPS].reverse().find(s => s < current) ?? current;
}

interface PdfViewerProps {
    url: string;
    zoom: number;
    label: string;
    onZoomChange: (z: number) => void;
}

export function PdfViewer({ url, zoom, label, onZoomChange }: PdfViewerProps) {
    const outerRef = useRef<HTMLDivElement>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const dragging = useRef(false);
    const last = useRef({ x: 0, y: 0 });

    usePreviewGuards();

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

    if (pdfError) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#9ca3af', fontSize: 14 }}>
            <span style={{ fontSize: 24 }}>📄</span>
            <span style={{ color: '#6b7280', fontWeight: 600 }}>無法載入 PDF</span>
            <span style={{ maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>{pdfError}</span>
        </div>
    );

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
                onZoomChange(stepZoom(zoom, -e.deltaY));
            }}
            style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'auto', cursor: 'grab', background: '#e5e7eb' }}
        >
            <Document
                file={url}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                onLoadError={err => setPdfError(err.message)}
                loading={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: '#94a3b8' }}>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">載入 PDF 中…</span>
                    </div>
                }
            >
                {Array.from({ length: numPages }, (_, i) => (
                    <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                        <Page
                            pageNumber={i + 1}
                            scale={scale}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                        />
                        <WatermarkOverlay />
                    </div>
                ))}
            </Document>
        </div>
    );
}
