# Media library organization

## Ownership and deployment

`frontend/lib/media-library-organization.ts` contains browser-safe references,
organization state, operations and collection DTOs. References identify an owned
source; they do not grant access. Internal DELETE IDs, public `ma_` asset IDs,
exact job/output IDs, original URLs and temporary read grants remain distinct.

Migration `97_media_library_organization.sql` is the deployment prerequisite.
The explicit `media-library-organization-schema.ts` owner is exported through
`src/lib/schema.ts` and invoked by application bootstrap and organization writes.
GET and the standalone resolver never initialize or repair schema. A missing
organization table fails honestly. No migration was applied to a live database
while implementing this feature.

Six account-scoped sidecar tables own state: `library_organization`,
`library_organization_aliases`, `library_collections`,
`library_collection_members`, `library_selection_snapshots` and
`library_selection_snapshot_items`. Snapshot tables freeze the exact members of an explicit global selection for ten
minutes. The organization endpoint accepts either explicit references or a snapshot,
never both.
All owner IDs are text. Alias index identities are SHA-256 hashes to keep long
legacy internal IDs out of composite B-tree keys; original typed references are
retained in JSON. Snapshot metadata never owns media bytes.

## Identity and availability

`organization-source-sql.ts` owns account-scoped set queries;
`organization-sources.ts` discovers and locks canonical, legacy, output and job
rows in that table order. `organization-identity.ts` builds proven source groups,
version-qualified aliases, state projections and alias materialization.
`organization-resolver.ts` orchestrates these readers without write fallback.

An exact output ID and its recorded original form a versioned anchor. Different
output IDs remain distinct even when their URLs match. Saved copies join an
output version only through exact owned job/output provenance and original
correspondence. Replacing an output original does not move the old saved copy or
its organization state to the new version. Supplied `sourceRevision` values are
checked against the current persisted original; browse and snapshots must supply
this value. General metadata updates, thumbnails and signed read grants are not
source revisions.

Record components distinguish canonical and independent legacy sources: a coincident
internal ID alone cannot merge distinct originals. Proven copied projections may
share a component despite different stored URLs. Unanchored record derivation
orders creation time chronologically at microsecond precision, then record IDs by
UTF-8 bytes (SQL C collation and Node byte comparison). Source readers normalize
creation timestamps to fixed-width UTC microseconds; persisted alias keys still
take priority over derivation.

Legacy mirrors first use exact shared internal IDs and compatible provenance.
Other legacy projections require an unambiguous canonical match. Ambiguous
legacy records remain independently organizable. Conflicting persisted keys
fail that reference explicitly; favorites, Trash and memberships are never
silently unioned. Registry entries alone never establish ownership or current
availability.

Exact shared-ID, exact job/output ancestry and owned materialized legacy aliases
are collected independently before the similarity window. Later-sorting proof
cannot be displaced by 1,001 unrelated URL matches. Similarity-only overflow
keeps exact known media organizable. Graph edges and output anchors also require
kind agreement; inconsistent image-to-video provenance cannot change identity
when other media kinds join the batch. Materialization rejects conflicting new
alias-to-key assignments before any INSERT.

The exact/materialized proof set has its own 1,000-record **identity-group** cap,
not a library-size cap. `OrganizationSourceBatch.proofLimitedSourceIds` contains
`sourceIdentity(source)` values for overflowing groups. The resolver propagates
this through proven components and returns `IDENTITY_PROOF_LIMIT` without a key,
revision or default organization state. No partial proof or alias writes occur;
unrelated references may still commit. A 1,000-record proof set is accepted.
Common browse fails explicitly on unresolved identity proof; it never substitutes
favorite=false, empty memberships or a guessed Trash visibility/key.

`organization-promotion.ts` wraps the existing canonical save in a real database
transaction and attaches proven aliases before a legacy anchor can disappear.
A failed alias write rolls back its canonical save. Promotion discovery also
filters incompatible job/output ancestry before its 1,000-row ambiguity guard;
an unusually ambiguous legacy-only promotion fails explicitly instead of dropping
old aliases. This bridge does not rewrite
originals or generation history. Recorded storage fences are checked for the
requested original, including quarantined unrecognized authorities; an obsolete
output's unavailable storage does not invalidate a separately saved durable copy.
Unrecorded byte changes behind an unchanged remote URL remain unknowable without
a separate media verification process. No network probe runs here.

## API and mutation semantics

- `GET /api/media-library/collections?limit=30&cursor=…`: account-scoped collection
  page, maximum 100, ordered by stable collection ID. Returns `items`, `hasMore`
  and `nextCursor`.
