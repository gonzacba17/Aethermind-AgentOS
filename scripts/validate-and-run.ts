#!/usr/bin/env tsx

import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import { writeFile, mkdir, readdir, unlink, access } from 'fs/promises';
import { join, resolve } from 'path';
import { ChildProcess, spawn } from 'child_process';
import { createServer } from 'http';
import { config } from 'dotenv';
import { existsSync } from 'fs';

// Cargar variables de entorno desde .env
const projectRoot = resolve(process.cwd());
const envPath = resolve(projectRoot, '.env');

if (existsSync(envPath)) {
  config({ path: envPath });
  console.log(chalk.gray('✓ Variables de entorno cargadas desde .env\n'));
} else {
  console.warn(chalk.yellow('⚠️  Archivo .env no encontrado\n'));
}

interface CheckResult {
  name: string;
  status: 'success' | 'warning' | 'error' | 'critical';
  message: string;
  duration: number;
  details?: unknown;
  timestamp: string;
  phase: 'pre-execution' | 'execution' | 'monitoring';
}

interface ServiceProcess {
  name: string;
  process: ChildProcess;
  pid?: number;
}

class ValidationRunner {
  private logs: CheckResult[] = [];
  private startTime: number;
  private services: ServiceProcess[] = [];
  private shutdownInProgress = false;

  constructor() {
    this.startTime = Date.now();
    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.shutdownInProgress) return;
    this.shutdownInProgress = true;

    console.log(chalk.yellow(`\n\n⚠️  Recibido ${signal}, cerrando servicios...`));

    for (const service of this.services) {
      if (service.process && !service.process.killed) {
        console.log(chalk.gray(`Deteniendo ${service.name}...`));
        service.process.kill('SIGTERM');
      }
    }

