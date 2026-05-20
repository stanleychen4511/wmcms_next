/**
 * Migration: 64-byte salt 用戶 → 32-byte salt + 密碼重設為 "Password123!"
 *
 * 背景：
 *   `search_salt` 是 BYTEA。歷史上有兩種寫入路徑：
 *     - 正確：Buffer.from(hex, 'hex') → 32 bytes
 *     - 錯誤：直接傳 hex string → Postgres 存 ASCII bytes = 64 bytes
 *   兩種共存的結果：lookup 程式碼必須兩條都試（`getSaltCandidates`）。
 *
 * 動作：
 *   找所有 octet_length(search_salt)=64 的 user：
 *     1) 把 salt 從 utf8 解回原本的 hex string
 *     2) Buffer.from(hex, 'hex') → 32-byte saltBuffer
 *     3) password 重設為 hashPassword('Password123!', saltBuffer)
 *     4) UPDATE search_salt + password
 *     bidx 不需動 — 寫入時用的 hex string === 32-byte buffer 的 .toString('hex')，
 *     兩條 lookup 路徑會得到一樣的結果。
 *
 * 執行：node scripts/migrate_64byte_salts.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

// 讀 .env.local
const envText = fs.readFileSync(path.resolve('./.env.local'), 'utf8');
for (const line of envText.split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
}

const RESET_PASSWORD = 'Password123!';
const hashPassword = (pass, salt) =>
    crypto.createHmac('sha256', salt).update(pass).digest('hex');

async function main() {
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
    await client.query('BEGIN');

    const targets = await client.query(
        `SELECT id, account, search_salt
         FROM users
         WHERE octet_length(search_salt) = 64
         ORDER BY id`
    );

    console.log(`找到 ${targets.rowCount} 個 64-byte salt user：`);
    for (const row of targets.rows) {
        console.log(`  - id=${row.id} account=${row.account}`);
    }

    if (targets.rowCount === 0) {
        console.log('沒有需要 migration 的 user，結束。');
        await client.query('ROLLBACK');
        return;
    }

    console.log(`\n開始 migration（密碼將重設為 "${RESET_PASSWORD}"）…`);

    let migrated = 0;
    for (const row of targets.rows) {
        // 1) 64-byte salt buffer → utf8 還原成 hex string
        if (!Buffer.isBuffer(row.search_salt) || row.search_salt.length !== 64) {
            console.warn(`  ⚠ 跳過 id=${row.id}（salt 不是預期的 64-byte Buffer）`);
            continue;
        }
        const hexStr = row.search_salt.toString('utf8');
        if (!/^[0-9a-f]{64}$/.test(hexStr)) {
            console.warn(`  ⚠ 跳過 id=${row.id}（salt utf8 不是合法 hex：${hexStr.slice(0, 16)}…）`);
            continue;
        }

        // 2) 32-byte saltBuffer
        const saltBuffer = Buffer.from(hexStr, 'hex');
        if (saltBuffer.length !== 32) {
            console.warn(`  ⚠ 跳過 id=${row.id}（new saltBuffer 長度不對：${saltBuffer.length}）`);
            continue;
        }

        // 3) 重新 hash password
        const newPassHash = hashPassword(RESET_PASSWORD, saltBuffer);

        // 4) UPDATE
        await client.query(
            `UPDATE users SET search_salt = $1, password = $2 WHERE id = $3::bigint`,
            [saltBuffer, newPassHash, row.id]
        );
        console.log(`  ✓ id=${row.id} (${row.account}) — salt 32B, password 重設`);
        migrated += 1;
    }

    await client.query('COMMIT');
    console.log(`\n✅ Migration 完成，共 ${migrated} 個 user 更新。`);
    console.log(`   所有受影響帳號的密碼現在是 "${RESET_PASSWORD}"，請通知使用者首次登入後改密碼。`);

    // 最後 sanity check
    const verify = await client.query(
        `SELECT octet_length(search_salt) AS bytes, COUNT(*)::int AS n
         FROM users WHERE search_salt IS NOT NULL GROUP BY octet_length(search_salt) ORDER BY 1`
    );
    console.log('\n驗證（每個 salt 長度的使用者數）：');
    for (const r of verify.rows) console.log(`  ${r.bytes} bytes → ${r.n} users`);

} catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 失敗，已 rollback：', err);
    process.exitCode = 1;
} finally {
    client.release();
    await pool.end();
}
}

await main();
