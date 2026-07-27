# Database Migration Orchestration Decision

## 1. Status

**Accepted for implementation planning.** This document is an architecture and
migration-governance decision only. It does not authorize a schema mutation,
migration-baseline operation, or production deployment.

## 2. Date and branch

- Date: 2026-07-28
- Branch: `hardening/p0-reconstruction-5573fd1b-v2`
- Evidence baseline: `a36233e32adf7bacab22f12a084edc841a3183a8`
- Authoritative P0 scope: `docs/P0_SCOPE_DECISION.md`

## 3. Problem statement

StudyAI contains two independently generated PostgreSQL migration histories.
The root migration command executes the Drizzle history, while the
infrastructure package also exposes Prisma migration commands. On a fresh
database, Drizzle succeeds and makes the database non-empty. A subsequent
`prisma migrate deploy` then refuses to apply Prisma's initial migration with
P3005. The Prisma migration contains runtime-required objects that Drizzle does
not create, including `"WorkerRuntime"`. API bootstrap starts the worker engine,
which queries that table and fails with P2021 when it is absent.

Continuing to execute both histories without an explicit, non-overlapping
ownership model is not deterministic migration orchestration.

## 4. Reproduction evidence

The isolated validation sequence established:

1. all Drizzle migrations can complete on a fresh PostgreSQL database;
2. the resulting database is non-empty;
3. Prisma sees one initial migration but no Prisma baseline metadata;
4. `prisma migrate deploy` stops with P3005;
5. `"WorkerRuntime"` is not present after Drizzle alone; and
6. API startup reaches Prisma runtime code and fails with P2021 for
   `"WorkerRuntime"`.

The sequence used disposable isolated services only. This decision did not
connect to or mutate an original-project database.

## 5. Current dual-migration architecture

### Commands and invocation

| Command | Definition or caller | Current role/order |
| --- | --- | --- |
| `pnpm db:generate` | `package.json` | Turbo invokes `@studyai/database`; Drizzle generation only. |
| `pnpm db:migrate` | `package.json` | Turbo invokes `@studyai/database`; Drizzle migration only. |
| `drizzle-kit generate` / `drizzle-kit migrate` | `packages/database/package.json` | Generates/applies SQL in `packages/database/src/migrations`. |
| `prisma generate` | `packages/infrastructure/package.json`, `docker/Dockerfile.api` | Generates the Prisma runtime client; it does not migrate. |
| `prisma migrate deploy` | `packages/infrastructure/package.json` | Package-local Prisma deployment command; not called by the root migration command or CI. |
| `prisma db push` followed by Drizzle migration | `apps/api/test/setup.ts` | Current destructive integration-test bootstrap, not a safe deployment process. |
| Drizzle generate, lint, typecheck, tests, build | `.github/workflows/ci-cd.yml` | CI does not validate either complete migration history against PostgreSQL. |

`turbo.json` orders Prisma `db:push` before Drizzle `db:push` for that specific
push task, but defines no equivalent deploy-safe ordering for `db:migrate`.
The API Dockerfile generates a Prisma client but does not apply migrations.
No inspected production startup script supplies a complete dual-ORM migration
sequence.

### Runtime roles

- Drizzle is both a migration system and a runtime query layer:
  `packages/database/src/schema/index.ts`, the database client, and repository
  exports are imported by application code.
- Prisma is both a current schema/migration artifact and a runtime query layer:
  `packages/infrastructure/prisma/schema.prisma`, its single initial migration,
  the generated client, and infrastructure services use `PrismaClient`.
- Therefore, ORM runtime use does not prove physical schema ownership. Migration
  ownership must be declared separately.

## 6. Database ownership matrix

The matrix describes the baseline repository, not the selected future state.
Physical case-sensitive Prisma names are quoted.

