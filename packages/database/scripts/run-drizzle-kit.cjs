'use strict';

const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const packageDirectory = resolve(__dirname, '..');
const drizzleKitEntrypoint = resolve(
  packageDirectory,
  'node_modules',
  'drizzle-kit',
  'bin.cjs',
);
const command = process.argv.slice(2);

if (command.length === 0) {
  throw new Error('A Drizzle Kit command is required.');
}

if (!existsSync(drizzleKitEntrypoint)) {
  throw new Error('Local drizzle-kit entrypoint is unavailable.');
}

const result = spawnSync(process.execPath, [drizzleKitEntrypoint, ...command], {
  cwd: packageDirectory,
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
