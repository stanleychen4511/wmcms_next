import { useState, useEffect, useRef } from 'react';
import { Megaphone, Tag, Plus, Pencil, Trash2, Eye, EyeOff, Check, X, AlertTriangle, Bold, Italic, Link } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx } from 'clsx';
import {
    Announcement, AnnouncementCategory,
    fetchAllAnnouncementsAdmin, fetchAllCategories,
    upsertAnnouncement, deleteAnnouncement,
    upsertCategory, deleteCategory,
} from '../app/actions/announcementActions';

interface AnnouncementManagerProps {
    userId?: string;
}

type SubTab = 'list' | 'categories';

// Preset color options for categories
const COLOR_PRESETS = [
    { label: '紅',  value: 'bg-red-100 text-red-700' },
    { label: '藍',  value: 'bg-blue-100 text-blue-700' },
    { label: '綠',  value: 'bg-emerald-100 text-emerald-700' },
    { label: '紫',  value: 'bg-purple-100 text-purple-700' },
    { label: '橘',  value: 'bg-orange-100 text-orange-700' },
    { label: '灰',  value: 'bg-gray-100 text-gray-700' },
    { label: '黃',  value: 'bg-yellow-100 text-yellow-700' },
    { label: '青',  value: 'bg-teal-100 text-teal-700' },
];

const today = () => new Date().toISOString().split('T')[0];

