/**
 * scripts/seed_users.mjs
 * 批次建立測試 / 預設使用者帳號（Node.js 原生 ES Module，無需額外套件）
 *
 * 設計原則：
 *   - 以 account 為唯一鍵
 *   - 已存在的帳號「跳過」（不更新姓名 / 密碼 / 角色）
 *   - 只建立尚未存在的帳號
 *   - 所有帳號共用同一組 DEFAULT_PASSWORD
 *
 * 執行方式：
 *   node scripts/seed_users.mjs
 *
 * 想對 demo 庫執行，可暫時覆寫 DATABASE_URL：
 *   DATABASE_URL=postgresql://postgres:1qazXSW%40@localhost:5433/wmcms_demo node scripts/seed_users.mjs
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 設定 ────────────────────────────────────────────────────────────────────
// 所有帳號共用此密碼。要換密碼直接改這裡即可。
const DEFAULT_PASSWORD = 'Password123!';
// 所有帳號共用此 Email（用於通知測試）。要換 Email 直接改這裡即可。
const DEFAULT_EMAIL    = 'stanley.chen4511@gmail.com';

// 帳號清單。新增請追加一筆；註解掉某行可暫時跳過該帳號。
// roles 必須對應 init_db.sql 中 roles 表的 code：
//   case_officer / supervisor / social_worker / accountant / board_member / volunteer / admin / applicant
const USERS = [
    { account: 'supervisor_01', name: '主管一', roles: ['supervisor']    },
    { account: 'officer_01',    name: '承辦一', roles: ['case_officer']  },
    { account: 'officer_02',    name: '承辦二', roles: ['case_officer']  },
    { account: 'officer_03',    name: '承辦三', roles: ['case_officer']  },
    { account: 'officer_04',    name: '承辦四', roles: ['case_officer']  },
    { account: 'social_01',     name: '社工一', roles: ['social_worker'] },
    { account: 'social_02',     name: '社工二', roles: ['social_worker'] },
    { account: 'board_01',      name: '董事一', roles: ['board_member']  },
    { account: 'board_02',      name: '董事二', roles: ['board_member']  },
    { account: 'board_03',      name: '董事三', roles: ['board_member']  },
    { account: 'board_04',      name: '董事四', roles: ['board_member']  },
    { account: 'accountant_01', name: '會計一', roles: ['accountant']    },
	{ account: 'chairman_01', name: '董事長', roles: ['chairman']    },
];
// ─────────────────────────────────────────────────────────────────────────────

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

function hashPassword(password, saltBuffer) {
    return crypto.createHmac('sha256', saltBuffer).update(password).digest('hex');
}

function generateBlindIndex(text, saltHex) {
    if (!text) return null;
    return crypto.createHmac('sha256', saltHex).update(text).digest('hex');
}

// ─── 3. 主流程 ───────────────────────────────────────────────────────────────
async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        await pool.query('SELECT 1');
        console.log('✅  資料庫連線成功\n');
    } catch (err) {
        console.error('❌  資料庫連線失敗:', err.message);
        process.exit(1);
    }

    // 先載入所有 role code → role id 對照
    const roleRes = await pool.query(`SELECT id, code FROM roles`);
    const roleIdByCode = new Map(roleRes.rows.map(r => [r.code, r.id]));

    // 驗證 USERS 中提到的 roles 都存在
    const missingRoles = new Set();
    for (const u of USERS) {
        for (const code of u.roles) {
            if (!roleIdByCode.has(code)) missingRoles.add(code);
        }
    }
    if (missingRoles.size > 0) {
        console.error(`❌  以下 role code 不存在於 roles 表：${[...missingRoles].join(', ')}`);
        console.error('   請先執行 scripts/init_db.sql 確保 roles seed 完成。');
        await pool.end();
        process.exit(1);
    }

    let created = 0, skipped = 0, failed = 0;

    console.log('─── 建立預設帳號 ───────────────────────────────────────────────');

    for (const u of USERS) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 已存在就跳過
            const existRes = await client.query(
                `SELECT id FROM users WHERE account = $1 LIMIT 1`,
                [u.account]
            );
            if (existRes.rowCount > 0) {
                console.log(`⊘  ${u.account.padEnd(15)} 已存在，跳過`);
                skipped++;
                await client.query('ROLLBACK');
                continue;
            }

            // 加密 / 雜湊
            const salt       = generateSalt();
            const saltBuffer = Buffer.from(salt, 'hex');
            const hashedPw   = hashPassword(DEFAULT_PASSWORD, saltBuffer);
            const { enc: nameEnc, iv: nameIv } = encryptAES(u.name);
            const nameBidx   = generateBlindIndex(u.name, salt);

            const insertRes = await client.query(
                `INSERT INTO users
                    (account, password, search_salt, name_enc, name_iv, name_bidx, email, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
                 RETURNING id`,
                [u.account, hashedPw, saltBuffer, nameEnc, nameIv, nameBidx, DEFAULT_EMAIL]
            );
            const newUserId = insertRes.rows[0].id;

            // 指派角色
            for (const roleCode of u.roles) {
                await client.query(
                    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [newUserId, roleIdByCode.get(roleCode)]
                );
            }

            await client.query('COMMIT');
            console.log(`✅  ${u.account.padEnd(15)} ${u.name}（${u.roles.join(', ')}）`);
            created++;
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`❌  ${u.account.padEnd(15)} 失敗: ${err.message}`);
            failed++;
        } finally {
            client.release();
        }
    }

    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`完成 — 建立 ${created} 筆 / 跳過 ${skipped} 筆 / 失敗 ${failed} 筆`);
    console.log(`預設密碼：${DEFAULT_PASSWORD}`);
    console.log(`預設 Email：${DEFAULT_EMAIL}`);

    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
}

main();
