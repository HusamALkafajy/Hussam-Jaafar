const { spawnSync } = require('node:child_process');

function getDrizzleEnvironment(env) {
  const dbUrl = env.DRIZZLE_DATABASE_URL || env.DATABASE_URL;
  if (!dbUrl) return env;

  let parsed;
  try {
    parsed = new URL(dbUrl);
    if (!parsed.protocol.startsWith('postgres')) {
      throw new Error('Invalid protocol');
    }
  } catch (err) {
    throw new Error('Malformed database URL provided.');
  }

  const schema = parsed.searchParams.get('schema');
  if (schema) {
    if (schema !== 'public') {
      throw new Error('Non-public schema requested but not supported by postgres.js configuration.');
    }
    parsed.searchParams.delete('schema');
  }

  return {
    ...env,
    DRIZZLE_DATABASE_URL: parsed.toString(),
  };
}

const MIGRATION_STEPS = Object.freeze([
  Object.freeze({
    name: 'Drizzle committed migrations',
    args: ['--filter', '@studyai/database', 'db:migrate'],
    prepareEnv: getDrizzleEnvironment,
  }),
]);

function runProductionMigrations({ run = spawnSync, logger = console, environment = process.env } = {}) {
  for (const step of MIGRATION_STEPS) {
    logger.log(`[migrator] Starting ${step.name}.`);

    let stepEnv;
    try {
      stepEnv = step.prepareEnv ? step.prepareEnv(environment) : environment;
    } catch (err) {
      throw new Error(`${step.name} failed during environment preparation: ${err.message}`);
    }

    const result = run('pnpm', step.args, {
      cwd: process.cwd(),
      env: stepEnv,
      shell: false,
      stdio: 'inherit',
    });

    if (result.error || result.status !== 0) {
      throw new Error(`${step.name} failed; API startup remains blocked.`);
    }

    logger.log(`[migrator] Completed ${step.name}.`);
  }
}

if (require.main === module) {
  try {
    runProductionMigrations();
  } catch (error) {
    console.error(`[migrator] ${error instanceof Error ? error.message : 'Migration failed.'}`);
    process.exitCode = 1;
  }
}

module.exports = { MIGRATION_STEPS, runProductionMigrations };
