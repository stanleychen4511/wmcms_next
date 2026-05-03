'use client';

/**
 * 客戶端檔案上傳統一入口
 *
 * 優先：Vercel Blob 直接上傳（避開 Vercel function 4.5 MB payload 限制）
 *      browser → @vercel/blob/client.upload() → PUT to Blob → 拿到 URL
 *
 * Fallback（本地開發無 BLOB_READ_WRITE_TOKEN）：
 *      browser → POST /api/local-upload → server uploadFile() → 寫到 public/uploads/
 *
 * Mode 探測一次後 cache 在記憶體；不會每次上傳都打 storage-mode。
 *
 * 用法相同，呼叫端不必管 mode：
 *   const result = await uploadFileToBlob(file, {
 *     pathPrefix: 'intake/A123456789',
 *     onProgress: pct => ...,
 *   });
 */

import { upload } from '@vercel/blob/client';

export interface UploadedBlob {
    url: string;
    originalName: string;
    mimeType: string;
    size: number;
}

interface Options {
    /** 儲存路徑前綴，不要加首尾 slash。預設 'uploads' */
    pathPrefix?: string;
    /** 上傳進度回呼，0–100（local 模式只會回 0 與 100） */
    onProgress?: (percent: number) => void;
}

function sanitizeName(name: string): string {
    return name.replace(/[\/\\:*?"<>|\s]+/g, '_');
}

// ─── Mode probe（cache once） ────────────────────────────────────────────────

type StorageMode = 'blob' | 'local';
let _modeCache: Promise<StorageMode> | null = null;

async function detectMode(): Promise<StorageMode> {
    if (_modeCache) return _modeCache;
    _modeCache = (async () => {
        try {
            const res = await fetch('/api/storage-mode', { cache: 'force-cache' });
            if (!res.ok) return 'local';
            const json = await res.json();
            return json.mode === 'blob' ? 'blob' : 'local';
        } catch {
            return 'local';
        }
    })();
    return _modeCache;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function uploadFileToBlob(file: File, options: Options = {}): Promise<UploadedBlob> {
    const prefix = (options.pathPrefix ?? 'uploads').replace(/^\/+|\/+$/g, '');
    const safeName = sanitizeName(file.name);
    const mode = await detectMode();

    if (mode === 'blob') {
        // ── Production / 有 Blob token：直接 PUT 到 Vercel Blob ─────────
        const path = `${prefix}/${safeName}`;
        const blob = await upload(path, file, {
            access: 'public',
            handleUploadUrl: '/api/blob-upload-token',
            onUploadProgress: (progress) => {
                if (options.onProgress) options.onProgress(Math.round(progress.percentage));
            },
        });
        return {
            url: blob.url,
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
        };
    }

    // ── 本地 dev：fallback 經 server function 寫入 public/uploads/ ──────
    if (options.onProgress) options.onProgress(0);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('pathPrefix', prefix);
    const res = await fetch('/api/local-upload', { method: 'POST', body: fd });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as any));
        throw new Error(errBody?.error ?? `local upload failed (${res.status})`);
    }
    const json = await res.json();
    if (options.onProgress) options.onProgress(100);
    return {
        url: json.url,
        originalName: json.originalName ?? file.name,
        mimeType: json.mimeType ?? file.type ?? 'application/octet-stream',
        size: json.size ?? file.size,
    };
}
