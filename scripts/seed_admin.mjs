/**
 * scripts/seed_admin.mjs
 * 建立系統管理員帳號（Node.js 原生 ES Module，無需額外套件）
 *
 * 執行方式：
 *   node scripts/seed_admin.mjs
 *
 * 可選：透過環境變數跳過互動提示
 *   ADMIN_ACCOUNT=admin01 ADMIN_PASSWORD=xxx ADMIN_NAME=管理員 node scripts/seed_admin.mjs
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 1. 載入 .env.local ──────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        // KEY=VALUE，VALUE 可選擇用雙引號或單引號包裹
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m) continue;
        let val = m[2].trim();
        // 去除成對的前後引號（雙或單）
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        process.env[m[1]] ??= val;
    }
}

if (!process.env.DATABASE_URL) {
    console.error('❌  找不到 DATABASE_URL，請確認 .env.local 存在且包含該變數');
    process.exit(1);
}

// ─── 2. 加密工具（與 src/lib/crypto.ts 邏輯相同）───────────────────────────
const GLOBAL_SECRET = (process.env.ENCRYPTION_KEY ?? 'default-super-secret-wmcms-key-must-be-32-chars-long!').slice(0, 32);
const getAESKey = () => crypto.createHash('sha256').update(GLOBAL_SECRET).digest();

function encryptAES(text) {
    if (!text) return { enc: null, iv: null };
    const iv  = crypto.randomBytes(16);
    const key = getAESKey();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const enc  = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return { enc, iv };
}

function generateSalt() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password, salt) {
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

function generateBlindIndex(text, salt) {
    if (!text) return null;
    return crypto.createHmac('sha256', salt).update(text).digest('hex');
}

// ─── 3. 互動提示工具 ─────────────────────────────────────────────────────────
function ask(rl, question) {
    return new Promise(resolve => rl.question(question, resolve));
}


// ─── 4. 主流程 ───────────────────────────────────────────────────────────────
async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        // 測試連線
        await pool.query('SELECT 1');
        console.log('✅  資料庫連線成功\n');
    } catch (err) {
        console.error('❌  資料庫連線失敗:', err.message);
        process.exit(1);
    }

    // 透過環境變數或互動取得輸入
    let account  = process.env.ADMIN_ACCOUNT  ?? '';
    let password = process.env.ADMIN_PASSWORD ?? '';
    let name     = process.env.ADMIN_NAME     ?? '';

    if (!account || !password || !name) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        console.log('─── 建立系統管理員帳號 ─────────────────────────────────────────');
        if (!account)  account  = (await ask(rl, '帳號 (account)       : ')).trim();
        if (!name)     name     = (await ask(rl, '顯示名稱 (name)      : ')).trim();
        if (!password) password = (await ask(rl, '密碼 (password)      : ')).trim();
        rl.close();
    }

    if (!account || !password || !name) {
        console.error('❌  帳號、密碼、顯示名稱皆為必填');
        await pool.end();
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 確認 admin role 存在
        const roleRes = await client.query(`SELECT id FROM roles WHERE code = 'admin'`);
        if (roleRes.rowCount === 0) {
            throw new Error("找不到 role code='admin'，請先執行 scripts/init_db.sql");
        }
        const adminRoleId = roleRes.rows[0].id;

        // 建立或更新帳號（ON CONFLICT 自動處理重複）
        const salt       = generateSalt();
        const saltBuffer = Buffer.from(salt, 'hex');
        const hashedPw   = hashPassword(password, saltBuffer);
        const { enc: nameEnc, iv: nameIv } = encryptAES(name);
        const nameBidx   = generateBlindIndex(name, salt);

        const insertRes = await client.query(
            `INSERT INTO users
                (account, password, search_salt, name_enc, name_iv, name_bidx, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)
             ON CONFLICT (account) DO UPDATE SET
                password    = EXCLUDED.password,
                search_salt = EXCLUDED.search_salt,
                name_enc    = EXCLUDED.name_enc,
                name_iv     = EXCLUDED.name_iv,
                name_bidx   = EXCLUDED.name_bidx,
                is_active   = TRUE
             RETURNING id`,
            [account, hashedPw, saltBuffer, nameEnc, nameIv, nameBidx]
        );
        const newUserId = insertRes.rows[0].id;

        await client.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [newUserId, adminRoleId]
        );

        await client.query('COMMIT');
        console.log(`\n✅  管理員帳號建立/更新成功！`);
        console.log(`   帳號   : ${account}`);
        console.log(`   名稱   : ${name}`);
        console.log(`   User ID: ${newUserId}`);
        console.log(`   角色   : admin`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌  建立失敗:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
