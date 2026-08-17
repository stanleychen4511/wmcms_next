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

import { fetchRoles, getUsers } from './userActions';

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
