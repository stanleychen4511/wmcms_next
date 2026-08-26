import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('App detail refresh callbacks', () => {
    it('keeps the board signature callback synchronized with the current detail loader', () => {
        const source = readFileSync(
            fileURLToPath(new URL('./App.tsx', import.meta.url)),
            'utf8',
        );
        const callback = source.match(
            /const handleSignatureStatusChange = useCallback\([\s\S]*?\n\s*},\s*(\[[^\]]*\])\);/,
        );

        expect(callback, 'handleSignatureStatusChange callback should exist').not.toBeNull();
        expect(callback?.[1]).toContain('loadAppDetail');
    });
});
