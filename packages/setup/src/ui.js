'use strict';

const isColorSupported = process.stdout.isTTY && !process.env.NO_COLOR;

const c = {
  green: (s) => isColorSupported ? `\x1b[32m${s}\x1b[0m` : s,
  red: (s) => isColorSupported ? `\x1b[31m${s}\x1b[0m` : s,
  yellow: (s) => isColorSupported ? `\x1b[33m${s}\x1b[0m` : s,
  cyan: (s) => isColorSupported ? `\x1b[36m${s}\x1b[0m` : s,
  bold: (s) => isColorSupported ? `\x1b[1m${s}\x1b[0m` : s,
  dim: (s) => isColorSupported ? `\x1b[2m${s}\x1b[0m` : s,
};

function banner() {
  console.log('');
  console.log(c.cyan('+---------------------------------+'));
  console.log(c.cyan('|') + c.bold('   Aethermind AgentOS Setup      ') + c.cyan('|'));
  console.log(c.cyan('+---------------------------------+'));
  console.log('');
}

function ok(msg) {
  console.log(c.green('  OK ') + msg);
}

function fail(msg) {
  console.log(c.red('  X ') + msg);
}

function info(msg) {
  console.log(c.yellow('  ! ') + msg);
}

function separator() {
  console.log('');
  console.log(c.dim('  ' + '-'.repeat(35)));
}

function summary() {
  console.log('');
  console.log(c.dim('  ' + '='.repeat(35)));
  console.log(c.green(c.bold('  Listo. Tu app esta siendo monitoreada.')));
  console.log('');
  console.log('  Corre tu app normalmente:');
  console.log(c.cyan('    node index.js'));
  console.log('');
  console.log('  Mira tu dashboard:');
  console.log(c.cyan('    https://aethermind-agent-os-dashboard.vercel.app'));
  console.log(c.dim('  ' + '='.repeat(35)));
  console.log('');
}

module.exports = { banner, ok, fail, info, separator, summary, c };
