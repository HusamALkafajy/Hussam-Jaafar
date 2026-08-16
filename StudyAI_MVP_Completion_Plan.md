# StudyAI — MVP Completion Plan

## 1. Executive Conclusion
The StudyAI project is significantly closer to launch than previous broad audits suggested. By filtering out historical artifacts, environment limitations, and overstated issues, we are left with a minimal set of true blockers. The most critical defects are a flawed CSRF middleware and a defective embedding URL path that breaks core AI functionality. By adhering strictly to a Restricted MVP scope, we can move the project from an endless validation cycle to a public launch in 2 to 6 weeks, depending on resource allocation.

## 2. Verified Current Project State
- **Repository Path:** `C:/Users/Hussam/Documents/ViberDownloads/studyai-p0-v2-clean`
- **Branch:** `hardening/p0-reconstruction-5573fd1b-v2`
- **HEAD:** `388560eae7f98a31e6911cd3f4b33611f3d960a6`
- **Git Status:** Clean, except for the untracked `StudyAI_Current_State_Verification.md` file.

## 3. Corrected Findings Table (Phase 1)

| Finding | Current Classification | Evidence | User-Visible Impact | Release Stage Affected | Required Action | Confidence Level |
|---|---|---|---|---|---|---|
| Dual-ORM deployment path broken | Historical and fixed | `0022_supreme_texas_twister.sql` | None | None | None | High |
| CSRF protection is logically dead | Confirmed current defect | `main.ts:47`, `auth.service.ts:246` | High (Security vulnerability) | Private Alpha | Fix middleware to read header/correct cookie | High |
| Embedding URL has duplicated `/v1` | Confirmed current defect | `ai.service.ts:277` | High (Search/RAG returns garbage) | Private Alpha | Remove hardcoded `/v1` from URL building | High |
| Silent pseudo-random embedding fallback | Confirmed current defect | `ai.service.ts:299` | High (Obscures root cause of RAG failure) | Private Alpha | Remove fallback, throw standard error | High |
| Gemini safety `BLOCK_NONE` | Overstated | `ai.service.ts:342` | Low (Intentional for academic ingestion) | Post-MVP | None | High |
| Workspace search crash on `subscribe` | Historical and fixed | No instances in `apps/web` | None | None | None | High |
| pgvector HNSW index missing | Optional future improvement | Schema definitions in `database` | Low (Small datasets perform fine) | Mature v1.0 | Add index once DB scales | High |
| CI lacks migration validation | Confirmed current gap | `.github/workflows/ci-cd.yml` | High (Broken deployments) | Public MVP | Add `db:migrate` to CI pipeline | High |

## 4. Actual P0 Blockers (Group A)
*Items preventing closure of current P0 work.*

**1. Fix Embedding URL Defect**
- **Exact Evidence:** `apps/api/src/modules/ai/ai.service.ts:277` (`${this.baseUrl}/v1/embeddings` creates `/v1/v1/embeddings`).
- **Affected Subsystem:** AI Service / RAG Pipeline
- **Severity:** P0 (Critical - breaks core AI product value)
- **Estimated Focused Hours:** 1
- **Dependencies:** None
- **Acceptance Condition:** Valid 1536-dimensional float array returned from OpenRouter, successfully saved to DB.
- **Source Modification Required:** Yes

**2. Fix CSRF Middleware Logic**
- **Exact Evidence:** `apps/api/src/main.ts:47` expects an `access_token` cookie, which `auth.service.ts:246` explicitly avoids setting.
- **Affected Subsystem:** Authentication / API Middleware
- **Severity:** P0 (Critical - active state-changing vulnerability)
- **Estimated Focused Hours:** 2
- **Dependencies:** None
- **Acceptance Condition:** All state-changing authenticated endpoints reject requests without a valid `x-csrf-token` header matching the signed cookie.
- **Source Modification Required:** Yes

## 5. Private Alpha Blockers (Group B)
*Items preventing 5-10 invited users from safely testing.*

