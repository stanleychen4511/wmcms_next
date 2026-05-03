'use client';

/**
 * 結構化資訊檢視 Modal
 *
 * 用於顯示「非檔案類」的唯讀資料（家訪紀錄、董事審核意見等）。
 * 不像 SecureFilePreviewModal 那樣對檔案做浮水印 + 防下載，這是純文字資料。
 *
 * 使用方式：
 *   <InfoSheetModal
 *     title="家訪紀錄"
 *     sections={[
 *       { label: '訪視日期', value: '2026-04-15' },
 *       { label: '訪視員', value: '王小明' },
 *       ...
 *     ]}
 *     images={photoUrls}      // 選用：底部圖片 grid
 *     onClose={() => ...}
 *   />
 */

import { X } from 'lucide-react';
import { useModalDismiss } from '../hooks/useModalDismiss';

export interface InfoSection {
    label: string;
    value: string | null | undefined;
    /** 設 true 時 value 會用 whitespace-pre-wrap 保留換行（用在長文字） */
    multiline?: boolean;
}

interface Props {
    title: string;
    sections: InfoSection[];
    /** 選用：底部圖片陣列（家訪照片之類） */
    images?: string[];
    /** 選用：頂部主要資訊（顯示為大字、突出） */
    headline?: string;
    onClose: () => void;
}

export function InfoSheetModal({ title, sections, images, headline, onClose }: Props) {
    useModalDismiss(onClose);
    const visibleSections = sections.filter(s => s.value && String(s.value).trim() !== '');

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded transition"
                        aria-label="關閉"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {headline && (
                        <p className="text-base font-semibold text-emerald-700 mb-3 pb-3 border-b border-slate-100">
                            {headline}
                        </p>
                    )}

                    {visibleSections.length === 0 && !images?.length && (
                        <p className="text-sm text-slate-400 text-center py-6">（沒有資料）</p>
                    )}

                    {visibleSections.length > 0 && (
                        <dl className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
                            {visibleSections.map((s, i) => (
                                <div key={i} className="contents">
                                    <dt className="font-medium text-slate-600 md:text-right">{s.label}</dt>
                                    <dd className={`text-slate-800 ${s.multiline ? 'whitespace-pre-wrap' : ''}`}>
                                        {s.value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    )}

                    {images && images.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-slate-100">
                            <p className="text-sm font-medium text-slate-600 mb-2">家訪照片（{images.length}）：</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {images.map((url, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        key={i}
                                        src={url}
                                        alt={`家訪照片 ${i + 1}`}
                                        className="w-full h-32 object-cover rounded border border-slate-200"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
                    >
                        關閉
                    </button>
                </div>
            </div>
        </div>
    );
}
