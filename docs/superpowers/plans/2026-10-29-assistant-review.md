# Shared Assistant Review Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Work stays in PR #555.

**Goal:** Review native assistant evidence with historical context and a common human evaluation vocabulary.
**Architecture:** A bounded request manifest at native provider checkpoints; source-specific read adapters behind admin authorization and audited reveals; common append-only annotations.
**Tech Stack:** Next.js, TypeScript, PostgreSQL 17, existing React admin components.
**Spec:** docs/superpowers/specs/2026-10-29-assistant-review-design.md

## Global constraints
No production writes/provider calls. English UI. No public content reads or raw exports.
Unknown, missing, truncated and failed remain distinct. Existing billing/replay identities stay unchanged.

## Review focus
- Missing migration must not turn unavailable evidence into an empty result.
- Same request ID in two accounts/sessions cannot leak across scopes.
- Malformed/oversized stored JSON cannot expose secrets or overwhelm review.
- Studio retries/fallback must capture the actual dispatched runtime once.
- MCP prepared/accepted is not generation completed or external-host chat success.

### Task 1: Native model input manifests
Files: src/server/assistant-review/context.ts; prompt-assistance service; Studio checkpoint;
neon migration 90; tests/assistant-review-context.test.ts and checkpoint integration.
- [x] Write/run failing projection and persisted-capture tests.
- [x] Implement bounded redacted manifest, explicit version/fingerprints/media omissions.
- [x] Capture composer context and gated Studio context without changing dispatch/replay semantics.
- [x] Run focused provider/checkpoint regressions.

### Task 2: Audited common review and annotations
Files: frontend/server/admin-assistant-review/{contracts,read-model,sources,http}.ts;
admin API; tests/admin-assistant-review-postgres.test.ts and route tests.
- [x] Write/run failing scope/audit/annotation tests on disposable PG17.
- [x] Add source adapters, metadata-only lists, audited native content reads and annotation history.
- [x] Test deletion, auth, CSRF, body bounds, missing storage, historical context and MCP origin.

### Task 3: Review UI, documentation and final validation
Files: /admin/assistants pages/components, existing Studio context display/navigation;
docs/engineering/assistant-review.md; browser/DOM tests.
- [x] Build bounded source/account/conversation browsing and explicit reveal/annotation UI.
- [x] Verify browser behavior and existing Studio review contracts.
- [x] Run focused suite, TypeScript, lint, exposure check and diff check.
- [ ] Independent final review; fix important findings; commit/push current PR without deployment.

## Execution ledger
The user delegated this improvement within the ongoing PR. No additional approval
round is needed for reversible implementation and synthetic validation.

Task 1: complete — shared projection, native composer snapshots including rejected funding, gated Studio reservation-time capture; unit and PG regressions passed.
Task 2: complete — common audited sources, exact scope/deletion checks, latest-review filters, idempotent annotations and real admin-role boundary passed on disposable PG17.
Task 3: implementation and browser verification complete — desktop1440/mobile390 explicit reveal/hide and save exercised. Focused suite:45 passed; TypeScript passed; lint0errors/7pre-existing warnings; public exposure and diff checks passed. Final review pending.
