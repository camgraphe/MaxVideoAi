# Storyboard workspace

`frontend/src/components/tools/StoryboardWorkspace.tsx` is the route controller
for `/app/tools/storyboard`. Its outer auth boundary keys the stateful workspace
by confirmed account id or guest. Account changes discard the previous brief,
references, selected history, results, notices and request lifetime before the
next account renders. A token refresh for the same account preserves that state. While initial auth is
unresolved, the outer boundary renders the existing loading shell before mounting
pricing hooks; account resolution must not issue a second set of three estimates.

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

## Provider and billing

Storyboarder sends boards, edits and the included Kling first frame to GPT Image
2.6 Sunburst through the existing direct OpenAI Images provider. HD output uses
2048 × 1152 and 1152 × 2048. The estimate and reservation both use the active
native tariff cell and the Storyboarder product rule with the historical customer
price as a floor. OpenAI's published output component is the pre-generation
supplier estimate. Prompt and reference input tokens are recorded from the
provider response when available.

The Kling estimate includes both operations in one wallet reservation. The
frame's job ID derives from its paid, completed parent. The child uses the
parent's exact original in its first reference slot and retains the included
payment status throughout direct-provider completion and recovery. When an
image response is ambiguous, the open workspace checks the owned job for its
result for a bounded interval. Recovery reads use the original job ID.

## References

`useStoryboardReferences` owns one upload identity and abort controller per slot.
Removing, replacing or selecting a library image retires that slot's upload.
Completion and failure both revalidate identity, including inside deferred React
state updates. Preparation also revalidates before dispatch, so a removed file
cannot start an upload after compression. Retiring one slot does not cancel
other slots. Unmount retires outstanding uploads and releases local blob previews.

The original remains the generation input. Only the first board slot accepts a
pinned bundled template. The server verifies owned originals against storage
before preparing their signed URLs. A historical Storyboard image can also be
read from its completed, owned job if the original output projection is absent.
For edits, the verified original dimensions determine the historical price floor.

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
  uploads, edits, board/first-frame recovery, saves and same-user token refresh.
- `tests/storyboard-openai-pricing-postgres.test.ts`: public estimate, wallet
  reservation, historical floors and included-parent validation using PG17.
- `tests/storyboard-openai-reference-postgres.test.ts`: original ownership,
  storage metadata and historical projection fallback.
- `tests/storyboard-reference-upload-lifecycle.test.ts`: remove, replace,
  response inversion, stale failures, library selection and late preparation.
- `tests/storyboard-kling-first-frame-storage.test.ts`: original matching,
  malformed values and rejection of ownerless/foreign entries for an account.
- `tests/workspace-shared-video-intent-dom.test.ts`: actual video import hook
  rejects ownerless/foreign handoffs and applies its account's handoff.
- Existing Storyboard pricing, handoff, copy, templates and architecture contracts
  remain part of validation. No production provider generation is needed for these
  regression tests.
