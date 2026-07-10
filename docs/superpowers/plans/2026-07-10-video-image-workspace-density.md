# Video and Image Workspace Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved conversion-focused responsive density to `/app` and `/app/image` while preserving route order, auth continuity, generation behavior, asset fields, prices, and SEO contracts.

**Architecture:** Add opt-in `workspace` presentation contracts to the shared engine selector, composer, and route-specific settings bars. The video and image route-local surfaces opt into those contracts; shared defaults remain unchanged for every other consumer. Keep video aspect safety in the focused preview tile and keep guest-auth lock presentation in a focused asset-disabled-state component so the existing large owners stay below their architecture thresholds.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS utilities, Lucide icons, Node `test` through `tsx`, Playwright CLI, and the existing MaxVideoAI i18n and engine registries.

## Global Constraints

- Preserve `/app`, `/app/image`, `/login`, `/billing`, all current query parameters, route groups, localized slugs, canonical URLs, hreflang, JSON-LD, robots, sitemaps, and redirects.
- Keep one authentication-neutral layout per route; do not branch on `user`, `session`, or `authStatus` to reorder surfaces.
- Keep video order preview → composer → Start/End frame → negative prompt → advanced settings.
- Keep image order preview → composer → Reference images → Advanced settings.
- Keep `AppClient.tsx` and `ImageWorkspace.tsx` as orchestrators; route-local surfaces own presentation.
- Do not change pricing calculations, image estimates, wallet preflight, top-up, checkout, generation, polling, upload, persistence, history, or API contracts.
- Keep prompt limits dynamic from the selected engine; do not hardcode `2500` or `5000`.
- Show price once, inside the relevant Generate button.
- At 1440 × 1024, settings and Generate remain on one row for both routes.
- At 390 × 844, controls may scroll inside their own row, but the document must not overflow horizontally.
- Prioritize 16:9 video while containing portrait, square, and other formats without crop or stretch.
- Remove `Unavailable` and warning styling only for the guest authentication upload lock; preserve genuine workflow-disabled explanations.
- New shared presentation props are opt-in; all existing default consumers keep their current rendering.
- Add localized compact Browse engines copy to English, French, and Spanish messages.
- Keep `EngineSelect.tsx` at or below 430 lines, `Composer.tsx` at or below 500 lines, and `AssetDropzone.tsx` at or below 460 lines.
- Follow red-green-refactor and commit each independently testable task.

---

### Task 1: Add the shared compact engine-and-variant presentation

**Files:**
- Create: `frontend/src/components/ui/engine-select/EngineVariantControl.tsx`
- Modify: `frontend/src/components/ui/engine-select/engine-select-types.ts`
- Modify: `frontend/src/components/ui/engine-select/engine-select-copy.ts`
- Modify: `frontend/src/components/ui/EngineSelect.tsx`
- Modify: `frontend/components/EngineSettingsBar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspacePreviewDock.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface.tsx`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Modify: `tests/engine-select-architecture.test.ts`
- Create: `tests/workspace-first-viewport-contract.test.ts`

**Interfaces:**
- Produces: `EngineSelectControlPresentation = 'default' | 'workspace'`.
- Produces: optional `controlPresentation?: EngineSelectControlPresentation` on `EngineSelectProps`.
- Produces: `EngineVariantControl`, which receives existing variant engines and calls the existing `onEngineChange(engineId)` contract.
- Consumes: `variantEngines`, `selectedEngine.id`, `disabledEngineReasons`, and `getVariantLabel` already owned by `EngineSelect`.

- [ ] **Step 1: Write the failing architecture and route opt-in tests**

Add to `tests/engine-select-architecture.test.ts`:

```ts
const variantControlPath = join(root, 'frontend/src/components/ui/engine-select/EngineVariantControl.tsx');

test('engine select delegates variant presentation to a focused component', () => {
  assert.ok(existsSync(variantControlPath));
  const variantControlSource = readFileSync(variantControlPath, 'utf8');
  assert.match(engineSelectSource, /from '.\/engine-select\/EngineVariantControl'/);
  assert.match(engineSelectSource, /<EngineVariantControl/);
  assert.match(variantControlSource, /export function EngineVariantControl/);
  assert.match(variantControlSource, /<SelectMenu/);
  assert.match(typesSource, /EngineSelectControlPresentation = 'default' \| 'workspace'/);
  assert.match(typesSource, /controlPresentation\?: EngineSelectControlPresentation/);
});
```

