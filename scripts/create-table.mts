import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query(CREATE TABLE IF NOT EXISTS clients (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_name VARCHAR(255) NOT NULL, access_token VARCHAR(80) NOT NULL UNIQUE, sdk_api_key VARCHAR(255) NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), notes TEXT););
await pool.query(CREATE INDEX IF NOT EXISTS idx_clients_access_token ON clients(access_token););
console.log('Table created');
await pool.end();
