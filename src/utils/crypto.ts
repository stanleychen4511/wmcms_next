import AES from 'crypto-js/aes';
import enc from 'crypto-js/enc-utf8';

// In a real app, use crypto-js/aes
export const encryptData = (data: string, key = 'default-secret'): string => {
    try {
        if (!data) return '';
        const encrypted = AES.encrypt(data, key).toString();
        return encrypted;
    } catch (e) {
        console.error('Encryption failed', e);
        return '';
    }
};

export const decryptData = (encrypted: string, key = 'default-secret'): string => {
    try {
        if (!encrypted) return '';
        const bytes = AES.decrypt(encrypted, key);
        const originalText = bytes.toString(enc);
        return originalText;
    } catch (e) {
        console.error('Decryption failed', e);
        return '';
    }
};
