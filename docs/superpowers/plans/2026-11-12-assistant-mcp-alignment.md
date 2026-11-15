# Assistant and MCP alignment implementation plan

> **For agentic workers:** Execute inline in the authorized isolated worktree, using superpowers:executing-plans and test-driven-development. Marketplace integration belongs to OpenAI Audit Marketplace.

**Goal:** Align current model policy and supported media workflows across web, Milo, direct MCP and the OpenAI candidate without losing historical results.

**Architecture:** The registry owns model publication; existing canonical quote, ownership, reservation, execution and refund owners stay shared. Extended Audio uses a durable dispatch committed with the job and quote claim, then an external worker executes the reserved run once. Current synchronous Eleven remains compatible while extended publication stays closed until the worker is operationally qualified.

**Tech Stack:** Next.js, TypeScript, MCP SDK, PostgreSQL 17, existing Audio/FFmpeg providers.

**Spec:** User request and `docs/operations/assistant-mcp-alignment-2026-11-12/README.md`.

## Global constraints

- Base is fetched origin/main `17bd771e64c2fa1186acdcb69245bb0c45b82ce3`; preserve the shared checkout.
- No merge to main, deployment, remote migration, secrets, paid generation or OpenAI submission.
- Marketplace branch, reviewer resources and presentation files are owned by the other chat.
- Preserve exact quote approval, one attempt, account/client scope and immutable historical output identity.

## Review focus

- An environment without production overrides must not re-enable archived Pika.
- A prepared Pika quote must fail before pricing, wallet reservation or provider work.
- Audio queue insertion failure must roll back the quote claim and wallet/job reservation.
- Concurrent or interrupted Audio worker execution must never buy another provider attempt.
- New models, references, characters, creator profiles and exports must retain their existing capability gates and ownership contracts.

## Task 1: Portable Pika retirement

Files: registry and generated projections; localized Pika archive content; model-registry guide; Pika/MCP contract tests.

- [x] Add failing Pika archive, aliases, discovery, recommendation, comparison and budget tests; extend prepare/confirm retirement checks.
- [x] Archive Pika in authored registry, remove current comparison suggestions and regenerate projections. Preserve historical model URLs and output access.
- [x] Update outdated Pika fixtures while retaining the behavior they exercised.
- [x] Run registry, relevant MCP, examples and archive/SEO tests; smoke localized archive routes.

## Task 2: Extended Audio execution

Files: Audio dispatch migration/repository/worker/CLI; canonical Audio confirmation; gated public Audio projection and shared MCP services; focused PostgreSQL and service tests.

- [x] Prove transactional enqueue, worker claim, account/client binding, reference drift, exact-once execution, failure/refund and replay behavior with failing tests.
- [x] Add enqueue inside the existing reservation/quote transaction. Return the existing job immediately; execution runs once outside HTTP.
- [x] Project all seven web Audio packs only for the explicitly configured worker release. Keep the default Eleven projection and old quotes recoverable.
- [x] Reuse the existing Audio executor and refund path; never reclaim a provider-started run automatically. Document external worker/migration/release prerequisites.
- [x] Run focused Audio/PG17/client suites, TypeScript and lint.

## Task 3: Remaining parity and marketplace handoff

Files: factual matrix, canonical Character Builder authoring adapter, native Milo creator operation lifecycle, plugin plan/generate guidance and pertinent contract tests where evidence proves drift.

- [x] Record all published model/mode coverage, Character Studio and looks/Recast, creator profiles/subtitles, Studio editing/export, private imports and recovery.
- [x] Separate implemented tools, closed runtime flags, old host tool discovery and missing authoring adapters. Implement locally supportable proven gaps without enabling remote resources.
- [x] Check current OpenAI metadata/UI/OAuth/skills docs against preserved marketplace adaptations.
- [x] Complete the independent review and final Studio/browser/client checks, fetch the Business Hub merged main, and deliver the common commits/tests/reintegration sequence. Browser 328/329 retains the independently reproduced main hydration warning; no suppression.


## Proven additional gaps implemented under Task 3

- [x] Add Character Builder native preparation and immutable recipe binding, exact shared payment/confirmation, and four MCP tools with an independent migration-qualified purchase gate.
- [x] Add truthful shared creator/tool discovery and private-safe canonical web handoffs.
- [x] Add native Milo creator/subtitle preparation, atomic saved quote checkpoint, application-only exact-price approval, journal/status recovery, subtitle edits and included revision-bound export.
- [x] Prove locally priced paid and included Milo acceptance/recovery with real PG17 and explicit lost-acknowledgement UI regression coverage.
- [x] Reproduce and fix GPT Image 2.5 Sunburst t2i/i2i certification in Milo; retain current registry/execution gates. Actual source projection covers the observed 43 models/145 mode pairs.
- [x] Close final review findings and record complete final test results and commit order.


## User steering and final verification

- [x] Coordinate with the Business Hub chat, preserve its scope, fetch and integrate main 371ee9e locally (feature merge 566d430c8).
- [x] Retain a single paid subtitle bundle with corrections, SRT/VTT/mix and MP4 included; apply the requested subtitle-only 200% markup through its own versioned commercial policy.
- [x] Add native Milo Character Builder authoring plus save/select and scoped selected-look reuse; retain generic attachment boundaries.
- [x] Resolve independent review findings on trusted account destinations and strict selection input; review cleared.
- [x] Commit common runtime as a2d769069 and final Product archive contracts as c9c0249a4; receiving owner reported its local reintegration.
- [x] Complete full financial matrices, registry/MCP/SEO checks, qa:editor and local build.
- [x] Finish the serial canonical browser/1697-file fast run and final static checks; record outcomes and the baseline warning in the committed evidence/handoff. Fast: 11226 passed, zero failed, one skip. Common follow-ups: f346f175e then 60a1f3a81.