Create `tests/workspace-first-viewport-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const videoPreviewSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/_components/WorkspacePreviewDock.tsx',
  'utf8'
);
const imageSurfaceSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface.tsx',
  'utf8'
);
const appClientSource = readFileSync('frontend/app/(core)/(workspace)/app/AppClient.tsx', 'utf8');
const imageWorkspaceSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/image/ImageWorkspace.tsx',
  'utf8'
);

test('route-local surfaces opt into compact workspace engine controls', () => {
  assert.match(videoPreviewSource, /controlPresentation="workspace"/);
  assert.match(imageSurfaceSource, /controlPresentation="workspace"/);
  assert.doesNotMatch(appClientSource, /controlPresentation/);
  assert.doesNotMatch(imageWorkspaceSource, /<EngineSelect\b/);
});
```

- [ ] **Step 2: Run focused tests and verify red**

Run:

```bash
PATH=/opt/homebrew/bin:$PATH pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/engine-select-architecture.test.ts \
  tests/workspace-first-viewport-contract.test.ts
```

Expected: FAIL because the focused variant control and route opt-ins do not exist.

- [ ] **Step 3: Add the presentation type and focused variant control**

Add to `engine-select-types.ts`:

```ts
export type EngineSelectControlPresentation = 'default' | 'workspace';
```

Add `controlPresentation?: EngineSelectControlPresentation` to the existing
`EngineSelectProps` interface without changing its other fields.

Create `EngineVariantControl.tsx` with both current pills and the new select:

```tsx
'use client';

import clsx from 'clsx';
import type { EngineCaps } from '@/types/engines';
import { SelectMenu } from '@/components/ui/SelectMenu';
import type { EngineSelectControlPresentation } from './engine-select-types';

type Props = {
  compact: boolean;
  disabledEngineReasons?: Record<string, string>;
  getLabel: (engine: EngineCaps) => string;
  label: string;
  onChange: (engineId: string) => void;
  presentation: EngineSelectControlPresentation;
  selectedEngineId: string;
  variants: EngineCaps[];
};

export function EngineVariantControl(props: Props) {
  const { compact, disabledEngineReasons, getLabel, label, onChange, presentation, selectedEngineId, variants } = props;
  if (variants.length <= 1) return null;

  if (presentation === 'workspace') {
    return (
      <div className="w-[112px] shrink-0 space-y-1 sm:w-[136px]">
        <span className="text-[10px] uppercase tracking-micro text-text-muted">{label}</span>
        <SelectMenu
          options={variants.map((entry) => ({
            value: entry.id,
            label: getLabel(entry),
            disabled: Boolean(disabledEngineReasons?.[entry.id]),
          }))}
          value={selectedEngineId}
          onChange={(value) => onChange(String(value))}
          className="min-w-0"
          buttonClassName="min-h-0 h-[42px] rounded-input border-border bg-surface px-3 py-0 text-[11px] font-semibold uppercase tracking-micro shadow-sm"
        />
      </div>
    );
  }

  return (
    <div className={clsx(compact ? 'space-y-0.5' : 'space-y-1')}>
      <span className="text-[10px] uppercase tracking-micro text-text-muted">{label}</span>
      <div className={clsx('flex flex-wrap', compact ? 'gap-1.5' : 'gap-2')}>
        {variants.map((entry) => {
          const active = entry.id === selectedEngineId;
          const disabledReason = disabledEngineReasons?.[entry.id];
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => !disabledReason && onChange(entry.id)}
              disabled={Boolean(disabledReason)}
              title={disabledReason}
              className={clsx(
                'rounded-pill border px-3 py-1 text-[10px] font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-brand bg-brand text-on-brand'
                  : disabledReason
                    ? 'cursor-not-allowed border-border bg-surface text-text-muted/60 opacity-70'
                    : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-2'
              )}
            >
              {getLabel(entry)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Compose the workspace row and localized compact Browse action**

In `EngineSelect`, default `controlPresentation = 'default'`, import `ExternalLink` from `lucide-react`, and move the old pills block into `EngineVariantControl`.

For `controlPresentation === 'workspace'`, wrap the existing engine trigger and the new variant control in a row with `className="flex items-end gap-2"`. Give the engine trigger wrapper `className="min-w-0 flex-1"`, then render the variant control with these exact props:

```tsx
<EngineVariantControl
  compact={isCompact}
  disabledEngineReasons={disabledEngineReasons}
  getLabel={getVariantLabel}
  label={copy.variant}
  onChange={onEngineChange}
  presentation={controlPresentation}
  selectedEngineId={selectedEngine.id}
  variants={variantEngines}
