import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const ALLOWED_EXTS: Record<string, string> = {
    '.pdf':  'application/pdf',
    '.doc':  'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function GET(req: NextRequest) {
    const filePath = req.nextUrl.searchParams.get('path');

    // Validate: must start with /uploads/ and contain no path traversal
    if (!filePath || !/^\/uploads\/\d+\/[^/]+$/.test(filePath)) {
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
                // inline = display in browser, not download
                'Content-Disposition': 'inline',
                // Prevent caching of sensitive files
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                // Only allow framing from same origin
                'X-Frame-Options': 'SAMEORIGIN',
                // Prevent MIME sniffing
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch {
        return new NextResponse('File not found', { status: 404 });
    }
}
