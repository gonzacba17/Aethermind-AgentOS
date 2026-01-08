import { PrismaClient } from '@prisma/client';

console.log('Testing Prisma connection with port 5434...');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  try {
    console.log('🔍 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Successfully connected to PostgreSQL via Prisma!');
    
    console.log('📊 Testing query...');
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('Database version:', result);
    
    console.log('📊 Checking users table...');
    const userCount = await prisma.user.count();
    console.log(`Users in database: ${userCount}`);
    
    await prisma.$disconnect();
    console.log('✅ All tests passed! Connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
