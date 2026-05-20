/**
 * 客戶端版本檢測端點
 *
 * 用途：client 開啟頁面時 + 定時 ping 此 API；若伺服器回的 version 跟 client cache
 *      不同 → 自動 hard reload 拉新 bundle。
 *
 * version 來源：
 *   - production：Vercel 注入的 `VERCEL_GIT_COMMIT_SHA`（每次 deploy 自動換）
 *   - 本地 dev：build timestamp（每次重啟 dev server 換）
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 模組級常數 — server 啟動時計算一次，整個 process 共用
const APP_VERSION =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
    ?? process.env.NEXT_PUBLIC_BUILD_ID
    ?? String(Date.now());

export async function GET() {
    return NextResponse.json(
        { version: APP_VERSION },
        {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
            },
        }
    );
}
