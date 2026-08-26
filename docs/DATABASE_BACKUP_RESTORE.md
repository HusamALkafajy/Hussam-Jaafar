# Database Backup and Restore

These procedures operate on the exact PostgreSQL database named by the
`DATABASE_URL` environment variable. They never discover or infer a production
target. Supply that variable through a secret manager or an ephemeral shell
environment; do not place a connection string in command history, logs, or
repository files.

## Prerequisites

- PostgreSQL client tools compatible with the server: `pg_dump`, `pg_restore`,
  and `psql`.
- A target PostgreSQL server with the `vector` extension available. The project
  migration `packages/database/src/migrations/0002_volatile_thaddeus_ross.sql`
  creates the extension and a `vector(1536)` column.
- An externally supplied, non-empty `DATABASE_URL` and a non-secret
  `DATABASE_TARGET_LABEL` that unmistakably names the environment.
- Authorized storage with encryption at rest and access restricted to recovery
  operators.

## Create and verify a backup

After your approved secret-management workflow has populated `DATABASE_URL`,
set a non-secret target label and run:

```bash
export DATABASE_TARGET_LABEL='staging-us-east/database'
./scripts/backup-db.sh
```

The script writes a PostgreSQL custom-format dump under `backups/` unless
`BACKUP_DIR` or `BACKUP_FILE` is supplied. It refuses to overwrite an existing
file, uses owner-only permissions where supported, and verifies the dump catalog
with `pg_restore --list`. It does not print the connection string.

For an independent verification, run:

```bash
pg_restore --list /secure/path/studyai-TIMESTAMP.dump >/dev/null
sha256sum /secure/path/studyai-TIMESTAMP.dump
```

Record the checksum, creation time, PostgreSQL client/server versions, source
label, and encryption/storage location in the operational recovery record.

## Restore into a non-production target

Restoration is destructive because existing objects are cleaned before import.
Never run it against production without a separately reviewed recovery plan,
authorization, maintenance window, and tested rollback path.

The script requires two independent confirmations. After an approved secret
workflow has populated `DATABASE_URL`, set these non-secret values:

```bash
export DATABASE_TARGET_LABEL='recovery-drill/local'
export BACKUP_FILE='/secure/path/studyai-TIMESTAMP.dump'
export CONFIRM_RESTORE_TARGET='recovery-drill/local'
export ALLOW_DESTRUCTIVE_RESTORE='YES'
./scripts/restore-db.sh
```

Before changing the target, the script validates that the dump catalog is
readable. After restoration, it verifies that PostgreSQL reports the `vector`
extension. A recovery drill must additionally run application migrations,
schema/drift checks, representative row-count and integrity queries, and an
application smoke test.

## Retention and disaster-recovery practice

Retention is deliberately an operator policy, not automatic deletion in the
backup script. Define retention from recovery-point and legal requirements,
retain multiple generations, and keep at least one encrypted copy in a separate
failure domain. Test a full restore regularly in an isolated non-production
database. Deletion should require explicit operator review and should follow the
storage provider's secure lifecycle policy.

Backups and generated SQL archives are ignored by Git. Never commit a dump,
checksum containing a secret path, credential, or recovery log with sensitive
data.

## Database and uploaded-file consistency

Database rows identify uploaded objects whose bytes live outside PostgreSQL.
A usable recovery set therefore requires both this database dump and the upload
archive described in `docs/UPLOAD_BACKUP_RESTORE.md`. Stop the API and embedded
worker before creating either artifact, use the same non-secret recovery-set
label for both, and keep the service stopped until both artifacts and their
checksums are recorded. Restore PostgreSQL first, restore the matching upload
archive second, run the Drizzle migration gate, and only then start the API and
perform authorized health and document-download checks.

The scripts do not invent an acceptable gap between the two artifacts.
Recovery-point objective (RPO) and recovery-time objective (RTO) are
**OWNER/OPERATIONS POLICY NOT YET DEFINED**.
