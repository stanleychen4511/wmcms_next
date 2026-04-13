/**
 * Pure utility functions for notifications (no server-only dependencies).
 * Kept separate from notificationActions.ts so client components can import safely.
 */

export function applyPlaceholders(text: string, vars: Record<string, string>): string {
    return text.replace(/\{\{(.+?)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key.trim()}}}`);
}
