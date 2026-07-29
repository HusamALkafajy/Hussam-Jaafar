import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readWorkspaceFile = (...parts: string[]) => readFileSync(resolve(__dirname, ...parts), 'utf8');

const migrationSql = readWorkspaceFile('0022_supreme_texas_twister.sql');
const prismaInitialSql = readWorkspaceFile(
  '../../../infrastructure/prisma/migrations/20260706214228_init_schema/migration.sql',
);
const prismaSchema = readWorkspaceFile('../../../infrastructure/prisma/schema.prisma');
const drizzleContract = readWorkspaceFile('../schema/prisma_contract.ts');
const schemaIndex = readWorkspaceFile('../schema/index.ts');
const drizzleConfig = readWorkspaceFile('../../drizzle.config.ts');
const databasePackage = readWorkspaceFile('../../package.json');
const drizzleRunner = readWorkspaceFile('../../scripts/run-drizzle-kit.cjs');
const workerLifecycle = readWorkspaceFile('../../../infrastructure/src/workers/lifecycle.ts');
const workerLease = readWorkspaceFile('../../../infrastructure/src/workers/lease.ts');
const testSetup = readWorkspaceFile('../../../../apps/api/test/setup.ts');
const infrastructurePackage = readWorkspaceFile('../../../infrastructure/package.json');
const turboConfig = readWorkspaceFile('../../../../turbo.json');
const rootPackage = readWorkspaceFile('../../../../package.json');
const ciWorkflow = readWorkspaceFile('../../../../.github/workflows/ci-cd.yml');
const apiDockerfile = readWorkspaceFile('../../../../docker/Dockerfile.api');
const migrationJournal = JSON.parse(
  readWorkspaceFile('meta/_journal.json'),
) as { entries: Array<{ idx: number; tag: string }> };
const previousSnapshot = JSON.parse(readWorkspaceFile('meta/0021_snapshot.json')) as { id: string };
const migrationSnapshot = JSON.parse(readWorkspaceFile('meta/0022_snapshot.json')) as {
  prevId: string;
  tables: Record<string, { name: string }>;
  enums: Record<string, { name: string }>;
};

const names = (sql: string, pattern: RegExp) =>
  [...sql.matchAll(pattern)].map((match) => match[1]).sort();

const candidateCommands = [...migrationSql.matchAll(/\$ddl\$(.*?)\$ddl\$/gs)]
  .map((match) => match[1].trim())
  .filter(Boolean);

const indexSchemaPatterns = [
  ...migrationSql.matchAll(
    /regexp_replace\(pg_get_indexdef\(i\.indexrelid\), '([^']+)'/g,
  ),
].map((match) => match[1]);

type IndexDefinition = {
  name: string;
  definition: string;
};

type ColumnFingerprint = {
  attnum: number;
  name: string;
  type: string;
  notNull: boolean;
  defaultExpression: string;
};

const indexFingerprint = (indexes: IndexDefinition[]) => {
  const schemaPattern = indexSchemaPatterns[0] ?? '(?!)';

  return [...indexes]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ definition }) => definition.replace(new RegExp(schemaPattern, 'g'), ''))
    .join('\n');
};

const snapshotNames = (objects: Record<string, { name: string }>) =>
  Object.values(objects).map((object) => object.name).sort();

const columnDefinition = (sql: string, tableName: string, columnName: string) => {
  const tableMatch = sql.match(
    new RegExp(`CREATE TABLE "${tableName}" \\(([\\s\\S]*?)\\n\\);`, 'i'),
  );
  const column = tableMatch?.[1]
    .split('\n')
    .find((line) => line.trim().startsWith(`"${columnName}" `));

  if (!column) {
    throw new Error(`Missing ${tableName}.${columnName} column definition`);
  }

  return column.trim().replace(/,$/, '').replace(/\s+/g, ' ').toLowerCase();
};

