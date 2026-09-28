'use client';

/**
 * 信件內文格式工具列 + 預覽（WMCMS-12）。
 *
 * 搭配一般 <textarea> 使用：按鈕會把選取文字包上 **粗體**／++底線++，或在行首加「- 」成為清單。
 * 預覽使用與寄信相同的 renderEmailHtml（escape-first），所見即所寄。
 */
import { useState, type RefObject } from 'react';
import { Bold, Eye, EyeOff, List, Underline } from 'lucide-react';
import { renderEmailHtml } from '../lib/emailMarkdown';

interface Props {
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    value: string;
    onChange: (next: string) => void;
    /** 是否顯示「預覽」切換（預設 true） */
    showPreviewToggle?: boolean;
}

export function EmailFormatToolbar({ textareaRef, value, onChange, showPreviewToggle = true }: Props) {
    const [showPreview, setShowPreview] = useState(false);

    const restoreSelection = (start: number, end: number) => {
        requestAnimationFrame(() => {
            const ta = textareaRef.current;
            if (!ta) return;
            ta.focus();
            ta.setSelectionRange(start, end);
        });
    };

    const wrap = (marker: string, placeholder: string) => {
        const ta = textareaRef.current;
        const start = ta?.selectionStart ?? value.length;
        const end = ta?.selectionEnd ?? value.length;
        const selected = value.slice(start, end) || placeholder;
        const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
        onChange(next);
        restoreSelection(start + marker.length, start + marker.length + selected.length);
    };

    const toggleList = () => {
        const ta = textareaRef.current;
        const start = ta?.selectionStart ?? value.length;
        const end = ta?.selectionEnd ?? value.length;
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineEndIdx = value.indexOf('\n', end);
        const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
        const block = value.slice(lineStart, lineEnd);
        const lines = block.split('\n');
        const allListed = lines.every(l => /^\s*-\s/.test(l) || l.trim() === '');
        const nextBlock = lines
            .map(l => (l.trim() === '' ? l : allListed ? l.replace(/^(\s*)-\s/, '$1') : `- ${l}`))
            .join('\n');
        onChange(value.slice(0, lineStart) + nextBlock + value.slice(lineEnd));
        restoreSelection(lineStart, lineStart + nextBlock.length);
    };

    const btn = 'inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700';

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className={btn} onClick={() => wrap('**', '粗體文字')} title="粗體：**文字**">
                    <Bold className="w-3.5 h-3.5" />粗體
                </button>
                <button type="button" className={btn} onClick={() => wrap('++', '底線文字')} title="底線：++文字++">
                    <Underline className="w-3.5 h-3.5" />底線
                </button>
                <button type="button" className={btn} onClick={toggleList} title="項目清單：行首「- 」">
                    <List className="w-3.5 h-3.5" />清單
                </button>
                {showPreviewToggle && (
                    <button type="button" className={`${btn} ml-auto`} onClick={() => setShowPreview(v => !v)}>
                        {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showPreview ? '隱藏預覽' : '預覽'}
                    </button>
                )}
                <span className="text-[11px] text-slate-400 w-full">
                    語法：**粗體**、++底線++、行首「- 」為清單；網址會自動變成連結。LINE 通知會自動去除這些符號。
                </span>
            </div>
            {showPreviewToggle && showPreview && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-[11px] text-slate-400 mb-1">信件預覽（佔位符會在寄出時代入）</div>
                    {/* renderEmailHtml 先整段 escape 再套白名單標記，可安全插入 */}
                    <div
                        className="text-sm text-slate-800 [&_a]:text-blue-600 [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: renderEmailHtml(value) }}
                    />
                </div>
            )}
        </div>
    );
}