| Object group | Current classification | Evidence and notes |
| --- | --- | --- |
| Users, accounts, authenticators, verification tokens, refresh/session data | DRIZZLE OWNED | `packages/database/src/schema/users.ts` and Drizzle SQL history. |
| Subscription and usage data | DRIZZLE OWNED | `packages/database/src/schema/subscriptions.ts` and Drizzle SQL history. |
| Files, summaries, explanations, documents, document versions/chunks, reader and processing data | DRIZZLE OWNED | `packages/database/src/schema/files.ts`, `summaries.ts`, `explanations.ts`, `document_engine.ts`, `infrastructure.ts`, and Drizzle SQL. |
| Exams, quizzes, questions, answers, flashcards | DRIZZLE OWNED with a conceptual duplicate | Drizzle schema owns application tables; Prisma separately defines `"Question"` for its assessment model. The physical names and contracts differ. |
| Chat, payments, user activity, analytics and recommendation analytics | DRIZZLE OWNED with related Prisma analytics objects | Drizzle owns its snake-case application objects. Prisma owns distinct `"AnalyticsEvent"` and `"AnalyticsSnapshot"` objects. |
| Study coach, learning paths and `study_plans` | DRIZZLE OWNED with a conceptual duplicate | Prisma separately defines `"StudyPlan"` with a different physical name and contract. |
| Knowledge graph | DRIZZLE OWNED | `packages/database/src/schema/knowledge.ts` and Drizzle SQL history. |
| Vector columns/indexes and `vector` extension | DRIZZLE OWNED | Drizzle migration `0002` creates pgvector support and vector-backed chunk storage. Prisma's initial SQL does not replace this custom history. |
| Workflow, workflow job/event, learning asset/capability, objective, assessment/submission/result, revision objects | PRISMA OWNED | `packages/infrastructure/prisma/schema.prisma` and `prisma/migrations/20260706214228_init_schema/migration.sql`. |
| Identity/security, connector/integration and platform asset objects | PRISMA OWNED | Same Prisma schema and initial migration. |
| `"JobExecution"` and `"WorkerRuntime"` | PRISMA OWNED | Same Prisma schema and initial migration; used by worker infrastructure. |
| Stored event | DUPLICATED concept, distinct physical objects | Drizzle `stored_events`/`event_status`; Prisma `"StoredEvent"`/`"EventStatus"`. |
| Binary object metadata | DUPLICATED concept, distinct physical objects | Drizzle `binary_object_metadata`/`upload_status`; Prisma `"BinaryObjectMetadata"`/`"UploadStatus"`. Enum members also differ. |
| Remaining enums | Owner follows defining migration | Drizzle enums occur in Drizzle SQL/schema; quoted Prisma enums occur in Prisma initial SQL/schema. Same concepts do not imply equivalence. |
| `drizzle.__drizzle_migrations` | DRIZZLE OWNED | Drizzle migration metadata in its own schema. |
| `public._prisma_migrations` | PRISMA OWNED metadata | Expected only where Prisma migrations were truthfully applied or baselined. |
| Generated Prisma schema/client copy | RUNTIME-MAPPED ONLY | `packages/infrastructure/src/prisma-client/schema.prisma` describes Prisma runtime mappings; generated code is not an independent migration owner. |

This inventory is sufficient to reject overlapping orchestration, but it does
not establish that any deployed database has a particular set of objects or
data. That production state remains an explicit uncertainty.

## 7. WorkerRuntime contract

`packages/infrastructure/prisma/schema.prisma` and
`packages/infrastructure/prisma/migrations/20260706214228_init_schema/migration.sql`
agree on the following physical contract:

- Schema/table: `public."WorkerRuntime"` (no Prisma `@@map`)
- `"workerId"` `TEXT NOT NULL`, primary key
- `"workerName"` `TEXT NOT NULL`
- `"status"` `"WorkerStatus" NOT NULL DEFAULT 'IDLE'`
- `"capabilities"` `JSONB NULL`
- `"startedAt"` `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `"lastHeartbeat"` `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `"leaseExpiration"` `TIMESTAMP(3) NOT NULL`
- `"currentJobId"` `TEXT NULL`
- `"processedJobs"` `INTEGER NOT NULL DEFAULT 0`
- `"failedJobs"` `INTEGER NOT NULL DEFAULT 0`
- `"averageDuration"` `DOUBLE PRECISION NOT NULL DEFAULT 0.0`
- `"version"` `TEXT NOT NULL`
- Primary key: `"WorkerRuntime_pkey"` on `"workerId"`
- Indexes: `"WorkerRuntime_status_idx"` and
  `"WorkerRuntime_leaseExpiration_idx"`
- Unique constraints beyond the primary key: none
- Foreign keys: none
- Enum dependency: public `"WorkerStatus"` with `STARTING`, `IDLE`,
  `PROCESSING`, `PAUSED`, `DRAINING`, `STOPPED`, `DEAD`
- Automatic update behavior: none; neither timestamp is Prisma `@updatedAt`

