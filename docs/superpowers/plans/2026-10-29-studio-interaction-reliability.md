# Studio interaction reliability implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the observed reference-video pricing, missing render diagnosis and embedded-audio editing failures without repeating paid work.

**Architecture:** Preserve canonical generation validation, owned media qualification, revisioned timeline commands and export billing. Add only bounded operational facts to the director; recover an already-confirmed export through the existing exact-target worker.

**Tech Stack:** Next.js, TypeScript, PostgreSQL 17, Zod, Remotion, FFmpeg, ECS.

**Spec:** Existing contracts in `docs/engineering/studio-editor-architecture.md`, `docs/engineering/pricing-engine.md` and `docs/deployment/studio-timeline-exports.md`, plus the reported production failures.

## Global constraints

- Every generation or export requires a current quote and explicit confirmation.
- Preserve original assets, account/project ownership, stored request identities and financial receipts.
- Read routes do not initialize schema or mutate media facts.
- Unknown audio is distinct from measured silence; a mute must remain reversible.
- Release through an isolated clean branch, GitHub PR, required Quality CI and the Vercel Git integration.

## Review focus

- Supplementary videos must remain inside authored per-type and aggregate source limits.
- Missing old video metadata must not cause repeated uploads, fabricated durations or a model charge before failed qualification.
- Manual exports must be visible without exposing artifact URLs, worker diagnostics or another project's records.
- Unknown-video mute/default restoration must preserve trims, linked sound and the original file.
- Restarting a known orphaned worker must reuse the existing export, manifest and reservation.

## Tasks

### 1. Reference-video pricing and qualification

Owners: `generation-capability-validation.ts`, `paid-video-request-body.ts`, comparison failure/fingerprint helpers and Studio submit attachment qualification.

Interfaces: preserve the existing canonical request/reference contracts; qualify only selected, owned videos through `hydrateOwnedVideoMediaFacts` before building the new turn's reference facts.

- [x] Reproduce source-video plus supplementary-video rejection with synthetic owned clips.
- [x] Align role-to-field validation and paid materialization with supported provider fields; enforce authored per-type budgets.
- [x] Add safe mismatch diagnostics and invalidate historical negative evidence when validation policy changes.
- [x] Qualify missing selected-video metadata through the existing bounded media owner, with replay/source-change regressions.
- [x] Run focused pricing/reference/qualification tests and review the final diff.

### 2. Render diagnosis

Owners: `conversation-export-facts.ts`, conversation contracts/executor and the existing export reader.

Interfaces: `project.renders` contains at most eight safe render records; the session director can read an exact owned `exportId` or retain historical `quoteId` behavior.

- [x] Reproduce missing manual exports with disposable PostgreSQL.
- [x] Add SELECT-only project/sequence-scoped render facts and exact-ID inspection.
- [x] Verify missing schema, deleted/foreign records, historical quotes and no secret-bearing output.

### 3. Audio support and inspection-only guidance

Owners: shared audio provenance, canonical conversation editing, timeline read contracts and director instructions.

Interfaces: retain tri-state source facts and expose actual supported operations; inspect/explain requests use reads before any requested mutation.

- [x] Reproduce unknown audio being cached as silent and then refused by gain editing.
- [x] Preserve measured facts and allow safe explicit muting without claiming audio exists.
- [x] Verify mute/default restoration, silent media, external linked audio, frame preservation and real rendered sound.

### 4. Existing export recovery and release

- [x] Confirm the accepted original ECS launch, absent active work and untouched queued export before recovery.
- [x] Resume the exact confirmed export with the existing immutable, published worker image and one recovery identity.
- [x] Verify the completed artifact, library asset and original stored billing amount.
- [x] Exclude render financial ownership from generation-orphan refunds and preserve existing refunds on late delivery; verify ordinary orphan refunds and post-lock ledger evidence with PostgreSQL.
- [x] Verify the full editor suite, TypeScript, lint, exposure and independent review; preserve existing customer refunds when aligning delivery status.
- [ ] Run editor/QA, exposure, build and independent code review.
- [ ] Open a PR, pass every required CI lane, incorporate current main and run the committed deployment check.
- [ ] Merge through GitHub and verify both production domains against the merged revision.
