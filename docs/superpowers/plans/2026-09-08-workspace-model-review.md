# Workspace Model Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Choosing a video model previews its actual adaptations and quote without changing the draft, and preserves previous configurations and their references for recovery.

**Architecture:** Reuse one pure workflow projection for the existing live composer and the candidate; reuse the canonical preflight request builder and scoped quote hook. A route-local review controller owns candidate selection and account-scoped saved configurations; a compact accessible panel presents the changes. AppClient remains an orchestrator, schema/asset reconciliation retains its owner, and the existing full family/variant catalogue remains available.

**Tech Stack:** Next.js, React, TypeScript, CSS modules, node:test, JSDOM.

**Spec:** docs/design/global-app-concept/integration-contract.md (compare the current draft, preview model changes, preserve references); docs/design/global-app-concept/visual-rules.md; docs/superpowers/plans/2026-09-08-app-studio-parallel-roadmap.md.

## Global Constraints

- No pricing formula, model publication policy, provider routing, new dependencies or global state library changes.
- Price and generation stay server-authoritative. Do not rank quotes for different duration, resolution, mode, references, audio or quantity as equivalent.
- Preserve exact original media IDs/URLs and all useful model-specific settings. Never truncate a prompt or delete a source to make a candidate fit.
- The current draft is unchanged until Apply. Cancel and closing the panel must leave it unchanged. Saved configurations remain available after subsequent switches and route navigation in the same browser session.
- Persist private references only under the confirmed account, with no unscoped fallback and no tokens in storage or logs. Pending account data and stale closures cannot expose or restore another account's snapshot.
- Full catalogue/families/variants/search/legacy availability remain owned by EngineSelect. No custom subset replacing it.
- Mobile minimum 44px actions, keyboard/focus/Escape, one bounded scroll body and visible actions. Reuse MaxVideoAI tokens, AppGlyph and EngineIcon; support EN/FR/ES and light/dark.
- No production, paid runs, uploads, push, main merge or deployment. Existing isolated branch; delegated work uses Astra.

### Task 1: Shared workflow projection and safe candidate preparation

**Files:**
- Create: frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection.ts
- Create: frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate.ts
- Modify: frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts
- Modify only where pure derived facts are shared: frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState.ts
- Test: tests/workspace-model-candidate.test.ts, tests/workspace-workflow-projection.test.ts
- Update affected ownership contracts: tests/workspace-composer-generation-split-contract.test.ts and existing affected workspace capability contracts.

**Interfaces:**
- Consumes actual EngineCaps, FormState, ReferenceAsset, KlingElementState, MultiPromptScene, existing family workflow helpers, coerceFormStateForEngineChange, summarizeWorkspaceInputSchema and reconcileReferenceAssets.
- Produces a pure resolver used both in the live engine/mode hook and candidate preparation. Move the existing calculations, keeping semantic behavior: reference status/durations, implicit/manual mode, unified first/last mode, submission mode, family control support and audio control. Stateful persistence, requested-engine refs and effects stay in their hooks.

```ts
export function resolveWorkspaceWorkflow(options: {
  engine: EngineCaps;
  form: FormState;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
}): WorkspaceWorkflowProjection;
```

WorkspaceWorkflowProjection names must match the derived fields currently returned by useWorkspaceEngineModeState where those are moved. Do not fork family-specific rules for the preview. Extract a small second pure helper for effectiveDurationSec/voice/multiprompt only if required so candidate quotes match the existing composer; the live hook must consume it too.

```ts
export type WorkspaceModelSetup = {
  form: FormState;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
  prompt: string;
  negativePrompt: string;
  multiPromptEnabled: boolean;
  multiPromptScenes: MultiPromptScene[];
  shotType: 'customize' | 'intelligent';
  voiceIdsInput: string;
  cfgScale: number | null;
};
export function prepareWorkspaceModelCandidate(options: {
  engine: EngineCaps;
  current: WorkspaceModelSetup;
  locale: string;
}): WorkspaceModelCandidate;
```

WorkspaceModelCandidate exposes the prepared setup, workflow projection, effectiveDurationSec, supportsAudioToggle, voiceControlEnabled, structured setting changes, references kept/removed, comparable boolean and any blocking input/unsupported-workflow reasons. Define these types in the new module with exported names; Task 2 consumes them directly. Changes cover effective mode/duration/resolution/ratio/FPS/audio/loop, quantity and model-specific settings that become inactive. Missing media and long prompts are validation information, never invented inputs.

