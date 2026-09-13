# MCP Reference Asset Deletion Implementation Plan

**Goal:** Implement the approved durable cleanup path without changing public DELETE
responses or adding a destructive MCP tool.

## Task 1: Ledger state contract

- Add migration `43_mcp_reference_asset_deletion.sql`.
- Add `released`, its partial index, and strict transition enforcement.
- Extend the durable fence to thumbnail keys, add exact key parsers and thumbnail
  persistence/release triggers.
- Apply the strict common key parser to primary URL fields and to both released and
  pending/expired cleanup protection; query-string substrings never establish ownership.
- Add a rolling-deploy trigger for old soft-delete callers. Reconcile older tombstones
  in a bounded cron phase and create historical thumbnail fences lazily; do not run
  unbounded data backfills inside migration 43.
- Extend migration and disposable PostgreSQL tests first.

## Task 2: Transactional library deletion

- Add `frontend/server/media-library/asset-deletion.ts`.
- Lock and soft-delete the owned canonical row, remove exact same-owner legacy
  projections that are not owned by another live canonical row, and release completed
  MCP cleanup rows in one transaction.
- Keep `frontend/server/media-library.ts` and all three DELETE route responses stable.
- Add architecture and PostgreSQL behavior tests first.

## Task 3: Retryable released-object cleanup

- Extend the existing cleanup worker to select grouped released objects.
- Claim final and thumbnail objects through the durable fence and protect all live
  database/ledger owners with exact parsed-key checks.
- Mark all released owners deleted only after storage success; retain released state
  after failure.
- Cover final, thumbnail, shared-owner, retry, grouping, false substring matches,
  two-worker exclusion, and persistence-during-delete races in disposable PostgreSQL.

## Task 4: Documentation and verification

- Update `docs/engineering/mcp-reference-imports.md` with the implemented ownership
  and the remaining `import_reference_files` limitation.
- Run the focused reference/media/route suite, frontend lint, exposure lint,
  TypeScript checking, and `git diff --check`.
- Obtain independent spec and quality review, then commit locally.
- Do not run a live upload or cleanup until the code milestone is complete and a
  separate destructive test is explicitly approved.