- `POST /api/media-library/collections`: `{ "name": "Album" }`, returns 201 with
  `collection`. Names are trimmed and contain 1–120 Unicode code points.
- `PATCH /api/media-library/collections/[collectionId]`: the same name body.
- `DELETE /api/media-library/collections/[collectionId]`: deletes the owned
  collection and its memberships only.
- `POST /api/media-library/organization`: `{ "operation": "favorite",
  "references": [{ "type": "asset", "assetId": "ma_…", "kind": "image",
  "sourceRevision": "sr_…" }] }`. Other operations are `unfavorite`, `trash`,
  `restore`, `add-to-collection`, and `remove-from-collection`; the final two
  require `collectionId`. Output refs include `jobId` and `outputId`; explicit
  legacy refs include their stored `assetId`.

Authentication precedes body parsing and database work. Unknown body/reference
fields, mixed snapshot/direct bodies, unknown operations and more than 500 raw
references are rejected. Duplicates count toward 500, receive individual results,
and apply each proven organization key only once. Domain failures coexist with
successful owned changes in a 200 response. Missing collections return 404;
malformed requests return 400 and missing authentication 401.

All valid changes commit together using the real `TransactionQueryExecutor`.
An unexpected statement/commit failure rolls everything back and returns zero
successes with `TRANSACTION_FAILED` (HTTP 500). Source locks precede organization
writes; an account advisory lock serializes overlapping organization actions and
promotion alias registration. The unchanged physical DELETE participates through
its canonical row lock, not through that advisory lock.

`succeededCount` and `failedCount` count requested references. `affectedCount`
counts distinct successfully processed organization keys, including idempotent
retries; it is not a count of changed rows. Trash retains its first timestamp.
Restore clears only organization visibility and preserves the key, favorite and
memberships. It cannot clear physical `deleted_at`, reconstruct a missing source,
restore bytes, change job status or reacquire deleted storage.

Trash has no purge or retention timer. The writer does not call the old physical
DELETE, alter media/legacy/output/job rows, revoke grants or release cleanup
holds. Existing Studio references and Activity keep their independent source
authorization. Browse/picker readers must apply organization Trash before their
limit and winner ranking; the common browse and compatibility asset/recent list owners apply this filter
before pagination. Exact Studio resolution and Activity remain outside that filter.

## Verification

The organization PG17 suite exercises real schema, migrations, transactions,
source locks, storage fences and save promotion. The real route suite exercises
status/JSON serialization, read-only collection GET, missing-schema errors and
no authless database access. Existing facts-only save fixtures use a database
boundary double and make no atomicity claims; the PG suites own those guarantees.

The 500-distinct-media fixture includes canonical assets, legacy mirrors and
outputs. Its SQL-count guard allows at most 64 statements per action, excluding
schema/setup. Set-based source, alias/state and mutation queries currently require
16 total statements, including transaction control. Local socket timings are
fixture evidence only, not production latency or browser performance evidence.
Validated frozen snapshot operations reuse the same internal transaction owners,
with a separate 10,000-member bound and compact key-based outcomes.


## Common browse and frozen selection

`GET /api/media-library/browse` returns `{ok, assets, nextCursor, hasMore,
totalCount}`. Default page size is 30; requests above 100 are capped at 100.
`view=all|saved|review`, `kind=all|image|video|audio`, `source`, `q`, `jobId`,
`surface`, `collectionId`, `favorite`, `trash`, and `sort=recent|oldest|name`
are validated before SQL. The shared client parser maps page `job` links to
`jobId`; a malformed provided filter/cursor never becomes an unfiltered request.
Unknown collections return 404. `favorite=false` has no favorite restriction;
`trash=false` (the default) excludes Trash. `source=all`, false booleans and
trimmed/200-character literal search normalize consistently for cursor binding.
Exact-job lookup retains the existing external-import exception and owner check.
Internal Storyboard templates are excluded; Storyboard first-frame and generator
handoff enrichment uses the existing reader and shared pure handoff projection.

The SQL relation resolves proven identity before source/view filters, chooses a
winner after source filtering, searches matching group members, applies server
organization filters, and derives the exact total before cursor/limit. Cursor
version, normalized scope and owner are bound together. Recent and oldest order
by full-precision timestamp and organization key; name orders a SQL-lowercased
name under explicit C collation, followed by timestamp and key. Empty pages past
the end still return the correct total. Grant/fact enrichment touches only the
bounded selected page; no list read probes, promotes, repairs or initializes.

