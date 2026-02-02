#!/usr/bin/env tsx
/**
 * Database Backup Script
 *
 * Features:
 * - Full and incremental backups
 * - Compression with gzip
 * - S3/local storage support
 * - Retention policy management
 * - Restore functionality
 * - Backup verification
 *
 * Usage:
 *   pnpm backup              # Run full backup
 *   pnpm backup --type=incr  # Run incremental backup
 *   pnpm backup --list       # List available backups
 *   pnpm backup --restore=filename.sql.gz  # Restore from backup
 *   pnpm backup --cleanup    # Remove old backups based on retention
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';

const execAsync = promisify(exec);

// ============================================
// CONFIGURATION
// ============================================

interface BackupConfig {
  // Database
  databaseUrl: string;
  databaseName: string;

  // Storage
  backupDir: string;
  s3Bucket?: string;
  s3Region?: string;

  // Retention
  retentionDays: number;
  maxBackups: number;

  // Options
  compress: boolean;
  verify: boolean;
}

const config: BackupConfig = {
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/aethermind',
  databaseName: process.env.DATABASE_NAME || 'aethermind',
  backupDir: process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'),
  s3Bucket: process.env.BACKUP_S3_BUCKET,
  s3Region: process.env.BACKUP_S3_REGION || 'us-east-1',
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  maxBackups: parseInt(process.env.BACKUP_MAX_COUNT || '50', 10),
  compress: process.env.BACKUP_COMPRESS !== 'false',
  verify: process.env.BACKUP_VERIFY !== 'false',
};

// ============================================
// BACKUP FUNCTIONS
// ============================================

interface BackupResult {
  success: boolean;
  filename: string;
  fileSize: number;
  duration: number;
  type: 'full' | 'incremental';
  timestamp: Date;
  error?: string;
}

async function ensureBackupDir(): Promise<void> {
  if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true });
    console.log(`Created backup directory: ${config.backupDir}`);
  }
}

function generateBackupFilename(type: 'full' | 'incremental'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = config.compress ? '.sql.gz' : '.sql';
  return `aethermind_${type}_${timestamp}${extension}`;
}

async function runPgDump(outputFile: string): Promise<void> {
  // Parse database URL
  const url = new URL(config.databaseUrl);
  const host = url.hostname;
  const port = url.port || '5432';
  const user = url.username;
  const password = url.password;
  const database = url.pathname.slice(1);

  const env = {
    ...process.env,
    PGPASSWORD: password,
  };

  const args = [
    '-h', host,
    '-p', port,
    '-U', user,
    '-d', database,
    '-F', 'p', // Plain text format
    '--no-owner',
    '--no-acl',
    '-v', // Verbose
  ];

  return new Promise((resolve, reject) => {
    const pgdump = spawn('pg_dump', args, { env });

    let outputStream: NodeJS.WritableStream;

    if (config.compress) {
      const gzip = zlib.createGzip({ level: 9 });
      const fileStream = fs.createWriteStream(outputFile);
      pgdump.stdout.pipe(gzip).pipe(fileStream);
      outputStream = fileStream;
    } else {
      outputStream = fs.createWriteStream(outputFile);
      pgdump.stdout.pipe(outputStream);
    }

    let stderr = '';
    pgdump.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress
      const line = data.toString().trim();
      if (line && !line.includes('NOTICE')) {
        console.log(`  ${line}`);
      }
    });

    pgdump.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_dump exited with code ${code}: ${stderr}`));
      }
    });

    pgdump.on('error', (err) => {
      reject(new Error(`Failed to start pg_dump: ${err.message}`));
    });
  });
}

async function createBackup(type: 'full' | 'incremental' = 'full'): Promise<BackupResult> {
  const startTime = Date.now();
  const filename = generateBackupFilename(type);
  const filepath = path.join(config.backupDir, filename);

  console.log(`\nStarting ${type} backup...`);
  console.log(`Output: ${filepath}`);

  try {
    await ensureBackupDir();
    await runPgDump(filepath);

    const stats = fs.statSync(filepath);
    const duration = Date.now() - startTime;

    console.log(`\nBackup completed successfully!`);
    console.log(`  File: ${filename}`);
    console.log(`  Size: ${formatBytes(stats.size)}`);
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);

    // Verify backup if enabled
    if (config.verify) {
      console.log(`\nVerifying backup...`);
      await verifyBackup(filepath);
      console.log(`  Verification passed!`);
    }

    // Upload to S3 if configured
    if (config.s3Bucket) {
      console.log(`\nUploading to S3...`);
      await uploadToS3(filepath, filename);
      console.log(`  Uploaded to s3://${config.s3Bucket}/${filename}`);
    }

    // Record in backup history (if database is available)
    await recordBackupHistory({
      filename,
      fileSize: stats.size,
      backupType: type,
      status: 'success',
      storageLocation: config.s3Bucket ? `s3://${config.s3Bucket}/${filename}` : filepath,
      startedAt: new Date(startTime),
      completedAt: new Date(),
    });

    return {
      success: true,
      filename,
      fileSize: stats.size,
      duration,
      type,
      timestamp: new Date(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\nBackup failed: ${errorMsg}`);

    await recordBackupHistory({
      filename,
      fileSize: 0,
      backupType: type,
      status: 'failed',
      error: errorMsg,
      startedAt: new Date(startTime),
      completedAt: new Date(),
    });

    return {
      success: false,
      filename,
      fileSize: 0,
      duration: Date.now() - startTime,
      type,
      timestamp: new Date(),
      error: errorMsg,
    };
  }
}

async function verifyBackup(filepath: string): Promise<boolean> {
  // For compressed files, verify gzip integrity
  if (filepath.endsWith('.gz')) {
    return new Promise((resolve, reject) => {
      const gunzip = zlib.createGunzip();
      const readStream = fs.createReadStream(filepath);

      let lineCount = 0;
      let hasCreateTable = false;

      gunzip.on('data', (chunk) => {
        const text = chunk.toString();
        lineCount += text.split('\n').length;
        if (text.includes('CREATE TABLE')) {
          hasCreateTable = true;
        }
      });

      readStream.pipe(gunzip);

      gunzip.on('end', () => {
        if (lineCount > 100 && hasCreateTable) {
          resolve(true);
        } else {
          reject(new Error('Backup verification failed: file appears incomplete'));
        }
      });

      gunzip.on('error', (err) => {
        reject(new Error(`Backup verification failed: ${err.message}`));
      });
    });
  }

  // For plain SQL files
  const content = fs.readFileSync(filepath, 'utf-8');
  if (content.includes('CREATE TABLE') && content.length > 1000) {
    return true;
  }

  throw new Error('Backup verification failed: file appears incomplete');
}

async function uploadToS3(filepath: string, filename: string): Promise<void> {
  // Using AWS CLI for simplicity
  const cmd = `aws s3 cp "${filepath}" "s3://${config.s3Bucket}/${filename}" --region ${config.s3Region}`;

  try {
    await execAsync(cmd);
  } catch (error) {
    throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : error}`);
  }
}

async function recordBackupHistory(data: {
  filename: string;
  fileSize: number;
  backupType: string;
  status: string;
  storageLocation?: string;
  error?: string;
  startedAt: Date;
  completedAt: Date;
}): Promise<void> {
  // Write to local JSON file for now
  const historyFile = path.join(config.backupDir, 'backup_history.json');

  let history: typeof data[] = [];
  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    } catch {
      history = [];
    }
  }

  history.push(data);

  // Keep only last N entries
  if (history.length > config.maxBackups * 2) {
    history = history.slice(-config.maxBackups * 2);
  }

  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

// ============================================
// RESTORE FUNCTIONS
// ============================================

async function restoreBackup(filename: string): Promise<void> {
  const filepath = path.join(config.backupDir, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Backup file not found: ${filepath}`);
  }

  console.log(`\nRestoring from: ${filename}`);
  console.log(`WARNING: This will overwrite existing data!`);

  // Parse database URL
  const url = new URL(config.databaseUrl);
  const host = url.hostname;
  const port = url.port || '5432';
  const user = url.username;
  const password = url.password;
  const database = url.pathname.slice(1);

  const env = {
    ...process.env,
    PGPASSWORD: password,
  };

  return new Promise((resolve, reject) => {
    const psql = spawn('psql', [
      '-h', host,
      '-p', port,
      '-U', user,
      '-d', database,
      '-v', 'ON_ERROR_STOP=1',
    ], { env });

    let inputStream: NodeJS.ReadableStream;

    if (filename.endsWith('.gz')) {
      const gunzip = zlib.createGunzip();
      const fileStream = fs.createReadStream(filepath);
      inputStream = fileStream.pipe(gunzip);
    } else {
      inputStream = fs.createReadStream(filepath);
    }

    inputStream.pipe(psql.stdin);

    let stderr = '';
    psql.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    psql.on('close', (code) => {
      if (code === 0) {
        console.log(`\nRestore completed successfully!`);
        resolve();
      } else {
        reject(new Error(`psql exited with code ${code}: ${stderr}`));
      }
    });

    psql.on('error', (err) => {
      reject(new Error(`Failed to start psql: ${err.message}`));
    });
  });
}

// ============================================
// CLEANUP FUNCTIONS
// ============================================

async function cleanupOldBackups(): Promise<number> {
  console.log(`\nCleaning up old backups...`);
  console.log(`  Retention: ${config.retentionDays} days`);
  console.log(`  Max backups: ${config.maxBackups}`);

  const files = fs.readdirSync(config.backupDir)
    .filter((f) => f.startsWith('aethermind_') && (f.endsWith('.sql') || f.endsWith('.sql.gz')))
    .map((f) => ({
      name: f,
      path: path.join(config.backupDir, f),
      stats: fs.statSync(path.join(config.backupDir, f)),
    }))
    .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

  let deletedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isOld = file.stats.mtime < cutoffDate;
    const isExcess = i >= config.maxBackups;

    if (isOld || isExcess) {
      console.log(`  Deleting: ${file.name} (${isOld ? 'old' : 'excess'})`);
      fs.unlinkSync(file.path);
      deletedCount++;
    }
  }

  console.log(`\nDeleted ${deletedCount} backup(s)`);
  return deletedCount;
}

// ============================================
// LIST BACKUPS
// ============================================

function listBackups(): void {
  console.log(`\nAvailable backups in: ${config.backupDir}\n`);

  if (!fs.existsSync(config.backupDir)) {
    console.log('  No backups found.');
    return;
  }

  const files = fs.readdirSync(config.backupDir)
    .filter((f) => f.startsWith('aethermind_') && (f.endsWith('.sql') || f.endsWith('.sql.gz')))
    .map((f) => {
      const filepath = path.join(config.backupDir, f);
      const stats = fs.statSync(filepath);
      return {
        name: f,
        size: stats.size,
        created: stats.mtime,
      };
    })
    .sort((a, b) => b.created.getTime() - a.created.getTime());

  if (files.length === 0) {
    console.log('  No backups found.');
    return;
  }

  console.log('  Filename                                          Size        Created');
  console.log('  ' + '-'.repeat(80));

  for (const file of files) {
    const name = file.name.padEnd(50);
    const size = formatBytes(file.size).padStart(10);
    const date = file.created.toISOString().slice(0, 19).replace('T', ' ');
    console.log(`  ${name} ${size}   ${date}`);
  }

  console.log(`\n  Total: ${files.length} backup(s)`);
}

// ============================================
// UTILITIES
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// CLI
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log('='.repeat(60));
  console.log('  Aethermind Database Backup Tool');
  console.log('='.repeat(60));

  try {
    if (args.includes('--list')) {
      listBackups();
    } else if (args.includes('--cleanup')) {
      await cleanupOldBackups();
    } else if (args.some((a) => a.startsWith('--restore='))) {
      const arg = args.find((a) => a.startsWith('--restore='));
      const filename = arg!.split('=')[1];
      await restoreBackup(filename);
    } else {
      const type = args.includes('--type=incr') ? 'incremental' : 'full';
      const result = await createBackup(type);

      if (!result.success) {
        process.exit(1);
      }

      // Run cleanup after successful backup
      await cleanupOldBackups();
    }
  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main();
