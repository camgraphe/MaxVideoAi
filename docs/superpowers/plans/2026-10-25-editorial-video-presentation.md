# Editorial video presentation implementation plan

> Execute in the isolated `codex/editorial-video-presentation` worktree with the executing-plans and test-driven-development skills. The delegated request and reader proposal already specify the design.

**Goal:** Allow directly visible editorial videos and uncropped portrait players while preserving existing articles.

**Architecture:** Extend the existing strict video block and shared server reader. Optional fields stay absent when omitted; effective defaults are disclosure and 16:9. Ingestion compares effective values across EN/FR/ES. Public projection and file export consume the same schema.

**Spec:** `/Users/adrienmillot/Desktop/Automatisation/blog/briefs/2026-10-25-product-character/03-reader-proposal.md` and the delegated request of 2026-10-25.

**Constraints:** No autoplay, synchronization, new hosts, media uploads, publication, deployment, menu/Modify work or Automatisation edits. Existing attribution, lazy iframe and origin-only referrer survive. Portrait fills mobile column and is centered at a maximum 360 px above 700 px. No new client JavaScript.

## Task 1: Controlled block contract and renderer

- [x] Add failing tests for legacy blocks, inline landscape/portrait, explicit disclosure, strict invalid values and effective cross-language parity.
- [x] Add `presentation?: 'inline' | 'disclosure'` and `aspectRatio?: '16:9' | '9:16'` to `frontend/lib/editorial/schema.ts`; extend effective parity checks.
- [x] Adapt `EditorialVisual.tsx` and its CSS only; share the iframe between presentations and retain native YouTube controls.
- [x] Verify JSON round trips, real publication-file export/loader, and both public/admin rendered output in all languages.

## Task 2: Browser evidence and handoff

- [x] Test actual shared readers at mobile/desktop sizes: visibility, disclosure toggling, aspect geometry, no overflow, lazy request and origin referrer. External player responses are explicit test fixtures.
- [x] Capture mobile and desktop screenshots into a separate ignored evidence folder. Attempt real embedded playback using an existing cited asset; distinguish network/player limitations from fixture evidence.
- [x] Run focused editorial/architecture tests, frontend lint, exposure lint, type/build checks where feasible; record limitations without weakening gates.
- [x] Document the exact optional-field contract and the preview renderer/validator delta for Automatisation, including its existing conclusion CTA discrepancy.
- [x] Review the whole diff and prepare the verified commit/draft PR handoff. No merge or deployment.

## Review focus

Omitted versus explicit defaults must compare equally without changing stored payloads. Invalid or localized divergent options must fail ingestion. Portrait iframe height must not stay at the browser's default 150 px. Captions/source links and the private-path referrer boundary must survive both presentations. Fixture player evidence must never be described as live YouTube playback.
