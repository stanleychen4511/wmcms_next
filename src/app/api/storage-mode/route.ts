/**
 * 揭露當前 storage 模式給 client 用
 *
 * 回傳：{ mode: 'blob' | 'local' }
 *
 * 用途：client-side `uploadFileToBlob()` 在第一次呼叫前先 probe 一次，
 *      決定要走「直接 PUT 到 Vercel Blob」還是「fallback 經 server function」。
 *
 * 安全性：只回傳模式（boolean 等同），不洩漏任何 token。
 */

import { NextResponse } from 'next/server';

export async function GET() {
    const mode: 'blob' | 'local' = process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local';
    return NextResponse.json({ mode });
}
