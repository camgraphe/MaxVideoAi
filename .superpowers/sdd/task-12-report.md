# Task 12 Report: Final V1 QA, User Simulations, And Documentation

## Status

Task 12 implementation and documentation are committed, but Studio V1 is **not complete** because two
core timeline Playwright simulations fail deterministically. The new creator/editor V1 simulations pass.

Implementation commit: `430fa9c3` (`docs: define Studio V1 QA contract`)

## Changed Files

- `docs/engineering/studio-editor-architecture.md`
- `docs/engineering/studio-editor-v1-qa.md`
- `frontend/app/(core)/(workspace)/app/studio/AGENTS.md`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-input-dock.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-v1-block-matrix.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-graph-clipboard.ts`
- `tests/e2e/editor/editor-timeline.spec.ts`
- `tests/e2e/editor/editor-v1-user-flows.spec.ts`
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

## Blockers And Concerns

- `dragging linked audio keeps the video clip visible during preview`: expected linked video/audio start
  `0`, received video start `5` while the drag remained active.
- `timeline prevents linked audio overlap when dragging the video partner`: expected the linked pair to
  revert to start `5`, received video start `0` after commit.
- Failure artifacts are in
  `test-results/editor-timeline-dragging-l-209aa-clip-visible-during-preview/` and
  `test-results/editor-timeline-timeline-p-17b1b--dragging-the-video-partner/`; they are generated and not
  committed.
- The two tests encode conflicting outcomes for equivalent leftward movement of the same linked pair.
  This report does not classify them as unrelated or waive them; V1 remains blocked pending an explicit
  linked-drag product contract and aligned implementation/tests.
- Fixture success does not validate real Supabase auth, provider generation, billing, persistence,
  object storage, or the server MP4 export worker. These constraints are documented in the V1 QA guide.
- Generated `output/audits/` artifacts were removed and not committed.
