const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:dces5411@localhost:5432/WMCMS'
});

async function run() {
  const res = await pool.query('SELECT * FROM roles');
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}
run().catch(console.error);
