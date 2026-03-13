import { createRequire } from 'node:module';

/**
 * Cross-environment require function.
 * - CJS: uses native require (available in module scope).
 * - ESM: uses createRequire with cwd as base for node_modules resolution.
 */
export const _require: NodeRequire = typeof require === 'function'
  ? require
  : createRequire(process.cwd() + '/');
