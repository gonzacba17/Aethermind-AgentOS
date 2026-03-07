'use strict';

const { execSync } = require('child_process');
const { ok, fail } = require('./ui.js');

function installProviders(packageManager) {
  const cmds = {
    npm: 'npm install @aethermind/providers',
    pnpm: 'pnpm add @aethermind/providers',
    yarn: 'yarn add @aethermind/providers',
    bun: 'bun add @aethermind/providers',
  };

  const cmd = cmds[packageManager] || cmds.npm;

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 120000 });
    ok('@aethermind/providers instalado');
  } catch (err) {
    fail(`Error instalando @aethermind/providers con ${packageManager}`);
    console.log(`  Intenta manualmente: ${cmd}`);
    throw new Error(`Fallo la instalacion: ${err.message}`);
  }
}

function uninstallProviders(packageManager) {
  const cmds = {
    npm: 'npm uninstall @aethermind/providers',
    pnpm: 'pnpm remove @aethermind/providers',
    yarn: 'yarn remove @aethermind/providers',
    bun: 'bun remove @aethermind/providers',
  };

  const cmd = cmds[packageManager] || cmds.npm;

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 120000 });
    ok('@aethermind/providers desinstalado');
  } catch (_) {
    // may not be installed, that's ok
  }
}

module.exports = { installProviders, uninstallProviders };
