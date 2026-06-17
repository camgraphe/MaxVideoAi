# Studio UX Capability Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Studio comprehension, reliability, and accessibility by making block capabilities, media metadata, timeline rules, menus, and mobile surfaces explicit and test-backed.

**Architecture:** Studio remains route-local under `frontend/app/(core)/(workspace)/app/studio`. Capability and editing rules must live in pure `_lib`, `_state`, or focused controller/helpers before UI wiring. `WorkspacePage.client.tsx` stays orchestration-only.

**Tech Stack:** Next.js App Router, React, React Flow, TypeScript, route-local CSS modules, node:test, Playwright editor specs.

---

## Mandatory Context

Before editing, every worker must read:

- `AGENTS.md`
- `docs/engineering/llm-working-guide.md`
- `docs/engineering/studio-editor-architecture.md`
- `frontend/app/(core)/(workspace)/app/studio/AGENTS.md`
- `docs/superpowers/specs/2026-06-17-studio-ux-capability-upgrade-design.md`

Do not edit unrelated workspace files. Do not revert other workers' changes. Keep commits small and scoped.

## Verification Commands

Use focused checks first:

```bash
npm run test:editor
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts tests/maxvideoai-editor-project-media-timeline.test.ts tests/maxvideoai-editor-timeline-external-drop.test.ts tests/maxvideoai-editor-timeline-interaction.test.ts tests/studio-localization-contract.test.ts
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Use browser/E2E checks after UI gestures change:

```bash
npm run test:editor:e2e
```

## Current Preflight Result

- Branch: `codex/maxvideoai-editor`
- Initial worktree: clean
- `npm run architecture:audit -- --min-lines 500` shows Studio hotspots in `studio-copy.ts`, Project Media, Canvas, Timeline, Toolbar, Inspector, and persistence files.
- `tests/maxvideoai-editor-timeline-external-drop.test.ts` was stale for `ghostItems`; this plan starts by stabilizing that contract.

## Subagent Execution Model

Use one worker per task, sequential implementation with reviews between tasks. Exploratory subagents may run in parallel only for read-only investigation. Coding workers must own disjoint files or run sequentially.

Recommended review per task:

1. implementer worker;
2. spec-compliance reviewer;
3. code-quality reviewer;
4. local verification by coordinator.

## Task 0: Stabilize Existing Timeline External Drop Contract

**Files:**

- Modify: `tests/maxvideoai-editor-timeline-external-drop.test.ts`

- [x] **Step 1: Update the old preview shape expectation**

Add `ghostItems` to the existing `resolveTimelineExternalDropPreview` expectation in `timeline external drop helper resolves ghost duration and insertion boundary`.

- [x] **Step 2: Add linked audio ghost coverage**

Add a test asserting that a video payload with `hasTimelineAudio: true` returns both the primary video ghost and the linked audio ghost.

- [ ] **Step 3: Run the focused test**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-timeline-external-drop.test.ts
```

Expected: all tests in that file pass.

- [ ] **Step 4: Commit**

```bash
git add tests/maxvideoai-editor-timeline-external-drop.test.ts
git commit -m "test(studio): update timeline drop ghost contract"
```

## Task 1: Expand Studio Contract Bundle

**Owner:** Architecture/Test worker

**Files:**

- Modify: `package.json`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] **Step 1: Add a broader Studio contract command**

Add `test:editor:contracts` with the adjacent Studio pure/contract tests currently excluded from `test:editor`:

```json
"test:editor:contracts": "tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-workspace-architecture.test.ts tests/maxvideoai-editor-sequence-api-persistence.test.ts tests/maxvideoai-editor-generation-blocks.test.ts tests/maxvideoai-editor-project-media-timeline.test.ts tests/maxvideoai-editor-timeline-external-drop.test.ts tests/maxvideoai-editor-timeline-interaction.test.ts tests/maxvideoai-editor-timeline-selection.test.ts tests/maxvideoai-editor-timeline-export.test.ts tests/studio-localization-contract.test.ts"
```

Keep `test:editor` as the fast historical command unless the suite remains fast enough to expand safely.

- [ ] **Step 2: Assert the command exists in architecture tests**

In `tests/maxvideoai-editor-workspace-architecture.test.ts`, add an assertion that `package.json` contains `test:editor:contracts`, so future contract coverage does not silently disappear.

- [ ] **Step 3: Run commands**

```bash
npm run test:editor
npm run test:editor:contracts
```

