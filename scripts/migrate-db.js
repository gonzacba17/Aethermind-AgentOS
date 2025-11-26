// Database migration script
// Run with: node scripts/migrate-db.js

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
    console.log('🔄 Running database migrations...\n');

    try {
        // Read init.sql
        const sqlPath = join(__dirname, 'init.sql');
        const sql = await readFile(sqlPath, 'utf-8');

        console.log('📄 Found migration file: init.sql');
        console.log(`   ${sql.split('\n').length} lines\n`);

        // Try to find PostgreSQL container
        const containers = ['aethermind-postgres', 'postgres', 'aethermind_postgres_1'];
        let containerName = null;

        for (const name of containers) {
            try {
                const { stdout } = await execAsync(`docker ps --filter "name=${name}" --format "{{.Names}}"`);
                if (stdout.trim()) {
                    containerName = stdout.trim();
                    break;
                }
            } catch {
                continue;
            }
        }

        if (!containerName) {
            console.error('❌ PostgreSQL container not found');
            console.error('   Please start Docker services: pnpm docker:up');
            process.exit(1);
        }

        console.log(`✓ Found PostgreSQL container: ${containerName}\n`);

        // Execute migration
        console.log('⚡ Executing migration...');

        const command = `docker exec -i ${containerName} psql -U postgres -d aethermind`;
        const { stdout, stderr } = await execAsync(`echo "${sql.replace(/"/g, '\\"')}" | ${command}`);

        if (stderr && !stderr.includes('NOTICE')) {
            console.error('⚠️  Warnings:', stderr);
        }

        console.log('✅ Migration completed successfully!\n');

        // Verify tables
        console.log('🔍 Verifying tables...');
        const { stdout: tables } = await execAsync(
            `docker exec -i ${containerName} psql -U postgres -d aethermind -c "\\dt"`
        );

        console.log(tables);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrate();
