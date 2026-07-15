/**
 * 本地開發用的檔案上傳 fallback
 *
 * 只在 **沒有 BLOB_READ_WRITE_TOKEN** 時使用（= 本地 dev 環境）。
 * 把檔案存到 public/uploads/，回傳相對路徑（與 lib/storage.ts uploadFile() 同行為）。
 *
 * Production（有 BLOB token）情境下，client 會直接 PUT 到 Vercel Blob，
 * 完全不會打到這個 route。
 *
 * 副作用：這個 route 也吃 Vercel function payload 4.5 MB 上限；
 *        所以只用在本地，正式環境若誤開啟會跟原本一樣卡住。
 */

import { NextRequest, NextResponse } from 'next/server';
import { USE_BLOB, uploadFile } from '../../../lib/storage';

const ALLOWED_MIME = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
];
const MAX_BYTES = 30 * 1024 * 1024;

function sanitizeName(name: string): string {
    return name.replace(/[\/\\:*?"<>|\s]+/g, '_');
}

export async function POST(req: NextRequest) {
    // 防呆：production 有 Blob token 時不應該打到這個 route
    if (USE_BLOB) {
        return NextResponse.json(
            { error: 'production environment uses Vercel Blob; use /api/blob-upload-token instead' },
            { status: 400 },
        );
    }

    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const pathPrefix = ((fd.get('pathPrefix') as string | null) ?? 'uploads').replace(/^\/+|\/+$/g, '');
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });
    if (!ALLOWED_MIME.includes(file.type)) {
        return NextResponse.json({ error: 'unsupported file type' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'file too large' }, { status: 413 });
    }

    try {
        const safeName = sanitizeName(file.name);
        const key = `${pathPrefix}/${Date.now()}_${safeName}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const publicUrl = await uploadFile(buffer, key, '/' + key);
        return NextResponse.json({
            url: publicUrl,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
        });
    } catch (err: any) {
        console.error('[local-upload] error:', err);
        return NextResponse.json({ error: err?.message ?? 'upload failed' }, { status: 500 });
    }
}