- [ ] **Step 4: Commit**

```bash
git add package.json tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "test(studio): add broader editor contract suite"
```

## Task 2: Define The Block Capability Matrix Contract

**Owner:** Blocks/Engines worker

**Files:**

- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-capability-registry.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-input-connectors.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] **Step 1: Write failing tests for a per-preset matrix**

In `tests/maxvideoai-editor-generation-blocks.test.ts`, add table-driven assertions for these presets:

- `generate-video`
- `modify-video`
- `generate-image`
- `modify-image`
- `character-builder`
- `angle`
- `upscale-image`
- `upscale-video`
- `audio-music`
- `audio-voiceover`
- `audio-sfx`
- `audio-sound-design`
- `chat-box`

Each row should assert:

- default model id;
- workflow/family;
- required inputs;
- optional inputs;
- output media kind;
- pricing availability state;
- whether missing input should produce a visible reason.

- [ ] **Step 2: Add normalized policy types**

Extend the Studio capability/policy types to support:

- `requiredInModes`;
- `minCount`;
- `maxCount`;
- `mutuallyExclusiveWith`;
- `acceptedMediaKinds`;
- `acceptedFormats`;
- `maxDurationSec`;
- `maxFileSizeMb`;
- `outputMediaKind`;
- `outputCount`;
- `controlFields`;
- `pricingRelevantFields`;
- `disabledReason`.

- [ ] **Step 3: Implement policy normalization**

Make `resolveWorkspaceBlockPolicy` return the normalized contract for each block, using existing engine schemas where available and explicit virtual capabilities for tool/audio/chat blocks.

- [ ] **Step 4: Add architecture assertions**

Assert that node UI and inspector UI consume policy output instead of duplicating connector/settings rules.

- [ ] **Step 5: Run tests**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts tests/maxvideoai-editor-workspace-architecture.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts tests/maxvideoai-editor-generation-blocks.test.ts tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "feat(studio): define block capability policy matrix"
```

## Task 3: Align Generation Requests, Pricing, And Output Kinds

**Owner:** Blocks/Engines worker

**Files:**

- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [ ] **Step 1: Add request-builder tests**

Add tests proving:

- angle generation outputs image artifacts;
- character builder uses character-tool settings, not video-model settings;
- image generation/editing forwards supported image settings;
- modify video forwards source-video-first settings;
- upscale forwards factor/format/target options;
- audio tools forward duration/voice/mood/intensity as applicable;
- chat either includes connected context or has no unsupported media handles.

- [ ] **Step 2: Wire policy fields into request builders**

Generation request builders must consume the policy/control fields from Task 2 and reject unsupported combinations before calling a route.

- [ ] **Step 3: Wire pricing readiness**

Pricing should return:

- `connect input` when a required input is missing;
- no estimate when a model/tool cannot estimate;
- real estimate when all price-relevant fields are available;
- short disabled reasons for unsupported combinations.

- [ ] **Step 4: Run tests**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests.ts frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing.ts frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing.ts tests/maxvideoai-editor-generation-blocks.test.ts
git commit -m "feat(studio): align block requests and pricing with capabilities"
```

## Task 4: Redesign Node Shell Around Policy Data

**Owner:** UI System worker

**Files:**

- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-frame.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-input-dock.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-nodes.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-shot-controls.module.css`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`
- Modify: `tests/e2e/editor/editor-smoke.spec.ts`

- [ ] **Step 1: Add UI architecture assertions**

Assert that shot nodes no longer render large placeholder-only generation panels when inline settings exist.

- [ ] **Step 2: Implement the stable node grammar**

Use this hierarchy:

- header;
- primary settings;
- optional preview/prompt area;
- generate action with price;
- status row;
- compact input/output rows.

- [ ] **Step 3: Fix connector scale and alignment**

Inputs and outputs should use small full-color handles aligned to their row, with enough spacing to prevent visual noise.

- [ ] **Step 4: Normalize Generate button style**

Generate buttons should show action and price without oversized typography or cropped labels. Disabled states should remain readable.

- [ ] **Step 5: Run visual/browser smoke**

```bash
frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts --grep "canvas"
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-nodes.module.css frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-shot-controls.module.css tests/maxvideoai-editor-workspace-architecture.test.ts tests/e2e/editor/editor-smoke.spec.ts
git commit -m "feat(studio): refine canvas node system"
```

## Task 5: Build The LLM Chat Node As A Real Portable Chat

**Owner:** Chat worker

