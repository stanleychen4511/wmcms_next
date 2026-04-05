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
        const u = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        console.log('users columns:', u.rows.map(r=>r.column_name).join(', '));

        const a = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'applications'");
        console.log('applications columns:', a.rows.map(r=>r.column_name).join(', '));
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
