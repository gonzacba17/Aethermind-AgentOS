/**
 * Create a new B2B beta client.
 *
 * Usage:
 *   npx tsx scripts/create-client.ts "Company Name"
 *
 * Requires DATABASE_URL in .env or environment.
 */

import 'dotenv/config';
import crypto from 'crypto';
import { Pool } from 'pg';

const companyName = process.argv[2];

if (!companyName) {
  console.error('Usage: npx tsx scripts/create-client.ts "Company Name"');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it in .env or environment.');
  process.exit(1);
}

const accessToken = 'aether_client_' + crypto.randomBytes(32).toString('hex');
const sdkApiKey = 'aether_sdk_' + crypto.randomBytes(32).toString('hex');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

async function main() {
  try {
    const result = await pool.query(
      `INSERT INTO clients (company_name, access_token, sdk_api_key)
       VALUES ($1, $2, $3)
       RETURNING id, company_name, created_at`,
      [companyName, accessToken, sdkApiKey]
    );

    const row = result.rows[0];

    console.log('\n✅ Client created successfully!\n');
    console.log('  Company:      ', row.company_name);
    console.log('  Client ID:    ', row.id);
    console.log('  Created:      ', row.created_at);
    console.log('');
    console.log('  Access Token (for dashboard login & API):');
    console.log(`    ${accessToken}`);
    console.log('');
    console.log('  SDK API Key (for @aethermind/sdk):');
    console.log(`    ${sdkApiKey}`);
    console.log('');
    console.log('  Dashboard URL:');
    console.log(`    http://localhost:3000?token=${accessToken}`);
    console.log('');
  } catch (error) {
    console.error('Failed to create client:', (error as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
