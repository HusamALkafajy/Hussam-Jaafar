#!/usr/bin/env bash
set -euo pipefail

work_dir="$(mktemp -d)"
cleanup() {
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

source_dir="$work_dir/source"
restore_dir="$work_dir/restore"
backup_dir="$work_dir/external-backup"
backup_file="$backup_dir/upload-recovery-test.tar.gz"
mkdir -p "$source_dir/documents/nested" "$restore_dir" "$backup_dir"
printf 'StudyAI upload recovery fixture\n' >"$source_dir/documents/nested/known-file.pdf"

expected_uid="$(id -u)"
expected_gid="$(id -g)"
original_sha="$(sha256sum "$source_dir/documents/nested/known-file.pdf" | cut -d ' ' -f 1)"

if UPLOADS_SOURCE_DIR="$source_dir" \
  UPLOADS_BACKUP_FILE="$backup_dir/should-not-exist.tar.gz" \
  UPLOADS_TARGET_LABEL='ci/upload-recovery' \
  EXPECTED_UPLOAD_UID="$expected_uid" \
  EXPECTED_UPLOAD_GID="$expected_gid" \
  bash ./scripts/backup-uploads.sh >/dev/null 2>&1; then
  printf 'Upload recovery self-test failed: backup did not require quiescence.\n' >&2
  exit 1
fi

UPLOADS_SOURCE_DIR="$source_dir" \
UPLOADS_BACKUP_FILE="$backup_file" \
UPLOADS_TARGET_LABEL='ci/upload-recovery' \
UPLOADS_QUIESCED=YES \
EXPECTED_UPLOAD_UID="$expected_uid" \
EXPECTED_UPLOAD_GID="$expected_gid" \
bash ./scripts/backup-uploads.sh >/dev/null

UPLOADS_RESTORE_DIR="$restore_dir" \
UPLOADS_BACKUP_FILE="$backup_file" \
UPLOADS_TARGET_LABEL='ci/upload-recovery' \
CONFIRM_UPLOADS_RESTORE_TARGET='ci/upload-recovery' \
UPLOADS_QUIESCED=YES \
ALLOW_UPLOADS_RESTORE=YES \
EXPECTED_UPLOAD_UID="$expected_uid" \
EXPECTED_UPLOAD_GID="$expected_gid" \
bash ./scripts/restore-uploads.sh >/dev/null

restored_sha="$(sha256sum "$restore_dir/documents/nested/known-file.pdf" | cut -d ' ' -f 1)"
[[ "$restored_sha" == "$original_sha" ]]
[[ "$(stat -c '%u:%g' "$restore_dir/documents/nested/known-file.pdf")" == "${expected_uid}:${expected_gid}" ]]

printf 'Upload recovery self-test passed.\n'
