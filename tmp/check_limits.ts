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
        const res = await pool.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name IN ('applications', 'application_workflow')
              AND character_maximum_length IS NOT NULL
            ORDER BY table_name, column_name
        `);
        console.log('Varchar columns with limits:');
        res.rows.forEach(r => console.log(`  ${r.table_name ?? ''}.${r.column_name}: varchar(${r.character_maximum_length})`));
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
