/**
 * scripts/seed_legacy_import_test.mjs
 * 在「測試環境」建立模擬初始匯入狀況的假案件，用來測試：
 *   1. scripts/fix_legacy_import_1150923.mjs（以 CASE_PREFIX 指向這批假案件）
 *   2. 退回董事再次審核：匯入舊案改由「自訂本案審核董事」指定、一般案件派回原組
 *
 * 全部是假資料（申請人為「測試申請人-案號」），不含任何正式資料；
 * 案件狀態、金額比照正式機 2026-08-14 匯入後的樣態。
 *
 * 執行方式：
 *   TARGET_DATABASE_URL='postgresql://...' ENCRYPTION_KEY='<目標環境的金鑰>' \
 *     node scripts/seed_legacy_import_test.mjs [--prefix T] [--reset]
 *
 *   --prefix  案號前綴（預設 T，例如 TA115016），需與修正腳本的 CASE_PREFIX 一致
 *   --reset   先刪除同前綴的既有假案件（含其專屬組別、測試申請人帳號）再重建
 *
 * ENCRYPTION_KEY 必須與目標環境 app 使用的相同，否則畫面上的申請人姓名無法解密。
 * 案號已存在且未加 --reset 時直接中止。
 */

import * as crypto from 'crypto';
import pg from 'pg';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PREFIX = argValue('--prefix', 'T');
const RESET = args.includes('--reset');
if (!/^[A-Z]{1,3}$/.test(PREFIX)) {
    console.error('--prefix 只能是 1–3 個大寫英文字母');
    process.exit(1);
}
const url = process.env.TARGET_DATABASE_URL;
if (!url) {
    console.error('請以環境變數 TARGET_DATABASE_URL 指定測試資料庫');
    process.exit(1);
}

// 與 src/lib/crypto.ts 相同的加密方式
const GLOBAL_SECRET = process.env.ENCRYPTION_KEY || 'default-super-secret-wmcms-key-must-be-32-chars-long!'.slice(0, 32);
const AES_KEY = crypto.createHash('sha256').update(GLOBAL_SECRET).digest();
function encryptAES(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, iv);
    return { enc: Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]), iv };
}

const LEGACY_WORKFLOW_NOTE = '初始匯入：歷史流程視為已通過，直接進入撥款階段';
const LEGACY_PAYMENT_NOTE = '初始匯入：累計已撥金額，未追溯歷史單號、日期、具領人與附件';

/**
 * kind:
 *   legacy  初始匯入案件（直接進入核銷撥款、無派組）
 *   online  線上建案停在行政初審
 *   normal  線上完整走過董事審核、已派組的一般案件（測試「派回原組」）
 */
const CASES = [
    { no: 'A114004', kind: 'legacy', status: '4', subtype: '2', approved: 239336, paid: 179452, earlyClose: '初始匯入', applyAt: '2025-04-16' },
    { no: 'A114014', kind: 'legacy', status: '4', subtype: '2', approved: 244223, paid: 135770, earlyClose: '初始匯入', applyAt: '2025-07-22' },
    { no: 'A115016', kind: 'legacy', status: '3', subtype: '2', approved: 30000, paid: 0, applyAt: '2026-06-01' },
    { no: 'A115019', kind: 'legacy', status: '3', subtype: '1', approved: 30000, paid: 0, applyAt: '2026-06-10' },
    { no: 'A115021', kind: 'legacy', status: '3', subtype: '2', approved: 350000, paid: 0, applyAt: '2026-06-02' },
    { no: 'A115022', kind: 'online', status: '1', subtype: '1', applyAmount: 30000, applyAt: '2026-07-27' },
    { no: 'A115024', kind: 'online', status: '1', subtype: '1', applyAmount: 30000, applyAt: '2026-07-17' },
    { no: 'A115006', kind: 'legacy', status: '3', subtype: '2', approved: 117000, paid: 29938, applyAt: '2026-03-05' },
    { no: 'A115900', kind: 'normal', status: '3', subtype: '2', approved: 100000, paid: 0, applyAt: '2026-08-03' },
];

const client = new pg.Client({ connectionString: url });
await client.connect();
const dbName = (await client.query('SELECT current_database() AS db')).rows[0].db;
console.log(`目標資料庫：${dbName}（${new URL(url).hostname}），案號前綴 ${PREFIX}`);

