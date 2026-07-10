# Workspace Control Compaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Generate Video and Generate Image workspaces denser and easier to scan while preserving the current visual language, routes, localization, model behavior, pricing, and generation flows.

**Architecture:** Keep the workspace route components as orchestrators and implement the changes through existing opt-in density props. Shared presentation logic stays in `EngineSelect`, the settings bars, `Composer`, the preview docks, and `AssetDropzone`; a small pure helper owns responsive asset-grid selection so `Composer.tsx` does not absorb more layout policy.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Node test runner through `tsx --test`, ESLint, existing workspace contract tests.

## Global Constraints

- Apply the new layout only to workspace-density surfaces used by Generate Video and Generate Image.
- Preserve all public URLs, route behavior, SEO metadata, canonical/hreflang output, and sitemap assumptions.
- Preserve locale-driven copy and behavior for every supported locale; do not hard-code English UI copy.
- Preserve engine/model selection, variant availability rules, generation submission, wallet preflight, pricing computation, uploads, and downloads.
- Remove only the workspace “Browse engines” link; keep the non-workspace browse modal and browse entry points intact.
- Keep `Choose engine` and `Variant` on one non-wrapping row, including 320 px mobile widths.
- Show at least seven complete prompt lines without scrolling on both Generate Video and Generate Image.
- Show the generation price once, inside the Generate button.
- Keep media controls aligned to the actual rendered media width for landscape, square, and portrait results.
- Use responsive upload grids with 4, 3, 2, then 1 columns as space decreases; Seedance’s three inputs must share one equal three-column row when space permits.
- Do not add dependencies or replace the existing design system.
- Keep architectural line ceilings and route/component ownership contracts green.

---

### Task 1: Align workspace engine and variant controls

**Files:**
- Modify: `tests/engine-select-architecture.test.ts`
- Modify: `frontend/src/components/ui/EngineSelect.tsx`
- Modify: `frontend/src/components/ui/engine-select/EngineVariantControl.tsx`

**Interfaces:**
- Consumes: existing `presentation="workspace"`, `isCompact`, `variantControl`, and `SelectMenu.hideChevron` APIs.
- Produces: a single non-wrapping workspace row containing the engine and variant triggers; non-workspace browse behavior remains unchanged.

- [ ] **Step 1: Replace the obsolete workspace Browse contract with the new row contract**

In `tests/engine-select-architecture.test.ts`, replace the test that expects an independent workspace Browse target with assertions equivalent to:

```ts
test('workspace engine and variant controls stay together without a Browse row', () => {
  assert.match(engineSelectSource, /presentation === 'workspace'/)
  assert.match(engineSelectSource, /flex-nowrap items-end gap-3/)
  assert.match(engineSelectSource, /<div className="min-w-0 flex-1">/)
  assert.doesNotMatch(
    engineSelectSource.match(/if \(presentation === 'workspace'\)[\s\S]*?return \(/)?.[0] ?? '',
    /copy\.browseCompact|ExternalLink/,
  )
  assert.match(engineSelectSource, /copy\.browse/)
  assert.match(engineSelectSource, /BrowseEnginesModal/)
})

test('workspace variant trigger is compact and does not spend width on a chevron', () => {
  assert.match(variantControlSource, /w-\[104px\].*sm:w-\[124px\]/s)
  assert.match(variantControlSource, /h-\[42px\]/)
  assert.match(variantControlSource, /hideChevron/)
})
```

