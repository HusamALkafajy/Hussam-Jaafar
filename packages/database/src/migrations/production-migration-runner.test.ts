import { describe, expect, it, vi } from 'vitest';

type RunResult = { status: number | null; error?: Error };
type Runner = (command: string, args: string[], options: Record<string, unknown>) => RunResult;
type Logger = { log: (message: string) => void };

const {
  runProductionMigrations,
}: {
  runProductionMigrations: (dependencies: { run: Runner; logger: Logger }) => void;
} = require('../../scripts/run-production-migrations.cjs');

describe('production migration runner', () => {
  it('runs committed Prisma migrations before committed Drizzle migrations', () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const run: Runner = (command, args) => {
      calls.push({ command, args });
      return { status: 0 };
    };

    runProductionMigrations({ run, logger: { log: vi.fn() } });

    expect(calls).toEqual([
      {
        command: 'pnpm',
        args: ['--filter', '@studyai/infrastructure', 'exec', 'prisma', 'migrate', 'deploy'],
      },
      {
        command: 'pnpm',
        args: ['--filter', '@studyai/database', 'db:migrate'],
      },
    ]);
  });

  it('fails closed without starting Drizzle when Prisma fails', () => {
    const run = vi.fn(() => ({ status: 1 }));

    expect(() =>
      runProductionMigrations({ run, logger: { log: vi.fn() } }),
    ).toThrow('Prisma committed migrations failed; API startup remains blocked.');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('logs fixed step labels without rendering connection configuration', () => {
    const log = vi.fn();
    const previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = [
      'postgresql://',
      'credential',
      '-value',
      '@example.test/database',
    ].join('');

    try {
      runProductionMigrations({ run: () => ({ status: 0 }), logger: { log } });
    } finally {
      process.env.DATABASE_URL = previousUrl;
    }

    const output = log.mock.calls.flat().join('\n');
    expect(output).not.toContain('credential-value');
    expect(output).not.toContain('postgresql://');
  });
});
