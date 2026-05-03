import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Check, X, Image as ImageIcon, Link, AlertTriangle } from 'lucide-react';
import { fetchAllBanners, upsertBanner, deleteBanner, toggleBannerActive, Banner } from '../app/actions/bannerActions';
import { clsx } from 'clsx';
import { useToast } from './FloatingToast';

interface BannerManagerProps {
    userId?: string;
}

interface FormState {
    title: string;
    subtitle: string;
    link_url: string;
    sort_order: number;
    is_active: boolean;
    imageFile: File | null;
    imagePreview: string | null; // preview URL for new file or existing image_url
}

const EMPTY_FORM: FormState = {
    title: '',
    subtitle: '',
    link_url: '',
    sort_order: 0,
    is_active: true,
    imageFile: null,
    imagePreview: null,
};

export function BannerManager({ userId }: BannerManagerProps) {
    const { push: pushToast } = useToast();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);

    // Editing state: null = no form open, 0 = new, >0 = editing existing id
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = async () => {
        setLoading(true);
        try {
            const data = await fetchAllBanners();
            setBanners(data);
        } catch (e: any) {
            pushToast({ type: 'error', msg: e.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openNew = () => {
        setForm({ ...EMPTY_FORM, sort_order: banners.length + 1 });
        setEditingId(0);
        setFormError('');
    };

    const openEdit = (b: Banner) => {
        setForm({
            title: b.title ?? '',
            subtitle: b.subtitle ?? '',
            link_url: b.link_url ?? '',
            sort_order: b.sort_order,
            is_active: b.is_active,
            imageFile: null,
            imagePreview: b.image_url,
        });
        setEditingId(b.id);
        setFormError('');
    };

    const closeForm = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setFormError('');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        if (!file) return;
        setForm(prev => ({
            ...prev,
            imageFile: file,
            imagePreview: URL.createObjectURL(file),
        }));
    };

    const handleSave = async () => {
        setFormError('');

        // Validation
        if (editingId === 0 && !form.imageFile) {
            setFormError('新增 Banner 時必須上傳圖片');
            return;
        }
        if (form.link_url && !form.imagePreview && !form.imageFile) {
            setFormError('不能只有超連結沒有圖片');
            return;
        }
        if (form.link_url) {
            try { new URL(form.link_url); } catch {
                setFormError('超連結格式不正確（請以 https:// 開頭）');
                return;
            }
        }

        setSaving(true);
        try {
            let fd: FormData | undefined;
            if (form.imageFile) {
                fd = new FormData();
                fd.append('image', form.imageFile);
            }

            const res = await upsertBanner(
                {
                    id: editingId === 0 ? undefined : editingId!,
                    title: form.title || null,
                    subtitle: form.subtitle || null,
                    link_url: form.link_url || null,
                    sort_order: form.sort_order,
                    is_active: form.is_active,
                },
                fd,
                userId
            );

            if (!res.success) { setFormError(res.error ?? '儲存失敗'); return; }
            closeForm();
            await load();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('確定要刪除此 Banner？')) return;
        const res = await deleteBanner(id, userId);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '刪除失敗' }); return; }
        await load();
    };

    const handleToggle = async (b: Banner) => {
        const res = await toggleBannerActive(b.id, !b.is_active, userId);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '操作失敗' }); return; }
        await load();
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <ImageIcon className="w-6 h-6 text-blue-600" />
                    Banner 管理
                </h2>
                <button
                    onClick={openNew}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    新增 Banner
                </button>
            </div>

            {/* Add / Edit Form */}
            {editingId !== null && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                        {editingId === 0 ? '新增 Banner' : '編輯 Banner'}
                    </h3>

                    {/* Image upload */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                            圖片 <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-start gap-4">
                            {form.imagePreview && (
                                <img
                                    src={form.imagePreview}
                                    alt="預覽"
                                    className="w-40 h-24 object-cover rounded-lg border border-slate-200 shrink-0"
                                />
                            )}
                            <div className="flex-1">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 border border-dashed border-slate-300 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-lg text-sm transition"
                                >
                                    <ImageIcon className="w-4 h-4" />
                                    {form.imagePreview ? '更換圖片' : '選擇圖片'}
                                </button>
                                <p className="text-xs text-slate-400 mt-1.5">支援 JPG、PNG、GIF、WebP</p>
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">標題（選填）</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                            maxLength={100}
                            placeholder="例：攜手關懷，傳遞溫暖"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Subtitle */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">副標題（選填）</label>
                        <input
                            type="text"
                            value={form.subtitle}
                            onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))}
                            maxLength={200}
                            placeholder="例：萬美基金會致力於為需要幫助的家庭提供全面支持"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Link URL */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                            <Link className="w-3.5 h-3.5" />
                            超連結（選填）
                        </label>
                        <input
                            type="url"
                            value={form.link_url}
                            onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))}
                            placeholder="https://example.com"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Sort order + is_active */}
                    <div className="flex items-center gap-6">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">排序</label>
                            <input
                                type="number"
                                min={0}
                                value={form.sort_order}
                                onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-2 mt-5">
                            <button
                                type="button"
                                onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                                className={clsx(
                                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                                    form.is_active ? 'bg-blue-600' : 'bg-gray-300'
                                )}
                            >
                                <span className={clsx(
                                    'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                                    form.is_active ? 'translate-x-6' : 'translate-x-1'
                                )} />
                            </button>
                            <span className="text-sm text-slate-600">{form.is_active ? '啟用' : '停用'}</span>
                        </div>
                    </div>

                    {formError && (
                        <p className="text-sm text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 shrink-0" />{formError}
                        </p>
                    )}

                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                            {saving ? '儲存中…' : '儲存'}
                        </button>
                        <button
                            onClick={closeForm}
                            className="flex items-center gap-2 bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 transition text-sm"
                        >
                            <X className="w-4 h-4" />
                            取消
                        </button>
                    </div>
                </div>
            )}

            {/* Banner List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : banners.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>尚無 Banner，請點擊「新增 Banner」</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {banners.map(b => (
                        <div key={b.id} className={clsx(
                            'flex items-center gap-4 bg-white border rounded-xl p-4 transition',
                            b.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'
                        )}>
                            {/* Thumbnail */}
                            <img
                                src={b.image_url}
                                alt={b.title ?? 'Banner'}
                                className="w-32 h-20 object-cover rounded-lg border border-slate-200 shrink-0"
                            />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                    {b.title || <span className="text-slate-400 font-normal">（無標題）</span>}
                                </p>
                                {b.subtitle && (
                                    <p className="text-xs text-slate-500 truncate mt-0.5">{b.subtitle}</p>
                                )}
                                {b.link_url && (
                                    <a
                                        href={b.link_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1 truncate"
                                    >
                                        <Link className="w-3 h-3 shrink-0" />
                                        {b.link_url}
                                    </a>
                                )}
                                <p className="text-xs text-slate-400 mt-1">排序：{b.sort_order}</p>
                            </div>

                            {/* Status badge */}
                            <span className={clsx(
                                'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                                b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            )}>
                                {b.is_active ? '啟用中' : '已停用'}
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    onClick={() => handleToggle(b)}
                                    title={b.is_active ? '停用' : '啟用'}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                                >
                                    {b.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => openEdit(b)}
                                    title="編輯"
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(b.id)}
                                    title="刪除"
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
