import { describe, expect, it } from 'vitest';
import {
    hasValidNotificationAttachmentContent,
    isManualNotificationAttachmentUrlFor,
    isNotificationAttachmentUrlFor,
    mapNotificationAttachmentsConcurrently,
    validateNotificationAttachments,
} from './notificationAttachments';

describe('notification attachment validation', () => {
    it('accepts the requested document and image formats', () => {
        expect(validateNotificationAttachments([
            { name: '說明.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 100 },
            { name: '明細.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 100 },
            { name: '照片.png', type: 'image/png', size: 100 },
        ])).toBeNull();
    });

    it('rejects unsupported or mismatched formats', () => {
        expect(validateNotificationAttachments([
            { name: '程式.exe', type: 'application/octet-stream', size: 100 },
        ])).toContain('僅支援');
        expect(validateNotificationAttachments([
            { name: '偽裝.pdf', type: 'image/png', size: 100 },
        ])).toContain('格式不符');
        expect(validateNotificationAttachments([
            { name: 'invalid.pdf', type: 'application/pdf', size: Number.NaN },
        ])).toContain('大小無效');
    });

    it('does not limit file count but enforces the 18 MB total', () => {
        const manyFiles = Array.from({ length: 100 }, (_, index) => ({
            name: `${index}.pdf`, type: 'application/pdf', size: 1,
        }));
        expect(validateNotificationAttachments(manyFiles)).toBeNull();
        expect(validateNotificationAttachments([
            { name: 'large.pdf', type: 'application/pdf', size: 18 * 1024 * 1024 + 1 },
        ])).toContain('18 MB');
    });

    it('checks file content signatures instead of trusting the filename', () => {
        expect(hasValidNotificationAttachmentContent('real.pdf', new TextEncoder().encode('%PDF-1.7'))).toBe(true);
        expect(hasValidNotificationAttachmentContent('fake.pdf', new TextEncoder().encode('not a pdf'))).toBe(false);
        expect(hasValidNotificationAttachmentContent('sheet.xlsx', new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    });

    it('only accepts temporary attachment URLs for the matching disbursement', () => {
        const remote = 'https://store.public.blob.vercel-storage.com/notification-attachments/12/34/file-random.pdf';
        expect(isNotificationAttachmentUrlFor(remote, '12', '34')).toBe(true);
        expect(isNotificationAttachmentUrlFor(remote, '12', '99')).toBe(false);
        expect(isNotificationAttachmentUrlFor('/notification-attachments/12/34/file.pdf', '12', '34')).toBe(true);
        expect(isNotificationAttachmentUrlFor('/notification-attachments/12/34/../99/file.pdf', '12', '34')).toBe(false);
    });

    it('only accepts manual notification attachment URLs for the matching application', () => {
        const remote = 'https://store.public.blob.vercel-storage.com/notification-attachments/12/manual/file-random.pdf';
        expect(isManualNotificationAttachmentUrlFor(remote, '12')).toBe(true);
        expect(isManualNotificationAttachmentUrlFor(remote, '99')).toBe(false);
        expect(isManualNotificationAttachmentUrlFor('/notification-attachments/12/manual/file.pdf', '12')).toBe(true);
        expect(isManualNotificationAttachmentUrlFor('/notification-attachments/12/manual/../99/file.pdf', '12')).toBe(false);
    });

    it('processes at most six attachments concurrently and preserves their order', async () => {
        let active = 0;
        let maxActive = 0;
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const items = Array.from({ length: 9 }, (_, index) => index);

        const mapped = mapNotificationAttachmentsConcurrently(items, async item => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await gate;
            active -= 1;
            return item * 2;
        });

        await Promise.resolve();
        expect(maxActive).toBe(6);
        release();
        await expect(mapped).resolves.toEqual(items.map(item => item * 2));
    });

    it('waits for in-flight attachments and stops scheduling new ones after an error', async () => {
        const started: number[] = [];
        const completed: number[] = [];
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });

        const mapped = mapNotificationAttachmentsConcurrently([0, 1, 2, 3, 4, 5, 6], async item => {
            started.push(item);
            if (item === 0) throw new Error('upload failed');
            await gate;
            completed.push(item);
            return item;
        });
        const rejection = expect(mapped).rejects.toThrow('upload failed');

        await Promise.resolve();
        expect(started).toEqual([0, 1, 2, 3, 4, 5]);
        release();
        await rejection;
        expect(completed).toEqual([1, 2, 3, 4, 5]);
        expect(started).not.toContain(6);
    });
});
