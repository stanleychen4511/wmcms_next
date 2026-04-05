import { describe, it, expect } from 'vitest';
import { encryptData, decryptData } from './crypto';

describe('Crypto Utils', () => {
    it('should encrypt and decrypt data correctly', () => {
        const original = 'Secret Data 123';
        const key = 'my-secret-key';

        const encrypted = encryptData(original, key);
        expect(encrypted).not.toBe(original);
        expect(encrypted).not.toBe('');

        const decrypted = decryptData(encrypted, key);
        expect(decrypted).toBe(original);
    });

    it('should return empty string for empty input', () => {
        expect(encryptData('')).toBe('');
        expect(decryptData('')).toBe('');
    });

    it('should fail to decrypt with wrong key', () => {
        const original = 'Secret Data';
        const key = 'key-1';
        const wrongKey = 'key-2';

        const encrypted = encryptData(original, key);
        const decrypted = decryptData(encrypted, wrongKey);

        // AES decryption with wrong key usually results in garbage or empty string depending on implementation/padding
        // In crypto-js, it might return empty or garbage. 
        // Let's just ensure it's NOT the original.
        expect(decrypted).not.toBe(original);
    });
});
