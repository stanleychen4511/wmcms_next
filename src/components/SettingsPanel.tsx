'use client';
import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { fetchAllSettings, updateSetting, ensureDefaultSettings, SystemSetting } from '../app/actions/settingsActions';

const SETTING_LABEL: Record<string, string> = {
    pending_doc_alert_days: '未補件天數警示門檻',
    pending_doc_notification_threshold: '未補件提醒次數門檻',
    board_auto_assign:      '董事審核自動派案',
    board_opinion_min_chars: '【董事審核】審核意見最少字數',
    line_official_account_id: 'LINE 官方帳號 ID',
    notification_dispatcher_enabled: '通知派送總開關',
    org_full_name:          '基金會全名',
    org_license_no:         '主管機關核准立案字號',
    org_registration_no:    '法人登記證字號',
    org_uniform_no:         '統一編號',
    org_address:            '登記住址',
    org_phone:              '聯絡電話',
    org_fax:                '傳真',
    org_line_qr_url:        'LINE 加入志工 QR 圖片路徑',
    elig_age_min:                  '【115 辦法】年齡下限',
    elig_age_max:                  '【115 辦法】年齡上限',
    elig_real_estate_max:          '【115 辦法】不動產上限（戶籍內直系合計）',
    elig_econ_deposit_max:         '【115 辦法-經濟弱勢】存款上限（夫妻取平均）',
    elig_econ_monthly_income_max:  '【115 辦法-經濟弱勢】月收入上限（夫妻取平均）',
};

const SETTING_UNIT: Record<string, string> = {
    pending_doc_alert_days: '天',
    pending_doc_notification_threshold: '次',
    board_auto_assign:      '',
    board_opinion_min_chars: '字',
    line_official_account_id: '',
    notification_dispatcher_enabled: '',
    org_full_name:          '',
    org_license_no:         '',
    org_registration_no:    '',
    org_uniform_no:         '',
    org_address:            '',
    org_phone:              '',
    org_fax:                '',
    org_line_qr_url:        '',
    elig_age_min:                  '歲',
    elig_age_max:                  '歲',
    elig_real_estate_max:          '萬',
    elig_econ_deposit_max:         '萬',
    elig_econ_monthly_income_max:  '萬',
};

// Input type per setting key — defaults to 'number' for legacy keys.
// 'boolean' renders a toggle switch; the value is stored as 'true' / 'false' string in DB.
const SETTING_INPUT_TYPE: Record<string, 'text' | 'number' | 'boolean'> = {
    pending_doc_alert_days: 'number',
    pending_doc_notification_threshold: 'number',
    board_auto_assign: 'boolean',        // stored as 'true' / 'false'
    board_opinion_min_chars: 'number',
    line_official_account_id: 'text',    // @xxxxxx
    notification_dispatcher_enabled: 'boolean',
    org_full_name:          'text',
    org_license_no:         'text',
    org_registration_no:    'text',
    org_uniform_no:         'text',
    org_address:            'text',
    org_phone:              'text',
    org_fax:                'text',
    org_line_qr_url:        'text',
    elig_age_min:                  'number',
    elig_age_max:                  'number',
    elig_real_estate_max:          'number',
    elig_econ_deposit_max:         'number',
    elig_econ_monthly_income_max:  'number',
};

const SETTING_HINT: Record<string, string> = {
    pending_doc_alert_days: '【天數警示】收件後超過此天數且仍有必備文件未上傳的案件，將於首頁顯示未補件提示',
    pending_doc_notification_threshold: '【次數提醒】同案件累計發送幾次未補件提醒 Email 後，於首頁與案件詳情頁提示承辦人考慮以不通過結案',
    board_auto_assign:      '填 true 或 false。開啟後，案件進入 board_review 階段時自動派給當前案件最少、優先序最小的組別',
    board_opinion_min_chars: '董事審核意見的最少字數限制；0 = 不限制（推進按鈕不再依字數鎖死、UI 不顯示字數提示）',
    line_official_account_id: 'LINE bot 的 @id（例：@123abcde）；使用者個人設定頁的「加好友」連結會用此值組成 https://line.me/R/ti/p/{@id}',
    notification_dispatcher_enabled: '全域通知派送總開關。關閉時所有事件觸發都不會推送，但事件仍會發生（不影響業務）。建議測試完所有事件 OK 後才開啟',
    org_full_name:          '基金會全名（顯示於核銷階段列印的領款收據 header）',
    org_license_no:         '主管機關核准立案字號（顯示於領款收據 header）',
    org_registration_no:    '法人登記證字號（顯示於領款收據 header）',
    org_uniform_no:         '統一編號（顯示於領款收據 header）',
    org_address:            '登記住址（顯示於領款收據 header）',
    org_phone:              '聯絡電話（顯示於領款收據 header）',
    org_fax:                '傳真（顯示於領款收據 header）',
    org_line_qr_url:        'LINE 加入志工 QR code 圖片路徑：可填相對路徑（如 /org-line-qr.png 對應 public/org-line-qr.png）或外部 URL；若檔案不存在領款收據會顯示空白方塊',
    elig_age_min:                  '【115 辦法第四條】申請人年齡下限',
    elig_age_max:                  '【115 辦法第四條】申請人年齡上限',
    elig_real_estate_max:          '【115 辦法】戶籍內直系親屬之土地公告現值＋房屋評定價合計上限',
    elig_econ_deposit_max:         '【115 辦法-經濟弱勢】存款上限（有配偶取夫妻平均）',
    elig_econ_monthly_income_max:  '【115 辦法-經濟弱勢】每月收入上限（有配偶取夫妻平均）',
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
        await ensureDefaultSettings();
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
                        const inputType = SETTING_INPUT_TYPE[setting.key] ?? 'number';
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
                                    {inputType === 'boolean' ? (
                                        // Toggle switch — stored as 'true' / 'false' string
                                        (() => {
                                            const currentVal = editValues[setting.key] ?? setting.value;
                                            const isOn = currentVal === 'true';
                                            return (
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={isOn}
                                                    onClick={() => setEditValues(prev => ({ ...prev, [setting.key]: isOn ? 'false' : 'true' }))}
                                                    className={`relative inline-flex items-center h-7 w-12 rounded-full transition-colors ${
                                                        isOn ? 'bg-blue-600' : 'bg-slate-300'
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block w-5 h-5 transform rounded-full bg-white shadow transition-transform ${
                                                            isOn ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                    />
                                                </button>
                                            );
                                        })()
                                    ) : (
                                        <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                                            <input
                                                type={inputType}
                                                {...(inputType === 'number' ? { min: 1 } : {})}
                                                className={inputType === 'number' ? 'w-20 text-sm text-slate-800 outline-none' : 'w-64 text-sm text-slate-800 outline-none'}
                                                value={editValues[setting.key] ?? setting.value}
                                                onChange={e => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                                                onKeyDown={e => e.key === 'Enter' && dirty && handleSave(setting.key)}
                                            />
                                            {unit && <span className="text-sm text-slate-500">{unit}</span>}
                                        </div>
                                    )}

                                    {inputType === 'boolean' && (
                                        <span className="text-sm text-slate-600">
                                            {(editValues[setting.key] ?? setting.value) === 'true' ? '已啟用' : '已停用'}
                                        </span>
                                    )}

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
                                    目前值：<span className="font-semibold text-slate-600">
                                        {inputType === 'boolean'
                                            ? (setting.value === 'true' ? '已啟用' : '已停用')
                                            : `${setting.value || '（未設定）'}${unit}`}
                                    </span>
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
