#!/usr/bin/env bash
set -euo pipefail

umask 077

fail() {
  printf 'Upload backup failed: %s\n' "$1" >&2
  exit 1
}

: "${UPLOADS_SOURCE_DIR:?UPLOADS_SOURCE_DIR must identify the quiesced upload root}"
: "${UPLOADS_BACKUP_FILE:?UPLOADS_BACKUP_FILE must identify an external .tar.gz archive}"
: "${UPLOADS_TARGET_LABEL:?UPLOADS_TARGET_LABEL must identify the source environment}"

[[ "${UPLOADS_QUIESCED:-}" == "YES" ]] || fail "UPLOADS_QUIESCED=YES is required"
[[ "$UPLOADS_SOURCE_DIR" == /* ]] || fail "UPLOADS_SOURCE_DIR must be an absolute path"
[[ "$UPLOADS_BACKUP_FILE" == /* ]] || fail "UPLOADS_BACKUP_FILE must be an absolute path"
[[ "$UPLOADS_BACKUP_FILE" == *.tar.gz ]] || fail "UPLOADS_BACKUP_FILE must end in .tar.gz"
[[ "$UPLOADS_TARGET_LABEL" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "UPLOADS_TARGET_LABEL contains unsupported characters"
[[ -d "$UPLOADS_SOURCE_DIR" ]] || fail "upload source is not a directory"
[[ ! -L "$UPLOADS_SOURCE_DIR" ]] || fail "upload source must not be a symbolic link"

for command in date find mktemp mv readlink sha256sum stat tar wc; do
  command -v "$command" >/dev/null 2>&1 || fail "$command is required"
done

source_dir="$(readlink -f "$UPLOADS_SOURCE_DIR")"
backup_dir="$(dirname "$UPLOADS_BACKUP_FILE")"
[[ -d "$backup_dir" ]] || fail "external backup directory does not exist"
backup_dir="$(readlink -f "$backup_dir")"
backup_file="${backup_dir}/$(basename "$UPLOADS_BACKUP_FILE")"

case "$backup_file" in
  "$source_dir"/*) fail "backup archive must be outside the upload source" ;;
esac

checksum_file="${backup_file}.sha256"
metadata_file="${backup_file}.metadata"
[[ ! -e "$backup_file" ]] || fail "refusing to overwrite an existing archive"
[[ ! -e "$checksum_file" ]] || fail "refusing to overwrite an existing checksum"
[[ ! -e "$metadata_file" ]] || fail "refusing to overwrite existing metadata"

if [[ -n "$(find "$source_dir" -type l -print -quit)" ]]; then
  fail "symbolic links are not permitted in the upload source"
fi

expected_uid="${EXPECTED_UPLOAD_UID:-1001}"
expected_gid="${EXPECTED_UPLOAD_GID:-1001}"
[[ "$expected_uid" =~ ^[0-9]+$ ]] || fail "EXPECTED_UPLOAD_UID must be numeric"
[[ "$expected_gid" =~ ^[0-9]+$ ]] || fail "EXPECTED_UPLOAD_GID must be numeric"

while IFS= read -r -d '' entry; do
  [[ "$(stat -c '%u:%g' "$entry")" == "${expected_uid}:${expected_gid}" ]] ||
    fail "upload source ownership does not match the expected runtime UID/GID"
done < <(find "$source_dir" -print0)

archive_tmp="$(mktemp "${backup_file}.tmp.XXXXXX")"
checksum_tmp="$(mktemp "${checksum_file}.tmp.XXXXXX")"
metadata_tmp="$(mktemp "${metadata_file}.tmp.XXXXXX")"
cleanup() {
  rm -f -- "$archive_tmp" "$checksum_tmp" "$metadata_tmp"
}
trap cleanup EXIT

created_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
file_count="$(find "$source_dir" -type f | wc -l | tr -d ' ')"

tar --numeric-owner -C "$source_dir" -czf "$archive_tmp" .
[[ -s "$archive_tmp" ]] || fail "created archive is empty"
tar -tzf "$archive_tmp" >/dev/null

mv -- "$archive_tmp" "$backup_file"
(
  cd "$backup_dir"
  sha256sum "$(basename "$backup_file")" >"$(basename "$checksum_tmp")"
)

printf '%s\n' \
  "format=studyai-upload-backup-v1" \
  "created_at_utc=$created_at" \
  "target_label=$UPLOADS_TARGET_LABEL" \
  "expected_uid=$expected_uid" \
  "expected_gid=$expected_gid" \
  "file_count=$file_count" \
  "archive_bytes=$(stat -c '%s' "$backup_file")" >"$metadata_tmp"

mv -- "$checksum_tmp" "$checksum_file"
mv -- "$metadata_tmp" "$metadata_file"
trap - EXIT

printf 'Upload backup created and verified for target label: %s\n' "$UPLOADS_TARGET_LABEL"
