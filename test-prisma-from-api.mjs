// Test Prisma connection with exact same setup as API
import { PrismaClient } from '@prisma/client';

// Simular lo que hace dotenv
const DATABASE_URL = 'postgresql://aethermind:change_this_secure_password@localhost:5432/aethermind';
process.env.DATABASE_URL = DATABASE_URL;

console.log('Testing with DATABASE_URL:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
console.log('');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

try {
  console.log('Attempting to connect...');
  await prisma.$connect();
  console.log('[SUCCESS] Prisma connected!');
  
  const result = await prisma.$queryRaw`SELECT current_user, current_database(), version()`;
  console.log('[SUCCESS] Query result:', result[0]);
  
  await prisma.$disconnect();
  
  console.log('');
  console.log('===========================================');
  console.log('Prisma CAN connect from your Windows Node.js');
  console.log('===========================================');
  console.log('');
  console.log('The API might be using a different DATABASE_URL or NODE_ENV.');
  console.log('Check the API logs when it starts for connection errors.');
  
  process.exit(0);
} catch (error) {
  console.error('[ERROR]', error.message);
  console.error('');
  console.error('Full error:', error);
  
  console.log('');
  console.log('===========================================');
  console.log('Prisma CANNOT connect from Windows Node.js');
  console.log('===========================================');
  console.log('');
  console.log('This means the password is still not synchronized.');
  console.log('Try running this command again:');
  console.log('  docker exec aethermindagentos-postgres-1 psql -U aethermind -d aethermind -c "ALTER USER aethermind WITH PASSWORD \'change_this_secure_password\';"');
  
  process.exit(1);
}
