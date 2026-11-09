# Create Media Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Make single-click insertion and grouped reference insertion work consistently in Create, with complete ordinary media discovery.

**Architecture:** Keep the shared grid neutral: its primary activation and optional separate preview are supplied by the host. The picker accepts an explicit candidate list through the existing validated insertion pipeline. Normalize empty appendable targets at opening and reuse the common browse reader.

**Tech Stack:** Next.js, React, React Aria Components, SWR, Node DOM tests, PostgreSQL integration tests and hosted Browser CI.

**Spec:** `docs/superpowers/specs/2026-11-09-create-media-picker-design.md`

## Global constraints

- Preserve canonical originals, typed references, source proofs, owner/context fencing, current model limits and atomic acceptance.
- Keep Character entities immediate and distinct from source=character image assets.
- No provider generation or production media mutations during QA; no locally launched browsers.
- Changes remain in isolated `codex/media-picker-ux-fix`; normal PR/CI/Git deployment only.

## Review focus

- A stale checkbox basket must not be submitted by a direct thumbnail action.
- Rejected, trashed, replaced or wrong-owner sources must remain unaccepted.
- Duplicate activations and retired account/model contexts must not insert twice or late.
- Empty appendable slots accept multiple; occupied and single-role slots still replace exactly one.
- Server search and pagination preserve staged order, originals and eligibility across scope changes.

## Task 1: Direct activation and explicit preview — root

**Files:** `frontend/components/library/{useReferencePickerSelection.ts,CompactMediaGrid.client.tsx,ReferenceLibraryPicker.client.tsx,ReferencePickerFooter.client.tsx,reference-picker-copy.ts,compact-library.css}`, `frontend/src/styles/app-experience.css`.

**Interfaces:** Add `onPreview?` and `openActionLabel?` to the grid. Add `confirmAsset(asset)` to the selection hook, sharing an internal explicit-list acceptance with existing `confirm()`. Add `browseLibrary?: boolean` to picker selection for Task 3.

- [ ] Write failing real-component DOM tests for direct exact-one acceptance with an existing basket, separate preview and duplicate/blocked activation.
- [ ] Run the focused test and record the expected RED behavior.
- [ ] Implement explicit-list validation/acceptance, primary insertion and separate preview; preserve immediate Characters and management viewer behavior.
- [ ] Replace ambiguous footer arrows with accessible controls, show selection count and add clear instructions/filter labels.
- [ ] Run picker DOM and media collection contracts; preserve source/version/context rejection tests.

## Task 2: Empty appendable targets — image/video agent

**Files:** `app/_hooks/useWorkspaceReferenceAssets.ts`, `app/image/_hooks/useImageReferenceSlots.ts`, necessary route-local helpers and behavior tests.

**Interfaces:** Normalize only a genuinely empty valid slot of a multi-capacity appendable field to group append. Existing occupied targets retain their index. Shared picker files are owned by root.

- [ ] Write and run failing opening/receiver tests for an empty indexed slot accepting two references.
- [ ] Implement target normalization and preserve occupied/uploading/error targets, single capacities and invalid indices.
- [ ] Run current model-budget, source-lifecycle and image insertion tests.

## Task 3: Common ordinary media browse — library agent plus root

**Files:** `AssetLibraryModal.tsx`, image `ImageLibraryModal.tsx`, necessary listing hooks and transport/convergence tests; root owns shared picker reader wiring.

**Interfaces:** Ordinary media hosts opt into `selection.browseLibrary=true`. Shared reader uses `view=all` or explicit `review`, actual kind/source, server `q` and organization scope. Specialized Character entities remain immediate; explicit source-proof policies remain effective.

- [ ] Write and run failing tests for ordinary recent unsaved image discovery, server search and cursor continuation.
- [ ] Opt in ordinary hosts, remove avoidable duplicate legacy reads without weakening specialized policies, and wire the common reader.
- [ ] Verify exact DTO/original preservation, ordered staged selection and source filtering.

## Task 4: Review and delivery — root

- [ ] Review all combined changes, run focused DOM/contracts, typecheck, lint and exposure checks; run selected full validation lanes.
- [ ] Exercise desktop/mobile single-click, two-checkbox acceptance, preview return, refusal/Cancel and source filters in Codex IAB on a controlled local fixture.
- [ ] Open/update the PR; wait for required Quality CI on the exact final candidate and qualify its Git Preview.
- [ ] Follow current main/source alignment and normal Git release policy; verify both production domains and repeat the Create picker scenarios without generation.
- [ ] Finish the remaining read-only production gallery/Character Studio checks and report evidence and limits.
