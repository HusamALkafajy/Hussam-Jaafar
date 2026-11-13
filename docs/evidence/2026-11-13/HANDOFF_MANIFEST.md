# StudyAI — Private Six-Item Evidence Handoff Manifest

Classification: PRIVATE EVIDENCE. Not a public sharing archive or release approval.
Export started (host clock, UTC): 2026-11-13T20:36:53.8143894+00:00

## Source repository and scope

```text
C:\Users\Hussam\Documents\ViberDownloads\studyai-p0-v2-clean
```

- Repository: HusamALkafajy/Hussam-Jaafar.
- Authoritative selection: Candidate A, for this handoff only.
- Branch: fix/ai-streaming-and-limits.
- HEAD: 7eb3b6b815ae235d940be422a347b67fa8ff32a6.
- HEAD tree: 805da60337b38238f48630613f20de9bb3a306bb.
- Working tree: seven pre-existing modified tracked files and one untracked directory, apps/api/.storage/.
- The HEAD tree identifies committed source, not the dirty working-tree contents.
- No fetch, pull, checkout, reset, merge or branch change was performed.
- Candidate B was not inspected or modified in this task.

## Destination and expected inventory

```text
E:\StudyAI-Evidence-Handoff-20261113
```

Exactly six requested deliverables are at the root, plus this separate HANDOFF_MANIFEST.md. Sharing/ contains exactly two conditionally authorized, separately redacted report copies. Expected total: nine files and one Sharing subdirectory. No ZIP, public archive or other file is authorized by this manifest.

## Six requested deliverables: exported byte identities

| Item | File | Bytes | Exported SHA-256 |
|---|---|---:|---|
| 1 | AUDIT_REPORT.md | 11823 | 32a5e57e44f6cea32f2c25debaa3ad84b2083d7c5db109f200d6e8fe49b001f2 |
| 2 | StudyAI_MVP_Completion_Plan.md | 14483 | c674434ad1b2e3563df56da0cdd3fb71cecc33ad134e4b52206ca0cff4e7f5a0 |
| 3 | StudyAI_Current_State_Verification.md | 7731 | 509b0c8db8a1c3c4f91b2b2cf7ee6aa9506c7f826a2ecb701b0606613aba9cf9 |
| 4 | package.json | 1508 | ba022099fcb2f6d417486ffcf035db88ac0eec281f3711290892c40ce9f5b55d |
| 5 | StudyAI_Folder_Structure.txt | 2092 | 155ed09f17e37d365b57685af9d9ecaf3c0633c41f72cda19c1938517e298f44 |
| 6 | StudyAI_Latest_Error.txt | 1878 | 9bac9111e62559f6d24fc80fa29d127932eac76b937a782bc310416e442d19b2 |

The first four files are verbatim private copies. Their exported hashes equal their original source hashes; no headers, normalization or sanitization were applied to those originals.

## Original source identities and modification times

All source suffixes below are relative to the exact source repository path above. Dates are filesystem LastWriteTimeUtc values, not authenticated event timestamps.

| Source suffix | Original source SHA-256 | Source modification time UTC | Evidence classification |
|---|---|---|---|
| AUDIT_REPORT.md | 32a5e57e44f6cea32f2c25debaa3ad84b2083d7c5db109f200d6e8fe49b001f2 | 2026-07-27T19:34:11.7942219Z | HISTORICAL: document dated 2026-06-14; no current acceptance or deployment claim is adopted. |
| StudyAI_MVP_Completion_Plan.md | c674434ad1b2e3563df56da0cdd3fb71cecc33ad134e4b52206ca0cff4e7f5a0 | 2026-07-30T19:59:03.8973667Z | HISTORICAL: references commit 388560eae7f98a31e6911cd3f4b33611f3d960a6 and a different branch. |
| StudyAI_Current_State_Verification.md | 509b0c8db8a1c3c4f91b2b2cf7ee6aa9506c7f826a2ecb701b0606613aba9cf9 | 2026-08-01T16:06:49.7088905Z | HISTORICAL: document dated 2026-07-30; references commit 388560eae7f98a31e6911cd3f4b33611f3d960a6 and a different branch. |
| package.json | ba022099fcb2f6d417486ffcf035db88ac0eec281f3711290892c40ce9f5b55d | 2026-08-09T12:31:05.3158081Z | CURRENT OBSERVED SOURCE FILE: tracked and unmodified at this inspection; not evidence of installed dependencies or successful scripts. |
| packages/database/.turbo/turbo-test.log | e2d59abd7a1a14181a307862a227ad7435e6f920765d7ed9a35bb065df3df735 | 2026-08-16T19:06:18.6723134Z | HISTORICAL retained execution log; exact event date, current reproducibility and current unresolved status are not established. |