**1. Stable Database Initialization & Deployment Strategy**
- **Exact Evidence:** No documented deployment pipeline or staging database initialization strategy exists for external testers.
- **Affected Subsystem:** Infrastructure
- **Severity:** P1 (High)
- **Estimated Focused Hours:** 8
- **Dependencies:** P0 Bug Fixes
- **Acceptance Condition:** A working staging environment is accessible via the web, correctly running Drizzle migrations on startup.
- **Source Modification Required:** Environment/Ops configuration

## 6. Public MVP Blockers (Group C)
*Items required before opening publicly.*

**1. Database Migration Gate in CI**
- **Exact Evidence:** `.github/workflows/ci-cd.yml` lacks live database migration tests.
- **Affected Subsystem:** CI/CD
- **Severity:** P1
- **Estimated Focused Hours:** 4
- **Dependencies:** None
- **Acceptance Condition:** CI fails if new schema changes break existing data.
- **Source Modification Required:** Yes (YAML)

**2. AI Streaming (SSE)**
- **Exact Evidence:** AI routes use blocking HTTP calls that can timeout on Vercel/Cloudflare.
- **Affected Subsystem:** AI Service / Frontend
- **Severity:** P1
- **Estimated Focused Hours:** 24
- **Dependencies:** RAG completion
- **Acceptance Condition:** UI updates progressively as tokens arrive.
- **Source Modification Required:** Yes

**3. React Query Adoption (Core Routes)**
- **Exact Evidence:** `files/page.tsx` uses raw `useEffect`.
- **Affected Subsystem:** Frontend (Dashboard)
- **Severity:** P2 (High maintenance debt)
- **Estimated Focused Hours:** 20
- **Dependencies:** None
- **Acceptance Condition:** Caching, loading, and error states handled seamlessly via React Query.
- **Source Modification Required:** Yes

**4. Per-Endpoint Rate Limiting**
- **Exact Evidence:** Only global limits exist in `throttler.guard.ts`.
- **Affected Subsystem:** Security
- **Severity:** P1 (Brute-force protection)
- **Estimated Focused Hours:** 4
- **Dependencies:** None
- **Acceptance Condition:** `/auth/login` capped at 5 req/min per IP.
- **Source Modification Required:** Yes

## 7. Deferred Work (Group D)
*Defer until user validation.*

- **pgvector HNSW / IVFFlat Indexing:** Tables are too small at MVP to warrant maintaining these indexes.
- **BullMQ File Processing:** Simple async/await is sufficient until thread starvation is actually observed.
- **AiService Refactoring:** 1075 lines is messy but functional. Do not rewrite until new features are required.
- **Enterprise Features / Analytics:** Wait for product-market fit.
- **Kubernetes / Multi-region Infrastructure:** Vercel/Railway/Render is sufficient.

## 8. Restricted MVP Definition (Phase 2)
**Included:** Registration, login, logout, refresh-token rotation, Arabic/English UI, document upload, text extraction, processing, summary/flashcard/quiz generation, basic AI tutor, workspace search, user file ownership, basic quotas, stable DB init, basic security, and backups.

**Excluded & Why:**
- *Enterprise Features:* Unnecessary overhead; focus on B2C students first.
- *Advanced Adaptive Learning/Knowledge Graphs:* Core RAG must prove valuable before building advanced cognitive maps.
- *Kubernetes/Multi-region:* Premature scaling. Single-region PaaS is cheaper and faster.
- *Complex Recommendations/Gamification:* Nice-to-haves that delay the critical feedback loop.
- *Extensive UI Refactors:* Current UI is "good enough" to test the core value proposition.

## 9. Completion Estimates (Phase 3)

1. **Technical Foundation (Auth, DB, Base API):** 95%
   - *Completed:* Core schemas, Drizzle integration, JWT auth.
   - *Remaining:* CSRF logic fix.
   - *Confidence:* High.
