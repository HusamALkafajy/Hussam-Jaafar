'use strict';

const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const packageDirectory = resolve(__dirname, '..');
const drizzleKitEntrypoint = resolve(
  packageDirectory,
  'node_modules',
  'drizzle-kit',
  'bin.cjs',
);
const migrationLockNamespace = 'studyai:drizzle-migration-orchestration';
const acquireMigrationLockSql = `
  SELECT pg_advisory_lock(
    hashtextextended($1::text || ':' || current_database()::text, 0)
  )
`;
const releaseMigrationLockSql = `
  SELECT pg_advisory_unlock(
    hashtextextended($1::text || ':' || current_database()::text, 0)
  ) AS unlocked
`;

// Drizzle reads its latest history row before opening the transaction that
// executes and records pending migrations. Keep that decision, execution,
// history insert, and commit inside one database-scoped advisory-lock lifetime.
// Migration 0022 retains its narrower transaction lock for schema adoption.
const runDrizzleKit = (command) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [drizzleKitEntrypoint, ...command], {
      cwd: packageDirectory,
      env: process.env,
      stdio: 'inherit',
      shell: false,
    });

    child.once('error', rejectPromise);
    child.once('exit', (status) => resolvePromise(status ?? 1));
  });

const withMigrationLock = async ({
  databaseUrl,
  postgresFactory,
  runMigration,
}) => {
  const client = postgresFactory(databaseUrl, {
    max: 1,
    max_lifetime: null,
  });
  let lockAcquired = false;

  try {
    await client.unsafe(acquireMigrationLockSql, [migrationLockNamespace]);
    lockAcquired = true;

    return await runMigration();
  } finally {
    try {
      if (lockAcquired) {
        const [result] = await client.unsafe(releaseMigrationLockSql, [
          migrationLockNamespace,
        ]);

        if (!result?.unlocked) {
          throw new Error('Database migration advisory lock was not released.');
        }
      }
    } finally {
      await client.end({ timeout: 5 });
    }
  }
};

const main = async () => {
  const command = process.argv.slice(2);

  if (command.length === 0) {
    throw new Error('A Drizzle Kit command is required.');
  }

  if (!existsSync(drizzleKitEntrypoint)) {
    throw new Error('Local drizzle-kit entrypoint is unavailable.');
  }

  if (command[0] !== 'migrate') {
    process.exitCode = await runDrizzleKit(command);
    return;
  }

  const databaseUrl =
    process.env.DRIZZLE_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DRIZZLE_DATABASE_URL or DATABASE_URL must be supplied through the environment.',
    );
  }

  const postgresFactory = require('postgres');
  process.exitCode = await withMigrationLock({
    databaseUrl,
    postgresFactory,
    runMigration: () => runDrizzleKit(command),
  });
};

module.exports = {
  acquireMigrationLockSql,
  migrationLockNamespace,
  releaseMigrationLockSql,
  withMigrationLock,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