Each common asset includes `libraryRef`, `sourceRevision` and `organization`
(`key`, `favorite`, `trashedAt`, `collectionIds`). The shared pure serializer
preserves internal ID, public ID/ref when valid, stored facts, exact original
URL, thumbnail/preview, MIME/dimensions/duration, source and job/output metadata.
A live legacy reference has no fabricated public `ma_` ref. Legacy MIME inference
matches compatibility readers when old uploads have missing MIME metadata.
Output records also expose their actual typed output ref, saved state/asset ID,
position and last-frame role. Job prompts are never serialized wholesale.

`POST /api/media-library/selection` accepts `{scope}` and returns 201 with
`{ok, snapshot: {id, totalCount, expiresAt, keys}}`. The same filtered relation is
read under one repeatable-read transaction with LIMIT 10001. Overflow throws
`SELECTION_LIMIT` before materializing any snapshot or organization state. A
successful snapshot stores at most 10,000 frozen typed references and recorded
source revisions, and returns only opaque member keys. Later arrivals do not
join. Empty snapshots are valid. Migration 97 already owns both snapshot tables;
no media retention or purge is attached to expiry. After complete validity and
overflow checks, each accepted create prunes at most one oldest expired snapshot
header for that owner (SKIP LOCKED), cascading its member metadata. Rejected
creates prune nothing; active and other-owner snapshots remain intact.

`POST /api/media-library/organization` additionally accepts
`{operation, snapshotId, excludedKeys?, collectionId?}`. Ownership, ten-minute
expiry, exclusions and membership count are checked server-side. Exclusions must
be unique actual members. Every remaining source is revalidated and locked using
the shared batched resolver; missing/replaced sources or insufficient proof are
reported explicitly. The snapshot response is `{ok, operation, collectionId?,
succeededKeys, failed: [{key,errorCode}], succeededCount, failedCount,
affectedCount}`. Operation/collection describe the common change; counts are
exact member counts and include idempotent successes. No per-member reference,
URL, grant or collection-membership list is repeated in this response. Failed-only
retry uses the original snapshot and excludes every member outside the failed
key set. Unexpected transaction failure reports every attempted member failed
with no successes; direct <=500-reference responses retain their existing shape.

The browse SQL and resolver share canonical/legacy correspondence predicates and
are tested against the same proven output, promoted, mixed-kind and old-version
identities. Over-bound exact/materialized proof fails explicitly. A similarity-only
neighborhood above 1,000 rows also fails for an affected unanchored component when
requested alone or in a batch; it cannot invent a default favorite/Trash state.
Known output anchors, a unique persisted anchor, and exact shared-ID controls remain
usable despite unrelated similarity rows. Owned hidden or deleted outputs still prove
the recorded version of an available saved copy; they do not become visible review
items. Conflicting persisted keys never auto-merge.

Four nonunique lookup indexes are explicit migration/bootstrap prerequisites:
owner plus `md5(url)` and `md5(metadata->>'originUrl')` on legacy assets, and
owner/kind plus those expressions on canonical assets. They avoid oversized B-tree
entries for unbounded source strings. These hashes accelerate equality lookup only:
full URL comparisons and exact ancestry still establish provenance. They are not
organization identities, uniqueness constraints, or permission checks. Migration 97
builds them when the source tables exist; normal full migration/bootstrap ordering
creates sources first. Production rollout must apply/verify these indexes before
serving the new reads; this implementation did not apply or build them in production.

`library-browse-client.ts` owns normalized request/account keys and page-link mapping;
`useLibraryBrowse` uses the existing SWR Infinite stack and exposes server totals.
It does not claim a global search over locally loaded records. The production
management page consumes this path; specialized pickers retain compatibility
adapters described below. Compatibility endpoints retain old cursor/ID contracts and do not add
organization DTOs: saved rows have internal `id`, valid public `assetId/ref` when
available, `jobId` and `sourceOutputId`; recent rows have exact output `id/ref` and
saved-asset metadata. Their internal IDs must never be treated as organization
keys. Cache integration must invalidate/fence all account-scoped compatibility
readers and revalidate, including mirrored and legacy rows.

The distinct 10,000-source PG fixture includes 10,000 canonical assets, 10,000
legacy mirrors and 10,000 owned outputs. It verifies 10,001 rejection without
partial snapshot, later-arrival exclusion, complete failed-source accounting,
failed-only retry, <=64 statements, and a bounded key-only wire response. Query
plans and timings are local fixture evidence, not production latency or browser
Core Web Vitals claims.

## Client mutation coherence and exact private read leases

