const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:dces5411@localhost:5432/WMCMS'
});

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
