# Studio architecture

Reviewed 2026-10-05. Studio has one public conversational interface. The private React Flow Canvas, its templates and local-only project management were retired at the owner's request. Its personal saved projects are deleted without migration; current chats and MCP montages remain supported.

## Ownership map

| Owner | Responsibility |
| --- | --- |
| Studio `page.tsx`, `_components`, `_hooks`, `_lib` | Direct chat entry, owned summary picker, stable creation identity, editable marketing briefs and access UI |
| `conversation/[projectId]` | Chat journal, media shelf/library, assistance credits, quote review/confirmation, connected timeline and export UI |
| Studio `_shared/_lib/timeline` | Frame math, timing, trim/move/insert, audio layering/linking, source metadata, track constraints and normalization |
| Studio `_shared/_lib/workspace-timeline-*` | Manifest/export request/session contracts and track/selection rules |
| Studio `_shared/_components/viewer` and `_hooks/useWorkspaceTimelinePlayback` | Shared media playback, decoder failure handling and timeline playback state |
| Studio `_shared/_controllers/useExportController` | Browser export estimate/confirmation/poll/recovery |
| Studio `_shared/_lib/models/workspace-model-certification` | Explicit supported conversation generation modes; model publication alone does not certify a mode |
| Studio `_shared/_state` and `_lib/workspace-types` | Persisted project/sequence/media facts consumed by canonical commands, montage and export |
| `frontend/src/server/studio` | Account ownership, journal, generation/assistance orchestration, revisioned timeline commands and stored preview grants |
| `frontend/src/server/agent-api/studio-timeline` | OAuth MCP adapter over the same owned revisioned timeline commands |
| `frontend/src/server/timeline-exports` and `frontend/src/remotion/timeline-export` | Quote, request, billing/idempotency, private-media grants, renderer/worker and completed artifact delivery |

Stored graph/media fact types remain part of canonical montage/export data contracts; they have no React Flow dependency or Canvas rendering surface. Preserve their semantics rather than renaming a wire format for aesthetics. The export wire source `maxvideoai-editor` is a format identity, not a second UI.

## Product and data flow

A Project belongs to one account and contains one or more Sequences plus reference/media facts. A Sequence owns its fps, aspect ratio, resolution, tracks, clips and export settings. Account library media and job outputs retain their own ownership/original/preview contracts; a project stores references rather than acquiring ownership of those originals.

Studio entry opens the recent supported project or idempotently creates a fresh connected project. The project popup requests bounded name/date summaries only. A marketing starter produces an editable brief; the user chooses when to send it. No brief, navigation or media selection invokes a paid generation.

The chat builds intent through the common agent/generation services. Owned media and measured reference facts are resolved before pricing or submission. Every generation requires a current exact quote and explicit confirmation. Request/response journal and assistance usage recovery are durable so lost replies can resume without repeating paid dispatch.

The visible timeline edits canonical sequence state with revision and ownership checks. It reuses pure frame-aware operations for clipping, source bounds and linked audio. Library selection does not automatically insert every new generation into the timeline. Preview media uses transient stored grants; signed URLs and private originals must not leak into journal/tool projections or saved command payloads.

Exports use the canonical worker contract and backend pricing/idempotency. The browser estimates, confirms, polls and recovers; it does not manufacture completed MP4s. Completed exports and reusable library media remain account artifacts even if a project is later deleted.

## Retired entry points

Old `/app/studio/projects` URLs redirect to Studio; an allowlisted marketing starter remains a draft brief. Old `/app/studio/workspace` redirects to Studio. An old workspace URL for a supported connected project redirects to that project's conversation; a retired/missing private project returns to Studio.

Private-editor project/sequence POST, PUT and PATCH handlers are authenticated 410 responses with `STUDIO_CANVAS_RETIRED` and the Studio entry URL. There is no old server upsert path to reset `deleted_at` or reinsert a retired ID. Existing read/delete and canonical revisioned workspace command infrastructure remain where current export/MCP consumers need them. New project creation uses `/api/studio/conversation-projects`.

The old browser-storage media handoff helper and consumer had no live production producer and were removed together. Current reference/media selection is the conversational library/shelf flow. Do not recreate a dormant storage protocol in place of that owned flow.

## Private project cleanup

`frontend/scripts/retire-private-studio-canvas.ts` is an explicit operational command. Preview runs inside a read-only transaction and writes a bounded manifest of exact account/IDs and stored-row fingerprints. Apply runs on one dedicated client in a READ COMMITTED transaction with explicit table locks and fresh post-lock snapshots with short timeouts and requires explicit `--apply`.

Only exact inventoried `legacy` projects and their owned private sequences may be deleted. Sequence fingerprints are included in the manifest; all other project/sequence references and timeline export JSON associations block deletion. A connected, foreign, missing/partly missing, changed or referenced candidate aborts the entire operation. Parent/reference table locks fence stale writes during the short transaction. All-already-deleted targets are a bounded no-op. The helper does not bootstrap schema, drop tables, delete shared assets, modify financial evidence or touch storage. Disable old mutation routes before applying the live cleanup.

Do not infer permission from missing chat turns alone: current empty chats and MCP montages are valid connected projects. A legacy project can also have conversation state in older deployments; any such reference blocks physical deletion.

## Changes and validation

Extend pure facts/contracts before adding controls. Keep Next.js pages as access/data/redirect orchestrators and keep server-only data/keys out of client modules. Use shared app appearance and navigation conventions. Avoid broad persistence or billing rewrites in a UI cleanup.

Meaningful shared editing/render/export/media tests remain under `tests/maxvideoai-editor-*` for continuity, with explicit test fixtures rather than retired production templates. `tests/studio-canvas-retirement.test.ts` guards the single interface, old redirects, disabled stale writes and absence of React Flow. Canonical conversation/MCP and export integration/browser suites verify supported behavior; removed Canvas-only specs are not valid public release gates.

Run `npm run test:editor`, `npm run qa:editor`, exposure/diff checks and a full route build. For interaction changes run `npm run test:editor:e2e`. Use the normal clean branch → GitHub PR → current-main Quality CI → Git-backed Vercel release path and verify both live domains against the merged SHA. Report source/bundle measurements separately from actual browser/Core Web Vitals measurements.
