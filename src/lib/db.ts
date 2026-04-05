import { Pool } from 'pg';

// Using a standard singleton pattern for the Pool in Next.js
// so that Hot Module Replacement doesn't spawn hundreds of database connections.
const globalForPg = globalThis as unknown as {
  pgPool: Pool | undefined;
};

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Add additional configurations if required
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;

export default pool;
