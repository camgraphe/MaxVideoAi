# Studio Localization And Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize the Studio projects and workspace surfaces through the existing MaxVideoAI i18n stack, then add a persistent light appearance mode for the Studio editor without breaking the current dark editor.

**Architecture:** Keep Studio route-local. Use the existing Core `I18nProvider` and `frontend/messages/{en,fr,es}.json` dictionaries, then pass typed copy through Studio-owned props/hooks instead of importing global UI copy into domain helpers. Use inherited CSS custom properties on the Studio shell for dark/light tokens, so surface CSS modules can migrate incrementally without a global theme rewrite.

**Tech Stack:** Next.js App Router, React client components, `next-intl`, existing `useI18n`, CSS modules, Node test runner, Playwright editor tests.

---

## File Structure

- Create: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
  - Owns typed default Studio copy and helpers for formatting localized project dates and resolving dictionary copy.
- Create: `frontend/app/(core)/(workspace)/app/studio/_hooks/useStudioThemeMode.ts`
  - Owns Studio appearance preference, localStorage persistence, and system preference resolution.
- Modify: `frontend/messages/en.json`
  - Add `workspace.studio` copy namespace.
- Modify: `frontend/messages/fr.json`
  - Add French `workspace.studio` copy namespace.
- Modify: `frontend/messages/es.json`
  - Add Spanish `workspace.studio` copy namespace.
- Modify: `frontend/app/(core)/(workspace)/app/studio/projects/StudioProjectsPage.client.tsx`
  - Replace hardcoded user-facing copy with `useI18n` + `resolveStudioCopy`.
  - Use locale-aware date formatting.
  - Apply `data-studio-theme`.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`
  - Resolve Studio copy and Studio theme mode.
  - Pass copy/theme props to `WorkspaceEditorLayout`.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx`
  - Apply `data-studio-theme` and pass copy/theme controls to topbar, canvas, viewer, timeline, export, and sidebars as they are migrated.
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorTopbar.tsx`
  - Localize topbar labels and add appearance toggle.
- Modify progressively:
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceTimeline.tsx`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineProjectSidebar.tsx`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceExportDialog.tsx`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceVideoViewer.tsx`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-frame.tsx`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspace*Actions.ts`
  - Replace visible strings, notices, confirmations, aria labels, titles, and placeholders with typed copy.
- Modify CSS token entry points:
  - `frontend/app/(core)/(workspace)/app/studio/projects/studio-projects.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/maxvideoai-editor.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-nodes.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-toolbar.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/timeline.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/timeline-clips.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/viewer.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/media.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/inspector.module.css`
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/export.module.css`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`
  - Lock copy/theme boundaries.
- Test: `tests/studio-localization-contract.test.ts`
  - Assert required dictionary keys exist in `en`, `fr`, and `es`.
- Test: `tests/e2e/editor/editor-smoke.spec.ts`
  - Smoke localized Studio copy and light mode toggle.
- Test: `tests/e2e/editor/editor-timeline.spec.ts`
  - Keep existing timeline behavior stable under light mode.

---

## Task 1: Baseline Audit And Guard Rails

**Files:**
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`
- Modify: `tests/e2e/editor/editor-smoke.spec.ts`

- [ ] **Step 1: Write the failing architecture test for Studio i18n/theme ownership**

Add assertions near the existing Studio architecture section:

```ts
const studioCopyPath = join(root, 'frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts');
const studioThemeHookPath = join(root, 'frontend/app/(core)/(workspace)/app/studio/_hooks/useStudioThemeMode.ts');

test('MaxVideoAI Studio owns route-local copy and theme boundaries', () => {
  assert.ok(existsSync(studioCopyPath), 'Studio copy helpers should live route-local under app/studio/_lib');
  assert.ok(existsSync(studioThemeHookPath), 'Studio theme preference should live route-local under app/studio/_hooks');

  const projectsSource = readFileSync(studioProjectsPageClientPath, 'utf8');
  const workspaceSource = readFileSync(workspacePageClientPath, 'utf8');
  const layoutSource = readFileSync(workspaceEditorLayoutPath, 'utf8');
  const topbarSource = readFileSync(workspaceEditorTopbarPath, 'utf8');

  assert.match(projectsSource, /useI18n\(\)/, 'Studio projects should resolve localized copy from the existing app i18n provider');
  assert.match(workspaceSource, /resolveStudioCopy/, 'WorkspacePage should resolve Studio copy once and pass typed props down');
  assert.match(layoutSource, /data-studio-theme/, 'Workspace editor shell should scope light and dark theme through a Studio data attribute');
  assert.match(topbarSource, /studioCopy\.topbar/, 'Workspace topbar should render typed localized copy instead of inline English labels');
});
```

