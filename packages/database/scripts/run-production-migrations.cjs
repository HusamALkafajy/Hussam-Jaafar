const { spawnSync } = require('node:child_process');

const MIGRATION_STEPS = Object.freeze([
  Object.freeze({
    name: 'Prisma committed migrations',
    args: ['--filter', '@studyai/infrastructure', 'exec', 'prisma', 'migrate', 'deploy'],
  }),
  Object.freeze({
    name: 'Drizzle committed migrations',
    args: ['--filter', '@studyai/database', 'db:migrate'],
  }),
]);

function runProductionMigrations({ run = spawnSync, logger = console } = {}) {
  for (const step of MIGRATION_STEPS) {
    logger.log(`[migrator] Starting ${step.name}.`);
    const result = run('pnpm', step.args, {
      cwd: process.cwd(),
      env: process.env,
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
