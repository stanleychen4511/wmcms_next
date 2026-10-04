/**
 * scripts/fix_legacy_import_1150923.mjs
 * 依「萬美申請人_已結案_撥款中_匯入1150923.xlsx」修正初始匯入資料（一次性腳本）
 *
 * 2026-08-14 的初始匯入有 5 筆與匯入表不符，另 2 筆提前結案的原因需改為實際原因：
 *   A115016、A115019  已結案、已撥 30,000      → 補匯入撥款、核銷完成（status 4）
 *   A115021           未結案、已撥 129,908     → 補匯入撥款（維持待核銷 status 3）
 *   A115022、A115024  8/27 線上建案停在行政初審 → 依初始匯入格式直接進入核銷撥款、
 *                     核定 30,000、補匯入撥款、核銷完成（status 4）
 *   A114004、A114014  提前結案原因「初始匯入」 → 「初始匯入：獲得贈藥」／「初始匯入：過世」
 *   （A114002 匯入表未載明結案原因，維持「初始匯入」）
 *
 * 執行方式（預設為預覽：整批在交易中執行、印出結果後 ROLLBACK，不會寫入）：
 *   TARGET_DATABASE_URL='postgresql://...' node scripts/fix_legacy_import_1150923.mjs
 *   TARGET_DATABASE_URL='postgresql://...' node scripts/fix_legacy_import_1150923.mjs --apply
 *
 * 測試環境（不得使用正式資料）：先以 scripts/seed_legacy_import_test.mjs 建立假案件
 * （案號加前綴，例如 TA115016），再以 CASE_PREFIX 指定同一前綴執行本腳本：
 *   TARGET_DATABASE_URL='...' CASE_PREFIX=T node scripts/fix_legacy_import_1150923.mjs
 *
 * 冪等：已補過的撥款（同一 receipt_number）、已推進的狀態都會略過；
 * 任何一筆的前置狀態與預期不符就整批中止，不寫入任何資料。
 */

import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const CASE_PREFIX = process.env.CASE_PREFIX ?? '';
if (CASE_PREFIX && !/^[A-Z]{1,3}$/.test(CASE_PREFIX)) {
    console.error('CASE_PREFIX 只能是 1–3 個大寫英文字母（例如 T）');
    process.exit(1);
}
const url = process.env.TARGET_DATABASE_URL;
if (!url) {
    console.error('請以環境變數 TARGET_DATABASE_URL 指定目標資料庫（不會讀取 .env.local，避免誤連）');
    process.exit(1);
}

const LEGACY_PAYMENT_NOTE = '初始匯入：累計已撥金額，未追溯歷史單號、日期、具領人與附件';
const LEGACY_WORKFLOW_NOTE = '初始匯入：歷史流程視為已通過，直接進入撥款階段';

/** 匯入表（1150923）的目標狀態 */
const PAYMENT_FIXES = [
    { caseNumber: 'A115016', approved: 30000, paid: 30000, fromStatus: ['3'], toStatus: '4' },
    { caseNumber: 'A115019', approved: 30000, paid: 30000, fromStatus: ['3'], toStatus: '4' },
    { caseNumber: 'A115021', approved: 350000, paid: 129908, fromStatus: ['3'], toStatus: '3' },
    { caseNumber: 'A115022', approved: 30000, paid: 30000, fromStatus: ['1'], toStatus: '4', enterReimbursement: true },
    { caseNumber: 'A115024', approved: 30000, paid: 30000, fromStatus: ['1'], toStatus: '4', enterReimbursement: true },
];
const CLOSE_REASON_FIXES = [
    { caseNumber: 'A114004', from: '初始匯入', to: '初始匯入：獲得贈藥' },
    { caseNumber: 'A114014', from: '初始匯入', to: '初始匯入：過世' },
];

class Abort extends Error {}

async function loadCase(client, rawCaseNumber) {
    const caseNumber = CASE_PREFIX + rawCaseNumber;
    const res = await client.query(
        `SELECT a.id::text, a.case_number, a.status, a.officer_id::text, a.apply_at,
                a.approved_amount::numeric AS approved_amount, a.early_close_reason,
                w.stage,
                (SELECT COALESCE(SUM(amount), 0)::numeric FROM payment_disbursements p
                  WHERE p.application_id = a.id AND (p.received_at IS NOT NULL OR p.is_legacy_import)) AS paid
         FROM applications a
         LEFT JOIN LATERAL (
             SELECT stage FROM application_workflow
             WHERE application_id = a.id ORDER BY id DESC LIMIT 1
         ) w ON TRUE
         WHERE a.case_number = $1
         FOR UPDATE OF a`,
        [caseNumber]
    );
    if (res.rowCount === 0) throw new Abort(`${caseNumber}：找不到案件`);
    return res.rows[0];
}

function summarize(row) {
    return `status=${row.status} stage=${row.stage} 核定=${row.approved_amount ?? '-'} 已撥=${Number(row.paid)} 提前結案原因=${row.early_close_reason ?? '-'}`;
}

