import { beforeEach, describe, expect, it, vi } from 'vitest';

const { delMock } = vi.hoisted(() => ({ delMock: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@vercel/blob', () => ({ del: delMock }));

import { deleteFiles } from './storage';

describe('storage deletion', () => {
    beforeEach(() => delMock.mockClear());

    it('deletes multiple Blob URLs in one request', async () => {
        const urls = [
            'https://store.public.blob.vercel-storage.com/one.pdf',
            'https://store.public.blob.vercel-storage.com/two.pdf',
        ];

        await deleteFiles(urls);

        expect(delMock).toHaveBeenCalledTimes(1);
        expect(delMock).toHaveBeenCalledWith(urls);
    });
});