Worker startup upserts the row and heartbeat/lifecycle/lease code reads and
updates it in `packages/infrastructure/src/workers/lifecycle.ts` and
`packages/infrastructure/src/workers/lease.ts`. Queue and health code also
queries it. API infrastructure bootstrap starts this lifecycle, so the table is
required during API startup.

No Drizzle schema or later Drizzle migration creates an equivalent object.
A hand-authored Drizzle SQL migration can reproduce the contract exactly, and
the Prisma client can use a structurally equivalent table regardless of which
migration engine created it. Production data and deployed compatibility cannot
be inferred from repository evidence and must be established by a read-only
preflight before any upgrade.

## 8. Historical evidence

- Commit `8571ad8` introduced the Drizzle-era foundation first.
- Commit `8d348a2` introduced the infrastructure Prisma package, its schema,
  one 480-line initial migration, and worker/file-processing infrastructure.
- The current branch contains `e018459`, which intentionally ran Prisma
  migration before Drizzle for integration provisioning.
- A related but non-ancestor commit, `eb84242`, was explicitly titled as a fix
  for a Prisma/Drizzle deployment conflict and moved/deleted portions of the
  Prisma migration layout. It is evidence that the conflict was recognized,
  not an authoritative production decision.
- Later test bootstrap changes culminated in `apps/api/test/setup.ts` using
  destructive Prisma `db push` followed by Drizzle migration.

History supports an incomplete dual-ORM coexistence. It does not prove that
Prisma was intended to replace Drizzle, that Drizzle was intended to replace
Prisma, or that the combined migration histories were ever production-valid on
a fresh database. No inspected report or decision document names an
authoritative ORM migration owner. No repository evidence proves whether a
deployed database contains `"WorkerRuntime"` or Prisma metadata.

## 9. Options considered

### A. Drizzle becomes the sole migration authority

Deterministic for fresh databases, preserves the mature Drizzle history and
pgvector/custom SQL, and aligns with the root command. Prisma can remain a
runtime client. It requires importing every retained Prisma-owned physical
contract into additive Drizzle-governed migrations and removing Prisma
migration execution from orchestration.

### B. Prisma becomes the sole migration authority

Would require representing the broad Drizzle application schema, pgvector
behavior, custom SQL, and historical upgrades in Prisma or replacing history.
That is broad, high-risk work beyond the minimum P0 correction.

### C. Explicit split ownership

Could be coherent if Prisma objects lived in a separate PostgreSQL schema with
explicit Prisma mappings, permissions, metadata, and search-path behavior.
Current objects and runtime mappings use `public`; moving them would require a
data/schema migration and runtime changes. Leaving two owners in `public` does
not solve P3005.

### D. Baseline Prisma after Drizzle

Invalid. Drizzle does not create `"WorkerRuntime"` or the complete Prisma
initial contract. Marking that initial migration applied after Drizzle would
falsely attest that absent objects exist.

### E. Convert WorkerRuntime into a Drizzle migration

Technically compatible and the immediate P0 symptom can be reproduced exactly.
By itself it is incomplete because Prisma's initial migration owns numerous
other runtime physical objects and cannot remain executable after Drizzle.
This technique is accepted only as part of Option A's complete ownership
transfer, with `"WorkerRuntime"` as the startup-critical acceptance target.

### F. Manual table creation or ad hoc bootstrap SQL

Non-repeatable, not represented in migration metadata, and likely to drift from
the Prisma contract.

### G. Reset or squash all migration history

Repository evidence does not prove a disposable pre-release schema or absence
of upgrade obligations. Resetting history is therefore unsafe and out of scope.

## 10. Rejected options and reasons

Options B, C, D, F, and G are rejected for the reasons above. Option E alone is
rejected because it leaves ownership of the rest of Prisma's initial contract
unresolved. “Run both as currently configured” is rejected because it already
fails deterministically and has overlapping public-schema assumptions.

## 11. Selected authoritative strategy

**Select Option A: Drizzle is the sole authoritative migration system for every
StudyAI PostgreSQL schema object.**

- Drizzle SQL migrations own all tables, enums, indexes, constraints,
  extensions, schemas, and future changes.
- Both Drizzle and Prisma may remain runtime query clients.
- Prisma schema files remain runtime/type contracts while Prisma is used, but
  they do not independently authorize database changes.