const columnFingerprint = ({
  attnum,
  name,
  type,
  notNull,
  defaultExpression,
}: ColumnFingerprint) => `${attnum}|${name}|${type}|${notNull}|${defaultExpression}`;

const tableColumns = (sql: string) =>
  Object.fromEntries(
    [...sql.matchAll(/CREATE TABLE "(?:public"\.)?([^"]+)" \(([\s\S]*?)\n\);/g)].map(
      (match) => [
        match[1],
        match[2]
          .split('\n')
          .map((line) => line.trim().replace(/,$/, ''))
          .filter((line) => line.length > 0 && !line.startsWith('CONSTRAINT '))
          .map((line) =>
            line
              .replace(/\bPRIMARY KEY\b/gi, '')
              .replace(
                /\bDEFAULT\s+((?:'[^']*'|[A-Za-z0-9_.]+))\s+NOT NULL\b/gi,
                'NOT NULL DEFAULT $1',
              )
              .replace(/\s*\(\s*/g, '(')
              .replace(/\s*\)/g, ')')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase(),
          ),
      ],
    ),
  );

describe('Prisma-to-Drizzle ownership transfer', () => {
  it('carries every physical object from the authoritative Prisma initial migration', () => {
    const prismaEnums = names(prismaInitialSql, /CREATE TYPE "([^"]+)"/g);
    const prismaTables = names(prismaInitialSql, /CREATE TABLE "([^"]+)"/g);
    const prismaForeignKeys = names(
      prismaInitialSql,
      /ALTER TABLE "[^"]+" ADD CONSTRAINT "([^"]+)"/g,
    );
    const prismaIndexes = names(
      prismaInitialSql,
      /CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "[^"]+"/g,
    );

    expect(names(candidateCommands.join('\n'), /CREATE TYPE "public"\."([^"]+)"/g)).toEqual(prismaEnums);
    expect(names(candidateCommands.join('\n'), /CREATE TABLE "([^"]+)"/g)).toEqual(prismaTables);
    expect(
      names(candidateCommands.join('\n'), /ALTER TABLE "[^"]+" ADD CONSTRAINT "([^"]+)"/g),
    ).toEqual(prismaForeignKeys);
    expect(
      names(candidateCommands.join('\n'), /CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "[^"]+"/g),
    ).toEqual(prismaIndexes);
    expect(names(drizzleContract, /pgEnum\('([^']+)'/g)).toEqual(prismaEnums);
    expect(names(drizzleContract, /pgTable\('([^']+)'/g)).toEqual(prismaTables);
    expect(schemaIndex).toContain(`export * from './prisma_contract';`);
    expect(snapshotNames(migrationSnapshot.enums)).toEqual(
      expect.arrayContaining(prismaEnums),
    );
    expect(snapshotNames(migrationSnapshot.tables)).toEqual(
      expect.arrayContaining(prismaTables),
    );
  });

  it('preserves every transferred table column contract before catalog validation', () => {
    const sourceColumns = tableColumns(prismaInitialSql);
    const migrationColumns = tableColumns(candidateCommands.join('\n'));

    expect(Object.keys(migrationColumns).sort()).toEqual(Object.keys(sourceColumns).sort());
    expect(migrationColumns).toEqual(sourceColumns);
  });

  it('preserves authoritative double-precision default literals in the expected contract', () => {
    const historicalMastery = columnDefinition(
      prismaInitialSql,
      'LearningObjective',
      'mastery',
    );
    const expectedMastery = columnDefinition(
      candidateCommands.join('\n'),
      'LearningObjective',
      'mastery',
    );
    const historicalAverageDuration = columnDefinition(
      prismaInitialSql,
      'WorkerRuntime',
      'averageDuration',
    );
    const expectedAverageDuration = columnDefinition(
      candidateCommands.join('\n'),
      'WorkerRuntime',
      'averageDuration',
    );

    expect(historicalMastery).toBe(
      '"mastery" double precision not null default 0.0',
    );
    expect(expectedMastery).toBe(
      '"mastery" double precision default 0.0 not null',
    );
    expect(expectedMastery).not.toMatch(/\bdefault 0(?:\s|$)/);
    expect(historicalAverageDuration).toBe(
      '"averageduration" double precision not null default 0.0',
    );
    expect(expectedAverageDuration).toBe(
      '"averageduration" double precision default 0.0 not null',
    );
  });

  it('keeps mastery default validation exact and fail-closed', () => {
    const expectedMastery: ColumnFingerprint = {
      attnum: 4,
      name: 'mastery',
      type: 'double precision',
      notNull: true,
      defaultExpression: '0.0',
    };
    const expectedFingerprint = columnFingerprint(expectedMastery);

    expect(columnFingerprint({ ...expectedMastery })).toBe(expectedFingerprint);
    expect(
      columnFingerprint({ ...expectedMastery, defaultExpression: '0.5' }),
    ).not.toBe(expectedFingerprint);
    expect(
      columnFingerprint({ ...expectedMastery, defaultExpression: '' }),
    ).not.toBe(expectedFingerprint);
    expect(
      columnFingerprint({ ...expectedMastery, notNull: false }),
    ).not.toBe(expectedFingerprint);
    expect(
      columnFingerprint({ ...expectedMastery, type: 'numeric' }),
    ).not.toBe(expectedFingerprint);
    expect(migrationSql.match(/pg_get_expr\(d\.adbin, d\.adrelid\)/g)).toHaveLength(2);
    expect(migrationSql).toContain(`format('%s|%s|%s|%s|%s'`);
    expect(migrationSql).toContain(
      'IF actual_definition IS DISTINCT FROM expected_definition THEN',
    );
    expect(migrationSql).not.toMatch(
      /\b(?:DROP\s+(?:TABLE|TYPE|SCHEMA|INDEX)|TRUNCATE|DELETE\s+FROM)\b/i,
    );
  });

  it('implements a fail-closed all-absent or all-present adoption decision', () => {
    expect(migrationSql).toContain('pg_advisory_xact_lock');
    expect(migrationSql).toContain('(present_enums, present_tables) NOT IN ((0, 0), (cardinality(enum_names), cardinality(table_names)))');
    expect(migrationSql).toContain('pg_my_temp_schema()');
    expect(migrationSql).toContain(`PERFORM set_config('search_path', 'public', true);`);
    expect(migrationSql).toContain(`PERFORM set_config('search_path', 'pg_temp, public', true);`);
    expect(migrationSql).toContain('retained Prisma schema is partial');
    expect(migrationSql).toContain('does not match the retained Prisma contract');
    expect(migrationSql).not.toMatch(/\bIF\s+NOT\s+EXISTS\b/i);
    expect(migrationSql).not.toMatch(/\b(?:DROP\s+(?:TABLE|TYPE|SCHEMA|INDEX)|TRUNCATE|DELETE\s+FROM)\b/i);
    expect(migrationSql).not.toMatch(/_prisma_migrations/i);
  });

  it('casts PostgreSQL constraint types before building adoption fingerprints', () => {
    const normalizedSql = migrationSql.replace(/\s+/g, ' ');
    const constraintTypeExpressions = [
      ...normalizedSql.matchAll(
        /con\.conname \|\| '\|' \|\| (con\.contype(?:::[a-z]+)?) \|\| '\|'/gi,
      ),
    ].map((match) => match[1].toLowerCase());

    expect(constraintTypeExpressions).toEqual([
      'con.contype::text',
      'con.contype::text',
    ]);
    expect(migrationSql).toContain(
      'constraints for % do not match the retained Prisma contract',
    );
    expect(migrationSql).toContain(
      'IF actual_definition IS DISTINCT FROM expected_definition THEN',
    );
    expect(migrationSql).not.toMatch(
      /\b(?:DROP\s+(?:TABLE|TYPE|SCHEMA|INDEX)|TRUNCATE|DELETE\s+FROM)\b/i,
    );
  });

  it('normalizes the pg_temp alias in exact index fingerprints', () => {
    expect(indexSchemaPatterns).toEqual([
      '"?(pg_temp(_[0-9]+)?|public)"?[.]',
      '"?(pg_temp(_[0-9]+)?|public)"?[.]',
    ]);

    const publicWorkflowIndexes = [
      {
        name: 'Workflow_pkey',
        definition:
          'CREATE UNIQUE INDEX "Workflow_pkey" ON public."Workflow" USING btree (id)',
      },
      {
        name: 'Workflow_status_idx',
        definition:
          'CREATE INDEX "Workflow_status_idx" ON public."Workflow" USING btree (status)',
      },
    ];
    const expectedWorkflowIndexes = [
      {
        name: 'Workflow_pkey',
        definition:
          'CREATE UNIQUE INDEX "Workflow_pkey" ON pg_temp."Workflow" USING btree (id)',
      },
      {
        name: 'Workflow_status_idx',
        definition:
          'CREATE INDEX "Workflow_status_idx" ON pg_temp_7."Workflow" USING btree (status)',
      },
    ];

    expect(indexFingerprint(publicWorkflowIndexes)).toBe(
      indexFingerprint(expectedWorkflowIndexes),
    );
  });

  it('keeps index adoption fingerprints fail-closed for structural differences', () => {
    const expectedWorkflowIndex = {
      name: 'Workflow_status_idx',
      definition:
        'CREATE INDEX "Workflow_status_idx" ON pg_temp."Workflow" USING btree (status)',
    };
    const authoritativeWorkflowIndex = {
      name: 'Workflow_status_idx',
      definition:
        'CREATE INDEX "Workflow_status_idx" ON public."Workflow" USING btree (status)',
    };
    const expectedCompositeIndex = {
      name: 'StoredEvent_status_occurredAt_idx',
      definition:
        'CREATE INDEX "StoredEvent_status_occurredAt_idx" ON pg_temp."StoredEvent" USING btree (status, "occurredAt")',
    };

    expect(indexFingerprint([authoritativeWorkflowIndex])).toBe(
      indexFingerprint([expectedWorkflowIndex]),
    );
    expect(
      indexFingerprint([
        {
          ...authoritativeWorkflowIndex,
          definition:
            'CREATE INDEX "Workflow_status_idx" ON public."Workflow" USING btree (id)',
        },
      ]),
    ).not.toBe(indexFingerprint([expectedWorkflowIndex]));
    expect(indexFingerprint([])).not.toBe(indexFingerprint([expectedWorkflowIndex]));
    expect(
      indexFingerprint([
        {
          name: 'Workflow_state_idx',
          definition:
            'CREATE INDEX "Workflow_state_idx" ON public."Workflow" USING btree (status)',
        },
      ]),
    ).not.toBe(indexFingerprint([expectedWorkflowIndex]));
    expect(
      indexFingerprint([
        {
          ...expectedCompositeIndex,
          definition:
            'CREATE INDEX "StoredEvent_status_occurredAt_idx" ON public."StoredEvent" USING btree ("occurredAt", status)',
        },
      ]),
    ).not.toBe(indexFingerprint([expectedCompositeIndex]));
    expect(
      indexFingerprint([
        {
          ...authoritativeWorkflowIndex,
          definition:
            'CREATE INDEX "Workflow_status_idx" ON public."Workflow" USING hash (status)',
        },
      ]),
    ).not.toBe(indexFingerprint([expectedWorkflowIndex]));
    expect(
      indexFingerprint([
        {
          ...authoritativeWorkflowIndex,
          definition:
            'CREATE INDEX "Workflow_status_idx" ON public."Workflow" USING btree (status) WHERE (status = \'PENDING\')',
        },
      ]),
    ).not.toBe(indexFingerprint([expectedWorkflowIndex]));
  });

  it('keeps the generated migration metadata tied to the transfer migration', () => {
    expect(migrationSnapshot.prevId).toBe(previousSnapshot.id);
    expect(migrationJournal.entries.at(-1)).toMatchObject({
      idx: 22,
      tag: '0022_supreme_texas_twister',
    });
    expect(snapshotNames(migrationSnapshot.tables)).toContain('WorkerRuntime');
    expect(snapshotNames(migrationSnapshot.enums)).toContain('WorkerStatus');
  });

  it('preserves the exact WorkerRuntime and WorkerStatus runtime contract', () => {
    expect(migrationSql).toContain(
      `CREATE TYPE "public"."WorkerStatus" AS ENUM('STARTING', 'IDLE', 'PROCESSING', 'PAUSED', 'DRAINING', 'STOPPED', 'DEAD');`,
    );
    expect(migrationSql).toContain('CREATE TABLE "WorkerRuntime"');
    expect(migrationSql).toContain('"status" "WorkerStatus" DEFAULT \'IDLE\' NOT NULL');
    expect(migrationSql).toContain('CREATE INDEX "WorkerRuntime_status_idx"');
    expect(migrationSql).toContain('CREATE INDEX "WorkerRuntime_leaseExpiration_idx"');
    expect(drizzleContract).toContain(
      `export const workerStatus = pgEnum('WorkerStatus', ['STARTING', 'IDLE', 'PROCESSING', 'PAUSED', 'DRAINING', 'STOPPED', 'DEAD']);`,
    );
    expect(drizzleContract).toContain(`export const workerRuntime = pgTable('WorkerRuntime'`);
    expect(prismaSchema).toContain('model WorkerRuntime');
    expect(workerLifecycle).toContain('this.prisma.workerRuntime.upsert');
    expect(workerLease).toContain('this.prisma.workerRuntime.update');
  });

  it('removes executable Prisma migration authority from active orchestration', () => {
    const activeOrchestration = [
      testSetup,
      infrastructurePackage,
      turboConfig,
      rootPackage,
      ciWorkflow,
      apiDockerfile,
    ].join('\n');

    expect(testSetup).toContain('pnpm --filter=@studyai/database run db:migrate');
    expect(activeOrchestration).not.toMatch(
      /prisma\s+(?:migrate\s+(?:dev|deploy|reset|resolve)|db\s+push)/i,
    );
    expect(testSetup).not.toMatch(/DROP\s+SCHEMA/i);
    expect(infrastructurePackage).not.toMatch(/"db:(?:migrate|push)"/);
    expect(infrastructurePackage).toMatch(/"db:generate".*prisma generate/);
    expect(turboConfig).not.toContain('@studyai/infrastructure#db:push');
  });

  it('anchors supported Drizzle commands to the database package and rejects root output', () => {
    expect(rootPackage).toContain('turbo db:migrate --filter=@studyai/database');
    expect(databasePackage).toContain('node scripts/run-drizzle-kit.cjs migrate');
    expect(databasePackage).toContain('node scripts/run-drizzle-kit.cjs generate');
    expect(drizzleRunner).toContain("const packageDirectory = resolve(__dirname, '..');");
    expect(drizzleRunner).toContain('cwd: packageDirectory');
    expect(drizzleRunner).toContain('shell: false');
    expect(drizzleConfig).toContain("out: './src/migrations'");
    expect(existsSync(resolve(__dirname, '../../../../src'))).toBe(false);
  });

  it('keeps migration defaults and static test inputs free of committed credentials', () => {
    const reviewedMigrationInputs = [migrationSql, drizzleConfig, testSetup].join('\n');
    expect(reviewedMigrationInputs).not.toMatch(
      /(?:postgres(?:ql)?|mysql|redis):\/\/[^/\s:@]+:[^@\s/]+@/i,
    );
    expect(reviewedMigrationInputs).not.toMatch(
      /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/i,
    );
  });
});