`hooks/useLibraryCacheRevision.ts` owns account revisions. A confirmed write calls
`invalidateLibraryMedia(initiatingUserId)`; failed writes do not publish speculative
success. `lib/library-mutations.ts::mutateLibraryOrganization` uses `ownedAuthFetch`
and returns the complete direct/snapshot result, including partial failures, while
publishing only when `succeededCount > 0`. Callers retain failed selections for retry.
Collections and other source writers use the same invalidation after confirmation.
No client copy of a 10,000-member organization overlay is retained.

Common browse, legacy saved/recent and image/picker SWR keys append the revision to
the existing URL/account tuple. This changes the Infinite aggregate as well as its
page identities; filtered global mutate alone does not cover Infinite aggregates.
Legacy internal IDs are never compared to organization keys. Inactive scopes and
late responses remain under retired keys and cannot restore old visible rows.
`useLibraryScopePersistence` retains visited page count on a mutation revision but
resets it on account/filter changes. Retired pages are hidden until the server read
settles; this intentionally replaces cross-key `keepPreviousData`, while ordinary
same-key focus behavior remains unchanged. Workspace/Upscale manual readers add
the revision to their existing request fences. Creator and Studio library pickers
retire their local listing scope on the revision; accepted composer/Studio uses do
not subscribe to visibility invalidation. Physical saved-asset DELETE remains
separate from Trash and does not remove a surviving recent output.

Private upload DTOs carry all four existing transient grant fields plus
`readAccessOwnerId`, `readAccessRef`, `readAccessRevision` and `readAccessExpiresAt`.
`readAccessRevision` hashes the exact stored original/thumbnail/preview/playback
URLs. It is separate from organization `sourceRevision`, and the read reference
contains only exact source identity. Original URLs (including unknown-provider
queries), canonical refs and measured facts are unchanged. Projection helpers
forward the complete access metadata through library, picker and selected-reference
handoffs; renewed display state never writes back into the selected asset or draft.

`POST /api/media-library/read-access` accepts only `{reference, revision}` and
reauthorizes the exact owned available asset, legacy asset or owned ready job
output. It shares the existing source projections and storage-deletion fence, then
checks the read revision and exact storage namespace before signing. It performs
no organization grouping, alias/state lookup, schema bootstrap, remote probe or
write. Thus Trash or ambiguous organization proof cannot revoke existing exact
source usage. Missing/deleted/wrong-owner sources fail closed; source or derivative
replacement returns 409. Responses and failures are private/no-store.

`useLibraryMediaAccess({userId, asset, refreshOnMount?})` returns `access`, `pending`, `retired`,
`error`, `refresh`, `ensureFresh` and `beginAttempt`. Readers sharing owner/exact
reference/read revision share one attempt. At most four signing requests run at
once; owner/source retirement aborts work when its last consumer leaves, including
queued work. A failed renewal cannot automatically retry. A successful replacement
permits one new automatic attempt only after that replacement lease actually expires;
an immediate grant200/media403 failure cannot create a renewal loop. This budget
is shared even when a grid thumbnail keeps the source mounted through many leases.
An explicit user retry starts a new attempt. Valid mounted decoders retain their
lease across list polling. Mount/explicit Play initially checks expiry with a 30-second
safety margin; a still-valid already-renewed lease waits for its actual expiry without
creating a false read error; there is no timer that resets a healthy decoder. Lazy grid thumbnails set
`refreshOnMount:false` and renew on their actual read error, avoiding signing work
for invisible stale cards. No renewal fetches original media bytes.

`libraryOriginalAccessHref(asset, 'original'|'download', filename?)` constructs a
native authenticated exact-read link. GET validates the same source/revision and
returns a private 307 to the fresh original grant, or to the existing authenticated
`/api/download` streaming transport with that grant. This preserves click/popup
activation and original bytes; it does not widen download SSRF rules. Public and
older descriptor-free assets retain their existing original-link behavior.

`library-cross-reader-cache-dom` exercises real SWR Infinite and manual owners;
`library-read-renewal-dom`, `library-private-read-dom` and
`library-read-renewal-routes-postgres` cover actual readers, controlled expiry,
bounded/cancelled work, exact PG authorization, all four grants and preserved
selection identities. These are local synthetic-session/PG17 checks, not browser
network, deployed storage or Core Web Vitals evidence.


Private shared display adapters use `useLibraryDisplayAccess(asset, refreshOnMount?)`.
Its `useLibraryReadOwner(enabled)` observer shares one lazy, refcounted Supabase
subscription without redirects or analytics. Descriptor-free readers do not start
it. Pending initial session results cannot override later auth events or retired
subscriptions. Until the active owner matches, `retired` is true: adapters must
unmount readers and suppress original/download/share links, including canonical
URL fallbacks. `useLibraryMediaAccess` remains available to owners with an actual
current account prop; never pass the DTO's `readAccessOwnerId` as that current prop.