interface AnnForm {
    title: string;
    category_id: string;
    content: string;
    publish_date: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

const EMPTY_ANN: AnnForm = {
    title: '',
    category_id: '',
    content: '',
    publish_date: today(),
    start_date: today(),
    end_date: '',
    is_active: true,
};

interface CatForm {
    name: string;
    color: string;
    sort_order: number;
    is_active: boolean;
}

const EMPTY_CAT: CatForm = { name: '', color: 'bg-blue-100 text-blue-700', sort_order: 0, is_active: true };

export function AnnouncementManager({ userId }: AnnouncementManagerProps) {
    const [subTab, setSubTab] = useState<SubTab>('list');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [categories, setCategories] = useState<AnnouncementCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [globalError, setGlobalError] = useState('');

    // Announcement form
    const [editingAnnId, setEditingAnnId] = useState<number | null>(null); // null=closed, 0=new, >0=editing
    const [annForm, setAnnForm] = useState<AnnForm>(EMPTY_ANN);
    const [annSaving, setAnnSaving] = useState(false);
    const [annError, setAnnError] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const contentRef = useRef<HTMLTextAreaElement>(null);

    // Category form
    const [editingCatId, setEditingCatId] = useState<number | null>(null);
    const [catForm, setCatForm] = useState<CatForm>(EMPTY_CAT);
    const [catSaving, setCatSaving] = useState(false);
    const [catError, setCatError] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const [anns, cats] = await Promise.all([
                fetchAllAnnouncementsAdmin(),
                fetchAllCategories(),
            ]);
            setAnnouncements(anns);
            setCategories(cats);
        } catch (e: any) {
            setGlobalError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // ── Markdown toolbar ──────────────────────────────────────────────────────
    const insertMarkdown = (before: string, after: string, placeholder: string) => {
        const ta = contentRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = ta.value.slice(start, end) || placeholder;
        const newVal = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
        setAnnForm(p => ({ ...p, content: newVal }));
        setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(start + before.length, start + before.length + selected.length);
        }, 0);
    };

    const insertLink = () => {
        const url = window.prompt('請輸入連結網址（含 https://）');
        if (!url) return;
        const ta = contentRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = ta.value.slice(start, end) || '連結文字';
        const mdLink = `[${text}](${url})`;
        const newVal = ta.value.slice(0, start) + mdLink + ta.value.slice(end);
        setAnnForm(p => ({ ...p, content: newVal }));
    };

    // ── Announcement CRUD ─────────────────────────────────────────────────────
    const openNewAnn = () => {
        setAnnForm({ ...EMPTY_ANN, publish_date: today(), start_date: today() });
        setEditingAnnId(0);
        setAnnError('');
        setShowPreview(false);
    };

    const openEditAnn = (a: Announcement) => {
        setAnnForm({
            title: a.title,
            category_id: a.category_id ? String(a.category_id) : '',
            content: a.content,
            publish_date: a.publish_date,
            start_date: a.start_date,
            end_date: a.end_date ?? '',
            is_active: a.is_active,
        });
        setEditingAnnId(a.id);
        setAnnError('');
        setShowPreview(false);
    };

    const closeAnnForm = () => { setEditingAnnId(null); setAnnForm(EMPTY_ANN); setAnnError(''); };

    const saveAnn = async () => {
        if (!annForm.title.trim()) { setAnnError('請填寫公告標題'); return; }
        if (!annForm.content.trim()) { setAnnError('請填寫公告內容'); return; }
        if (!annForm.publish_date) { setAnnError('請填寫公告時間'); return; }
        if (!annForm.start_date) { setAnnError('請填寫區間開始日期'); return; }
        setAnnSaving(true);
        setAnnError('');
        const res = await upsertAnnouncement({
            id: editingAnnId === 0 ? undefined : editingAnnId!,
            category_id: annForm.category_id ? Number(annForm.category_id) : null,
            title: annForm.title.trim(),
            content: annForm.content,
            publish_date: annForm.publish_date,
            start_date: annForm.start_date,
            end_date: annForm.end_date || null,
            is_active: annForm.is_active,
        }, userId);
        setAnnSaving(false);
        if (!res.success) { setAnnError(res.error ?? '儲存失敗'); return; }
        closeAnnForm();
        await load();
    };

    const handleDeleteAnn = async (id: number) => {
        if (!window.confirm('確定要刪除此公告？')) return;
        const res = await deleteAnnouncement(id, userId);
        if (!res.success) { setGlobalError(res.error ?? '刪除失敗'); return; }
        await load();
    };

    // ── Category CRUD ─────────────────────────────────────────────────────────
    const openNewCat = () => {
        setCatForm({ ...EMPTY_CAT, sort_order: categories.length + 1 });
        setEditingCatId(0);
        setCatError('');
    };

    const openEditCat = (c: AnnouncementCategory) => {
        setCatForm({ name: c.name, color: c.color, sort_order: c.sort_order, is_active: c.is_active });
        setEditingCatId(c.id);
        setCatError('');
    };

    const closeCatForm = () => { setEditingCatId(null); setCatForm(EMPTY_CAT); setCatError(''); };

    const saveCat = async () => {
        if (!catForm.name.trim()) { setCatError('請填寫分類名稱'); return; }
        setCatSaving(true);
        setCatError('');
        const res = await upsertCategory({
            id: editingCatId === 0 ? undefined : editingCatId!,
            ...catForm,
            name: catForm.name.trim(),
        }, userId);
        setCatSaving(false);
        if (!res.success) { setCatError(res.error ?? '儲存失敗'); return; }
        closeCatForm();
        await load();
    };

    const handleDeleteCat = async (id: number) => {
        if (!window.confirm('確定要刪除此分類？')) return;
        const res = await deleteCategory(id, userId);
        if (!res.success) { setGlobalError(res.error ?? '刪除失敗'); return; }
        await load();
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Megaphone className="w-6 h-6 text-blue-600" />
                    公告管理
                </h2>
                <div className="flex gap-2">
                    {subTab === 'list' && (
                        <button onClick={openNewAnn} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm text-sm font-medium">
                            <Plus className="w-4 h-4" />新增公告
                        </button>
                    )}
                    {subTab === 'categories' && (
                        <button onClick={openNewCat} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm text-sm font-medium">
                            <Plus className="w-4 h-4" />新增分類
                        </button>
                    )}
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 border-b border-slate-200">
                {(['list', 'categories'] as SubTab[]).map(t => (
                    <button key={t} onClick={() => setSubTab(t)}
                        className={clsx('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
                            subTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                        )}>
                        {t === 'list' ? '公告列表' : '分類管理'}
                    </button>
                ))}
            </div>

            {globalError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{globalError}
                    <button onClick={() => setGlobalError('')} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* ── Announcement List Tab ── */}
            {subTab === 'list' && (
                <div className="space-y-4">
                    {/* Form */}
                    {editingAnnId !== null && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                                {editingAnnId === 0 ? '新增公告' : '編輯公告'}
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Title */}
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">標題 *</label>
                                    <input type="text" value={annForm.title} onChange={e => setAnnForm(p => ({ ...p, title: e.target.value }))}
                                        maxLength={200} placeholder="公告標題"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">分類</label>
                                    <select value={annForm.category_id} onChange={e => setAnnForm(p => ({ ...p, category_id: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">── 不指定分類 ──</option>
                                        {categories.filter(c => c.is_active).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Publish date */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">公告時間 *</label>
                                    <input type="date" value={annForm.publish_date} onChange={e => setAnnForm(p => ({ ...p, publish_date: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>

                                {/* Date range */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">顯示區間開始 *</label>
                                    <input type="date" value={annForm.start_date} onChange={e => setAnnForm(p => ({ ...p, start_date: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">顯示區間結束 <span className="font-normal text-gray-400">（空白 = 永久）</span></label>
                                    <input type="date" value={annForm.end_date} onChange={e => setAnnForm(p => ({ ...p, end_date: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>

                                {/* is_active */}
                                <div className="flex items-center gap-2 mt-1">
                                    <button type="button" onClick={() => setAnnForm(p => ({ ...p, is_active: !p.is_active }))}
                                        className={clsx('relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                            annForm.is_active ? 'bg-blue-600' : 'bg-gray-300')}>
                                        <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                                            annForm.is_active ? 'translate-x-6' : 'translate-x-1')} />
                                    </button>
                                    <span className="text-sm text-slate-600">{annForm.is_active ? '啟用' : '停用'}</span>
                                </div>
                            </div>

                            {/* Content editor */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">內容 * <span className="font-normal text-gray-400 normal-case">（Markdown）</span></label>
                                    <button onClick={() => setShowPreview(p => !p)}
                                        className="text-xs text-blue-600 hover:text-blue-800 transition font-medium">
                                        {showPreview ? '切換編輯' : '切換預覽'}
                                    </button>
                                </div>

                                {!showPreview ? (
                                    <div>
                                        {/* Toolbar */}
                                        <div className="flex items-center gap-1 border border-b-0 border-gray-300 rounded-t-lg px-2 py-1 bg-gray-50">
                                            <button type="button" onClick={() => insertMarkdown('**', '**', '粗體文字')} title="粗體"
                                                className="p-1.5 rounded hover:bg-gray-200 text-slate-600 transition">
                                                <Bold className="w-3.5 h-3.5" />
                                            </button>
                                            <button type="button" onClick={() => insertMarkdown('_', '_', '斜體文字')} title="斜體"
                                                className="p-1.5 rounded hover:bg-gray-200 text-slate-600 transition">
                                                <Italic className="w-3.5 h-3.5" />
                                            </button>
                                            <div className="w-px h-4 bg-gray-300 mx-1" />
                                            <button type="button" onClick={insertLink} title="插入連結"
                                                className="p-1.5 rounded hover:bg-gray-200 text-slate-600 transition flex items-center gap-1 text-xs">
                                                <Link className="w-3.5 h-3.5" />連結
                                            </button>
                                        </div>
                                        <textarea
                                            ref={contentRef}
                                            value={annForm.content}
                                            onChange={e => setAnnForm(p => ({ ...p, content: e.target.value }))}
                                            rows={8}
                                            placeholder="公告內容（支援 **粗體**、_斜體_、[連結文字](url)）"
                                            className="w-full border border-gray-300 rounded-b-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                                        />
                                    </div>
                                ) : (
                                    <div className="border border-gray-300 rounded-lg px-4 py-3 min-h-[200px] prose prose-sm max-w-none bg-white text-slate-800">
                                        <ReactMarkdown
                                            components={{ img: () => null }}
                                        >
                                            {annForm.content || '*（無內容）*'}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            {annError && (
                                <p className="text-sm text-red-600 flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />{annError}
                                </p>
                            )}
                            <div className="flex gap-2 pt-1">
                                <button onClick={saveAnn} disabled={annSaving}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
                                    {annSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                                    {annSaving ? '儲存中…' : '儲存'}
                                </button>
                                <button onClick={closeAnnForm}
                                    className="flex items-center gap-2 bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 transition text-sm">
                                    <X className="w-4 h-4" />取消
                                </button>
                            </div>
                        </div>
                    )}

                    {/* List */}
                    {loading ? (
                        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                    ) : announcements.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p>尚無公告</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {announcements.map(a => (
                                <div key={a.id} className={clsx('flex items-start gap-4 bg-white border rounded-xl p-4', a.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60')}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            {a.category_name && (
                                                <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', a.category_color ?? 'bg-gray-100 text-gray-600')}>
                                                    {a.category_name}
                                                </span>
                                            )}
                                            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                                                {a.is_active ? '啟用' : '停用'}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            發布：{a.publish_date}　區間：{a.start_date} ～ {a.end_date ?? '永久'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button onClick={() => openEditAnn(a)} title="編輯"
                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteAnn(a.id)} title="刪除"
                                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Category Tab ── */}
            {subTab === 'categories' && (
                <div className="space-y-4">
                    {/* Form */}
                    {editingCatId !== null && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                                {editingCatId === 0 ? '新增分類' : '編輯分類'}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">分類名稱 *</label>
                                    <input type="text" value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))}
                                        maxLength={50} placeholder="例：活動公告"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">顏色</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {COLOR_PRESETS.map(p => (
                                            <button key={p.value} type="button" onClick={() => setCatForm(prev => ({ ...prev, color: p.value }))}
                                                className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border-2 transition', p.value,
                                                    catForm.color === p.value ? 'border-slate-800 scale-110' : 'border-transparent')}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">排序</label>
                                    <input type="number" min={0} value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setCatForm(p => ({ ...p, is_active: !p.is_active }))}
                                    className={clsx('relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                        catForm.is_active ? 'bg-blue-600' : 'bg-gray-300')}>
                                    <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                                        catForm.is_active ? 'translate-x-6' : 'translate-x-1')} />
                                </button>
                                <span className="text-sm text-slate-600">{catForm.is_active ? '啟用' : '停用'}</span>
                            </div>

                            {catError && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />{catError}</p>}
                            <div className="flex gap-2">
                                <button onClick={saveCat} disabled={catSaving}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
                                    {catSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                                    {catSaving ? '儲存中…' : '儲存'}
                                </button>
                                <button onClick={closeCatForm}
                                    className="flex items-center gap-2 bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 transition text-sm">
                                    <X className="w-4 h-4" />取消
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Category list */}
                    {loading ? (
                        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                    ) : (
                        <div className="space-y-2">
                            {categories.map(c => (
                                <div key={c.id} className={clsx('flex items-center gap-4 bg-white border rounded-xl p-4', c.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60')}>
                                    <span className={clsx('px-3 py-1 rounded-full text-sm font-medium shrink-0', c.color)}>{c.name}</span>
                                    <span className="text-xs text-slate-400">排序：{c.sort_order}</span>
                                    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                                        {c.is_active ? '啟用' : '停用'}
                                    </span>
                                    <div className="flex items-center gap-1.5 ml-auto">
                                        <button onClick={() => openEditCat(c)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"><Pencil className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteCat(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
