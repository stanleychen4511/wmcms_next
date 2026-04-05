import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/DATABASE_URL="([^"]+)"/);
  if (match) {
    process.env.DATABASE_URL = match[1];
  }
}

async function run() {
    const { pool } = await import('../src/lib/db');
    try {
        const tables = ['application_documents', 'home_visit', 'application_workflow'];
        for (const t of tables) {
            const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'`);
            console.log(`Table ${t}:`, res.rows.length ? res.rows.map(r => r.column_name).join(', ') : 'DOES NOT EXIST');
        }
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