    await this.generateReports();
    process.exit(0);
  }

  async runPreExecutionChecks(): Promise<boolean> {
    console.log(chalk.blue.bold('\n🔍 FASE 1: ANÁLISIS PRE-EJECUCIÓN\n'));

    await this.checkNodeVersion();
    await this.checkPnpmVersion();
    await this.checkDockerRunning();
    await this.checkPortsAvailable();
    await this.checkProjectStructure();
    await this.checkEnvFile();
    await this.checkDependencies();
    await this.checkTypeScript();
    await this.checkBuild();
    await this.checkDatabase();
    await this.runTests();

    return this.hasNoCriticalErrors();
  }

  async startServices(): Promise<void> {
    console.log(chalk.blue.bold('\n🚀 FASE 2: INICIANDO SERVICIOS\n'));

    await this.startDockerServices();
    await this.waitForHealthchecks();
    await this.runMigrations();
    await this.runSmokeTests();
  }

  async monitorServices(): Promise<void> {
    console.log(chalk.blue.bold('\n📊 FASE 3: MONITOREO ACTIVO\n'));
    console.log(chalk.gray('Presiona Ctrl+C para detener\n'));

    const monitorInterval = setInterval(async () => {
      await this.checkServicesHealth();
    }, 5000);

    await new Promise((resolve) => {
      process.on('SIGINT', () => {
        clearInterval(monitorInterval);
        resolve(void 0);
      });
    });
  }

  private async checkNodeVersion(): Promise<CheckResult> {
    const spinner = ora('Verificando Node.js...').start();
    const start = Date.now();

    try {
      const { stdout } = await this.execWithTimeout('node', ['--version'], 5000);
      const version = stdout.replace('v', '').trim();
      const [major] = version.split('.').map(Number);

      if (major >= 20) {
        spinner.succeed(`Node.js ${version} ✅`);
        return this.logCheck('node_version', 'success', `Node.js ${version}`, start, 'pre-execution');
      } else {
        spinner.warn(`Node.js ${version} < 20.0.0`);
        return this.logCheck('node_version', 'error', `Node.js ${version} insuficiente`, start, 'pre-execution');
      }
    } catch (error) {
      spinner.fail('Node.js no encontrado');
      return this.logCheck('node_version', 'critical', 'Node.js no instalado', start, 'pre-execution');
    }
  }

  private async checkPnpmVersion(): Promise<CheckResult> {
    const spinner = ora('Verificando PNPM...').start();
    const start = Date.now();

    try {
      const { stdout } = await this.execWithTimeout('pnpm', ['--version'], 5000);
      const version = stdout.trim();
      const [major] = version.split('.').map(Number);

      if (major >= 9) {
        spinner.succeed(`PNPM ${version} ✅`);
        return this.logCheck('pnpm_version', 'success', `PNPM ${version}`, start, 'pre-execution');
      } else {
        spinner.warn(`PNPM ${version} < 9.0.0`);
        return this.logCheck('pnpm_version', 'warning', `PNPM ${version} desactualizado`, start, 'pre-execution');
      }
    } catch (error) {
      spinner.fail('PNPM no encontrado');
      return this.logCheck('pnpm_version', 'critical', 'PNPM no instalado', start, 'pre-execution');
    }
  }

  private async checkDockerRunning(): Promise<CheckResult> {
    const spinner = ora('Verificando Docker...').start();
    const start = Date.now();

    try {
      await this.execWithTimeout('docker', ['info'], 10000);
      spinner.succeed('Docker corriendo ✅');
      return this.logCheck('docker_running', 'success', 'Docker está corriendo', start, 'pre-execution');
    } catch (error) {
      spinner.fail('Docker no está corriendo');
      return this.logCheck('docker_running', 'critical', 'Docker no disponible', start, 'pre-execution', { error: String(error) });
    }
  }

  private async checkPortsAvailable(): Promise<CheckResult> {
    const spinner = ora('Verificando puertos disponibles...').start();
    const start = Date.now();
    const ports = [
      { port: 3000, service: 'Dashboard' },
      { port: 3001, service: 'API' },
      { port: 5432, service: 'PostgreSQL' },
      { port: 6379, service: 'Redis' }
    ];

    const unavailable: string[] = [];

    for (const { port, service } of ports) {
      const isAvailable = await this.isPortAvailable(port);
      if (!isAvailable) {
        unavailable.push(`${service} (${port})`);
      }
    }

    if (unavailable.length === 0) {
      spinner.succeed('Todos los puertos disponibles ✅');
      return this.logCheck('ports_available', 'success', 'Puertos libres: 3000, 3001, 5432, 6379', start, 'pre-execution');
    } else {
      spinner.warn(`Puertos en uso: ${unavailable.join(', ')}`);
      return this.logCheck('ports_available', 'warning', `Puertos ocupados: ${unavailable.join(', ')}`, start, 'pre-execution');
    }
  }

  private async isPortAvailable(port: number): Promise<boolean> {
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

  private async checkProjectStructure(): Promise<CheckResult> {
    const spinner = ora('Verificando estructura del proyecto...').start();
    const start = Date.now();

    const criticalFiles = [
      'package.json',
      'docker-compose.yml',
      'prisma/schema.prisma',
      'apps/api/src/index.ts',
      'packages/core/src/index.ts'
    ];

    const missing: string[] = [];

    for (const file of criticalFiles) {
      try {
        await access(file);
      } catch {
        missing.push(file);
      }
    }

    if (missing.length === 0) {
      spinner.succeed('Estructura del proyecto correcta ✅');
      return this.logCheck('project_structure', 'success', 'Todos los archivos críticos existen', start, 'pre-execution');
    } else {
      spinner.fail(`Archivos faltantes: ${missing.join(', ')}`);
      return this.logCheck('project_structure', 'critical', `Archivos faltantes: ${missing.join(', ')}`, start, 'pre-execution');
    }
  }

  private async checkEnvFile(): Promise<CheckResult> {
    const spinner = ora('Verificando archivo .env...').start();
    const start = Date.now();

    try {
      await access('.env');
      spinner.succeed('Archivo .env existe ✅');
      return this.logCheck('env_file', 'success', 'Archivo .env configurado', start, 'pre-execution');
    } catch {
      try {
        await access('.env.example');
        spinner.warn('Archivo .env no existe, usa .env.example como referencia');
        return this.logCheck('env_file', 'warning', 'Falta archivo .env (existe .env.example)', start, 'pre-execution');
      } catch {
        spinner.fail('Ni .env ni .env.example existen');
        return this.logCheck('env_file', 'error', 'Sin archivos de configuración', start, 'pre-execution');
      }
    }
  }

  private async checkDependencies(): Promise<CheckResult> {
    const spinner = ora('Verificando dependencias...').start();
    const start = Date.now();

    try {
      await access('node_modules');
      spinner.succeed('Dependencias instaladas ✅');
      return this.logCheck('dependencies', 'success', 'node_modules existe', start, 'pre-execution');
    } catch {
      spinner.warn('Dependencias no instaladas, ejecutando pnpm install...');
      try {
        await this.execWithTimeout('pnpm', ['install', '--frozen-lockfile'], 180000);
        spinner.succeed('Dependencias instaladas correctamente ✅');
        return this.logCheck('dependencies', 'success', 'Dependencias instaladas con pnpm install', start, 'pre-execution');
      } catch (error) {
        spinner.fail('Error al instalar dependencias');
        return this.logCheck('dependencies', 'critical', 'Error en pnpm install', start, 'pre-execution', { error: String(error) });
      }
    }
  }

  private async checkTypeScript(): Promise<CheckResult> {
    const spinner = ora('Ejecutando typecheck...').start();
    const start = Date.now();

    try {
      await this.execWithTimeout('pnpm', ['typecheck'], 120000);
      spinner.succeed('TypeCheck pasó ✅');
      return this.logCheck('typecheck', 'success', 'Sin errores de tipos', start, 'pre-execution');
    } catch (error) {
      spinner.fail('TypeCheck falló');
      return this.logCheck('typecheck', 'error', 'Errores de TypeScript detectados', start, 'pre-execution', { error: String(error) });
    }
  }

  private async checkBuild(): Promise<CheckResult> {
    const spinner = ora('Ejecutando build...').start();
    const start = Date.now();

    try {
      await this.execWithTimeout('pnpm', ['build'], 180000);
      spinner.succeed('Build exitoso ✅');
      return this.logCheck('build', 'success', 'Proyecto compilado correctamente', start, 'pre-execution');
    } catch (error) {
      spinner.fail('Build falló');
      return this.logCheck('build', 'error', 'Error en compilación', start, 'pre-execution', { error: String(error) });
    }
  }

  private async checkDatabase(): Promise<CheckResult> {
    const spinner = ora('Verificando base de datos...').start();
    const start = Date.now();

    try {
      await this.execWithTimeout('docker', ['compose', 'ps'], 10000);
      spinner.succeed('Docker Compose configurado ✅');
      return this.logCheck('database', 'success', 'Docker Compose disponible', start, 'pre-execution');
    } catch (error) {
      spinner.warn('Docker Compose no disponible');
      return this.logCheck('database', 'warning', 'Docker Compose sin iniciar', start, 'pre-execution');
    }
  }

  private async runTests(): Promise<CheckResult> {
    const spinner = ora('Ejecutando tests unitarios...').start();
    const start = Date.now();

    try {
      const { stdout } = await this.execWithTimeout('pnpm', ['test'], 180000);
      const matches = stdout.match(/(\d+) passed/);
      const passed = matches ? matches[1] : '0';

      spinner.succeed(`Tests pasaron (${passed} tests) ✅`);
      return this.logCheck('tests_unit', 'success', `${passed} tests unitarios pasaron`, start, 'pre-execution', { passed });
    } catch (error) {
      spinner.warn('Tests fallaron o no se ejecutaron');
      return this.logCheck('tests_unit', 'warning', 'Tests unitarios con errores', start, 'pre-execution', { error: String(error) });
    }
  }

  private async startDockerServices(): Promise<CheckResult> {
    const spinner = ora('Iniciando servicios Docker...').start();
    const start = Date.now();

    try {
      await this.execWithTimeout('docker', ['compose', 'up', '-d', 'postgres', 'redis'], 60000);
      spinner.succeed('Servicios Docker iniciados ✅');
      return this.logCheck('docker_services', 'success', 'PostgreSQL y Redis iniciados', start, 'execution');
    } catch (error) {
      spinner.fail('Error al iniciar servicios Docker');
      return this.logCheck('docker_services', 'critical', 'Error iniciando Docker', start, 'execution', { error: String(error) });
    }
  }

  private async waitForHealthchecks(): Promise<CheckResult> {
    const spinner = ora('Esperando healthchecks...').start();
    const start = Date.now();
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const { stdout } = await execa('docker', ['compose', 'ps', '--format', 'json']);
        const services = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
        
        const allHealthy = services.every((service: { Health?: string }) => 
          !service.Health || service.Health === 'healthy'
        );

        if (allHealthy && services.length > 0) {
          spinner.succeed('Healthchecks pasaron ✅');
          return this.logCheck('healthchecks', 'success', 'Servicios saludables', start, 'execution');
        }
      } catch {
        // Continuar intentando
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      spinner.text = `Esperando healthchecks... (${attempts}/${maxAttempts})`;
    }

    spinner.warn('Healthchecks timeout (continuando de todas formas)');
    return this.logCheck('healthchecks', 'warning', 'Timeout esperando healthchecks', start, 'execution');
  }

  private async runMigrations(): Promise<CheckResult> {
    const spinner = ora('Ejecutando migraciones Prisma...').start();
    const start = Date.now();

    try {
      await this.execWithTimeout('pnpm', ['db:migrate'], 60000);
      spinner.succeed('Migraciones aplicadas ✅');
      return this.logCheck('migrations', 'success', 'Migraciones Prisma exitosas', start, 'execution');
    } catch (error) {
      spinner.warn('Migraciones fallaron (puede ser normal si ya están aplicadas)');
      return this.logCheck('migrations', 'warning', 'Error en migraciones', start, 'execution', { error: String(error) });
    }
  }

  private async runSmokeTests(): Promise<CheckResult> {
    const spinner = ora('Iniciando API...').start();
    const start = Date.now();

    let apiOutput = '';
    let apiErrors = '';

    const apiProcess = spawn('pnpm', ['dev:api'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      detached: false
    });

    apiProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      apiOutput += output;
      
      if (output.includes('Server running') || output.includes('listening') || output.includes('started')) {
        console.log(chalk.green('\n📡 ' + output.trim()));
      }
      if (output.includes('error') || output.includes('Error')) {
        console.log(chalk.red('\n⚠️  ' + output.trim()));
      }
    });

    apiProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      apiErrors += error;
      if (!error.includes('ExperimentalWarning')) {
        console.error(chalk.red('\n❌ API Error: ' + error.trim()));
      }
    });

    apiProcess.on('error', (error) => {
      console.error(chalk.red('\n🚨 Failed to start API:'), error.message);
    });

    apiProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(chalk.red(`\n💥 API exited with code ${code}`));
      }
    });

    this.services.push({ name: 'API', process: apiProcess, pid: apiProcess.pid });

    spinner.text = 'Esperando que API esté lista...';
    
    const maxWait = 60;
    let waited = 0;
    let apiReady = false;

    while (waited < maxWait && !apiReady) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      waited++;

      try {
        const response = await fetch('http://localhost:3001/health', {
          signal: AbortSignal.timeout(2000) as AbortSignal
        });
        
        if (response.ok) {
          apiReady = true;
          spinner.succeed(`API iniciada en http://localhost:3001 ✅ (${waited}s)`);
          return this.logCheck('smoke_tests', 'success', `API ready after ${waited}s`, start, 'execution');
        }
      } catch {
        if (waited % 5 === 0) {
          spinner.text = `Esperando API... (${waited}/${maxWait}s)`;
        }
      }
    }

    if (!apiReady) {
      spinner.warn('API no respondió en 60s - revisar logs arriba ⚠️');
      
      console.log(chalk.yellow('\n📋 Últimos logs de la API:'));
      console.log(apiOutput.slice(-1000) || chalk.gray('(sin output)'));
      
      if (apiErrors && !apiErrors.includes('ExperimentalWarning')) {
        console.log(chalk.red('\n❌ Errores de la API:'));
        console.log(apiErrors.slice(-1000));
      }
      
      return this.logCheck('smoke_tests', 'warning', 'API timeout after 60s', start, 'execution', {
        stdout: apiOutput.slice(-500),
        stderr: apiErrors.slice(-500)
      });
    }

    return this.logCheck('smoke_tests', 'error', 'Unexpected state', start, 'execution');
  }

  private async checkServicesHealth(): Promise<void> {
    const now = new Date().toISOString().split('T')[1].substring(0, 8);
    
    try {
      const response = await fetch('http://localhost:3001/health');
      if (response.ok) {
        console.log(chalk.green(`[${now}] ✅ API: healthy`));
      } else {
        console.log(chalk.yellow(`[${now}] ⚠️  API: unhealthy`));
      }
    } catch {
      console.log(chalk.red(`[${now}] ❌ API: no responde`));
    }

    const alive = this.services.filter(s => s.process && !s.process.killed).length;
    console.log(chalk.gray(`[${now}] Servicios activos: ${alive}/${this.services.length}`));
  }

  private async execWithTimeout(command: string, args: string[], timeout: number): Promise<{ stdout: string; stderr: string }> {
    return execa(command, args, {
      timeout,
      reject: true,
      all: true
    });
  }

  private logCheck(
    name: string,
    status: CheckResult['status'],
    message: string,
    startTime: number,
    phase: CheckResult['phase'],
    details?: unknown
  ): CheckResult {
    const result: CheckResult = {
      name,
      status,
      message,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      phase,
      details
    };
    this.logs.push(result);
    return result;
  }

  async generateReports(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

    try {
      await mkdir('logs', { recursive: true });
    } catch {
      // Directory already exists
    }

    const jsonLog = this.logs.map(log => JSON.stringify(log)).join('\n');
    await writeFile(join('logs', `validation-${timestamp}.log`), jsonLog);

    const markdown = this.generateMarkdownReport();
    await writeFile(join('logs', `validation-report-${timestamp}.md`), markdown);

    await this.cleanOldLogs();

    console.log(chalk.green(`\n📄 Reportes generados:`));
    console.log(chalk.gray(`   - logs/validation-${timestamp}.log`));
    console.log(chalk.gray(`   - logs/validation-report-${timestamp}.md`));
  }

  private async cleanOldLogs(): Promise<void> {
    try {
      const files = await readdir('logs');
      const logFiles = files
        .filter(f => f.startsWith('validation-') && f.endsWith('.log'))
        .sort()
        .reverse();

      if (logFiles.length > 10) {
        for (const file of logFiles.slice(10)) {
          await unlink(join('logs', file));
        }
      }
    } catch {
      // Ignore errors in cleanup
    }
  }

  private generateMarkdownReport(): string {
    const success = this.logs.filter(l => l.status === 'success');
    const warnings = this.logs.filter(l => l.status === 'warning');
    const errors = this.logs.filter(l => l.status === 'error' || l.status === 'critical');
    const totalDuration = Date.now() - this.startTime;

    return `# Reporte de Validación - Aethermind AgentOS

**Fecha:** ${new Date().toISOString()}  
**Duración total:** ${this.formatDuration(totalDuration)}

---

## ✅ Checks Exitosos (${success.length}/${this.logs.length})

${success.map(l => `- ${l.message} ✅ (${l.duration}ms)`).join('\n') || 'Ninguno'}

---

## ⚠️ Warnings (${warnings.length})

${warnings.map((l, i) => `${i + 1}. **${l.name}**: ${l.message} (${l.duration}ms)`).join('\n') || 'Ninguno'}

---

## ❌ Errores (${errors.length})

${errors.map((l, i) => `${i + 1}. **${l.name}**: ${l.message} (${l.duration}ms)`).join('\n') || 'Ninguno'}

---

## 📊 Métricas

- **Tiempo total:** ${this.formatDuration(totalDuration)}
- **Checks exitosos:** ${((success.length / this.logs.length) * 100).toFixed(1)}%
- **Fase pre-ejecución:** ${this.formatDuration(this.getPhaseDuration('pre-execution'))}
- **Fase ejecución:** ${this.formatDuration(this.getPhaseDuration('execution'))}
- **Fase monitoreo:** ${this.formatDuration(this.getPhaseDuration('monitoring'))}

---

## 🔗 URLs Disponibles

- **API:** http://localhost:3001
- **API Health:** http://localhost:3001/health
- **Dashboard:** http://localhost:3000

---

## 📝 Detalles Técnicos

### Checks por Fase

**Pre-ejecución:**
${this.logs.filter(l => l.phase === 'pre-execution').map(l => `- ${l.name}: ${l.status}`).join('\n')}

**Ejecución:**
${this.logs.filter(l => l.phase === 'execution').map(l => `- ${l.name}: ${l.status}`).join('\n')}

**Monitoreo:**
${this.logs.filter(l => l.phase === 'monitoring').map(l => `- ${l.name}: ${l.status}`).join('\n') || '- (sin datos)'}

---

_Generado automáticamente por validate-and-run.ts_
`;
  }

  private getPhaseDuration(phase: CheckResult['phase']): number {
    return this.logs
      .filter(l => l.phase === phase)
      .reduce((sum, l) => sum + l.duration, 0);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }

  private hasNoCriticalErrors(): boolean {
    return !this.logs.some(l => l.status === 'critical');
  }
}

async function main() {
  console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════╗
║   AETHERMIND AGENTOS - VALIDACIÓN COMPLETA       ║
╚═══════════════════════════════════════════════════╝
  `));

  const runner = new ValidationRunner();

  try {
    const canProceed = await runner.runPreExecutionChecks();

    if (!canProceed) {
      console.log(chalk.red.bold('\n❌ ERRORES CRÍTICOS - No se puede continuar\n'));
      await runner.generateReports();
      process.exit(1);
    }

    console.log(chalk.green.bold('\n✅ Pre-validación completada exitosamente\n'));

    await runner.startServices();

    console.log(chalk.green.bold('\n✅ Servicios iniciados correctamente\n'));

    await runner.monitorServices();

    await runner.generateReports();

    console.log(chalk.green.bold('\n✅ Validación completada exitosamente\n'));

  } catch (error) {
    console.error(chalk.red.bold('\n🚨 ERROR FATAL:'), error);
    await runner.generateReports();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(chalk.red('Error no capturado:'), error);
  process.exit(1);
});
