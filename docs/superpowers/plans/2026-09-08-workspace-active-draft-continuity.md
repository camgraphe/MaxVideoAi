# Active video draft continuity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Start only after the model-review Task 2 serializer and prepared-setup application have been independently accepted.

**Goal:** A user who adds references, visits Image/Audio/Tools and returns to Video recovers the same draft, including media roles and specialized settings, under their confirmed account.

**Observed defect:** On 8 September, a ready library image was inserted into Seedance 2.5 Start frame. Video → Image → Video retained the 1909-character prompt and settings but lost the frame. The reference was not removed by the user.

**Architecture:** The existing draft hydration owner coordinates restoration of a complete setup; asset state and async asset handlers retain their separate owners. Reuse the model-review validated setup serializer, account rules and prepared application. Store an active setup independently from the saved model configurations. No new state library, server storage, API or provider changes.

**Inputs:** `workspace-model-setups.ts` and its qualified exports, `WorkspaceModelSetup`, `useWorkspaceDraftHydration`, `useWorkspaceAssetState`, `useWorkspaceRouteFormState`, `useWorkspaceInputSchemaState`, and explicit job/engine/mode hydration. Confirm exported names from the Task 2 report before implementation; do not create a parallel serializer.

## Constraints

- Original media IDs/URLs, slot roles/order, subjects, duration metadata, prompt, negative prompt, voice, multiprompt/scenes, CFG and form values survive. Do not restore references to an unrelated model or silently reinterpret a role.
- Private state is available only with `authStatus === 'authed'`, a user ID and a session token. A token never enters storage. Existing draft `authChecked`, `storageScope` and last-known user fallback are not proof of a confirmed account.
- Session-scoped active storage uses a distinct versioned account key and the same bounded validation as model configurations. No global or prior-user fallback for private assets. Keep legacy public form/prompt compatibility; never import ownerless private references.
- Explicit job reuse, requested model/mode and shared settings retain their existing precedence. Preserve the previous active setup as recoverable before replacing it with an explicit new request. A blocked/failed request does not silently erase it.
- No production, paid generation, new uploads, deployment or database changes. Browser checks use existing ready library assets on the qualification branch.

### Task 1: Persist and restore the complete active setup

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceDraftHydration.ts`.
- Modify: `_hooks/useWorkspaceAssetState.ts`, `_hooks/useWorkspaceAssets.ts`, `_hooks/useWorkspaceReferenceAssets.ts`, `_hooks/useWorkspaceKlingElementAssets.ts` only for account/mount-scoped asset ownership and obsolete callback invalidation.
- Modify: `_hooks/useWorkspaceInputSchemaState.ts` only to prevent reconciliation against an unhydrated/stale schema.
- Add route-local active-draft persistence helper/hook if needed to keep the hydration owner small. Reuse `_lib/workspace-model-setups.ts` validation; keep storage I/O in the hook.
- Wire owner arguments in `AppClient.tsx`; move asset state before hydration if necessary. Do not add storage algorithms or composer JSX to AppClient.
- Add compact localized recovery/save-status treatment through existing ready-view/notice owners where an incomplete or rejected save needs a user decision.
- Tests: new `tests/workspace-active-draft-dom.test.ts`, related hydration/asset behavioral tests, and affected `workspace-*-contract.test.ts`.
- Documentation: `docs/engineering/app-experience.md`.

- [ ] Read current serializer/application signatures and relevant architecture contracts. Add a real hook harness that mounts form, asset state, hydration and schema reconciliation. Reproduce attach → unmount → remount losing the original frame before the fix; do not replace this with a source-code assertion.
- [ ] Hydrate the active form, assets and specialized settings together before schema reconciliation. An initial empty render must not overwrite the stored setup. Mark the exact account/hydration generation as ready only after it commits. Never let stale schema effects prune newly restored data.
- [ ] Persist complete ready drafts after committed changes without a debounce that drops the final change during route navigation. Keep the previous valid record when serialization is incomplete, malformed or oversized, and expose the incomplete-save state. Normalize temporary previews only when a valid original exists; do not persist a blob URL or File.
- [ ] Contain storage exceptions. Reuse qualified in-session fallback behavior where available and describe its actual lifetime. Do not claim reload persistence when storage is unavailable. Restoring a rejected/retired-model draft must offer a recoverable state rather than silently evicting it.
- [ ] Ensure account changes/logout mask the prior private draft before it can appear in UI or be submitted. Scope both field and Kling subject callbacks to account and mount lifetime. A delayed upload/mirror completion after departure or account replacement must not write a new draft, notice or library cache. Keep exact reservation-ID checks and preview cleanup; no broad revocation of retained originals.
- [ ] Preserve the ordering of explicit job/engine/mode hydration. If an explicit new workflow replaces the active draft, save the previous setup before replacement and expose it in the existing configurations recovery surface, without allowing a stale request to overwrite a newer edit.
- [ ] Behavior coverage: ready start/end frames; mixed image/video/audio slots; Kling subject frontal/reference/video; source-driven duration; multiprompt/voice/CFG; existing sparse slots; immediate route departure; initial pending auth; A→B→A accounts; logout; retired model; corrupt/oversized/unavailable storage; delayed upload/mirror completion; explicit job and requested-model precedence. Independently assert exact recovered fields and no old-account flashes/callback writes.
- [ ] Run focused behavioral and ownership tests, TypeScript, frontend lint, exposure check and diff check through the sanitized validation launcher. Keep semantic contracts and move their file assertions only when ownership actually changes. No full suite/build while the root preview runs.
- [ ] Browser: attach an existing library image as Start frame, visit Image and Audio, return to Video, and verify the thumbnail, prompt, options and recalculated current quote. Test refresh and Cancel/Recover using the real UI, without generating. Inspect mobile 320/390 and desktop, light/dark; no new permanent row or large empty panel solely for persistence.
- [ ] Document storage scope/lifetime, explicit-request precedence and incomplete-save behavior. Commit scoped files and report exact interfaces/evidence for independent review. Root performs combined validation after this accepted increment.

## Subsequent return-to-slot integration

This task preserves a draft during navigation; it does not yet claim that creating a new image/audio automatically returns to the originating reference slot. That workflow must use the existing `media-handoff.ts` account-scoped token contract and a validated destination, keeping URLs free of private media payloads. Image currently has its own global legacy reference persistence and a canceled-on-unmount debounce; qualify and migrate its ownership before adding reciprocal private handoffs. Audio owns its new confirmed-account persistence in its separate task. Studio owns canonical media resolution and placement. Coordinate these contracts before implementing the return action.
