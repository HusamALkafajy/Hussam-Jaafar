#!/usr/bin/env bash

set -euo pipefail

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

: "${DATABASE_URL:?DATABASE_URL must identify the database to restore}"
: "${DATABASE_TARGET_LABEL:?DATABASE_TARGET_LABEL must explicitly identify the target environment}"
: "${BACKUP_FILE:?BACKUP_FILE must identify the custom-format dump to restore}"
: "${CONFIRM_RESTORE_TARGET:?CONFIRM_RESTORE_TARGET must repeat DATABASE_TARGET_LABEL}"
: "${ALLOW_DESTRUCTIVE_RESTORE:?ALLOW_DESTRUCTIVE_RESTORE must be set to YES}"

command -v pg_restore >/dev/null 2>&1 || fail "pg_restore is required"
command -v psql >/dev/null 2>&1 || fail "psql is required for post-restore verification"

[[ "$CONFIRM_RESTORE_TARGET" == "$DATABASE_TARGET_LABEL" ]] ||
  fail "CONFIRM_RESTORE_TARGET does not match DATABASE_TARGET_LABEL"
[[ "$ALLOW_DESTRUCTIVE_RESTORE" == "YES" ]] ||
  fail "ALLOW_DESTRUCTIVE_RESTORE must be exactly YES"
[[ -f "$BACKUP_FILE" && -r "$BACKUP_FILE" ]] ||
  fail "backup is not a readable file: $BACKUP_FILE"

pg_restore --list "$BACKUP_FILE" >/dev/null

printf 'WARNING: restoring into explicitly confirmed target: %s\n' "$DATABASE_TARGET_LABEL"
pg_restore \
  --clean \
  --if-exists \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  "$BACKUP_FILE"

vector_available="$(
  psql "$DATABASE_URL" --no-psqlrc --tuples-only --no-align \
    --command="SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector');"
)"
[[ "$vector_available" == "t" ]] || fail "restore completed but the vector extension is unavailable"

printf 'Restore completed and pgvector availability verified for: %s\n' "$DATABASE_TARGET_LABEL"
