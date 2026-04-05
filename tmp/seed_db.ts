import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/DATABASE_URL="([^"]+)"/);
  if (match) {
    process.env.DATABASE_URL = match[1];
  }
}

// 1. Crypto Utilities (Using Node Native Crypto)
const GLOBAL_SECRET = process.env.ENCRYPTION_KEY || 'default-super-secret-wmcms-key-must-be-32-chars-long!'.slice(0, 32);

// Generate 32-byte key from the global secret using SHA-256
const getAESKey = () => crypto.createHash('sha256').update(GLOBAL_SECRET).digest();

const generateSalt = () => crypto.randomBytes(32).toString('hex');

const encryptAES = (text: string) => {
    const iv = crypto.randomBytes(16);
    const key = getAESKey();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return {
        enc: encrypted, 
        iv: iv
    };
};

const hashPassword = (password: string, salt: string) => {
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
};

const generateBlindIndex = (text: string, salt: string) => {
    return crypto.createHmac('sha256', salt).update(text).digest('hex');
};

async function seedDatabase() {
    console.log('Seeding Database with encrypted initial user...');
    const { pool } = await import('../src/lib/db');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Target User Info
        const userAccount = 'admin_01';
        const userPassword = 'Password123!';
        const userName = '系統管理員';
        const userIdNumber = 'A123456789';

        console.log(`Generating crypto materials for ${userAccount}...`);
        
        // Salts
        const searchSalt = generateSalt();
        // Since we are using SHA-256, we'll store the password hash
        const passwordHash = hashPassword(userPassword, searchSalt);

        // AES Encryption
        const { enc: idEnc, iv: idIv } = encryptAES(userIdNumber);
        const { enc: nameEnc, iv: nameIv } = encryptAES(userName);

        // Blind Indexes
        const idBidx = generateBlindIndex(userIdNumber, searchSalt);
        const nameBidx = generateBlindIndex(userName, searchSalt);

        console.log('Inserting into users table...');
        
        const insertUserQuery = `
            INSERT INTO users (
                account, 
                password, 
                search_salt,
                name_enc, name_iv, name_bidx,
                id_number_enc, id_number_iv, id_number_bidx,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id;
        `;
        
        const userRes = await client.query(insertUserQuery, [
            userAccount,
            passwordHash,
            searchSalt,
            nameEnc, nameIv, nameBidx,
            idEnc, idIv, idBidx,
            true
        ]);
        
        const userId = userRes.rows[0].id;
        console.log(`User created successfully with ID: ${userId}`);

        console.log('Linking user to admin role...');
        // Find role id for 'admin'
        const roleRes = await client.query(`SELECT id FROM roles WHERE code = 'admin'`);
        if (roleRes.rows.length === 0) {
            throw new Error("Admin role not found. Did the init_db script run correctly?");
        }
        
        const roleId = roleRes.rows[0].id;

        await client.query(`
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
        `, [userId, roleId]);

        await client.query('COMMIT');
        console.log('Seed completed successfully!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Seed failed:', err);
    } finally {
        client.release();
        process.exit(0);
    }
}

seedDatabase();