- [ ] **Step 2: Run the failing architecture test**

Run:

```bash
npm run test:editor
```

Expected: FAIL because `studio-copy.ts`, `useStudioThemeMode.ts`, and the wiring do not exist.

- [ ] **Step 3: Add a failing smoke test for light mode**

In `tests/e2e/editor/editor-smoke.spec.ts`, add a focused test:

```ts
test('Studio workspace can switch to light appearance', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  const shell = page.locator('[data-studio-theme]');
  await expect(shell).toHaveAttribute('data-studio-theme', 'dark');

  await page.getByRole('button', { name: 'Switch Studio to light mode' }).click();
  await expect(shell).toHaveAttribute('data-studio-theme', 'light');
  await expect(page.getByRole('button', { name: 'Switch Studio to dark mode' })).toBeVisible();

  assertNoEditorClientErrors(errors);
});
```

- [ ] **Step 4: Run the failing smoke test**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "Studio workspace can switch to light appearance"
```

Expected: FAIL because the theme attribute and toggle do not exist.

- [ ] **Step 5: Commit guard rails**

```bash
git add tests/maxvideoai-editor-workspace-architecture.test.ts tests/e2e/editor/editor-smoke.spec.ts
git commit -m "test: lock studio localization and theme boundaries"
```

---

## Task 2: Route-Local Studio Copy Helper

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Create: `tests/studio-localization-contract.test.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`

- [ ] **Step 1: Create the typed copy helper**

Add `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`:

```ts
import { localeRegions, type AppLocale } from '@/i18n/locales';
import type { Dictionary } from '@/lib/i18n/types';

export type StudioCopy = {
  projects: {
    metaTitle: string;
    heroBadge: string;
    title: string;
    subtitle: string;
    createTitle: string;
    createSubtitle: string;
    projectNameLabel: string;
    projectNamePlaceholder: string;
    canvasTemplateLabel: string;
    browseTemplates: string;
    createProject: string;
    creating: string;
    recentTitle: string;
    recentSubtitle: string;
    emptyRecent: string;
    viewAllProjects: string;
    rename: string;
    duplicate: string;
    delete: string;
    renameTitle: string;
    renameSubmit: string;
    deleteTitle: string;
    deleteBody: string;
    deleteConfirm: string;
    cancel: string;
    untitledProject: string;
    localDraft: string;
    customCanvas: string;
  };
  topbar: {
    productName: string;
    breadcrumbProjects: string;
    breadcrumbWorkspace: string;
    workspaceViewLabel: string;
    canvas: string;
    viewer: string;
    export: string;
    exportAria: string;
    mock: string;
    live: string;
    mockAria: string;
    switchToLight: string;
    switchToDark: string;
  };
  common: {
    secondsShort: string;
    itemSingular: string;
    itemPlural: string;
    folder: string;
    generatedClip: string;
  };
  notices: {
    canvasTemplateNotFound: string;
    projectMediaAssetNotFound: string;
    projectMediaFolderNotFound: string;
    generatedClipNotFound: string;
    unlockBeforeMoving: string;
    unlockBeforeCutting: string;
    unlockBeforeTrimming: string;
    unlockBeforeDeleting: string;
    selectedClipsUnlinked: string;
    selectedClipsLinked: string;
  };
};

