# Storyboard Workspace Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `StoryboardWorkspace.tsx` from 1,318 lines to at most 500 lines without changing Storyboard behavior, pricing, request payloads, copy, storage compatibility, or visual output.

**Architecture:** Keep `StoryboardWorkspace.tsx` as the visible workflow orchestrator for generation, save, recent-output selection, and generator handoff. Move only the controlled builder surface, reference-image lifecycle, server-authored price estimates, static configuration, and Kling first-frame persistence into focused colocated modules, with architecture contracts preventing those responsibilities from drifting back.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Node test runner through `tsx`, pnpm, ESLint, localStorage, existing MaxVideoAI image estimate and generation APIs.

## Global Constraints

- Work from local `main` in `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/kling-image-dimension-validation`; confirm it matches `origin/main` before editing.
- Preserve all user changes already present in the worktree.
- This is an architecture-only refactor. Do not change displayed prices, charged prices, price sources, request payloads, generation parameters, prompts, localization, routes, or styling.
- Do not add a local price formula or a fallback commercial price. Unavailable server estimates continue to render `...`.
- Keep `runStoryboard`, `saveSelectedImage`, `applySelectedImageToGenerator`, the current result/recent selection state, and the auth modal in `StoryboardWorkspace.tsx`.
- Preserve the storage key `maxvideoai.storyboard.klingFirstFrames.v1` and its stored JSON shape.
- Follow red-green-refactor for every ownership move: make the focused contract fail for the intended reason, make the smallest extraction, rerun the focused test, then commit.
- Use `apply_patch` for manual file edits. Do not regenerate or mechanically rewrite unrelated files.
- Keep each task independently testable and commit after its focused checks pass.

---

### Task 1: Refresh the live architecture-roadmap baseline

**Files:**
- Modify: `docs/engineering/refactor-roadmap.md`

- [ ] **Step 1: Confirm branch, cleanliness, and live audit output**

Run:

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
npm run architecture:audit -- --min-lines 500
```

Expected: branch is `main`; the two revisions match before implementation begins; the audit lists `StoryboardWorkspace.tsx` at 1,318 lines. If the worktree contains unrelated changes, preserve them and restrict every later commit to named files.

- [ ] **Step 2: Replace the obsolete snapshot with the 2026-07-14 evidence**

Update the roadmap to record the current audit candidates and classify them by risk and responsibility:

```text
model-page-template-copy-additional.ts     6278  content organization
ModelDecisionPromptingSection.tsx          3114  large marketing component
compare-model-overrides-en.ts              2840  localized content organization
compare-model-overrides-es.ts              2757  localized content organization
compare-model-overrides-fr.ts              2757  localized content organization
model-page-template-copy.ts                1887  content organization
ModelExamplesSection.tsx                   1589  large marketing component
StoryboardWorkspace.tsx                    1318  active balanced refactor
pricingHubData.ts                          1226  pricing-sensitive configuration
admin-transactions.ts                       793  next medium-risk server split
pricingHubCopy.ts                            737  localized pricing content
policy-service.ts                            735  server policy boundary
```

State explicitly that the audit command, not the dated table, is authoritative. Mark Storyboard as the active cleanup, `admin-transactions.ts` as the next medium-risk split, pricing/admin work as price-sensitive, and large locale/model copy files as content-organization work rather than immediate runtime refactors.

- [ ] **Step 3: Verify the documentation-only change**

Run:

```bash
git diff -- docs/engineering/refactor-roadmap.md
git diff --check
```

Expected: only the current audit snapshot and prioritization change; no generated file or runtime code changes.

- [ ] **Step 4: Commit the roadmap baseline**

```bash
git add docs/engineering/refactor-roadmap.md
git commit -m "docs: refresh architecture cleanup roadmap"
```

---

### Task 2: Extract immutable Storyboard workspace configuration

**Files:**
- Create: `frontend/src/components/tools/storyboard/_lib/storyboard-workspace-config.ts`
- Modify: `frontend/src/components/tools/StoryboardWorkspace.tsx`
- Test: `tests/storyboard-tool-contract.test.ts`

- [ ] **Step 1: Add the configuration path and ownership contract**

Add a path constant near the other Storyboard paths:

```ts
const storyboardWorkspaceConfigPath = join(
  root,
  'frontend/src/components/tools/storyboard/_lib/storyboard-workspace-config.ts'
);
```

In the dedicated workspace architecture test, read `configSource` and require:

```ts
assert.equal(existsSync(storyboardWorkspaceConfigPath), true, 'storyboard static config should stay colocated');
assert.match(workspaceSource, /storyboard-workspace-config/);
assert.match(configSource, /STORYBOARD_STYLE_OPTIONS/);
assert.match(configSource, /STORYBOARD_TARGET_OPTIONS/);
assert.match(configSource, /STORYBOARD_TARGET_LOGOS/);
assert.match(configSource, /STORYBOARD_REFERENCE_SLOT_COUNT\s*=\s*4/);
assert.match(configSource, /STORYBOARD_REFERENCE_FIELD/);
assert.match(configSource, /STORYBOARD_REFERENCE_ENGINE/);
assert.doesNotMatch(configSource, /useState|useEffect|authFetch|localStorage/);
assert.doesNotMatch(workspaceSource, /const STYLE_OPTIONS|const TARGET_OPTIONS/);
assert.doesNotMatch(workspaceSource, /const STORYBOARD_REFERENCE_FIELD|const STORYBOARD_REFERENCE_ENGINE/);
```

Change existing assertions that require these definitions inside `workspaceSource` so they instead check `configSource`.

- [ ] **Step 2: Run the contract and confirm the expected red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/storyboard-tool-contract.test.ts
```