- [ ] **Step 2: Run the focused contract and confirm it fails for the old Browse row**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/engine-select-architecture.test.ts
```

Expected: FAIL because the workspace branch still renders `copy.browseCompact`/`ExternalLink`, uses `gap-2`, and the variant trigger does not pass `hideChevron`.

- [ ] **Step 3: Render one compact, non-wrapping workspace row**

In the workspace branch of `frontend/src/components/ui/EngineSelect.tsx`, remove the Browse button entirely and use this structure:

```tsx
return (
  <div className="flex min-w-0 flex-nowrap items-end gap-3">
    <div className="min-w-0 flex-1">
      <label className={labelClassName}>{copy.choose}</label>
      {engineTrigger}
    </div>
    {variantControl}
  </div>
)
```

Do not remove `ExternalLink`, `BrowseEnginesModal`, `copy.browse`, or the `onBrowse` path used by the non-workspace branch.

- [ ] **Step 4: Match the variant trigger to the engine trigger height and compact width**

In `frontend/src/components/ui/engine-select/EngineVariantControl.tsx`, set the workspace wrapper and trigger to:

```tsx
<div className="w-[104px] shrink-0 space-y-1 sm:w-[124px]">
  {/* existing label */}
  <SelectMenu
    {...existingProps}
    hideChevron
    buttonClassName="!min-w-0 min-h-0 h-[42px] w-full rounded-xl px-3"
  />
</div>
```

Retain the existing disabled state and disabled-reason behavior.

- [ ] **Step 5: Run the focused contracts and line-ceiling check**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/engine-select-architecture.test.ts tests/workspace-first-viewport-contract.test.ts
```

Expected: PASS. If the viewport contract still asserts the old Browse row, update only those obsolete assertions to require the new one-row structure and absence of `browseCompact` in the workspace branch.

- [ ] **Step 6: Commit the engine-control change**

```bash
git add tests/engine-select-architecture.test.ts tests/workspace-first-viewport-contract.test.ts frontend/src/components/ui/EngineSelect.tsx frontend/src/components/ui/engine-select/EngineVariantControl.tsx
git commit -m "feat: align workspace engine controls"
```

---

### Task 2: Center preview actions on the rendered media

**Files:**
- Modify: `tests/composite-preview-dock-architecture.test.ts`
- Modify: `tests/image-composite-preview-dock.test.ts`
- Modify: `frontend/components/groups/CompositePreviewDock.tsx`
- Modify: `frontend/components/groups/ImageCompositePreviewDock.tsx`

**Interfaces:**
- Consumes: existing preview-stage dimensions, `ResizeObserver`, `previewRef`, and toolbar controls.
- Produces: media and toolbar wrappers with the same measured width, centered inside the preview dock.

- [ ] **Step 1: Add failing video and image alignment contracts**

Add source-contract assertions:

```ts
test('video toolbar is centered at the measured preview width', () => {
  assert.match(source, /ref=\{toolbarRef\}/)
  assert.match(source, /mx-auto flex w-full/)
  assert.match(source, /toolbar\.style\.width = widthPx/)
})
```

and in `tests/image-composite-preview-dock.test.ts`:

```ts
test('image toolbar tracks and centers on the rendered image stage', () => {
  assert.match(source, /const previewRef = useRef<HTMLDivElement \| null>\(null\)/)
  assert.match(source, /const toolbarRef = useRef<HTMLDivElement \| null>\(null\)/)
  assert.match(source, /new ResizeObserver/)
  assert.match(source, /toolbar\.style\.width = `\$\{width\}px`/)
  assert.match(source, /mx-auto flex w-full/)
})
```

- [ ] **Step 2: Run the two contracts and confirm the current image dock fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/composite-preview-dock-architecture.test.ts tests/image-composite-preview-dock.test.ts
```

Expected: FAIL because the video toolbar is left-positioned within its wider parent and the image toolbar has no measured-width coupling.

- [ ] **Step 3: Center the measured video toolbar**

In `frontend/components/groups/CompositePreviewDock.tsx`, retain the existing width calculation and `toolbar.style.width = widthPx`, but make the toolbar itself centered:

```tsx
<div className="flex w-full max-w-[960px] justify-center">
  <div ref={toolbarRef} className="mx-auto flex w-full items-center justify-center">
    {toolbarContents}
  </div>
</div>
```

Preserve the existing toolbar background, borders, spacing, controls, and permission logic while adding only the centering classes.

- [ ] **Step 4: Couple the image toolbar to the actual image-stage width**

In `frontend/components/groups/ImageCompositePreviewDock.tsx`:

```tsx
const previewRef = useRef<HTMLDivElement | null>(null)
const toolbarRef = useRef<HTMLDivElement | null>(null)

