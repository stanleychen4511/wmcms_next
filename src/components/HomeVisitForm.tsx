"use client";
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Home, Save, Loader2, ChevronDown, Plus, Trash2, Upload, Image as ImageIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchHomeVisit, saveHomeVisit, HomeVisitData } from '../app/actions/homeVisitActions';
import { useToast } from './FloatingToast';
import { uploadFileToBlob } from '../lib/uploadClient';

interface HomeVisitFormProps {
    applicationId: string;
    visitorUserId?: string; // logged-in user's DB id
    readOnly?: boolean;
    /** 顯示在「本案不進行家訪」勾選區下方、勾選不家訪時自動隱藏的內容（如家訪指派 panel） */
    assigneeSlot?: ReactNode;
}

// ── Option helpers ────────────────────────────────────────────────────────────

interface SelectFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    disabled?: boolean;
    otherValue?: string;
    onOtherChange?: (v: string) => void;
    otherLabel?: string;
}

function SelectField({ label, value, onChange, options, disabled, otherValue, onOtherChange, otherLabel }: SelectFieldProps) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={e => {
                        onChange(e.target.value);
                        if (e.target.value !== options[options.length - 1]?.value && onOtherChange) {
                            onOtherChange('');
                        }
                    }}
                    disabled={disabled}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-9 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <option value="">── 請選擇 ──</option>
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {value === options[options.length - 1]?.value && onOtherChange && (
                <input
                    type="text"
                    value={otherValue ?? ''}
                    onChange={e => onOtherChange(e.target.value)}
                    placeholder={otherLabel ?? '其他說明…'}
                    disabled={disabled}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                />
            )}
        </div>
    );
}

function TextareaField({ label, value, onChange, disabled, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">{label}</label>
            <textarea
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
            />
        </div>
    );
}