Expected: failure because `storyboard-workspace-config.ts` does not exist yet. No pre-existing Storyboard behavior assertion should fail.

- [ ] **Step 3: Create the pure configuration owner**

Create exports with these exact public types:

```ts
export const STORYBOARD_STYLE_OPTIONS: StoryboardStyle[];
export const STORYBOARD_TARGET_OPTIONS: StoryboardTargetModel[];
export const STORYBOARD_TARGET_LOGOS: Record<StoryboardTargetModel, { src: string }>;
export const STORYBOARD_REFERENCE_SLOT_COUNT = 4;
export const STORYBOARD_REFERENCE_FIELD: EngineInputField;
export const STORYBOARD_REFERENCE_ENGINE: EngineCaps;
```

Move the current values byte-for-byte, including logo paths, engine ID, input limit, supported formats, update date, and TTL. Import `STORYBOARD_REFERENCE_SUPPORTED_FORMATS` from `storyboard-reference-library.ts` and types from the existing prompt and engine modules. Do not add React or browser imports.

- [ ] **Step 4: Replace local constants with named imports**

In `StoryboardWorkspace.tsx`, delete the moved declarations and import their new `STORYBOARD_*` names. Update the style and target `.map()` calls to use `STORYBOARD_STYLE_OPTIONS` and `STORYBOARD_TARGET_OPTIONS` without changing order.

- [ ] **Step 5: Verify and commit the config extraction**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/storyboard-tool-contract.test.ts
pnpm --dir frontend exec tsc --noEmit
git diff --check
```

Expected: all commands pass.

```bash
git add frontend/src/components/tools/StoryboardWorkspace.tsx \
  frontend/src/components/tools/storyboard/_lib/storyboard-workspace-config.ts \
  tests/storyboard-tool-contract.test.ts
git commit -m "refactor: extract storyboard workspace config"
```

---

### Task 3: Extract and unit-test Kling first-frame persistence

**Files:**
- Create: `frontend/src/components/tools/storyboard/_lib/storyboard-kling-first-frame-storage.ts`
- Create: `tests/storyboard-kling-first-frame-storage.test.ts`
- Modify: `frontend/src/components/tools/StoryboardWorkspace.tsx`
- Modify: `tests/storyboard-tool-contract.test.ts`

- [ ] **Step 1: Write failing storage unit tests**

Create a small in-memory `Storage` implementation in the test and cover these behaviors:

```ts
test('returns an empty map for malformed Kling first-frame storage', () => {
  const storage = createMemoryStorage({
    'maxvideoai.storyboard.klingFirstFrames.v1': '{broken',
  });
  assert.deepEqual(readStoredKlingFirstFrames(storage), {});
});