- `"WorkerRuntime"` becomes Drizzle-owned and must be created with the exact
  contract in Section 7.
- The complete retained Prisma initial physical contract—not only
  `"WorkerRuntime"`—must be transferred into additive Drizzle-governed
  migration(s). Conceptual duplicates must not be silently merged or renamed;
  each physical object must have an explicit retain/map/retire decision.
- `prisma migrate deploy`, `prisma migrate dev`, `prisma migrate resolve`, and
  `prisma db push` must not execute in fresh setup, CI, deployment, application
  startup, or ordinary test provisioning after implementation.
- `prisma generate` remains allowed because it generates a runtime client and
  does not mutate a database.
- Normal command order becomes: generate clients/artifacts as needed, execute
  the single Drizzle migration command once, then start the API/workers.
- The normal metadata source of truth is
  `drizzle.__drizzle_migrations`. `_prisma_migrations` may remain on an existing
  database as truthful historical evidence, but new databases do not create or
  require it.

This decision does not guess production state. It defines a mandatory,
read-only classification gate and stops rather than mutating an unknown state.

## 12. Fresh-database procedure

After the implementation exists:

1. create an empty supported PostgreSQL database with required privileges;
2. generate the Prisma runtime client without connecting for migration;
3. run only the root Drizzle migration command;
4. verify the complete expected schema, including pgvector and the exact
   `"WorkerRuntime"` contract;
5. verify only truthful migration metadata exists; and
6. start API/workers and check health.

The procedure must be repeatable: rerunning the deployment migration command
must be a safe no-op. Prisma migration commands are not part of the procedure.

## 13. Existing-database upgrade procedure

Implementation must begin with a versioned, read-only preflight that inventories
object structure and both metadata tables without reading application row data.
It must classify the database before applying an additive Drizzle ownership
transfer:

| Existing state | Required behavior |
| --- | --- |
| Empty | Use the fresh procedure. |
| Drizzle-only, Prisma objects absent | Apply the additive Drizzle migration that creates the complete retained Prisma physical contract. |
| Both histories applied and objects exactly match | Preserve all objects/data and `_prisma_migrations`; the Drizzle adoption migration must verify equivalence and record its own application without recreating objects. |
| `_prisma_migrations` exists | Treat it only as historical evidence; verify its recorded migration and every represented object. Never rewrite or delete it automatically. |
| `"WorkerRuntime"` exists but Prisma metadata is absent | Verify every column, type, default, enum, constraint and index. Adopt only if exact; never infer equivalence from table name alone. |
| Drizzle objects exist and `"WorkerRuntime"` is absent | Create it and all other missing retained Prisma-owned objects through the additive Drizzle migration, not manual SQL. |
| Any partial, unexpected, or structurally different state | Stop before mutation and require a separately reviewed repair plan. |

The adoption migration must use fail-closed structural assertions. A bare
`CREATE ... IF NOT EXISTS` is insufficient because it can conceal incompatible
objects. It must neither drop/recreate existing tables nor falsely populate
Prisma metadata. If a safe transactional adoption cannot be implemented for
all retained objects, implementation is blocked.

## 14. CI procedure

CI must:

1. build/generate both runtime clients as applicable;
2. provision a truly empty disposable PostgreSQL instance;
3. apply only Drizzle migrations;
4. assert exact schema contracts, pgvector, Drizzle journal state, and absence
   of P3005;
5. rerun the same migration command to prove idempotent deployment behavior;
6. start API/workers and verify health without P2021;
7. test the supported existing-state classifications using disposable
   fixtures; and
8. fail if an executable Prisma database-mutation command remains in CI,
   deployment, startup, or integration bootstrap.

Tests must never print database credentials or full connection URLs.

## 15. Deployment procedure

Deployment must run a single, explicit Drizzle migration job before application
rollout. It must be serialized to avoid concurrent migration runners, use a
least-privileged deployment identity, capture migration logs without secrets,
and fail closed before application rollout. Application containers generate/use
clients but do not mutate schema at startup.

For an existing environment, the read-only classifier and reviewed state match
are mandatory before the first deployment under this decision. No automatic
Prisma baseline, resolve, reset, push, or schema recreation is permitted.

## 16. Rollback and recovery considerations

The ownership transfer is additive. Before production use, take and verify a
recoverable database backup according to the environment's operations policy.
If migration fails, roll back the transaction where PostgreSQL permits and do
not start the new application version. Application rollback may leave additive
compatible objects in place; do not drop them automatically. Any data-bearing
schema reversal requires a separate reviewed forward-recovery migration.

