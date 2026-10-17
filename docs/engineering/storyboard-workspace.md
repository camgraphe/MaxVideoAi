# Storyboard workspace

`frontend/src/components/tools/StoryboardWorkspace.tsx` is the route controller
for `/app/tools/storyboard`. Its outer auth boundary keys the stateful workspace
by confirmed account id or guest. Account changes discard the previous brief,
references, selected history, results, notices and request lifetime before the
next account renders. A token refresh for the same account preserves that state.

## Owned asynchronous actions

`storyboard/_hooks/useStoryboardAccountScope.ts` captures the current bearer token,
abort signal and `isCurrent()` guard for each action. Tokens remain transient;
they never enter browser storage or cache keys. History, uploads, generation,
included Kling first frames, hiding the included job and Save to Library use this
context. Later generation/hide steps and upload dispatch after local preparation
recapture the current token for that same account, so refresh does not pin an
expired token to the whole workflow. Check ownership after asynchronous boundaries and before secondary
requests, storage writes, state updates and notices. Aborting a browser request
does not cancel a generation already accepted by the server; its output remains
in the original account's history.

`useStoryboardRecentOutputs` additionally uses a request sequence, so an older
refresh cannot overwrite a newer response or its loading/error state. Its
account-bound capture function stays stable during token refresh.

The existing pricing hook still owns generation/edit estimates and tariff
revision refresh. It is remounted by the account boundary, and its obsolete
effects cannot apply prices to the next account. The auth modal is a presentational
component under `_components/StoryboardAuthModal.tsx`.

## References

`useStoryboardReferences` owns one upload identity and abort controller per slot.
Removing, replacing or selecting a library image retires that slot's upload.
Completion and failure both revalidate identity, including inside deferred React
state updates. Preparation also revalidates before dispatch, so a removed file
cannot start an upload after compression. Retiring one slot does not cancel
other slots. Unmount retires outstanding uploads and releases local blob previews.

The selected exact original remains the generation input. This change does not
alter thumbnails, image optimization, media storage or provider execution.

## Browser storage and generator handoff

The workspace uses account-suffixed browser keys:

- `maxvideoai.storyboard.klingFirstFrames.v1:<userId>` in local storage;
- `maxvideoai.storyboard.generatorHandoff.v1:<userId>` in session storage.

The video workspace consumes and removes only its own handoff, using its confirmed
storage scope. Ownerless historical entries are deliberately not adopted. They
are not deleted or migrated into an arbitrary account; saved boards and included
frames remain available through the server's owned history. The first-frame
storage helper retains an unscoped compatibility signature for existing utility
callers; the authenticated workspace always supplies the account id.

## Verification

- `tests/storyboard-account-lifecycle.test.ts`: actual controller, hooks and API
  adapters with controlled host auth/transport; A → B, logout, late history,
  uploads, board/first-frame completions, saves and same-user token refresh.
- `tests/storyboard-reference-upload-lifecycle.test.ts`: remove, replace,
  response inversion, stale failures, library selection and late preparation.
- `tests/storyboard-kling-first-frame-storage.test.ts`: original matching,
  malformed values and rejection of ownerless/foreign entries for an account.
- `tests/workspace-shared-video-intent-dom.test.ts`: actual video import hook
  rejects ownerless/foreign handoffs and applies its account's handoff.
- Existing Storyboard pricing, handoff, copy, templates and architecture contracts
  remain part of validation. No production provider generation is needed for these
  regression tests.