test('writes and reads a first frame by storyboard job and URL', () => {
  const storage = createMemoryStorage();
  writeStoredKlingFirstFrame(frame, storage);
  assert.deepEqual(getStoredKlingFirstFrame('storyboard-job', 'https://cdn/storyboard.png', storage), frame);
});

test('rejects a stored first frame when the storyboard URL differs', () => {
  const storage = createMemoryStorage();
  writeStoredKlingFirstFrame(frame, storage);
  assert.equal(getStoredKlingFirstFrame('storyboard-job', 'https://cdn/other.png', storage), null);
});

test('maps a recent output Kling frame to the persisted state shape', () => {
  assert.deepEqual(buildKlingFirstFrameFromRecentOutput(recentOutput), expectedFrame);
});
```

The memory object must implement `length`, `clear`, `getItem`, `key`, `removeItem`, and `setItem`, so tests exercise the DOM `Storage` contract rather than a custom map API.

- [ ] **Step 2: Add the architecture boundary and run red tests**

Add `storyboardKlingStoragePath`, require the file to exist, require `StoryboardWorkspace` to import it, and assert:

```ts
assert.match(klingStorageSource, /KLING_FIRST_FRAME_STORAGE_KEY/);
assert.match(klingStorageSource, /readStoredKlingFirstFrames/);
assert.match(klingStorageSource, /writeStoredKlingFirstFrame/);
assert.match(klingStorageSource, /getStoredKlingFirstFrame/);
assert.match(klingStorageSource, /buildKlingFirstFrameFromRecentOutput/);
assert.doesNotMatch(workspaceSource, /maxvideoai\.storyboard\.klingFirstFrames\.v1/);
assert.doesNotMatch(workspaceSource, /window\.localStorage|JSON\.parse/);
```

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/storyboard-kling-first-frame-storage.test.ts \
  tests/storyboard-tool-contract.test.ts
```

Expected: module-not-found or file-existence failures for the new storage owner.

- [ ] **Step 3: Implement the storage module with injectable storage**

Export:

```ts
export type StoryboardGeneratedImage = ImageGenerationResponse['images'][number];

export type KlingFirstFrameState = {
  storyboardJobId: string | null;
  storyboardUrl: string;
  image: StoryboardGeneratedImage;
  jobId: string | null;
};

export const KLING_FIRST_FRAME_STORAGE_KEY = 'maxvideoai.storyboard.klingFirstFrames.v1';

export function readStoredKlingFirstFrames(storage?: Storage | null): Record<string, KlingFirstFrameState>;
export function writeStoredKlingFirstFrame(frame: KlingFirstFrameState, storage?: Storage | null): void;
export function getStoredKlingFirstFrame(
  storyboardJobId: string | null,
  storyboardUrl: string,
  storage?: Storage | null
): KlingFirstFrameState | null;
export function buildKlingFirstFrameFromRecentOutput(output: StoryboardRecentOutput): KlingFirstFrameState | null;
```

Resolve omitted storage to `window.localStorage` only when `window` exists; treat explicit `null` as unavailable. Preserve the current defensive JSON parsing, job-keyed write, URL-match validation, image mapping, and `null` behavior. Use a type-only import for `StoryboardRecentOutput`; do not move or alter that public type in this batch.

- [ ] **Step 4: Integrate the helper without changing callers**

Delete the local storage key, types, and four helper functions from `StoryboardWorkspace.tsx`. Import `KlingFirstFrameState`, `buildKlingFirstFrameFromRecentOutput`, `getStoredKlingFirstFrame`, and `writeStoredKlingFirstFrame` from the new module. Keep the current selection precedence and call sites unchanged.

- [ ] **Step 5: Verify and commit the persistence extraction**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/storyboard-kling-first-frame-storage.test.ts \
  tests/storyboard-tool-contract.test.ts
pnpm --dir frontend exec tsc --noEmit
git diff --check
```

Expected: all commands pass, including malformed storage and mismatched URL cases.

```bash
git add frontend/src/components/tools/StoryboardWorkspace.tsx \
  frontend/src/components/tools/storyboard/_lib/storyboard-kling-first-frame-storage.ts \
  tests/storyboard-kling-first-frame-storage.test.ts \
  tests/storyboard-tool-contract.test.ts
