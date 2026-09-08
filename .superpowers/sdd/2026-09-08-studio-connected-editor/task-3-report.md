# Task 3 — connected Studio media implementation

Status: DONE_WITH_CONCERNS (qualified local media lot; explicit integration limits below). Supersedes the paused checkpoint. Product is frozen at `bd7aeb3cb`, on `codex/studio-connected-editor` in the assigned dce6 worktree. Independent review is delegated to the coordinator, not a new subagent.

## Commits and coordination

- `4c986b84e` — additive canonical upload refs and measured facts, preserving existing legacy IDs.
- `cf525e7df` — separate account/token/age-bound Studio project handoff interface.
- `9d7bb92d4` — exports existing `validReferenceMediaUrl` policy for Studio reuse; no URL policy fork.
- `00c0cfa3b` — retains measured positive/negative `hasAudio` from the upload probe already executed. No extra probe or probe arguments.
- `bd7aeb3cb` — isolated Studio media integration, server resolver, lifecycle/commands/serializer, tests and two engineering-guide sections.
- This report is a separate documentation-only follow-up.

Coordinator confirms `8a74ab753` / `4c986b84e` and Audio `746a0cf49` are already integrated on the root side. Do not duplicate their import. Audio/Toolbox/Billing/MCP Audio coordination now goes through principal `01a07920`, not archived former worktrees.

No parent QA paths, Chat/export fixes, Task 4 persistence, global application changes, autonomous Audio routes/providers, prices/catalogues, environment files, external source worktrees, remote DB, paid generation, deployment, push or cherry-pick were changed. No subagent was spawned.

## Implemented boundaries

### Identity, provenance and server access

Studio consumes the existing `ToolAssetRef` schema. Separate adapters cover library assets, exact Recent job/output tuple, uploads and already-qualified tool results. Project-local IDs are independently generated; internal/card/provider IDs and URLs are never promoted to remote refs. Legacy local media remains loadable without fabricated identity.

The shared upload delta preserves `id/legacyAssetId`, adds the canonical public alias/ref only when known, and carries measured `mediaFacts` through image/video/audio routes, stored metadata, library projection and the video upload client. Image dimensions come from the decoder. Audio/video duration and audio presence come from the existing probe. Multipart adds identity only; unknown facts remain absent.

`frontend/src/server/studio/media-resolver.ts` is a read-only exact lookup with injected executor. The session route `/api/studio/media/resolve` uses the existing Studio authentication context, rejects empty/over-60 batches, and never calls ensure/import. The resolver checks account, exact ref, kind, readiness, deleted/hidden state and source job/output ownership, including hidden jobs reached only via `source_output_id`. It uses the existing reference URL and MIME policies. A caller-owned SQL row pointing to another owner's storage object is rejected. Stored original wins over legacy URL; signatures are preserved byte-for-byte. `originalAccess` identifies an owned storage key or an allowed exact external original, without signing anything or inventing an OAuth principal.

### Library, lifecycle and local editing

The library hook keys requests/cache by verified account, kind, Assets/Recent source and query; cursor pagination belongs to that request generation. Initial requests abort, late pagination cannot cross generations, and accountless requests do not populate/read the shared cache. Account changes clear owned cache entries; successful uploads invalidate listings instead of inserting accountless cache entries. Errors/401 never turn into demo media. Explicit retry and q transport are wired.

Upload/acceptance intentions are invalidated by modal close, unmount, account/project/node/destination changes and relevant filters. The account subscription guards getSession/auth-event races. Source replacement rechecks kind and original presence in the canvas commit. Browser metadata fallback is original-only, two concurrent readers, eight-second timeout and cancellable; renamed media/changed originals are protected against stale hydration. These browser measurements never become server `source: 'probe'` facts.

