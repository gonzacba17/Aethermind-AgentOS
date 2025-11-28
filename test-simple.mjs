import { PrismaClient } from '@prisma/client';

const url = 'postgresql://aethermind:change_this_secure_password@localhost:5432/aethermind';
console.log('Testing Prisma connection to:', url.replace(/:[^:@]+@/, ':***@'));

const prisma = new PrismaClient({
  datasources: {
    db: { url }
  },
  log: ['error', 'warn']
});

try {
  await prisma.$connect();
  console.log('[OK] Prisma connected successfully!');
  
  const result = await prisma.$queryRaw`SELECT current_user, current_database(), version()`;
  console.log('[OK] Query result:', result[0]);
  
  await prisma.$disconnect();
  process.exit(0);
} catch (error) {
  console.error('[ERROR]', error.message);
  console.error('\nPossible causes:');
  console.error('1. PostgreSQL not accessible from Windows on localhost:5432');
  console.error('2. Password mismatch');
  console.error('3. Firewall blocking connection');
  process.exit(1);
}
