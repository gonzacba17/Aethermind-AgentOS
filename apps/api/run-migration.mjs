import pg from 'pg';
import fs from 'fs';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:MbrlyBAUgOnKxEtudWKrqDzzIxMySErN@maglev.proxy.rlwy.net:19475/railway',
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync('./src/db/migrations/0021_multi_agent_tracing.sql', 'utf8');

await client.connect();
console.log('Connected');
await client.query(sql);
console.log('Migration applied successfully');
await client.end();