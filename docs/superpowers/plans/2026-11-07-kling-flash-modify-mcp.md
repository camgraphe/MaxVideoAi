# Kling Flash Modify and MCP filter implementation plan

> **For agentic workers:** Use the TDD workflow for each task and review the combined branch before opening the PR.

**Goal:** Discover image-capable modes accurately through MCP and integrate Kling 4.0 Flash Modify without paid generation.

**Architecture:** Keep the existing fal adapter, owned-media validation, canonical generation pipeline and workspace source workflow. Derive discovery from executable schemas. Keep separate reviewed customer tariffs for the new mode.

**Tech stack:** TypeScript, Next.js, Zod, node:test, disposable PostgreSQL 17.

**Spec:** [Flash Modify contract](../../model-launch/kling-v4-flash-modify.md).

## Constraints and review focus

- No paid generation, production data writes, merge or deployment.
- One owned source; source and reference videos remain separate throughout normalization and replay.
- Inherited output timing uses the exact source, while billing counts all submitted video occurrences.
- Source, references and video subjects total at most 20 seconds; no URL deduplication.
- Inherited framing does not advertise an aspect-ratio control. Extend stays unsupported.
- Missing reviewed Modify tariffs fail closed and never reuse Create tariffs.

## Task 1: MCP reference-image discovery

Owner: `frontend/src/server/agent-api/model-catalog.ts` and focused discovery tests.

- [x] Reproduce the standard Kling V4 v2v exclusion with `referenceImages: true`.
- [x] Derive scoped/unscoped support from applicable image fields; preserve negative controls.
- [x] Run MCP catalog/detail tests.

## Task 2: Flash Modify provider and canonical contract

Owners: `src/config/fal-engines/kling-v4-flash.ts`, `src/lib/kling-v4-flash.ts`, canonical generation and paid-request owners, `app/api/generate/_lib/kling-v4-owned-media.ts`.

- [x] Add failing tests for exact v2v endpoint, inherited and explicit timing, source/reference separation, subjects and rejection limits.
- [x] Add v2v schema and strict provider payload, then preserve private reference identity and trusted timing through canonical and web execution.
- [x] Verify queue recovery and external-import reuse retain v2v identity.

## Task 3: Pricing

Owners: Flash factual pricing, canonical pricing facts, manual tariff scenario projection and pricing audit inventory.

- [x] Add failing tests for source-derived fractional duration plus aggregate reference seconds and independent selectors.
- [x] Extend the factual usage calculator and admin inventory without activating cells.
- [x] Verify missing/active reviewed tariffs with disposable PostgreSQL and preserve creation amounts.

## Task 4: Workspace and public contract

Owners: workspace source/media projections, composer capabilities and model guidance/content.

- [x] Add failing tests for Modify entry, owned source/optional references and duration behavior.
- [x] Wire mode-aware media preparation and accurate controls/copy without changing layout.
- [x] Run workflow, DOM/browser and public-copy regressions; regenerate generated catalog/roster projections.

## Delivery

- [x] Run focused regression checks, frontend lint/typecheck, exposure lint, registry check, required validation suites and feasible build.
- [x] Review the combined diff, resolve findings, commit/push and open a GitHub PR with evidence and qualification limits.

## Review record

- Native inherited-duration snapshots preserve `auto` as editor intent; provider duration stays omitted. Fractional and whole-source replay are tested.
- The historical 72-class Flash launch batch remains unchanged. The current inventory adds 18 distinct Modify examples; production activation requires a separate review.
- Independent review found no remaining actionable issue after the replay and localized subject-help corrections.
- Full local validation and build were attempted; disk exhaustion caused temporary-file failures. Focused regressions are rerun, and required GitHub CI remains the delivery gate.
- [PR #632](https://github.com/camgraphe/MaxVideoAi/pull/632) is open. Its Git-backed Vercel preview built successfully; no production deployment or tariff activation was performed.
- The complete local run exposed additional creation-only Studio and inventory fixtures. They now explicitly cover Modify, retain historical creation prices, and require an owned source plus a separately reviewed Modify tariff. The affected disk failures pass in focused reruns. The local financial rehearsal also observed the commit changing during execution; required CI evaluates a fixed committed source.
