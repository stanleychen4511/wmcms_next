import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, release, connect } = vi.hoisted(() => {
    const query = vi.fn();
    const release = vi.fn();
    const connect = vi.fn(async () => ({ query, release }));
    return { query, release, connect };
});

vi.mock('../../lib/db', () => ({
    pool: { connect },
}));

vi.mock('./auditActions', () => ({
    writeAuditLog: vi.fn(),
}));

import {
    consumeLinkCodeFromWebhook,
    generateLineLinkCode,
} from './lineActions';

describe('LINE account linking', () => {
    beforeEach(() => {
        query.mockReset();
        release.mockReset();
        connect.mockClear();
    });

    it('generates an internal-user code with a ten-minute expiry', async () => {
        query
            .mockResolvedValueOnce({ rowCount: 1, rows: [{ line_user_id: null }] })
            .mockResolvedValueOnce({ rows: [{ expires_at: '2026-08-17T00:10:00.000Z' }] });

        const result = await generateLineLinkCode('42');

        expect(result.success).toBe(true);
        expect(result.data?.code).toMatch(/^WMCMS-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
        expect(query.mock.calls[0][0]).toContain("r.code <> 'applicant'");
        expect(query.mock.calls[1][1][2]).toBe('10');
        expect(release).toHaveBeenCalledOnce();
    });

    it('blocks the sixth well-formed attempt in the same ten-minute window', async () => {
        query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [{ attempt_count: 6 }] })
            .mockResolvedValueOnce({});

        const result = await consumeLinkCodeFromWebhook(
            'WMCMS-01ABCZ',
            'U0123456789abcdef0123456789abcdef',
        );

        expect(result).toEqual({ replyText: '嘗試次數過多，請 10 分鐘後再試', linkedUserId: null });
        expect(query).toHaveBeenCalledTimes(3);
        expect(query.mock.calls[1][0]).toContain("INTERVAL '10 minutes'");
        expect(query.mock.calls[1][1]).toEqual([
            'U0123456789abcdef0123456789abcdef',
            6,
        ]);
        expect(query.mock.calls[2][0]).toBe('COMMIT');
        expect(release).toHaveBeenCalledOnce();
    });

    it('ignores malformed input before opening a database connection', async () => {
        const result = await consumeLinkCodeFromWebhook(
            '123456',
            'U0123456789abcdef0123456789abcdef',
        );

        expect(result.linkedUserId).toBeNull();
        expect(connect).not.toHaveBeenCalled();
    });
});
