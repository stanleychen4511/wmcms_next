/**
 * scripts/applications_clear.mjs
 *
 * 清除所有「申請案件」相關資料：
 *   1. 跑 applications_clear.sql（DB 端：applications 主檔 + 連動的所有子表 + 相關 audit/notification logs）
 *   2. 移除 public/uploads/<applicationId>/ 底下所有檔案目錄（保留 templates/、banners/ 等系統目錄）
 *
 * ⚠️ 不可逆。執行前會印出將要清的內容並要求 y/N 確認（除非帶 --yes）。
 *
 * 用法：
 *   node scripts/applications_clear.mjs           # 互動確認
 *   node scripts/applications_clear.mjs --yes     # 跳過確認（CI / 自動化）
 *
 * 注意：本腳本只清「本機 public/uploads」目錄。若你的環境用 Vercel Blob，
 *      需另行用 @vercel/blob list/del API 清理 — 本腳本不會動 Blob。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── 1. 載入 .env.local ────────────────────────────────────────────────
const envPath = path.resolve(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m) continue;
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        process.env[m[1]] ??= val;
    }
}

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set. 請在 .env.local 設定 DATABASE_URL。');
    process.exit(1);
}

const args = new Set(process.argv.slice(2));
const skipConfirm = args.has('--yes') || args.has('-y');

// ─── 2. 預先計數，給使用者看「將會清掉什麼」───────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fetchCounts() {
    const tables = [
        'applications',
        'application_workflow',
        'application_documents',
        'home_visit',
        'payment_disbursements',
        'board_review_signatures',
        'board_review_assignments',
        'contact_records',
        'notification_logs',
        'audit_logs',
    ];
    const result = {};
    for (const t of tables) {
        try {
            const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
            result[t] = r.rows[0].c;
        } catch (e) {
            result[t] = `(查詢失敗：${e.message})`;
        }
    }
    return result;
}

// 匡列 public/uploads 下將被刪除的目錄（純數字命名 = 案件目錄）
function listAppUploadDirs() {
    const uploadsRoot = path.join(ROOT, 'public', 'uploads');
    if (!fs.existsSync(uploadsRoot)) return [];
    return fs.readdirSync(uploadsRoot, { withFileTypes: true })
        .filter(e => e.isDirectory() && /^\d+$/.test(e.name))
        .map(e => e.name);
}

function confirm(prompt) {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, ans => {
            rl.close();
            resolve(/^y(es)?$/i.test(ans.trim()));
        });
    });
}

async function runSql() {
    const sqlPath = path.join(__dirname, 'applications_clear.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    const client = await pool.connect();
    try {
        await client.query(sql);
    } finally {
        client.release();
    }
}

async function clearUploadDirs(dirs) {
    const uploadsRoot = path.join(ROOT, 'public', 'uploads');
    let removed = 0;
    let totalFiles = 0;
    for (const d of dirs) {
        const abs = path.join(uploadsRoot, d);
        try {
            // 算一下要刪的檔案數
            const walk = (p) => {
                if (!fs.existsSync(p)) return 0;
                const entries = fs.readdirSync(p, { withFileTypes: true });
                let n = 0;
                for (const e of entries) {
                    const sub = path.join(p, e.name);
                    if (e.isDirectory()) n += walk(sub);
                    else n += 1;
                }
                return n;
            };
            totalFiles += walk(abs);
            fs.rmSync(abs, { recursive: true, force: true });
            removed += 1;
        } catch (err) {
            console.warn(`  ⚠️  無法刪除 ${abs}：${err.message}`);
        }
    }
    return { removed, totalFiles };
}

// ─── 3. Main ──────────────────────────────────────────────────────────
(async () => {
    console.log('━'.repeat(60));
    console.log('🧹 清除所有申請案件相關資料');
    console.log('━'.repeat(60));

    const counts = await fetchCounts();
    console.log('\n📊 將清除的 DB 紀錄：');
    for (const [t, c] of Object.entries(counts)) {
        console.log(`    ${t.padEnd(28)} = ${c}`);
    }

    const appDirs = listAppUploadDirs();
    console.log(`\n📁 將清除的上傳目錄（public/uploads/）：`);
    if (appDirs.length === 0) {
        console.log('    （無）');
    } else {
        console.log(`    共 ${appDirs.length} 個案件目錄：${appDirs.slice(0, 10).join(', ')}${appDirs.length > 10 ? ` ... +${appDirs.length - 10}` : ''}`);
    }

    console.log('\n🛡  以下資料【不會】被清除：');
    console.log('    使用者、角色、文件類型設定、儲存位置、系統參數、');
    console.log('    通知範本/渠道/排程、董事組別、轉介單位、公告/Banner、');
    console.log('    範本檔（template_files / template_categories）、');
    console.log('    public/uploads/templates/ 與 public/uploads/banners/');

    if (!skipConfirm) {
        console.log('\n');
        const ok = await confirm('⚠️  確定執行清除嗎？(y/N) ');
        if (!ok) {
            console.log('已取消。');
            await pool.end();
            return;
        }
    }

    console.log('\n→ 執行 SQL 清除…');
    try {
        await runSql();
        console.log('  ✓ DB 已清除');
    } catch (err) {
        console.error('  ❌ DB 清除失敗：', err.message);
        await pool.end();
        process.exit(1);
    }

    if (appDirs.length > 0) {
        console.log('\n→ 清除上傳目錄…');
        const { removed, totalFiles } = await clearUploadDirs(appDirs);
        console.log(`  ✓ 已刪除 ${removed} 個目錄、共 ${totalFiles} 個檔案`);
    }

    // 最終 verify
    const after = await fetchCounts();
    const allZero = Object.values(after).every(v => v === 0);
    console.log('\n📊 清除後狀態：');
    for (const [t, c] of Object.entries(after)) {
        console.log(`    ${t.padEnd(28)} = ${c}`);
    }
    console.log(allZero ? '\n✅ 全部清除完成。' : '\n⚠️  仍有殘留資料，請檢查上方計數。');

    await pool.end();
})();