**Files:**

- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-chat-node.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ChatNodeInspector.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests.ts`
- Modify: `frontend/lib/studio-chat-models.ts`
- Modify: `frontend/app/api/studio/chat/route.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [ ] **Step 1: Decide connector truth**

Either implement connected text/image/video/audio context in `/api/studio/chat/route.ts`, or remove unsupported media handles from chat. Recommended: support text plus media summaries first; avoid pretending to upload binary media into LLM if not implemented.

- [ ] **Step 2: Add chat tests**

Test that multi-turn messages persist, model selection is valid, connected prompt/text context is included, and unsupported media handles do not appear.

- [ ] **Step 3: Implement compact chat UI**

The node should expose latest assistant/user messages, model, send box, and output text connector. The inspector can own the full conversation transcript.

- [ ] **Step 4: Add recommended models**

Expose a concise list of useful Gemini/OpenAI models already supported by the app/backend. Do not invent unavailable provider ids.

- [ ] **Step 5: Run tests**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-chat-node.tsx frontend/app/(core)/(workspace)/app/studio/workspace/_components/ChatNodeInspector.tsx frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests.ts frontend/lib/studio-chat-models.ts frontend/app/api/studio/chat/route.ts tests/maxvideoai-editor-generation-blocks.test.ts
git commit -m "feat(studio): make chat node context aware"
```

## Task 6: Fix Project Media Metadata Chain

**Owner:** Media/Library worker

**Files:**

- Modify: `frontend/app/api/uploads/audio/route.ts`
- Modify: `frontend/app/api/media-library/save-output/route.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-metadata.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaMetadataHydration.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useProjectMediaController.ts`
- Modify: `tests/maxvideoai-editor-project-media-timeline.test.ts`
- Add or modify API contract tests if an upload/save-output route test exists.

- [ ] **Step 1: Add metadata tests**

Assert:

- images missing dimensions are hydration candidates;
- videos missing only duration are hydration candidates;
- timeline clips receive `sourceDurationSec`;
- audio cards do not show fabricated sample rate;
- `save-output` response includes `durationSec`.

- [ ] **Step 2: Persist real audio duration**

Measure and return audio duration where possible. If server-side duration extraction is not available, mark it unknown and rely on browser repair instead of fabricating a duration.

- [ ] **Step 3: Include duration in save-output response**

Return the saved output duration from `/api/media-library/save-output`.

- [ ] **Step 4: Expand hydration**

Repair image dimensions, video dimensions, and duration-only missing metadata. Propagate repaired metadata to project assets and derived timeline clips.

- [ ] **Step 5: Remove fake labels**

Remove hard-coded metadata such as `48kHz` when the value is not known.

- [ ] **Step 6: Run tests**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-project-media-timeline.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/api/uploads/audio/route.ts frontend/app/api/media-library/save-output/route.ts frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-metadata.ts frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaMetadataHydration.ts frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useProjectMediaController.ts tests/maxvideoai-editor-project-media-timeline.test.ts
git commit -m "fix(studio): preserve truthful project media metadata"
```

## Task 7: Improve Library Access And Project Media Performance

**Owner:** Media/Library worker

**Files:**

- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryBrowser.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceProjectMediaLibraryModal.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineProjectSidebar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useProjectMediaController.ts`
- Modify: `tests/e2e/editor/editor-library.spec.ts`

- [ ] **Step 1: Add tests for filters and freshness**

Test that image/video/audio filters work in Project Media and library modal, and that upload/save/delete invalidates or merges the cache.

- [ ] **Step 2: Add cache invalidation**

Invalidate or patch the module-level Studio library cache after upload, save-output, delete, and import.

- [ ] **Step 3: Fix search semantics**

Either make search server-backed or label the search clearly as loaded-items-only and expose load-more. Recommended long-term: server-backed search with filters.

- [ ] **Step 4: Remove inert controls**

Filter/grid controls should work or disappear. Do not leave affordances that do nothing.

- [ ] **Step 5: Optimize folder counts**

Precompute folder counts with maps instead of scanning all media per folder.

- [ ] **Step 6: Run tests**

```bash
frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-library.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryBrowser.tsx frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceProjectMediaLibraryModal.tsx frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineProjectSidebar.tsx frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useProjectMediaController.ts tests/e2e/editor/editor-library.spec.ts
git commit -m "feat(studio): improve project media library access"
```

## Task 8: Make Timeline Gap, Batch Delete, And Linked Media Rules Atomic

**Owner:** Timeline worker

**Files:**

- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-gap-editing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-linked-audio.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceTimelineClipActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/useTimelineSurfaceSelection.ts`
- Modify: `tests/maxvideoai-editor-timeline-interaction.test.ts`
- Modify: `tests/maxvideoai-editor-timeline-selection.test.ts`
- Modify: `tests/e2e/editor/editor-timeline.spec.ts`