A failed replacement after the one automatic renewal publishes a terminal read
error without another request. Explicit audio Retry starts a new bounded attempt,
renews and remounts its decoder; video Retry returns to its explicit Play action.
Creator uploads and Studio uploads/recent promotions publish the captured account
revision after confirmed writes. Studio's optional `saveRecentMediaReference`
`onSaved` callback records commit confirmation before canonical lookup; the UI
publishes in `finally` after lookup/insertion settles, including lookup failure or
account retirement. This preserves successful insertion and never invalidates the
replacement account or inserts into its retired context.


Studio's failed insertion after a confirmed save is owned above the revision-keyed
listing by `AccountImageReferenceLibrary`. The account/project/purpose identity
retires that outcome; a mutation revision does not. Its explicit Retry reuses the
failed output/kind through the existing owned save/canonical-lookup path, and only
inserts after resolution. Lookup failures and rejected retries remain actionable
after list replacement; new filter intent, uploads and insertion attempts clear
the previous outcome. Listing errors stay local to the listing. Confirmed writes
still publish even when insertion fails or the initiating context has retired.

## Compact management browser and retained selection

`LibraryPageClient` keeps the existing authenticated shell, localized copy,
source/kind controls, uploads and per-output Save owner. Its default is the real
common `view=all&kind=all` browse. Existing `view=saved|review`, `kind` and `job`
links still select their original scopes; clearing the linked job removes only
that filter. `useLibraryPageData` delegates to `useLibraryBrowse` and preserves the
complete DTO rather than merging first pages or reimplementing local filters.

`AssetLibraryBrowser` remains the compatibility facade. Its optional management
prop is `{userId, scope, totalCount, onScopeChange}`. That path lazily loads
`CompactLibraryBrowser`; existing selection/picker props continue through their
own insertion owner. The shared `CompactMediaGrid` uses pinned React Aria
GridList/Virtualizer with grid or audio-list layout, controlled organization keys,
loaded-range Shift selection, checkboxes and a separate preview action. Enter on
a focused row opens its source without changing selection. Source/date/details
and existing action slots remain reachable in the current inspector. Density is
a small account-scoped local preference. Styling is scoped under
`.compact-library`, loaded after the app shell by `AppRuntime`; it does not import
the prototype shell or override legacy card classes.

Cards mount no video/audio. A stored thumbnail must be distinct from the original;
legacy `thumbUrl===url`, missing thumbnails and AV URLs produce a placeholder.
Private thumbnail grants use `useLibraryMediaAccess` with the actual account and
no mount-time renewal. Original/read refs and original download/source URLs stay
on the retained media DTO. An unavailable or retired lease never authorizes
falling back to private originals in the grid.

`useLibraryManagementSelection` owns either an ordered Map of retained exact
source DTOs or a frozen snapshot plus opaque member keys and exclusions. It never
prunes selected records because a page is absent, sorting changes or a mutation
revision temporarily supplies an empty loading array. Filters/search/collection
and account retirement reset selection with a localized announcement. A loaded
command is explicit; from global mode it switches back to the loaded explicit
records. React Aria's `all` sentinel selects loaded records, never all server
results. Only POST selection creates a global snapshot. New arrivals are unchecked
until an explicit new selection; expiry requires explicit reselection.

`library-management-selection.ts::runManualOrganization` captures references and
source revisions, rejects more than 10,000 sources before transport and sends
serial requests of at most 500 through `mutateLibraryOrganization`. It returns
confirmed, failed, unconfirmed and unattempted records separately. Confirmed
chunks remain confirmed after later failure or context retirement. Retry uses only
remaining exact records and keeps cumulative confirmed outcomes; transport failure
does not masquerade as a server refusal or an atomic rollback. A changed owner or
filter stops further chunks. Global mode uses its original snapshot and excludes
confirmed keys; a lost transport response leaves an explicitly unconfirmed count.
Listing totals always come from authoritative browse revalidation, never from
loaded length or subtracting snapshot successes.

`useLibraryCollections` owns bounded collection pages and create/rename/delete
through the existing owned routes. Names are trimmed and validated as 1–120
Unicode code points; confirmed writes invalidate the initiating account. The
collection/sidebar and bulk target share SWR keys. No local fake collections or
membership store is maintained.

