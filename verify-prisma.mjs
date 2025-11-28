import { PrismaClient } from '@prisma/client';

console.log('✓ PrismaClient importado correctamente');

const prisma = new PrismaClient();
console.log('✓ PrismaClient instanciado correctamente');

// Verificar que los modelos están disponibles
console.log('✓ Modelos disponibles:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));

await prisma.$disconnect();
console.log('✓ Todas las verificaciones pasaron exitosamente!');
