'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, FileText, Tag, Search, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { clsx } from 'clsx';
import { TemplateFile, fetchActiveTemplateFiles } from '../app/actions/templateActions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extBadgeColor(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'bg-red-100 text-red-700';
    if (mimeType.includes('word')) return 'bg-blue-100 text-blue-700';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'bg-green-100 text-green-700';
    if (mimeType.startsWith('image/')) return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-600';
}

function extLabel(originalName: string): string {
    return originalName.split('.').pop()?.toUpperCase() ?? '';
}

/** Trigger downloads one-by-one with a delay to avoid browser blocking */
async function downloadSequentially(ids: number[], userId: string) {
    for (let i = 0; i < ids.length; i++) {
        const url = `/api/template-download/${ids[i]}?userId=${encodeURIComponent(userId)}`;
        const a = document.createElement('a');
        a.href = url;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (i < ids.length - 1) {
            await new Promise(r => setTimeout(r, 600));
        }
    }
}

// ─── Indeterminate Checkbox ───────────────────────────────────────────────────

interface TriCheckboxProps {
    checked: boolean;
    indeterminate: boolean;
    onChange: () => void;
    label: string;
    className?: string;
}

function TriCheckbox({ checked, indeterminate, onChange, label, className }: TriCheckboxProps) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={clsx('flex items-center gap-1.5 text-sm font-medium select-none', className)}
        >
            {indeterminate ? (
                <span className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-500 flex items-center justify-center shrink-0">
                    <span className="block w-2 h-0.5 bg-white rounded" />
                </span>
            ) : checked ? (
                <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
            ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            {label}
        </button>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface TemplateDownloadPageProps {
    userId: string;
    onBack: () => void;
}

export function TemplateDownloadPage({ userId, onBack }: TemplateDownloadPageProps) {
    const [files, setFiles] = useState<TemplateFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [downloading, setDownloading] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        const res = await fetchActiveTemplateFiles();
        if (res.success && res.data) setFiles(res.data);
        else setError('載入範本檔案失敗，請重試。');
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Filter
    const filtered = useMemo(() =>
        searchTerm.trim()
            ? files.filter(f =>
                f.display_name.includes(searchTerm) ||
                (f.description ?? '').includes(searchTerm) ||
                (f.category ?? '').includes(searchTerm)
            )
            : files,
        [files, searchTerm]
    );

    // Group by category
    const grouped = useMemo(() =>
        filtered.reduce<Record<string, TemplateFile[]>>((acc, f) => {
            const key = f.category ?? '未分類';
            if (!acc[key]) acc[key] = [];
            acc[key].push(f);
            return acc;
        }, {}),
        [filtered]
    );

    const groupKeys = Object.keys(grouped);
    const allFilteredIds = filtered.map(f => f.id);

    // Selection helpers
    const toggleItem = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleCategory = (catName: string) => {
        const catIds = grouped[catName].map(f => f.id);
        const allSelected = catIds.every(id => selected.has(id));
        setSelected(prev => {
            const next = new Set(prev);
            if (allSelected) catIds.forEach(id => next.delete(id));
            else catIds.forEach(id => next.add(id));
            return next;
        });
    };

    const toggleAll = () => {
        const allSelected = allFilteredIds.every(id => selected.has(id));
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(allFilteredIds));
    };

    const globalAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
    const globalSomeSelected = allFilteredIds.some(id => selected.has(id)) && !globalAllSelected;

    const catState = (catName: string) => {
        const catIds = grouped[catName].map(f => f.id);
        const checkedCount = catIds.filter(id => selected.has(id)).length;
        return {
            allSelected: checkedCount === catIds.length,
            someSelected: checkedCount > 0 && checkedCount < catIds.length,
        };
    };

    const handleDownloadSelected = async () => {
        if (selected.size === 0) return;
        setDownloading(true);
        await downloadSequentially(Array.from(selected), userId);
        setDownloading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0">W</div>
                        <h1
                            className="text-lg sm:text-xl font-bold tracking-tight truncate cursor-pointer hover:text-blue-300 transition-colors"
                            onClick={onBack}
                            title="返回首頁"
                        >萬美基金會補助管理系統</h1>
                    </div>
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
                {/* Page title + search */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="w-6 h-6 text-blue-600" />
                            表單下載
                        </h2>
                        <p className="text-sm text-slate-500 mt-0.5">申請補助流程中所需的表單與文件範本</p>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="搜尋範本名稱或說明…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                    </div>
                )}

                {/* Action bar — shown once files are loaded */}
                {!loading && groupKeys.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                        {/* Global select all */}
                        <TriCheckbox
                            checked={globalAllSelected}
                            indeterminate={globalSomeSelected}
                            onChange={toggleAll}
                            label="全部全選"
                            className="text-slate-700"
                        />
                        <div className="hidden sm:block w-px h-4 bg-slate-200" />
                        {/* Count */}
                        <span className="text-sm text-slate-500">
                            已選 <span className="font-semibold text-slate-800">{selected.size}</span> 個檔案
                            {selected.size > 0 && (
                                <span className="text-slate-400">
                                    {' '}（共 {formatBytes(filtered.filter(f => selected.has(f.id)).reduce((s, f) => s + f.file_size, 0))}）
                                </span>
                            )}
                        </span>
                        {/* Download button */}
                        <button
                            onClick={handleDownloadSelected}
                            disabled={selected.size === 0 || downloading}
                            className={clsx(
                                'sm:ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition',
                                selected.size === 0
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                            )}
                        >
                            <Download className="w-4 h-4" />
                            {downloading ? '下載中…' : `下載已選項目（${selected.size}）`}
                        </button>
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <p className="text-center text-sm text-slate-400 py-20">載入中…</p>
                ) : groupKeys.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 space-y-2">
                        <FileText className="w-10 h-10 mx-auto text-slate-300" />
                        <p className="text-sm">{searchTerm ? '找不到符合的範本' : '目前尚無可下載的範本'}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupKeys.map(catName => {
                            const { allSelected: catAll, someSelected: catSome } = catState(catName);
                            return (
                                <div key={catName}>
                                    {/* Category header with select-all */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                                        <TriCheckbox
                                            checked={catAll}
                                            indeterminate={catSome}
                                            onChange={() => toggleCategory(catName)}
                                            label={catName}
                                            className="text-slate-600 font-bold uppercase tracking-wide text-sm"
                                        />
                                        <div className="flex-1 h-px bg-slate-200" />
                                        <span className="text-xs text-slate-400 shrink-0">
                                            {grouped[catName].filter(f => selected.has(f.id)).length}/{grouped[catName].length}
                                        </span>
                                    </div>

                                    {/* Cards grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {grouped[catName].map(file => {
                                            const isChecked = selected.has(file.id);
                                            return (
                                                <div
                                                    key={file.id}
                                                    onClick={() => toggleItem(file.id)}
                                                    className={clsx(
                                                        'bg-white border rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all select-none',
                                                        isChecked
                                                            ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm'
                                                            : 'border-slate-200 hover:shadow-md hover:border-blue-200'
                                                    )}
                                                >
                                                    {/* File info */}
                                                    <div className="flex items-start gap-3">
                                                        {/* Checkbox */}
                                                        <div className="mt-0.5 shrink-0">
                                                            {isChecked
                                                                ? <CheckSquare className="w-4 h-4 text-blue-600" />
                                                                : <Square className="w-4 h-4 text-slate-300" />}
                                                        </div>
                                                        <div className={clsx(
                                                            'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                                                            extBadgeColor(file.mime_type)
                                                        )}>
                                                            {extLabel(file.original_name)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-slate-800 leading-snug">{file.display_name}</p>
                                                            {file.description && (
                                                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{file.description}</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Footer: size */}
                                                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                                                        <span className="text-xs text-slate-400">{formatBytes(file.file_size)}</span>
                                                        <span className={clsx(
                                                            'text-xs font-medium px-2 py-0.5 rounded-full transition',
                                                            isChecked ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                                                        )}>
                                                            {isChecked ? '已選取' : '點擊選取'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
