# StudyAI Private Alpha VPS baseline

## Scope and topology

This baseline runs the current NestJS API and its embedded BullMQ worker in one
long-running VPS container. It does not deploy the Next.js frontend, create a
Supabase project, configure DNS/TLS, provision object storage, or add CI/CD.

| Component | Private Alpha location |
| --- | --- |
| Next.js frontend | Vercel (separate task) |
| NestJS API and embedded worker | One Linux VPS container |
| Redis / BullMQ state | Private Redis container on the VPS |
| PostgreSQL | Owner-managed Supabase PostgreSQL |
| Migrations | One-shot Drizzle service using a direct connection |
| Uploaded documents | **Not ready for real data**; current source uses local disk |

The worker starts in `InfrastructureLifecycleService.onApplicationBootstrap`.
There is no independent worker executable, so `studyai-api` is deliberately the
only long-running application service.

## Prerequisites owned by the project owner

- A 2 GB Ubuntu VPS is recommended; 1 GB can be insufficient during document
  extraction. Install current Docker Engine and the Docker Compose plugin.
- A Supabase project with `pgvector`, a pooled/runtime connection for Prisma,
  and a direct session connection for Drizzle migrations.
- A Vercel frontend origin and an HTTPS API origin before production browser
  use. `FRONTEND_URL` is the current source of truth for CORS and CSRF origin
  validation.
- Private Alpha authentication/provider credentials, stored outside Git.
- A selected durable object-storage provider and adapter implementation before
  accepting real user documents.

## Secret handling

1. Copy `.env.staging.example` to `.env.staging` on the VPS.
2. Fill only the copied file through the approved owner-controlled secret
   process, then run `chmod 600 .env.staging`.
3. Never place secrets in Compose YAML, command history, screenshots, logs, or
   GitHub workflow files. Do not run `docker compose config` without avoiding
   capture of its resolved environment values.
4. Use `--env-file .env.staging` for every Compose command below.

The API receives the pooled/runtime `DATABASE_URL` for Prisma. The migration
service receives only `DRIZZLE_DATABASE_URL`; it is a direct, non-pooled
connection and the service does not receive `DATABASE_URL`. Drizzle remains the
sole migration authority. Do not run Prisma migration commands.

## Build and migration sequence

Run these commands from the repository root on the VPS. The API is bound only
to loopback; a later TLS reverse-proxy task publishes it safely.

```sh
docker compose --env-file .env.staging -f docker-compose.staging.yml build
docker compose --env-file .env.staging -f docker-compose.staging.yml --profile migration run --rm studyai-migrate
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d studyai-redis studyai-api
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
curl --fail --silent --show-error http://127.0.0.1:4000/api/health
```

The migration command must finish successfully before starting or restarting
the API for a release. It uses the committed Drizzle migration chain and the
existing advisory-lock serialization. A migration failure is a release stop;
do not retry by running destructive SQL or Prisma migration commands.

## Operations

View redacted runtime output with:

```sh
docker compose --env-file .env.staging -f docker-compose.staging.yml logs --tail=200 studyai-api
```

For a controlled API restart, rerun the migration gate, then:

```sh
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --no-deps studyai-api
```

The API runs as a non-root user, uses a read-only root filesystem, mounts a
small temporary filesystem, and receives a 45-second Docker stop grace period.
Nest shutdown hooks drain the embedded worker and invoke the existing Prisma,
Redis, BullMQ, and Drizzle shutdown lifecycle.

Redis has no published host port, runs only on an internal network, requires a
password, persists append-only data in `studyai-redis-data`, and uses
`noeviction` to avoid silently dropping BullMQ jobs. Back up its named volume
only with the stack stopped and only after recording the queue-recovery plan.

## Storage readiness boundary

Current upload code writes to `/app/apps/api/uploads` and worker processing
reads the same path. The Compose volume `studyai-upload-validation` is therefore
only for disposable smoke validation. It is not durable object storage and must
not be used for real Private Alpha documents.

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` are
reserved in the template for the later storage-adapter decision and
implementation. The existing deployment architecture report also discusses
Cloudflare R2; resolve that provider choice in the storage task before adding
credentials or accepting documents. This baseline intentionally does not
pretend that either object-storage adapter is active.

## Rollback and deferred work

To roll back an API image, restore the previously validated image tag, run the
same direct-connection migration gate only when its migration history is known
compatible, restart `studyai-api`, and verify `/api/health`. Do not roll back
database schema by hand.

Deferred T03 work includes VPS provisioning, TLS/reverse proxy, DNS, object
storage adapter implementation, email setup, GitHub deployment automation,
Vercel configuration, backup automation, and end-to-end document processing.
