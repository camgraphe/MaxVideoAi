# Workspace App Route Guide

This route is the main signed-in video generation workspace.

## Responsibilities

- `AppClient.tsx`: top-level orchestration only; it wires route-local hooks into route-local surfaces.
- `_components`: route-local chrome, boot surfaces, gallery/preview surfaces, runtime modals, panels, skeletons, wallet/auth modals, and presentational UI.
- `_hooks`: route-local stateful workflow hooks for bounded client concerns such as draft storage/hydration, asset library, upload orchestration, composer mode/settings orchestration, gallery action orchestration, pricing/auth gate orchestration, generation runner orchestration, render state and polling, and video settings application.
- `_lib`: route-local pure helpers for previews, render grouping, render status reconciliation, generation input preparation, generation guards, local render preparation, generation payloads, accepted results, generation polling projections, video settings hydration, workspace boot hydration, storage, copy fallback, client constants, asset normalization, asset selection, payload builders, input normalization, and workflow mapping.
- Tool-specific workspaces should stay in their own route folders unless code is clearly shared.

## Refactor Rules

- Extract stable UI and pure helpers before moving generation state.
- Keep schema summarization, asset-library normalization, and copy merging in `_lib`; `AppClient.tsx` should consume those results instead of rebuilding them inline.
- Keep workspace input-schema state in `_hooks/useWorkspaceInputSchemaState.ts`; `AppClient.tsx` should not derive promoted fields, asset field ids, upload lock reasons, or asset-pruning effects inline.
- Keep render grouping and preview tile mapping in `_lib`; `AppClient.tsx` should decide state transitions, not rebuild group summary objects inline.
- Keep job-to-render conversion, status polling projections, and recent-job reconciliation in `_lib`; route-local hooks should own render state, timers, and bounded network polling.
- Keep generation attachment ordering, derived input URLs, Kling element payloads, and multi-prompt payloads in `_lib`; `AppClient.tsx` should consume prepared inputs instead of deriving attachment URLs inline.
- Keep generation validation guards and `runGenerate` payload assembly in `_lib`; route-local hooks should own generation network orchestration while `AppClient.tsx` wires UI state.
- Keep composer mode inference, engine switching, multi-prompt derived state, voice-control derived state, and settings handlers in route-local hooks; `AppClient.tsx` should wire returned values into composer, settings bars, and generation runner props.
- Keep the composer and settings JSX in `_components/WorkspaceComposerSurface.tsx`; `AppClient.tsx` should not import `Composer`, `SettingsControls`, `CoreSettingsBar`, or Kling builder UI directly.
- Keep gallery action orchestration, guided sample navigation, and preview open/continue/refine/copy behavior in route-local hooks; `AppClient.tsx` should pass returned handlers into rails, cards, and preview surfaces.
- Keep preflight pricing, member-status refresh, wallet top-up modal state, and auth gate modal state in route-local hooks/components; `AppClient.tsx` should wire returned state into composer and generation runner props.
- Keep local pending-render and selected-preview preparation in `_lib`; `AppClient.tsx` should apply returned state objects and own timers.
- Keep accepted `runGenerate` response projection and immediate render/preview patches in `_lib`; `AppClient.tsx` should dispatch events and start polling.
- Keep generation polling projections and poll-delay decisions in `_lib`; `AppClient.tsx` should own `getJobStatus`, timers, and React setters.
- Keep video settings snapshot parsing and job media patch mapping in `_lib`; route-local hooks should wire those results into React state and own settings hydration requests.
- Keep workspace request parsing and boot hydration decisions in `_lib`; route-local draft hooks should apply the resolved state and keep browser storage reads/writes out of `AppClient.tsx`.
- Keep route shell UI in `_components`; `AppClient.tsx` should render named surfaces instead of owning gallery cards, preview dock internals, boot skeleton composition, or runtime modal JSX inline.
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
