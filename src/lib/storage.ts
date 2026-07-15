/**
 * Storage abstraction layer
 *
 * - 有 BLOB_READ_WRITE_TOKEN → 使用 Vercel Blob（Production / Vercel 環境）
 * - 無 token → 寫入本地 public/uploads/（本地開發）
 *
 * DB 統一儲存 uploadFile() 回傳的 publicUrl：
 *   - 本地："/uploads/..."（相對路徑）
 *   - Blob： "https://xxxx.public.blob.vercel-storage.com/..."（絕對路徑）
 */

import path from 'path';
import { promises as fs } from 'fs';

export const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Upload a file buffer.
 * @param buffer      檔案內容
 * @param blobKey     Blob 儲存路徑，e.g. "uploads/123/A115001_xxx.pdf"
 * @param localRelPath 本地相對路徑（含前置 /），e.g. "/uploads/123/A115001_xxx.pdf"
 * @returns 可存入 DB 的 public URL（本地為相對路徑，Blob 為絕對 https URL）
 */
export async function uploadFile(
    buffer: Buffer,
    blobKey: string,
    localRelPath: string
): Promise<string> {
    if (USE_BLOB) {
        const { put } = await import('@vercel/blob');
        // @vercel/blob 1.x 起不再預設加隨機 suffix；明確保留舊版行為，避免同名檔案衝突。
        const { url } = await put(blobKey, buffer, { access: 'public', addRandomSuffix: true });
        return url;
    }

    // Local: write to public/
    const absDir = path.join(process.cwd(), 'public', path.dirname(localRelPath));
    await fs.mkdir(absDir, { recursive: true });
    await fs.writeFile(path.join(process.cwd(), 'public', localRelPath), buffer);
    return localRelPath;
}

/**
 * Delete a file by its stored public URL.
 * 本地：刪除磁碟檔案；Blob：呼叫 del()
 */
export async function deleteFile(publicUrl: string): Promise<void> {
    await deleteFiles([publicUrl]);
}

export async function deleteFiles(publicUrls: readonly string[]): Promise<void> {
    const blobTargets = publicUrls.filter(publicUrl => USE_BLOB || publicUrl.startsWith('https://'));
    const localTargets = publicUrls.filter(publicUrl => !USE_BLOB && !publicUrl.startsWith('https://'));
    await Promise.all([
        blobTargets.length > 0
            ? import('@vercel/blob').then(({ del }) => del([...blobTargets])).catch(() => {})
            : Promise.resolve(),
        ...localTargets.map(publicUrl => {
            const absPath = path.join(process.cwd(), 'public', publicUrl);
            return fs.unlink(absPath).catch(() => {});
        }),
    ]);
}

/**
 * Read a file by its stored public URL.
 * Blob URL 直接 fetch；本地路徑從磁碟讀取。
 */
export async function readFile(publicUrl: string): Promise<Buffer> {
    if (publicUrl.startsWith('https://')) {
        const res = await fetch(publicUrl);
        if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
    }
    // Local
    const absPath = path.join(process.cwd(), 'public', publicUrl);
    return fs.readFile(absPath);
}
