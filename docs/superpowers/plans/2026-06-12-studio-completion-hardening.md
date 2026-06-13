# Studio Completion And Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining MaxVideoAI Studio gaps from the June 12 audit: clean typecheck, complete localization, finish light/dark parity, harden canvas/timeline/project-media behavior, and make unauthenticated/API failure states user-safe.

**Architecture:** Keep Studio route-local under `frontend/app/(core)/(workspace)/app/studio`. Add behavior first in pure helpers or focused controllers, then wire UI through existing Studio components. Do not grow `WorkspacePage.client.tsx` beyond orchestration; update architecture tests when a responsibility moves.

**Tech Stack:** Next.js App Router, React client components, CSS modules with `data-studio-theme`, `next-intl` dictionaries, Node test runner, Playwright editor specs, Studio API routes.

---

## File Structure

- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
  - Owns all typed Studio copy, plural labels, localized generated names, and formatting helpers.
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
  - Must expose every `workspace.studio` key used by Studio.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasHistory.ts`
  - Fix browser timer typing so full TypeScript checks pass.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/registry.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/product-ad.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/variant-base.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/cinematic-scene.ts`
  - Pass localized canvas copy into template builders so generated nodes/timeline seed text does not stay English.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasTemplateActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspacePersistenceEffects.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`
  - Thread template localization copy through current creation and hydration paths.
- Delete: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeLibrarySidebar.tsx`
  - Legacy unused canvas sidebar with hardcoded English copy. The active UI is `CanvasFloatingToolbar`.
- Modify: `docs/engineering/studio-editor-architecture.md`
- Modify: `frontend/app/(core)/(workspace)/app/studio/AGENTS.md`
  - Replace old `NodeLibrarySidebar` ownership references with `CanvasFloatingToolbar`.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceSequenceActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-selectors.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence.ts`
  - Replace English default labels and ad hoc pluralization with localized helper output.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-resize-editing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceTimelineClipActions.ts`
  - Lock ripple trim behavior to adjacent clips only while preserving free gap movement and duration expansion.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useProjectMediaController.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineProjectSidebar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/media.module.css`
  - Harden multi-select, bulk delete, scroll sizing, keyboard access, and no-scrollbar media grid behavior.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/projects/StudioProjectsPage.client.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspacePersistenceEffects.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts`
  - Convert expected 401/503 Studio API responses into quiet, localized UI states.
- Modify CSS modules:
  - `frontend/app/(core)/(workspace)/app/studio/projects/studio-projects.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-toolbar.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-nodes.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/viewer.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/timeline.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/media.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/inspector.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/export.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/asset-library.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/studio-session.module.css`
  - Finish theme token usage and remove hard dark/light leftovers.
- Test: `tests/studio-localization-contract.test.ts`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`
- Test: `tests/maxvideoai-editor-timeline-interaction.test.ts`
- Test: `tests/maxvideoai-editor-timeline-selection.test.ts`
- Test: `tests/maxvideoai-editor-project-media-timeline.test.ts`
- Test: `tests/e2e/editor/editor-smoke.spec.ts`
- Test: `tests/e2e/editor/editor-timeline.spec.ts`
- Test: `tests/e2e/editor/editor-library.spec.ts`
  - Lock the behavior before wiring broad UI changes.

---

## Task 1: Baseline Guard Rails And Typecheck

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasHistory.ts`
- Test: TypeScript check command

- [x] **Step 1: Reproduce the full typecheck failure**

Run:

```bash
npm exec tsc -- --noEmit -p tsconfig.json
```

from:

```bash
cd frontend
```

Expected: FAIL with:

```txt
app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasHistory.ts(92,5): error TS2322: Type 'number' is not assignable to type 'Timeout'.
```

- [x] **Step 2: Fix the timer ref type**

In `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasHistory.ts`, replace:

```ts
const gestureCommitTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
```

with:

```ts
const gestureCommitTimerRef = useRef<number | null>(null);
```

Keep the existing `window.clearTimeout(gestureCommitTimerRef.current)` call.

- [x] **Step 3: Verify typecheck passes**

Run:

```bash
cd frontend
npm exec tsc -- --noEmit -p tsconfig.json
```

Expected: PASS with no TypeScript errors.

- [x] **Step 4: Verify focused Studio contracts still pass**

Run:

```bash
npm run test:editor
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceCanvasHistory.ts
git commit -m "fix: clean studio canvas history timer typing"
```

---

## Task 2: Complete Studio Localization Coverage

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceSequenceActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-selectors.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence.ts`
- Delete: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeLibrarySidebar.tsx`
- Modify: `docs/engineering/studio-editor-architecture.md`
- Modify: `frontend/app/(core)/(workspace)/app/studio/AGENTS.md`
- Test: `tests/studio-localization-contract.test.ts`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [x] **Step 1: Add failing localization tests for known leftovers**

Append to `tests/studio-localization-contract.test.ts`:

```ts
test('Studio source files do not keep legacy English UI copy outside the copy owner', () => {
  const bannedFiles = [
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts',
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceSequenceActions.ts',
    'frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeLibrarySidebar.tsx',
  ];

  const bannedPatterns = [
    /media assets?/,
    /generated clips?/,
    /\\bfolders?\\b/,
    /\\bBlock templates\\b/,
    /\\bCanvas templates\\b/,
    /\\bTemplate name\\b/,
    /\\bNo saved canvas templates yet\\b/,
  ];

  bannedFiles.forEach((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return;
    const source = fs.readFileSync(absolutePath, 'utf8');
    bannedPatterns.forEach((pattern) => {
      assert.doesNotMatch(source, pattern, `${relativePath} should route visible copy through studio-copy.ts`);
    });
  });
});
```