/>
```

Keep the current bordered Browse button unchanged for the default presentation. Replace it only in the workspace presentation with:

```tsx
<button
  type="button"
  onClick={() => setBrowseOpen(true)}
  className="ml-auto inline-flex min-h-9 items-center gap-1.5 px-1 text-[11px] font-medium text-text-muted hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  <span>{copy.browseCompact}</span>
  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
</button>
```

Add fallback and messages:

```ts
browseCompact: 'Browse engines',
```

```json
"browseCompact": "Browse engines"
"browseCompact": "Explorer les modèles"
"browseCompact": "Explorar motores"
```

Thread `controlPresentation="workspace"` and `density="compact"` through `EngineSettingsBar` to `WorkspacePreviewDock`, and pass both directly in `ImageWorkspaceComposerSurface`. Keep engine/mode callbacks unchanged.

- [ ] **Step 5: Verify and commit**

```bash
PATH=/opt/homebrew/bin:$PATH pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/engine-select-architecture.test.ts \
  tests/workspace-draft-and-surfaces-contract.test.ts \
  tests/image-workspace-split-contract.test.ts \
  tests/workspace-first-viewport-contract.test.ts
PATH=/opt/homebrew/bin:$PATH pnpm --prefix frontend exec tsc --noEmit
git add frontend/src/components/ui/engine-select frontend/src/components/ui/EngineSelect.tsx \
  frontend/components/EngineSettingsBar.tsx \
  'frontend/app/(core)/(workspace)/app/_components/WorkspacePreviewDock.tsx' \
  'frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface.tsx' \
  frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json \
  tests/engine-select-architecture.test.ts tests/workspace-first-viewport-contract.test.ts
git commit -m "feat: compact workspace engine controls"
```

Expected: tests and type-check PASS; `EngineSelect.tsx` remains at or below 430 lines.

### Task 2: Add opt-in Composer and settings density

**Files:**
- Modify: `frontend/components/composer/composer-types.ts`
- Modify: `frontend/components/Composer.tsx`
- Modify: `frontend/components/CoreSettingsBar.tsx`
- Modify: `frontend/components/ImageSettingsBar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface.tsx`
- Modify: `tests/composer-architecture.test.ts`
- Modify: `tests/workspace-composer-surface-contract.test.ts`
- Modify: `tests/image-workspace-split-contract.test.ts`
- Modify: `tests/workspace-first-viewport-contract.test.ts`

**Interfaces:**
- Produces: optional `density?: 'default' | 'workspace'` on `ComposerProps`, `CoreSettingsBarProps`, and `ImageSettingsBarProps`.
- Consumes: current settings React nodes and Generate handlers; no state moves into shared presentation components.
- Guarantees: one contained settings row; mobile Generate below it; desktop Generate on the same non-wrapping row.

- [ ] **Step 1: Add failing density and price assertions**

Extend `workspace-first-viewport-contract.test.ts`:

```ts
const composerSource = readFileSync('frontend/components/Composer.tsx', 'utf8');
const composerTypesSource = readFileSync('frontend/components/composer/composer-types.ts', 'utf8');
const videoComposerSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx',
  'utf8'
);
const coreSettingsSource = readFileSync('frontend/components/CoreSettingsBar.tsx', 'utf8');
const imageSettingsSource = readFileSync('frontend/components/ImageSettingsBar.tsx', 'utf8');

