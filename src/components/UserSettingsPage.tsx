'use client';
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MessageSquare, Copy, Check, Unlink, ExternalLink, Bell, Save } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { useToast } from './FloatingToast';
import {
    fetchLineLinkStatus,
    generateLineLinkCode,
    unlinkLine,
} from '../app/actions/lineActions';
import { fetchSetting } from '../app/actions/settingsActions';
import {
    fetchUserNotificationChannels,
    updateUserNotificationChannels,
} from '../app/actions/userActions';

interface Props {
    userId: string;
    username: string;
    onBack: () => void;
    onLogout?: () => void;
}

interface LinkStatus {
    linked: boolean;
    lineUserIdSuffix: string | null;
    pendingCode: { code: string; expiresAt: string } | null;
}

export function UserSettingsPage({ userId, username, onBack, onLogout }: Props) {
    const { push: pushToast } = useToast();
    const [status, setStatus] = useState<LinkStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [botAtId, setBotAtId] = useState<string>('');
    const [now, setNow] = useState(Date.now());

    // Notification channel preferences
    const [channels, setChannels] = useState<Set<string>>(new Set(['email']));
    const [initialChannels, setInitialChannels] = useState<Set<string>>(new Set(['email']));
    const [channelsBusy, setChannelsBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const [res, atId, prefs] = await Promise.all([
            fetchLineLinkStatus(userId),
            fetchSetting('line_official_account_id', ''),
            fetchUserNotificationChannels(userId),
        ]);
        if (res.success && res.data) setStatus(res.data); else pushToast({ type: 'error', msg: res.error ?? '載入失敗' });
        setBotAtId(atId ?? '');
        if (prefs.success && prefs.data) {
            const set = new Set(prefs.data.channels);
            setChannels(set);
            setInitialChannels(new Set(set));
        }
        setLoading(false);
    }, [userId]);

    useEffect(() => { void load(); }, [load]);

    // Tick every second so the countdown updates
    useEffect(() => {
        if (!status?.pendingCode) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [status?.pendingCode]);

    async function handleGenerate() {
        setBusy(true);
        const res = await generateLineLinkCode(userId);
        setBusy(false);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '產生失敗' }); return; }
        await load();
    }

    async function handleUnlink() {
        if (!confirm('確定解除 LINE 綁定？解除後系統將無法透過 LINE 通知您。')) return;
        setBusy(true);
        const res = await unlinkLine(userId);
        setBusy(false);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '解除失敗' }); return; }
        await load();
    }

    function copyCode(code: string) {
        navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    function formatCountdown(expiresAt: string): string {
        const diffMs = new Date(expiresAt).getTime() - now;
        if (diffMs <= 0) return '已過期';
        const min = Math.floor(diffMs / 60000);
        const sec = Math.floor((diffMs % 60000) / 1000);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    }

    const addFriendUrl = botAtId
        ? `https://line.me/R/ti/p/${encodeURIComponent(botAtId)}`
        : null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            <AppHeader username={username} onGoHome={onBack} onLogout={onLogout} />

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 max-w-2xl space-y-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition font-medium"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回首頁
                </button>

                <h1 className="text-2xl font-bold text-slate-900">個人設定</h1>

                {/* LINE Binding */}
                <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                        <MessageSquare className="w-5 h-5 text-green-600" />
                        LINE 帳號綁定
                    </h2>

                    {loading || !status ? (
                        <p className="text-sm text-slate-400">載入中…</p>
                    ) : status.linked ? (
                        // ── State: linked
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-emerald-800">已綁定 LINE 帳號</p>
                                    <p className="text-xs text-emerald-700">
                                        綁定識別碼末 6 碼：<code className="font-mono px-1 bg-white rounded">…{status.lineUserIdSuffix}</code>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleUnlink}
                                disabled={busy}
                                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-50 cursor-pointer"
                            >
                                <Unlink className="w-4 h-4" />
                                解除綁定
                            </button>
                            <p className="text-[11px] text-slate-400">
                                解除後若要再接收 LINE 通知，需重新產生綁定碼並完成綁定流程。
                            </p>
                        </div>
                    ) : status.pendingCode ? (
                        // ── State: unlinked + pending code
                        <div className="space-y-4">
                            <div className="text-sm text-slate-700">請依以下步驟完成綁定：</div>

                            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <li>
                                    {addFriendUrl ? (
                                        <>
                                            <a
                                                href={addFriendUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 underline font-medium"
                                            >
                                                點此加 LINE bot 為好友 <ExternalLink className="w-3 h-3" />
                                            </a>
                                            <span className="text-xs text-slate-500 ml-1">（{botAtId}）</span>
                                        </>
                                    ) : (
                                        <span className="text-amber-700">請聯絡管理員設定 LINE 官方帳號 ID（系統設定 → line_official_account_id）</span>
                                    )}
                                </li>
                                <li>於 LINE 對 bot 傳送下方 6 位數字綁定碼</li>
                                <li>收到「綁定成功」訊息即完成</li>
                            </ol>

                            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 text-center space-y-2">
                                <p className="text-xs text-amber-700 uppercase tracking-wider font-semibold">綁定碼</p>
                                <div className="flex items-center justify-center gap-3">
                                    <code className="text-4xl font-mono font-bold text-amber-900 tracking-widest">
                                        {status.pendingCode.code}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={() => copyCode(status.pendingCode!.code)}
                                        className="p-2 text-amber-600 hover:bg-amber-100 rounded transition cursor-pointer"
                                        title="複製"
                                    >
                                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                </div>
                                <p className="text-xs text-amber-700">
                                    剩餘有效時間：<span className="font-mono font-semibold">{formatCountdown(status.pendingCode.expiresAt)}</span>
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={busy}
                                className="text-xs text-slate-500 hover:text-slate-700 underline transition disabled:opacity-50"
                            >
                                重新產生新碼（舊碼將失效）
                            </button>
                        </div>
                    ) : (
                        // ── State: unlinked, no pending code
                        <div className="space-y-3">
                            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <p>尚未綁定 LINE 帳號。</p>
                                <p className="text-xs text-slate-500 mt-1">綁定後可接收系統通知（例如：未派案、未審核、補件警示等）直接推到您的 LINE。</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={busy}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 cursor-pointer"
                            >
                                <MessageSquare className="w-4 h-4" />
                                產生綁定碼
                            </button>
                        </div>
                    )}
                </section>

                {/* Notification channel preferences */}
                <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                        <Bell className="w-5 h-5 text-amber-600" />
                        通知接收方式
                    </h2>
                    <p className="text-xs text-slate-500">
                        系統事件（例如案件進入董事審核、派組完成等）發生時會透過以下方式通知您。至少需選擇一個。
                    </p>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                            <input
                                type="checkbox"
                                checked={channels.has('email')}
                                onChange={e => {
                                    const next = new Set(channels);
                                    if (e.target.checked) next.add('email'); else next.delete('email');
                                    setChannels(next);
                                }}
                                className="w-4 h-4 accent-amber-600"
                            />
                            <span className="text-sm">Email</span>
                        </label>
                        <label
                            className={`flex items-center gap-2 p-2 rounded-lg ${status?.linked ? 'cursor-pointer hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'}`}
                            title={status?.linked ? undefined : '請先完成 LINE 帳號綁定'}
                        >
                            <input
                                type="checkbox"
                                checked={channels.has('line')}
                                disabled={!status?.linked}
                                onChange={e => {
                                    const next = new Set(channels);
                                    if (e.target.checked) next.add('line'); else next.delete('line');
                                    setChannels(next);
                                }}
                                className="w-4 h-4 accent-amber-600"
                            />
                            <span className="text-sm">LINE</span>
                            {!status?.linked && (
                                <span className="text-xs text-slate-400 ml-2">（請先完成 LINE 綁定）</span>
                            )}
                        </label>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            disabled={
                                channelsBusy ||
                                (Array.from(channels).sort().join(',') === Array.from(initialChannels).sort().join(','))
                            }
                            onClick={async () => {
                                if (channels.size < 1) {
                                    pushToast({ type: 'error', msg: '請至少選擇一個通知方式' });
                                    return;
                                }
                                setChannelsBusy(true);
                                const res = await updateUserNotificationChannels(userId, Array.from(channels));
                                setChannelsBusy(false);
                                if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '儲存失敗' }); return; }
                                setInitialChannels(new Set(channels));
                                pushToast({ type: 'success', msg: '已儲存' });
                            }}
                            className="inline-flex items-center gap-1 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition disabled:opacity-40 cursor-pointer"
                        >
                            <Save className="w-4 h-4" />
                            {channelsBusy ? '儲存中…' : '儲存'}
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}
