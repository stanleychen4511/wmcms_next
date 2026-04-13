'use client';
import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { fetchAllSettings, updateSetting, SystemSetting } from '../app/actions/settingsActions';

const SETTING_LABEL: Record<string, string> = {
    pending_doc_alert_days: '未補件提示門檻天數',
};

const SETTING_UNIT: Record<string, string> = {
    pending_doc_alert_days: '天',
};

const SETTING_HINT: Record<string, string> = {
    pending_doc_alert_days: '收件後超過此天數且仍有必備文件未上傳的案件，將於首頁顯示未補件提示',
};

interface SettingsPanelProps {
    userId: string;
}

export function SettingsPanel({ userId }: SettingsPanelProps) {
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [toasts, setToasts] = useState<Record<string, { type: 'success' | 'error'; msg: string }>>({});

    const load = useCallback(async () => {
        setLoading(true);
        const res = await fetchAllSettings();
        if (res.success && res.data) {
            setSettings(res.data);
            const init: Record<string, string> = {};
            res.data.forEach(s => { init[s.key] = s.value; });
            setEditValues(init);
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (key: string) => {
        setSaving(prev => ({ ...prev, [key]: true }));
        setToasts(prev => { const n = { ...prev }; delete n[key]; return n; });
        const res = await updateSetting(key, editValues[key] ?? '', userId);
        setSaving(prev => ({ ...prev, [key]: false }));
        if (res.success) {
            setToasts(prev => ({ ...prev, [key]: { type: 'success', msg: '已儲存' } }));
            setSettings(prev => prev.map(s =>
                s.key === key ? { ...s, value: editValues[key] ?? s.value, updatedAt: new Date().toISOString() } : s
            ));
            setTimeout(() => setToasts(prev => { const n = { ...prev }; delete n[key]; return n; }), 3000);
        } else {
            setToasts(prev => ({ ...prev, [key]: { type: 'error', msg: res.error ?? '儲存失敗' } }));
        }
    };

    const isDirty = (key: string, currentValue: string) => editValues[key] !== currentValue;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-sm text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />載入中…
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-700">系統參數設定</h2>
            </div>

            {settings.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">目前無可設定的參數。</p>
            ) : (
                <div className="space-y-4">
                    {settings.map(setting => {
                        const label = SETTING_LABEL[setting.key] ?? setting.key;
                        const unit = SETTING_UNIT[setting.key] ?? '';
                        const hint = SETTING_HINT[setting.key] ?? setting.description ?? '';
                        const toast = toasts[setting.key];
                        const isSaving = saving[setting.key] ?? false;
                        const dirty = isDirty(setting.key, setting.value);

                        return (
                            <div key={setting.key} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium text-slate-800">{label}</p>
                                        {hint && <p className="text-xs text-slate-400">{hint}</p>}
                                    </div>
                                    <span className="text-xs text-slate-400 shrink-0 mt-1">
                                        最後更新：{setting.updatedAt
                                            ? new Date(setting.updatedAt).toLocaleDateString('zh-TW')
                                            : '—'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                                        <input
                                            type="number"
                                            min={1}
                                            className="w-20 text-sm text-slate-800 outline-none"
                                            value={editValues[setting.key] ?? setting.value}
                                            onChange={e => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                                            onKeyDown={e => e.key === 'Enter' && dirty && handleSave(setting.key)}
                                        />
                                        {unit && <span className="text-sm text-slate-500">{unit}</span>}
                                    </div>

                                    <button
                                        onClick={() => handleSave(setting.key)}
                                        disabled={isSaving || !dirty}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition"
                                    >
                                        {isSaving
                                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            : <Save className="w-3.5 h-3.5" />}
                                        {isSaving ? '儲存中…' : '儲存'}
                                    </button>

                                    {toast && (
                                        <span className={`flex items-center gap-1 text-xs font-medium ${
                                            toast.type === 'success' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {toast.type === 'success'
                                                ? <CheckCircle className="w-3.5 h-3.5" />
                                                : <AlertTriangle className="w-3.5 h-3.5" />}
                                            {toast.msg}
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-slate-400">
                                    目前值：<span className="font-semibold text-slate-600">{setting.value}{unit}</span>
                                    {dirty && <span className="ml-2 text-amber-500">（未儲存）</span>}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