test('video and image composers opt into one responsive workspace density contract', () => {
  assert.match(composerTypesSource, /density\?: 'default' \| 'workspace'/);
  assert.match(videoComposerSource, /<Composer[\s\S]*density="workspace"/);
  assert.match(imageSurfaceSource, /<Composer[\s\S]*density="workspace"/);
  assert.match(videoComposerSource, /<CoreSettingsBar[\s\S]*density="workspace"/);
  assert.match(imageSurfaceSource, /<ImageSettingsBar[\s\S]*density="workspace"/);
  assert.match(coreSettingsSource, /workspaceDensity[\s\S]*flex-nowrap/);
  assert.match(imageSettingsSource, /workspaceDensity[\s\S]*flex-nowrap/);
  assert.match(composerSource, /workspaceDensity[\s\S]*overflow-x-auto/);
  assert.doesNotMatch(composerSource, /Estimated price|Estimated credits/);
});
```

- [ ] **Step 2: Run tests and verify red**

```bash
PATH=/opt/homebrew/bin:$PATH pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/composer-architecture.test.ts \
  tests/workspace-composer-surface-contract.test.ts \
  tests/image-workspace-split-contract.test.ts \
  tests/workspace-first-viewport-contract.test.ts
```

Expected: FAIL because density contracts and opt-ins do not exist.

- [ ] **Step 3: Add the shared Composer density**

Add `density?: 'default' | 'workspace'` to `ComposerProps`, default it to `default`, and derive `workspaceDensity`.

Use these opt-in branches while preserving existing default class strings:

```tsx
<Card
  data-composer-density={density}
  className={clsx('overflow-visible border-border/85', workspaceDensity ? 'p-3 sm:p-4' : 'p-4 md:p-5')}
>
```

```tsx
<div className={clsx(
  'flex items-start justify-between px-4',
  workspaceDensity ? 'flex-nowrap gap-2 pb-1.5 pt-3' : 'flex-wrap gap-3 pb-2 pt-4'
)}>
  <div className="flex shrink-0 items-center gap-2 pt-1">{/* Prompt + dynamic count */}</div>
  <div className={clsx('flex min-w-0 items-center justify-end', workspaceDensity ? 'gap-1.5' : 'flex-wrap gap-2')}>
    {/* current Multi-prompt and promoted actions */}
  </div>
</div>
```

Use `min-h-[132px] px-4 pb-3 leading-5 sm:min-h-[148px]` for the workspace textarea and keep current default textarea classes.

Use this action layout:

```tsx
<div className={workspaceDensity
  ? 'flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-center'
  : 'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'}>
  {settingsBar ? (
    <div className={clsx('min-w-0 flex-1', workspaceDensity && 'w-full overflow-x-auto overscroll-x-contain')}>
      {settingsBar}
    </div>
  ) : null}
  <div className={clsx('flex shrink-0 flex-col gap-2', workspaceDensity ? 'w-full lg:w-auto' : 'lg:items-end')}>
    {/* existing member discount and Generate Button */}
  </div>
</div>
```

For workspace density, the button stays full-width on mobile and uses `lg:min-w-[200px] lg:w-auto`. Keep the existing `formattedPrice` span as the only amount rendering.

- [ ] **Step 4: Add non-wrapping density to both settings bars and opt in both routes**

Add `density?: 'default' | 'workspace'`, derive `workspaceDensity`, and render each settings owner as:

```tsx
<div
  data-settings-density={density}
  className={clsx('flex items-center gap-2', workspaceDensity ? 'w-max min-w-full flex-nowrap' : 'flex-wrap')}
>
```

Thread `compact={workspaceDensity}` to inline controls. Compact controls use `h-9 px-2.5 text-[11px]`; defaults retain `h-10 px-3 text-[12px]`. Do not change option order, values, disabled state, or callbacks.

Pass `density="workspace"` to both `Composer` calls, `CoreSettingsBar`, and `ImageSettingsBar`.

- [ ] **Step 5: Verify and commit**

```bash
PATH=/opt/homebrew/bin:$PATH pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/composer-architecture.test.ts \
  tests/workspace-composer-surface-contract.test.ts \
  tests/image-workspace-split-contract.test.ts \
  tests/workspace-first-viewport-contract.test.ts
