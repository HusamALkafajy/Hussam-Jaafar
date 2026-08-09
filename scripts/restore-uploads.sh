#!/usr/bin/env bash
set -euo pipefail

umask 077

fail() {
  printf 'Upload restore failed: %s\n' "$1" >&2
  exit 1
}

: "${UPLOADS_RESTORE_DIR:?UPLOADS_RESTORE_DIR must identify the empty restore root}"
: "${UPLOADS_BACKUP_FILE:?UPLOADS_BACKUP_FILE must identify the .tar.gz archive}"
: "${UPLOADS_TARGET_LABEL:?UPLOADS_TARGET_LABEL must identify the restore environment}"
: "${CONFIRM_UPLOADS_RESTORE_TARGET:?CONFIRM_UPLOADS_RESTORE_TARGET must confirm the restore environment}"

[[ "${UPLOADS_QUIESCED:-}" == "YES" ]] || fail "UPLOADS_QUIESCED=YES is required"
[[ "${ALLOW_UPLOADS_RESTORE:-}" == "YES" ]] || fail "ALLOW_UPLOADS_RESTORE=YES is required"
[[ "$CONFIRM_UPLOADS_RESTORE_TARGET" == "$UPLOADS_TARGET_LABEL" ]] || fail "restore target confirmation does not match"
[[ "$UPLOADS_RESTORE_DIR" == /* ]] || fail "UPLOADS_RESTORE_DIR must be an absolute path"
[[ "$UPLOADS_BACKUP_FILE" == /* ]] || fail "UPLOADS_BACKUP_FILE must be an absolute path"
[[ "$UPLOADS_BACKUP_FILE" == *.tar.gz ]] || fail "UPLOADS_BACKUP_FILE must end in .tar.gz"
[[ "$UPLOADS_TARGET_LABEL" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "UPLOADS_TARGET_LABEL contains unsupported characters"
[[ -d "$UPLOADS_RESTORE_DIR" ]] || fail "restore root is not a directory"
[[ ! -L "$UPLOADS_RESTORE_DIR" ]] || fail "restore root must not be a symbolic link"
[[ -r "$UPLOADS_BACKUP_FILE" ]] || fail "backup archive is not readable"

for command in find grep readlink sha256sum stat tar; do
  command -v "$command" >/dev/null 2>&1 || fail "$command is required"
done

restore_dir="$(readlink -f "$UPLOADS_RESTORE_DIR")"
backup_dir="$(dirname "$UPLOADS_BACKUP_FILE")"
backup_dir="$(readlink -f "$backup_dir")"
backup_file="${backup_dir}/$(basename "$UPLOADS_BACKUP_FILE")"
checksum_file="${backup_file}.sha256"
metadata_file="${backup_file}.metadata"

[[ -r "$checksum_file" ]] || fail "backup checksum sidecar is missing"
[[ -r "$metadata_file" ]] || fail "backup metadata sidecar is missing"
grep -Fqx 'format=studyai-upload-backup-v1' "$metadata_file" || fail "backup metadata format is unsupported"
grep -Fqx "target_label=$UPLOADS_TARGET_LABEL" "$metadata_file" || fail "backup target label does not match"

if [[ -n "$(find "$restore_dir" -mindepth 1 -print -quit)" ]]; then
  fail "restore root must be empty; the script never deletes existing data"
fi

(
  cd "$backup_dir"
  sha256sum --check "$(basename "$checksum_file")" >/dev/null
) || fail "backup checksum verification failed"

while IFS= read -r entry; do
  normalized="${entry#./}"
  [[ -z "$normalized" || "$normalized" == "." ]] && continue
  case "$normalized" in
    /*|../*|*/../*|*/..|..) fail "archive contains an unsafe path" ;;
  esac
done < <(tar -tzf "$backup_file")

while IFS= read -r listing; do
  case "${listing:0:1}" in
    -|d) ;;
    *) fail "archive contains a non-file, non-directory entry" ;;
  esac
done < <(tar -tvzf "$backup_file")

tar --numeric-owner --same-owner -C "$restore_dir" -xzf "$backup_file"

expected_uid="${EXPECTED_UPLOAD_UID:-1001}"
expected_gid="${EXPECTED_UPLOAD_GID:-1001}"
[[ "$expected_uid" =~ ^[0-9]+$ ]] || fail "EXPECTED_UPLOAD_UID must be numeric"
[[ "$expected_gid" =~ ^[0-9]+$ ]] || fail "EXPECTED_UPLOAD_GID must be numeric"
grep -Fqx "expected_uid=$expected_uid" "$metadata_file" || fail "backup UID metadata does not match"
grep -Fqx "expected_gid=$expected_gid" "$metadata_file" || fail "backup GID metadata does not match"

while IFS= read -r -d '' entry; do
  [[ "$(stat -c '%u:%g' "$entry")" == "${expected_uid}:${expected_gid}" ]] ||
    fail "restored ownership does not match the expected runtime UID/GID"
done < <(find "$restore_dir" -print0)

printf 'Upload restore completed and verified for target label: %s\n' "$UPLOADS_TARGET_LABEL"