- [ ] **Step 1: Add pure tests**

Cover:

- track-local gap selection;
- delete gap on clicked track;
- batch delete with linked video/audio groups;
- no same-track overlap after shifting;
- linked audio remains synced after unrelated ripple operations.

- [ ] **Step 2: Implement atomic batch helper**

Replace sequential ripple delete loops with one helper that computes the final timeline once and validates no overlaps.

- [ ] **Step 3: Re-sync linked groups after shifts**

After gap delete or batch delete, linked video/audio groups should remain aligned unless explicitly unlinked.

- [ ] **Step 4: Wire UI**

UI should call named helpers. Do not encode new edit rules inside pointer handlers.

- [ ] **Step 5: Add E2E**

Add one scenario reproducing linked audio overlap through indirect video drag, and one scenario for gap selection on a clicked track.

- [ ] **Step 6: Run tests**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-timeline-interaction.test.ts tests/maxvideoai-editor-timeline-selection.test.ts
frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-timeline.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing.ts frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceTimelineClipActions.ts frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/useTimelineSurfaceSelection.ts tests/maxvideoai-editor-timeline-interaction.test.ts tests/maxvideoai-editor-timeline-selection.test.ts tests/e2e/editor/editor-timeline.spec.ts
git commit -m "fix(studio): make timeline gap and linked media edits atomic"
```

## Task 9: Standardize Studio Menus, Popovers, Dialogs, And Focus

**Owner:** A11y/UI worker

**Files:**

- Add: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ui/StudioMenu.tsx`
- Add: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ui/StudioPopover.tsx`
- Add: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ui/StudioDialog.tsx`
- Add: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ui/StudioSegmentedControl.tsx`
- Add: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ui/StudioSwitch.tsx`
- Add: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/studio-controls.module.css`
- Modify menus/popovers/dialog call sites in toolbar, navigator, media, inspector, export, projects where safe.
- Modify: `tests/e2e/editor/editor-smoke.spec.ts`

- [ ] **Step 1: Create route-local primitives**

Implement accessible primitives with:

- `aria-expanded`;
- `aria-controls`;
- Escape behavior;
- focus return;
- roving focus for menus;
- focus trap for dialogs;
- visible focus ring.

- [ ] **Step 2: Migrate highest-risk call sites**

Start with Canvas toolbar block picker, Canvas navigator template replace, Project Media menus, and export dialog. Do not migrate every menu in one risky patch.

- [ ] **Step 3: Replace misused tablists**

Use segmented controls for filters unless there are actual tab panels.

- [ ] **Step 4: Add keyboard tests**

Playwright tests should cover first-focus, ArrowUp/Down, Escape, return focus, and Tab cycle for at least one menu, popover, and dialog.

- [ ] **Step 5: Run smoke tests**

```bash
frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts --grep "keyboard|dialog|menu|canvas"
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/studio/workspace/_components/ui frontend/app/(core)/(workspace)/app/studio/workspace/_styles/studio-controls.module.css tests/e2e/editor/editor-smoke.spec.ts
git commit -m "feat(studio): add accessible editor controls"
```

## Task 10: Mobile Responsive Studio Pass

**Owner:** Responsive/UI worker

**Files:**

- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceMobilePanelControls.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/media.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/inspector.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/timeline.module.css`
- Modify: `tests/e2e/editor/editor-smoke.spec.ts`

- [ ] **Step 1: Add mobile E2E scenarios**

Use viewports around `390x844` and tablet width. Test media drawer, inspector drawer, canvas toolbar popover/bottom sheet, timeline scroll, and export dialog.

- [ ] **Step 2: Upgrade mobile panels to drawers**

Project Media and Inspector must have close buttons, focus trap, `aria-expanded`, and focus return.

- [ ] **Step 3: Adjust toolbar popovers**

Canvas toolbar pickers and Canvas navigator should become bottom-sheet/drawer style on narrow screens.

- [ ] **Step 4: Keep timeline edit rules unchanged**

