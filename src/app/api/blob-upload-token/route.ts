/**
 * 客戶端直接上傳到 Vercel Blob 的簽章 endpoint
 *
 * 用途：跳過 server function（受 4.5 MB 限制），讓 browser 直接 PUT 到 Blob。
 *      這個 route 只負責簽發 short-lived signed token + 限制 mime/size。
 *
 * 用 @vercel/blob/client 的 `upload()` 在 client 呼叫此 endpoint：
 *
 *   import { upload } from '@vercel/blob/client';
 *   const blob = await upload(filename, file, {
 *     access: 'public',
 *     handleUploadUrl: '/api/blob-upload-token',
 *   });
 *
 * 安全性：
 *   - 外部收件流程沒有登入概念，不檢查 user
 *   - 但限制 content-type（白名單）+ size（30 MB / 檔）
 *   - addRandomSuffix 防檔名衝突 / 防覆蓋他人檔案
 */

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_MIME = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
];

const MAX_BYTES = 30 * 1024 * 1024; // 30 MB / 檔

export async function POST(request: NextRequest): Promise<NextResponse> {
    let body: HandleUploadBody;
    try {
        body = (await request.json()) as HandleUploadBody;
    } catch {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    try {
        const json = await handleUpload({
            request,
            body,
            onBeforeGenerateToken: async (pathname, _clientPayload) => {
                // pathname = client 自訂的儲存路徑
                return {
                    allowedContentTypes: ALLOWED_MIME,
                    addRandomSuffix: true,
                    maximumSizeInBytes: MAX_BYTES,
                    tokenPayload: JSON.stringify({ pathname }),
                };
            },
            onUploadCompleted: async ({ blob }) => {
                // webhook：上傳完成（生產環境會收到）；此處僅記 log，DB 寫入由表單送出時處理
                console.log('[blob-upload] completed:', blob.url, blob.contentType, blob.contentDisposition);
            },
        });
        return NextResponse.json(json);
    } catch (err: any) {
        console.error('[blob-upload-token] error:', err);
        return NextResponse.json(
            { error: err?.message ?? 'upload token generation failed' },
            { status: 400 },
        );
    }
}
