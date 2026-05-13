/**
 * 即時讀取單一 system_setting 的 GET endpoint
 *
 * 為什麼不直接用 Server Action？
 *   Next.js dev 環境下 Server Action 結果有時會被 React Server Components / browser
 *   cache 層 keep 住，導致改了設定 F5 仍看到舊值。這個 route 明確 no-store + GET，
 *   每次 client fetch 都直接打 DB。
 *
 * 用法：GET /api/setting-value?key=board_opinion_min_chars
 *   → { value: '100' } 或 { value: null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '../../../lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    const key = req.nextUrl.searchParams.get('key');
    if (!key) {
        return NextResponse.json({ error: 'missing key' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT value FROM system_settings WHERE key = $1 LIMIT 1`,
            [key]
        );
        const value = res.rows.length > 0 ? res.rows[0].value : null;
        return NextResponse.json({ value }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
            },
        });
    } catch (err: any) {
        console.error('[setting-value] error:', err);
        return NextResponse.json({ error: err?.message ?? 'query failed' }, { status: 500 });
    } finally {
        client.release();
    }
}
