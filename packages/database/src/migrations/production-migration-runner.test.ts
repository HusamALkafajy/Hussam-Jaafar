import { describe, expect, it, vi } from 'vitest';

type RunResult = { status: number | null; error?: Error };
type Runner = (command: string, args: string[], options: Record<string, unknown>) => RunResult;
type Logger = { log: (message: string) => void };

const {
  runProductionMigrations,
}: {
  runProductionMigrations: (dependencies: { run: Runner; logger: Logger; environment?: Record<string, string | undefined> }) => void;
} = require('../../scripts/run-production-migrations.cjs');

function fixtureDatabaseUrl(query = ''): string {
  return [
    'postgresql:',
    '//',
    'fixture-user',
    ':',
    'fixture-pass',
    '@host:5432/db',
    query,
  ].join('');
}

function malformedFixtureDatabaseUrl(): string {
  return [
    'not-a-valid-url:',
    '//',
    'fixture-user',
    ':',
    'fixture-pass',
    '@host',
  ].join('');
}

describe('production migration runner', () => {
  it('runs only the committed Drizzle migration chain', () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const run: Runner = (command, args) => {
      calls.push({ command, args });
      return { status: 0 };
    };

    runProductionMigrations({ run, logger: { log: vi.fn() } });

    expect(calls).toEqual([
      {
        command: 'pnpm',
        args: ['--filter', '@studyai/database', 'db:migrate'],
      },
    ]);
  });

  it('fails closed when the Drizzle migration command fails', () => {
    const run = vi.fn(() => ({ status: 1 }));

    expect(() =>
      runProductionMigrations({ run, logger: { log: vi.fn() } }),
    ).toThrow('Drizzle committed migrations failed; API startup remains blocked.');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('logs fixed step labels without rendering connection configuration', () => {
    const log = vi.fn();
    const environment = {
      DATABASE_URL: [
        'postgresql://',
        'credential',
        '-value',
        '@example.test/database',
      ].join(''),
    };

    runProductionMigrations({ run: () => ({ status: 0 }), logger: { log }, environment });

    const output = log.mock.calls.flat().join('\n');
    expect(output).not.toContain('credential-value');
    expect(output).not.toContain('postgresql://');
  });

  describe('URL normalization', () => {
    it('leaves URL without schema equivalent for Drizzle', () => {
      const calls: Array<{ env: Record<string, string | undefined> }> = [];
      const run: Runner = (command, args, options) => {
        calls.push({ env: options.env as Record<string, string | undefined> });
        return { status: 0 };
      };

      runProductionMigrations({
        run,
        logger: { log: vi.fn() },
        environment: { DATABASE_URL: fixtureDatabaseUrl() },
      });

      expect(calls[0].env.DRIZZLE_DATABASE_URL).toBe(fixtureDatabaseUrl());
    });

    it('removes schema=public for Drizzle', () => {
      const calls: Array<{ env: Record<string, string | undefined> }> = [];
      const run: Runner = (command, args, options) => {
        calls.push({ env: options.env as Record<string, string | undefined> });
        return { status: 0 };
      };

      runProductionMigrations({
        run,
        logger: { log: vi.fn() },
        environment: { DATABASE_URL: fixtureDatabaseUrl('?schema=public') },
      });

      expect(calls[0].env.DRIZZLE_DATABASE_URL).toBe(fixtureDatabaseUrl());
    });

    it('preserves sslmode and other supported query parameters', () => {
      const calls: Array<{ env: Record<string, string | undefined> }> = [];
      const run: Runner = (command, args, options) => {
        calls.push({ env: options.env as Record<string, string | undefined> });
        return { status: 0 };
      };

      runProductionMigrations({
        run,
        logger: { log: vi.fn() },
        environment: {
          DATABASE_URL: fixtureDatabaseUrl(
            '?schema=public&sslmode=require&pool_timeout=10',
          ),
        },
      });

      expect(calls[0].env.DRIZZLE_DATABASE_URL).toBe(
        fixtureDatabaseUrl('?sslmode=require&pool_timeout=10'),
      );
    });

    it('rejects non-public schema', () => {
      expect(() =>
        runProductionMigrations({
          run: () => ({ status: 0 }),
          logger: { log: vi.fn() },
          environment: { DATABASE_URL: fixtureDatabaseUrl('?schema=custom') },
        }),
      ).toThrow('Non-public schema requested but not supported by postgres.js configuration.');
    });

    it('rejects malformed URL safely without logging credentials', () => {
      expect(() =>
        runProductionMigrations({
          run: () => ({ status: 0 }),
          logger: { log: vi.fn() },
          environment: { DATABASE_URL: malformedFixtureDatabaseUrl() },
        }),
      ).toThrow('Malformed database URL provided.');
    });
  });
});
