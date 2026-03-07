'use strict';

const fs = require('fs');
const path = require('path');
const { ok, fail, info } = require('./ui.js');

function checkNodeVersion() {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0], 10);
  if (major < 16) {
    fail(`Node.js v${version} detectado - se requiere >= 16`);
    process.exit(1);
  }
  ok(`Node.js v${version} detectado`);
  return version;
}

function detectPackageJson(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fail('No se encontro package.json en el directorio actual');
    console.log('  Ejecuta este comando desde la raiz de tu proyecto.');
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  ok(`Proyecto: ${pkg.name || path.basename(cwd)} (package.json encontrado)`);
  return pkg;
}

const AI_SDKS = [
  { name: 'openai', label: 'openai' },
  { name: '@anthropic-ai/sdk', label: '@anthropic-ai/sdk' },
  { name: '@google/generative-ai', label: '@google/generative-ai' },
];

function detectInstalledSDKs(cwd) {
  const found = [];
  for (const sdk of AI_SDKS) {
    try {
      const sdkPkgPath = path.join(cwd, 'node_modules', ...sdk.name.split('/'), 'package.json');
      if (fs.existsSync(sdkPkgPath)) {
        found.push(sdk.label);
      }
    } catch (_) {
      // not installed
    }
  }
  if (found.length > 0) {
    ok(`SDKs detectados: ${found.join(', ')}`);
  } else {
    info('No se detectaron SDKs de IA instalados (openai, anthropic, gemini)');
  }
  return found;
}

function detectPackageManager(cwd) {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(cwd, 'bun.lockb'))) return 'bun';
  return 'npm';
}

module.exports = { checkNodeVersion, detectPackageJson, detectInstalledSDKs, detectPackageManager };
