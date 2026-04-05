import * as fs from 'fs';
import * as path from 'path';

// Manual .env.local parsing MUST happen BEFORE importing something that uses process.env
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/DATABASE_URL="([^"]+)"/);
  if (match) {
    process.env.DATABASE_URL = match[1];
  }
}

async function runMigration() {
  const { pool } = await import('../src/lib/db');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Updating users table structure...');
    // Create users table if not exists or modify it
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      
      -- Create roles table
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- Clear roles and insert the defined 7 roles
      TRUNCATE TABLE roles CASCADE;
      INSERT INTO roles (code, name) VALUES 
        ('applicant', '申請人'),
        ('case_officer', '承辦人'),
        ('volunteer', '志工 / 社工'),
        ('supervisor', '主管'),
        ('accountant', '會計'),
        ('board_member', '董事 / 審核委員'),
        ('admin', '系統管理員');

      -- Update users table columns
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account') THEN
            ALTER TABLE users ADD COLUMN account VARCHAR(100) UNIQUE;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
            ALTER TABLE users DROP COLUMN username;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
            ALTER TABLE users DROP COLUMN role;
        END IF;

        -- Ensure encryption columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='id_number_enc') THEN
            ALTER TABLE users ADD COLUMN id_number_enc BYTEA;
            ALTER TABLE users ADD COLUMN id_number_iv BYTEA;
            ALTER TABLE users ADD COLUMN id_number_bidx VARCHAR(64);
            ALTER TABLE users ADD COLUMN name_enc BYTEA;
            ALTER TABLE users ADD COLUMN name_iv BYTEA;
            ALTER TABLE users ADD COLUMN name_bidx VARCHAR(64);
            ALTER TABLE users ADD COLUMN search_salt VARCHAR(64);
        END IF;

      END
      $$;
      
      -- Create user_roles mapping table
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role_id INT REFERENCES roles(id) ON DELETE CASCADE,
        assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id)
      );

    `);
    
    await client.query('COMMIT');
    console.log('Migration successful.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();
