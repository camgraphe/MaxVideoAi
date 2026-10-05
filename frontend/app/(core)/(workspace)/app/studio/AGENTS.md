# MaxVideoAI Studio Guide

Studio has one public interface: the conversational workspace. The owner explicitly retired the private Canvas and authorized deleting its personal projects on 2026-10-05; do not rebuild it or introduce a project-migration flow.

## Ownership

- `page.tsx`, `_components/`, `_hooks/`, `_lib/`: direct chat entry, bounded owned project picker, stable creation identity and optional editable marketing briefs.
- `conversation/[projectId]/`: artistic chat, media shelf/selection, metered assistance, canonical generation quotes, connected timeline and exports.
- `_shared/`: supported timeline/edit/render facts, project/sequence normalization, playback layers/hooks, export controller and generation-mode certification used by Studio, MCP and the export worker.
- `projects/page.tsx`, `workspace/page.tsx`, `workspace/[projectId]/page.tsx`: old-URL redirects only. No editor/client imports or Canvas creation surface.
- `frontend/src/server/studio/`: owned server persistence, assistance and generation orchestration.
- `frontend/app/api/studio/`: authenticated APIs. Private-editor project/sequence POST/PUT/PATCH handlers return authenticated 410; current project creation uses `conversation-projects`, current editing uses revisioned commands.

Read `docs/engineering/studio-editor-architecture.md` before moving timeline, playback, persistence or export responsibilities.

## Guardrails

- Keep the central chat, interactive media shelf and connected film timeline. Do not add an intermediate project hub.
- Every generation or export requires a current quote and explicit confirmation. No starter brief, picker, media import or timeline edit may implicitly submit a paid generation.
- Project/sequence state and account-owned library media are distinct. Deleting a project does not authorize deleting library assets, jobs, receipts, exports or object storage.
- Keep timeline operations frame-aware, protect locked tracks and preserve linked audio and measured metadata. Reuse the pure `_shared/_lib/timeline` helpers and server command boundaries.
- Final exports require the canonical worker, storage, billing/idempotency and completed artifact; the browser cannot pretend to render server MP4s.
- Keep read routes and module imports free of schema bootstrap. Follow the database/read-route guide for readiness and migration ownership.
- Preserve the current conversation journal, pending request identities and financial recovery. Old assistance receipts/policy recovery remain necessary even though the old Canvas is gone.
- Appearance belongs to the shared app menu/theme preference; do not create a second Studio theme store.
- Model capability/certification and shared API facts remain authoritative. Do not add UI-local model/pricing allowlists.
- `_shared` may contain stored graph/media fact types used by canonical montage/export contracts; these are data, not permission to restore React Flow or a Canvas editor.
- Keep optional panels accessible, responsive and visually consistent with the current Studio.

## Verification

Run `npm run test:editor` and `npm run qa:editor` for Studio changes. Use the canonical Studio browser validation lane (`npm run test:editor:e2e`) for interaction changes. Retain meaningful pure timeline/export/media and connected Studio/MCP coverage when retiring obsolete UI tests.

Retirement is enforced by `tests/studio-canvas-retirement.test.ts`. Explicit private-project deletion is owned by `frontend/scripts/retire-private-studio-canvas.ts` and its bounded injected helper, tested against disposable PostgreSQL. Never run broad cleanup against all projects or auto-apply it as a schema migration.
