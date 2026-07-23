export const NOTIFICATION_MANAGER_ROLES = ['admin', 'supervisor', 'executive'] as const;

export const canManageNotifications = (roles: readonly string[]) =>
    roles.some(role => (NOTIFICATION_MANAGER_ROLES as readonly string[]).includes(role));