- [x] **Step 2: Run the failing localization test**

Run:

```bash
npm --prefix frontend exec tsx -- --tsconfig frontend/tsconfig.json --test tests/studio-localization-contract.test.ts
```

Expected: FAIL on the hardcoded media plural labels and/or `NodeLibrarySidebar.tsx`.

- [x] **Step 3: Extend typed Studio copy with plural media labels**

In `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`, extend `StudioCopy['common']`:

```ts
common: {
  secondsShort: string;
  itemSingular: string;
  itemPlural: string;
  folder: string;
  generatedClip: string;
  mediaAssetSingular: string;
  mediaAssetPlural: string;
  generatedClipSingular: string;
  generatedClipPlural: string;
  folderSingular: string;
  folderPlural: string;
  sequenceSingular: string;
  sequencePlural: string;
};
```

Add matching defaults to `DEFAULT_STUDIO_COPY.common`:

```ts
mediaAssetSingular: 'media asset',
mediaAssetPlural: 'media assets',
generatedClipSingular: 'generated clip',
generatedClipPlural: 'generated clips',
folderSingular: 'folder',
folderPlural: 'folders',
sequenceSingular: 'sequence',
sequencePlural: 'sequences',
```

Add the same keys under `workspace.studio.common` in `frontend/messages/en.json`, `frontend/messages/fr.json`, and `frontend/messages/es.json`.

- [x] **Step 4: Add reusable count helper**

In `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`, export:

```ts
export function formatStudioCountLabel(
  count: number,
  singular: string,
  plural: string
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
```

- [x] **Step 5: Replace hardcoded Project media bulk labels**

In `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts`, replace the local `countLabel` helper with:

```ts
import { formatStudioCountLabel, type StudioCopy } from '../../_lib/studio-copy';
```

Then replace:

```ts
countLabel(assetsToDelete.length, 'media asset', 'media assets')
```

with:

```ts
formatStudioCountLabel(
  assetsToDelete.length,
  studioCommonCopy.mediaAssetSingular,
  studioCommonCopy.mediaAssetPlural
)
```

Replace:

```ts
countLabel(nodesToDelete.length, 'generated clip', 'generated clips')
```

with:

```ts
formatStudioCountLabel(
  nodesToDelete.length,
  studioCommonCopy.generatedClipSingular,
  studioCommonCopy.generatedClipPlural
)
```

Replace:

```ts
countLabel(foldersToDelete.length, 'folder', 'folders')
```

with:

```ts
formatStudioCountLabel(
  foldersToDelete.length,
  studioCommonCopy.folderSingular,
  studioCommonCopy.folderPlural
)
```

If `useWorkspaceProjectMediaActions` does not already receive `studioCommonCopy`, add it to the hook params as:

```ts
studioCommonCopy: StudioCopy['common'];
```

and pass `studioCopy.common` from `WorkspacePage.client.tsx`.

- [x] **Step 6: Replace sequence plural string building**

In `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceSequenceActions.ts`, replace:

```ts
`${deleteResult.deletedSequences.length} ${studioProjectMediaCopy.sequenceName.replace(/\s*\{index\}/g, '').trim().toLowerCase()}s`
```

with:

```ts
formatStudioCountLabel(
  deleteResult.deletedSequences.length,
  studioCommonCopy.sequenceSingular,
  studioCommonCopy.sequencePlural
)
```

If the hook does not receive `studioCommonCopy`, add:

```ts
studioCommonCopy: StudioCopy['common'];
```

and pass `studioCopy.common` from `WorkspacePage.client.tsx`.

- [x] **Step 7: Remove the unused legacy Node library sidebar**

Confirm it is unused:

```bash
rg -n "NodeLibrarySidebar" "frontend/app/(core)/(workspace)/app/studio" tests
```

Expected before deletion: only the component file itself or documentation references.

Delete:

```bash
rm "frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeLibrarySidebar.tsx"
```

Then update `docs/engineering/studio-editor-architecture.md` ownership map from:

```txt
- `_components/NodeLibrarySidebar.tsx`: Canvas-only block/template library.
```

to:

```txt
- `_components/canvas/CanvasFloatingToolbar.tsx`: Canvas-only creation toolbar, block menus, template menus, and canvas undo/redo controls.
```

Update `frontend/app/(core)/(workspace)/app/studio/AGENTS.md` if it references `NodeLibrarySidebar`.

- [x] **Step 8: Verify localization contracts**

Run:

```bash
npm --prefix frontend exec tsx -- --tsconfig frontend/tsconfig.json --test tests/studio-localization-contract.test.ts
```

Expected: PASS.

- [x] **Step 9: Verify Studio architecture contracts**

Run:

```bash
npm run test:editor
```

Expected: PASS.

- [x] **Step 10: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json docs/engineering/studio-editor-architecture.md tests/studio-localization-contract.test.ts tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "fix: complete studio localized copy coverage"
```

---

## Task 3: Localize Generated Canvas Template Content

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/registry.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/product-ad.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/variant-base.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/cinematic-scene.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasTemplateActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspacePersistenceEffects.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`
- Test: `tests/studio-localization-contract.test.ts`

- [x] **Step 1: Add failing tests for localized template creation**

Append to `tests/studio-localization-contract.test.ts`:

