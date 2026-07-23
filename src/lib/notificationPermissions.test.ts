import { describe, expect, it } from 'vitest';
import { canManageNotifications } from './notificationPermissions';

describe('notification manager permissions', () => {
    it('allows only admin, supervisor, and executive roles', () => {
        expect(canManageNotifications(['admin'])).toBe(true);
        expect(canManageNotifications(['supervisor'])).toBe(true);
        expect(canManageNotifications(['executive'])).toBe(true);
        expect(canManageNotifications(['case_officer'])).toBe(false);
    });
});