// Option sets — values match DB VARCHAR(1) codes per spec
const DISEASE_REACTION_OPTS = [
    { value: '1', label: '否認' },
    { value: '2', label: '憤怒' },
    { value: '3', label: '討價還價' },
    { value: '4', label: '沮喪' },
    { value: '5', label: '接受' },
    { value: '6', label: '其他' },
];
const TREATMENT_ATTITUDE_OPTS = [
    { value: '1', label: '過度期待' },
    { value: '2', label: '適當配合' },
    { value: '3', label: '被動接受' },
    { value: '4', label: '其他' },
];
const CAREGIVER_OPTS = [
    { value: '1', label: '配偶' },
    { value: '2', label: '伴侶' },
    { value: '3', label: '子女' },
    { value: '4', label: '親戚' },
    { value: '5', label: '朋友' },
    { value: '6', label: '其他' },
];
const FAMILY_INTERACTION_OPTS = [
    { value: '1', label: '和諧' },
    { value: '2', label: '普通' },
    { value: '3', label: '衝突' },
    { value: '4', label: '冷漠疏離' },
    { value: '5', label: '其他' },
];
const TREATMENT_SUPPORT_OPTS = [
    { value: '1', label: '非常支持' },
    { value: '2', label: '普通支持' },
    { value: '3', label: '被動配合' },
    { value: '4', label: '其他' },
];
const RECOMMENDATION_OPTS = [
    { value: '1', label: '有補助需求' },
    { value: '2', label: '轉介資源' },
    { value: '3', label: '其他' },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export function HomeVisitForm({ applicationId, visitorUserId, readOnly = false, assigneeSlot }: HomeVisitFormProps) {
    const { push: pushToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<HomeVisitData>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchHomeVisit(applicationId);
            if (data) setForm(data);
        } finally {
            setLoading(false);
        }
    }, [applicationId]);

    useEffect(() => { loadData(); }, [loadData]);

    const set = (field: keyof HomeVisitData) => (value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

    /** 全欄位必填驗證；缺項回傳第一個缺漏的中文欄位名稱，否則 null */
    const validateRequired = (data: HomeVisitData): string | null => {
        const isEmpty = (v: any) => v == null || (typeof v === 'string' && v.trim() === '');
        // 不家訪 → 只驗 skip_reason
        if (data.visit_skipped) {
            if (isEmpty(data.skip_reason) || (data.skip_reason ?? '').trim().length < 3) {
                return '不家訪原因（至少 3 字）';
            }
            return null;
        }
        if (isEmpty(data.visit_date))                return '家訪日期';
        if (isEmpty(data.visitor_title))             return '訪視者職稱';
        if (isEmpty(data.visitor_name))              return '訪視者姓名';
        // 至少一張照片
        const photos = (data.visit_photo_urls ?? []).filter(u => u && u.trim() !== '');
        if (photos.length === 0)                     return '家訪照片（至少一張）';
        if (isEmpty(data.self_reported_condition))   return '自述病情';
        if (isEmpty(data.disease_reaction_status))   return '對疾病的反應';
        if (data.disease_reaction_status === '6' && isEmpty(data.disease_reaction_other)) return '對疾病的反應-其他說明';
        if (isEmpty(data.treatment_attitude_status)) return '對疾病治療的態度';
        if (data.treatment_attitude_status === '4' && isEmpty(data.treatment_attitude_other)) return '對疾病治療的態度-其他說明';
        if (isEmpty(data.other_status_notes))        return '其他身、心、想法等';
        if (isEmpty(data.primary_caregiver))         return '主要照顧者';
        if (data.primary_caregiver === '6' && isEmpty(data.primary_caregiver_other)) return '主要照顧者-其他說明';
        if (isEmpty(data.family_interaction_status)) return '家庭互動';
        if (data.family_interaction_status === '5' && isEmpty(data.family_interaction_other)) return '家庭互動-其他說明';
        if (isEmpty(data.impacted_party_thoughts))   return '對個案與其病情的想法';
        if (isEmpty(data.treatment_support_status))  return '對個案疾病治療的支持';
        if (data.treatment_support_status === '4' && isEmpty(data.treatment_support_other)) return '對個案疾病治療的支持-其他說明';
        if (isEmpty(data.subsidy_need_reason))       return '個案需求評估';
        if (isEmpty(data.visitor_recommendations))   return '訪視者建議事項';
        if (data.visitor_recommendations === '3' && isEmpty(data.visitor_recommendations_other)) return '訪視者建議事項-其他說明';
        return null;
    };

    const handleSave = async () => {
        const missing = validateRequired(form);
        if (missing) {
            pushToast({ type: 'error', msg: `請填寫：${missing}` });
            return;
        }
        setSaving(true);
        try {
            // 過濾掉空 URL 後再存
            const cleaned: HomeVisitData = {
                ...form,
                visit_photo_urls: (form.visit_photo_urls ?? []).map(u => u.trim()).filter(u => u !== ''),
            };
            const res = await saveHomeVisit(applicationId, visitorUserId ?? null, cleaned);
            if (res.success) {
                setForm(cleaned);
                pushToast({ type: 'success', msg: '已成功儲存至資料庫' });
            } else {
                pushToast({ type: 'error', msg: res.error ?? '儲存失敗' });
            }
        } catch {
            pushToast({ type: 'error', msg: '系統錯誤，請重試' });
        } finally {
            setSaving(false);
        }
    };

    /** 照片陣列：上傳/移除（新版用 PhotoUploader 元件直接呼叫 setForm，這裡保留沒用到的接口給未來相容 */
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const _addPhoto = () =>
        setForm(prev => ({ ...prev, visit_photo_urls: [...(prev.visit_photo_urls ?? []), ''] }));
    const _removePhoto = (idx: number) =>
        setForm(prev => ({
            ...prev,
            visit_photo_urls: (prev.visit_photo_urls ?? []).filter((_, i) => i !== idx),
        }));
    const _setPhoto = (idx: number, value: string) =>
        setForm(prev => ({
            ...prev,
            visit_photo_urls: (prev.visit_photo_urls ?? []).map((u, i) => (i === idx ? value : u)),
        }));
    /* eslint-enable @typescript-eslint/no-unused-vars */

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>載入訪視資料中…</span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 bg-indigo-50/50 flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Home className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800">家訪關懷紀錄表</h3>
                    <p className="text-xs text-slate-500 mt-0.5">對應資料庫 home_visit 表格，資料儲存後即時同步</p>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* user feedback #18：經濟弱勢可選擇不家訪 + 填寫原因 */}
                <div className={`border rounded-lg p-3 ${form.visit_skipped ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!form.visit_skipped}
                            onChange={e => setForm(prev => ({
                                ...prev,
                                visit_skipped: e.target.checked,
                                ...(e.target.checked ? {} : { skip_reason: '' }),
                            }))}
                            disabled={readOnly}
                            className="accent-amber-600"
                        />
                        <span className="text-sm font-medium text-slate-700">
                            ⊘ 本案不進行家訪（適用於經濟弱勢等不需家訪的情況）
                        </span>
                    </label>
                    {form.visit_skipped && (
                        <div className="mt-2">
                            <label className="block text-xs font-semibold text-amber-700 mb-1">不家訪原因 *（至少 3 字）</label>
                            <textarea
                                value={form.skip_reason ?? ''}
                                onChange={e => setForm(prev => ({ ...prev, skip_reason: e.target.value }))}
                                disabled={readOnly}
                                rows={2}
                                placeholder="例：經濟弱勢案件依規免家訪、申請人住偏遠地區家訪困難..."
                                className="w-full bg-white border border-amber-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                    )}
                </div>

                {/* 家訪指派 slot — 勾選「不進行家訪」時隱藏 */}
                {!form.visit_skipped && assigneeSlot}

                {/* 非跳過情境才顯示完整家訪表 */}
                {!form.visit_skipped && (<>

                {/* Visitor info: 日期 / 職稱 / 姓名（皆必填） */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">
                            家訪日期 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={form.visit_date ?? ''}
                            onChange={e => set('visit_date')(e.target.value)}
                            disabled={readOnly}
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white disabled:opacity-60"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">
                            訪視者職稱 <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.visitor_title ?? ''}
                            onChange={e => set('visitor_title')(e.target.value)}
                            disabled={readOnly}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white disabled:opacity-60"
                        >
                            <option value="">請選擇</option>
                            <option value="志工">志工</option>
                            <option value="個管師">個管師</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">
                            訪視者姓名 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.visitor_name ?? ''}
                            onChange={e => set('visitor_name')(e.target.value)}
                            disabled={readOnly}
                            placeholder="如：王小明"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white disabled:opacity-60"
                        />
                    </div>
                </div>

                {/* 家訪照片（至少一張，必填）— user feedback #8：直接上傳檔案、不用雲端連結 */}
                <PhotoUploader
                    photos={form.visit_photo_urls ?? []}
                    onChange={(arr) => setForm(prev => ({ ...prev, visit_photo_urls: arr }))}
                    readOnly={readOnly}
                    applicationId={applicationId}
                />

                {/* 目前狀態 */}
                <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">目前狀態</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <TextareaField
                            label="自述病情"
                            value={form.self_reported_condition ?? ''}
                            onChange={set('self_reported_condition')}
                            disabled={readOnly}
                            placeholder="記錄案主對自身狀況的描述…"
                        />
                        <SelectField
                            label="對疾病的反應"
                            value={form.disease_reaction_status ?? ''}
                            onChange={set('disease_reaction_status')}
                            options={DISEASE_REACTION_OPTS}
                            disabled={readOnly}
                            otherValue={form.disease_reaction_other}
                            onOtherChange={set('disease_reaction_other')}
                        />
                        <SelectField
                            label="對疾病治療的態度"
                            value={form.treatment_attitude_status ?? ''}
                            onChange={set('treatment_attitude_status')}
                            options={TREATMENT_ATTITUDE_OPTS}
                            disabled={readOnly}
                            otherValue={form.treatment_attitude_other}
                            onOtherChange={set('treatment_attitude_other')}
                        />
                        <TextareaField
                            label="其他身、心、想法等"
                            value={form.other_status_notes ?? ''}
                            onChange={set('other_status_notes')}
                            disabled={readOnly}
                            placeholder="記錄其他身體、心理或想法等狀況…"
                        />
                    </div>
                </div>

                {/* 個案家庭資料 */}
                <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">個案家庭資料</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <SelectField
                            label="主要照顧者"
                            value={form.primary_caregiver ?? ''}
                            onChange={set('primary_caregiver')}
                            options={CAREGIVER_OPTS}
                            disabled={readOnly}
                            otherValue={form.primary_caregiver_other}
                            onOtherChange={set('primary_caregiver_other')}
                        />
                        <SelectField
                            label="家庭互動"
                            value={form.family_interaction_status ?? ''}
                            onChange={set('family_interaction_status')}
                            options={FAMILY_INTERACTION_OPTS}
                            disabled={readOnly}
                            otherValue={form.family_interaction_other}
                            onOtherChange={set('family_interaction_other')}
                        />
                    </div>
                </div>

                {/* 受個案及其病情等影響 */}
                <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">受個案及其病情等影響</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <TextareaField
                            label="對個案與其病情的想法"
                            value={form.impacted_party_thoughts ?? ''}
                            onChange={set('impacted_party_thoughts')}
                            disabled={readOnly}
                            placeholder="記錄家屬對個案與病情的想法…"
                        />
                        <SelectField
                            label="對個案疾病治療的支持"
                            value={form.treatment_support_status ?? ''}
                            onChange={set('treatment_support_status')}
                            options={TREATMENT_SUPPORT_OPTS}
                            disabled={readOnly}
                            otherValue={form.treatment_support_other}
                            onOtherChange={set('treatment_support_other')}
                        />
                    </div>
                </div>

                {/* 萬美基金會補助評估 */}
                <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">萬美基金會補助評估</p>
                    <div className="space-y-5">
                        <TextareaField
                            label="個案需求評估"
                            value={form.subsidy_need_reason ?? ''}
                            onChange={set('subsidy_need_reason')}
                            disabled={readOnly}
                            placeholder="說明個案有／沒有補助需求的原因…"
                        />
                        <SelectField
                            label="訪視者建議事項"
                            value={form.visitor_recommendations ?? ''}
                            onChange={set('visitor_recommendations')}
                            options={RECOMMENDATION_OPTS}
                            disabled={readOnly}
                            otherValue={form.visitor_recommendations_other}
                            onOtherChange={set('visitor_recommendations_other')}
                            otherLabel="請說明其他建議事項…"
                        />
                    </div>
                </div>

                </>)}{/* 非跳過家訪表單 ↑ */}

                {/* Save row */}
                {!readOnly && (
                    <div className="flex items-center justify-end border-t border-slate-100 pt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition shadow-md disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? '儲存中…' : (form.visit_skipped ? '儲存「不家訪」說明' : '儲存家訪紀錄')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Photo Uploader（user feedback #8：志工不會用雲端連結，改成直接上傳檔案） ───

interface PhotoUploaderProps {
    photos: string[];
    onChange: (next: string[]) => void;
    readOnly?: boolean;
    applicationId: string;
}

function PhotoUploader({ photos, onChange, readOnly, applicationId }: PhotoUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const { push: pushToast } = useToast();
    /** 預覽 lightbox 的當前 index；null = 關閉 */
    const [previewIdx, setPreviewIdx] = useState<number | null>(null);

    // ESC 關閉、左右鍵切換
    useEffect(() => {
        if (previewIdx === null) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPreviewIdx(null);
            else if (e.key === 'ArrowLeft') setPreviewIdx(i => (i === null ? null : (i - 1 + photos.length) % photos.length));
            else if (e.key === 'ArrowRight') setPreviewIdx(i => (i === null ? null : (i + 1) % photos.length));
        };
        window.addEventListener('keydown', handler);
        // lock body scroll
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handler);
            document.body.style.overflow = prevOverflow;
        };
    }, [previewIdx, photos.length]);

    const handleAdd = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        const successes: string[] = [];
        for (const file of Array.from(files)) {
            try {
                const result = await uploadFileToBlob(file, {
                    pathPrefix: `uploads/${applicationId}/home_visit_photos`,
                });
                successes.push(result.url);
            } catch (err: any) {
                pushToast({ type: 'error', msg: `${file.name} 上傳失敗：${err?.message ?? '未知錯誤'}` });
            }
        }
        if (successes.length > 0) {
            onChange([...photos, ...successes]);
            pushToast({ type: 'success', msg: `已上傳 ${successes.length} 張照片` });
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemove = (idx: number) => {
        onChange(photos.filter((_, i) => i !== idx));
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
                家訪照片 <span className="text-red-500">*（至少一張）</span>
            </label>
            <p className="text-xs text-slate-400">點下方按鈕直接從手機 / 電腦選照片上傳；支援 jpg/png/webp，可一次選多張。</p>

            {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                    {photos.map((url, idx) => (
                        <div key={idx} className="relative group border border-slate-200 rounded-lg overflow-hidden">
                            {/* 點圖片開啟 lightbox 預覽 */}
                            <button
                                type="button"
                                onClick={() => setPreviewIdx(idx)}
                                className="block w-full cursor-zoom-in"
                                title="點擊放大檢視"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`家訪照片 ${idx + 1}`} className="w-full h-32 object-cover hover:opacity-90 transition" />
                            </button>
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => handleRemove(idx)}
                                    className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition shadow"
                                    title="移除這張照片"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!readOnly && (
                <div className="mt-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={e => handleAdd(e.target.files)}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs rounded-lg transition disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploading ? '上傳中…' : (photos.length > 0 ? '新增更多照片' : '選擇照片上傳')}
                    </button>
                    {photos.length === 0 && (
                        <p className="inline-flex items-center gap-1 ml-2 text-xs text-red-600">
                            <ImageIcon className="w-3 h-3" />尚未上傳任何照片
                        </p>
                    )}
                </div>
            )}

            {/* Lightbox 預覽 — 點黑底或 X 關閉；左右鍵或左右按鈕切換 */}
            {previewIdx !== null && photos[previewIdx] && (
                <div
                    className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
                    onClick={() => setPreviewIdx(null)}
                >
                    {/* 關閉按鈕 */}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPreviewIdx(null); }}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
                        title="關閉（ESC）"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    {/* 上一張 */}
                    {photos.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPreviewIdx(i => i === null ? null : (i - 1 + photos.length) % photos.length); }}
                            className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
                            title="上一張（←）"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}
                    {/* 下一張 */}
                    {photos.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPreviewIdx(i => i === null ? null : (i + 1) % photos.length); }}
                            className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
                            title="下一張（→）"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}
                    {/* 圖片本身 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={photos[previewIdx]}
                        alt={`家訪照片 ${previewIdx + 1}`}
                        className="max-w-full max-h-full object-contain shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    {/* 頁碼指示器 */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/10 rounded-full text-white text-sm">
                        {previewIdx + 1} / {photos.length}
                    </div>
                </div>
            )}
        </div>
    );
}