```ts
test('Studio starter templates can be created with localized generated canvas text', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary);

  const template = createStarterWorkspaceTemplate('cinematic-scene', frCopy.canvas.nodes);
  const titles = template.nodes.map((node) => node.data.title);
  const subtitles = template.nodes.map((node) => node.data.subtitle);

  assert.ok(titles.includes(frCopy.canvas.nodes.templateCameraMovement));
  assert.ok(subtitles.includes(frCopy.canvas.nodes.templateFinalFrame));
  assert.ok(!titles.includes('Camera Language'));
  assert.ok(!subtitles.includes('Final Frame'));
});
```

Before running this test, add these keys to the `StudioCopy['canvas']['nodes']` default and locale dictionaries:

```ts
templateHeroReveal: string;
templateMacroDetails: string;
templateWideEstablishing: string;
templateCharacterReveal: string;
templateActionInsert: string;
templateFinalFrame: string;
templateTrailerEstablish: string;
templateTrailerReveal: string;
```

- [x] **Step 2: Run the failing template localization test**

Run:

```bash
npm --prefix frontend exec tsx -- --tsconfig frontend/tsconfig.json --test tests/studio-localization-contract.test.ts -t "localized generated canvas text"
```

Expected: FAIL because `createStarterWorkspaceTemplate` currently does not accept localized canvas node copy.

- [x] **Step 3: Add localized template creation context**

In `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/registry.ts`, change:

```ts
type WorkspaceTemplateBuilder = (summary: WorkspaceTemplateSummary) => WorkspaceTemplate;
```

to:

```ts
import type { StudioCopy } from '../../../../_lib/studio-copy';

export type WorkspaceTemplateBuildCopy = StudioCopy['canvas']['nodes'];
type WorkspaceTemplateBuilder = (summary: WorkspaceTemplateSummary, copy?: WorkspaceTemplateBuildCopy) => WorkspaceTemplate;
```

Then change:

```ts
export function createStarterWorkspaceTemplate(templateId: WorkspaceTemplateId): WorkspaceTemplate {
  const summary = requireWorkspaceTemplateSummary(templateId);
  const builder = WORKSPACE_TEMPLATE_REGISTRY[summary.id] ?? WORKSPACE_TEMPLATE_REGISTRY['product-ad'];
  return builder(summary);
}
```

to:

```ts
export function createStarterWorkspaceTemplate(
  templateId: WorkspaceTemplateId,
  copy?: WorkspaceTemplateBuildCopy
): WorkspaceTemplate {
  const summary = requireWorkspaceTemplateSummary(templateId);
  const builder = WORKSPACE_TEMPLATE_REGISTRY[summary.id] ?? WORKSPACE_TEMPLATE_REGISTRY['product-ad'];
  return builder(summary, copy);
}
```

- [x] **Step 4: Localize product template defaults**

In `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/product-ad.ts`, change:

```ts
export function createProductAdWorkspaceTemplate(): WorkspaceTemplate {
```

to:

```ts
import type { WorkspaceTemplateBuildCopy } from './registry';

function productAdCopy(copy?: WorkspaceTemplateBuildCopy) {
  return {
    productImage: copy?.templateProductImage ?? 'Product Image',
    styleReference: copy?.templateStyleReference ?? 'Style Reference',
    cameraMovement: copy?.templateCameraMovement ?? 'Camera Movement',
    audioReference: copy?.templateAudioReference ?? 'Audio Reference',
    heroReveal: copy?.templateHeroReveal ?? 'Hero Reveal',
    macroDetails: copy?.templateMacroDetails ?? 'Macro Details',
    finalPackshot: copy?.templateFinalPackshot ?? 'Final Packshot',
    outputName: copy?.templateGeneratedOutput ?? 'Generated Output',
  };
}

export function createProductAdWorkspaceTemplate(copy?: WorkspaceTemplateBuildCopy): WorkspaceTemplate {
  const localized = productAdCopy(copy);
```

Then replace visible seed strings such as:

```ts
title: 'Product Image'
subtitle: 'Hero Reveal'
shot: shotSettings({ outputName: 'Hero Reveal', ... })
```

with:

```ts
title: localized.productImage
subtitle: localized.heroReveal
shot: shotSettings({ outputName: localized.heroReveal, ... })
```

Keep filenames like `chrono_watch.png` and `ambient_moody.mp3` unchanged.

- [x] **Step 5: Thread copy through variant templates**

In `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/variant-base.ts`, change:

```ts
export function createVariantWorkspaceTemplate(templateId: WorkspaceTemplateId, summary: WorkspaceTemplateSummary, config: WorkspaceTemplateVariantConfig): WorkspaceTemplate {
  const base = createProductAdWorkspaceTemplate();
```

to:

```ts
import type { WorkspaceTemplateBuildCopy } from './registry';

export function createVariantWorkspaceTemplate(
  templateId: WorkspaceTemplateId,
  summary: WorkspaceTemplateSummary,
  config: WorkspaceTemplateVariantConfig,
  copy?: WorkspaceTemplateBuildCopy
): WorkspaceTemplate {
  const base = createProductAdWorkspaceTemplate(copy);
```

In `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/cinematic-scene.ts`, change:

```ts
export function createCinematicSceneWorkspaceTemplate(summary: WorkspaceTemplateSummary): WorkspaceTemplate {
  return createVariantWorkspaceTemplate('cinematic-scene', summary, CINEMATIC_SCENE_TEMPLATE_CONFIG);
}
```

to:

