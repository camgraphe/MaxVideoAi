# Task 12 Report: Final V1 QA, User Simulations, And Documentation

## Status

Task 12 automated V1 acceptance is complete. The two deterministic linked-drag blockers are resolved,
and the final responsive, timeline, creator, and editor Playwright gate passes in full.

Implementation commit: `430fa9c3` (`docs: define Studio V1 QA contract`)
Linked-drag resolution commit: `a8859e7a` (`fix: enforce symmetric linked timeline moves`)

## Changed Files

- `docs/engineering/studio-editor-architecture.md`
- `docs/engineering/studio-editor-v1-qa.md`
- `frontend/app/(core)/(workspace)/app/studio/AGENTS.md`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-input-dock.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-v1-block-matrix.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-graph-clipboard.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing.ts`
- `tests/e2e/editor/editor-timeline.spec.ts`
- `tests/e2e/editor/editor-v1-user-flows.spec.ts`
- `tests/maxvideoai-editor-timeline-interaction.test.ts`
- `tests/maxvideoai-editor-workspace-architecture.test.ts`
- `.superpowers/sdd/task-12-report.md`

## RED And GREEN Evidence

The first Playwright invocation stopped before tests because the editor config uses `pnpm`, which is not
installed in the bundled runtime (`exit 127`). Using an explicit absolute-Node Next command reached the
new tests. Initial result: `2 failed`; the creator locator was rooted incorrectly and export readiness was
asserted through a nonexistent `data-status="ready"` element.

After scoping the generation control to compatible fixture `shot-02`, using the real `output-02`, and
asserting the four rendered `data-status="pass"` preflight rows, the same spec passed:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
PLAYWRIGHT_EDITOR_WEB_SERVER_COMMAND='cd frontend && /Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --hostname localhost --port 3000' \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-v1-user-flows.spec.ts
```

Result: `2 passed` in 24.3 seconds. Both flows register page/console error tracking before navigation and
assert no client errors in `afterEach`.

The initial final contract gate returned `218 passed, 2 failed`. History showed stale contracts from the
V1 tasks: controls moved to `WorkspaceControlField`, export idempotency rotation moved before re-estimate,
Generate Video and Modify Video routing became distinct, measured resolution moved behind a metadata
helper, and the old pricing capability fixture lacked `workflows`. After updating only those stale tests,
the full focused gate returned `220 passed, 0 failed`.

TypeScript initially reported five Task 1-10 errors in connector optionality, pricing request union
inference, matrix workflow tuple inference, and clipboard center narrowing. Explicit type-preserving
narrowing fixed them; the final TypeScript run passed with no output.

## Final Checks

Focused 12-file Studio gate from the brief:

Result: `220 passed, 0 failed` in 526.7 ms.

Fresh changed-surface gate:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-workspace-architecture.test.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-graph-helpers.test.ts
```

Result: `94 passed, 0 failed`.

TypeScript:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Result: passed with no diagnostics.

Frontend lint, run from `frontend/`: passed with `0 errors, 2 warnings`. Existing warnings remain at
`WorkspaceAssetLibraryBrowser.tsx:111` and `WorkspaceRuntimeModals.tsx:86` for missing hook dependencies.

Exposure and whitespace: `Public exposure check passed.` and `git diff --check` passed with no output.

Final Playwright gate:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS=true PLAYWRIGHT_EDITOR_PORT=3120 \
PLAYWRIGHT_EDITOR_WEB_SERVER_COMMAND='cd frontend && /Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --hostname localhost --port 3120' \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-timeline.spec.ts \
  tests/e2e/editor/editor-responsive.spec.ts \
  tests/e2e/editor/editor-v1-user-flows.spec.ts
```

Result: `45 passed, 2 failed` in 2.8 minutes. All seven responsive tests and both new V1 user flows
passed. A targeted rerun of the two failures returned `2 failed`, confirming they are deterministic.

## Linked Drag Blocker Resolution

Binding contract: linked video/audio moves are atomic and symmetric; ordinary preview and commit cannot
create same-track overlap; invalid targets keep the last committed state; free-space targets preview and
commit both members; explicit Insert into clip remains the opt-in splice operation.

RED evidence:

- The original targeted browser run returned `2 failed`: the audio-origin drag expected start `0` but
  remained at `5`, while the video-origin drag expected a revert to `5` but committed at `0`.
- Fixture inspection showed `timeline-output-01` occupies video `[0, 5)`, and the linked
  `timeline-output-02` / `timeline-output-02-audio` pair occupies `[5, 13)`. Therefore both `-204`
  leftward drags targeted the same occupied video range; the former test's expected commit was invalid.
- A new pure symmetric regression test failed before the production fix for the video anchor: the pair
  moved to `0` and the blocker moved to `8` instead of preserving the input array.
- After an initially broad guard, the full browser gate returned `44 passed, 3 failed`: two stale
  displacement expectations and the intentional splice flow. A new pure splice regression reproduced
  the latter by returning linked start `5` instead of `1`.

Root cause: `moveLinkedTimelineSelection` correctly reported the occupied target, including item/track,
linked group, candidate start, and colliding blocker. The production wrapper
`moveWorkspaceTimelineSelectionWithMode` discarded that invalid result when the colliding ID matched the
drag anchor, then continued into insert-mode displacement. This made a video-origin invalid drop commit
while the equivalent audio-origin path reverted. The wrapper now rejects every invalid linked move for
normal drag/preview and permits collision-based splitting only when `allowInsertIntoClip` is explicitly
enabled. The browser fixture test now moves the audio-origin pair right by two seconds into free space and
asserts aligned, overlap-free preview and commit. The occupied-target test performs both video-origin and
audio-origin drags and asserts exact reversion.

