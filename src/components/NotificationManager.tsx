'use client';
import { useState, useEffect, useCallback } from 'react';
import {
    Bell, Mail, MessageSquare, Smartphone,
    ToggleLeft, ToggleRight, Settings, Plus,
    Pencil, X, AlertTriangle, ChevronDown, ChevronUp,
    Eye, EyeOff, CalendarClock, Play, Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AppHeader } from './AppHeader';
import {
    NotificationChannel, NotificationTemplate, SmtpConfig,
    fetchChannels, updateChannelEnabled, saveSmtpConfig, loadSmtpConfig,
    fetchTemplates, addTemplate, updateTemplate, toggleTemplateStatus,
    fetchSchedules, saveSchedule, deleteSchedule, toggleScheduleActive, executeSchedule, NotificationSchedule,
} from '../app/actions/notificationActions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_META: Record<string, { label: string; icon: React.ReactNode; color: string; future?: boolean }> = {
    email: { label: 'Email', icon: <Mail className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
    line:  { label: 'LINE',  icon: <MessageSquare className="w-5 h-5" />, color: 'text-green-600 bg-green-50', future: true },
    sms:   { label: '簡訊 (SMS)', icon: <Smartphone className="w-5 h-5" />, color: 'text-purple-600 bg-purple-50', future: true },
};

const PLACEHOLDER_HINT = '可用佔位符：{{案號}} {{申請人}} {{階段}} {{申請日期}} {{申請金額}} {{承辦人}}';

// ─── SMTP Settings Form ───────────────────────────────────────────────────────

interface SmtpFormProps {
    userId: string;
    onSaved: () => void;
}