async function fixPayment(client, fix) {
    const before = await loadCase(client, fix.caseNumber);
    const receiptNumber = `IMP-${before.case_number}-01`;
    const actions = [];

    const alreadyDone = before.status === fix.toStatus
        && (await client.query(
            `SELECT 1 FROM payment_disbursements WHERE application_id = $1::bigint AND receipt_number = $2`,
            [before.id, receiptNumber]
        )).rowCount > 0;
    if (alreadyDone) return { caseNumber: fix.caseNumber, before, after: before, actions: ['已修正過，略過'] };

    if (!fix.fromStatus.includes(before.status)) {
        throw new Abort(`${fix.caseNumber}：目前 status=${before.status}，預期 ${fix.fromStatus.join('/')}，可能已被人工異動`);
    }
    if (fix.enterReimbursement) {
        if (before.stage !== 'admin_review') {
            throw new Abort(`${fix.caseNumber}：目前階段 ${before.stage}，預期 admin_review`);
        }
        if (before.approved_amount != null && Number(before.approved_amount) !== fix.approved) {
            throw new Abort(`${fix.caseNumber}：已有核定金額 ${before.approved_amount}，與匯入表 ${fix.approved} 不符`);
        }
    } else {
        if (before.stage !== 'reimbursement') {
            throw new Abort(`${fix.caseNumber}：目前階段 ${before.stage}，預期 reimbursement`);
        }
        if (Number(before.approved_amount) !== fix.approved) {
            throw new Abort(`${fix.caseNumber}：核定金額 ${before.approved_amount}，與匯入表 ${fix.approved} 不符`);
        }
    }
    if (Number(before.paid) !== 0) {
        throw new Abort(`${fix.caseNumber}：系統內已有撥款 ${before.paid}，需人工確認是否與匯入表重複`);
    }

    if (fix.enterReimbursement) {
        await client.query(
            `INSERT INTO application_workflow
                (application_id, stage, reviewer_id, is_approved, comments, reviewed_at)
             VALUES ($1::bigint, 'reimbursement', $2::bigint, TRUE, $3, NOW())`,
            [before.id, before.officer_id, LEGACY_WORKFLOW_NOTE]
        );
        await client.query(
            `UPDATE applications
             SET approved_amount = $2,
                 supervisor_approved_for_board = TRUE,
                 supervisor_approved_for_accounting = TRUE,
                 updated_at = NOW()
             WHERE id = $1::bigint`,
            [before.id, fix.approved]
        );
        actions.push(`進入核銷撥款、核定 ${fix.approved}`);
    }

    await client.query(
        `INSERT INTO payment_disbursements
            (application_id, receipt_number, amount, notes, created_by, created_at, review_stage, is_legacy_import)
         VALUES ($1::bigint, $2, $3, $4, $5::bigint, $6, '9', TRUE)`,
        [before.id, receiptNumber, fix.paid, LEGACY_PAYMENT_NOTE, before.officer_id, before.apply_at]
    );
    actions.push(`補匯入撥款 ${receiptNumber} ${fix.paid}`);

    if (before.status !== fix.toStatus) {
        await client.query(
            `UPDATE applications SET status = $2, updated_at = NOW() WHERE id = $1::bigint`,
            [before.id, fix.toStatus]
        );
        actions.push(`status ${before.status} → ${fix.toStatus}`);
    }

    const after = await loadCase(client, fix.caseNumber);
    return { caseNumber: fix.caseNumber, before, after, actions };
}

async function fixCloseReason(client, fix) {
    const before = await loadCase(client, fix.caseNumber);
    if (before.early_close_reason === fix.to) {
        return { caseNumber: fix.caseNumber, before, after: before, actions: ['已修正過，略過'] };
    }
    if (before.status !== '4' || before.early_close_reason !== fix.from) {
        throw new Abort(`${fix.caseNumber}：目前 status=${before.status}、提前結案原因=${before.early_close_reason}，與預期不符`);
    }
    await client.query(
        `UPDATE applications SET early_close_reason = $2, updated_at = NOW() WHERE id = $1::bigint`,
        [before.id, fix.to]
    );
    const after = await loadCase(client, fix.caseNumber);
    return { caseNumber: fix.caseNumber, before, after, actions: [`提前結案原因 → ${fix.to}`] };
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const target = await client.query(`SELECT current_database() AS db`);
console.log(`目標資料庫：${target.rows[0].db}（${new URL(url).hostname}）`);
console.log(APPLY ? '模式：寫入（--apply）' : '模式：預覽（結束時 ROLLBACK，不寫入）');
if (CASE_PREFIX) console.log(`測試模式：案號前綴 ${CASE_PREFIX}（例如 ${CASE_PREFIX}A115016）`);

let exitCode = 0;
try {
    await client.query('BEGIN');
    const results = [];
    for (const fix of PAYMENT_FIXES) results.push(await fixPayment(client, fix));
    for (const fix of CLOSE_REASON_FIXES) results.push(await fixCloseReason(client, fix));

    for (const r of results) {
        console.log(`\n■ ${CASE_PREFIX}${r.caseNumber}`);
        console.log(`  修改前：${summarize(r.before)}`);
        console.log(`  修改後：${summarize(r.after)}`);
        for (const a of r.actions) console.log(`  - ${a}`);
    }

    if (APPLY) {
        await client.query('COMMIT');
        console.log('\n已寫入。');
    } else {
        await client.query('ROLLBACK');
        console.log('\n預覽完成，已 ROLLBACK。確認無誤後加上 --apply 執行。');
    }
} catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n中止，未寫入任何資料：${err.message}`);
    exitCode = 1;
} finally {
    await client.end();
}
process.exit(exitCode);