2. **Restricted MVP Feature Set:** 85%
   - *Completed:* Uploads, UI shells, basic AI prompts.
   - *Remaining:* Embedding URL fix, AI Streaming, React Query fetching.
   - *Confidence:* High.
3. **Private Alpha:** 80%
   - *Completed:* Core local execution.
   - *Remaining:* P0 fixes and a stable deployment script.
   - *Confidence:* High.
4. **Closed Beta:** 65%
   - *Completed:* Base API.
   - *Remaining:* Rate limiting, AI Streaming, quota enforcement.
   - *Confidence:* Medium.
5. **Public MVP:** 45%
   - *Completed:* Core functionality.
   - *Remaining:* CI database validation, audit logs, GDPR compliance, stable deployment.
   - *Confidence:* Medium.
6. **Mature v1.0:** 30%
   - *Completed:* Baseline architecture.
   - *Remaining:* Horizontal scaling, BullMQ, HNSW indexing, advanced observability.
   - *Confidence:* Low (Requirements will change post-MVP).

## 10. Workspace Search Defect (Phase 5)
- **Likely Component:** None identified.
- **Likely Execution Path:** Historical branch or hallucinated finding.
- **Likely Root Cause:** N/A
- **Exact Files to Inspect:** `apps/web/src/components/` (specifically searching for `subscribe`).
- **Minimal Debugging Plan:** Do not debug. The defect does not exist in the canonical source.
- **Required Regression Tests:** None for this issue.
- **Expected Effort:** 0 hours.
- **Root Cause Status:** **UNSUPPORTED / HISTORICAL**

## 11. Database and Migration Status (Phase 6)
- **Drizzle Migration Authority:** Confirmed. Drizzle owns the schema.
- **Prisma Runtime Usage:** Strictly for typed client/infrastructure interactions.
- **Migration 0022:** Successfully orchestrates the adoption of the Prisma schema.
- **Fresh Database Initialization:** Functional via `pnpm db:migrate`.
- **Repeat Migration Behavior:** Idempotent and stable.
- **Adoption Behavior:** Prisma ownership transfer verified.
- **Current Dual-ORM Risk:** Negligible for current codebase state.
- **CI Migration Validation:** Missing and must be added.
- **Database Work Remaining Before MVP:** Only adding the live CI migration test.

## 12. Security and AI Findings (Phase 7)
- **CSRF Model:** Exploitable current defect (P0).
- **Origin/Referer Validation:** Defense-in-depth improvement (P3).
- **JWT Storage:** Validated and stable.
- **Refresh Token Rotation:** Validated and stable.
- **Cookie Security:** Missing `secure: true` in dev, fine for now; must be active in prod.
- **IDOR/Ownership Controls:** E2E security tests confirm isolation.
- **Authentication Rate Limiting:** Exploitable current gap (P1).
- **OpenRouter Embedding URL:** Exploitable current defect (P0).
- **Embedding Fallback Behavior:** Exploitable current defect (P0).
- **Gemini Safety Settings:** Optional post-MVP work (P3).
- **AI Streaming:** User experience improvement (P1).
- **AI Request Timeout:** User experience improvement (P2).
- **Logging Redaction:** Defense-in-depth improvement (P2).
- **Quota Implementation:** Required for Public MVP (P1).

## 13. Ordered Execution Roadmap (Phase 8 & 11)

