// Test Prisma with environment variable override
process.env.DATABASE_URL = 'postgresql://aethermind:aethermind123@localhost:5432/aethermind';

import { PrismaClient } from '@prisma/client';

console.log('Creating PrismaClient with explicit DATABASE_URL...');
console.log('DATABASE_URL:', process.env.DATABASE_URL);

try {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://aethermind:aethermind123@localhost:5432/aethermind'
      }
    },
    log: ['query', 'info', 'warn', 'error'],
  });

  console.log('✅ PrismaClient created');
  
  console.log('🔍 Attempting to connect...');
  await prisma.$connect();
  console.log('✅ Successfully connected!');
  
  const result = await prisma.$queryRaw`SELECT version()`;
  console.log('✅  Query executed:', result);
  
  await prisma.$disconnect();
  console.log('✅ Disconnected successfully');
  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
