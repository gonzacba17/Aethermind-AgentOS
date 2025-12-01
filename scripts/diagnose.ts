#!/usr/bin/env tsx

import { execa } from 'execa';
import chalk from 'chalk';
import { createServer } from 'http';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Cargar variables de entorno desde .env
const projectRoot = resolve(process.cwd());
const envPath = resolve(projectRoot, '.env');

if (existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.warn(chalk.yellow('⚠️  Archivo .env no encontrado, usando variables del sistema\n'));
}

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function diagnose() {
  console.log(chalk.blue.bold('\n🔍 DIAGNÓSTICO RÁPIDO - AETHERMIND AGENTOS\n'));

  console.log(chalk.yellow('1. Verificando Docker...'));
  try {
    const { stdout } = await execa('docker', ['ps', '--format', 'table {{.Names}}\t{{.Status}}\t{{.Ports}}']);
    console.log(stdout);
    console.log(chalk.green('✅ Docker OK\n'));
  } catch (error) {
    console.error(chalk.red('❌ Docker no disponible'));
    console.error(chalk.gray(`   Error: ${error}\n`));
  }

  console.log(chalk.yellow('2. Verificando migraciones Prisma...'));
  try {
    const { stdout } = await execa('pnpm', ['prisma', 'migrate', 'status']);
    const lines = stdout.split('\n').slice(-10);
    lines.forEach(line => {
      if (line.includes('up to date')) {
        console.log(chalk.green(`✅ ${line}`));
      } else if (line.includes('migration')) {
        console.log(chalk.blue(`   ${line}`));
      }
    });
    console.log();
  } catch (error) {
    console.error(chalk.red('❌ Error en migraciones'));
    if (error instanceof Error && 'stdout' in error) {
      console.log(chalk.gray((error as any).stdout));
    }
    console.log();
  }

  console.log(chalk.yellow('3. Verificando puertos...'));
  const ports = [
    { port: 3000, service: 'Dashboard' },
    { port: 3001, service: 'API' },
    { port: 5432, service: 'PostgreSQL' },
    { port: 6379, service: 'Redis' }
  ];

  for (const { port, service } of ports) {
    const isAvailable = await checkPort(port);
    if (isAvailable) {
      console.log(chalk.gray(`⚪ Puerto ${port} (${service}): Libre`));
    } else {
      console.log(chalk.yellow(`⚠️  Puerto ${port} (${service}): En uso`));
    }
  }
  console.log();

  console.log(chalk.yellow('4. Verificando endpoints...'));
  const endpoints = [
    { url: 'http://localhost:3001/health', name: 'API Health' },
    { url: 'http://localhost:3000', name: 'Dashboard' }
  ];

  for (const { url, name } of endpoints) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        console.log(chalk.green(`✅ ${name}: Responde (${response.status})`));
      } else {
        console.log(chalk.yellow(`⚠️  ${name}: Responde con error (${response.status})`));
      }
    } catch {
      console.log(chalk.gray(`⚪ ${name}: No responde (normal si no está iniciado)`));
    }
  }
  console.log();

  console.log(chalk.yellow('5. Verificando variables de entorno...'));
  const requiredVars = ['DATABASE_URL', 'REDIS_URL', 'PORT', 'NODE_ENV'];
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      const displayValue = varName.includes('URL') || varName.includes('SECRET') 
        ? '***' 
        : value;
      console.log(chalk.green(`✅ ${varName}: ${displayValue}`));
    } else {
      console.log(chalk.red(`❌ ${varName}: NO definido`));
    }
  });
  console.log();

  console.log(chalk.yellow('6. Verificando estructura del proyecto...'));
  const criticalFiles = [
    'package.json',
    'docker-compose.yml',
    'prisma/schema.prisma',
    'apps/api/src/index.ts',
    'packages/core/src/index.ts'
  ];

  for (const file of criticalFiles) {
    const filePath = resolve(projectRoot, file);
    if (existsSync(filePath)) {
      console.log(chalk.green(`✅ ${file}`));
    } else {
      console.log(chalk.red(`❌ ${file} no encontrado`));
    }
  }
  console.log();

  console.log(chalk.blue.bold('📊 RESUMEN'));
  console.log(chalk.gray('Para iniciar la API manualmente:'));
  console.log(chalk.cyan('  pnpm --filter @aethermind/api dev'));
  console.log();
  console.log(chalk.gray('Para ejecutar validación completa:'));
  console.log(chalk.cyan('  pnpm validate:all'));
  console.log();
}

diagnose().catch((error) => {
  console.error(chalk.red('\n🚨 Error en diagnóstico:'), error);
  process.exit(1);
});
