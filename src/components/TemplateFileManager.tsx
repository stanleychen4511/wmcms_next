'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, ToggleLeft, ToggleRight, Upload, X, AlertTriangle, FileText, Tag } from 'lucide-react';
import { clsx } from 'clsx';
import {
    TemplateCategory,
    TemplateFile,
    fetchAllCategories,
    fetchAllTemplateFiles,
    addCategory,
    updateCategory,
    toggleCategoryStatus,
    uploadTemplateFile,
    updateTemplateFile,
    disableTemplateFile,
    enableTemplateFile,
} from '../app/actions/templateActions';

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
    const ext = originalName.split('.').pop()?.toUpperCase() ?? '';
    return ext;
}

// ─── Category Modal ───────────────────────────────────────────────────────────

interface CategoryModalProps {
    mode: 'add' | 'edit';
    cat?: TemplateCategory;
    userId: string;
    onClose: () => void;
    onSaved: () => void;
}

function CategoryModal({ mode, cat, userId, onClose, onSaved }: CategoryModalProps) {
    const [name, setName] = useState(cat?.name ?? '');
    const [sortOrder, setSortOrder] = useState(cat?.sort_order ?? 1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!name.trim()) { setError('請輸入分類名稱'); return; }
        setSaving(true); setError('');
        const res = mode === 'add'
            ? await addCategory(name, sortOrder, userId)
            : await updateCategory(cat!.id, name, sortOrder, userId);
        setSaving(false);
        if (res.success) { onSaved(); onClose(); }
        else setError(res.error ?? '操作失敗');
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h3 className="text-base font-bold text-slate-800">{mode === 'add' ? '新增分類' : '編輯分類'}</h3>
                    <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
                </div>
                <div className="px-6 py-4 space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">分類名稱 <span className="text-red-500">*</span></label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={name} onChange={e => setName(e.target.value)} maxLength={100} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">排序</label>
                        <input type="number" min={1}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
                    </div>
                    {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-slate-100 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">取消</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                        {saving ? '儲存中…' : '儲存'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Template File Modal ──────────────────────────────────────────────────────

interface TemplateModalProps {
    mode: 'add' | 'edit';
    file?: TemplateFile;
    categories: TemplateCategory[];
    userId: string;
    onClose: () => void;
    onSaved: () => void;
}

function TemplateModal({ mode, file, categories, userId, onClose, onSaved }: TemplateModalProps) {
    const [displayName, setDisplayName] = useState(file?.display_name ?? '');
    const [description, setDescription] = useState(file?.description ?? '');
    const [categoryId, setCategoryId] = useState<number | null>(file?.category_id ?? null);
    const [sortOrder, setSortOrder] = useState(file?.sort_order ?? 1);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!displayName.trim()) { setError('請輸入顯示名稱'); return; }
        if (mode === 'add' && !selectedFile) { setError('請選擇上傳檔案'); return; }
        setSaving(true); setError('');
        try {
            let res;
            if (mode === 'add') {
                const fd = new FormData();
                fd.append('file', selectedFile!);
                fd.append('display_name', displayName);
                fd.append('description', description);
                if (categoryId != null) fd.append('category_id', String(categoryId));
                fd.append('sort_order', String(sortOrder));
                res = await uploadTemplateFile(fd, userId);
            } else {
                res = await updateTemplateFile(file!.id, displayName, description || null, categoryId, sortOrder, userId);
            }
            if (res.success) { onSaved(); onClose(); }
            else setError(res.error ?? '操作失敗');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h3 className="text-base font-bold text-slate-800">{mode === 'add' ? '上傳範本檔案' : '編輯範本資訊'}</h3>
                    <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {/* File picker (add only) */}
                    {mode === 'add' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">檔案 <span className="text-red-500">*</span></label>
                            <label className={clsx(
                                'flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition',
                                selectedFile ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                            )}>
                                <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="text-sm text-slate-600 truncate">
                                    {selectedFile ? selectedFile.name : '點擊選擇檔案（PDF、Word、Excel、圖片）'}
                                </span>
                                <input type="file" className="hidden"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                    onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
                            </label>
                            {selectedFile && (
                                <p className="text-xs text-slate-400 mt-1">{formatBytes(selectedFile.size)}</p>
                            )}
                        </div>
                    )}

                    {/* Display name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">顯示名稱 <span className="text-red-500">*</span></label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={255} />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">分類</label>
                        <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={categoryId ?? ''}
                            onChange={e => setCategoryId(e.target.value === '' ? null : Number(e.target.value))}>
                            <option value="">（未分類）</option>
                            {categories.filter(c => c.status === 1).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Sort order */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">排序</label>
                        <input type="number" min={1}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">說明</label>
                        <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="選填" />
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-slate-100 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">取消</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                        {saving ? '處理中…' : mode === 'add' ? '上傳' : '儲存'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface TemplateFileManagerProps {
    userId: string;
}

export function TemplateFileManager({ userId }: TemplateFileManagerProps) {
    const [categories, setCategories] = useState<TemplateCategory[]>([]);
    const [files, setFiles] = useState<TemplateFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'files' | 'categories'>('files');

    const [fileModal, setFileModal] = useState<{ mode: 'add' | 'edit'; file?: TemplateFile } | null>(null);
    const [catModal, setCatModal] = useState<{ mode: 'add' | 'edit'; cat?: TemplateCategory } | null>(null);
    const [actionError, setActionError] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        const [catRes, fileRes] = await Promise.all([
            fetchAllCategories(),
            fetchAllTemplateFiles(),
        ]);
        if (catRes.success && catRes.data) setCategories(catRes.data);
        if (fileRes.success && fileRes.data) setFiles(fileRes.data);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleToggleFile = async (file: TemplateFile) => {
        setActionError('');
        const res = file.status === 1
            ? await disableTemplateFile(file.id, file.display_name, userId)
            : await enableTemplateFile(file.id, file.display_name, userId);
        if (!res.success) setActionError(res.error ?? '操作失敗');
        else await loadData();
    };

    const handleToggleCat = async (cat: TemplateCategory) => {
        setActionError('');
        const res = await toggleCategoryStatus(cat.id, cat.status === 1 ? 0 : 1, userId);
        if (!res.success) setActionError(res.error ?? '操作失敗');
        else await loadData();
    };

    // Group files by category name (null → 未分類)
    const grouped = files.reduce<Record<string, TemplateFile[]>>((acc, f) => {
        const key = f.category ?? '未分類';
        if (!acc[key]) acc[key] = [];
        acc[key].push(f);
        return acc;
    }, {});

    return (
        <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">範本檔案管理</h2>
                    <p className="text-xs text-slate-500 mt-0.5">管理流程中使用的範本檔案，供使用者下載</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Section toggle */}
                    <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-slate-50">
                        <button onClick={() => setActiveSection('files')}
                            className={clsx('px-3 py-1.5 text-xs rounded-md font-medium transition',
                                activeSection === 'files' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
                            <FileText className="w-3.5 h-3.5 inline mr-1" />範本檔案
                        </button>
                        <button onClick={() => setActiveSection('categories')}
                            className={clsx('px-3 py-1.5 text-xs rounded-md font-medium transition',
                                activeSection === 'categories' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
                            <Tag className="w-3.5 h-3.5 inline mr-1" />分類管理
                        </button>
                    </div>
                    {activeSection === 'files' ? (
                        <button onClick={() => setFileModal({ mode: 'add' })}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm">
                            <Upload className="w-4 h-4" />上傳範本
                        </button>
                    ) : (
                        <button onClick={() => setCatModal({ mode: 'add' })}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm">
                            <Plus className="w-4 h-4" />新增分類
                        </button>
                    )}
                </div>
            </div>

            {/* Action error */}
            {actionError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{actionError}</span>
                    <button onClick={() => setActionError('')} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* ── Files section ── */}
            {activeSection === 'files' && (
                <div className="space-y-4">
                    {loading ? (
                        <p className="text-center text-sm text-slate-400 py-12">載入中…</p>
                    ) : Object.keys(grouped).length === 0 ? (
                        <p className="text-center text-sm text-slate-400 py-12">尚無範本檔案，請點擊「上傳範本」開始建立。</p>
                    ) : Object.entries(grouped).map(([catName, catFiles]) => (
                        <div key={catName} className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                                <Tag className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-sm font-semibold text-slate-600">{catName}</span>
                                <span className="text-xs text-slate-400">（{catFiles.length} 個）</span>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-white border-b border-slate-100">
                                    <tr>
                                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500">顯示名稱</th>
                                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500">原始檔名</th>
                                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500">大小</th>
                                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500">排序</th>
                                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500">上傳者</th>
                                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500">狀態</th>
                                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500">編輯</th>
                                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500">啟/停用</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {catFiles.map(f => (
                                        <tr key={f.id} className={clsx(
                                            'border-b border-slate-100 hover:bg-slate-50 transition-colors',
                                            f.status === 0 && 'opacity-50'
                                        )}>
                                            <td className="py-3 px-4 text-sm font-medium text-slate-800">{f.display_name}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded', extBadgeColor(f.mime_type))}>
                                                        {extLabel(f.original_name)}
                                                    </span>
                                                    <span className="text-xs text-slate-500 truncate max-w-[140px]">{f.original_name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-xs text-slate-500">{formatBytes(f.file_size)}</td>
                                            <td className="py-3 px-4 text-xs text-slate-500">{f.sort_order}</td>
                                            <td className="py-3 px-4 text-xs text-slate-500">{f.uploader_account ?? '—'}</td>
                                            <td className="py-3 px-4">
                                                <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                                    f.status === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                                                    {f.status === 1 ? '啟用' : '停用'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <button onClick={() => setFileModal({ mode: 'edit', file: f })}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            </td>
                                            <td className="py-3 px-4">
                                                <button onClick={() => handleToggleFile(f)}
                                                    className={clsx('p-1.5 rounded-lg transition',
                                                        f.status === 1
                                                            ? 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                                                            : 'text-slate-400 hover:bg-green-50 hover:text-green-600')}>
                                                    {f.status === 1 ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Categories section ── */}
            {activeSection === 'categories' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500">分類名稱</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500">排序</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500">狀態</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500">編輯</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500">啟/停用</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="py-12 text-center text-sm text-slate-400">載入中…</td></tr>
                            ) : categories.length === 0 ? (
                                <tr><td colSpan={5} className="py-12 text-center text-sm text-slate-400">尚無分類，請點擊「新增分類」。</td></tr>
                            ) : categories.map(cat => (
                                <tr key={cat.id} className={clsx(
                                    'border-b border-slate-100 hover:bg-slate-50 transition-colors',
                                    cat.status === 0 && 'opacity-50'
                                )}>
                                    <td className="py-3 px-4 text-sm font-medium text-slate-800">{cat.name}</td>
                                    <td className="py-3 px-4 text-xs text-slate-500">{cat.sort_order}</td>
                                    <td className="py-3 px-4">
                                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                            cat.status === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                                            {cat.status === 1 ? '啟用' : '停用'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <button onClick={() => setCatModal({ mode: 'edit', cat })}
                                            className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </td>
                                    <td className="py-3 px-4">
                                        <button onClick={() => handleToggleCat(cat)}
                                            className={clsx('p-1.5 rounded-lg transition',
                                                cat.status === 1
                                                    ? 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                                                    : 'text-slate-400 hover:bg-green-50 hover:text-green-600')}>
                                            {cat.status === 1 ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            {fileModal && (
                <TemplateModal
                    mode={fileModal.mode}
                    file={fileModal.file}
                    categories={categories}
                    userId={userId}
                    onClose={() => setFileModal(null)}
                    onSaved={loadData}
                />
            )}
            {catModal && (
                <CategoryModal
                    mode={catModal.mode}
                    cat={catModal.cat}
                    userId={userId}
                    onClose={() => setCatModal(null)}
                    onSaved={loadData}
                />
            )}
        </div>
    );
}