```ts
import type { WorkspaceTemplateBuildCopy } from './registry';

export function createCinematicSceneWorkspaceTemplate(
  summary: WorkspaceTemplateSummary,
  copy?: WorkspaceTemplateBuildCopy
): WorkspaceTemplate {
  return createVariantWorkspaceTemplate('cinematic-scene', summary, {
    ...CINEMATIC_SCENE_TEMPLATE_CONFIG,
    styleTitle: copy?.templateCameraMovement ?? CINEMATIC_SCENE_TEMPLATE_CONFIG.styleTitle,
    shotSubtitles: [
      copy?.templateWideEstablishing ?? CINEMATIC_SCENE_TEMPLATE_CONFIG.shotSubtitles[0],
      copy?.templateCharacterReveal ?? CINEMATIC_SCENE_TEMPLATE_CONFIG.shotSubtitles[1],
      copy?.templateActionInsert ?? CINEMATIC_SCENE_TEMPLATE_CONFIG.shotSubtitles[2],
      copy?.templateFinalFrame ?? CINEMATIC_SCENE_TEMPLATE_CONFIG.shotSubtitles[3],
    ],
    timelineTitles: [
      copy?.templateTrailerEstablish ?? CINEMATIC_SCENE_TEMPLATE_CONFIG.timelineTitles[0],
      copy?.templateTrailerReveal ?? CINEMATIC_SCENE_TEMPLATE_CONFIG.timelineTitles[1],
    ],
  }, copy);
}
```

Apply the same `copy?: WorkspaceTemplateBuildCopy` signature to the other template builder exports that use `createVariantWorkspaceTemplate`.

- [x] **Step 6: Pass localized copy from workspace callers**

In `WorkspacePage.client.tsx`, replace:

```ts
const defaultTemplate = useMemo(() => createStarterWorkspaceTemplate('product-ad'), []);
```

with:

```ts
const defaultTemplate = useMemo(
  () => createStarterWorkspaceTemplate('product-ad', studioCopy.canvas.nodes),
  [studioCopy.canvas.nodes]
);
```

In `useWorkspaceCanvasTemplateActions.ts`, add `studioCanvasNodeCopy: StudioCopy['canvas']['nodes']` to hook params and call:

```ts
const template = createStarterWorkspaceTemplate(templateId, studioCanvasNodeCopy);
```

In `useWorkspacePersistenceEffects.ts`, add/preserve a localized copy param and call:

```ts
const template = createStarterWorkspaceTemplate(project.canvasTemplateId ?? 'product-ad', studioCanvasNodeCopy);
```

- [x] **Step 7: Verify tests**

Run:

```bash
npm --prefix frontend exec tsx -- --tsconfig frontend/tsconfig.json --test tests/studio-localization-contract.test.ts
npm run test:editor
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/studio-localization-contract.test.ts tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "fix: localize studio template generated content"
```

---

## Task 4: Light And Dark Theme Parity QA

**Files:**
- Modify: `tests/e2e/editor/editor-smoke.spec.ts`
- Modify CSS modules listed in File Structure
- Modify: `frontend/app/(core)/(workspace)/app/studio/projects/StudioProjectsPage.client.tsx` only if theme wiring is incomplete
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx` only if shell theme wiring is incomplete

- [x] **Step 1: Add E2E contrast smoke for Projects and Workspace**

In `tests/e2e/editor/editor-smoke.spec.ts`, add:

```ts
test('Studio projects and workspace keep readable light and dark surfaces', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await mockStudioApis(page);

  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-studio-theme]')).toHaveAttribute('data-studio-theme', /dark|light/);
  await page.getByRole('button', { name: /mode sombre|dark mode|modo oscuro|mode clair|light mode|modo claro/i }).click();

  const projectsContrast = await page.locator('[data-studio-theme]').evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      bg: styles.backgroundColor,
      color: styles.color,
    };
  });
  expect(projectsContrast.bg).not.toEqual(projectsContrast.color);

  await page.goto('/app/studio/workspace/project_e2e_theme', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Visionneuse|Viewer|Visor/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Importer des medias|Importer des médias|Import media|Importar medios/i })).toBeVisible();

  const inspectorTextColor = await page.locator('aside').last().evaluate((element) => getComputedStyle(element).color);
  expect(inspectorTextColor).toMatch(/rgb\\(/);
  assertNoEditorClientErrors(errors);
});
```

If `mockStudioApis` is not exported, extract the existing Studio API route mocking helper from the same file into a local helper before this test.

- [x] **Step 2: Run the failing/passing theme smoke**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "readable light and dark"
```

Expected before CSS fixes: FAIL if any selector renders unreadable or missing.

- [x] **Step 3: Replace hardcoded dark surfaces with theme tokens**

Search:

```bash
rg -n "#0|#1|rgba\\(0|rgba\\(2|rgba\\(5|rgb\\(0|background:.*050|color:.*f8fafc" "frontend/app/(core)/(workspace)/app/studio/workspace/_styles" "frontend/app/(core)/(workspace)/app/studio/projects/studio-projects.module.css"
```

For each visible control, replace direct dark values with existing tokens:

```css
background: var(--studio-surface);
color: var(--studio-text);
border-color: var(--studio-border);
box-shadow: 0 18px 46px var(--studio-node-shadow);
```

For Projects CSS, use:

```css
background: var(--studio-project-surface);
color: var(--studio-project-text);
border-color: var(--studio-project-border);
```

- [x] **Step 4: Manually verify in Browser**

Open:

```txt
http://localhost:3000/app/studio/projects
http://localhost:3000/app/studio/workspace/project_630fb2af-524c-4ca6-a8d2-22687884b106
```

Check these interactions in both light and dark:

```txt
Projects: recent project menu, rename dialog, delete dialog, template cards, create button.
Workspace Viewer: project media sidebar, folder dialog, inspector, viewer controls, timeline controls.
Workspace Canvas: toolbar popovers, canvas map, node cards, handles, resize controls.
Export: export dialog, readiness list, failed/queued/completed states.
```

