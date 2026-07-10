# Studio Editor V1 QA

This guide is the release contract for the first Studio editor version. V1 is accepted only when the
focused contract gate, TypeScript, lint/exposure, whitespace checks, and core browser simulations pass.
Do not call V1 complete while either creator or editor user flow fails.

## V1 Acceptance

- Projects can be created and reopened from `/app/studio/projects`, with API persistence when available and local-draft fallback when it is not.
- Canvas supports typed prompt, media, generation, tool, chat, and output blocks governed by the V1 block/capability policy.
- Mock generation creates a typed ready output and adds generated media to Project media without provider credentials.
- Ready image, video, and audio assets can move from canvas or Project media into the active sequence through typed insertion rules.
- Viewer mode exposes Project media, the program monitor, clip/sequence/media inspection, timeline editing, and active-sequence export.
- Same-track overlap is not committed by ordinary move, trim, insert, or linked-clip operations.
- Linked video/audio move, trim, split, link, and unlink behavior remains synchronized unless the user explicitly unlinks it.
- Export preflight reports media, timeline, range, and audio readiness before a server render can be submitted.
- Desktop, tablet, and mobile keep a usable primary surface, timeline, Project media access, and inspector access.
- New browser flows finish without uncaught page errors or React `console.error` output.

## Capability Contract

- Block presets define user intent; engine capabilities define model support; the V1 block matrix defines allowed block workflows.
- `workspace-block-capability-policy.ts` resolves those sources for node controls, inspector controls, pricing, and request payloads.
- A new engine needs positive and negative block-list coverage.
- A new block needs connector, request payload, pricing, and typed output-media coverage.
- Surface components must not introduce their own engine or workflow allowlists.

## Required Manual Flows

1. Create a project from `/app/studio/projects`, reopen it, and confirm the expected active canvas and sequence.
2. Add a text prompt block, connect it to a compatible image or video generation block, and inspect the connection state.
3. Generate in Mock mode and confirm a typed ready output appears and is represented in Project media.
4. Send the generated output to the active sequence at an edit point and confirm no same-track overlap is committed.
5. Import one image, video, and audio asset; verify metadata and the All/Image/Video/Audio Project media filters.
6. Inspect a canvas node, media asset, timeline clip, and sequence; verify edits remain owned by the selected entity.
7. Move and trim the fixture's linked video/audio pair, then split, unlink, relink, undo, and redo representative edits.
8. Exercise gap deletion and occupied timeline insertion; confirm frame snapping and clean rejection/reversion where required.
9. Open active-sequence export, verify all preflight rows, submit only when the worker environment is configured, and confirm the completed asset returns to Project media.
10. Repeat the primary Viewer and Canvas checks at `1440x1024`, `1024x768`, and `390x844`.

## Automated Gate

Run from the repository root with the bundled Node runtime first on `PATH`.

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-workspace-architecture.test.ts \
  tests/maxvideoai-editor-sequence-api-persistence.test.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts \
  tests/maxvideoai-editor-timeline-external-drop.test.ts \
  tests/maxvideoai-editor-timeline-interaction.test.ts \
  tests/maxvideoai-editor-timeline-selection.test.ts \
  tests/maxvideoai-editor-timeline-export.test.ts \
  tests/studio-localization-contract.test.ts \
  tests/maxvideoai-editor-v1-capability-matrix.test.ts \
  tests/maxvideoai-editor-v1-request-payloads.test.ts \
  tests/maxvideoai-editor-v1-pricing.test.ts

PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json

(cd frontend && \
  PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
  ./node_modules/.bin/eslint app pages components lib src middleware.ts --ext .js,.jsx,.ts,.tsx)

PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  scripts/check-public-exposure.mjs

git diff --check
```

Run the final browser gate when the local editor route is available:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-timeline.spec.ts \
  tests/e2e/editor/editor-responsive.spec.ts \
  tests/e2e/editor/editor-v1-user-flows.spec.ts
```

If the bundled runtime has `node` but no `pnpm`, use the same browser gate with an explicit Next server command:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
PLAYWRIGHT_EDITOR_WEB_SERVER_COMMAND='cd frontend && /Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --hostname localhost --port 3000' \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-timeline.spec.ts \
  tests/e2e/editor/editor-responsive.spec.ts \
  tests/e2e/editor/editor-v1-user-flows.spec.ts
```

## Browser Fixture Scope

`editor-helpers.ts` clears editor local storage, opens the fixture workspace, and mocks account, wallet,
Studio persistence, template, sequence, and export-estimate APIs. The V1 simulations intentionally use
the fixture's compatible `shot-02`, ready `output-02`, linked `timeline-output-02` video/audio pair, and
active sequence. Selectors are scoped to stable data attributes or named visible regions and tolerate the
supported English, French, and Spanish labels.

The fixture proves editor orchestration and client behavior. It does not prove real Supabase sessions,
provider generation, billing reservation, durable database writes, object-storage access, or server MP4
rendering.

## External Environment Constraints

- Real project API persistence requires a valid authenticated session and configured Neon database.
- Live generation requires provider credentials, reachable provider APIs, wallet/billing services, and valid media storage URLs.
- Final MP4 export requires the timeline export API, database migrations, object storage, billing/idempotency, and a running export worker.
- Browser media playback depends on fixture or storage URLs being reachable with supported MIME and CORS behavior.
- Local fixture success must not be used to waive staging checks for auth, provider generation, persistence, billing, or completed export artifacts.

Record any failed command with its exit code, failing test or diagnostic, and a history/diff comparison.
Classify a failure as pre-existing only when the same failure is reproduced on the comparison revision or
the relevant source is unchanged across the investigated range.