export const DEFAULT_STUDIO_COPY: StudioCopy = {
  projects: {
    metaTitle: 'Studio Projects | MaxVideoAI',
    heroBadge: 'MaxVideoAI Studio',
    title: 'Studio projects',
    subtitle: 'Create a project, choose the starting canvas, then configure each sequence inside the editor.',
    createTitle: 'Create a new project',
    createSubtitle: 'Set up your project in a few steps',
    projectNameLabel: 'Project name',
    projectNamePlaceholder: 'Give your project a name...',
    canvasTemplateLabel: 'Canvas template',
    browseTemplates: 'Browse all templates',
    createProject: 'Create project',
    creating: 'Creating...',
    recentTitle: 'Recent projects',
    recentSubtitle: 'Pick up where you left off',
    emptyRecent: 'No Studio projects yet.',
    viewAllProjects: 'View all projects',
    rename: 'Rename',
    duplicate: 'Duplicate',
    delete: 'Delete',
    renameTitle: 'Rename project',
    renameSubmit: 'Save name',
    deleteTitle: 'Delete project',
    deleteBody: 'This removes the project from Studio. This cannot be undone.',
    deleteConfirm: 'Delete project',
    cancel: 'Cancel',
    untitledProject: 'Untitled edit',
    localDraft: 'Local draft',
    customCanvas: 'Custom canvas',
  },
  topbar: {
    productName: 'MaxVideoAI Editor',
    breadcrumbProjects: 'Projects',
    breadcrumbWorkspace: 'Workspace',
    workspaceViewLabel: 'Workspace view',
    canvas: 'Canvas',
    viewer: 'Viewer',
    export: 'Export',
    exportAria: 'Open export dialog',
    mock: 'Mock',
    live: 'Live',
    mockAria: 'Toggle mock generation',
    switchToLight: 'Switch Studio to light mode',
    switchToDark: 'Switch Studio to dark mode',
  },
  common: {
    secondsShort: 's',
    itemSingular: 'item',
    itemPlural: 'items',
    folder: 'Folder',
    generatedClip: 'Generated clip',
  },
  notices: {
    canvasTemplateNotFound: 'Canvas template not found.',
    projectMediaAssetNotFound: 'Project media asset not found.',
    projectMediaFolderNotFound: 'Project media folder not found.',
    generatedClipNotFound: 'Generated clip not found.',
    unlockBeforeMoving: 'Unlock the track before moving clips.',
    unlockBeforeCutting: 'Unlock the track before cutting clips.',
    unlockBeforeTrimming: 'Unlock the track before trimming clips.',
    unlockBeforeDeleting: 'Unlock the track before deleting clips.',
    selectedClipsUnlinked: 'Selected timeline clips unlinked.',
    selectedClipsLinked: 'Selected timeline clips linked.',
  },
};

function readObject(source: Dictionary, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function mergeCopy<T extends Record<string, unknown>>(fallback: T, value: unknown): T {
  if (!value || typeof value !== 'object') return fallback;
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => {
      const nextValue = (value as Record<string, unknown>)[key];
      if (fallbackValue && typeof fallbackValue === 'object' && !Array.isArray(fallbackValue)) {
        return [key, mergeCopy(fallbackValue as Record<string, unknown>, nextValue)];
      }
      return [key, typeof nextValue === 'string' ? nextValue : fallbackValue];
    })
  ) as T;
}

export function resolveStudioCopy(dictionary: Dictionary | null | undefined): StudioCopy {
  return mergeCopy(DEFAULT_STUDIO_COPY, readObject(dictionary ?? {}, 'workspace.studio'));
}

