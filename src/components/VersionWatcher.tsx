'use client';

/**
 * 版本檢測元件 — mount 在最外層 layout，永遠執行。
 *
 * 邏輯：
 *   1. 首次載入 → 抓 `/api/app-version`，存 sessionStorage
 *   2. 之後每 60 秒 + 視窗 focus 時再抓一次
 *   3. 發現 version 跟 sessionStorage 不同 → 主動清掉 caches + 強制 reload
 *
 * 注意：這只能讓「使用者下次操作時」自動更新；無法在「現在這次操作」中途插隊。
 *      所以對使用者體驗的衝擊是：他們會看到頁面突然刷新一次，但不會看到一堆怪錯誤。
 */

import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'wmcms_app_version';
const CHECK_INTERVAL_MS = 60 * 1000;  // 每 60 秒檢查一次

async function fetchCurrentVersion(): Promise<string | null> {
    try {
        const res = await fetch('/api/app-version', { cache: 'no-store' });
        if (!res.ok) return null;
        const json = await res.json();
        return typeof json?.version === 'string' ? json.version : null;
    } catch {
        return null;
    }
}

async function clearAllClientCaches(): Promise<void> {
    // 清 Cache API（PWA / service worker 快取）
    if ('caches' in window) {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        } catch { /* swallow */ }
    }
    // 解除註冊所有 service worker
    if ('serviceWorker' in navigator) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        } catch { /* swallow */ }
    }
    // 不清 localStorage / cookies — 那些通常包含登入態，不該清
}

function reloadWithCacheBust(): void {
    // 加 timestamp query 強制瀏覽器重新解析 HTML（HTML 本身的 cache 也會跳過）
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
}

export function VersionWatcher() {
    const initialized = useRef(false);

    useEffect(() => {
        // StrictMode 重 run 防呆 — 但實際生效一次
        if (initialized.current) return;
        initialized.current = true;

        let cancelled = false;

        const check = async () => {
            const current = await fetchCurrentVersion();
            if (cancelled || !current) return;

            const cached = sessionStorage.getItem(STORAGE_KEY);
            if (!cached) {
                // 首次：只記錄，不 reload
                sessionStorage.setItem(STORAGE_KEY, current);
                return;
            }
            if (cached !== current) {
                // 版本不同 → 清快取 + 重整
                console.info('[version] outdated client detected, reloading...', { cached, current });
                sessionStorage.setItem(STORAGE_KEY, current);
                await clearAllClientCaches();
                reloadWithCacheBust();
            }
        };

        // 立刻檢查一次
        void check();

        // 定時檢查
        const interval = setInterval(check, CHECK_INTERVAL_MS);

        // 視窗重新獲得 focus 時也檢查（使用者切回分頁即更新）
        const onFocus = () => void check();
        window.addEventListener('focus', onFocus);

        return () => {
            cancelled = true;
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, []);

    return null;
}