PATH=/opt/homebrew/bin:$PATH pnpm --prefix frontend exec tsc --noEmit
git add frontend/components/composer/composer-types.ts frontend/components/Composer.tsx \
  frontend/components/CoreSettingsBar.tsx frontend/components/ImageSettingsBar.tsx \
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx' \
  'frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface.tsx' \
  tests/composer-architecture.test.ts tests/workspace-composer-surface-contract.test.ts \
  tests/image-workspace-split-contract.test.ts tests/workspace-first-viewport-contract.test.ts
git commit -m "feat: compact workspace composer controls"
```

Expected: PASS; `Composer.tsx` remains at or below 500 lines.

### Task 3: Make the video preview aspect-safe

**Files:**
- Modify: `frontend/components/groups/CompositePreviewDockTile.tsx`
- Modify: `tests/composite-preview-dock-architecture.test.ts`
- Modify: `tests/image-composite-preview-dock.test.ts`

**Interfaces:**
- Produces contained media for every aspect ratio; 16:9 naturally fills the 16:9 stage.
- Preserves playback, poster, readiness, processing, audio badge, modal, and toolbar behavior.
- Keeps image preview `resolveCssAspectRatio` and `object-contain` behavior unchanged.

- [ ] **Step 1: Write the failing aspect regressions**

```ts
test('video preview tiles contain every aspect without crop or stretch', () => {
  const tileSource = fs.readFileSync(tilePath, 'utf8');
  assert.match(tileSource, /const mediaFitClass = 'object-contain';/);
  assert.doesNotMatch(tileSource, /object-cover|scale-\[1\.02\]/);
  assert.match(tileSource, /aspectRatio: '16 \/ 9'/);
});
```

In `image-composite-preview-dock.test.ts`, assert that `resolveCssAspectRatio` and `object-contain` remain present.

- [ ] **Step 2: Run red, implement, and rerun**

```bash
PATH=/opt/homebrew/bin:$PATH pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/composite-preview-dock-architecture.test.ts tests/image-composite-preview-dock.test.ts
```

Expected first run: FAIL because 16:9 video uses `object-cover scale-[1.02]`.

In `CompositePreviewDockTile.tsx`, remove `parseAspectRatio`, `resolveAspectHint`, `parsedAspect`, `isSixteenByNine`, and `shouldZoom`, then use:

```ts
const mediaFitClass = 'object-contain';
```

Apply it to posters, active video, and static thumbnails. Keep the 16:9 spacer and neutral stage background.

Rerun the command plus:

```bash
PATH=/opt/homebrew/bin:$PATH pnpm --prefix frontend exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/groups/CompositePreviewDockTile.tsx \
  tests/composite-preview-dock-architecture.test.ts tests/image-composite-preview-dock.test.ts
