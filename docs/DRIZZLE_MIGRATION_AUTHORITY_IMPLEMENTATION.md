# Drizzle migration authority implementation

## Scope and authority

Drizzle is the sole schema-migration authority. Prisma remains the runtime
client for the existing repositories, worker lifecycle, lease manager, and
health paths. Its generated client and schema are retained; executable Prisma
schema mutation commands are not.

The physical contract transferred by migration
`packages/database/src/migrations/0022_supreme_texas_twister.sql` is the
authoritative initial Prisma migration at
`packages/infrastructure/prisma/migrations/20260706214228_init_schema/migration.sql`:

- 8 case-sensitive PostgreSQL enums;
- 30 case-sensitive public tables;
- 14 named foreign keys; and
- 14 named indexes.

This is the same contract documented in
`docs/PRISMA_TO_DRIZZLE_OWNERSHIP_INVENTORY.md`. The Drizzle source mapping is
`packages/database/src/schema/prisma_contract.ts`.

## Existing-database adoption

Migration 0022 takes a transaction-scoped advisory lock before inspecting the
catalog. It has exactly two acceptable ownership states:

1. all 8 enums and all 30 tables are absent, in which case the preserved
   creation DDL runs; or
2. all 8 enums and all 30 tables are present, in which case the migration
   recreates the expected contract in `pg_temp` and compares enum labels,
   columns, defaults, nullability, constraints, and indexes against the
   existing public objects.

A partial set, incompatible object kind, or any structural mismatch raises an
exception before public-schema mutation. The temporary comparison objects are
transaction-local and dropped with the migration transaction. The migration
does not contain `IF NOT EXISTS`, destructive public DDL, or writes to
`_prisma_migrations`; Prisma history is deliberately left untouched.

After a successful all-present comparison, Drizzle records its normal migration
journal entry. A normal second invocation is therefore a no-op through the
Drizzle journal rather than through conditional DDL.

## Runtime and test orchestration

`WorkerStatus` and `WorkerRuntime` retain the exact physical and runtime
contract, including the seven status values, `IDLE` default, primary key, and
two named indexes. The Prisma worker lifecycle and lease manager continue to
use `prisma.workerRuntime`.

The API test bootstrap runs only
`pnpm --filter=@studyai/database run db:migrate`. It runs neither
`prisma migrate` nor `prisma db push`, and does not clear Drizzle history. Any live
test must supply an isolated disposable database whose URL passes the existing
`studyai_test` guard.

The production migration runner at
`packages/database/scripts/run-production-migrations.cjs` likewise invokes
only that committed Drizzle chain. The Docker migrator and CI call this
Drizzle authority; Prisma generation remains a connection-free runtime-client
build step.

## Drizzle command boundary

Use the supported package scripts:

```text
pnpm db:generate
pnpm db:migrate
pnpm --filter=@studyai/database run db:check
```

The database package routes these commands through
`packages/database/scripts/run-drizzle-kit.cjs`, which sets its child
process working directory to `packages/database`. This keeps the relative
`schema` and `out` paths in `drizzle.config.ts` anchored to
`packages/database/src`.

Do not invoke `drizzle-kit` directly from the repository root with
`--config=packages/database/drizzle.config.ts`; that invocation can resolve
`out: './src/migrations'` as repository-root `src/`. Root `src/` is not
an ignored output path and should be treated as an incorrect invocation.

## Validation contract

Static validation covers inventory parity, all-absent/all-present adoption
guards, mismatch rejection, WorkerRuntime compatibility, and migration
authority command removal in
`packages/database/src/migrations/prisma-ownership-transfer.test.ts`. These
tests deliberately inspect source, migration SQL, and generated metadata as
governance guards; they do not replace catalog-level fixture tests against an
isolated PostgreSQL database.

For every release candidate, use a new disposable database and verify:

1. fresh migration succeeds;
2. a second migration invocation is a no-op;
3. an exact Prisma-initial-schema database is adopted with and without
   `_prisma_migrations`; and
4. partial, enum, default, nullability, index, and constraint mismatches are
   rejected without changing the pre-existing database.