useEffect(() => {
  const preview = previewRef.current
  const toolbar = toolbarRef.current
  if (!preview || !toolbar) return

  const syncToolbarWidth = () => {
    const width = preview.getBoundingClientRect().width
    toolbar.style.width = `${width}px`
  }

  syncToolbarWidth()
  const observer = new ResizeObserver(syncToolbarWidth)
  observer.observe(preview)
  return () => observer.disconnect()
}, [activeAsset?.id, aspectRatio])
```

Attach `ref={previewRef}` to the element whose width is the rendered media stage, and use:

```tsx
<div className="flex w-full justify-center">
  <div ref={toolbarRef} className="mx-auto flex w-full items-center justify-center">
    {toolbarContents}
  </div>
</div>
```

Do not change `object-contain`, the computed aspect ratio, modal behavior, download authorization, or result navigation.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/composite-preview-dock-architecture.test.ts tests/image-composite-preview-dock.test.ts tests/workspace-preview-dock-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the preview alignment change**

```bash
git add tests/composite-preview-dock-architecture.test.ts tests/image-composite-preview-dock.test.ts frontend/components/groups/CompositePreviewDock.tsx frontend/components/groups/ImageCompositePreviewDock.tsx
git commit -m "fix: center preview tools on media"
```

---

### Task 3: Give the prompt seven lines and rebalance Generate

**Files:**
- Modify: `tests/composer-architecture.test.ts`
- Modify: `tests/workspace-first-viewport-contract.test.ts`
- Modify: `frontend/components/Composer.tsx`

**Interfaces:**
- Consumes: `density="workspace"`, `compactPrompt`, the existing price display, and the existing submission/loading/disabled states.
- Produces: a workspace prompt with `rows={7}` and a minimum height of `164px`; a narrower workspace Generate button whose price remains inside the button.

- [ ] **Step 1: Change the composer contracts first**

Add or update assertions to require:

```ts
assert.match(composerSource, /workspaceDensity \? 7 : compactPrompt \? 2 : 6/)
assert.match(composerSource, /min-h-\[164px\]/)
assert.doesNotMatch(composerSource, /sm:h-10 sm:min-h-0/)
assert.match(composerSource, /lg:min-w-\[176px\]/)
assert.match(composerSource, /gap-3.*px-4/s)
assert.equal((workspaceGenerateBlock.match(/formattedPrice/g) ?? []).length, 1)
```

The price assertion must target the workspace Generate JSX block so unrelated price computation does not cause a false failure.

- [ ] **Step 2: Run the contracts and verify they fail on the five-line prompt and 200 px CTA**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/composer-architecture.test.ts tests/workspace-first-viewport-contract.test.ts
```

Expected: FAIL on the current `rows={5}`, `min-h-[88px]`, desktop height reset, and `lg:min-w-[200px]` classes.

- [ ] **Step 3: Implement the workspace prompt sizing**

In `frontend/components/Composer.tsx`, make workspace density take precedence over `compactPrompt`:

```tsx
rows={workspaceDensity ? 7 : compactPrompt ? 2 : 6}
className={clsx(
  existingPromptClasses,
  workspaceDensity
    ? 'min-h-[164px] resize-y px-4 py-3 leading-5'
    : compactPrompt
      ? 'h-10 sm:h-12'
      : 'min-h-[180px]',
)}
```

Keep the prompt counter, multi-prompt/story action, localization, maximum length, focus behavior, and controlled value unchanged.

- [ ] **Step 4: Reduce workspace Generate without weakening hierarchy**

For the workspace branch only, use:

```tsx
'h-10 gap-3 rounded-[20px] px-4 py-0 lg:w-auto lg:min-w-[176px]'
```

and reduce the price chip from `px-3.5` to `px-3`. Keep the button full-width only where the existing mobile layout requires it, preserve loading/disabled states, and do not add a second price label beside it.

