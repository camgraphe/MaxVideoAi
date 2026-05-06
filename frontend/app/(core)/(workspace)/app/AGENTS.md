# Workspace App Route Guide

This route is the main signed-in video generation workspace.

## Responsibilities

- `AppClient.tsx`: top-level state orchestration while the workspace is being split.
- `_components`: route-local chrome, panels, skeletons, modals, and presentational UI.
- `_hooks`: route-local stateful workflow hooks for bounded client concerns such as asset library, upload orchestration, video settings application, and hydration.
- `_lib`: route-local pure helpers for previews, render grouping, render status reconciliation, generation input preparation, generation guards, local render preparation, generation payloads, accepted results, generation polling projections, video settings hydration, workspace boot hydration, storage, copy fallback, client constants, asset normalization, asset selection, payload builders, input normalization, and workflow mapping.
- Tool-specific workspaces should stay in their own route folders unless code is clearly shared.

## Refactor Rules

- Extract stable UI and pure helpers before moving generation state.
- Keep schema summarization, asset-library normalization, and copy merging in `_lib`; `AppClient.tsx` should consume those results instead of rebuilding them inline.
- Keep render grouping and preview tile mapping in `_lib`; `AppClient.tsx` should decide state transitions, not rebuild group summary objects inline.
- Keep job-to-render conversion, status polling projections, and recent-job reconciliation in `_lib`; `AppClient.tsx` should own timers and network calls.
- Keep generation attachment ordering, derived input URLs, Kling element payloads, and multi-prompt payloads in `_lib`; `AppClient.tsx` should consume prepared inputs instead of deriving attachment URLs inline.
- Keep generation validation guards and `runGenerate` payload assembly in `_lib`; `AppClient.tsx` should decide when to show errors and when to call the network.
- Keep local pending-render and selected-preview preparation in `_lib`; `AppClient.tsx` should apply returned state objects and own timers.
- Keep accepted `runGenerate` response projection and immediate render/preview patches in `_lib`; `AppClient.tsx` should dispatch events and start polling.
- Keep generation polling projections and poll-delay decisions in `_lib`; `AppClient.tsx` should own `getJobStatus`, timers, and React setters.
- Keep video settings snapshot parsing and job media patch mapping in `_lib`; route-local hooks should wire those results into React state and own settings hydration requests.
- Keep workspace request parsing and boot hydration decisions in `_lib`; `AppClient.tsx` should apply the resolved state.
- Keep asset-library selection, reference slot insertion, and Kling library asset mapping in `_lib`; route-local hooks should own bounded asset library state, upload orchestration, and network calls.
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
