import { randomBytes } from 'crypto';

const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LINE_LINK_CODE_PATTERN = /^WMCMS-([0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6})$/i;

export function createLineLinkCodeSuffix(): string {
    return Array.from(randomBytes(6), (value) => BASE32_ALPHABET[value & 31]).join('');
}

export function formatLineLinkCode(suffix: string): string {
    return `WMCMS-${suffix.trim().toUpperCase()}`;
}

export function parseLineLinkCode(input: string): string | null {
    return input.trim().match(LINE_LINK_CODE_PATTERN)?.[1].toUpperCase() ?? null;
}
