import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const ALLOWED_EXTS: Record<string, string> = {
    '.pdf':  'application/pdf',
    '.doc':  'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // 圖片 — 行政初審 / 撥款流程的紙本掃描常用
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
};

export async function GET(req: NextRequest) {
    const filePath = req.nextUrl.searchParams.get('path');
    if (!filePath) return new NextResponse('Invalid path', { status: 400 });

    // ── Vercel Blob：DB 儲存的是完整 https URL，直接 redirect ─────────────────
    if (filePath.startsWith('https://')) {
        return NextResponse.redirect(filePath);
    }

    // ── 本地開發：相對路徑，從 public/ 讀取 ────────────────────────────────────
    // 允許子目錄（撥款上傳會放在 /uploads/{appId}/disb{disbId}/...）；
    // 嚴禁 .. 與絕對路徑跳脫，否則 400
    if (!/^\/(uploads|intake)\//.test(filePath) || filePath.includes('..')) {
        return new NextResponse('Invalid path', { status: 400 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ALLOWED_EXTS[ext];
    if (!mimeType) {
        return new NextResponse('Unsupported file type', { status: 415 });
    }

    const absolutePath = path.join(process.cwd(), 'public', filePath);

    try {
        const buffer = await fs.readFile(absolutePath);
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': 'inline',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'X-Frame-Options': 'SAMEORIGIN',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch {
        return new NextResponse('File not found', { status: 404 });
    }
}
