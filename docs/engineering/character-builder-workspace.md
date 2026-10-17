# Character Builder workspace account ownership

`CharacterBuilderWorkspace.tsx` resolves browser authentication before mounting the
stateful workspace. The workspace is keyed by the confirmed user ID (or `guest`),
so changing accounts unmounts its draft, results, references, previews and modal
state before another account renders. Keep this boundary outside all stateful tool
hooks; resetting only the persistence hook after a render can expose the previous
account's data for a frame.

`useCharacterBuilderPersistence` hydrates and writes only confirmed accounts.
The existing version-one state and pending-run payloads are stored under
`maxvideoai.character-builder.v1:<userId>` and
`maxvideoai.character-builder.pending-runs.v1:<userId>`. Reloading or returning to
the same account preserves its draft and resumes its pending jobs. Authentication
loading must not hydrate, clear or overwrite drafts. Guests can edit an in-memory
draft and use the existing sign-in gate; guest edits are not persisted into an
account's storage.

The former unscoped keys have no trustworthy owner. Never import their notes,
references, outputs or pending jobs into a confirmed account. The normal guest
cleanup may remove those deprecated keys, but must not remove any account-scoped
keys. Existing saved outputs remain available through the authenticated history.

`useCharacterBuilderAccountScope` owns the mounted account's request lifetime.
Generation, upload, save, snapshot and pending-status requests capture its explicit
bearer token and abort signal. Unmounting aborts browser requests; response guards
also reject late results when cancellation loses the race. Upload preparation must
recheck the scope before dispatching its request. This does not cancel a generation
already accepted by the server: the original account's persisted pending job can
be recovered later, and existing backend ownership and billing rules still apply.

Token refresh preserves the account boundary and draft. The request-capture callback
stays stable and reads the latest token when called; every polling tick captures a
new request context. Do not restart job-snapshot hydration on token rotation, which
would overwrite an edited draft with the original job settings.

`tests/character-builder-account-lifecycle.test.ts` exercises the real workspace
and hooks with controlled network/auth boundaries: ownerless legacy data, unresolved
auth, A → B → A transitions, same-account reload, guest editing, delayed generation,
upload, snapshot, save and polling responses, and token refresh. Presentation
fixtures expose the actual workspace state; no provider or production API is called.
The existing Character Builder workspace/server architecture contracts continue to
lock their respective responsibilities.
