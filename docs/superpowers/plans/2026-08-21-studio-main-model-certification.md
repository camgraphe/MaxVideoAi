# Studio Main Sync And Model Certification Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` and `superpowers:test-driven-development`. Keep the existing Studio worktree and execute each task in order.

**Goal:** Update `codex/maxvideoai-editor` to current `main`, add a fail-closed Studio certification layer, and fully support Seedance 2.5 and MiniMax H3 without regressing existing projects.

**Architecture:** Engine schemas provide facts; Studio certification provides block/workflow readiness; one resolved policy drives controls, connectors, validation, pricing, and request serialization. Semantic graph kinds remain stable while connectors preserve exact execution field and slot IDs.

**Tech stack:** Next.js App Router, TypeScript, React Flow, generated engine catalog, Node tests through `tsx`, Playwright.

## Task 1: Integrate Current Main Safely

**Files:** shared files selected by the merge; all Studio-only files must remain present.

- [x] Confirm the Studio worktree is clean and record the pre-merge commit.
- [x] Merge current local `main` into `codex/maxvideoai-editor` without checking out or modifying `main`.
- [x] Resolve conflicts using current `main` for shared generation infrastructure and preserving intentional Studio routes, adapters, docs, scripts, and tests.
- [x] Verify `frontend/app/(core)/(workspace)/app/studio`, `frontend/app/api/studio`, and `frontend/src/server/studio` remain present.
- [x] Run `pnpm model:registry:check` and regenerate projections only through documented commands if drift exists.
- [x] Run baseline Studio architecture contracts and TypeScript before model-specific work.

## Task 2: Add Fail-Closed Studio Certification

**Files:**

- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-v1-block-matrix.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-certification.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-engine-availability.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-engine-picker.ts`
- Modify: `tests/maxvideoai-editor-v1-capability-matrix.test.ts`
- Modify: `tests/maxvideoai-editor-engine-picker.test.ts`

- [x] Write a failing test proving a published but uncertified engine is absent from every Studio picker.
- [x] Write failing inclusion/exclusion tests for certified engine, block, and workflow tuples.
- [x] Add a typed certification registry containing only Studio-specific readiness facts.
- [x] Filter picker candidates through publication, capability, block matrix, and certification.
- [x] Verify the tests turn green without copying model capability data into Studio.

## Task 3: Preserve Exact Connector Fields And Media Provenance

**Files:**

- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-input-connectors.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`
- Modify: `tests/maxvideoai-editor-v1-request-payloads.test.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [x] Write failing tests for exact image/video/audio slot IDs and source media metadata.
- [x] Add execution field metadata to resolved connectors while retaining semantic edge kinds.
- [x] Preserve exact slot IDs when graph inputs become API attachments.
- [x] Carry asset ID, MIME, byte size, dimensions, and duration when known.
- [x] Keep persisted incompatible edges visible and disabled instead of deleting them.
- [x] Verify payload and connector tests turn green.

## Task 4: Unify Pricing And Submission Facts

**Files:**

- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-facts.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`
- Modify: `tests/maxvideoai-editor-v1-pricing.test.ts`
- Modify: `tests/maxvideoai-editor-v1-request-payloads.test.ts`

- [x] Write failing tests proving pricing and submission use the same mode, fields, counts, and media presence.
- [x] Add normalized generation facts with `referenceImageCount`, `hasVideoInput`, exact assignments, and reference-budget usage.
- [x] Build wallet preflight and final requests from those facts.
- [x] Add field-owned validation issues for missing or invalid inputs.
- [x] Verify pricing and request tests turn green.

## Task 5: Certify Seedance 2.5

**Files:**

- Modify: Studio certification and block policy files from Tasks 2-4.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify: relevant node and inspector controls only if the policy cannot already render the fields.
- Add/modify focused Studio tests.

- [x] Write failing tests for Generate Video `t2v`, `i2v`, and `ref2v` certification.
- [x] Write failing tests for Modify Video `v2v` certification and incompatible block exclusion.
- [x] Add a specialized Extend Video preset and failing tests for one-to-three extension source videos.
- [x] Enforce duration, resolution, ratio, media, per-field, and shared-reference limits from the engine schema.
- [x] Verify pricing changes when video input is present.
- [x] Verify request attachments retain exact Seedance field IDs.
- [x] Add localized user-facing copy for the new preset and incompatibility reasons.

## Task 6: Certify MiniMax H3

**Files:** certification, policy, pricing, request, controls, copy, and focused tests from Tasks 2-5.

- [x] Write failing tests for H3 `t2v`, `i2v`, and `ref2v` availability.
- [x] Prove H3 is absent from Modify Video and Extend Video.
- [x] Expose `768P`, `2K`, and `4K` exactly as catalog values.
- [x] Hide or derive aspect ratio where required by image mode.
- [x] Render native stereo audio as included and omit an audio toggle.
- [x] Enforce visual-reference dependency, per-item durations, combined duration, and shared reference budget.
- [x] Include `referenceImageCount` in pricing and test the surcharge above five images.
- [x] Preserve exact H3 slot IDs in request attachments.

## Task 7: Normalize Existing Engine State

**Files:**

- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-selection.ts`
- Modify: persistence normalization only if needed.
- Modify: focused model selection and project hydration tests.

- [x] Write a failing test for a persisted Seedream 5 Pro 4K project.
- [x] Normalize unsupported stored values to the selected engine default without modifying unrelated state.
- [x] Surface a concise compatibility notice.
- [x] Run the existing certified-engine matrix to detect other stale defaults or options.

## Task 8: Browser And Release Verification

**Files:**

- Modify: `tests/e2e/editor/editor-smoke.spec.ts`
- Modify: `docs/engineering/studio-editor-architecture.md`
- Modify: `frontend/app/(core)/(workspace)/app/studio/AGENTS.md` if the new ownership boundary is not already explicit.

- [x] Add Playwright scenarios for Seedance 2.5, H3, engine switching, connector capacity, disabled choices, and readiness/price state.
- [x] Inspect Generate, Modify, and Extend blocks in light and dark modes at desktop and compact widths.
- [x] Run `pnpm model:registry:check`.
- [x] Run upstream Seedance 2.5, H3, reference-budget, and media-constraint tests.
- [x] Run `npm run test:editor` and the focused Playwright editor specs.
- [x] Run TypeScript, frontend lint, exposure lint, localization check, and `git diff --check`.
- [x] Update architecture documentation with the certification and normalized-generation-facts ownership boundaries.

## Completion Gate

The work is complete only when both new engines are visible exclusively in certified blocks, every displayed option affects the actual request, pricing matches the same normalized inputs as submission, existing projects remain loadable, and all release verification commands pass.
