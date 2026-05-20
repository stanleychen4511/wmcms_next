'use client';

/**
 * 共用圖片預覽 lightbox — 點黑底或 X 關閉；左右鍵或左右按鈕切換。
 *
 * 抽離自 InfoSheetModal / HomeVisitForm，讓其他需要圖片放大檢視的地方共用
 *（例如關懷紀錄的媒體連結）。
 */

import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
    images: string[];
    index: number;
    onChange: (next: number) => void;
    onClose: () => void;
}

export function ImageLightbox({ images, index, onChange, onClose }: Props) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') onChange((index - 1 + images.length) % images.length);
            else if (e.key === 'ArrowRight') onChange((index + 1) % images.length);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [index, images.length, onChange, onClose]);

    if (!images[index]) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
                title="關閉（ESC）"
            >
                <X className="w-6 h-6" />
            </button>
            {images.length > 1 && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onChange((index - 1 + images.length) % images.length); }}
                    className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
                    title="上一張（←）"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
            )}
            {images.length > 1 && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onChange((index + 1) % images.length); }}
                    className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
                    title="下一張（→）"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={images[index]}
                alt={`照片 ${index + 1}`}
                className="max-w-full max-h-full object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
            {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/10 rounded-full text-white text-sm">
                    {index + 1} / {images.length}
                </div>
            )}
        </div>
    );
}

/**
 * 判斷 URL 是否「看起來像」可直接 <img> 嵌入的圖片。
 *
 * Google Photos / Imgur 等分享連結通常不是直接的圖片 URL，無法 hot-link；
 * 這裡以副檔名判斷直接嵌入的可行性，其餘讓呼叫者降級為純連結。
 */
export function looksLikeImageUrl(url: string): boolean {
    if (!url) return false;
    try {
        const u = new URL(url);
        const path = u.pathname.toLowerCase();
        return /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/.test(path);
    } catch {
        return false;
    }
}
