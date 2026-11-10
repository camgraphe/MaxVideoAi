# Library deletion lifecycle

Implementation scope approved 2026-11-10: empty recoverable Trash, retain a neutral
deleted-media slot in Studio with replacement, and protect running work. Quotas
remain disabled. A saved project is not a retention hold. Existing exports,
generation receipts and billing evidence are independent of deleted inputs.

## Contracts and work plan

1. Freeze the complete Trash selection through the existing account-scoped
   selection endpoint. Confirmation sends `{snapshotId, confirmation: 'empty-trash'}`
   to `POST /api/media-library/trash/empty`. Validate every source revision, owner
   and current Trash state atomically before accepting any item. The existing
   10,000-item snapshot boundary applies and errors remain explicit.
2. Persist an idempotent per-identity purge request and its proven root source
   versions. Discover technical descendants once across the selected roots for
   admission tokens; do not build one expensive projection plan per selected item. Immediately remove requested identities from discovery and reject
   Restore. Keep underlying sources readable to work accepted before the request.
   Response: `{ok:true,requestedCount,queuedCount,alreadyQueuedCount}`. No byte
   savings are claimed merely because the request was accepted.
3. A bounded worker waits for existing short-lived access grants and account work
   to finish, then locks/revalidates the original versions. Under those locks it builds and
   persists the current projection/file plan and applies that plan in the same
   transaction. Display derivatives are planned at cleanup, not individually frozen
   by the confirmation dialog. It tombstones owned
   canonical/output sources, removes legacy mirrors and queues only recognized
   owner-scoped storage objects. Preserve independent outputs, other owners and
   completed exports. Missing/changed proof fails closed; object deletion failures
   remain queued and retryable.
4. Protect admission/deletion races at the database boundary. New work using an
   explicitly deleted source is rejected; existing accepted work can finish. Active
   jobs, exports, accepted Creator operations (including finalization), subtitle
   operations, media analysis and live Studio turns delay
   cleanup. A project merely existing never delays it. Unknown execution outcomes
   require their existing recovery owner to settle before destructive cleanup.
5. Studio timeline/reference preview readers opt into `distinguishDeleted` so
   known deletion becomes `MEDIA_DELETED`. Default resolution preserves the
   established `MEDIA_NOT_AVAILABLE` contract for tools, providers and API adapters. Network or
   unknown-source failures remain `MEDIA_NOT_AVAILABLE`. Replacement uses the
   existing revisioned timeline command and picker, preserving clip identity and
   interval. Missing references must not prevent healthy previews from rendering.
6. Storage reports recorded originals, recoverable Trash and pending deletion
   separately. Shared objects are retained until their final live reference is
   removed. Internal retention must carry an explicit reason, not an implicit
   permanent copy. No bucket scan, HEAD fan-out or quota enforcement on reads. See
   [storage accounting](media-library-storage.md) for the original-file estimation
   boundary and overlapping counters.

## Bounded execution and replay

The worker runs only in the production runtime unless a test injects deletion.
Preview database branches share physical storage; their cron must never delete
production objects. The authenticated cron runs every ten minutes, selects at most
20 requests, handles at most ten objects per request, and yields after its 40-second
work budget. S3 calls have a ten-second cancellation signal. Eligible requests move
forward by two minutes before work so blocked accounts and failed deletes yield
the next batch. Shared objects remain queued and are reconsidered after their final
live reference disappears. A five-minute object lease survives uncertain deletes;
producer access is not reopened on a failed remote request.

Discovery allows at most 10,000 technical descendants and eight levels, with a
1,000-per-root aggregate allowance. Exceeding a bound fails explicitly without
truncation. Original/source proof changes return the item to recoverable Trash.
Proven technical preparations are cleaned with their source. Unproved preparations
receive a retained marker and become visible for independent management; their
lineage and recorded storage remain intact.

Account admission locks and physical-object fences serialize generation, imports
and deletion. A possible URL-path alias can only retain/fence bytes; deletion still
requires a recognized host and the exact owner's storage prefix. The existing MCP
producer fence remains the owner for content-addressed uploads and thumbnails.
Provider replays cannot reactivate a purged identity or repopulate removed job
projections. Independent outputs and a new explicit import keep separate identities.

Migration `98_media_library_purge.sql` is an explicit deployment step after the
existing organization/MCP schema migrations. It creates infrastructure and triggers;
it does not enqueue or delete any customer media. No GET bootstraps schema. Keep
its byte-for-byte parity with `MEDIA_LIBRARY_PURGE_SCHEMA` and rehearse on an isolated
Neon branch before the production Git release. Reverting application code must not
drop the deletion ledger or fences.

## Validation and delivery

PostgreSQL tests cover frozen confirmation, owner isolation, restore/version races,
idempotency, running work, concurrent admission, shared storage, deletion retry and
truthful accounting. DOM tests exercise confirmation, mobile layout, account changes
and actual Studio replacement. Use CUA for local/deployed browser QA and hosted CI
for Playwright. Test destructive flows only with dedicated disposable fixtures.

After focused tests, required Quality CI and Git Preview checks pass, incorporate
current main, run deployment alignment checks, merge PR 639 via GitHub, await the
Git deployment and verify both production domains and the affected routes.