Project media has explicit timeline insertion and new canvas-source buttons. Existing timeline commands still own compatible tracks, locks, overlap, frame rounding and linked audio; drag-to-timeline uses the same insert command. Reimport matches exact ref and retains local ID, name, destination and existing defined enrichment. Bounded import/removal undo stores at most 30 deltas, resets by account/project and preserves unrelated media. Removing from the bin never deletes remote originals or existing timeline clips. Canvas replacement/undo uses canvas history, not a new editor history system.

Refs/originals/facts survive bin, canvas and timeline serialization and structural normalization. A thumbnail no longer certifies source dimensions or becomes an original. Measuring a video cannot certify duration for its distinct external audio URL.

Verified local demo sources replace missing URLs without modifying source files: local video `/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4` is six seconds, 1920x1080 and silent; `/studio/demo-ambient.wav` is 28 seconds; the product reference image is 1920x1080. Demo clip length is bounded by the actual video, while model requested settings remain separate (Veo's requested eight seconds is not a six-second source measurement). The connected audio E2E uses the existing 15-second station-ambience WAV, confirmed with ffprobe.

### Handoff and localization

The separate Studio handoff key is account/token/ten-minute bound. Projects preserves the token through the user's existing/new project selection. `StudioMediaHandoffReceiver` requires explicit confirmation, resolves the exact ref and imports into the selected project's root bin; it does not inherit a cancelled picker's destination. Only `intent: 'project'` is advertised. Canvas/timeline actions are subsequent explicit bin commands. Producer buttons and Audio/Toolbox workbenches are unchanged.

New action, retry and handoff copy is present in English/French/Spanish and owned by Studio copy. Existing architecture contracts were updated to the intentional new signatures and original-only behavior, not weakened generically.

## Verification commands and results

All runtime commands use Node 22. Commands below were run from the assigned repository unless a frontend working directory is specified.

### Focused combined Studio/media/timeline suite

```sh
NODE_PATH="$PWD/frontend/node_modules" PATH=/opt/homebrew/opt/postgresql@17/bin:$PATH pnpm dlx node@22 node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test --test-reporter=tap tests/maxvideoai-editor-*.test.ts tests/studio-*.test.ts tests/timeline-export-*.test.ts
```

Final output: tests 429, pass 429, fail 0, skipped 0, cancelled 0. Log: `.superpowers/studio-task3-full-tests.log`. Covers all previously failing focused architecture/localization contracts, pure identity/original/facts roundtrip, timeline rules, strict resolver tests and four React DOM lifecycle/receiver tests.

### Shared upload interface

```sh
NODE_PATH="$PWD/frontend/node_modules" pnpm dlx node@22 node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test --test-reporter=tap tests/studio-shared-media-facts.test.ts tests/video-upload-direct.test.ts tests/image-upload-service.test.ts tests/mcp-reference-upload-handoff.test.ts tests/image-upload-route-auth-order.test.ts
```

Final output: 45 tests, 45 pass, 0 fail. Log: `.superpowers/studio-task3-upload-tests.log`. HasAudio regression was observed RED before implementation: missing false in stored facts and missing probe boolean (log `.superpowers/studio-task3-has-audio-red.log`); the same checks then passed. Prior canonical helper and resolver work also used failing boundary tests before implementation.

### PostgreSQL scope

`tests/studio-media-resolver-postgres.test.ts` starts a unique socket-only PG17 via the existing disposable helper, verifies listen_addresses/version/socket before any fixture write, then creates minimal relevant table shapes. It executes the production resolver SQL with real PG rows, including a READ ONLY transaction. It covers foreign account, exact output/job mismatch, hidden source-output-linked job, internal/public ID confusion, foreign storage object, stored signed original preference, external original classification, pending/deleted/MIME/scheme refusal. Cleanup is bounded by the helper. No inherited DATABASE_URL is read and no remote database is contacted. This is real SQL resolution evidence, not a mock executor claim; the minimal schema is not a full application migration/integration test.

### Real browser interactions

```sh
PLAYWRIGHT_EDITOR_BASE_URL=http://127.0.0.1:3032 PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 pnpm dlx node@22 node_modules/@playwright/test/cli.js test -c playwright.editor.config.ts tests/e2e/editor/editor-connected-media.spec.ts tests/e2e/editor/editor-library.spec.ts --output=.superpowers/studio-task3-final-playwright
```

Final output: 11 passed (53.7 seconds), 0 failures. Log: `.superpowers/studio-task3-final-e2e.log`. Tests include library scrolling, multi-select/range/toggle/delete, kind/source/cursor requests, upload retry and listing refresh, audio import → timeline → canvas → local save/reload → bin deletion/undo, late upload after close, exact Recent image replacement and canvas undo preserving timeline/bin.

Browser API fixtures intentionally intercept Assets/Recent, upload and resolver responses with contract-correct refs; the existing helper intercepts project/header APIs. Consent endpoints are bounded fixture responses because this anonymous preview has no DB. Remote fixture image URLs are image fixture responses; these tests do not prove real remote media decoding. The connected audio uses a real tracked WAV. Tests prove actual React/browser interactions and local storage persistence, NOT authenticated media HTTP resolution, server save/reload, signed delivery or montage persistence. Parent-owned media-decoding QA remains separate and untouched.

The initial broader browser run found only an existing selection-toolbar interception of the node settings icon plus DB-less consent 500s. The test now exercises the existing I-key inspector alternative and scopes consent fixtures; no canvas layout/product fix or blanket error suppression was introduced. Functional media assertions passed on rerun.

### Static verification

```sh
pnpm dlx node@22 frontend/node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json --incremental false
pnpm dlx node@22 scripts/check-public-exposure.mjs
git diff --check
```

All exited 0. TypeScript was rerun after final product edits. Exposure output: Public exposure check passed.

Frontend working directory, equivalent to the frontend lint script:

```sh
pnpm dlx node@22 node_modules/eslint/bin/eslint.js app pages components lib src middleware.ts --ext .js,.jsx,.ts,.tsx
```

Exit 0, zero errors, two preexisting exhaustive-deps warnings: WorkspaceAssetLibraryBrowser controlledSearchQuery (line111) and WorkspaceRuntimeModals assetPickerLibrary (line88). Their warned lines were already present at HEAD; no new lint warning remains. Log `.superpowers/studio-task3-lint.log`. Shared probe/store-media-upload targeted lint also reported no warnings/errors. No production build or full repository E2E suite was claimed.

## Auto-review and exact remaining limits

- Reviewed all changed ownership boundaries and staged explicit paths only (46 files in Studio commit). No ensure or writes in the resolver; no thumb fallback in changed original consumers; canonical and project IDs separate; no false measured facts on legacy input; no requested duration promotion.
- Final combined suite and UI verification gates are green. No remaining known product blocker for this local media lot. Independent review is still the coordinator's gate.
- `ensureReusableAsset` does not generically merge params.metadata into existing canonical rows. A deduplicated reupload can return fresh measured facts while its existing canonical row retains old/missing facts. Studio resolves against stored facts, not upload payload claims. No backfill or generic metadata-merge refactor was performed; Task4 must keep missing server facts ineligible where required.
- Multipart and old generated outputs may lack source facts. Browser fallback supports local editing only, never certifies them for connected writers. Strict reference MIME/URL policy may refuse legacy/broad workspace containers for a new connected import; existing local projects remain usable.
- No standalone Audio creation, MCP Audio wrapper or producer return button was implemented. The tested project-bin handoff receiver/interface is ready for coordinator-owned producer integration; no other handoff destination is promised.
- No revisioned montage transaction, migration, autosave coexistence, signing or authenticated end-to-end DB-backed project save/reload was implemented. These remain Task4.
- Metadata inspection is bounded and may remain unknown when a source fails or blocks browser inspection. It does not retry indefinitely or create background probes.
- The existing canvas node settings icon can be occluded by the selection toolbar; its keyboard/toolbar alternative works. Canvas polish remains out of this lot.
- The two preexisting lint warnings and unrun broader production/full-E2E validation remain explicit. No performance improvement is claimed from functional tests alone.
