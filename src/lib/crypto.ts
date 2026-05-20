import * as crypto from 'crypto';

// The global encryption key should ideally come from environment variables.
// For this project, we fetch from process.env with a fallback for demonstration.
const GLOBAL_SECRET = process.env.ENCRYPTION_KEY || 'default-super-secret-wmcms-key-must-be-32-chars-long!'.slice(0, 32);

// Generate exactly a 32-byte key from the secret for AES-256
const getAESKey = () => crypto.createHash('sha256').update(GLOBAL_SECRET).digest();

export const generateSalt = () => crypto.randomBytes(32).toString('hex');

export const encryptAES = (text: string) => {
    if (!text) return { enc: null, iv: null };
    const iv = crypto.randomBytes(16);
    const key = getAESKey();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return { enc: encrypted, iv: iv };
};

export const decryptAES = (encryptedBuffer: Buffer, ivBuffer: Buffer) => {
    if (!encryptedBuffer || !ivBuffer) return '';
    try {
        const key = getAESKey();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuffer);
        const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (err) {
        console.error('Decryption error', err);
        return '';
    }
};

/**
 * HMAC-SHA256 雜湊密碼。
 *
 * salt 同時接受 string 與 Buffer：
 *   - 32-byte Buffer：寫入新帳號時用此格式（CLAUDE.md 規定）；login 時讀回的 Buffer 直接餵 HMAC。
 *   - hex string：CLI 腳本或 in-memory 計算時方便。
 */
export const hashPassword = (password: string, salt: string | Buffer) => {
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
};

export const generateBlindIndex = (text: string, salt: string | Buffer) => {
    if (!text) return null;
    return crypto.createHmac('sha256', salt).update(text).digest('hex');
};