git commit -m "fix: contain workspace preview media"
```

### Task 4: Calm only the guest upload-lock presentation

**Files:**
- Create: `frontend/components/asset-dropzone/AssetFieldDisabledState.tsx`
- Modify: `frontend/components/asset-dropzone/asset-dropzone-types.ts`
- Modify: `frontend/components/AssetDropzone.tsx`
- Modify: `frontend/components/Composer.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`
- Modify: `tests/shared-media-surfaces-architecture.test.ts`
- Modify: `tests/workspace-composer-surface-contract.test.ts`
- Modify: `tests/workspace-first-viewport-contract.test.ts`

**Interfaces:**
- Produces: `AssetDisabledPresentation = 'default' | 'auth-lock'`.
- Produces: optional `disabledPresentation?: AssetDisabledPresentation` on `AssetFieldConfig` and `AssetDropzone`.
- Preserves disabled handlers and `disabledReason` text.
- Applies `auth-lock` only when the winning reason is `guestUploadLockedReason`.

- [ ] **Step 1: Write failing focused disabled-state assertions**

Update `shared-media-surfaces-architecture.test.ts`:

```ts
const assetDisabledStatePath = join(root, 'frontend/components/asset-dropzone/AssetFieldDisabledState.tsx');
assert.ok(existsSync(assetDisabledStatePath));
const assetDisabledStateSource = readFileSync(assetDisabledStatePath, 'utf8');
assert.match(assetDropzoneSource, /AssetFieldDisabledBadge/);
assert.match(assetDropzoneSource, /AssetFieldDisabledNotice/);
assert.match(assetDisabledStateSource, /presentation === 'auth-lock'/);
assert.match(assetDisabledStateSource, /presentation !== 'auth-lock'/);
assert.match(assetDisabledStateSource, /Unavailable/);
```

Add to the Workspace contract:

```ts
assert.match(videoComposerSource, /disabledPresentation:\s*disabledReason === guestUploadLockedReason\s*\? 'auth-lock'/);
```

Run:

```bash
PATH=/opt/homebrew/bin:$PATH pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/shared-media-surfaces-architecture.test.ts \
  tests/workspace-composer-surface-contract.test.ts \
  tests/workspace-first-viewport-contract.test.ts
```

Expected: FAIL because the focused component and presentation type do not exist.

- [ ] **Step 2: Add the type and focused component**

```ts
export type AssetDisabledPresentation = 'default' | 'auth-lock';
```

Add `disabledPresentation?: AssetDisabledPresentation` to `AssetFieldConfig`.

Create `AssetFieldDisabledState.tsx`:

```tsx
import clsx from 'clsx';
import type { AssetDisabledPresentation } from './asset-dropzone-types';

export function isSourceVideoDisabledReason(reason?: string | null) {
  return Boolean(reason?.toLowerCase().includes('source video'));
}

export function AssetFieldDisabledBadge({ disabled, presentation, reason }: {
  disabled: boolean;
  presentation: AssetDisabledPresentation;
  reason: string | null;
}) {
  if (!disabled || !reason || presentation === 'auth-lock') return null;
  const label = isSourceVideoDisabledReason(reason) ? 'Source video active' : 'Unavailable';
  return <span className="shrink-0 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning">{label}</span>;
}

export function AssetFieldDisabledNotice({ disabled, presentation, reason }: {
  disabled: boolean;
  presentation: AssetDisabledPresentation;
  reason: string | null;
}) {
  if (!disabled || !reason || isSourceVideoDisabledReason(reason)) return null;
  return (
    <div role="note" className={clsx(
      'rounded-input border px-3 py-2 text-left text-[11px] font-medium leading-4',
      presentation === 'auth-lock'
        ? 'border-border bg-surface-2 text-text-secondary'
        : 'border-warning-border bg-warning-bg text-warning'
    )}>{reason}</div>
  );
}
```

- [ ] **Step 3: Compose without weakening disabled behavior**

Default `AssetDropzone.disabledPresentation` to `default`, replace inline badge/note JSX with the focused components, and apply warning card classes only to the default presentation. Pass the config value through `Composer`.

In `WorkspaceComposerSurface`, add:

```ts
disabledPresentation:
  disabledReason && disabledReason === guestUploadLockedReason ? 'auth-lock' : 'default',
```

Keep `disabled`, `disabledReason`, `handleDisabledAttempt`, slot lock icons, and auth-modal behavior.

- [ ] **Step 4: Verify and commit**

```bash
PATH=/opt/homebrew/bin:$PATH pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/shared-media-surfaces-architecture.test.ts \
  tests/workspace-composer-surface-contract.test.ts \
  tests/workspace-first-viewport-contract.test.ts
PATH=/opt/homebrew/bin:$PATH pnpm --prefix frontend exec tsc --noEmit
git add frontend/components/asset-dropzone frontend/components/AssetDropzone.tsx \
  frontend/components/Composer.tsx \
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx' \
  tests/shared-media-surfaces-architecture.test.ts \
  tests/workspace-composer-surface-contract.test.ts tests/workspace-first-viewport-contract.test.ts