- [ ] **Step 5: Run the composer and workspace contracts**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/composer-architecture.test.ts tests/workspace-first-viewport-contract.test.ts
```

Expected: PASS and the existing `Composer.tsx` line-ceiling assertion remains green.

- [ ] **Step 6: Commit the composer proportion change**

```bash
git add tests/composer-architecture.test.ts tests/workspace-first-viewport-contract.test.ts frontend/components/Composer.tsx
git commit -m "style: refine workspace composer proportions"
```

---

### Task 4: Compact settings and normalize resolution labels

**Files:**
- Create: `tests/resolution-labels.test.ts`
- Modify: `tests/workspace-first-viewport-contract.test.ts`
- Modify: `frontend/src/lib/resolution-labels.ts`
- Modify: `frontend/components/CoreSettingsBar.tsx`
- Modify: `frontend/components/ImageSettingsBar.tsx`

**Interfaces:**
- Consumes: `SelectMenu.hideChevron`, existing settings option values, and locale-specific labels for non-resolution options.
- Produces: `formatCompactResolutionLabel(resolution: string): string`; compact workspace controls with hidden chevrons and unchanged option values.

- [ ] **Step 1: Add a failing pure-label test**

Create `tests/resolution-labels.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { formatCompactResolutionLabel } from '../frontend/src/lib/resolution-labels'

test('compact resolution labels remove redundant quality descriptions', () => {
  assert.equal(formatCompactResolutionLabel('720p · HD'), '720p')
  assert.equal(formatCompactResolutionLabel('1080p · Full HD'), '1080p')
  assert.equal(formatCompactResolutionLabel('4k · Ultra HD'), '4K')
  assert.equal(formatCompactResolutionLabel('4K'), '4K')
  assert.equal(formatCompactResolutionLabel('2K'), '2K')
  assert.equal(formatCompactResolutionLabel('Auto'), 'Auto')
})
```

- [ ] **Step 2: Add failing workspace settings contracts**

In `tests/workspace-first-viewport-contract.test.ts`, require both settings bars to pass `hideChevron={compact}`, use compact trigger classes, and call the compact label helper for resolution values:

```ts
assert.match(coreSettingsSource, /hideChevron=\{compact\}/)
assert.match(imageSettingsSource, /hideChevron=\{compact\}/)
assert.match(coreSettingsSource, /min-w-\[96px\].*h-9.*px-2/s)
assert.match(imageSettingsSource, /min-w-\[96px\].*h-9.*px-2/s)
assert.match(coreSettingsSource, /formatCompactResolutionLabel/)
assert.match(imageSettingsSource, /formatCompactResolutionLabel/)
```

- [ ] **Step 3: Run the new tests and confirm the helper is missing**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/resolution-labels.test.ts tests/workspace-first-viewport-contract.test.ts
```

Expected: FAIL because `formatCompactResolutionLabel` is not exported and compact settings still show chevrons and use 112 px minimum widths.

- [ ] **Step 4: Implement the pure compact resolution formatter**

Add to `frontend/src/lib/resolution-labels.ts`:

```ts
export function formatCompactResolutionLabel(resolution: string): string {
  const normalized = resolution.trim().toLowerCase()
  if (normalized.startsWith('720p')) return '720p'
  if (normalized.startsWith('1080p')) return '1080p'
  if (normalized.startsWith('4k')) return '4K'
  return resolution.trim()
}
```

Do not change existing `formatResolutionLabel`, `formatResolutionList`, or option values sent to the generation APIs.

- [ ] **Step 5: Apply compact presentation to both settings bars**

In both `CoreSettingsBar.tsx` and `ImageSettingsBar.tsx`:

```tsx
<SelectMenu
  {...existingProps}
  hideChevron={compact}
  buttonClassName={clsx(
    compact
      ? 'h-9 min-w-[96px] gap-1.5 rounded-xl px-2'
      : existingRegularClasses,
  )}
/>
```

For resolution option labels in workspace density only:

