import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables from root .env
dotenv.config({ path: '../../.env' });

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
