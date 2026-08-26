# Uploaded-file backup and restore

## Supported storage boundary

The private-alpha API stores original document bytes beneath
`STORAGE_PATH=/app/apps/api/uploads`. Compose mounts the named volume
`studyai-private-alpha_studyai-upload-validation` at that path, and the API runs
as UID/GID `1001:1001`. PostgreSQL stores the file metadata and opaque storage
key; the named volume stores the corresponding bytes under `documents/`.

This is a single-host private-alpha storage contract, not highly available
object storage. It is usable only with encrypted external backups, monitored
capacity, restricted operator access, and regular isolated restore rehearsals.
Object-storage migration remains deferred and must preserve the existing
storage-provider boundary.

## Prerequisites and safety boundary

- Run from the exact deployed checkout on the VPS.
- Build the helper from the same reviewed release commit:

  ```bash
  export RELEASE_ID='reviewed-commit-or-release-id'
  docker build --file docker/Dockerfile.api --target upload-ops \
    --tag "studyai-upload-ops:${RELEASE_ID}" .
  ```

- Select an encrypted external backup directory outside the repository and
  outside the Docker volume. Restrict it to recovery operators.
- Set a non-secret recovery-set label containing only letters, digits,
  `.`, `_`, `/`, or `-`. Use the same label for the matching database dump.
- Stop `studyai-api` before database or upload backup/restore. The embedded
  worker stops with it. Do not claim quiescence while any process can mutate
  database metadata or upload bytes.
- The helper uses no network and receives no application secret.

## Backup

After stopping the API and recording the maintenance/recovery-set label:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml stop studyai-api

export RECOVERY_SET='private-alpha/approved-maintenance-id'
export UPLOAD_BACKUP_DIR='/approved/external/studyai-backups'

docker run --rm --user 0:0 --read-only --network none \
  --env UPLOADS_SOURCE_DIR=/uploads \
  --env UPLOADS_BACKUP_FILE="/backup/${RECOVERY_SET//\//-}.uploads.tar.gz" \
  --env UPLOADS_TARGET_LABEL="$RECOVERY_SET" \
  --env UPLOADS_QUIESCED=YES \
  --env EXPECTED_UPLOAD_UID=1001 \
  --env EXPECTED_UPLOAD_GID=1001 \
  --volume studyai-private-alpha_studyai-upload-validation:/uploads:ro \
  --volume "$UPLOAD_BACKUP_DIR:/backup" \
  "studyai-upload-ops:${RELEASE_ID}"
```

`scripts/backup-uploads.sh` refuses a non-absolute source or destination,
in-volume output, overwrite, symbolic link, unexpected UID/GID, missing
quiescence confirmation, or unreadable archive. It creates:

- the compressed tar archive;
- a `.sha256` integrity sidecar; and
- a `.metadata` sidecar containing UTC creation time, recovery-set label,
  expected numeric owner, file count, and archive byte count.

Keep all three files together. Move/copy them only through the approved
encrypted backup system. Retention and off-host replication are operator
policy; the script never deletes a generation.

## Restore

Restore only into an empty newly created volume or empty authorized path. The
restore script never deletes or overwrites existing volume contents. Replacing
a failed volume is a separate destructive operator action that requires the
approved incident/recovery plan; the example below starts after the empty
replacement volume exists.

Restore the matching database dump first while the API remains stopped. Then:

```bash
export RECOVERY_SET='private-alpha/approved-maintenance-id'
export UPLOAD_BACKUP_DIR='/approved/external/studyai-backups'
export UPLOAD_BACKUP_FILE="${RECOVERY_SET//\//-}.uploads.tar.gz"

docker run --rm --user 0:0 --read-only --network none \
  --env UPLOADS_RESTORE_DIR=/uploads \
  --env UPLOADS_BACKUP_FILE="/backup/$UPLOAD_BACKUP_FILE" \
  --env UPLOADS_TARGET_LABEL="$RECOVERY_SET" \
  --env CONFIRM_UPLOADS_RESTORE_TARGET="$RECOVERY_SET" \
  --env UPLOADS_QUIESCED=YES \
  --env ALLOW_UPLOADS_RESTORE=YES \
  --env EXPECTED_UPLOAD_UID=1001 \
  --env EXPECTED_UPLOAD_GID=1001 \
  --volume studyai-private-alpha_studyai-upload-validation:/uploads \
  --volume "$UPLOAD_BACKUP_DIR:/backup:ro" \
  --entrypoint /usr/local/bin/restore-uploads \
  "studyai-upload-ops:${RELEASE_ID}"
```

The restore verifies the checksum, metadata version and label, archive path
safety, entry types, empty target, and final `1001:1001` ownership. It fails
without either explicit restore confirmation and leaves the API stopped on any
error. Discard a partially extracted replacement volume after a failed restore;
do not start the application against it.

## Recovery order and post-restore validation

1. Declare one recovery-set label and stop the API/embedded worker.
2. For backup, create and verify the PostgreSQL dump and upload archive while
   the system stays quiesced. For restore, validate both artifacts before
   changing either target.
3. Restore PostgreSQL into the authorized target.
4. Restore the upload archive with the matching label into an empty volume.
5. Run the one canonical Drizzle production migration command.
6. Start Redis and the API, wait for `/api/health` to report both database and
   cache healthy, then use an authorized product session to retrieve a known
   document.
7. Compare the retrieved byte length and SHA-256 with the recovery record and
   verify new uploads are still created as UID/GID `1001:1001`.

Never mix a database dump and upload archive from different recovery sets.
Keep the service stopped when either half fails validation. RPO and RTO are
**OWNER/OPERATIONS POLICY NOT YET DEFINED**.