- [x] **Step 5: Run checks**

```bash
npm --prefix frontend run lint
npm run test:editor
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "readable light and dark"
git diff --check
```

Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio tests/e2e/editor/editor-smoke.spec.ts
git commit -m "fix: harden studio light and dark appearance"
```

---

## Task 5: Canvas Toolbar, Selection, And Undo/Redo Hardening

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-toolbar.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas.module.css`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`
- Test: `tests/e2e/editor/editor-smoke.spec.ts`

- [x] **Step 1: Add browser-level canvas toolbar test**

In `tests/e2e/editor/editor-smoke.spec.ts`, add:

```ts
test('Studio canvas toolbar exposes grouped tools and canvas undo redo shortcuts', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await openFreshEditorWorkspace(page);

  await page.getByRole('button', { name: /Canevas|Canvas/i }).click();
  await expect(page.getByRole('button', { name: /Annuler|Undo/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Retablir|Rétablir|Redo/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Image/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Video|Vidéo/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Audio/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Texte|Text/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /templates|modeles|modèles|plantillas/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^\\+$/ })).toHaveCount(0);

  await page.getByRole('button', { name: /selection|sélection|select/i }).click();
  await page.mouse.move(300, 220);
  await page.mouse.down();
  await page.mouse.move(760, 520);
  await expect(page.locator('[data-canvas-selection-box="true"]')).toBeVisible();
  await page.mouse.up();

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
  assertNoEditorClientErrors(errors);
});
```

If the selection rectangle does not expose a test attribute, add `data-canvas-selection-box="true"` to the React Flow selection rectangle wrapper or custom overlay.

- [x] **Step 2: Run the failing toolbar test**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "canvas toolbar exposes grouped tools"
```

Expected: FAIL if the plus button still exists, the selection box lacks an attribute, or shortcuts do not fire.

- [x] **Step 3: Ensure selection rectangle is visible and testable**

In `WorkspaceCanvas.client.tsx`, add a visible attribute through React Flow configuration or overlay. If using React Flow built-in selection, add CSS against the built-in class:

```css
.reactFlowCanvas :global(.react-flow__selection) {
  border: 1px dashed rgba(96, 165, 250, 0.95);
  background: rgba(96, 165, 250, 0.12);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12);
}
```

If a custom overlay is already used, render:

```tsx
<div
  data-canvas-selection-box="true"
  className={styles.canvasSelectionBox}
  style={selectionBoxStyle}
/>
```

- [x] **Step 4: Verify canvas undo/redo keyboard scope**

In `WorkspaceCanvas.client.tsx`, keep this rule:

```ts
if (isEditableCanvasShortcutTarget(event.target)) return;
```

Ensure the handler uses:

```ts
const isUndo = shortcutKey && event.key.toLowerCase() === 'z' && !event.shiftKey;
const isRedo = shortcutKey && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey));
```

Then call:

```ts
event.preventDefault();
if (isRedo && canRedoCanvas) onRedoCanvas();
if (isUndo && canUndoCanvas) onUndoCanvas();
```

- [x] **Step 5: Run checks**

```bash
npm run test:editor
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "canvas toolbar exposes grouped tools"
npm --prefix frontend run lint
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio tests/e2e/editor/editor-smoke.spec.ts tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "fix: harden studio canvas toolbar interactions"
```

---

## Task 6: Timeline Ripple Trim And Duration Rules

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-resize-editing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceTimelineClipActions.ts`
- Test: `tests/maxvideoai-editor-timeline-interaction.test.ts`
- Test: `tests/e2e/editor/editor-timeline.spec.ts`

- [x] **Step 1: Add pure tests for adjacent-only ripple trim**

Append to `tests/maxvideoai-editor-timeline-interaction.test.ts`:

```ts
test('timeline resize ripples only clips that are directly attached to the trimmed end', async () => {
  const { resizeWorkspaceTimelineItem } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing'
  );

  const base = [
    timelineItem({ id: 'a', startSec: 0, durationSec: 8, sourceDurationSec: 12 }),
    timelineItem({ id: 'b', outputNodeId: 'node-b', startSec: 8, durationSec: 5, sourceDurationSec: 8 }),
    timelineItem({ id: 'c', outputNodeId: 'node-c', startSec: 18, durationSec: 5, sourceDurationSec: 8 }),
  ];

  const shortened = resizeWorkspaceTimelineItem({
    items: base,
    itemId: 'a',
    edge: 'end',
    targetDurationSec: 5,
    ripple: true,
  });

  assert.equal(shortened.find((item) => item.id === 'a')?.durationSec, 5);
  assert.equal(shortened.find((item) => item.id === 'b')?.startSec, 5);
  assert.equal(shortened.find((item) => item.id === 'c')?.startSec, 18);
});

