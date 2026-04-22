'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertTriangle, Save } from 'lucide-react';
import {
    createCareRecord,
    updateCareRecord,
    type CareRecord,
} from '../app/actions/careRecordActions';

interface Props {
    mode: 'create' | 'edit';
    applicantUserId: string;
    applicantName: string;
    existingRecord?: CareRecord;
    operatorUserId: string;
    onSaved: () => void;
    onClose: () => void;
}

function todayIsoDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function CareRecordModal({
    mode,
    applicantUserId,
    applicantName,
    existingRecord,
    operatorUserId,
    onSaved,
    onClose,
}: Props) {
    const [careDate, setCareDate] = useState(
        mode === 'edit' && existingRecord ? existingRecord.careDate : todayIsoDate()
    );
    const [summary, setSummary] = useState(
        mode === 'edit' && existingRecord ? existingRecord.summary : ''
    );
    // 至少保留一個空 row 讓使用者輸入
    const [mediaUrls, setMediaUrls] = useState<string[]>(() => {
        if (mode === 'edit' && existingRecord && existingRecord.mediaUrls.length > 0) {
            return [...existingRecord.mediaUrls];
        }
        return [''];
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>('');

    // 若切換 existingRecord（編輯不同筆），重新初始化
    useEffect(() => {
        if (mode === 'edit' && existingRecord) {
            setCareDate(existingRecord.careDate);
            setSummary(existingRecord.summary);
            setMediaUrls(existingRecord.mediaUrls.length > 0 ? [...existingRecord.mediaUrls] : ['']);
        }
    }, [mode, existingRecord]);

    const canSave = summary.trim().length > 0 && !saving;

    const handleAddUrl = () => setMediaUrls(prev => [...prev, '']);
    const handleRemoveUrl = (idx: number) =>
        setMediaUrls(prev => prev.filter((_, i) => i !== idx));
    const handleChangeUrl = (idx: number, value: string) =>
        setMediaUrls(prev => prev.map((u, i) => (i === idx ? value : u)));

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        setError('');
        try {
            const result =
                mode === 'create'
                    ? await createCareRecord(
                          operatorUserId,
                          applicantUserId,
                          careDate,
                          summary,
                          mediaUrls
                      )
                    : await updateCareRecord(
                          operatorUserId,
                          existingRecord!.id,
                          careDate,
                          summary,
                          mediaUrls
                      );
            if (result.success) {
                onSaved();
                onClose();
            } else {
                setError(result.error);
            }
        } catch (err: any) {
            setError(err?.message ?? '系統錯誤');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                    <h3 className="text-base font-bold text-slate-800">
                        {mode === 'create' ? '新增關懷紀錄' : '編輯關懷紀錄'}
                    </h3>
                    <button onClick={onClose} type="button">
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                            關懷對象
                        </label>
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
                            {applicantName}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            關懷日期 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={careDate}
                            onChange={e => setCareDate(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            關懷摘要 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={summary}
                            onChange={e => setSummary(e.target.value)}
                            rows={6}
                            placeholder="記錄本次關懷的內容、對象狀況、需跟進事項…"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            媒體雲端連結（圖片/影片）
                        </label>
                        <div className="space-y-2">
                            {mediaUrls.map((url, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={e => handleChangeUrl(idx, e.target.value)}
                                        placeholder="https://photos.google.com/... 或其他雲端連結"
                                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveUrl(idx)}
                                        disabled={mediaUrls.length === 1 && !url}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="移除此連結"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleAddUrl}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                新增連結
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                            填寫外部雲端連結（Google Photos / Drive / YouTube 等）；空白項目儲存時會自動省略
                        </p>
                    </div>

                    {error && (
                        <p className="text-xs text-red-600 flex items-center gap-1 bg-red-50 border border-red-200 rounded px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-slate-100 justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                        <Save className="w-3.5 h-3.5" />
                        {saving ? '儲存中…' : '儲存'}
                    </button>
                </div>
            </div>
        </div>
    );
}