```ts
const label = compact && field.kind === 'resolution'
  ? formatCompactResolutionLabel(option.label)
  : option.label
```

Omit decorative leading icons for compact resolution, output-count/iterations, and format controls; retain icons where they distinguish semantic modes such as aspect ratio, camera/motion, or quality tier. Keep all original option values, disabled rules, tooltips, portals, and keyboard behavior.

- [ ] **Step 6: Tighten only the workspace settings-row gaps**

Change workspace gaps from `gap-2` to `gap-1.5` in the horizontal settings rows. Keep the existing horizontal overflow containment on very narrow screens; do not permit controls or Generate to wrap onto a second row.

- [ ] **Step 7: Run all settings and label contracts**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/resolution-labels.test.ts tests/workspace-first-viewport-contract.test.ts tests/settings-architecture.test.ts
```

If `tests/settings-architecture.test.ts` does not exist, run the first two files plus every test returned by:

```bash
rg -l "CoreSettingsBar|ImageSettingsBar" tests --glob '*.test.ts'
```

Expected: PASS; non-workspace label and chevron behavior remains covered and unchanged.

- [ ] **Step 8: Commit the settings compaction**

```bash
git add tests/resolution-labels.test.ts tests/workspace-first-viewport-contract.test.ts frontend/src/lib/resolution-labels.ts frontend/components/CoreSettingsBar.tsx frontend/components/ImageSettingsBar.tsx
git commit -m "style: compact workspace settings"
```

---

### Task 5: Harmonize upload cards and Seedance’s three-input row

**Files:**
- Create: `frontend/components/composer/composer-layout.ts`
- Create: `tests/composer-layout.test.ts`
- Modify: `tests/workspace-first-viewport-contract.test.ts`
- Modify: `frontend/components/Composer.tsx`
- Modify: `frontend/components/AssetDropzone.tsx`
- Modify: `frontend/components/asset-dropzone/AssetDropzoneSlot.tsx`

**Interfaces:**
- Produces: `getWorkspaceAssetGridClass(fieldCount: number): string`.
- Consumes: `assetFields.length`, `workspaceDensity`, existing `AssetDropzone` field descriptors, and existing upload/validation behavior.

- [ ] **Step 1: Add a failing pure grid-policy test**

Create `tests/composer-layout.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { getWorkspaceAssetGridClass } from '../frontend/components/composer/composer-layout'

