# Milo: applicable negative companion

## Approved scope

The shared Composer must include its negative-prompt companion in Milo context only when the prepared current engine/mode exposes `negativePromptField`. The same projected value must determine `readOnlyText`, `contextKey` and `applicationReviewKey`.

The current code conditionally allows an inactive preserved draft value to enter the context and invalidate suggestions. Source analysis establishes that conditional path without establishing any actual private value or transmission.

## Behavior

- An unavailable companion is omitted from Milo context. Changing only that preserved value leaves suggestion identity and applicability unchanged.
- An available companion is supplied exactly, including whitespace. Changing it retains ordinary and hard-compatibility invalidation.
- The authored draft remains with its existing owner and appears again when a compatible engine/mode is selected.
- Genuine engine/mode changes retain their guards. Other companions, editor text, references and settings keep their existing behavior.
- Preserve legacy identity for an empty video companion (`''`) and an absent companion (`undefined`, as in image callers). Former contexts containing a nonempty companion must remain distinct after its omission.

## Boundary

`WorkspaceComposerSurface` is the only current caller supplying `negativePrompt` and `negativePromptField`; its prepared input-schema summary owns field applicability. The shared Composer currently adds this owned value in three places. Project it once there; do not change hydration, storage, schemas, transport, server/provider, reducer, recovery, billing or output text.

## Evidence

Exercise the real Composer and suggestion hook/reducer using synthetic draft state in JSDOM. Replace only the assistant UI/funding shell with a test sink; disable live transport and reject unexpected fetches. Cover unavailable/available companions, other companion preservation, draft retention across engine changes and mode-specific availability. These tests establish local context and guard behavior, not supplier semantics or any past private state.

Root owns publication, independent review, CI, Preview and delivery. No live UI, provider call, merge or deployment is part of this change.
