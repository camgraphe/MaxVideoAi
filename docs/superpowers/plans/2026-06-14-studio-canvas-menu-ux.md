# Studio Canvas Menu UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Studio canvas dropdowns and the bottom-left Canvas navigator so users can scan available blocks quickly, keep canvas template visuals, and navigate menus accessibly.

**Architecture:** Keep the work route-local to Studio canvas components. `CanvasFloatingToolbar.tsx` owns direct canvas tools and block menus; `CanvasNavigatorPanel.tsx` owns saved canvases and starter templates. CSS stays split between `canvas-toolbar.module.css` and `canvas-navigator.module.css`, with localized copy under `studio-copy.ts` and locale message files.

**Tech Stack:** Next.js App Router, React client components, CSS modules, lucide-react icons, Node test runner architecture tests, TypeScript.

---

### Task 1: Add Contract Coverage For Menu UX

**Files:**
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] **Step 1: Add assertions for accessible canvas menus**

Add assertions near the existing canvas toolbar/navigator tests:

```ts
assert.match(canvasFloatingToolbarSource, /onKeyDown=\{handleMenuKeyDown\}/, 'canvas toolbar menus should close with keyboard handling');
assert.match(canvasFloatingToolbarSource, /data-canvas-toolbar-menu-id/, 'canvas toolbar menu buttons should expose stable menu ids');
assert.match(canvasFloatingToolbarSource, /block\.meta/, 'canvas toolbar block cards should expose compact metadata chips');
assert.match(canvasNavigatorPanelSource, /onKeyDown=\{handlePanelKeyDown\}/, 'canvas navigator should support keyboard dismissal');
assert.match(canvasNavigatorPanelSource, /template\.flow/, 'canvas navigator should show template workflow context while preserving thumbnails');
assert.match(canvasNavigatorStyleSource, /\.templatePreview/, 'canvas navigator templates should keep a visible preview area');
```

- [ ] **Step 2: Run focused contract test to verify it fails**

Run:

```bash
PATH=/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-workspace-architecture.test.ts
```

Expected: fails on the new assertions before implementation.

### Task 2: Improve Toolbar Menu Structure

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-toolbar.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`

- [ ] **Step 1: Extend block definitions with compact metadata**

Add a `meta: string[]` field to `ToolbarBlockDefinition`. Source blocks use localized family/output labels; preset blocks derive short labels from preset kind/family with copy fallbacks.

- [ ] **Step 2: Add keyboard and menu semantics**

Add `handleMenuKeyDown` so `Escape` closes active toolbar popovers. Add stable `data-canvas-toolbar-menu-id`, `aria-haspopup="dialog"`, and controlled `aria-expanded` on menu buttons.

- [ ] **Step 3: Render compact block cards**

Update `BlockOptionList` so each block card keeps icon, title, short description, and up to three small chips. Keep drag behavior unchanged.

- [ ] **Step 4: Polish menu CSS**

Update toolbar popovers to support clear focus states, compact metadata chips, hidden scrollbars, and consistent dark/light contrast without making the menu visually heavy.

### Task 3: Improve Canvas Navigator Panel

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasNavigatorPanel.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-navigator.module.css`

- [ ] **Step 1: Add keyboard dismissal**

Add `handlePanelKeyDown` so `Escape` closes the Canvas navigator and returns interaction to the trigger naturally.

- [ ] **Step 2: Improve saved canvas rows**

Keep saved canvases lightweight: name, description, active marker, duplicate/delete icon actions. Improve focus states and avoid overloading rows.

- [ ] **Step 3: Preserve and improve template visuals**

Keep image-backed template cards. Add a distinct `.templatePreview` visual area, show `template.flow`, keep the primary action prominent, and keep replace-current as secondary.

- [ ] **Step 4: Make the Canvas trigger clearer**

Keep icon + label, add a small count/active hint only when useful, and preserve a compact footprint in the bottom-left corner.

### Task 4: Verify And Smoke Test

**Files:**
- No code files unless verification finds an issue.

- [ ] **Step 1: Run focused Studio tests**

Run:

```bash
PATH=/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-workspace-architecture.test.ts tests/studio-localization-contract.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript and lint**

Run:

```bash
PATH=/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
PATH=/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node_modules/.bin/eslint app pages components lib src middleware.ts --ext .js,.jsx,.ts,.tsx
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Browser smoke**

Open `http://localhost:3000/app/studio/workspace/project_630fb2af-524c-4ca6-a8d2-22687884b106`, switch to Canvas if needed, then verify:

- Toolbar menus open and close with Escape.
- Block menus show compact cards with metadata chips.
- Canvas navigator opens from bottom-left, shows saved canvases and templates.
- Template cards retain visible thumbnail previews.
- No obvious text overlap in light mode.

