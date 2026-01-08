import { PrismaClient } from '@prisma/client';

const DATABASE_URL = 'postgresql://aethermind:aethermind123@localhost:5432/aethermind';

console.log('Testing Prisma connection...');
console.log('DATABASE_URL:', DATABASE_URL);
console.log('env.DATABASE_URL:', process.env.DATABASE_URL);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  try {
    console.log('\n🔍 Attempting to connect to database...');
    await prisma.$connect();
    console.log('✅ Successfully connected to PostgreSQL via Prisma!');
    
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('Database version:', result);
    
    await prisma.$disconnect();
    console.log('Connection closed.');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    process.exit(1);
  }
}

main();
