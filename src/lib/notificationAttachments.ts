export const NOTIFICATION_ATTACHMENT_ACCEPT = [
    '.pdf',
    '.doc', '.docx',
    '.xls', '.xlsx',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
].join(',');

export const MAX_NOTIFICATION_ATTACHMENT_BYTES = 18 * 1024 * 1024;
export const NOTIFICATION_ATTACHMENT_CONCURRENCY = 6;

export async function mapNotificationAttachmentsConcurrently<T, R>(
    items: readonly T[],
    mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    let stopped = false;
    let firstError: unknown;

    const worker = async () => {
        while (!stopped) {
            const index = nextIndex++;
            if (index >= items.length) return;
            try {
                results[index] = await mapper(items[index], index);
            } catch (error) {
                if (!stopped) {
                    stopped = true;
                    firstError = error;
                }
            }
        }
    };

    await Promise.all(Array.from(
        { length: Math.min(NOTIFICATION_ATTACHMENT_CONCURRENCY, items.length) },
        worker,
    ));
    if (stopped) throw firstError;
    return results;
}

type AttachmentMetadata = {
    name: string;
    type: string;
    size: number;
};

type FileKind = {
    mimeTypes: readonly string[];
    contentType: string;
    matches: (bytes: Uint8Array) => boolean;
};

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
    signature.every((value, index) => bytes[offset + index] === value);

const isPdf = (bytes: Uint8Array) => {
    const header = new TextDecoder('ascii').decode(bytes.slice(0, 1024));
    return header.includes('%PDF-');
};
const isCompoundOffice = (bytes: Uint8Array) =>
    startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const isZipOffice = (bytes: Uint8Array) =>
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
    || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])
    || startsWith(bytes, [0x50, 0x4b, 0x07, 0x08]);

const FILE_KINDS: Record<string, FileKind> = {
    pdf: {
        mimeTypes: ['application/pdf'],
        contentType: 'application/pdf',
        matches: isPdf,
    },
    doc: {
        mimeTypes: ['application/msword'],
        contentType: 'application/msword',
        matches: isCompoundOffice,
    },
    docx: {
        mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        matches: isZipOffice,
    },
    xls: {
        mimeTypes: ['application/vnd.ms-excel'],
        contentType: 'application/vnd.ms-excel',
        matches: isCompoundOffice,
    },
    xlsx: {
        mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        matches: isZipOffice,
    },
    jpg: {
        mimeTypes: ['image/jpeg'],
        contentType: 'image/jpeg',
        matches: bytes => startsWith(bytes, [0xff, 0xd8, 0xff]),
    },
    jpeg: {
        mimeTypes: ['image/jpeg'],
        contentType: 'image/jpeg',
        matches: bytes => startsWith(bytes, [0xff, 0xd8, 0xff]),
    },
    png: {
        mimeTypes: ['image/png'],
        contentType: 'image/png',
        matches: bytes => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    },
    gif: {
        mimeTypes: ['image/gif'],
        contentType: 'image/gif',
        matches: bytes => startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
            || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
    },
    webp: {
        mimeTypes: ['image/webp'],
        contentType: 'image/webp',
        matches: bytes => startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
            && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8),
    },
    bmp: {
        mimeTypes: ['image/bmp'],
        contentType: 'image/bmp',
        matches: bytes => startsWith(bytes, [0x42, 0x4d]),
    },
};

function extensionOf(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase();
}

export function validateNotificationAttachments(files: readonly AttachmentMetadata[]): string | null {
    let totalBytes = 0;
    for (const file of files) {
        if (!file.name || file.name.length > 200 || /[\/\\\r\n\0]/.test(file.name)) {
            return '附件檔名無效或過長';
        }
        const kind = FILE_KINDS[extensionOf(file.name)];
        if (!kind) {
            return `${file.name}：僅支援 PDF、Word、Excel 與圖片檔`;
        }
        if (!Number.isFinite(file.size) || file.size <= 0) return `${file.name}：檔案大小無效`;
        totalBytes += file.size;
        if (totalBytes > MAX_NOTIFICATION_ATTACHMENT_BYTES) {
            return '附件合計不可超過 18 MB';
        }
        if (file.type && file.type !== 'application/octet-stream' && !kind.mimeTypes.includes(file.type)) {
            return `${file.name}：副檔名與檔案格式不符`;
        }
    }
    return null;
}

export function isNotificationAttachmentUrlFor(
    value: string,
    applicationId: string,
    disbursementId: string,
): boolean {
    const expectedPrefix = `/notification-attachments/${applicationId}/${disbursementId}/`;
    return isNotificationAttachmentUrlWithPrefix(value, expectedPrefix);
}

export function isManualNotificationAttachmentUrlFor(
    value: string,
    applicationId: string,
): boolean {
    const expectedPrefix = `/notification-attachments/${applicationId}/manual/`;
    return isNotificationAttachmentUrlWithPrefix(value, expectedPrefix);
}

function isNotificationAttachmentUrlWithPrefix(value: string, expectedPrefix: string): boolean {
    const hasExpectedPath = (pathname: string) => {
        let decoded: string;
        try {
            decoded = decodeURIComponent(pathname);
        } catch {
            return false;
        }
        return !decoded.split('/').includes('..') && decoded.startsWith(expectedPrefix);
    };

    if (value.startsWith('/')) return hasExpectedPath(value);
    try {
        const url = new URL(value);
        return url.protocol === 'https:'
            && (url.hostname.endsWith('.public.blob.vercel-storage.com')
                || url.hostname.endsWith('.blob.vercel-storage.com'))
            && hasExpectedPath(url.pathname);
    } catch {
        return false;
    }
}

export function getNotificationAttachmentContentType(filename: string): string | null {
    return FILE_KINDS[extensionOf(filename)]?.contentType ?? null;
}

export function hasValidNotificationAttachmentContent(filename: string, bytes: Uint8Array): boolean {
    return FILE_KINDS[extensionOf(filename)]?.matches(bytes) ?? false;
}