- [ ] Capture existing live derived behavior with real engines in the P0/P1 tests before extraction. Add cases for Seedance start/end versus mixed references, MiniMax H3 audio references, Veo first/last, Kling subjects, manual extend/retake, Omni context and source-driven duration. Run focused tests before modifying the hook.
- [ ] Move the pure derivation to the shared resolver, keeping all existing public hook fields/effects. Do not move mode orchestration back to AppClient or duplicate the original resolver for candidate use.
- [ ] Implement candidate preparation: begin with the same requested-engine coercion as a real switch; derive the candidate workflow/schema, reconcile asset fields and budget with NO release callback, normalize allowed extra settings and repeat only until stable. Bound convergence; return a non-applicable reason if it cannot stabilize. Never mutate or revoke the original assets. Use type/role/capacity information, not assumptions from provider names. Do not move a reference into a semantically different role automatically.
- [ ] Report removed assets and changed settings explicitly. Keep the original setup separately for the later snapshot; it is not part of the candidate's charge request. Mark comparable only if the effective generation conditions remain equivalent, including roles/asset identities, voice/multiprompt and specialized settings.
- [ ] Tests must demonstrate real behavior, not just call the resolver twice. Example expectations with real fixture inputs:

```ts
assert.deepEqual(current, before, 'candidate creation does not mutate the current setup');
assert.equal(candidate.setup.form.engineId, target.id);
assert.equal(candidate.comparable, false, 'adapted duration or dropped reference is not an equivalent quote');
assert.equal(candidate.removedReferences[0].asset.url, originalUrl);
assert.equal(candidate.effectiveDurationSec, expectedSourceDuration);
```

Use the project's existing real engine fixtures/helpers and independently expected mode/duration values. Also run existing p0-video-workspace, workspace-reference-model-matrix, p1-workspace-capabilities and affected contracts to preserve actual behavior.
- [ ] Update ownership contracts to point to the new pure responsibility rather than relaxing semantic constraints. Typecheck, focused lint/tests, self-review, commit and report signatures/counts. Do not run the full suite/build while the controller's preview is active.

### Task 2: Preview, compare and recover model configurations

**Files:**
- Create: frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceModelReview.ts
- Create: frontend/app/(core)/(workspace)/app/_lib/workspace-model-setups.ts
- Create: frontend/app/(core)/(workspace)/app/_lib/workspace-model-review-copy.ts
- Create: frontend/app/(core)/(workspace)/app/_components/WorkspaceModelReview.client.tsx
- Create: frontend/app/(core)/(workspace)/app/_components/workspace-model-review.module.css
- Wire in: frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView.tsx and WorkspaceAppShell.tsx; use route-local hooks/props and avoid new inline ownership in AppClient.
- If necessary for an atomic prepared setup application: add an explicit prepared form callback in useWorkspaceEngineModeState.ts, forwarded through useWorkspaceComposerState.ts. Preserve request override ref cleanup from the existing handleEngineChange.
- Test: tests/workspace-model-setups.test.ts, tests/workspace-model-review-dom.test.ts, affected workspace contracts.
- Document: docs/engineering/app-experience.md.

**Interfaces:**
- Consumes WorkspaceModelSetup/WorkspaceModelCandidate and prepareWorkspaceModelCandidate from Task 1.
- Consumes buildWorkspacePreflightRequest(options) from the current-quote prerequisite, and useWorkspacePreflightQuote({request, iterations, accessToken, authChecked}); quote observations must remain scope-bound.
- The Retry action may add an explicit retry command to the scoped quote hook. A retry creates a fresh observation for the same request/account and invalidates the earlier response; never put a nonce into the commercial request or rely on a batched null→same request toggle. Cover retry after failure and superseded retry completion in the existing lifecycle test.
- Review hook exposes requestModel(engineId), close, apply, selectSavedSetup and current panel/recovery state. It receives current form/assets/composer/auth/draft owners explicitly; the visual panel only renders and calls these commands.
- Saved setup serialization is pure. Storage I/O is in the hook, exceptions contained. Store one last setup per engine for the confirmed account in sessionStorage, maximum serialized record 1 MiB; never silently evict references on overflow. Persist version, account, model ID, updatedAt and validated setup; no auth token, blob URLs, File objects or unscoped fallback. A ready asset with an HTTP(S) original can normalize its temporary preview to the original for recovery. Inputs still uploading block the switch, with a short visible reason.