let exitCode = 0;
try {
    await client.query('BEGIN');
    const caseNumbers = CASES.map(c => PREFIX + c.no);
    const applicantAccounts = caseNumbers.map(n => `test_applicant_${n.toLowerCase()}`);

    const existing = await client.query(
        `SELECT id::text, case_number FROM applications WHERE case_number = ANY($1)`,
        [caseNumbers]
    );
    if ((existing.rowCount ?? 0) > 0) {
        if (!RESET) {
            throw new Error(`案號已存在：${existing.rows.map(r => r.case_number).join('、')}（要重建請加 --reset）`);
        }
        const ids = existing.rows.map(r => r.id);
        await client.query(`DELETE FROM board_review_assignments WHERE application_id = ANY($1::bigint[])`, [ids]);
        await client.query(`DELETE FROM board_groups WHERE adhoc_application_id = ANY($1::bigint[])`, [ids]);
        await client.query(`DELETE FROM applications WHERE id = ANY($1::bigint[])`, [ids]);
        console.log(`已刪除既有假案件 ${existing.rowCount} 筆`);
    }
    await client.query(`DELETE FROM users WHERE account = ANY($1)`, [applicantAccounts]);

    const officerRes = await client.query(
        `SELECT u.id::text FROM users u
         JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'case_officer' AND u.is_active = TRUE
         ORDER BY u.id LIMIT 1`
    );
    if (officerRes.rowCount === 0) throw new Error('測試資料庫沒有在職的承辦人帳號');
    const officerId = officerRes.rows[0].id;
    const applicantRoleId = (await client.query(`SELECT id FROM roles WHERE code = 'applicant'`)).rows[0]?.id;

    // 一般案件需要一個有成員的一般組別；沒有就用現有董事建兩組
    let groupRes = await client.query(
        `SELECT g.id::text, g.name FROM board_groups g
         WHERE g.is_active = TRUE AND NOT g.is_adhoc
           AND EXISTS (SELECT 1 FROM board_group_members m WHERE m.group_id = g.id)
         ORDER BY g.priority, g.id LIMIT 1`
    );
    if (groupRes.rowCount === 0) {
        const boardRes = await client.query(
            `SELECT u.id::text FROM users u
             JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
             WHERE r.code = 'board_member' AND u.is_active = TRUE
               AND NOT EXISTS (SELECT 1 FROM board_group_members m WHERE m.user_id = u.id AND NOT m.is_adhoc)
             ORDER BY u.id`
        );
        if ((boardRes.rowCount ?? 0) < 2) throw new Error('測試資料庫至少需要 2 位未分組的董事帳號');
        const ids = boardRes.rows.map(r => r.id);
        const half = Math.ceil(ids.length / 2);
        for (const [name, members, priority] of [['測試A組', ids.slice(0, half), 1], ['測試B組', ids.slice(half), 2]]) {
            if (members.length === 0) continue;
            const g = await client.query(
                `INSERT INTO board_groups (name, priority, is_active) VALUES ($1, $2, TRUE) RETURNING id::text`,
                [name, priority]
            );
            for (const uid of members) {
                await client.query(`INSERT INTO board_group_members (group_id, user_id) VALUES ($1::bigint, $2::bigint)`, [g.rows[0].id, uid]);
            }
        }
        console.log('已建立董事組別：測試A組、測試B組');
        groupRes = await client.query(
            `SELECT id::text, name FROM board_groups WHERE name = '測試A組'`
        );
    }
    const normalGroup = groupRes.rows[0];

    for (const c of CASES) {
        const caseNumber = PREFIX + c.no;
        const name = encryptAES(`測試申請人-${caseNumber}`);
        const applicant = await client.query(
            `INSERT INTO users (account, password, name_enc, name_iv, is_active)
             VALUES ($1, $2, $3, $4, FALSE) RETURNING id::text`,
            [`test_applicant_${caseNumber.toLowerCase()}`, crypto.randomBytes(32).toString('hex'), name.enc, name.iv]
        );
        if (applicantRoleId) {
            await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1::bigint, $2)`, [applicant.rows[0].id, applicantRoleId]);
        }

        const passedSupervisor = c.kind !== 'online';
        const app = await client.query(
            `INSERT INTO applications
                (case_number, applicant_id, officer_id, status, apply_at, created_at, updated_at,
                 application_type, apply_amount, approved_amount, early_close_reason,
                 subsidy_subtype, cancer_type, cancer_stage, application_form, treatment_phase,
                 supervisor_approved_for_board, supervisor_approved_for_accounting)
             VALUES ($1, $2::bigint, $3::bigint, $4, $5::date, $5::date, NOW(),
                     'A', $6, $7, $8,
                     $9, '測試癌別', '4', 'P', 'A',
                     $10, $10)
             RETURNING id::text`,
            [caseNumber, applicant.rows[0].id, officerId, c.status, c.applyAt,
             c.applyAmount ?? null, c.approved ?? null, c.earlyClose ?? null,
             c.subtype, passedSupervisor ? true : null]
        );
        const appId = app.rows[0].id;

        if (c.kind === 'online') {
            await client.query(
                `INSERT INTO application_workflow (application_id, stage, comments)
                 VALUES ($1::bigint, 'admin_review', '案件已建立，進入行政初審階段')`,
                [appId]
            );
        } else if (c.kind === 'legacy') {
            await client.query(
                `INSERT INTO application_workflow (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
                 VALUES ($1::bigint, 'reimbursement', $2::bigint, TRUE, $3, NOW())`,
                [appId, officerId, LEGACY_WORKFLOW_NOTE]
            );
        } else {
            for (const [stage, comments] of [
                ['admin_review', '案件已建立，進入行政初審階段'],
                ['home_visit', '推進至家訪'],
                ['board_review', '推進至董事審核'],
                ['reimbursement', '董事審核通過，進入核銷撥款'],
            ]) {
                await client.query(
                    `INSERT INTO application_workflow (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
                     VALUES ($1::bigint, $2, $3::bigint, TRUE, $4, NOW())`,
                    [appId, stage, officerId, comments]
                );
            }
            await client.query(
                `INSERT INTO board_review_assignments (application_id, group_id, assign_mode)
                 VALUES ($1::bigint, $2::bigint, 'manual')`,
                [appId, normalGroup.id]
            );
        }

        if (c.paid > 0) {
            await client.query(
                `INSERT INTO payment_disbursements
                    (application_id, receipt_number, amount, notes, created_by, created_at, review_stage, is_legacy_import)
                 VALUES ($1::bigint, $2, $3, $4, $5::bigint, $6::date, '9', TRUE)`,
                [appId, `IMP-${caseNumber}-01`, c.paid, LEGACY_PAYMENT_NOTE, officerId, c.applyAt]
            );
        }
        console.log(`  ${caseNumber}  ${c.kind.padEnd(6)} status=${c.status}${c.kind === 'normal' ? `  派組=${normalGroup.name}` : ''}`);
    }

    await client.query('COMMIT');
    console.log(`\n完成：建立 ${CASES.length} 筆假案件。`);
} catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n中止，未寫入任何資料：${err.message}`);
    exitCode = 1;
} finally {
    await client.end();
}
process.exit(exitCode);
