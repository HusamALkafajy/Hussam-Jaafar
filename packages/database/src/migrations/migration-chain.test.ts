import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readdirSync(__dirname)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort()
  .map((file) => readFileSync(join(__dirname, file), 'utf8'))
  .join('\n');

describe('migration chain', () => {
  it.each([
    ['auth_provider', ['email', 'google', 'apple']],
    ['locale', ['ar', 'en']],
    ['role', ['student', 'teacher', 'parent', 'admin']],
    ['subscription_tier', ['free', 'pro', 'institution']],
  ])('creates the base %s enum exactly once', (enumName, expectedValues) => {
    const definitions = [
      ...migrationSql.matchAll(
        new RegExp(
          `CREATE TYPE "public"\\."${enumName}" AS ENUM\\(([^)]+)\\)`,
          'g',
        ),
      ),
    ];

    expect(definitions).toHaveLength(1);
    expect(definitions[0][1].match(/'([^']+)'/g)?.map((value) => value.slice(1, -1))).toEqual(
      expectedValues,
    );
  });
});