export function formatStudioProjectDate(locale: AppLocale, value: string, copy: StudioCopy): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy.projects.localDraft;
  return new Intl.DateTimeFormat(localeRegions[locale] ?? 'en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
```

- [ ] **Step 2: Add message namespaces**

Add `workspace.studio` to each message file. The English values should match `DEFAULT_STUDIO_COPY`. French and Spanish must be human-readable, not machine fallback. Example French fragment:

```json
"studio": {
  "projects": {
    "heroBadge": "MaxVideoAI Studio",
    "title": "Projets Studio",
    "subtitle": "Cree un projet, choisis le canvas de depart, puis configure chaque sequence dans l'editeur.",
    "createProject": "Creer le projet",
    "rename": "Renommer",
    "duplicate": "Dupliquer",
    "delete": "Supprimer"
  },
  "topbar": {
    "productName": "MaxVideoAI Editor",
    "breadcrumbProjects": "Projets",
    "breadcrumbWorkspace": "Workspace",
    "canvas": "Canvas",
    "viewer": "Viewer",
    "export": "Exporter",
    "switchToLight": "Passer Studio en mode clair",
    "switchToDark": "Passer Studio en mode sombre"
  }
}
```

- [ ] **Step 3: Add the dictionary contract test**

Create `tests/studio-localization-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const locales = ['en', 'fr', 'es'] as const;
const requiredPaths = [
  'workspace.studio.projects.title',
  'workspace.studio.projects.createProject',
  'workspace.studio.projects.rename',
  'workspace.studio.projects.duplicate',
  'workspace.studio.projects.delete',
  'workspace.studio.topbar.canvas',
  'workspace.studio.topbar.viewer',
  'workspace.studio.topbar.switchToLight',
  'workspace.studio.topbar.switchToDark',
  'workspace.studio.notices.unlockBeforeMoving',
];

function readPath(source: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

test('Studio localization dictionaries expose required copy in every locale', () => {
  locales.forEach((locale) => {
    const dictionary = JSON.parse(fs.readFileSync(path.join(root, `frontend/messages/${locale}.json`), 'utf8'));
    requiredPaths.forEach((keyPath) => {
      const value = readPath(dictionary, keyPath);
      assert.equal(typeof value, 'string', `${locale} ${keyPath} should be a string`);
      assert.ok(String(value).trim().length > 0, `${locale} ${keyPath} should not be empty`);
    });
  });
});
```

- [ ] **Step 4: Run the copy tests**

Run:

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/studio-localization-contract.test.ts
npm run test:editor
```

Expected: PASS after dictionaries are filled.

- [ ] **Step 5: Commit copy foundation**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/_lib/studio-copy.ts frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/studio-localization-contract.test.ts
git commit -m "feat: add Studio localization copy contract"
```

---

## Task 3: Localize Studio Projects Page

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/projects/StudioProjectsPage.client.tsx`
- Modify: `tests/e2e/editor/editor-smoke.spec.ts`

- [ ] **Step 1: Write failing project-page smoke checks**

Add this Playwright test to set the French app locale cookie, load the Studio projects route, and verify localized copy:

```ts
test('Studio projects uses localized copy', async ({ page, context }) => {
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'fr', domain: 'localhost', path: '/' }]);
  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Projets Studio' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Creer le projet' })).toBeVisible();
});
```

- [ ] **Step 2: Wire `StudioProjectsPage.client.tsx` to i18n**

Add imports:

```ts
import { useI18n } from '@/lib/i18n/I18nProvider';
import { resolveStudioCopy, formatStudioProjectDate } from '../_lib/studio-copy';
import type { AppLocale } from '@/i18n/locales';
```

Inside `StudioProjectsPageClient`:

```ts
const { locale, dictionary } = useI18n();
const studioCopy = useMemo(() => resolveStudioCopy(dictionary), [dictionary]);
const appLocale = locale as AppLocale;
```

Replace:

```ts
name: name.trim() || 'Untitled edit',
```

with:

```ts
name: name.trim() || studioCopy.projects.untitledProject,
```

Replace `formatProjectDate(project.updatedAt)` usage with:

```ts
formatStudioProjectDate(appLocale, project.updatedAt, studioCopy)
```

Replace visible labels and aria labels:

```tsx
<span>{studioCopy.projects.heroBadge}</span>
<h1>{studioCopy.projects.title}</h1>
<p>{studioCopy.projects.subtitle}</p>
<label>{studioCopy.projects.projectNameLabel}</label>
<input placeholder={studioCopy.projects.projectNamePlaceholder} />
<legend>{studioCopy.projects.canvasTemplateLabel}</legend>
<button>{studioCopy.projects.createProject}</button>
```

- [ ] **Step 3: Preserve API/local fallback behavior**

Keep `readStudioProjects`, `writeStudioProjects`, and all API functions unchanged except copy-dependent fallback strings. Do not move persistence in this task.

- [ ] **Step 4: Run focused validation**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "Studio projects uses localized copy"
npm run test:editor
npm --prefix frontend run lint
```

Expected: PASS.

- [ ] **Step 5: Commit projects localization**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/projects/StudioProjectsPage.client.tsx tests/e2e/editor/editor-smoke.spec.ts
git commit -m "feat: localize Studio projects page"
```

---

## Task 4: Localize Workspace Topbar And Notices

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorTopbar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasTemplateActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceTimelineClipActions.ts`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] **Step 1: Pass typed copy from `WorkspacePage.client.tsx`**

Add imports:

```ts
import { useI18n } from '@/lib/i18n/I18nProvider';
import { resolveStudioCopy } from '../_lib/studio-copy';
```

Inside `WorkspacePage`:

```ts
const { dictionary } = useI18n();
const studioCopy = useMemo(() => resolveStudioCopy(dictionary), [dictionary]);
```

Pass:

```tsx
<WorkspaceEditorLayout
  studioCopy={studioCopy}
  ...
/>
```

- [ ] **Step 2: Add copy prop to layout**

In `WorkspaceEditorLayout.tsx`:

```ts
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceEditorLayoutProps = {
  studioCopy: StudioCopy;
  ...
};
```

Pass `studioCopy` to topbar and action hooks/components that receive user-facing labels.

- [ ] **Step 3: Localize `WorkspaceEditorTopbar`**

Add prop:

```ts
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceEditorTopbarProps = {
  studioCopy: StudioCopy;
  ...
};
```

Replace text:

```tsx
<p>{studioCopy.topbar.productName}</p>
<span>{studioCopy.topbar.breadcrumbProjects} / {activeTemplateName} / {studioCopy.topbar.breadcrumbWorkspace}</span>
<div className={styles.modeSwitch} aria-label={studioCopy.topbar.workspaceViewLabel}>
...
{studioCopy.topbar.canvas}
...
{studioCopy.topbar.viewer}
...
aria-label={studioCopy.topbar.exportAria}
{studioCopy.topbar.export}
...
aria-label={studioCopy.topbar.mockAria}
<span>{mockMode ? studioCopy.topbar.mock : studioCopy.topbar.live}</span>
```

- [ ] **Step 4: Replace notices with copy**

Thread `studioCopy.notices` into these hooks through their params, then replace literals:

```ts
setNotice(studioCopy.notices.unlockBeforeMoving);
setNotice(studioCopy.notices.unlockBeforeCutting);
setNotice(studioCopy.notices.unlockBeforeTrimming);
setNotice(studioCopy.notices.unlockBeforeDeleting);
setNotice(studioCopy.notices.selectedClipsUnlinked);
setNotice(studioCopy.notices.selectedClipsLinked);
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test:editor
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "localized|Studio workspace"
npm --prefix frontend run lint
```

Expected: PASS.

- [ ] **Step 6: Commit workspace shell localization**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "feat: localize Studio workspace shell"
```

---

## Task 5: Studio Theme Preference Hook

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/_hooks/useStudioThemeMode.ts`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] **Step 1: Create theme hook**

Add:

```ts
'use client';

import { useEffect, useMemo, useState } from 'react';

export type StudioThemePreference = 'dark' | 'light' | 'system';
export type StudioResolvedTheme = 'dark' | 'light';

const STUDIO_THEME_STORAGE_KEY = 'maxvideoai.studio.theme.v1';

function readStoredTheme(): StudioThemePreference {
  if (typeof window === 'undefined') return 'dark';
  const value = window.localStorage.getItem(STUDIO_THEME_STORAGE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
}

function systemTheme(): StudioResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useStudioThemeMode() {
  const [preference, setPreference] = useState<StudioThemePreference>('dark');
  const [system, setSystem] = useState<StudioResolvedTheme>('dark');

  useEffect(() => {
    setPreference(readStoredTheme());
    setSystem(systemTheme());
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystem(systemTheme());
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STUDIO_THEME_STORAGE_KEY, preference);
  }, [preference]);

  const resolvedTheme = useMemo<StudioResolvedTheme>(() => (
    preference === 'system' ? system : preference
  ), [preference, system]);

  return {
    preference,
    resolvedTheme,
    setPreference,
    toggleResolvedTheme: () => setPreference((current) => {
      const currentResolved = current === 'system' ? system : current;
      return currentResolved === 'light' ? 'dark' : 'light';
    }),
  };
}
```

- [ ] **Step 2: Run architecture tests**

Run:

```bash
npm run test:editor
```

Expected: PASS once Task 1 assertions are satisfied by file existence.

- [ ] **Step 3: Commit hook**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/_hooks/useStudioThemeMode.ts tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "feat: add Studio theme preference hook"
```

---

## Task 6: Wire Theme Into Projects And Workspace

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/projects/StudioProjectsPage.client.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorTopbar.tsx`

- [ ] **Step 1: Apply theme attr on projects**

In `StudioProjectsPage.client.tsx`:

```ts
import { useStudioThemeMode } from '../_hooks/useStudioThemeMode';
```

Inside component:

```ts
const studioTheme = useStudioThemeMode();
```

On shell:

```tsx
<div className={styles.projectsShell} data-studio-theme={studioTheme.resolvedTheme}>
```

- [ ] **Step 2: Apply theme attr on workspace**

In `WorkspacePage.client.tsx`:

```ts
import { useStudioThemeMode } from '../_hooks/useStudioThemeMode';
```

Inside component:

```ts
const studioTheme = useStudioThemeMode();
```

Pass to layout:

```tsx
studioTheme={studioTheme}
```

In `WorkspaceEditorLayout.tsx`:

```ts
import type { useStudioThemeMode } from '../../_hooks/useStudioThemeMode';

type WorkspaceEditorLayoutProps = {
  studioTheme: ReturnType<typeof useStudioThemeMode>;
  ...
};
```

On `<main>`:

```tsx
data-studio-theme={studioTheme.resolvedTheme}
```

- [ ] **Step 3: Add topbar theme button**

In `WorkspaceEditorTopbar.tsx`, add import:

```ts
import { Moon, Sun } from 'lucide-react';
import type { useStudioThemeMode } from '../../_hooks/useStudioThemeMode';
```

Add prop:

```ts
studioTheme: ReturnType<typeof useStudioThemeMode>;
```

Render near the mock button:

```tsx
<button
  type="button"
  className={styles.iconButton}
  onClick={studioTheme.toggleResolvedTheme}
  aria-label={studioTheme.resolvedTheme === 'light' ? studioCopy.topbar.switchToDark : studioCopy.topbar.switchToLight}
  title={studioTheme.resolvedTheme === 'light' ? studioCopy.topbar.switchToDark : studioCopy.topbar.switchToLight}
>
  {studioTheme.resolvedTheme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
</button>
```

- [ ] **Step 4: Run theme smoke test**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "Studio workspace can switch to light appearance"
```

Expected: PASS once CSS in Task 7 adds visible token changes.

- [ ] **Step 5: Commit theme wiring**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio
git commit -m "feat: wire Studio theme mode"
```

---

## Task 7: Tokenize Core Studio Shell And Projects Styles

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/projects/studio-projects.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/maxvideoai-editor.module.css`

- [ ] **Step 1: Add shell tokens**

At the top of `shell.module.css`, add tokens to `.editorShell`:

```css
.editorShell {
  --studio-bg: #050911;
  --studio-bg-soft: #0f172a;
  --studio-surface: rgba(15, 23, 42, 0.86);
  --studio-surface-strong: rgba(4, 7, 13, 0.94);
  --studio-border: rgba(148, 163, 184, 0.14);
  --studio-text: #eef2ff;
  --studio-text-strong: #f8fafc;
  --studio-text-muted: #94a3b8;
  --studio-primary: #7c3aed;
  --studio-primary-2: #4f46e5;
}

.editorShell[data-studio-theme="light"] {
  --studio-bg: #f6f8fc;
  --studio-bg-soft: #eef2f8;
  --studio-surface: rgba(255, 255, 255, 0.92);
  --studio-surface-strong: rgba(255, 255, 255, 0.96);
  --studio-border: rgba(100, 116, 139, 0.22);
  --studio-text: #1f2937;
  --studio-text-strong: #0f172a;
  --studio-text-muted: #64748b;
  --studio-primary: #6d28d9;
  --studio-primary-2: #2563eb;
}
```

Then replace shell hardcoded colors:

```css
background: var(--studio-bg);
color: var(--studio-text);
border-bottom-color: var(--studio-border);
background: var(--studio-surface-strong);
color: var(--studio-text-strong);
color: var(--studio-text-muted);
```

- [ ] **Step 2: Add project-page light/dark tokens**

In `studio-projects.module.css`, move current light values to tokens and add a dark fallback for future consistency:

```css
.projectsShell {
  --studio-project-bg: #f6f8fc;
  --studio-project-surface: rgba(255, 255, 255, 0.94);
  --studio-project-border: rgba(148, 163, 184, 0.26);
  --studio-project-text: #111827;
  --studio-project-muted: #64748b;
}

.projectsShell[data-studio-theme="dark"] {
  --studio-project-bg: #050911;
  --studio-project-surface: rgba(15, 23, 42, 0.9);
  --studio-project-border: rgba(148, 163, 184, 0.16);
  --studio-project-text: #f8fafc;
  --studio-project-muted: #94a3b8;
}
```

Replace panel/text colors with the variables.

- [ ] **Step 3: Keep visual scope local**

Do not set `document.documentElement[data-theme]` in this task. The Studio theme is scoped by `data-studio-theme` on Studio shells only.

- [ ] **Step 4: Run visual smoke**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "Studio workspace can switch to light appearance"
npm --prefix frontend run lint
git diff --check
```

Expected: PASS.

- [ ] **Step 5: Commit shell theme tokens**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/projects/studio-projects.module.css frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_styles/shell.module.css frontend/app/\(core\)/\(workspace\)/app/studio/workspace/maxvideoai-editor.module.css
git commit -m "feat: add Studio shell light theme tokens"
```

---

## Task 8: Tokenize Canvas, Nodes, Toolbar, Timeline, Viewer, Media, Inspector, Export

**Files:**
- Modify all Studio workspace CSS modules listed in File Structure.
- Modify `tests/e2e/editor/editor-smoke.spec.ts`
- Modify `tests/e2e/editor/editor-timeline.spec.ts`

- [ ] **Step 1: Replace hardcoded dark colors with inherited tokens**

Use this mapping consistently:

```css
#020617, #030712, #050911 -> var(--studio-bg)
rgba(15, 23, 42, ...) -> var(--studio-surface)
rgba(30, 41, 59, ...) -> var(--studio-bg-soft)
#f8fafc, #eef2ff, #e2e8f0 -> var(--studio-text-strong)
#cbd5e1, #dbeafe -> var(--studio-text)
#94a3b8, #64748b -> var(--studio-text-muted)
rgba(148, 163, 184, ...) -> var(--studio-border)
#7c3aed -> var(--studio-primary)
#4f46e5, #2563eb -> var(--studio-primary-2)
```

Where a surface needs a special token, add it to `.editorShell` instead of hardcoding a new light-only selector:

```css
--studio-canvas-grid: rgba(148, 163, 184, 0.05);
--studio-canvas-grid-strong: rgba(148, 163, 184, 0.09);
--studio-timeline-grid: rgba(148, 163, 184, 0.1);
--studio-node-shadow: rgba(2, 6, 23, 0.32);
```

Add light overrides:

```css
.editorShell[data-studio-theme="light"] {
  --studio-canvas-grid: rgba(100, 116, 139, 0.12);
  --studio-canvas-grid-strong: rgba(100, 116, 139, 0.18);
  --studio-timeline-grid: rgba(100, 116, 139, 0.18);
  --studio-node-shadow: rgba(15, 23, 42, 0.12);
}
```

- [ ] **Step 2: Add screenshot/assertion checks**

In Playwright smoke, after toggling light:

```ts
const shellColors = await page.locator('[data-studio-theme="light"]').evaluate((element) => {
  const styles = getComputedStyle(element);
  return {
    background: styles.backgroundColor,
    text: styles.color,
  };
});
expect(shellColors.background).not.toBe('rgb(5, 9, 17)');
expect(shellColors.text).not.toBe('rgb(238, 242, 255)');
```

- [ ] **Step 3: Run broad editor e2e smoke**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "canvas toolbar|Studio workspace can switch to light appearance"
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-timeline.spec.ts -g "timeline linked video drag can move right|timeline end trim"
```

Expected: PASS.

- [ ] **Step 4: Commit surface tokens**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_styles tests/e2e/editor/editor-smoke.spec.ts tests/e2e/editor/editor-timeline.spec.ts
git commit -m "feat: support light theme across Studio editor surfaces"
```

---

## Task 9: Migrate Remaining Visible Studio Strings

**Files:**
- Modify Studio workspace components, controllers, hooks, and copy file.
- Modify `tests/studio-localization-contract.test.ts`
- Modify `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] **Step 1: Inventory strings**

Run:

```bash
rg -n "'[^']*[A-Za-z][^']*'|\"[^\"]*[A-Za-z][^\"]*\"|>[^<{]*[A-Za-z][^<{]*<" frontend/app/'(core)'/'(workspace)'/app/studio -g '*.tsx' -g '*.ts'
```

Classify results:

- Keep technical strings: ids, route paths, MIME types, status enums, CSS class names, feature flags.
- Migrate user-facing strings: visible text, aria labels, titles, placeholders, error messages, confirmation text, toasts, empty states.

- [ ] **Step 2: Extend `StudioCopy` per surface**

Add these sections to `StudioCopy`:

```ts
canvas: {
  toolbar: Record<string, string>;
  templates: Record<string, string>;
  nodes: Record<string, string>;
};
timeline: {
  tools: Record<string, string>;
  tracks: Record<string, string>;
  clips: Record<string, string>;
};
viewer: {
  controls: Record<string, string>;
  monitor: Record<string, string>;
  projectMedia: Record<string, string>;
};
exportDialog: Record<string, string>;
```

Use exact keys from the inventory, for example:

```ts
timeline: {
  tools: {
    selection: 'Selection tool',
    blade: 'Blade / Cut tool',
    toggleSnapping: 'Toggle snapping',
    toggleInsertIntoClip: 'Toggle insert into clip',
  },
  tracks: {
    addVideoTrack: 'Add video track',
    addAudioTrack: 'Add audio track',
    lockTrack: 'Lock {track} track',
    unlockTrack: 'Unlock {track} track',
  },
  clips: {
    trimStart: 'Trim clip start',
    trimEnd: 'Trim clip end',
    moveLeft: 'Move clip left',
    moveRight: 'Move clip right',
  },
}
```

- [ ] **Step 3: Pass copy by owner**

Do not import `useI18n` in low-level components repeatedly. Resolve once in `WorkspacePage.client.tsx`, then pass relevant copy sections:

```tsx
<WorkspaceTimeline copy={studioCopy.timeline} ... />
<WorkspaceCanvas copy={studioCopy.canvas} ... />
<WorkspaceVideoViewer copy={studioCopy.viewer} ... />
<WorkspaceExportDialog copy={studioCopy.exportDialog} ... />
```

- [ ] **Step 4: Add static guard against obvious hardcoded UI text**

In `tests/maxvideoai-editor-workspace-architecture.test.ts`, add a focused assertion for the most visible shells:

```ts
const hardcodedStudioShellLabels = [
  /MaxVideoAI Editor/,
  /Workspace view/,
  /Open export dialog/,
  /Selection tool/,
  /Blade \/ Cut tool/,
];

hardcodedStudioShellLabels.forEach((pattern) => {
  assert.doesNotMatch(workspaceEditorTopbarSource, pattern, `topbar should localize ${pattern}`);
});
```

Only apply this to files fully migrated in this task. Do not block technical/domain files that still contain model names, route ids, and statuses.

- [ ] **Step 5: Run full editor QA**

Run:

```bash
npm run qa:editor
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit remaining localization**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests
git commit -m "feat: localize Studio editor surfaces"
```

---

## Task 10: Browser Verification Matrix

**Files:**
- Modify: `docs/engineering/studio-editor-architecture.md`
- No product code unless verification finds defects.

- [ ] **Step 1: Add documentation note**

Append a short section:

```md
## Localization And Appearance

Studio uses the global Core `I18nProvider` and route-local typed copy under
`frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`.
Studio appearance is scoped with `data-studio-theme` on Studio shells and must not
mutate the global `documentElement` theme. Dark remains the default. Light mode is
persisted in `maxvideoai.studio.theme.v1`.
```

- [ ] **Step 2: Verify desktop light/dark**

Run:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "Studio workspace can switch to light appearance"
```

Then manually inspect in Browser:

- `/app/studio/projects`
- `/app/studio/workspace/project_630fb2af-524c-4ca6-a8d2-22687884b106`
- Canvas mode dark
- Canvas mode light
- Viewer mode dark
- Viewer mode light
- Timeline bottom panel at default height
- Timeline after zoom in/out
- Export dialog in light mode

- [ ] **Step 3: Verify mobile/tablet constraints**

Use Browser viewport or Playwright:

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts --project=chromium
```

Manually inspect widths:

- 390x844
- 768x1024
- 1460x1136

Expected:

- No topbar text overlap.
- Theme toggle remains visible or collapses with existing topbar actions.
- Canvas toolbar remains readable in light mode.
- Timeline labels stay legible against grid and clips.

- [ ] **Step 4: Run final checks**

Run:

```bash
npm run qa:editor
npm run lint:exposure
git diff --check
```

Expected: PASS.

- [ ] **Step 5: Commit docs and final fixes**

```bash
git add docs/engineering/studio-editor-architecture.md frontend/app/\(core\)/\(workspace\)/app/studio tests
git commit -m "docs: document Studio localization and appearance"
```

---

## Self-Review

- Spec coverage:
  - Studio localization compatibility with the site is covered by Tasks 2, 3, 4, and 9 using the existing Core `I18nProvider`, `frontend/messages`, and locale-aware formatting.
  - Studio light mode is covered by Tasks 5, 6, 7, and 8 using scoped `data-studio-theme` and CSS tokens.
  - Long-task validation is covered by Tasks 1 and 10 with architecture, dictionary, Playwright, lint, exposure, and diff checks.
- Placeholder scan:
  - No placeholder steps are present. Each task names files, commands, and expected outcomes.
- Type consistency:
  - `StudioCopy`, `resolveStudioCopy`, `formatStudioProjectDate`, and `useStudioThemeMode` names are consistent across tasks.
  - Theme values are consistently `dark`, `light`, and `system` preference with resolved `dark | light`.
