# MCP Reference Asset Deletion Design

**Approved:** 2026-09-13

## Goal

Allow a user-owned MCP reference uploaded through the direct browser handoff to be
removed from every library projection and then deleted from storage through the
existing retryable cleanup worker. The change must not expose a new destructive MCP
tool, delete shared objects, or make storage deletion part of the request transaction.

## Current gap

`deleteLibraryAsset` only soft-deletes `media_assets`. The matching `user_assets`
projection can therefore reappear in legacy listings. Successful MCP uploads also
leave their final and thumbnail cleanup records in `retained`, while the current
worker only deletes abandoned `pending` objects. Direct storage deletion would be
unsafe because the final object is content-addressed and can be shared.

## Chosen design

Keep all existing DELETE routes and their response contract. Move deletion ownership
to `frontend/server/media-library/asset-deletion.ts` and keep the public media-library
facade stable.

Inside one database transaction:

1. lock the exact undeleted `media_assets` row owned by the authenticated user;
2. soft-delete that canonical row;
3. delete same-owner `user_assets` projections with the exact canonical URL unless
   the projection ID belongs to another undeleted canonical media row using that URL;
4. resolve only completed MCP upload attempts whose `staged_asset_id` matches the
   canonical public asset ID and owner;
5. transition their cleanup rows from `retained` to `released`.

`released` means the user removed the canonical asset and the worker may delete the
object after proving it has no remaining owner. It is distinct from `pending`, which
means upload finalization did not establish durable ownership.

Migration 43 adds the state and enforces these transitions:

- `pending -> retained | deleted`
- `retained -> released`
- `released -> deleted`
- `deleted` is terminal

Identity fields remain immutable. A partial index keeps released cleanup bounded.

The migration adds an `AFTER` soft-delete trigger for completed MCP uploads. This
keeps a rolling deployment safe when an older application instance still executes
the former media-only UPDATE: the same transaction removes exact same-owner
`user_assets` projections and releases only cleanup rows linked through the completed
attempt and canonical public asset ID.

Already soft-deleted uploads are reconciled by a bounded phase of the existing cron,
not by unbounded migration DML. One database statement selects at most the configured
batch, removes exact projections, and releases their retained cleanup rows. This
prevents pre-deployment tombstones from remaining permanently visible or retained
while preserving the existing 404 behavior for later duplicate DELETEs.

The existing reference-upload cleanup worker additionally selects released objects.
It groups by object key, checks all live `user_assets` and undeleted `media_assets`
references, and refuses deletion while another cleanup owner is `pending` or
`retained`. Final and thumbnail objects both use the durable object fence and one
deletion lease per key, preventing two workers from deleting the same object and
preventing a new reference from being persisted during the storage effect.

Migration 43 broadens the fence key contract to the exact owned namespaces
`user-assets/by-content/` and `user-asset-thumbs/` and adds thumbnail
persistence/release triggers. Every primary
URL field (`media_assets.url` and `user_assets.url`) accepts either exact namespace;
thumbnail projection fields (`media_assets.thumb_url` and
`user_assets.metadata->>'thumbUrl'`) accept the thumbnail namespace. URL checks use a
strict common URL-to-owned-key parser. Substring matches, including a key appearing
only in a query string, never count as ownership in either released cleanup or the
older pending/expired-attempt cleanup path.

Historical thumbnail cleanup rows acquire their fence lazily immediately before a
claim. This avoids an unbounded migration scan while retaining the same reference
recheck and lease exclusion before storage deletion.

A successful storage effect marks every released row for that key deleted; a failure
leaves them released for retry.

A claim can also move a stale `referenced` fence directly to `deleting` after the
atomic reference recheck. This closes the concurrent-last-owner trigger race, while
an active producer lease continues to block that transition. The bounded tombstone
scan is backed by a partial `(deleted_at, id)` index for deleted rows with a public ID.

Owned-key URL parsing is case-insensitive for the scheme and accepts only exact
first-party storage authorities, not generic multi-tenant cloud domains. An optional
base pathname may precede the namespace, but the key must occupy complete pathname
segments and never query or fragment data. Scheme and authority matching is
case-insensitive but requires HTTPS; namespace segments are exact lowercase strings.
Plain HTTP and uppercase namespace lookalikes are not owners. An unrelated authority
with a matching path is never an owner.
Runtime custom authorities cannot be represented faithfully inside immutable SQL
parsers without a shared database authority registry, so matching paths on an
unrecognized authority conservatively quarantine only that key at deletion-claim
time. Persistence and release triggers use the recognized parser or quarantine parser
to serialize these URLs through the same fence without promoting them to retained
ownership. This prevents false-negative deletion while keeping the trust distinction
explicit.

The HTTP request only schedules cleanup. The cron remains the sole storage-effect
owner, so failures and lost acknowledgements remain retryable.

## Scope

This covers the direct MCP upload handoff backed by
`mcp_reference_upload_attempts` and its cleanup ledger. It does not claim cleanup for
`import_reference_files`, which currently has no matching durable upload ledger.

No new MCP tool, route, response field, live upload, storage mutation, marketing
promotion, or publication-state change is part of this implementation.

## Safety invariants

- Authentication and owner scoping remain route-level prerequisites.
- Client input never supplies a storage key.
- A shared final or thumbnail reference blocks deletion through exact parsed keys.
- A same-owner projection belonging to another live canonical asset is preserved.
- A pending or retained competing upload owner blocks deletion.
- Storage failure leaves a durable retryable state.
- Reupload/persistence cannot win after a final or thumbnail deletion lease is claimed.
- Concurrent workers cannot claim the same final or thumbnail key.
- Pre-deployment completed MCP tombstones are released without touching unrelated assets.
- Library deletion remains idempotent and preserves the existing 404/success shape.

## Verification

Use disposable PostgreSQL tests for state transitions, projection removal, legacy
tombstone backfill, strict URL parsing, shared-key protection, grouped deletion,
failure retry, final/thumbnail cleanup, two-worker exclusion, and concurrent
reference persistence during storage effects. Keep route/architecture contracts, MCP
listing/ownership tests, lint, exposure lint, TypeScript checking, and
`git diff --check` green before any real upload is attempted.
