import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/DATABASE_URL="([^"]+)"/);
  if (match) process.env.DATABASE_URL = match[1];
}

async function run() {
    const { pool } = await import('../src/lib/db');
    try {
        // See existing distinct values in status and case_number to understand the format
        const s = await pool.query(`SELECT DISTINCT status FROM applications LIMIT 20`);
        console.log('Existing status values:', s.rows.map(r => r.status));

        const cn = await pool.query(`SELECT case_number FROM applications LIMIT 5`);
        console.log('Existing case_number values:', cn.rows.map(r => r.case_number));

        const wf = await pool.query(`SELECT DISTINCT stage FROM application_workflow LIMIT 20`);
        console.log('Existing workflow stage values:', wf.rows.map(r => r.stage));

    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