function SmtpForm({ userId, onSaved }: SmtpFormProps) {
    const [cfg, setCfg] = useState<SmtpConfig>({
        host: '', port: 587, secure: false,
        user: '', password: '',
        from_name: '', from_email: '',
    });
    const [showPw, setShowPw] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        loadSmtpConfig().then(res => {
            if (res.success && res.data) setCfg(res.data);
        });
    }, []);

    const handleSave = async () => {
        if (!cfg.host || !cfg.user || !cfg.from_email) {
            setError('請填寫 SMTP 主機、帳號與寄件地址。');
            return;
        }
        setSaving(true); setError(''); setSuccess(false);
        const res = await saveSmtpConfig(cfg);
        setSaving(false);
        if (res.success) { setSuccess(true); onSaved(); }
        else setError(res.error ?? '儲存失敗');
    };

    const field = (label: string, value: string, key: keyof SmtpConfig, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input
                type={type}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={value}
                placeholder={placeholder}
                onChange={e => setCfg(prev => ({ ...prev, [key]: e.target.value }))}
            />
        </div>
    );

    return (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-slate-400" />SMTP 設定
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {field('SMTP 主機', cfg.host, 'host', 'text', 'smtp.gmail.com')}
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">連接埠</label>
                    <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={cfg.port} onChange={e => setCfg(p => ({ ...p, port: Number(e.target.value) }))} />
                </div>
                {field('SMTP 帳號', cfg.user, 'user', 'text', 'example@gmail.com')}
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">SMTP 密碼</label>
                    <div className="relative">
                        <input type={showPw ? 'text' : 'password'}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={cfg.password}
                            onChange={e => setCfg(p => ({ ...p, password: e.target.value }))}
                            placeholder="留空表示不更新" />
                        <button type="button" onClick={() => setShowPw(v => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                {field('寄件人名稱', cfg.from_name, 'from_name', 'text', '萬美基金會')}
                {field('寄件地址', cfg.from_email, 'from_email', 'text', 'noreply@example.com')}
            </div>
            <div className="flex items-center gap-2">
                <input type="checkbox" id="secure" checked={cfg.secure}
                    onChange={e => setCfg(p => ({ ...p, secure: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600" />
                <label htmlFor="secure" className="text-sm text-slate-600">使用 SSL/TLS（port 465）</label>
            </div>
            {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}
            {success && <p className="text-xs text-green-600">✓ SMTP 設定已儲存</p>}
            <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? '儲存中…' : '儲存 SMTP 設定'}
            </button>
        </div>
    );
}

// ─── Template Modal ───────────────────────────────────────────────────────────

interface TplModalProps {
    mode: 'add' | 'edit';
    tpl?: NotificationTemplate;
    userId: string;
    onClose: () => void;
    onSaved: () => void;
}

function TemplateModal({ mode, tpl, userId, onClose, onSaved }: TplModalProps) {
    const [name, setName] = useState(tpl?.name ?? '');
    const [channel, setChannel] = useState(tpl?.channel ?? 'email');
    const [subject, setSubject] = useState(tpl?.subject ?? '');
    const [body, setBody] = useState(tpl?.body ?? '');
    const [description, setDescription] = useState(tpl?.description ?? '');
    const [sortOrder, setSortOrder] = useState(tpl?.sort_order ?? 1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!name.trim()) { setError('請填寫範本名稱'); return; }
        if (!body.trim()) { setError('請填寫內文'); return; }
        setSaving(true); setError('');
        const res = mode === 'add'
            ? await addTemplate(name, channel, subject || null, body, description || null, sortOrder, userId)
            : await updateTemplate(tpl!.id, name, channel, subject || null, body, description || null, sortOrder);
        setSaving(false);
        if (res.success) { onSaved(); onClose(); }
        else setError(res.error ?? '操作失敗');
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                    <h3 className="text-base font-bold text-slate-800">{mode === 'add' ? '新增範本' : '編輯範本'}</h3>
                    <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">範本名稱 <span className="text-red-500">*</span></label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={name} onChange={e => setName(e.target.value)} maxLength={255} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">渠道</label>
                            <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={channel} onChange={e => setChannel(e.target.value)}>
                                <option value="email">Email</option>
                                <option value="line">LINE（待開通）</option>
                                <option value="sms">簡訊（待開通）</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">主旨（Email 用）</label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={subject} onChange={e => setSubject(e.target.value)} placeholder="例：您的補助申請已進入下一階段" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">內文 <span className="text-red-500">*</span></label>
                        <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={6} value={body} onChange={e => setBody(e.target.value)} />
                        <p className="text-xs text-slate-400 mt-1">{PLACEHOLDER_HINT}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">排序</label>
                            <input type="number" min={1} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">備註</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={description} onChange={e => setDescription(e.target.value)} placeholder="選填" />
                        </div>
                    </div>
                    {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-slate-100 justify-end shrink-0">
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

// ─── Day of Week map ──────────────────────────────────────────────────────────

const DAY_OF_WEEK: Record<number, string> = {
    0: '週日', 1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六',
};

// ─── Schedule Form Modal ──────────────────────────────────────────────────────

interface ScheduleFormProps {
    schedule: Partial<NotificationSchedule> | null;
    templates: NotificationTemplate[];
    onClose: () => void;
    onSaved: () => void;
}

function ScheduleFormModal({ schedule, templates, onClose, onSaved }: ScheduleFormProps) {
    const [name, setName] = useState(schedule?.name ?? '');
    const [templateId, setTemplateId] = useState<number | null>(schedule?.template_id ?? null);
    const [missingDocDaysGt, setMissingDocDaysGt] = useState<number>(
        (schedule?.conditions as any)?.missing_doc_days_gt ?? 7
    );
    const [frequency, setFrequency] = useState(schedule?.frequency ?? 'weekly');
    const [dayOfWeek, setDayOfWeek] = useState<number>(schedule?.day_of_week ?? 1);
    const [isActive, setIsActive] = useState(schedule?.is_active ?? true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!name.trim()) { setError('請填寫排程名稱'); return; }
        setSaving(true); setError('');
        const res = await saveSchedule({
            id: schedule?.id,
            name,
            template_id: templateId,
            recipient_type: 'applicant',
            conditions: { missing_doc_days_gt: missingDocDaysGt },
            frequency,
            day_of_week: frequency === 'weekly' ? dayOfWeek : null,
            is_active: isActive,
        });
        setSaving(false);
        if (res.success) { onSaved(); onClose(); }
        else setError(res.error ?? '操作失敗');
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h3 className="text-base font-bold text-slate-800">
                        {schedule?.id ? '編輯排程' : '新增排程'}
                    </h3>
                    <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">排程名稱 <span className="text-red-500">*</span></label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={name} onChange={e => setName(e.target.value)} maxLength={255} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">使用範本</label>
                        <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={templateId ?? ''} onChange={e => setTemplateId(e.target.value ? Number(e.target.value) : null)}>
                            <option value="">— 不選擇 —</option>
                            {templates.filter(t => t.status === 1).map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">條件：缺件超過</label>
                        <div className="flex items-center gap-2">
                            <input type="number" min={0} className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={missingDocDaysGt} onChange={e => setMissingDocDaysGt(Number(e.target.value))} />
                            <span className="text-sm text-slate-600">天</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">頻率</label>
                            <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={frequency} onChange={e => setFrequency(e.target.value)}>
                                <option value="weekly">每週</option>
                                <option value="daily">每日</option>
                            </select>
                        </div>
                        {frequency === 'weekly' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">發送星期</label>
                                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}>
                                    {Object.entries(DAY_OF_WEEK).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="scheduleActive" checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="w-4 h-4 accent-blue-600" />
                        <label htmlFor="scheduleActive" className="text-sm text-slate-600">立即啟用</label>
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

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'channels' | 'templates' | 'schedules';

interface NotificationManagerProps {
    userId: string;
    onBack: () => void;
    username?: string;
    onLogout?: () => void;
}

export function NotificationManager({ userId, onBack, username, onLogout }: NotificationManagerProps) {
    const [activeTab, setActiveTab] = useState<Tab>('channels');
    const [channels, setChannels] = useState<NotificationChannel[]>([]);
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedEmail, setExpandedEmail] = useState(false);
    const [tplModal, setTplModal] = useState<{ mode: 'add' | 'edit'; tpl?: NotificationTemplate } | null>(null);
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Partial<NotificationSchedule> | null>(null);
    const [scheduleExecuting, setScheduleExecuting] = useState<number | null>(null);
    const [actionError, setActionError] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        const [chRes, tplRes, schRes] = await Promise.all([fetchChannels(), fetchTemplates(), fetchSchedules()]);
        if (chRes.success && chRes.data) setChannels(chRes.data);
        if (tplRes.success && tplRes.data) setTemplates(tplRes.data);
        if (schRes.success && schRes.data) setSchedules(schRes.data);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleToggleChannel = async (ch: NotificationChannel) => {
        if ((ch.channel === 'line' || ch.channel === 'sms') && !ch.is_enabled) {
            alert('此渠道尚未開通，請等待後續整合。');
            return;
        }
        setActionError('');
        const res = await updateChannelEnabled(ch.channel, !ch.is_enabled);
        if (!res.success) setActionError(res.error ?? '操作失敗');
        else await loadData();
    };

    const handleToggleTemplate = async (tpl: NotificationTemplate) => {
        const res = await toggleTemplateStatus(tpl.id, tpl.status === 1 ? 0 : 1);
        if (!res.success) setActionError(res.error ?? '操作失敗');
        else await loadData();
    };

    const handleToggleSchedule = async (sch: NotificationSchedule) => {
        const res = await toggleScheduleActive(sch.id, !sch.is_active);
        if (!res.success) setActionError(res.error ?? '操作失敗');
        else await loadData();
    };

    const handleDeleteSchedule = async (id: number) => {
        if (!confirm('確定刪除此排程？')) return;
        const res = await deleteSchedule(id);
        if (!res.success) setActionError(res.error ?? '刪除失敗');
        else await loadData();
    };

    const handleExecuteSchedule = async (id: number) => {
        setScheduleExecuting(id);
        const res = await executeSchedule(id, 'manual');
        setScheduleExecuting(null);
        if (res.success) {
            alert(`執行完成：成功 ${res.sent} 封，失敗 ${res.failed} 封。`);
            await loadData();
        } else {
            alert(`執行失敗：${res.error}`);
        }
    };

    const emailChannel = channels.find(c => c.channel === 'email');

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            <AppHeader username={username} onGoHome={onBack} onLogout={onLogout} />

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 max-w-4xl">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Bell className="w-6 h-6 text-blue-600" />
                        通知管理
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">設定通知渠道及管理通知範本</p>
                </div>

                {actionError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <AlertTriangle className="w-4 h-4 shrink-0" />{actionError}
                        <button onClick={() => setActionError('')} className="ml-auto"><X className="w-4 h-4" /></button>
                    </div>
                )}

                {/* ── Tab navigation ── */}
                <div className="flex gap-1 border-b border-slate-200">
                    {([
                        { key: 'channels', label: '渠道設定' },
                        { key: 'templates', label: '通知範本' },
                        { key: 'schedules', label: '批次發送排程' },
                    ] as { key: Tab; label: string }[]).map(tab => (
                        <button key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={clsx(
                                'px-4 py-2.5 text-sm font-medium rounded-t-lg transition -mb-px border-b-2',
                                activeTab === tab.key
                                    ? 'border-blue-600 text-blue-600 bg-white'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            )}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Channel settings ── */}
                {activeTab === 'channels' && (
                    <section className="space-y-3">
                        {loading ? (
                            <p className="text-sm text-slate-400">載入中…</p>
                        ) : channels.map(ch => {
                            const meta = CHANNEL_META[ch.channel];
                            if (!meta) return null;
                            const isEmail = ch.channel === 'email';
                            return (
                                <div key={ch.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="flex items-center gap-4 px-5 py-4">
                                        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', meta.color)}>
                                            {meta.icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-800">{meta.label}</span>
                                                {meta.future && (
                                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">待開通</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {ch.is_enabled ? '已啟用' : '已停用'}
                                            </p>
                                        </div>
                                        <button onClick={() => handleToggleChannel(ch)}
                                            className={clsx('p-1 rounded-lg transition',
                                                ch.is_enabled
                                                    ? 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                                                    : 'text-slate-400 hover:bg-green-50 hover:text-green-600'
                                            )}>
                                            {ch.is_enabled
                                                ? <ToggleRight className="w-6 h-6" />
                                                : <ToggleLeft className="w-6 h-6" />}
                                        </button>
                                        {isEmail && (
                                            <button onClick={() => setExpandedEmail(v => !v)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition ml-1">
                                                {expandedEmail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                    {isEmail && expandedEmail && (
                                        <div className="px-5 pb-5">
                                            <SmtpForm userId={userId} onSaved={loadData} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </section>
                )}

                {/* ── Template management ── */}
                {activeTab === 'templates' && (
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">通知範本</h3>
                            <button onClick={() => setTplModal({ mode: 'add' })}
                                className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                                <Plus className="w-4 h-4" />新增範本
                            </button>
                        </div>

                        {loading ? (
                            <p className="text-sm text-slate-400">載入中…</p>
                        ) : templates.length === 0 ? (
                            <p className="text-center text-sm text-slate-400 py-8">尚無範本，請點擊「新增範本」。</p>
                        ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">範本名稱</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">渠道</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">主旨</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">排序</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">狀態</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">編輯</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">啟/停用</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {templates.map(tpl => (
                                            <tr key={tpl.id} className={clsx(
                                                'border-b border-slate-100 hover:bg-slate-50 transition-colors',
                                                tpl.status === 0 && 'opacity-50'
                                            )}>
                                                <td className="py-3 px-4 text-sm font-medium text-slate-800">{tpl.name}</td>
                                                <td className="py-3 px-4 text-xs text-slate-500">{CHANNEL_META[tpl.channel]?.label ?? tpl.channel}</td>
                                                <td className="py-3 px-4 text-xs text-slate-500 max-w-[200px] truncate">{tpl.subject ?? '—'}</td>
                                                <td className="py-3 px-4 text-xs text-slate-500">{tpl.sort_order}</td>
                                                <td className="py-3 px-4">
                                                    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                                        tpl.status === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                                                        {tpl.status === 1 ? '啟用' : '停用'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button onClick={() => setTplModal({ mode: 'edit', tpl })}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button onClick={() => handleToggleTemplate(tpl)}
                                                        className={clsx('p-1.5 rounded-lg transition',
                                                            tpl.status === 1
                                                                ? 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                                                                : 'text-slate-400 hover:bg-green-50 hover:text-green-600')}>
                                                        {tpl.status === 1 ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {/* ── Schedule management ── */}
                {activeTab === 'schedules' && (
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">批次發送排程</h3>
                                <p className="text-xs text-slate-400 mt-0.5">每日 00:00 UTC 自動執行符合條件的排程</p>
                            </div>
                            <button onClick={() => { setEditingSchedule(null); setShowScheduleForm(true); }}
                                className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                                <Plus className="w-4 h-4" />新增排程
                            </button>
                        </div>

                        {loading ? (
                            <p className="text-sm text-slate-400">載入中…</p>
                        ) : schedules.length === 0 ? (
                            <p className="text-center text-sm text-slate-400 py-8">尚無排程，請點擊「新增排程」。</p>
                        ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">排程名稱</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">範本</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">條件</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">頻率</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">上次發送</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">狀態</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {schedules.map(sch => (
                                            <tr key={sch.id} className={clsx(
                                                'border-b border-slate-100 hover:bg-slate-50 transition-colors',
                                                !sch.is_active && 'opacity-50'
                                            )}>
                                                <td className="py-3 px-4 text-sm font-medium text-slate-800">{sch.name}</td>
                                                <td className="py-3 px-4 text-xs text-slate-500">{sch.template_name ?? '—'}</td>
                                                <td className="py-3 px-4 text-xs text-slate-500">
                                                    缺件 &gt; {(sch.conditions as any)?.missing_doc_days_gt ?? 0} 天
                                                </td>
                                                <td className="py-3 px-4 text-xs text-slate-500">
                                                    {sch.frequency === 'daily' ? '每日' : `每週 ${DAY_OF_WEEK[sch.day_of_week ?? 1]}`}
                                                </td>
                                                <td className="py-3 px-4 text-xs text-slate-500">
                                                    {sch.last_sent_at
                                                        ? new Date(sch.last_sent_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
                                                        : '—'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button onClick={() => handleToggleSchedule(sch)}
                                                        className={clsx('p-1.5 rounded-lg transition',
                                                            sch.is_active
                                                                ? 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                                                                : 'text-slate-400 hover:bg-green-50 hover:text-green-600')}>
                                                        {sch.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                                    </button>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => { setEditingSchedule(sch); setShowScheduleForm(true); }}
                                                            className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                                                            title="編輯">
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleExecuteSchedule(sch.id)}
                                                            disabled={scheduleExecuting === sch.id}
                                                            className="p-1.5 rounded-lg text-slate-500 hover:bg-green-50 hover:text-green-600 transition disabled:opacity-40"
                                                            title="立即執行">
                                                            {scheduleExecuting === sch.id
                                                                ? <CalendarClock className="w-4 h-4 animate-pulse" />
                                                                : <Play className="w-4 h-4" />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSchedule(sch.id)}
                                                            className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                                                            title="刪除">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}
            </main>

            {tplModal && (
                <TemplateModal
                    mode={tplModal.mode}
                    tpl={tplModal.tpl}
                    userId={userId}
                    onClose={() => setTplModal(null)}
                    onSaved={loadData}
                />
            )}

            {showScheduleForm && (
                <ScheduleFormModal
                    schedule={editingSchedule}
                    templates={templates}
                    onClose={() => { setShowScheduleForm(false); setEditingSchedule(null); }}
                    onSaved={loadData}
                />
            )}
        </div>
    );
}
