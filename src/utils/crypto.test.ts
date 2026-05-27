import { describe, it, expect } from 'vitest';
import { decryptAES, encryptAES } from '../lib/crypto';

describe('Crypto Utils', () => {
    it('should encrypt and decrypt data correctly', () => {
        const original = 'Secret Data 123';

        const encrypted = encryptAES(original);
        expect(encrypted.enc).toBeInstanceOf(Buffer);
        expect(encrypted.iv).toBeInstanceOf(Buffer);
        expect(encrypted.enc?.toString('utf8')).not.toBe(original);

        const decrypted = decryptAES(encrypted.enc!, encrypted.iv!);
        expect(decrypted).toBe(original);
    });

    it('should return null buffers for empty input', () => {
        expect(encryptAES('')).toEqual({ enc: null, iv: null });
        expect(decryptAES(null as unknown as Buffer, null as unknown as Buffer)).toBe('');
    });

    it('should return empty string when decrypting with a wrong iv', () => {
        const original = 'Secret Data';

        const encrypted = encryptAES(original);
        const wrongIv = Buffer.alloc(16, 1);
        const decrypted = decryptAES(encrypted.enc!, wrongIv);

        expect(decrypted).not.toBe(original);
    });
});
