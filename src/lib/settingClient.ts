'use client';

/**
 * Client-side helper：用 GET + no-store 抓 system_setting 值
 *
 * 為什麼不用 fetchSetting Server Action？
 *   Server Action 在 Next.js 14+ dev 環境下偶爾會被 RSC / browser cache keep 住，
 *   即使按 F5 也可能看到舊值。改用標準 GET API + 'cache: no-store' 強制每次都打 DB。
 *
 * 用法：
 *   const v = await fetchSettingFresh('board_opinion_min_chars', '50');
 */

export async function fetchSettingFresh(key: string, defaultValue: string = ''): Promise<string> {
    try {
        const res = await fetch(`/api/setting-value?key=${encodeURIComponent(key)}`, {
            cache: 'no-store',
            // Next.js 14+ 同時需要這個 hint 才完全繞過 RSC cache 層
            next: { revalidate: 0 },
        });
        if (!res.ok) return defaultValue;
        const body = await res.json();
        return body?.value ?? defaultValue;
    } catch {
        return defaultValue;
    }
}