Only layout/tap target behavior changes. Timeline math remains in pure helpers.

- [ ] **Step 5: Run mobile specs**

```bash
frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts --grep "mobile|drawer|responsive"
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceMobilePanelControls.tsx frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css frontend/app/(core)/(workspace)/app/studio/workspace/_styles/media.module.css frontend/app/(core)/(workspace)/app/studio/workspace/_styles/inspector.module.css frontend/app/(core)/(workspace)/app/studio/workspace/_styles/timeline.module.css tests/e2e/editor/editor-smoke.spec.ts
git commit -m "feat(studio): improve mobile editor panels"
```

## Task 11: Run User Simulations And Final QA

**Owner:** QA worker

**Files:**

- Modify: `tests/e2e/editor/editor-smoke.spec.ts`
- Modify: `tests/e2e/editor/editor-timeline.spec.ts`
- Modify: `tests/e2e/editor/editor-library.spec.ts`
- Modify: `tests/e2e/editor/editor-performance.spec.ts`

- [ ] **Step 1: Add simulation labels**

Map the design spec's user simulations to E2E test names or annotations.

- [ ] **Step 2: Add coverage for the highest-risk simulations**

Prioritize:

- heavy library user;
- linked audio timeline editor;
- AI canvas creator;
- keyboard-only menu/dialog user;
- mobile reviewer.

- [ ] **Step 3: Run final focused QA**

```bash
npm run test:editor
npm run test:editor:contracts
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

- [ ] **Step 4: Run relevant E2E**

```bash
npm run test:editor:e2e
```

- [ ] **Step 5: Final architecture audit**

```bash
npm run architecture:audit -- --min-lines 500
```

Record any Studio files still above 500 lines and whether they are acceptable or need a follow-up extraction.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/editor docs/superpowers/specs/2026-06-17-studio-ux-capability-upgrade-design.md docs/superpowers/plans/2026-06-17-studio-ux-capability-upgrade.md
git commit -m "test(studio): add UX simulation coverage"
```

## Subagent Prompt Templates

### Blocks/Engines Worker

```txt
You own Studio block capability and pricing/request contracts. Read the mandatory context and docs/superpowers/specs/2026-06-17-studio-ux-capability-upgrade-design.md. Work only in _lib/models, workspace-tool request/pricing/routing files, workspace-types, and generation-block tests unless explicitly needed. Do not edit UI files. Implement the assigned task, run the focused tests, and return changed files plus verification output.
```

### UI System Worker

```txt
You own canvas node visual system and route-local UI primitives. Read the mandatory context and spec. Work only in _components/nodes, _components/ui, related CSS modules, and relevant E2E/architecture tests. Do not change generation request behavior. Preserve existing localized copy paths. Implement the assigned task, run focused browser/unit checks, and return changed files plus verification output.
```

### Media/Library Worker

```txt
You own Project Media, library access, metadata hydration, and media-related API contracts. Read the mandatory context and spec. Work only in Project Media hooks/controllers/components, media metadata helpers, upload/save-output routes, and media/library tests. Do not change timeline edit math except through metadata fields. Implement the assigned task, run focused tests, and return changed files plus verification output.
```

### Timeline Worker

```txt
You own timeline pure edit rules and their UI wiring. Read the mandatory context and spec. Work first in _lib/timeline and timeline-focused tests, then wire hooks/components. Preserve no-overlap and linked media invariants. Do not change Project Media or Canvas UI except drop validation calls if required. Implement the assigned task, run focused tests, and return changed files plus verification output.
```

### QA Worker

```txt
You own E2E simulation coverage and final verification. Read the mandatory context and spec. Work only in tests/e2e/editor unless a test helper needs a safe update. Do not change production code unless a test exposes a clear blocker and the coordinator assigns it. Return tests added, commands run, screenshots if generated, and failures with reproduction steps.
```

## Follow-Up Extraction Candidates

These are not mandatory for the first implementation pass unless touched:

- split `studio-copy.ts` by projects/workspace/canvas/timeline/media/export copy domains;
- split `TimelineProjectSidebar.tsx` into cards, footer actions, filter/search, folder navigation, and context menu components;
- split `useProjectMediaController.ts` into visible item derivation, selection state, folder counts, and actions;
- split `CanvasFloatingToolbar.tsx` into grouped tool buttons, block picker, canvas save menu, and toolbar shell;
- split `TimelineClipInspector.tsx` into asset, sequence, and timeline clip inspector modules.
