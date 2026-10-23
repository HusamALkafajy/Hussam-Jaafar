# Security operations

NO DIRECT PUSH TO MAIN.
PR REVIEW REQUIRED BY PROJECT POLICY until technical branch protection is available.
Do not merge dependency updates automatically.

Generate independent access/refresh JWT keys with a local CSPRNG (at least 32
random bytes each). Store only in ignored environment stores or the deployment
secret manager. Never reuse the retired committed signing key. Rotation invalidates
old sessions. No production fallback signing credentials are permitted.

The legacy certificateHash database column is an opaque lookup identifier, not an
authentication signature. New identifiers use 32 CSPRNG bytes; existing database
lookups remain compatible. Authorization to issue a certificate is enforced by the
application, not knowledge of an identifier-generation constant.

Never commit raw JWTs or credential-bearing test reports. Use fingerprints or
redacted summaries; retain historical forensic evidence separately without editing
it. Review historical exposure separately: deleting current files does not revoke
credentials or copies previously downloaded.

Before deployment the owner must configure non-default database/cache credentials,
review the sealed rotation matrix, confirm provider credentials and GitHub account
2FA/passkeys/recovery/PAT hygiene, and verify technical branch rules on the current
plan. Plan-unavailable controls are not considered enabled.