test('timeline resize can expand a clip into available gap without pulling later clips', async () => {
  const { resizeWorkspaceTimelineItem } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing'
  );

  const base = [
    timelineItem({ id: 'a', startSec: 0, durationSec: 5, sourceDurationSec: 12 }),
    timelineItem({ id: 'b', outputNodeId: 'node-b', startSec: 8, durationSec: 5, sourceDurationSec: 8 }),
  ];

  const expanded = resizeWorkspaceTimelineItem({
    items: base,
    itemId: 'a',
    edge: 'end',
    targetDurationSec: 7,
    ripple: true,
  });

  assert.equal(expanded.find((item) => item.id === 'a')?.durationSec, 7);
  assert.equal(expanded.find((item) => item.id === 'b')?.startSec, 8);
});
```

If `resizeWorkspaceTimelineItem` does not currently accept `targetDurationSec` and `ripple`, adapt the test to the actual exported signature and keep the two expected assertions unchanged.

- [x] **Step 2: Run the failing pure tests**

Run:

```bash
npm --prefix frontend exec tsx -- --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-timeline-interaction.test.ts -t "timeline resize"
```

Expected: FAIL if ripple trim moves clips across gaps or cannot expand.

- [x] **Step 3: Implement adjacent-only ripple**

In `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-resize-editing.ts`, implement the rule:

```ts
function directlyAttachedTrackItemIds(params: {
  items: WorkspaceTimelineItem[];
  track: WorkspaceTimelineTrack;
  oldEndSec: number;
  ignoredIds: Set<string>;
}): Set<string> {
  const attached = new Set<string>();
  let cursor = snapTimelineValue(params.oldEndSec);

  const ordered = params.items
    .filter((item) => item.track === params.track && !params.ignoredIds.has(item.id))
    .sort((left, right) => left.startSec - right.startSec);

  ordered.forEach((item) => {
    if (Math.abs(item.startSec - cursor) > 1 / 48) return;
    attached.add(item.id);
    cursor = snapTimelineValue(item.startSec + item.durationSec);
  });

  return attached;
}
```

When `ripple` is true and the resize shortens the clip, shift only `attached` ids by the negative duration delta. When the resize expands, do not shift later clips; rely on existing collision/source-duration constraints.

- [x] **Step 4: Keep free movement unchanged**

In `useWorkspaceTimelineClipActions.ts`, verify that regular drag/move calls still call positioning helpers without ripple:

```ts
positionWorkspaceTimelineItem(...);
positionWorkspaceTimelineItems(...);
```

Do not pass ripple into move operations.

- [x] **Step 5: Add E2E regression for trim gap**

In `tests/e2e/editor/editor-timeline.spec.ts`, add a test that trims a clip from 12s to 6s and asserts the adjacent clip follows while a clip after a gap keeps its left position. Use existing timeline helpers in that file for clip locating and drag handles.

Expected visible assertions:

```ts
await expect(page.locator('[data-timeline-item-id="camera-language"]')).toContainText('0:06');
await expect(page.locator('[data-timeline-item-id="after-gap"]')).toHaveAttribute('data-start-sec', '18');
```

If timeline items do not expose `data-start-sec`, add it to the timeline clip element in `TimelineClip.tsx`.

- [x] **Step 6: Run checks**

```bash
npm --prefix frontend exec tsx -- --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-timeline-interaction.test.ts
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-timeline.spec.ts -g "trim"
npm run test:editor
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace tests/maxvideoai-editor-timeline-interaction.test.ts tests/e2e/editor/editor-timeline.spec.ts
git commit -m "fix: constrain studio timeline ripple trim"
```

---

## Task 7: Project Media Multi-Select, Bulk Delete, And Scroll Behavior

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useProjectMediaController.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineProjectSidebar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/media.module.css`
- Test: `tests/e2e/editor/editor-library.spec.ts`
- Test: `tests/maxvideoai-editor-project-media-timeline.test.ts`

- [x] **Step 1: Add E2E test for media card scroll sizing**

In `tests/e2e/editor/editor-library.spec.ts`, add:

```ts
test('Project media grid scrolls without shrinking thumbnails', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await openFreshEditorWorkspace(page);
  await page.getByRole('button', { name: /Visionneuse|Viewer/i }).click();

  const grid = page.locator('[data-project-media-grid="true"]');
  await expect(grid).toBeVisible();
  const firstCard = grid.locator('[data-project-media-card="true"]').first();
  const firstBox = await firstCard.boundingBox();

  await grid.evaluate((element) => {
    for (let index = 0; index < 40; index += 1) {
      const clone = element.querySelector('[data-project-media-card="true"]')?.cloneNode(true);
      if (clone) element.appendChild(clone);
    }
  });

  await grid.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const afterBox = await firstCard.boundingBox();
  expect(Math.round(afterBox?.width ?? 0)).toBe(Math.round(firstBox?.width ?? 0));
  assertNoEditorClientErrors(errors);
});
```

- [x] **Step 2: Add E2E test for standard multi-select and bulk delete**

In the same file, add:

```ts
test('Project media supports range selection and bulk delete confirmation', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await openFreshEditorWorkspace(page);
  await page.getByRole('button', { name: /Visionneuse|Viewer/i }).click();

  const cards = page.locator('[data-project-media-card="true"]');
  await cards.nth(0).click();
  await cards.nth(2).click({ modifiers: ['Shift'] });
  await expect(cards.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(cards.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(cards.nth(2)).toHaveAttribute('aria-selected', 'true');

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toMatch(/delete|supprimer|eliminar/i);
    await dialog.accept();
  });
  await page.getByRole('button', { name: /Supprimer|Delete|Eliminar/i }).click();
  assertNoEditorClientErrors(errors);
});
```

- [x] **Step 3: Run failing media tests**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-library.spec.ts -g "Project media"
```

Expected: FAIL if cards lack stable data attributes, `aria-selected`, or scroll sizing.

- [x] **Step 4: Add stable card/grid attributes and selection semantics**

In `TimelineProjectSidebar.tsx`, add to the project media grid:

```tsx
<div
  className={styles.projectMediaGrid}
  data-project-media-grid="true"
  role="listbox"
  aria-multiselectable="true"
