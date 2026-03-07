#!/usr/bin/env node

'use strict';

const path = require('path');
const { main } = require('../src/index.js');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  Usage: npx @aethermind/setup [options]

  Options:
    --uninstall    Revert all changes made by setup
    --help, -h     Show this help message
    --version, -v  Show version
  `);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  const pkg = require('../package.json');
  console.log(pkg.version);
  process.exit(0);
}

const uninstall = args.includes('--uninstall');

main({ uninstall }).catch((err) => {
  console.error('\n\x1b[31mError:\x1b[0m', err.message || err);
  process.exit(1);
});