The grid keeps the same scope's placeholder count/audio geometry while revision
reads replace data. The inspector independently retains its opened exact source;
fresh same-organization metadata updates Saved/organization state without adopting
a different mirror's original, mutation ref or read grant. True scope/account
changes permanently retire its context generation, so returning to an old filter
cannot reopen the old source. A confirmed inspector mutation closes only its own
initiating viewer identity in the still-current generation; closing/reopening even
the same media is a new preview intent. Same-scope replacement and sort retain the
generation. New management Trash, including the
inspector action, uses organization Trash and Restore; the existing physical
DELETE transport remains a separate compatibility owner. Save still sends exact
`jobId/sourceOutputId`, including a second sibling shown with an internal
`output:<id>` display ID. Destination, Studio, Share and Draft Final behavior stays
with the existing action components and source owners.

Common browse and snapshot SQL also consume the authored
`FEATURES.workflows.toolsSection` flag. When disabled, saved candidates from
`storyboard`, `character` and `angle` are excluded before winner selection, totals,
cursor and limit. Generic `saved_job_output` Review projections and other sources
remain eligible. The internal policy argument exists for PG fixture controls;
there is no public bypass flag. Cursor binding includes this policy.

`library-compact-selection-dom`, the existing action/picker suites and
`media-library-tool-policy-postgres` cover these boundaries. JSDOM geometry,
synthetic sessions and disposable PG data establish behavior only. Connected
browser scroll/focus/layout, network and Core Web Vitals qualification remains a
separate release check. The richer viewer/import queue and specialized picker
adapters retain their own owners; this browser does not introduce batch generation
or change destination/model reference budgets.


## Common viewer and real import queue

`MediaActionPanel` retains `MediaDialog` as the sole focus/modal owner. Its optional
`neighbors: AssetBrowserAsset[]` and `onNavigateAsset(asset)` render a bounded
five-thumbnail strip; the calling owner changes its displayed DTO and every action
together. Gallery still gates principal-only callbacks to their real principal;
other outputs keep exact source/settings/download/share/destination actions.
Compact management keeps its opaque context generation and exact opening identity
when navigating; confirmed async actions cannot close a newer opening.

`MediaActionContent({asset, locale, children?, details?})` is exported for inline
picker hosts. It contains no modal or focus trap. The host must key this content
by exact source identity (including original, read owner and source revision),
while keeping its outer dialog stable. `ProgressiveMediaReader` lazily loads
YARL 3.33.0 Inline/Zoom/Video, one active slide with preload zero. Native audio is
inline. `useLibraryDisplayAccess` supplies current-owner retirement and shared
bounded renewal; no viewer reconstructs ownership from a DTO's old account.
Original/download/edit/destination identities remain canonical originals.

`useLibraryImportQueue(userId, context = 'library')` returns `{queue, state}`.
Mount it in the stable account/context host, not in a conditional open dialog.
`LibraryImportQueue({queue, locale})` is inline content for that existing host;
`LibraryImportDialog` is the standalone library presentation. Both use the same
controller. `queue.add(File[])`, `start()`, `retry(id)`, `pause()`, `resume()` and
`retire()` manage actual serial transfers using pinned headless Uppy 6.3.1.
`getSnapshot()` and `subscribe()` expose `{files, running, paused}`. Each file has
`id`, `name`, `status: queued|uploading|success|failed`, optional `error`, `saved`
and the real `result: AssetBrowserAsset`. `saved: true` with failed status means
original storage succeeded but canonical lookup/Restore still needs retry.
No simulated progress, synthetic asset ref or automatic insertion is emitted.

`importLibraryFile(file, {userId, signal})` returns the canonical retained DTO.
`LibraryImportCompletionError` retains the accepted asset and a completion-only
retry closure; retry cannot reupload already accepted bytes. New explicit
same-file import or Save invokes owned Restore so a successful response means
visible saved media. Internal background `ensureReusableAsset` and projection
upserts never clear Trash. Failed Restore returns an error instead of false
success. Existing upload transports, server deduplication, private cleanup and
authorization stay with their original owners. See media-delivery.md for
preparation, private grant and bodyless presign contracts.

The Uppy declaration bridge in `types/uppy-core.d.ts` uses the installed package's
actual class declarations because this application currently uses TypeScript's
legacy node module resolution; it does not redefine SDK APIs or change runtime
resolution. No Dashboard or additional Uppy focus host is mounted.

## Contextual picker acceptance