>
```

For each card root, add:

```tsx
data-project-media-card="true"
aria-selected={isSelected}
```

For keyboard selection, add:

```tsx
onKeyDown={(event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  onClick(event);
}}
```

- [x] **Step 5: Lock grid scroll sizing**

In `media.module.css`, make the grid scroll without shrinking cards:

```css
.projectMediaGrid {
  align-content: start;
  grid-auto-rows: minmax(118px, auto);
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.projectMediaGrid::-webkit-scrollbar {
  display: none;
}

.projectMediaCard {
  min-height: 118px;
  flex-shrink: 0;
}
```

Keep the existing thumbnail/card dimensions if they already differ from `118px`; the invariant is fixed card size plus internal scroll.

- [x] **Step 6: Run checks**

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-library.spec.ts -g "Project media"
npm run test:editor
npm --prefix frontend run lint
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace tests/e2e/editor/editor-library.spec.ts tests/maxvideoai-editor-project-media-timeline.test.ts
git commit -m "fix: harden studio project media selection"
```

---

## Task 8: Quiet Unauthorized And API Failure States

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Modify: `frontend/app/(core)/(workspace)/app/studio/projects/StudioProjectsPage.client.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspacePersistenceEffects.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts`
- Test: `tests/e2e/editor/editor-smoke.spec.ts`

- [x] **Step 1: Add E2E test for unauthenticated local Studio**

In `tests/e2e/editor/editor-smoke.spec.ts`, add:

```ts
test('Studio handles unauthenticated API responses without crashing', async ({ page }) => {
  const errors = trackEditorClientErrors(page, {
    allowNetworkStatuses: [401],
  });

  await page.route('**/api/studio/**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'UNAUTHORIZED' }),
    });
  });

  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Studio/i })).toBeVisible();
  await expect(page.getByText(/local|connexion|sign in|sesion|sesión/i)).toBeVisible();

  await page.goto('/app/studio/workspace/project_unauthorized', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Canevas|Canvas/i })).toBeVisible();
  assertNoEditorClientErrors(errors);
});
```

If `trackEditorClientErrors` does not accept `allowNetworkStatuses`, extend it in `tests/e2e/editor/editor-helpers.ts` to ignore expected resource failures:

```ts
export function trackEditorClientErrors(
  page: Page,
  options: { allowNetworkStatuses?: number[] } = {}
) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (options.allowNetworkStatuses?.some((status) => text.includes(String(status)))) return;
    errors.push(text);
  });
  return errors;
}
```

- [x] **Step 2: Run the failing unauthorized test**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "unauthenticated API"
```

Expected: FAIL if no visible local/offline/sign-in state exists.

- [x] **Step 3: Add copy for local fallback and sign-in state**

Add to `StudioCopy['notices']`:

```ts
studioApiUnauthorized: string;
studioApiUnavailable: string;
studioLocalFallbackActive: string;
```

Add English defaults:

```ts
studioApiUnauthorized: 'Sign in to sync Studio projects. Local draft mode is active.',
studioApiUnavailable: 'Studio sync is temporarily unavailable. Local draft mode is active.',
studioLocalFallbackActive: 'Local draft mode active.',
```

Add French and Spanish translations in `frontend/messages/fr.json` and `frontend/messages/es.json`.

- [x] **Step 4: Normalize expected API failures**

In `workspace-api-persistence.ts`, create:

```ts
export type StudioApiSyncStatus = 'ready' | 'unauthorized' | 'unavailable' | 'error';

export function studioApiSyncStatusFromResponse(response: Response): StudioApiSyncStatus {
  if (response.status === 401) return 'unauthorized';
  if (response.status === 503) return 'unavailable';
  if (!response.ok) return 'error';
  return 'ready';
}
```

Use this helper in Studio project read/list/save paths before throwing generic errors. Return a structured status to callers that already support local fallback.

- [x] **Step 5: Surface quiet UI notices**

In `StudioProjectsPage.client.tsx` and `useWorkspacePersistenceEffects.ts`, when the status is `unauthorized` or `unavailable`, set visible copy:

```ts
const fallbackNotice =
  status === 'unauthorized'
    ? studioCopy.notices.studioApiUnauthorized
    : studioCopy.notices.studioApiUnavailable;
```

Render it in existing notice/status areas. Do not call `console.error` for expected 401/503 responses.

- [x] **Step 6: Run checks**

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "unauthenticated API"
npm run test:editor
npm --prefix frontend run lint
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/e2e/editor/editor-smoke.spec.ts tests/e2e/editor/editor-helpers.ts
git commit -m "fix: quiet studio api fallback states"
```

---

## Task 9: Upload, Import, And Export Failure QA

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryModal.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceProjectMediaLibraryModal.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceExportDialog.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useExportController.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify messages: `frontend/messages/{en,fr,es}.json`
- Test: `tests/e2e/editor/editor-library.spec.ts`
- Test: `tests/e2e/editor/editor-timeline.spec.ts`

- [x] **Step 1: Add E2E test for project media upload failure**

In `tests/e2e/editor/editor-library.spec.ts`, add:

```ts
test('Project media import shows localized upload failure and retry path', async ({ page }) => {
  const errors = trackEditorClientErrors(page, { allowNetworkStatuses: [500] });
  await openFreshEditorWorkspace(page);
  await page.route('**/api/media-library/upload**', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'UPLOAD_FAILED' }) });
  });

  await page.getByRole('button', { name: /Visionneuse|Viewer/i }).click();
  await page.getByRole('button', { name: /Importer des medias|Importer des médias|Import media/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/failed|echec|échec|fallo/i)).toBeVisible();
  assertNoEditorClientErrors(errors);
});
```

- [x] **Step 2: Add E2E test for export failed and retry state**

In `tests/e2e/editor/editor-timeline.spec.ts`, add:

```ts
test('Server export failure stays localized and retryable', async ({ page }) => {
  const errors = trackEditorClientErrors(page, { allowNetworkStatuses: [500] });
  await openFreshEditorWorkspace(page);
  await page.route('**/api/studio/timeline-exports/estimate', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, estimate: { credits: 1 }, quota: { available: true } }) });
  });
  await page.route('**/api/studio/timeline-exports', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'EXPORT_CREATE_FAILED' }) });
  });

  await page.getByRole('button', { name: /Exporter|Export/i }).click();
  await page.getByRole('button', { name: /Export video|Exporter la video|Exporter la vidéo/i }).click();
  await expect(page.getByText(/failed|echec|échec|fallo/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /retry|reessayer|réessayer|reintentar/i })).toBeVisible();
  assertNoEditorClientErrors(errors);
});
```

- [x] **Step 3: Run the failing failure-state tests**

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-library.spec.ts -g "upload failure"
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-timeline.spec.ts -g "export failure"
```

Expected: FAIL if messages are not visible/localized or retry is missing.

- [x] **Step 4: Normalize modal failure rendering**

In both upload modals, ensure the error path renders:

```tsx
{uploadError ? (
  <p role="alert" className={styles.assetBrowserNotice}>
    {uploadError}
  </p>
) : null}
```

In `WorkspaceExportDialog.tsx`, ensure failed active jobs render:

```tsx
{activeExportJob?.status === 'failed' ? (
  <p role="alert" className={styles.exportFeedback}>
    {exportVideoFeedback ?? activeExportJob.message ?? copy.failed}
  </p>
) : null}
```

- [x] **Step 5: Run checks**

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-library.spec.ts -g "upload failure"
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-timeline.spec.ts -g "export failure"
npm --prefix frontend run lint
npm run test:editor
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/e2e/editor/editor-library.spec.ts tests/e2e/editor/editor-timeline.spec.ts
git commit -m "fix: harden studio import and export failures"
```

---

## Task 10: Final QA Matrix And Cleanup

**Files:**
- Modify: `docs/superpowers/plans/2026-06-12-studio-completion-hardening.md`
- Modify: `docs/engineering/studio-editor-architecture.md` only if the final implementation changed ownership boundaries
- No product code unless validation reveals a defect

- [x] **Step 1: Run focused checks**

```bash
npm run test:editor
npm --prefix frontend run lint
cd frontend && npm exec tsc -- --noEmit -p tsconfig.json
cd ..
git diff --check
```

Expected: all pass.

- [x] **Step 2: Run editor QA**

Run:

```bash
npm run qa:editor
```

Expected: PASS. If this command requires an already running dev server, start it on port 3000 and rerun:

```bash
npm --prefix frontend run dev -- --port 3000
npm run qa:editor
```

- [x] **Step 3: Browser smoke checklist**

Open:

```txt
http://localhost:3000/app/studio/projects
http://localhost:3000/app/studio/workspace/project_630fb2af-524c-4ca6-a8d2-22687884b106
```

Verify:

```txt
Projects light mode: create project, template row, recent menu, rename, duplicate, delete confirmation.
Projects dark mode: same flows, no unreadable white/dark text.
Workspace Canvas light/dark: toolbar menus, selection rectangle, delete nodes, undo/redo, template apply.
Workspace Viewer light/dark: project media scroll, multi-select, bulk delete, folder dialog, sequence inspector.
Timeline: default tracks one video plus two audio, trim shorter, trim longer, move clips right leaving gaps.
Import: library opens, upload failure and unauthorized states are visible.
Export: estimate, failure, retry, queued, completed states are readable.
Locale: French and Spanish pages show no obvious English UI except filenames, model names, and brand/product names.
```

- [x] **Step 4: Remove local QA artifacts**

Check:

```bash
git status --short
```

Remove or keep untracked QA artifacts outside git. For current known artifacts:

```bash
rm -f background-removal-desktop-after-checkerboard-fix.png background-removal-mobile-after-checkerboard-fix.png
```

Do not remove user files without confirming they are QA artifacts.

- [x] **Step 5: Update this plan checklist**

In `docs/superpowers/plans/2026-06-12-studio-completion-hardening.md`, mark completed tasks with `[x]` only after the implementation and verification command passed.

- [x] **Step 6: Final commit**

```bash
git add docs/superpowers/plans/2026-06-12-studio-completion-hardening.md docs/engineering/studio-editor-architecture.md
git commit -m "docs: finalize studio completion QA plan"
```

If no docs changed in this task, skip the final commit and report that the worktree is clean.

---

## Execution Order

1. Task 1 must run first because full typecheck is currently blocked.
2. Tasks 2 and 3 should run before visual QA so text and generated content are stable.
3. Task 4 should run before interaction polish because theme token issues can hide interaction states.
4. Tasks 5, 6, and 7 can run independently after Tasks 1-4.
5. Task 8 should run before Task 9 because import/export tests reuse API failure handling.
6. Task 10 is the final verification gate.

## Self-Review

- Spec coverage: The plan covers typecheck, i18n, generated templates, light/dark mode, canvas tools and selection, timeline ripple/resize, Project media scrolling/multi-select/bulk delete, unauthorized API states, upload/export failures, and final QA.
- Placeholder scan: Each task names files, tests, commands, and expected output.
- Type consistency: New copy keys live under `StudioCopy['common']`, `StudioCopy['notices']`, or `StudioCopy['canvas']['nodes']`; template localization uses `WorkspaceTemplateBuildCopy`; Project media and sequence actions consume `studioCommonCopy`.
