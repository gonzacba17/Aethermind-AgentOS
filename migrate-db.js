const { execSync } = require('child_process');
console.log('🔧 Applying Prisma schema to Railway database...');
try {
  const output = execSync(
    'npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate',
    { encoding: 'utf-8', stdio: 'inherit', env: process.env }
  );
  console.log('✅ Schema applied successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Failed:', error.message);
  process.exit(1);
}
