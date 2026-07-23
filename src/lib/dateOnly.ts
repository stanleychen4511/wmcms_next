export const TAIPEI_TIME_ZONE = 'Asia/Taipei';

function dateParts(value: unknown, withTime = false): Intl.DateTimeFormatPart[] | null {
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(value as string | number);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat('en-CA', {
        timeZone: TAIPEI_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(withTime ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } : {}),
    }).formatToParts(date);
}

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
    return parts.find(p => p.type === type)?.value ?? '';
}

export function formatDateOnly(value: unknown): string | null {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parts = dateParts(value);
    if (!parts) return null;

    return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

/** Formats an instant stored in UTC for display in the system's Taipei time zone. */
export function formatTaipeiDateTime(value: unknown): string | null {
    const parts = dateParts(value, true);
    if (!parts) return null;

    return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')} ${part(parts, 'hour')}:${part(parts, 'minute')}:${part(parts, 'second')}`;
}

export function todayDateOnly(): string {
    return formatDateOnly(new Date()) ?? '';
}