Migration metadata must not be edited as a rollback mechanism. Recovery must
preserve truthful records and produce auditable logs.

## 17. Security and data-safety constraints

- Never run against an unclassified database.
- Never use `prisma migrate resolve` to conceal missing objects.
- Never use `prisma db push --accept-data-loss` outside disposable tests, and
  remove it from the authoritative test bootstrap.
- Never drop, truncate, recreate, or silently rename existing data objects in
  the ownership transfer.
- Never expose credentials or full database URLs in output.
- Never inspect or mutate original-project data for validation.
- Require exact structural checks, transactional DDL where feasible, least
  privilege, backup readiness, and serialized migration execution.

## 18. Required implementation changes

1. Inventory every object in the Prisma initial migration and record an
   explicit physical disposition.
2. Add additive Drizzle migration/schema representation for every retained
   Prisma-owned object, including the exact `"WorkerStatus"` and
   `"WorkerRuntime"` contract.
3. Implement fail-closed existing-state structural assertions/adoption without
   false Prisma metadata.
4. Make the root Drizzle command the only deploy migration command.
5. Remove Prisma database mutation from integration bootstrap and any
   deployment/startup path; retain `prisma generate`.
6. Update scripts, Docker/CI wiring, and operational documentation to express
   one migration owner.
7. Add schema-contract and orchestration regression tests.

These are implementation requirements, not changes performed by this decision.

## 19. Required tests

- Empty-database Drizzle migration test.
- Second-run no-op/idempotency test.
- Exact `"WorkerRuntime"` table, enum, default, index, nullability and naming
  assertions.
- Full transferred-Prisma-contract schema assertions.
- pgvector extension, vector column and index assertions.
- Drizzle-only upgrade fixture.
- Truthfully dual-migrated exact-match adoption fixture.
- Exact object/no-Prisma-metadata adoption fixture.
- Partial or mismatched object rejection fixtures.
- Prisma runtime CRUD compatibility for `"WorkerRuntime"`.
- Worker bootstrap, heartbeat/lease, API startup, and health tests.
- Guard test proving deployment/test orchestration does not execute Prisma
  migration or `db push`.
- Secret-redaction test for database bootstrap output.

## 20. Required acceptance criteria

Implementation is accepted only when all applicable checks are actually run and
pass:

- fresh database migrations complete;
- Prisma P3005 does not occur because Prisma migration is not invoked;
- `"WorkerRuntime"` exists with the exact Section 7 structure;
- the full retained Prisma runtime schema exists under Drizzle ownership;
- pgvector remains available and vector behavior is preserved;
- `drizzle.__drizzle_migrations` is correct;
- `_prisma_migrations`, if present, remains truthful and unmodified;
- repeating the deployment migration command is safe;
- each supported existing-database upgrade path is non-destructive;
- unknown/partial/mismatched states stop before mutation;
- API starts without Prisma P2021 and health passes;
- focused migration and runtime compatibility tests pass;
- no original-project resource is modified;
- no manual undocumented SQL step is required; and
- CI and deployment expose exactly one schema migration authority.

## 21. Explicitly out-of-scope work

- Implementing or executing the ownership-transfer migration
- Mutating any database or migration metadata
- ORM runtime replacement or broad repository redesign
- Merging conceptual duplicate models
- Migration-history reset, squash, rebaseline, or destructive cleanup
- Production deployment, remote operations, or inspection of application data
- Resolving an unknown or incompatible deployed schema without a separately
  reviewed repair decision

## 22. Implementation stop conditions

Stop implementation before mutation if:

- the repository branch/baseline or authorized scope differs;
- the complete Prisma physical-object inventory is not accounted for;
- any retained contract, especially `"WorkerRuntime"`, is ambiguous;
- a target database cannot be classified read-only;
- an existing object's structure differs from the expected contract;
- the proposed migration would conceal drift with `IF NOT EXISTS`;
- safe transactional adoption cannot be demonstrated;
- production state would have to be guessed;
- data loss, false metadata, secret exposure, original-resource mutation, or
  manual undocumented SQL would be required; or
- validation cannot prove both fresh creation and non-destructive upgrade.

The correct response to any stop condition is a separate evidence-gathering or
repair decision, not a best-effort baseline.