git commit -m "feat: soften guest workspace upload locks"
```

Expected: PASS; `AssetDropzone.tsx` remains at or below 460 lines.

### Task 5: Lock route order and responsive shell behavior

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceChrome.tsx`
- Modify: `tests/workspace-draft-and-surfaces-contract.test.ts`
- Modify: `tests/workspace-shell-route-state-contract.test.ts`
- Modify: `tests/image-workspace-split-contract.test.ts`
- Modify: `tests/workspace-first-viewport-contract.test.ts`

**Interfaces:**
- Consumes existing `isDesktopLayout`; no new auth input.
- Preserves video preview before composer and image preview before image form.
- Produces 16px mobile main padding for video, matching image Workspace and approved mobile targets.

- [ ] **Step 1: Add order, auth-independence, and padding regressions**

```ts
const videoShellSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppShell.tsx',
  'utf8'
);
const workspaceChromeSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceChrome.tsx',
  'utf8'
);

test('workspace density never changes route order by authentication state', () => {
  assert.ok(videoShellSource.indexOf('<WorkspacePreviewDock') < videoShellSource.indexOf('{composerSurface}'));
  assert.ok(imageSurfaceSource.indexOf('<ImageCompositePreviewDock') < imageSurfaceSource.indexOf('<form'));
  assert.doesNotMatch(videoShellSource, /authStatus|session|user/);
  assert.doesNotMatch(imageSurfaceSource, /authStatus/);
  assert.match(workspaceChromeSource, /p-4 lg:p-7/);
});
```

Run the four route-contract files. Expected: FAIL only on the padding assertion because video still uses `p-5 lg:p-7`.

- [ ] **Step 2: Apply the approved shell density, verify, and commit**

Change only:

```tsx
<main className="flex min-w-0 flex-1 flex-col gap-[var(--stack-gap-lg)] p-4 lg:p-7">
```

Run:

```bash
PATH=/opt/homebrew/bin:$PATH pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/workspace-draft-and-surfaces-contract.test.ts \
  tests/workspace-shell-route-state-contract.test.ts \
  tests/image-workspace-split-contract.test.ts \
  tests/workspace-first-viewport-contract.test.ts
git add 'frontend/app/(core)/(workspace)/app/_components/WorkspaceChrome.tsx' \
  tests/workspace-draft-and-surfaces-contract.test.ts tests/workspace-shell-route-state-contract.test.ts \
  tests/image-workspace-split-contract.test.ts tests/workspace-first-viewport-contract.test.ts
git commit -m "style: tighten workspace responsive shells"
```

Expected: PASS. Do not change sidebar, rail, notice, preview, composer, reference, or asset ordering.

### Task 6: Run full behavior verification and blocking visual QA

**Files:**
- Create or replace: `design-qa.md`
- Generate: `output/playwright/workspace-video-mobile.png`
- Generate: `output/playwright/workspace-video-desktop.png`
- Generate: `output/playwright/workspace-image-mobile.png`
- Generate: `output/playwright/workspace-image-desktop.png`

**Interfaces:**
- Consumes source targets:
  - `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-ec897e31-e4be-4404-a505-8f562287b964.png`
  - `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-e8b6d408-809e-4061-b1f4-6d63ef66e7d4.png`
  - `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-0c9e7b82-d6cb-45e9-861e-2972c61231c7.png`
  - `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-a1c4bd95-268f-4acc-a7a1-3b7b7317ad70.png`
- Produces `design-qa.md` with `final result: passed` before handoff.

- [ ] **Step 1: Run focused and full automated verification**

```bash
PATH=/opt/homebrew/bin:$PATH pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/engine-select-architecture.test.ts tests/composer-architecture.test.ts \
  tests/composite-preview-dock-architecture.test.ts tests/image-composite-preview-dock.test.ts \
  tests/shared-media-surfaces-architecture.test.ts tests/workspace-composer-surface-contract.test.ts \
  tests/workspace-draft-and-surfaces-contract.test.ts tests/workspace-shell-route-state-contract.test.ts \
  tests/image-workspace-split-contract.test.ts tests/workspace-first-viewport-contract.test.ts
PATH=/opt/homebrew/bin:$PATH pnpm --prefix frontend exec tsc --noEmit
PATH=/opt/homebrew/bin:$PATH npm --prefix frontend run lint
PATH=/opt/homebrew/bin:$PATH npm run lint:exposure
PATH=/opt/homebrew/bin:$PATH pnpm test:validate
PATH=/opt/homebrew/bin:$PATH npm --prefix frontend run build
git diff --check
```

