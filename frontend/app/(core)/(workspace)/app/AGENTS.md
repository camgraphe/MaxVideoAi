# Workspace App Route Guide

This route is the main signed-in video generation workspace.

## Responsibilities

- `AppClient.tsx`: top-level state orchestration while the workspace is being split.
- `_components`: route-local chrome, panels, skeletons, modals, and presentational UI.
- `_lib`: route-local pure helpers for previews, storage, copy fallback, client constants, asset normalization, payload builders, input normalization, and workflow mapping.
- Tool-specific workspaces should stay in their own route folders unless code is clearly shared.

## Refactor Rules

- Extract stable UI and pure helpers before moving generation state.
- Keep schema summarization, asset-library normalization, and copy merging in `_lib`; `AppClient.tsx` should consume those results instead of rebuilding them inline.
- Keep generation, polling, wallet, preflight, and upload behavior unchanged unless the task explicitly targets those flows.
- Keep browser storage keys and pending-render serialization backward compatible.
- Do not introduce a global state library until repeated state sharing across workspace surfaces justifies it.
- Use existing SWR hooks and `frontend/lib/api.ts` contracts before adding a new data layer.
- Keep dynamic imports for heavy browser-only panels and modals.

## Checks

For small route-local extractions:

```bash
npm --prefix frontend run lint
cd frontend && ./node_modules/.bin/tsc --noEmit
```

For generation, polling, or persistence changes, also run:

```bash
pnpm run test:validate
```
