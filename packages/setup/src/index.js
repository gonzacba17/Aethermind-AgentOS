'use strict';

const readline = require('readline');
const { banner, ok, info, separator, summary, c } = require('./ui.js');
const { checkNodeVersion, detectPackageJson, detectInstalledSDKs, detectPackageManager } = require('./detect.js');
const { validateApiKey } = require('./validate.js');
const { installProviders, uninstallProviders } = require('./install.js');
const { updateEnvFile, restoreEnvFile } = require('./env.js');

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function confirm(question) {
  return prompt(`${question} (s/n): `).then((a) => a.toLowerCase() === 's' || a.toLowerCase() === 'y');
}

async function runSetup() {
  const cwd = process.cwd();

  banner();

  // 1. Check Node version
  checkNodeVersion();

  // 2. Detect package.json
  const pkg = detectPackageJson(cwd);

  // 3. Detect installed SDKs
  const sdks = detectInstalledSDKs(cwd);

  // 4. Detect package manager
  const pm = detectPackageManager(cwd);

  separator();

  // 5. Ask for API key
  const apiKey = await prompt(c.cyan('  ? ') + 'Ingresa tu AETHERMIND_API_KEY: ');

  if (!apiKey) {
    console.log(c.red('\n  API key no puede estar vacia.'));
    console.log('  Obtene tu key en: https://aethermind-agent-os-dashboard.vercel.app/settings\n');
    process.exit(1);
  }

  // 6. Validate API key
  await validateApiKey(apiKey);

  separator();

  // 7. Show what will be modified and confirm
  console.log('');
  console.log(c.bold('  Se realizaran los siguientes cambios:'));
  console.log(`    - Instalar @aethermind/providers (via ${pm})`);
  console.log('    - Agregar AETHERMIND_API_KEY al .env');
  console.log('    - Agregar --require @aethermind/providers/register a NODE_OPTIONS');
  console.log('');

  const proceed = await confirm(c.cyan('  ? ') + 'Continuar?');
  if (!proceed) {
    console.log('\n  Setup cancelado.\n');
    process.exit(0);
  }

  console.log('');

  // 8. Install @aethermind/providers
  installProviders(pm);

  // 9. Update .env
  updateEnvFile(cwd, apiKey);

  // 10. Show summary
  summary();
}

async function runUninstall() {
  const cwd = process.cwd();

  banner();
  console.log(c.yellow('  Desinstalando Aethermind AgentOS...\n'));

  const pm = detectPackageManager(cwd);

  const proceed = await confirm(c.cyan('  ? ') + 'Desinstalar @aethermind/providers y restaurar .env?');
  if (!proceed) {
    console.log('\n  Cancelado.\n');
    process.exit(0);
  }

  console.log('');

  // Uninstall package
  uninstallProviders(pm);

  // Restore .env
  restoreEnvFile(cwd);

  console.log(c.green('\n  Aethermind AgentOS desinstalado correctamente.\n'));
}

async function main({ uninstall = false } = {}) {
  if (uninstall) {
    return runUninstall();
  }
  return runSetup();
}

module.exports = { main };
