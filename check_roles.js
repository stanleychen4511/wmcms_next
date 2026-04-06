const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf-8');
const match = envContent.match(/DATABASE_URL="([^"]+)"/);
if (!match) throw new Error('.env.local 中找不到 DATABASE_URL');

const pool = new Pool({ connectionString: match[1] });

async function run() {
  const res = await pool.query('SELECT * FROM roles');
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}
run().catch(console.error);