test('workspace asset grids scale from one to four columns', () => {
  assert.equal(getWorkspaceAssetGridClass(1), 'grid grid-cols-1 gap-3')
  assert.equal(
    getWorkspaceAssetGridClass(2),
    'grid grid-cols-1 gap-3 md:grid-cols-2',
  )
  assert.equal(
    getWorkspaceAssetGridClass(3),
    'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3',
  )
  assert.equal(
    getWorkspaceAssetGridClass(4),
    'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  )
  assert.equal(
    getWorkspaceAssetGridClass(6),
    'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  )
})
```

- [ ] **Step 2: Add failing component contracts for equal cards and no forced span**

In `tests/workspace-first-viewport-contract.test.ts`, require:

```ts
assert.match(composerSource, /getWorkspaceAssetGridClass\(assetFields\.length\)/)
assert.match(composerSource, /!workspaceDensity && field\.maxCount > 1/)
assert.match(assetDropzoneSource, /workspaceDensity && 'h-full min-h-\[150px\]'/)
assert.match(assetDropzoneSlotSource, /workspaceDensity \? 'min-h-\[96px\] h-full'/)
```

- [ ] **Step 3: Run the grid tests and confirm they fail before implementation**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/composer-layout.test.ts tests/workspace-first-viewport-contract.test.ts
```

Expected: FAIL because the pure helper does not exist and workspace collection fields still force `md:col-span-2`.

- [ ] **Step 4: Create the pure responsive-grid helper**

Create `frontend/components/composer/composer-layout.ts`:

```ts
export function getWorkspaceAssetGridClass(fieldCount: number): string {
  if (fieldCount <= 1) return 'grid grid-cols-1 gap-3'
  if (fieldCount === 2) return 'grid grid-cols-1 gap-3 md:grid-cols-2'
  if (fieldCount === 3) {
    return 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'
  }
  return 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
}
```

The static strings are intentional so Tailwind includes every responsive class.

- [ ] **Step 5: Use the shared grid policy in Composer**

Import the helper and choose the outer asset layout as follows:

```ts
const assetFieldLayoutClass = workspaceDensity
  ? getWorkspaceAssetGridClass(assetFields.length)
  : useLtxAssetGridLayout
    ? 'grid gap-4 md:grid-cols-2'
    : 'flex flex-wrap gap-4'
```

On each field wrapper, prevent workspace collection fields from spanning arbitrary columns:

```tsx
className={!workspaceDensity && field.maxCount > 1 ? 'md:col-span-2' : undefined}
```

This makes Seedance’s `Start image`, `End image`, and `Source video` three equal `xl:grid-cols-3` cells while retaining 2/1-column fallbacks.

- [ ] **Step 6: Give workspace dropzones equal card geometry**

In `frontend/components/AssetDropzone.tsx`, add these density-only classes without changing upload logic:

```tsx
className={clsx(
  existingOuterClasses,
  workspaceDensity && 'h-full min-h-[150px]',
)}
```

Ensure the inner border/card wrapper uses `h-full`, the existing workspace border radius, `p-2.5`, and the same title/help typography for image and video fields.

In `AssetDropzoneSlot.tsx`, change only the workspace empty/locked slot geometry to:

```ts
workspaceDensity ? 'min-h-[96px] h-full' : existingRegularClasses
```

Preserve drag/drop, file validation, previews, removal, library selection, locked states, max-count handling, and accessible labels.

- [ ] **Step 7: Run layout, media, and architecture contracts**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/composer-layout.test.ts tests/workspace-first-viewport-contract.test.ts tests/composer-architecture.test.ts tests/shared-media-surfaces-architecture.test.ts
```

Expected: PASS, including the existing line ceilings for `Composer.tsx`, `AssetDropzone.tsx`, and `AssetDropzoneSlot.tsx`.

- [ ] **Step 8: Commit the responsive upload grid**

```bash
git add frontend/components/composer/composer-layout.ts tests/composer-layout.test.ts tests/workspace-first-viewport-contract.test.ts frontend/components/Composer.tsx frontend/components/AssetDropzone.tsx frontend/components/asset-dropzone/AssetDropzoneSlot.tsx
git commit -m "style: harmonize workspace asset grids"
```

---

### Task 6: Responsive, locale, model, and full regression verification

**Files:**
- Create: `docs/superpowers/specs/2026-07-10-workspace-control-compaction-design-qa.md`

**Interfaces:**
- Consumes: the completed UI changes and the existing local development server.
- Produces: browser evidence and a green repository validation set; no new runtime API.

- [ ] **Step 1: Run all focused contracts together**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/engine-select-architecture.test.ts \
  tests/composite-preview-dock-architecture.test.ts \
  tests/image-composite-preview-dock.test.ts \
  tests/composer-architecture.test.ts \
  tests/composer-layout.test.ts \
  tests/resolution-labels.test.ts \
  tests/shared-media-surfaces-architecture.test.ts \
  tests/workspace-first-viewport-contract.test.ts \
  tests/workspace-preview-dock-contract.test.ts
```

Expected: all tests PASS with no skipped contract caused by a missing filename.

- [ ] **Step 2: Smoke-test Generate Video at three viewports**

Using the already authorized local browser workflow and `http://127.0.0.1:3000`, verify at `320x800`, `390x844`, and `1440x1024`:

```text
/app?engine=seedance-2-0
/app?engine=kling-3-pro
/app?engine=sora-2
```

For every route confirm:

```text
- Choose engine + Variant remain on exactly one row.
- No Browse engines link or blank reserved row appears.
- The prompt shows seven full text lines before scrolling.
- Settings + Generate stay on one row; narrow widths scroll horizontally rather than wrap.
- Generate remains visually primary and contains one readable price.
- No document-level horizontal overflow exists: document.documentElement.scrollWidth === document.documentElement.clientWidth.
```

For Seedance at desktop width additionally confirm all three upload cards are equal and share one row.

- [ ] **Step 3: Smoke-test Generate Image and media aspect ratios**

At the same three viewports, open:

```text
/app/image
```

Confirm the same engine/variant, prompt, compact settings, Generate, and upload-card requirements. For video and image results representing `16:9`, `1:1`, and `9:16`, compare bounding boxes in the browser:

```js
const media = document.querySelector('[data-workspace-preview-media]')
const toolbar = document.querySelector('[data-workspace-preview-toolbar]')
const mediaRect = media?.getBoundingClientRect()
const toolbarRect = toolbar?.getBoundingClientRect()
({
  widthDelta: Math.abs((mediaRect?.width ?? 0) - (toolbarRect?.width ?? 0)),
  centerDelta: Math.abs(
    ((mediaRect?.left ?? 0) + (mediaRect?.width ?? 0) / 2) -
    ((toolbarRect?.left ?? 0) + (toolbarRect?.width ?? 0) / 2),
  ),
})
```

Expected: `widthDelta <= 1` and `centerDelta <= 1`. If the data attributes do not exist, add them as stable non-styling hooks to the relevant preview and toolbar elements and cover them in the preview-dock contracts.

- [ ] **Step 4: Verify locale and model resilience**

Repeat the desktop checks under English, French, and Spanish locale state using the application’s existing locale cookie/selector. Confirm translated labels do not create a second line or clip the selected engine/variant, and confirm resolution display is exactly `720p`, `1080p`, or `4K` whenever those values are available. Also confirm unavailable variants remain disabled with their localized explanation.

- [ ] **Step 5: Record visual QA findings**

Create `docs/superpowers/specs/2026-07-10-workspace-control-compaction-design-qa.md` with the tested state and this concrete table:

```markdown
# Workspace Control Compaction — Design QA

## 2026-07-10 verification

| Surface | Viewports | Locales | Models | Result |
| --- | --- | --- | --- | --- |
| Generate Video | 320×800, 390×844, 1440×1024 | EN, FR, ES | Seedance, Kling, Sora | Pass |
| Generate Image | 320×800, 390×844, 1440×1024 | EN, FR, ES | available image engines | Pass |
| Preview toolbar | 16:9, 1:1, 9:16 | EN | video + image | Pass; center and width delta ≤ 1 px |
```

Add the exact browser URL/engine query used and any intentional measurement adjustment below the table. If any cell fails, record `Fail` with the visible issue, fix the smallest responsible task, rerun its focused tests, repeat the failed browser check, and only then change that cell to `Pass`.

- [ ] **Step 6: Run repository verification from narrow to broad**

Run:

```bash
npm --prefix frontend run lint
npm run lint:exposure
npx tsc --project frontend/tsconfig.json --noEmit
git diff --check
pnpm test:validate
pnpm --prefix frontend run build
```

Expected:

```text
- ESLint exits 0.
- Exposure guard exits 0.
- TypeScript exits 0.
- git diff --check prints nothing.
- The full validation suite passes.
- Next.js production build and sitemap generation complete successfully.
```

- [ ] **Step 7: Review the final diff for scope and preservation**

Run:

```bash
git status --short
git diff --stat HEAD~5..HEAD
git diff HEAD~5..HEAD -- frontend/app frontend/components frontend/src tests docs/superpowers
```

Confirm the diff contains no route deletion, message-catalog rewrite, engine-value change, API payload change, SEO metadata change, or unrelated formatting churn.

- [ ] **Step 8: Commit only the QA record if it changed**

```bash
git add docs/superpowers/specs/2026-07-10-workspace-control-compaction-design-qa.md
git commit -m "docs: record workspace compaction QA"
```

Do not push, merge, or deploy unless the user explicitly requests it.