git commit -m "refactor: extract storyboard first frame storage"
```

---

### Task 4: Move reference slots and library lifecycle into one hook

**Files:**
- Create: `frontend/src/components/tools/storyboard/_hooks/useStoryboardReferences.ts`
- Modify: `frontend/src/components/tools/StoryboardWorkspace.tsx`
- Test: `tests/storyboard-tool-contract.test.ts`

- [ ] **Step 1: Write the reference ownership contract**

Add `storyboardReferencesHookPath`, read the source, and assert:

```ts
assert.equal(existsSync(storyboardReferencesHookPath), true, 'storyboard references should have one hook owner');
assert.match(workspaceSource, /useStoryboardReferences/);
assert.match(referencesHookSource, /uploadStoryboardReferenceImage/);
assert.match(referencesHookSource, /cleanupStoryboardReferenceImage/);
assert.match(referencesHookSource, /createStoryboardReferenceImageFromLibraryAsset/);
assert.match(referencesHookSource, /resolveStoryboardReferenceLibrarySlotIndex/);
assert.match(referencesHookSource, /URL\.createObjectURL/);
assert.doesNotMatch(workspaceSource, /uploadStoryboardReferenceImage|cleanupStoryboardReferenceImage/);
assert.doesNotMatch(workspaceSource, /URL\.createObjectURL/);
assert.doesNotMatch(workspaceSource, /createStoryboardReferenceImageFromLibraryAsset/);
assert.doesNotMatch(workspaceSource, /resolveStoryboardReferenceLibrarySlotIndex/);
```

Keep the workspace assertions for rendering `StoryboardReferenceLibraryModal` because modal composition remains orchestration.

- [ ] **Step 2: Run the contract and confirm it fails on current ownership**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/storyboard-tool-contract.test.ts
```

Expected: failure because the hook is absent and upload/cleanup logic is still in the workspace.

- [ ] **Step 3: Define the hook API before moving logic**

Use this public contract:

```ts
export type UseStoryboardReferencesParams = {
  authenticated: boolean;
  copy: StoryboardCopy;
  onAuthRequired: () => void;
  onError: (message: string) => void;
  onFeedbackReset: () => void;
};

export function useStoryboardReferences(params: UseStoryboardReferencesParams): {
  referenceImages: (StoryboardReferenceImage | null)[];
  readyReferenceImages: StoryboardReferenceImage[];
  referenceUploading: boolean;
  storyboardReferenceField: EngineInputField;
  storyboardReferenceAssets: Record<string, (AssetSlotAttachment | null)[]>;
  libraryModal: StoryboardLibraryModalState;
  handleReferenceFile: (field: EngineInputField, file: File, slotIndex?: number) => Promise<void>;
  handleRemoveReferenceSlot: (field: EngineInputField, index: number) => void;
  openReferenceLibrary: (field: EngineInputField, slotIndex?: number) => void;
  closeReferenceLibrary: () => void;
  handleReferenceLibrarySelect: (asset: StoryboardLibraryAsset) => void;
};
```

The hook owns the four-slot initial state, latest-array ref, unmount cleanup effect, ready/uploading projections, localized field projection, AssetDropzone attachment projection, upload error states, replacement cleanup, modal state, and library selection. It calls `onAuthRequired` instead of opening the modal directly, and routes global feedback through `onError` and `onFeedbackReset`.

- [ ] **Step 4: Replace workspace reference implementation with the hook**

Call the hook once after copy/auth state is available. Pass `Boolean(user)`, `copy`, an auth-modal opener, `setError`, and a callback that clears both `error` and `message`. Remove the reference state, ref, cleanup effect, derived projections, local handlers, and their now-unused imports from the workspace.

Continue passing the returned `referenceImages` to prompt/generation logic and compose `StoryboardReferenceLibraryModal` with the returned modal and handlers. Do not change the `AssetDropzone` props or upload copy.

- [ ] **Step 5: Verify references and commit**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/storyboard-tool-contract.test.ts \
  tests/storyboard-template-reference.test.ts