Expected: all checks pass and `git diff --check` prints nothing.

- [ ] **Step 2: Capture four settled views with the authorized Playwright browser**

Start the app with `PATH=/opt/homebrew/bin:$PATH npm --prefix frontend run dev`. Use the Playwright wrapper and fresh snapshots after each navigation. Dismiss the cookie dialog, wait for engines, quote, starter preview, and rail, then capture:

```bash
PWCLI="${CODEX_HOME:-$HOME/.codex}/skills/playwright/scripts/playwright_cli.sh"
PATH=/opt/homebrew/bin:$PATH "$PWCLI" -s=mvqa open http://127.0.0.1:3000/app --headed
PATH=/opt/homebrew/bin:$PATH "$PWCLI" -s=mvqa resize 390 844
PATH=/opt/homebrew/bin:$PATH "$PWCLI" -s=mvqa screenshot --filename=output/playwright/workspace-video-mobile.png
PATH=/opt/homebrew/bin:$PATH "$PWCLI" -s=mvqa resize 1440 1024
PATH=/opt/homebrew/bin:$PATH "$PWCLI" -s=mvqa screenshot --filename=output/playwright/workspace-video-desktop.png
PATH=/opt/homebrew/bin:$PATH "$PWCLI" -s=mvqa goto http://127.0.0.1:3000/app/image
PATH=/opt/homebrew/bin:$PATH "$PWCLI" -s=mvqa resize 390 844
PATH=/opt/homebrew/bin:$PATH "$PWCLI" -s=mvqa screenshot --filename=output/playwright/workspace-image-mobile.png
PATH=/opt/homebrew/bin:$PATH "$PWCLI" -s=mvqa resize 1440 1024
PATH=/opt/homebrew/bin:$PATH "$PWCLI" -s=mvqa screenshot --filename=output/playwright/workspace-image-desktop.png
```

- [ ] **Step 3: Test primary interactions and overflow**

Using fresh snapshot refs, verify:

1. Video engine, Pro/4K/Standard variant, and Browse modal controls.
2. Multi-prompt, Storyboard, prompt editing, and one displayed price.
3. Guest Generate opens the current auth gate and focus returns on close.
4. Start/End locks show `Sign in to upload`, not `Unavailable`.
5. 16:9, portrait, and square videos contain without crop or stretch.
6. Image engine and Lite/Pro variant controls.
7. Image count, aspect, resolution, format, Generate-to-auth-gate, References, Characters, and Advanced settings.
8. `document.documentElement.scrollWidth === document.documentElement.clientWidth` on both mobile routes.
9. No new browser console errors.

- [ ] **Step 4: Perform blocking visual comparison and write `design-qa.md`**

Open each source target and its same-viewport implementation capture together in the same comparison input. Compare full views and focused engine, action-row, viewer, upload-lock, and reference regions.

Write `design-qa.md` with exact source paths, implementation paths, viewport/state, full-view evidence, focused-region evidence, fonts/typography, spacing/layout, colors/tokens, image fidelity, copy, interaction checks, console result, findings, comparison history, and one exact final line:

```md
final result: passed
```

If a P0/P1/P2 remains, use `final result: blocked`, fix it, recapture the same state, and repeat. P3 polish may remain documented.

- [ ] **Step 5: Commit verification and audit the repository**

```bash
git add design-qa.md frontend tests
git commit -m "test: verify workspace responsive density"
git status --short --branch
git log -6 --oneline
git diff HEAD~6 --check
```

Expected: no unintended source files, planned commits present, and whitespace validation passes. Keep `output/playwright/` untracked unless repository policy explicitly tracks it.