Ordinary media pickers use `CompactMediaGrid` through `ReferenceLibraryPicker`.
The grid owns only keyboard/checkbox/primary/Preview interaction and virtual layout. Its
optional key/name adapters, single selection and selection-disabled keys preserve
the page library's defaults. Character entities retain immediate toggles and a
separate presentation; Character/look/Recast and owned-generation qualifications
remain in their existing domain owners.

In ordinary pickers, thumbnail activation adds that one exact candidate through
`confirmAsset`; it does not stage it and then submit an older basket. The separate
Preview control only opens inspection. Checkboxes retain ordered staging and one
counted Add action accepts the complete basket. The management gallery leaves the
primary action as its viewer. Empty valid slots in appendable groups open group
addition; occupied, uploading/error and single-role slots retain exact replacement.

Ordinary Create and Image hosts opt into `useReferencePickerBrowse`, which reuses
the account-scoped common browse reader with `view=all`, actual kind/source, server
search and cursor pagination. Explicit Recent uses `review`. These hosts suppress
duplicate legacy listing; specialized generated-video proofs and Character entity
readers retain their own owners. Character Studio media remain distinct from
saved Character/Look entities; the picker links to the existing Character Studio
route without inventing an identity or an unsupported tab URL.

`useReferencePickerSelection` captures ordered original DTOs independently of
loaded pages. Search, kind/source filters, pagination, cache invalidation and
Preview/import/organization transitions retain this basket. It carries source
revisions separately from read leases and original URLs. Known Trash or replaced
sources remain visible with Restore/remove feedback. Cancel discards staged
choices; Character Done/Close retains immediate accepted toggles.

Each opening has an opaque lifetime under its account, destination, model,
explicit workflow intent, role and slot. It cannot be revived by an A→B→A change.
Live budgets and inferred submission modes are validation inputs, not opening
identity. Video passes `activeManualMode` independently of `submissionMode`.
Queue ownership (`useLibraryImportQueue`) lives outside the open presentation;
closing a picker neither inserts nor discards a completed import. Choosing a
successful result stages it, and confirmation is still required. Image defers its
modal module until its first opening, then retains the queue owner while closed.

The authenticated, private/no-store `POST /api/media-library/selection/validate`
accepts `{candidates:[{reference, originalUrl}]}`, capped at 500 before deduplication.
It calls the SELECT-only organization resolver without an executor, matches the
original against the exact typed source, then verifies the owner's authored
revision. A saved copy URL is not an ancestry URL. Ordered results contain only
reference/key/sourceRevision/state/error; they never serialize the internal source
graph. The route cannot bootstrap schema, promote assets, probe remote media or
write organization state. This is a point-in-time read, not a reservation or a
replacement for generation authorization. Legacy job facades without output IDs
must first resolve one exact output within their owned job; no output index or
public identity is invented.

Three domain receivers provide all-or-none draft admission:

- Image: `useImageLibrarySelection` validates the complete ordered candidate against
  current slots/formats and the existing shared regular/Character capacity, then
  publishes through `useImageReferenceSlotLifecycle` once. Explicit replacement
  remains one slot.
- Video: `useWorkspaceReferenceBatch` applies current field eligibility, Seedance
  conflicts and `tryInsertReferenceAsset`/reference-budget constraints. Required
  mirrors prepare first; then `commitInputAssetMutation` reads the latest draft
  and commits once. Completed preparations survive refusal and are reused on retry.
- Studio: `useConversationMediaShelf.attachMany` validates canonical identities,
  the media gate and the existing pre-model conversation ceiling, then publishes
  aliases, references and selection persistence once. Recent promotion stays in
  the Studio picker owner. A successful save with failed canonical lookup retries
  the lookup without saving again. Timeline purpose remains an explicit single
  insertion; model submission ceilings remain separate.

Single-source/typed-role adapters preserve Angle, Upscale/Finishing, Creator,
Subtitles, Storyboard, Character Builder and Audio owners, original payloads and
refusal contracts. Opening, previewing, organizing and accepting library media
never execute generation.

Picker observations compare typed source references, not internal list IDs: a
Recent job output and its prepared canonical copy can reuse an internal ID while
having different original URLs. The captured output DTO remains authoritative for
confirmation and retry; only replacement of that same typed source marks it
unavailable from a list observation.

Audio's generated-video selector additionally supports the historical job-only
shape already exposed by `/api/jobs`. After a bounded recent-output read proves
an empty page, its explicit `audio-generated-video` proof mode may call the
private, authenticated `POST /api/media-library/selection/validate-job-video` with
one `{jobId, originalUrl}`. This read reuses the owned generation reader and web
projection, checks current completed status/visibility/kind/exact original, and refuses if **any**
persisted output exists (including deleted rows). It returns proof success only,
not an invented output or organization reference. Persisted outputs always use
ordinary source validation, including Trash/version/availability checks. Neither
proof route promotes, repairs, probes or writes media.

