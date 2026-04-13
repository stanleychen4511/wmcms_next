import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { getTemplateFileById } from '../../../actions/templateActions';
import { writeAuditLog } from '../../../actions/auditActions';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
        return new NextResponse('Invalid id', { status: 400 });
    }

    const userId = req.nextUrl.searchParams.get('userId') || null;

    const result = await getTemplateFileById(id);
    if (!result.success || !result.data) {
        return new NextResponse('Not found', { status: 404 });
    }

    const file = result.data;
    if (file.status !== 1) {
        return new NextResponse('File is not available', { status: 403 });
    }

    void writeAuditLog({
        userId,
        action: 'template.download',
        targetType: 'template',
        targetId: String(id),
        detail: { display_name: file.display_name, original_name: file.original_name },
    });

    const encodedName = encodeURIComponent(file.original_name).replace(/'/g, '%27');

    // ── Vercel Blob：DB 儲存完整 https URL，直接 redirect ───────────────────────
    if (file.file_path.startsWith('https://')) {
        return NextResponse.redirect(file.file_path, {
            headers: {
                'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
            },
        });
    }

    // ── 本地開發：從 public/ 讀取 ───────────────────────────────────────────────
    if (!/^\/uploads\/templates\/[^/]+$/.test(file.file_path)) {
        return new NextResponse('Invalid file path', { status: 400 });
    }

    const absolutePath = path.join(process.cwd(), 'public', file.file_path);

    try {
        const buffer = await fs.readFile(absolutePath);
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': file.mime_type,
                'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
                'Content-Length': String(buffer.length),
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        console.error('template-download read error:', err);
        return new NextResponse('File not found on disk', { status: 404 });
    }
}
