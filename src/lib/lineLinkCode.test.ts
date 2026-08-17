import { describe, expect, it } from 'vitest';
import {
    createLineLinkCodeSuffix,
    formatLineLinkCode,
    parseLineLinkCode,
} from './lineLinkCode';

describe('LINE binding code', () => {
    it('generates a six-character Crockford Base32 suffix', () => {
        for (let i = 0; i < 100; i += 1) {
            expect(createLineLinkCodeSuffix()).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
        }
    });

    it('accepts only a complete WMCMS-prefixed code and normalizes it', () => {
        expect(parseLineLinkCode('  wmcms-01abcz  ')).toBe('01ABCZ');
        expect(parseLineLinkCode('01ABCZ')).toBeNull();
        expect(parseLineLinkCode('WMCMS-01ABCO')).toBeNull();
        expect(parseLineLinkCode('WMCMS-01ABCZ-extra')).toBeNull();
        expect(formatLineLinkCode('01abcz')).toBe('WMCMS-01ABCZ');
    });
});
