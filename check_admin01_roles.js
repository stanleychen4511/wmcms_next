const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf-8');
const match = envContent.match(/DATABASE_URL="([^"]+)"/);
if (!match) throw new Error('.env.local 中找不到 DATABASE_URL');

const pool = new Pool({ connectionString: match[1] });

async function run() {
  const res = await pool.query(`
    SELECT u.account, r.code, r.id as role_id
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE u.account = 'admin_01'
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}
run().catch(console.error);