| Task ID | Title | Why Required | Scope / Affected Files | Dependencies | Model/Tool | Reasoning | Est. Hours | Tests | Acceptance | Commit? |
|---|---|---|---|---|---|---|---|---|---|---|
| T01 | Fix CSRF Middleware | Security vulnerability | `main.ts`, `auth.service.ts` | None | Codex GPT-5.6 Terra | High | 2 | API Test | Reject requests w/o valid token | Yes |
| T02 | Fix OpenRouter Embeddings | RAG relies on it | `ai.service.ts` | None | Codex GPT-5.6 Terra | Medium | 1 | Integration Test | Returns valid 1536d vector | Yes |
| T03 | Establish Staging Deployment | Unblocks Private Alpha | Infra / Env config | T01, T02 | Manual Owner Action | N/A | 8 | Deployment | App is accessible online | No |
| T04 | Add CI Migration Validation | Prevents broken DB deploys | `ci-cd.yml` | None | Codex GPT-5.6 Luna | Light | 4 | CI Run | CI fails if migration breaks | Yes |
| T05 | Implement Per-Endpoint Rate Limits | Prevents brute force | `throttler.guard.ts`, `auth.controller.ts` | None | Codex GPT-5.6 Terra | Medium | 4 | API Test | 429 returned after 5 reqs | Yes |
| T06 | Implement AI Streaming (SSE) | Prevents UI timeouts | `ai.service.ts`, AI Routes, Frontend Chat UI | T02 | Codex GPT-5.6 Sol | Extra High | 24 | E2E Test | UI updates as chunks arrive | Yes |
| T07 | Adopt React Query (Core) | Removes async debt | `files/page.tsx`, data hooks | None | Codex GPT-5.6 Sol | High | 20 | E2E Test | Data loads/caches without raw useEffect | Yes |
| T08 | Audit Log & GDPR Prep | Required for Public Launch | New schemas / services | T04 | Codex GPT-5.6 Sol | High | 16 | API Test | User deletions cascade properly | Yes |

## 14. Time Estimation Scenarios (Phase 9)

**Scenario A (One experienced full-time engineer without AI agents)**
- **Engineering Hours:** ~120 hours
- **Focused Working Days:** 15 days
- **Realistic Calendar Weeks:** 3 - 4 weeks
- **Range:** 3 weeks (Optimistic) - 6 weeks (Pessimistic)
- **Assumptions:** Dedicated time, no major external infrastructure blockers.

**Scenario B (One developer using Codex effectively for 4-6 hrs/day)**
- **Engineering Hours:** ~60 hours
- **Focused Working Days:** 10 days
- **Realistic Calendar Weeks:** 2 - 3 weeks
- **Range:** 2 weeks (Optimistic) - 4 weeks (Pessimistic)
- **Assumptions:** High AI prompt efficacy, minimal debugging loops.

**Scenario C (Fast restricted MVP path, deferring all nonessential work)**
- **Engineering Hours:** ~15 hours
- **Focused Working Days:** 3 days
- **Realistic Calendar Weeks:** 1 week
- **Range:** 1 week (Optimistic) - 2 weeks (Pessimistic)
- **Assumptions:** T01, T02, and T03 are the sole focus. Streaming and React Query are delayed to v1.1.

## 15. Lean Validation Policy (Phase 10)
- **After targeted source fix:** Run unit/integration tests for that specific module only.
- **When browser tests are required:** Only when UI components or React Query logic is altered.
- **When migration tests are required:** When schema files or migrations are added/modified.
- **When full P0 acceptance should run:** Before merging a major feature branch.
- **When full E2E should run:** Pre-release tag creation only.
- **Reused Evidence:** E2E smoke tests from previous successful builds are valid until core auth or layout routing changes.
- **Invalidated Evidence:** Any middleware change invalidates all security E2E tests.
- **When a broad audit is justified:** Only after major infrastructure transitions (e.g., swapping Postgres for MySQL, or App Router for Pages Router).
- **When no further audit is justified:** Immediately. Execute the roadmap.

## 16. Report-file Recommendation (Phase 11)
The file `StudyAI_Current_State_Verification.md` is an untracked temporary audit artifact.
- **Recommendation:** **Classification B.** Move this file, and the MVP Completion Plan, outside the repository tracked paths (e.g., an external Google Doc, Notion, or a separate `project-management` folder). It clutters the active codebase and is point-in-time specific.

## Final Launch Recommendation
Stop auditing. Execute T01 and T02 immediately. Deploy the Private Alpha. Let user friction define the next priority.
