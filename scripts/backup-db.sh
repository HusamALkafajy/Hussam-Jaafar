#!/usr/bin/env bash

set -euo pipefail
umask 077

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

: "${DATABASE_URL:?DATABASE_URL must identify the database to back up}"
: "${DATABASE_TARGET_LABEL:?DATABASE_TARGET_LABEL must explicitly identify the target environment}"

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump is required"
command -v pg_restore >/dev/null 2>&1 || fail "pg_restore is required to verify the backup"

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="${BACKUP_DIR:-${repository_root}/backups}"
timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
backup_file="${BACKUP_FILE:-${backup_dir}/studyai-${timestamp}.dump}"

case "$backup_file" in
  *.dump | *.backup) ;;
  *) fail "BACKUP_FILE must end in .dump or .backup" ;;
esac

[[ ! -e "$backup_file" ]] || fail "refusing to overwrite existing backup: $backup_file"
mkdir -p "$backup_dir"

printf 'Creating a custom-format backup for target label: %s\n' "$DATABASE_TARGET_LABEL"
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$backup_file"

[[ -s "$backup_file" ]] || fail "backup is empty: $backup_file"
pg_restore --list "$backup_file" >/dev/null

printf 'Backup created and catalog verified: %s\n' "$backup_file"
printf 'Retention is intentionally not automated; follow docs/DATABASE_BACKUP_RESTORE.md.\n'