GREEN evidence:

```bash
PATH=/opt/homebrew/Cellar/node/23.9.0/bin:$PATH \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-timeline-interaction.test.ts
```

Result: `23 passed, 0 failed` in 256.4 ms.

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS=true PLAYWRIGHT_EDITOR_PORT=3124 \
PLAYWRIGHT_EDITOR_WEB_SERVER_COMMAND='cd frontend && /Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --hostname localhost --port 3124' \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-timeline.spec.ts \
  --grep 'dragging linked audio keeps the video clip visible during preview|timeline prevents linked audio overlap when dragging the video partner|timeline context menu unlinks|linked insert-mode timeline drag reverts|insert into clip tool allows splice'
```

Targeted result: `5 passed` in 37.0 seconds, with every test using `trackEditorClientErrors` and
`assertNoEditorClientErrors`.

Final Task 12 browser gate:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS=true PLAYWRIGHT_EDITOR_PORT=3125 \
PLAYWRIGHT_EDITOR_WEB_SERVER_COMMAND='cd frontend && /Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --hostname localhost --port 3125' \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-timeline.spec.ts \
  tests/e2e/editor/editor-responsive.spec.ts \
  tests/e2e/editor/editor-v1-user-flows.spec.ts
```

Result: `47 passed, 0 failed` in 2.6 minutes. This includes seven responsive tests, 38 timeline tests,
and both V1 creator/editor flows. Client page errors and React console errors are tracked by the flows.

Final static checks after the linked-drag fix:

- `PATH=/opt/homebrew/Cellar/node/23.9.0/bin:$PATH ./frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`: passed with no diagnostics. The first invocation without this explicit runtime did not start (`node: not found`, exit `127`).
- `cd frontend && PATH=/opt/homebrew/Cellar/node/23.9.0/bin:$PATH ./node_modules/.bin/eslint 'app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing.ts'`: passed with no output.
- `PATH=/opt/homebrew/Cellar/node/23.9.0/bin:$PATH npm run lint:exposure`: `Public exposure check passed.`
- `git diff --check`: passed with no output.

## Blockers And Concerns

- No automated Task 12 V1 blocker remains. Generated Playwright failure artifacts and untracked audit
  documents are not part of the commit.
- Fixture success does not validate real Supabase auth, provider generation, billing, persistence,
  object storage, or the server MP4 export worker. These constraints are documented in the V1 QA guide.
- Generated `output/audits/` artifacts were removed and not committed.

## Final Review Fix: Localized Startup Selectors

The final review found that the QA guide claimed EN/FR/ES selector support while the shared
`openFreshEditorWorkspace` startup path still required English-only product, mode, timeline, and cookie
labels. The fixture can genuinely exercise server-side localization: setting `NEXT_LOCALE` before
navigation renders the French and Spanish Studio dictionaries.

RED evidence used real browser locale cookies:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS=true PLAYWRIGHT_EDITOR_PORT=3130 \
PLAYWRIGHT_EDITOR_WEB_SERVER_COMMAND='cd frontend && /Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --hostname localhost --port 3130' \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-v1-user-flows.spec.ts --grep 'fresh editor startup accepts'
```

Result: `2 failed`. French rendered `Editeur MaxVideoAI`, `Canevas`, and `Visionneuse`; Spanish rendered
`Editor MaxVideoAI`, `Lienzo`, and `Visor`. Both failed at the helper's English-only
`MaxVideoAI Editor` startup assertion before reaching the other English-only checks.

GREEN implementation adds anchored, explicit EN/FR/ES patterns for the visible product name, Canvas,
Viewer, video-timeline region, and reject-cookie button. The assertions retain role/label semantics and
visibility checks; no hidden-duplicate `.first()` fallback was added. The V1 flow spec now uses a real
`NEXT_LOCALE` context cookie to run distinct French and Spanish startup cases, while its existing creator
and editor flows remain English-fixture coverage.

Focused GREEN rerun:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS=true PLAYWRIGHT_EDITOR_PORT=3131 \
PLAYWRIGHT_EDITOR_WEB_SERVER_COMMAND='cd frontend && /Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --hostname localhost --port 3131' \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-v1-user-flows.spec.ts --grep 'fresh editor startup accepts'
```

Result: `2 passed` in 23.3 seconds.

Final V1 rerun used one persistent local Next server to avoid the runner terminating a Playwright-managed
web server between tests:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS=true PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 PLAYWRIGHT_EDITOR_PORT=3136 \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-v1-user-flows.spec.ts
```

Result: `4 passed`: French startup, Spanish startup, English creator flow, and English editor flow.

Affected smoke coverage was also run against that persistent server. It returned `31 passed, 8 failed`.
The failures are outside this helper change: stale expected project-media duration (`8` versus measured
`21.033`), project-card interaction/notice expectations, two Viewer-track waits while Canvas remained
active, and a canvas style expectation. The localized startup assertions and all four V1 flows passed.

Final static checks:

- `./frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`: passed with no diagnostics.
- `cd frontend && ./node_modules/.bin/eslint app pages components lib src middleware.ts --ext .js,.jsx,.ts,.tsx`:
  `0` errors and the two existing hook-dependency warnings in `WorkspaceAssetLibraryBrowser.tsx:111` and
  `WorkspaceRuntimeModals.tsx:86`.
- `git diff --check`: rerun after this report append; passed with no output.
