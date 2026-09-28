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

import { changeOwnPassword, fetchRoles, getUsers } from './userActions';
import { hashPassword } from '../../lib/crypto';

describe('admin account scope', () => {
    beforeEach(() => {
        query.mockReset();
        release.mockReset();
        connect.mockClear();
    });

    it('loads only users who have at least one non-applicant role', async () => {
        query.mockResolvedValueOnce({ rows: [] });

        await getUsers();

        expect(query).toHaveBeenCalledOnce();
        expect(query.mock.calls[0][0]).toContain("internal_r.code <> 'applicant'");
        expect(release).toHaveBeenCalledOnce();
    });

    it('does not offer the applicant role in account management', async () => {
        query.mockResolvedValueOnce({ rows: [] });

        await fetchRoles();

        expect(query).toHaveBeenCalledWith("SELECT code, name FROM roles WHERE code <> 'applicant' ORDER BY id");
        expect(release).toHaveBeenCalledOnce();
    });
});

describe('changeOwnPassword', () => {
    beforeEach(() => {
        query.mockReset();
        release.mockReset();
        connect.mockClear();
    });

    it('verifies the current password before updating the same account', async () => {
        const salt = Buffer.alloc(32, 7);
        query
            .mockResolvedValueOnce({
                rows: [{ search_salt: salt, password: hashPassword('old-password', salt), is_active: true }],
            })
            .mockResolvedValueOnce({ rowCount: 1 });

        const result = await changeOwnPassword('42', 'old-password', 'new-password', 'new-password');

        expect(result).toEqual({ success: true });
        expect(query).toHaveBeenNthCalledWith(
            2,
            'UPDATE users SET password = $1 WHERE id = $2::bigint',
            [hashPassword('new-password', salt), '42'],
        );
        expect(release).toHaveBeenCalledOnce();
    });

    it('does not update when the current password is wrong', async () => {
        const salt = Buffer.alloc(32, 9);
        query.mockResolvedValueOnce({
            rows: [{ search_salt: salt, password: hashPassword('actual-password', salt), is_active: true }],
        });

        const result = await changeOwnPassword('42', 'wrong-password', 'new-password', 'new-password');

        expect(result).toEqual({ success: false, error: '目前密碼不正確' });
        expect(query).toHaveBeenCalledOnce();
        expect(release).toHaveBeenCalledOnce();
    });
});
