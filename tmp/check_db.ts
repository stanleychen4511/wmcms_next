import * as fs from 'fs';
import * as path from 'path';

// Manual .env.local parsing MUST happen BEFORE importing something that uses process.env
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/DATABASE_URL="([^"]+)"/);
  if (match) {
    process.env.DATABASE_URL = match[1];
    console.log('Detected DATABASE_URL from .env.local');
  }
}

// Dynamic import to ensure process.env.DATABASE_URL is set
async function checkSchema() {
  const { pool } = await import('../src/lib/db');
  try {
    const tables = ['users', 'roles', 'user_roles'];
    for (const table of tables) {
      console.log(`--- Table: ${table} ---`);
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE lower(table_name) = lower('${table}')
        ORDER BY ordinal_position;
      `);
      console.table(res.rows);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
