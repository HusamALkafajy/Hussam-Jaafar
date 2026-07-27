# StudyAI P0 Scope Decision

## Decision Metadata

- Decision status: APPROVED
- Decision authority: Project owner
- Authorized baseline:
  `5573fd1b34135be588518738eb52c6ad754eaee8`
- Authorized branch:
  `hardening/p0-reconstruction-5573fd1b-v2`
- Reconstruction version: V2
- Previous evidence-gate report:
  `StudyAI_P0_Reconstruction_v2_Report.md`

This document resolves the missing-priority blocker identified by the evidence
gate. It defines the approved P0 scope. It does not claim that the listed fixes
were previously implemented, and it does not claim recovery of the lost commit
`86e2645e543954f6a932d6584ee526dc062dfba1`, which remains unrecoverable.

## P0 Objective

The P0 objective is to remove release-blocking defects required for a safe
internal alpha or controlled closed beta.

P0 does not mean completing every certification test, redesigning the system,
or implementing the wider product roadmap.

## Approved P0 Items

### P0-01 — Secure Cookie and Local E2E Compatibility

Investigate and correct the confirmed incompatibility between local HTTP
Playwright execution and authentication cookies configured as Secure.

Requirements:

- Preserve Secure cookies in production HTTPS environments.
- Do not globally disable Secure cookie protection.
- Use an explicit environment-aware configuration contract.
- Keep HttpOnly behavior.
- Keep the intended SameSite behavior unless a documented test proves that a
  change is required.
- Add regression tests for production and local-test cookie behavior.

Acceptance criteria:

- Production configuration issues Secure authentication cookies.
- Approved local E2E configuration can authenticate over its intended local
  protocol.
- Cookie behavior is covered by automated tests.
- No production security downgrade is introduced.

### P0-02 — Authentication Session and Redirect Reliability

Investigate and correct release-blocking authentication failures affecting:

- login completion,
- authenticated-session establishment,
- expected post-login redirect,
- refresh behavior where applicable,
- logout and revoked-token behavior where applicable.

Requirements:

- Reproduce failures before modifying code.
- Preserve refresh-token rotation and revocation guarantees.
- Do not bypass authentication in tests.
- Do not weaken assertions to make Playwright pass.
- Prefer fixing shared helpers only when the helper is proven incorrect.
- Add focused regression coverage.

Acceptance criteria:

- The focused authentication journey passes in the locally supported browser
  environment.
- A valid login establishes the expected authenticated session.
- The user reaches the intended authenticated destination.
- Invalid or revoked credentials remain rejected.
- No authentication-security regression is introduced.

### P0-03 — Confirmed WCAG 2.1 AA Release Blockers

Investigate accessibility failures demonstrated by current reproducible tests.

Scope is restricted to confirmed release-blocking defects such as:

- missing or incorrect accessible names,
- unlabeled controls,
- invalid ARIA usage,
- keyboard-inaccessible interactive elements,
- modal focus handling,
- focus restoration,
- blocking color-contrast failures where supported by test evidence.

Requirements:

- Reproduce each issue before fixing it.
- Fix semantics and interaction behavior rather than suppressing accessibility
  checks.
- Do not disable axe rules globally.
- Do not add broad exclusions merely to obtain passing results.
- Add focused regression coverage where practical.

Acceptance criteria:

- Confirmed P0 accessibility failures pass their focused automated checks.
- Keyboard operation remains functional.
- Modal focus behavior is correct where applicable.
- No global accessibility rule is disabled without a separately approved
  decision.

### P0-04 — Structured Logging and Sensitive-Data Redaction

Establish a production-appropriate structured logging baseline for the API.

Requirements:

- Use the logging approach already compatible with the repository architecture.
- Produce machine-readable structured logs in production.
- Preserve useful development logging.
- Include appropriate request or correlation context where safely available.
- Redact or omit:
  - passwords,
  - access tokens,
  - refresh tokens,
  - authorization headers,
  - cookies,
  - secrets,
  - sensitive authentication payloads.
- Do not log entire request bodies by default.
- Add focused tests for redaction behavior.

Acceptance criteria:

- Production logs are structured.
- Sensitive fields are demonstrably redacted or omitted.
- Logging failures do not expose secrets.
- Focused logging/redaction tests pass.

### P0-05 — Backup, Restore, and Disaster-Recovery Baseline

Create the minimum operational scripts and documentation needed to demonstrate
that PostgreSQL application data can be backed up and restored safely in the
supported development or certification environment.