- [ ] Add lifecycle tests for request→Cancel (all setters untouched), Apply (current configuration saved first, candidate committed together), model A→B→C (A and B remain recoverable), and account A→B/logout (no old snapshot or stale callback exposure). Use actual hook/render output and click interactions. Add malformed/oversized storage, storage unavailable and ready-original serialization tests.
- [ ] Implement the snapshot store and controller. Preserve the previous configuration before any switch/pruning; preserve in memory when sessionStorage is unavailable and state the session-only limitation. An oversized serialization must not silently discard data: retain the live configuration and give a bounded reason instead of applying a destructive transition. Reopening a saved setup uses the same review path and saves the configuration it replaces. Deep-clone serializable settings/arrays so later mutations cannot alter a saved setup.
- [ ] Intercept the creator's existing family/variant selection callback to open the review for a different model. Choosing the current model closes normally. Keep the full existing selector and its disabled reasons. Add a compact visible Compare/Configurations command by the model area; avoid adding a separate row on narrow mobile when it fits beside the label/control. Recovered setups must be accessible by keyboard/touch even after another switch or route return.
- [ ] Render a two-column current/candidate summary on desktop, stacked compactly on mobile: model identity, short setting chips, changed values emphasized, reference count/type, and current versus candidate quote. Candidate quoting happens only for the selected candidate, never 40 simultaneous preflights. Different conditions are labelled as adaptations and do not show a percentage saving or cheaper ranking. Required missing media shows a reason and no invented price; selecting such a model may proceed to let the user provide its required input, but it must be labelled as configuration-only and generation remains under the existing guard. For otherwise valid inputs, wait for the candidate quote before Apply; errors expose Retry/Cancel instead of an old quote.
- [ ] Show exact removed reference roles/counts and their preserved configuration destination. Keep references' image/video/audio identities; no media element autoplay. Prompt length, multiprompt/voice or specialized settings that cannot carry over appear in the changes; never truncate them silently. Provide an explicit Apply model and Cancel footer. Use the existing accessible modal hook and mount/unmount ownership, preserving focus after the selector closes. Restore original focus and release body scroll on Cancel/Escape.
- [ ] Test rendered changes/quotes and focus, plus superseded target responses and draft edits while the panel is open. A source draft changed after preparing the candidate must invalidate/recompute before Apply; a stale click cannot replace newer user edits.
- [ ] Visually verify real EN/FR UI, mobile 320/390/478 and desktop, light/dark. Verify no horizontal overflow, visible footer/actions, unchanged draft on Cancel, new quote after Apply and saved setup recovery. Screenshot and inspect; do not substitute static markup tests for visual review.
- [ ] Typecheck, lint, relevant behavior/contracts. Update documentation with owners, snapshot scope/lifetime and comparison limitations. Self-review, commit and report. Controller performs independent review then the full generation/persistence regression suite and build once for the combined increment.

## Subsequent continuity work

After this increment, reconnect creating a new reference in another creator to its source draft/slot using the existing media handoff and the now-explicit saved setup boundary. This requires its own image/audio route inventory; it is not a reason to ship model switching with lost references. Studio/Tools/Billing/Activity tasks keep their separate owners and integration reviews.

### Confirmed active-draft gap and required follow-up boundary

Actual browser reproduction on 8 September: insert a ready library image as Seedance 2.5 Start frame, navigate Video → Image → Video. The 1909-character prompt and form settings survive; the start frame is gone. `useWorkspaceDraftHydration` stores form/prompt/voice/multiprompt fields but no `inputAssets`, Kling elements or CFG. `useWorkspaceAssetState` initializes to an empty object on each mount. Saving configurations only when changing model does not fix this navigation case.

- The follow-up must reuse Task 2's validated setup serialization for a current active setup, under the confirmed account only. Hydrate form and reference roles together before schema pruning and preserve explicit requested job/engine/mode precedence. Stored active setup remains recoverable when an explicit new request opens another workflow.
- Keep hydration in `useWorkspaceDraftHydration` and private asset lifecycle in route-local hooks. `AppClient` may move the asset-state hook earlier and pass the additional owners, but must not gain storage or hydration algorithms. Account changes and unmounts invalidate old upload/restore callbacks; private assets cannot flash from the prior account before effects.
- Initial empty state must not overwrite a stored setup before hydration. Ready original URLs/IDs are preserved; temporary blob previews can normalize to a valid original. Uploading/error/local-only assets need an explicit incomplete-save state, not a silently truncated snapshot. Storage exceptions and oversized records do not authorize data loss.
- Add real mount → attach → unmount → remount and account replacement tests, then reproduce the route sequence in the browser. Include mixed image/video/audio inputs, Kling elements, source-driven duration, explicit job reuse and a stale upload completing after departure. The model snapshot recovery tests alone are insufficient.
- Image already persists references in `image/_hooks/useImageComposerPersistence.ts`, but uses a global localStorage key and a debounced write canceled on unmount. Inventory and qualify that owner before connecting return-to-slot flows; do not copy that unscoped pattern into new private setup storage. Audio owns its new account-scoped persistence in the separate task `01a07e47-84df-7543-996d-74d39d496c67` and has received the interface coordination request.
