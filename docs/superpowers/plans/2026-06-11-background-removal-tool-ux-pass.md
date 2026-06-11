# Background Removal Tool UX Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/app/tools/background-removal` into a more premium, usable video background-removal workspace while preserving the current generation, billing, upload, library, download, and save behavior.

**Architecture:** Keep `BackgroundRemovalWorkspace.tsx` as the route-level orchestrator and keep tool-specific UI inside `frontend/src/components/tools/background-removal/_components/`. Add only presentation-focused helpers/components where they reduce duplicated markup. Do not move generation API calls, pricing logic, upload logic, or recent-job state out of their existing hooks.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS utilities, lucide-react icons, existing MaxVideoAI UI primitives.

**Design References:**
- Primary concept: `/Users/adrienmillot/.codex/generated_images/019eb5d8-b005-7bf3-9560-b0e69529d1d2/ig_050270c002c237d8016a2aef68f7988191af576750cac02f4e.png`
- Upload/ready concept: `/Users/adrienmillot/.codex/generated_images/019eb5d8-b005-7bf3-9560-b0e69529d1d2/ig_050270c002c237d8016a2af0230d7481919d0af3eeb7dac0c7.png`

---

### Task 1: Workspace Shell And Top Summary

**Files:**
- Modify: `frontend/src/components/tools/BackgroundRemovalWorkspace.tsx`

- [x] **Step 1: Replace the marketing-style hero with a compact tool header**

Implement a dense studio header with:
- Back link retained.
- Title and subtitle retained from copy.
- Three compact summary cards: source status, output format, price before generation.
- No supplier/provider names and no margin wording.

- [x] **Step 2: Rebalance the main grid**

Use a responsive workspace grid:
- Desktop: left rail around `410px`, right preview area flexible.
- Mobile/tablet: stacked panels.
- Sticky left rail retained only on wide screens.

- [x] **Step 3: Verify orchestration boundaries**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/background-removal-tool-contract.test.ts
```

Expected: all background-removal contract tests pass.

### Task 2: Source Panel UX

**Files:**
- Modify: `frontend/src/components/tools/background-removal/_components/BackgroundRemovalSourcePanel.tsx`

- [x] **Step 1: Make upload the primary action**

Turn the upload area into a dashed, media-editor style drop zone with:
- Upload icon.
- Existing upload copy.
- Accepted source hint.
- Auth disabled state preserved.

- [x] **Step 2: Keep URL and library as secondary inputs**

Keep the existing URL input and library picker behavior, but visually group them as secondary source options.

- [x] **Step 3: Improve metadata feedback**

Show metadata in a compact status strip:
- Ready metadata when available.
- Loading copy during metadata read.
- Required-source copy before a source exists.
- Error copy unchanged.

### Task 3: Settings And Price Panel

**Files:**
- Modify: `frontend/src/components/tools/background-removal/_components/BackgroundRemovalSettingsPanel.tsx`

- [x] **Step 1: Convert output selection to selectable format cards**

Render `BACKGROUND_REMOVAL_OUTPUT_CODECS` as buttons/cards instead of only a native select while preserving `onOutputCodecChange`.

- [x] **Step 2: Keep background and audio controls accessible**

Keep the native background select and preserve-audio checkbox, but restyle them with clearer labels and compact row treatment.

- [x] **Step 3: Make price-before-generation obvious**

Promote `priceLabel` and `priceHint` into a dedicated price block above the run button. The copy must explain that the estimate is visible before generation without naming internal costs.

### Task 4: Preview And Recent Results

**Files:**
- Modify: `frontend/src/components/tools/background-removal/_components/BackgroundRemovalPreviewCard.tsx`
- Modify: `frontend/src/components/tools/background-removal/_components/BackgroundRemovalRecentRail.tsx`

- [x] **Step 1: Add a premium empty preview state**

When no source URL exists, show an implementation-native before/after style placeholder with:
- Source side.
- Transparent/checkerboard side.
- No generated UI screenshot embedded as the app UI.

- [x] **Step 2: Improve result/source tabs**

Keep the two existing modes, but restyle them as a compact segmented control with disabled result state preserved.

- [x] **Step 3: Improve recent results cards**

Make recent cards denser and more useful:
- Thumbnail with duration-like visual treatment when available.
- Engine label and price retained.
- Download/copy/save icon controls retained.
- Empty state more intentional.

### Task 5: Verification

**Files:**
- Test: `tests/background-removal-tool-contract.test.ts`
- Test: `tests/background-removal-pricing.test.ts`

- [x] **Step 1: Run focused checks**

Run:

```bash
npm --prefix frontend run lint
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/background-removal-tool-contract.test.ts tests/background-removal-pricing.test.ts
git diff --check
```

Expected: all checks pass.

- [x] **Step 2: Render QA**

Verify `/app/tools/background-removal` at:
- Desktop `1440x1000`.
- Mobile around `390x844`.

Required checks:
- Page is not blank.
- No framework overlay.
- No horizontal overflow.
- Upload, URL, library, output format, background, audio, generate, source/result controls remain present.
- Price is visible before generation.
- Internal supplier and margin language is not visible.