Requirements:

- Do not commit real database dumps.
- Do not commit credentials.
- Use environment variables or documented secure inputs.
- Provide:
  - backup script,
  - restore script or restore procedure,
  - verification procedure,
  - retention and storage guidance,
  - clear warnings against destructive production use without approval.
- Where pgvector is used, ensure the procedure accounts for its required
  extension and schema state.
- A destructive restore must never run automatically against an unidentified
  database.

Acceptance criteria:

- Backup command or script validates required inputs.
- Restore procedure requires an explicit target.
- A test or documented validation demonstrates backup readability or restore
  feasibility in the available environment.
- No dump artifact or secret is tracked by Git.

### P0-06 — Release-Gate Verification and Evidence

Run and document the applicable release gates after implementing P0-01 through
P0-05.

Investigate and run where supported:

- lint,
- typecheck,
- focused unit tests,
- relevant integration tests,
- API build,
- Web build,
- focused Playwright authentication tests,
- relevant accessibility tests,
- PostgreSQL connectivity,
- pgvector availability where applicable,
- Redis connectivity where applicable,
- migration application and drift checks where supported,
- backup and restore validation.

Every gate must be classified as exactly one of:

- PASS
- FAIL
- BLOCKED
- NOT RUN

A skipped, cancelled, unavailable, or unexecuted gate must never be described as
PASS.

Acceptance criteria:

- Every executed command and result is documented.
- Environment blockers are distinguished from source defects.
- Remaining failures are explicitly reported.
- No claim of release readiness is made unless all mandatory P0 acceptance
  criteria are satisfied.

## Explicitly Out of P0 Scope

The following are not authorized as part of this reconstruction unless a
separate project-owner decision is supplied:

- broad architectural redesign,
- decomposition of all God services or large pages,
- bounded-context migration,
- unrelated adaptive-learning features,
- new product features,
- pricing or subscription redesign,
- broad dependency upgrades,
- broad performance optimization,
- complete elimination of every historical E2E failure,
- complete WCAG remediation beyond confirmed release blockers,
- P1 or P2 observability enhancements,
- unrelated database schema redesign,
- speculative security changes,
- changes made solely because an old report mentioned a possible risk.

## Evidence Policy

For each P0 item, implementation must:

1. inspect the authorized baseline,
2. identify current applicable evidence,
3. reproduce the defect where possible,
4. record the root cause,
5. implement the smallest correct fix,
6. add regression protection,
7. run focused validation,
8. create one focused commit.

Older reports may guide investigation but do not prove that a current defect
exists.

The current source and reproducible behavior determine whether a listed P0 item
requires code modification.

If an approved P0 item is already correctly implemented at the baseline, it
must be documented as VERIFIED — NO CHANGE REQUIRED rather than rewritten.

## Security Guardrails

The reconstruction must not:

- disable production Secure cookies,
- bypass authentication,
- weaken refresh-token rotation or revocation,
- suppress accessibility rules to obtain passing results,
- expose secrets in logs,
- commit credentials or database dumps,
- execute destructive restore operations without an explicit target and
  authorization,
- weaken tests merely to produce a passing result.

## Commit Policy

Use focused commits.

Do not:

- amend existing commits,
- rebase,
- squash,
- force-push,
- push,
- merge,
- deploy,
- create a pull request during reconstruction.

## Completion Standard

The P0 reconstruction may be declared complete only when:

- every approved P0 item is classified as:
  - FIXED AND VERIFIED,
  - VERIFIED — NO CHANGE REQUIRED,
  - or BLOCKED with exact evidence;
- mandatory source changes are committed;
- applicable regression tests exist;
- the final working tree is clean;
- all validation results are truthfully reported;
- no prohibited remote operation occurred.

A BLOCKED item prevents a general release-ready claim unless the project owner
explicitly accepts the blocker.

## Relationship to Conflicting Reports

- The older “ready for deployment” statement is not treated as final release
  authority.
- The July certification failures are investigation evidence, not an automatic
  instruction to modify every failing area.
- The authorized baseline and current reproducible behavior are the source of
  truth for implementation.
- The P0 classification in this document supersedes the absence of priority
  labels in earlier reports.
- This decision does not retroactively validate the provenance of historical
  dirty working-tree certification artifacts.

## Required Next Step

After this document is committed, run a separate evidence-driven implementation
task for P0-01 through P0-06.

Do not begin implementation during this documentation task.