Root package declarations: name studyai; private true; packageManager pnpm@9.15.0; Node engine >=20.9.0. Workspace membership is declared separately by pnpm-workspace.yaml as apps/* and packages/*. No package scripts were executed.

## Authored deliverables and limitations

- StudyAI_Folder_Structure.txt is the exact previously approved 96-entry text, maximum depth four, UTF-8 without BOM, LF endings and a final LF. No replacement tree was generated for this export. Its source is the approved discovery snapshot, not an existing source file; source modification time is NOT_APPLICABLE.
- The tree is scoped to relevant source/configuration/documentation/tests/scripts and selected root files. Runtime data, dependency stores/caches, build output, generated dependency assets, secrets, scratch and unrelated roots are excluded. qualification/ was absent in Candidate A and was not invented.
- StudyAI_Latest_Error.txt is a sanitized selected derivative of the source log identified above, not a verbatim log copy. Source-log private absolute user paths, ANSI formatting and unrelated output are omitted. No credential or connection-string value is included.
- Recorded error: DATABASE_URL must be supplied through the environment. Recorded component/location: database test-suite initialization, packages/database/src/client.ts:8:9. The log records five failed suites.
- The log's start time is 22:06:08 without a complete date or timezone. File modification time is not proof of execution time. It was the latest located failure-bearing log among the 21 retained logs reviewed during discovery; absolute latest error chronology is UNKNOWN.
- Current reproducibility: UNKNOWN. Latest unresolved error: UNKNOWN. The log does not bind its recorded run to the handoff HEAD.

## Separately redacted sharing copies

| Derivative path | SHA-256 | Redaction |
|---|---|---|
| Sharing/StudyAI_MVP_Completion_Plan.md | f19dab45a035b74ea94ec2f08c234ac240e3ec7ba1148500da93998b5330aebc | 1 exact local repository-path reference replaced with [REDACTED_LOCAL_REPOSITORY_PATH]. |
| Sharing/StudyAI_Current_State_Verification.md | d33b68ea98d1b264c166dde783d137e2dc4562efc953086a4dccaeef6ec1c090 | 1 exact local repository-path reference replaced with [REDACTED_LOCAL_REPOSITORY_PATH]. |

These sharing copies are derivatives and intentionally do not match the original report hashes. They do not replace the root originals. Other report meaning, including historical assertions, is retained. A targeted secret/path screen and exact-transform comparison are required in final verification; such screening is not proof that unrestricted public disclosure is safe.

The root originals and this manifest intentionally retain private source-provenance paths. Do not automatically include the whole directory, root report originals or this manifest in a public archive. No public distribution approval is granted.

## Source working-tree preservation pins

| Pre-existing modified tracked path | SHA-256 |
|---|---|
| apps/api/package.json | a5452bcc2f0004f2879117cbdcb8f328a9de191238f2c95d45c28db3168d74a7 |
| apps/api/src/modules/ai/quota-guard.ts | 7fd302cd3732f8073fbe61fe4c586e02c7c1dc4a9193e232413b7670096e5b38 |
| apps/api/src/modules/ai/token-tracking.ts | 28555a36545dd0d947c315c6845ea4a25fe417da4ca4e06a620a2e5bcc8a92ba |
| apps/web/src/app/(dashboard)/chat/[id]/page.tsx | 389bb3f77fde1f548405ac3ea44ce9164bd2412f4e7e023dec2d2f1c013d8385 |
| apps/web/src/middleware.ts | 7b476d6804e21a746b6eee0e6e59b69e17bfdb87ff46ab1d1849524f8732982d |
| packages/infrastructure/prisma/schema.prisma | f5f4136fe75e63cbb78ab031e9e081b901bcdaa80d458d68a0c7f7e5d83857ef |
| pnpm-lock.yaml | 2183d93736f4f407721d077962692a26028e8eb91e68eef3202ae7c2373790a9 |

The untracked apps/api/.storage/ entry was preserved; its contents were not read or exported. Source preservation is assessed by the listed hashes, branch/HEAD and unchanged Git status inventory, not by a namespace-freezing guarantee.

## Privacy, verification and non-execution

- Destination access is restricted to the current owner, SYSTEM and local Administrators using a protected destination DACL. This changes only task-created destination objects, not source or parent-directory permissions. It is not encryption or protection against privileged host compromise.
- Source preservation pins are rechecked before manifest creation and again in the final read-only verification. Exported originals are checked against their source pins; authored text, sharing derivatives, inventory and access rules are verified before handoff completion.
- This manifest cannot include its own final hash without self-reference. Its final SHA-256 is reported in the conversation receipt after writing.
- No product tests were executed. No npm, pnpm, Node or Python execution, dependency acquisition, service startup, database access, migration, Docker/WSL/Sandbox/VM operation, commit, merge, deployment or source-file edit was performed.
- Historical report statements such as production readiness, deployment recommendations or passing tests remain historical assertions. This handoff does not independently revalidate them or grant functional acceptance.
- No implementation percentage, acceptance ledger, Gate 0 or deployment authorization was changed.
