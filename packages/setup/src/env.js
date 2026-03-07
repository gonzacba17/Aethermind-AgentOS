'use strict';

const fs = require('fs');
const path = require('path');
const { ok, info } = require('./ui.js');

const ENV_KEYS = {
  AETHERMIND_API_KEY: null,
  NODE_OPTIONS: '--require @aethermind/providers/register',
};

function updateEnvFile(cwd, apiKey) {
  const envPath = path.join(cwd, '.env');
  const backupPath = path.join(cwd, '.env.aethermind.backup');
  let existing = '';

  // Backup existing .env
  if (fs.existsSync(envPath)) {
    existing = fs.readFileSync(envPath, 'utf-8');
    fs.copyFileSync(envPath, backupPath);
    ok('Backup guardado en .env.aethermind.backup');
  }

  const lines = existing ? existing.split('\n') : [];
  const updates = {
    AETHERMIND_API_KEY: apiKey,
    NODE_OPTIONS: buildNodeOptions(lines),
  };

  let content = existing;

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;

    if (regex.test(content)) {
      content = content.replace(regex, newLine);
    } else {
      if (content && !content.endsWith('\n')) {
        content += '\n';
      }
      content += newLine + '\n';
    }
  }

  fs.writeFileSync(envPath, content, 'utf-8');
  ok('.env actualizado');
}

function buildNodeOptions(lines) {
  const requireFlag = '--require @aethermind/providers/register';
  const existingLine = lines.find((l) => l.startsWith('NODE_OPTIONS='));

  if (existingLine) {
    const existingValue = existingLine.replace('NODE_OPTIONS=', '');
    if (existingValue.includes(requireFlag)) {
      return existingValue;
    }
    return existingValue ? `${existingValue} ${requireFlag}` : requireFlag;
  }

  return requireFlag;
}

function restoreEnvFile(cwd) {
  const envPath = path.join(cwd, '.env');
  const backupPath = path.join(cwd, '.env.aethermind.backup');

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, envPath);
    fs.unlinkSync(backupPath);
    ok('.env restaurado desde backup');
  } else if (fs.existsSync(envPath)) {
    // Remove our additions from .env
    let content = fs.readFileSync(envPath, 'utf-8');
    content = content.replace(/^AETHERMIND_API_KEY=.*\n?/m, '');
    // Remove our require from NODE_OPTIONS
    content = content.replace(/ ?--require @aethermind\/providers\/register/g, '');
    // Remove empty NODE_OPTIONS line
    content = content.replace(/^NODE_OPTIONS=\s*\n?/m, '');
    fs.writeFileSync(envPath, content, 'utf-8');
    ok('Entradas de Aethermind removidas del .env');
  } else {
    info('No se encontro .env para restaurar');
  }
}

module.exports = { updateEnvFile, restoreEnvFile };
