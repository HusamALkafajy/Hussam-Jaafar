# Event Replay Strategy

## Replay Principles
Replay is an infrastructure mechanism to reconstruct read models, hydrate analytics snapshots, or recover failed integrations. Replay must never trigger side-effects in upstream transactional boundaries (e.g., re-running a completed workflow job). 

## Ordering
Events are strictly ordered by `occurredAt` (`timestamp`). In the event of exact timestamp collisions within the same millisecond, ordering defaults to the sequential auto-incrementing surrogate ID of the `StoredEvent` table or UUID lexicographical sort. Replay queries must always include `ORDER BY occurredAt ASC`.

## Versioning & Serialization
- All events implement a `version` field in their contract, initialized at `1`.
- Payloads are serialized using native `JSON.stringify()` before storage in the `StoredEvent.payload` JSONB column.
- Replay consumers must respect the `version` attribute to branch parsing logic for older event shapes.

## Backward Compatibility (Upcasting)
Breaking changes to event structures are prohibited. Instead, new event versions are introduced (e.g., `version: 2`). The `InProcessEventDispatcher` or the consuming service is responsible for implementing "Upcasters" that dynamically transform a `version 1` event into a `version 2` event in memory before dispatching it to modern handlers. The underlying persisted `StoredEvent` is never mutated.

## Retention & Archiving
- **Hot Storage**: Events reside in the primary Postgres `StoredEvent` table for 90 days to support immediate retry loops and recent replay requests.
- **Cold Storage / Archiving**: After 90 days, a cron process safely archives `StoredEvent` rows into cold object storage (S3/GCS) in compressed JSONLines format partitioned by year/month/aggregate, before hard-deleting them from Postgres.

## Idempotency
Because replay inherently delivers duplicate messages to downstream consumers, all event handlers **MUST** be strictly idempotent. Handlers must track processed `eventId`s or rely on idempotent UPSERT logic to prevent processing the same event payload twice.