## Connected local verification

The [committed-snapshot fixture](../../experiments/media-library/connected-fixture/README.md)
exercises the real Library, contextual pickers and API/SQL owners with disposable
PG17, fixed ordinary synthetic accounts and a bounded local S3 protocol service.
Its bootstrap/control code exists only outside the authored production route tree.
Public synthetic Image/Media fulfillment and private signed HTTP reads are reported
as distinct transports; private canonical fallbacks must never be fulfilled as public.
Keep baseline/candidate sources, seed/media/lock/harness hashes, role/quality and
cache conditions with every comparison. Harness readiness, DOM tests or a successful
build alone do not establish browser parity, speedup or production Core Web Vitals.

### Generated-video picker candidates and Studio surface retirement

Upscale/Finishing and Audio use the authenticated, private/no-store
`GET /api/media-library/generated-videos` projection rather than Activity for
picker candidates. `generated-video-candidates.ts` owns a set-based read of
completed owned jobs and their exact current output originals. The
shared `libraryIdentityCtes` resolves each output's organization state before
cursor/limit; deleted/unready/foreign outputs, hidden jobs and recorded deleting
or deleted storage cannot reappear. Distinct output IDs remain distinct even
when their originals match. Pagination defaults to 30, caps at 100 and binds its
cursor to account and video/upscale surface. Activity remains unchanged.

`generated-video-candidate-sql.ts` projects the existing job surface policy into
SQL, including normalized status, explicit/snapshot surface precedence, legacy
prefixes, actual nonempty image renders and model aliases. PostgreSQL parity
cases compare that projection with the existing web/status mappers. The SQL
uses the same completed-status values and ECMAScript trim characters as the
existing generation owners. This is candidate eligibility, not a new generation
or authorization policy.

A historical video facade is admitted only when **no** `job_outputs` row exists
for that job, including foreign and unavailable rows. It receives its actual
job ID and exact original, never a fabricated asset/output reference. An exact
owned saved canonical/legacy projection with the same job ancestry and original
also controls visibility: `historicalJobProjectionSql` is shared by the list and
`validateHistoricalJobVideo`, so a saved trashed copy cannot reappear as a job-only
facade. Another job or replaced original does not inherit that state. Confirmation
still revalidates persisted output references or runs the authenticated read-only
historical proof. Upscale explicitly opts its video picker into that proof;
Audio retains its existing proof mode. There is no output repair, promotion,
probe or schema bootstrap in these reads.

Audio includes the account Library revision in its opaque read lifetime, clears
retired lists synchronously and rejects late responses after revision/account/
close changes. Upscale keeps separate bounded saved/generated cursors, preserves
exact output identity while enriching saved mirrors, and also uses the account
revision fence. Neither picker merges the Activity feed back into active media.

Studio keeps its common picker mounted across Media/Saved characters so captured
selections, search and the import queue retain their independent lifetimes. The
host supplies `active={false}` while showing characters. The picker immediately
unmounts the preview and clears its transient selection; the existing progressive
reader pauses active AV and removes original/source attributes. Returning to
Media retains the basket and queue but requires a fresh Preview action. A late
private grant may serve the still-mounted thumbnail owner, but cannot reopen the
retired preview or steal focus from the visible tab.

`generated-video-candidates-postgres.test.ts` exercises the real route and source
owners on disposable PostgreSQL17, plus real Audio/Upscale hooks, picker hosts,
validation and domain receivers through a local transport adapter. The asset and
recent-output transport envelopes use their real read-only listing owners.
`generated-video-candidates-dom.test.ts` covers revision/reopen/late-owner races;
`studio-media-chooser-behavior.test.ts` covers active audio/video and pending-grant
retirement with retained imports/basket and visible focus. These are fixture
network/component results, not native playback, production latency or CWV claims.

Generated-video candidate facts are output-scoped: persisted candidates project duration, dimensions and probed audio presence from their exact `job_outputs` row. Aspect ratio is derived from those dimensions. A sibling never inherits the job primary video's facts or thumbnail; missing facts remain null, including when both rows share a URL. Versioned probe facts must bind to the candidate's current original URL; invalid or stale measurements cannot fall back to an unmeasured duration. Historical job-only candidates retain their existing positively proved job-source facts. The shared picker DTO preserves these nullable facts through Audio and Upscale; Audio's existing 10-second eligibility check receives the selected output's duration.
