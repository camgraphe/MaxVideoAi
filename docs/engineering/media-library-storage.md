# Recorded Library storage

`GET /api/media-library/storage` returns an account-scoped estimate of recorded
original files. `storage-usage.ts` owns the DTO, and `storage-usage-sql.ts` aggregates
one PostgreSQL MVCC snapshot. The read never bootstraps schema, scans a bucket,
performs HEAD requests, reserves storage, or enables a quota. Migrations 43 and 98
provide its storage authority/fence helpers and purge tables. Missing prerequisites
produce an error rather than a partial estimate.

## Sources and identity

Ready `media_assets`, legacy `user_assets`, and owned ready `job_outputs` contribute
original URLs and available recorded sizes. Hidden jobs and preparation files still
consume recorded storage even when browse excludes them. Recoverable Trash is
resolved through exact persisted alias identity and source revision, not URL
similarity. Frozen pending/failed purge sources and original purge-object records
preserve evidence after logical tombstoning; they are not added as a second copy.

Identical URLs deduplicate. Published storage authorities reuse migration 43's
recognition policy and the exact storage key, merging CDN aliases and signed URL
variants. A purge ledger's proven object key also joins its recorded URL variants.
Unrecognized authorities retain exact URL identity; similar paths alone do not
establish one file. Custom or historical aliases without this proof may therefore
be counted separately. No object identity grants deletion authority.

An original is measured only when all non-negative recorded sizes agree. Missing,
negative, or contradictory sizes remain unknown. A purge object's durable
`size_conflict` marker prevents a later duplicate projection from silently turning
a known conflict into a measurement. A historical object already marked deleted
does not contaminate a genuinely available replacement's size.

## Response semantics

| Field | Meaning |
| --- | --- |
| `recordedBytes` | Sum of known original sizes still attributed to this account, including recoverable Trash, pending deletion, retries and explicit retention. |
| `measuredFiles` / `totalFiles` | Measured versus all distinct originals in that same account estimate. |
| `pendingDeletionFiles` / `pendingDeletionBytes` | Original files awaiting cleanup and the known subset of their bytes. Shared or explicitly retained objects are excluded. |
| `failedDeletionFiles` | Distinct original files with failed source proof or a retryable cleanup error. Retryable failures can also be pending. |
| `trashedFiles` / `trashedBytes` | Recoverable Trash originals and their known bytes; accepted purge requests are excluded. |
| `sharedDeletionFiles` / `sharedDeletionBytes` | Requested originals physically retained for another live reference, with their known bytes. |
| `limitBytes` / `enforcement` | Always `null` / `false`; this endpoint does not enforce a storage allowance. |

The categories overlap and must not be summed. A shared original remains in
`recordedBytes` if the same account still has a ready reference. Otherwise it is
reported only in shared retention; another account's reference does not charge
the deleted owner indefinitely. This is attribution, not proof that platform
bytes were freed. Explicit `retained` originals stay accounted.

Logical tombstoning alone does not release recorded bytes. An original object
marked `pending` or `deleting` stays counted, including after a failed storage
request. Confirmed `deleted` fences retire stale projections across the recognized
aliases. When a fence exists its current state is authoritative; otherwise the
purge ledger's confirmed deletion is used. No remote-success claim is inferred
from an accepted purge request or a removed database row.

## Limits and UI

This is not a complete physical bucket inventory. Unmeasured originals contribute
to file counts but not byte sums; a zero byte sum can mean no measured sizes.
Thumbnails, previews, other derivatives, exports outside Library source records,
provider-side retention and unrecorded objects are outside this estimate. Pending
and failed counters here cover originals, not derivative cleanup tasks. Frozen
failed sources whose live row has changed or disappeared may remain as unmeasured
evidence until their deletion request is reconciled. Remote bytes changing behind
an unchanged URL cannot be detected by these database reads.

`LibraryStorageUsage` refreshes on confirmed account Library revisions. A stable
12-second timer revalidates SWR only while original deletion is pending, skips
hidden/offline pages and overlapping requests, and retires with the owner/revision.
Shared retention is explained separately without perpetual polling. The displayed
amount always comes from the server; the client never subtracts queued bytes.

`library-storage-usage-postgres`, `library-storage-purge-postgres`, and
`library-storage-dom` test these contracts with synthetic records and disposable
PostgreSQL 17. They establish accounting behavior, not live storage inventory or
production latency.