pnpm --dir frontend exec tsc --noEmit
git diff --check
```

Expected: all commands pass; the workspace contains no reference upload or cleanup implementation.

```bash
git add frontend/src/components/tools/StoryboardWorkspace.tsx \
  frontend/src/components/tools/storyboard/_hooks/useStoryboardReferences.ts \
  tests/storyboard-tool-contract.test.ts
git commit -m "refactor: extract storyboard reference state"
```

---

### Task 5: Centralize server-authored Storyboard price estimates

**Files:**
- Create: `frontend/src/components/tools/storyboard/_hooks/useStoryboardPricing.ts`
- Modify: `frontend/src/components/tools/StoryboardWorkspace.tsx`
- Modify: `tests/storyboard-price-display.test.ts`
- Modify: `tests/storyboard-tool-contract.test.ts`

- [ ] **Step 1: Add a pure formatting test before moving it**

Extend `tests/storyboard-price-display.test.ts` to import `formatStoryboardPrice` from the future hook and assert:

```ts
assert.equal(formatStoryboardPrice(null, 'en-US'), '...');
assert.equal(formatStoryboardPrice({ cents: 1234, currency: 'USD' }, 'en-US'), '$12.34');
assert.equal(formatStoryboardPrice({ cents: 1234, currency: 'EUR' }, 'fr-FR'), '12,34 €');
```

Use the actual non-breaking-space output produced by Node's `Intl.NumberFormat` in the repository runtime. Also cover an invalid currency code by asserting the existing fallback string format rather than throwing.

- [ ] **Step 2: Add pricing ownership assertions**

Add `storyboardPricingHookPath`, require/read it, then assert:

```ts
assert.match(workspaceSource, /useStoryboardPricing/);
assert.match(pricingHookSource, /authFetch\('\/api\/images\/estimate'/);
assert.match(pricingHookSource, /STORYBOARD_SOURCE/);
assert.match(pricingHookSource, /STORYBOARD_EDIT_SOURCE/);
assert.match(pricingHookSource, /resolveStoryboardVisiblePrice/);
assert.match(pricingHookSource, /getStoryboardOutputConfig/);
assert.match(pricingHookSource, /getStoryboardEditOutputConfig/);
assert.doesNotMatch(workspaceSource, /authFetch\('\/api\/images\/estimate'/);
assert.doesNotMatch(workspaceSource, /const \[tierPrices|const \[editPrice/);
assert.doesNotMatch(pricingHookSource, /pricePer|fallbackPrice|hardcodedPrice/);
```

Retain workspace assertions for `STORYBOARD_SOURCE` and `STORYBOARD_EDIT_SOURCE` only where generation payloads still require those sources; remove assertions that tie estimate functions or price state to the workspace.

- [ ] **Step 3: Run focused tests and confirm the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/storyboard-price-display.test.ts \
  tests/storyboard-tool-contract.test.ts
```

Expected: import/file-existence failures for the pricing hook; existing visible-price arithmetic tests still pass.

- [ ] **Step 4: Implement the pricing hook contract**

Export these types and return values:

```ts
export type StoryboardPriceValue = { cents: number; currency: string } | null;
export type StoryboardPriceState = Record<StoryboardTier, StoryboardPriceValue>;

export type UseStoryboardPricingParams = {
  locale: string;
  storyboardOrientation: StoryboardOrientation;
  storyboardTier: StoryboardTier;
  targetModel: StoryboardTargetModel;
  selectedImage: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
};

export function formatStoryboardPrice(value: StoryboardPriceValue, locale: string): string;

export function useStoryboardPricing(params: UseStoryboardPricingParams): {
  tierConfig: StoryboardOutputConfig;
  editOutputConfig: StoryboardOutputConfig;
  klingFirstFramePrice: StoryboardPriceValue;
  activePrice: string;
  editPriceLabel: string;
  tierPriceLabels: Record<StoryboardTier, string>;
};
```

Move both current estimate effects without changing their payloads, source values, resolution/quality selection, cancellation guards, null handling, or error behavior. Build each tier label by formatting `resolveStoryboardVisiblePrice({ targetModel, tierPrice, klingFirstFramePrice })`. Keep `tierConfig` and `editOutputConfig` returned because generation remains in the workspace.

- [ ] **Step 5: Integrate returned pricing values**

Replace local price state/effects and `formatPrice` with the hook. Pass the returned `tierPriceLabels` to the future builder boundary and temporarily use it in the current tier JSX. Keep generation payload construction unchanged and continue passing `editPriceLabel` to `StoryboardResultPanel`.

- [ ] **Step 6: Verify pricing and commit**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/storyboard-price-display.test.ts \
  tests/storyboard-tool-contract.test.ts \
  tests/gpt-image-2-pricing.test.ts \
  tests/image-generation-server-architecture.test.ts
pnpm --dir frontend exec tsc --noEmit
git diff --check
```

Expected: all commands pass and price estimate payload/source assertions remain unchanged.

```bash
git add frontend/src/components/tools/StoryboardWorkspace.tsx \
  frontend/src/components/tools/storyboard/_hooks/useStoryboardPricing.ts \
  tests/storyboard-price-display.test.ts \
  tests/storyboard-tool-contract.test.ts
git commit -m "refactor: extract storyboard pricing estimates"
```

---

### Task 6: Extract the complete controlled builder panel

**Files:**
- Create: `frontend/src/components/tools/storyboard/_components/StoryboardBuilderPanel.tsx`
- Modify: `frontend/src/components/tools/StoryboardWorkspace.tsx`
- Test: `tests/storyboard-tool-contract.test.ts`

- [ ] **Step 1: Lock the final component boundary and line cap**

Add `storyboardBuilderPanelPath`, read it, and replace obsolete builder ownership assertions with:

```ts
const workspaceLineCount = workspaceSource.trimEnd().split(/\r?\n/).length;

assert.equal(existsSync(storyboardBuilderPanelPath), true, 'storyboard builder should have a focused component');
assert.ok(workspaceLineCount <= 500, `StoryboardWorkspace.tsx should stay at or below 500 lines, received ${workspaceLineCount}`);
assert.match(workspaceSource, /StoryboardBuilderPanel/);
assert.match(builderPanelSource, /AssetDropzone/);
assert.match(builderPanelSource, /BuilderStep/);
assert.match(builderPanelSource, /OptionalPromptButton/);
assert.match(builderPanelSource, /ChoiceButton/);
assert.match(builderPanelSource, /LengthPresetButton/);
assert.match(builderPanelSource, /TierButton/);
assert.match(builderPanelSource, /StoryboardTargetLogo/);
assert.match(builderPanelSource, /StyleIcon/);
assert.doesNotMatch(builderPanelSource, /authFetch|runImageGeneration|saveImageToLibrary/);
assert.doesNotMatch(builderPanelSource, /useState|useEffect|localStorage|sessionStorage/);
assert.doesNotMatch(workspaceSource, /function BuilderStep|function ChoiceButton|function TierButton/);
```

Keep positive workspace assertions for `runImageGeneration`, `runStoryboard`, `saveImageToLibrary`, `saveSelectedImage`, handoff construction, route navigation, recent output selection, and `StoryboardResultPanel`.

- [ ] **Step 2: Run the contract and confirm both intended failures**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/storyboard-tool-contract.test.ts
```

Expected: failure because the panel does not exist and the workspace still exceeds 500 lines.

- [ ] **Step 3: Define the controlled builder props**

Export the optional-field type and component with grouped props:

```ts
export type StoryboardOptionalField = 'action' | 'dialogue' | 'visualNotes';

export type StoryboardBuilderPanelProps = {
  copy: StoryboardCopy;
  prompt: {
    subject: string;
    action: string;
    dialogue: string;
    visualNotes: string;
    activeOptionalField: StoryboardOptionalField | null;
    onSubjectChange: (value: string) => void;
    onActionChange: (value: string) => void;
    onDialogueChange: (value: string) => void;
    onVisualNotesChange: (value: string) => void;
    onOptionalFieldToggle: (field: StoryboardOptionalField) => void;
  };
  references: {
    field: EngineInputField;
    engine: EngineCaps;
    assets: Record<string, (AssetSlotAttachment | null)[]>;
    onFile: (field: EngineInputField, file: File, slotIndex?: number) => void | Promise<void>;
    onRemove: (field: EngineInputField, index: number) => void;
    onOpenLibrary: (field: EngineInputField, slotIndex?: number) => void;
  };
  target: {
    targetModel: StoryboardTargetModel;
    recognizablePeople: boolean;
    style: StoryboardStyle;
    onTargetChange: (target: StoryboardTargetModel) => void;
    onRecognizablePeopleToggle: () => void;
    onStyleChange: (style: StoryboardStyle) => void;
  };
  output: {
    storyboardOrientation: StoryboardOrientation;
    lengthPresetId: StoryboardLengthPresetId;
    storyboardTier: StoryboardTier;
    tierPriceLabels: Record<StoryboardTier, string>;
    onOrientationSelect: (orientation: StoryboardOrientation) => void;
    onLengthPresetSelect: (presetId: StoryboardLengthPresetId) => void;
    onTierChange: (tier: StoryboardTier) => void;
  };
  submission: {
    activePrice: string;
    canRun: boolean;
    running: boolean;
    error: string | null;
    message: string | null;
    onGenerate: () => void;
  };
};
```

The panel owns the existing builder `<section>` and the local UI helpers `BuilderStep`, `BuilderGroup`, `OptionalPromptButton`, `ChoiceButton`, `LengthPresetButton`, `TierButton`, `StoryboardTargetLogo`, `StyleIcon`, `getLengthPresetLabel`, `getLengthPresetMeta`, and `getTierLabel`. Move JSX and class strings without rewriting them.

- [ ] **Step 4: Compose the panel from the orchestrator**

Import `StoryboardBuilderPanel` and `StoryboardOptionalField`. Replace the existing builder section with one component call using the grouped props above. Keep form state and these behavior-bearing handlers in the workspace:

- optional-field toggling;
- recognizable-people toggling and automatic Kling selection;
- orientation and length selection, including template preview reset;
- `runStoryboard(false)` invocation.

Pass `STORYBOARD_REFERENCE_ENGINE` from the config module, the hook-owned reference field/assets/handlers, and hook-owned price labels. Do not move shot-plan derivation or result-panel composition into the builder.

- [ ] **Step 5: Remove dead imports and check the size target**

Run:

```bash
wc -l frontend/src/components/tools/StoryboardWorkspace.tsx
rg "BuilderStep|OptionalPromptButton|ChoiceButton|LengthPresetButton|TierButton|StoryboardTargetLogo|StyleIcon" \
  frontend/src/components/tools/StoryboardWorkspace.tsx
```

Expected: at most 500 lines and no local builder primitive definitions. Imports such as `ReactNode`, builder-only Lucide icons, `AssetDropzone`, and `isStoryboardTargetRecommended` should have moved to the panel if they are no longer used by the workspace.

- [ ] **Step 6: Verify and commit the builder extraction**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/storyboard-tool-contract.test.ts \
  tests/storyboard-template-reference.test.ts \
  tests/storyboard-generator-handoff.test.ts
pnpm --dir frontend exec tsc --noEmit
pnpm --dir frontend run lint
git diff --check
```

Expected: all commands pass; the workspace is at most 500 lines and still visibly owns generation, save, and handoff.

```bash
git add frontend/src/components/tools/StoryboardWorkspace.tsx \
  frontend/src/components/tools/storyboard/_components/StoryboardBuilderPanel.tsx \
  tests/storyboard-tool-contract.test.ts
git commit -m "refactor: extract storyboard builder panel"
```

---

### Task 7: Close the roadmap item and audit the resulting boundaries

**Files:**
- Modify: `docs/engineering/refactor-roadmap.md`
- Inspect: `frontend/src/components/tools/StoryboardWorkspace.tsx`
- Inspect: `frontend/src/components/tools/storyboard/_components/StoryboardBuilderPanel.tsx`
- Inspect: `frontend/src/components/tools/storyboard/_hooks/useStoryboardReferences.ts`
- Inspect: `frontend/src/components/tools/storyboard/_hooks/useStoryboardPricing.ts`
- Inspect: `frontend/src/components/tools/storyboard/_lib/storyboard-workspace-config.ts`
- Inspect: `frontend/src/components/tools/storyboard/_lib/storyboard-kling-first-frame-storage.ts`

- [ ] **Step 1: Run the live audit after extraction**

```bash
npm run architecture:audit -- --min-lines 500
wc -l frontend/src/components/tools/StoryboardWorkspace.tsx
```

Expected: `StoryboardWorkspace.tsx` is absent from the `>500` candidate list and `wc -l` reports no more than 500.

- [ ] **Step 2: Mark Storyboard as recently completed**

Update only the roadmap status section:

- move Storyboard from active cleanup to recently completed;
- record its final line count;
- list the five new responsibility owners;
- keep `admin-transactions.ts` as the next medium-risk candidate;
- preserve the warning that pricing work requires price acceptance tests and must not change live prices incidentally.

- [ ] **Step 3: Review the complete architecture diff**

Run:

```bash
IMPLEMENTATION_BASE="$(git merge-base origin/main HEAD)"
git diff "$IMPLEMENTATION_BASE" --stat
git diff "$IMPLEMENTATION_BASE" -- frontend/src/components/tools/StoryboardWorkspace.tsx
git diff --check
```

Expected: the workspace loses implementation responsibilities but retains workflow orchestration; no unrelated feature or generated content changes.

- [ ] **Step 4: Commit the completed roadmap record**

```bash
git add docs/engineering/refactor-roadmap.md
git commit -m "docs: record storyboard workspace cleanup"
```

---

### Task 8: Perform full verification, browser smoke test, and publish `main`

**Files:**
- Verify all files changed in Tasks 1–7

- [ ] **Step 1: Run focused Storyboard verification**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/storyboard-kling-first-frame-storage.test.ts \
  tests/storyboard-price-display.test.ts \
  tests/storyboard-tool-contract.test.ts \
  tests/storyboard-template-reference.test.ts \
  tests/storyboard-generator-handoff.test.ts \
  tests/gpt-image-2-pricing.test.ts \
  tests/image-generation-server-architecture.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run repository validation and static checks**

```bash
pnpm run test:validate
pnpm --dir frontend exec tsc --noEmit
pnpm --dir frontend run lint
pnpm run lint:exposure
git diff --check
npm run architecture:audit -- --min-lines 500
```

Expected: every command passes and Storyboard is no longer a large-file candidate.

- [ ] **Step 3: Run the production build**

```bash
pnpm --dir frontend run build
```

Expected: successful Next.js production build with no Storyboard type, client/server boundary, or route error.

- [ ] **Step 4: Smoke-test the Storyboard route locally**

Start the existing frontend development server, then verify `/app/tools/storyboard` in Chrome or the repository browser tooling:

1. route loads without console/runtime error;
2. auth-disabled or signed-out state matches the current environment;
3. subject and optional fields remain controlled;
4. target, recognizable-people, style, orientation, duration, and tier controls update as before;
5. tier and active price labels render from server estimates or `...` when unavailable;
6. reference file/library controls open and update slots where credentials permit;
7. result panel, recent rail, edit control, save action, download action, and generator handoff remain present;
8. landscape/portrait and duration changes keep the same template-preview behavior.

Do not perform a paid generation merely to complete the smoke test. If authenticated API execution is unavailable locally, record that limitation and rely on focused contracts plus GitHub Quality CI for the external path.

- [ ] **Step 5: Inspect final Git state and push `main`**

```bash
git status --short --branch
git log --oneline --decorate -8
git push origin main
```

Expected: clean `main`, successful push, and `origin/main` points to the final documentation commit.

- [ ] **Step 6: Monitor GitHub Quality CI**

Use the repository's GitHub workflow tooling to watch the workflows triggered by the push. If any workflow fails, inspect the failing job, reproduce it locally, apply the smallest in-scope correction with a focused regression test, rerun verification, commit, push, and monitor again until all required workflows are green.

Final completion evidence must include:

- final `StoryboardWorkspace.tsx` line count;
- focused test result;
- full validation, TypeScript, lint, exposure, and build results;
- browser smoke coverage and any credential-bound limitation;
- final commit SHA on `main`;
- successful push and green required CI workflows;
- explicit confirmation that no displayed or charged prices were changed.
