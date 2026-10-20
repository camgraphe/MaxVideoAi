# PostgreSQL connection incident — 19 October 2026

## Observed production failure

At 04:22:57 UTC, request `2s7bv-1792383777440-e61d23745034`
(`/video/job_d6bf02b0-9135-4454-bd8a-6158b24ee3ea`, region `sin1`)
logged PostgreSQL `FATAL 08P01`, message `server conn crashed?`.
The complete request log also records an uncaught exception in `pg-protocol`,
followed by Node exiting with status 129. Its deployment was
`dpl_FdGgPVDPEKooUJEg62oqcQh5v7gP`, GitHub main revision
`1ba762334506aabadcf92f5a5a8eb80f48a9ad3c`.
The two error-level records belong to the same request; they do not establish
two separate incidents or a failed generation/payment.

## Proven application defect and correction

`frontend/src/lib/db.ts` handled pool-level errors only. `pg-pool` removes its
idle error listener when lending a client. A fatal connection error received
between queries then emits a client-level `error`; without a listener, Node
terminates instead of letting the operation reject normally.

Attach a client error listener when the shared pool creates each connection.
The diagnostic contains only a bounded error code. Keep the existing idle-pool
handler, query rejection, transaction rollback, and failed-client disposal.
Do not retry a query, transaction or financial callback automatically.

`tests/db-client-errors-postgres.test.ts` reproduces the crash in a child process
against socket-only disposable PostgreSQL 17. An intentionally invalid protocol
frame produces a real `FATAL 08P01` between queries. Before the correction, both
the checked-out-client and interrupted-transaction cases exit with an unhandled
error. After it, the process survives, a new connection can read, the interrupted
insert remains rolled back, and the callback has run once. No protocol fault is
sent to production.

## Upstream cause remains unconfirmed

The connected Neon historical log query returned no records for 04:20–04:25 UTC;
the Vercel trace lookup returned `trace_not_found`. The 100 project operations
available from 18 October 21:51 to 19 October 21:49 contain no operation on the
production endpoint and none in the incident window. These records do not rule
out an internal backend or intermediary connection fault.

At the follow-up inspection, the production postmaster had been running since
14 October 19:21:39 UTC; scale-to-zero was disabled. No query had been active for
more than 30 seconds, and the database reported zero deadlocks and conflicts.
These are present-state checks, not proof of historical health. The remaining
upstream investigation needs Neon backend/pooler logs for the exact timestamp.
