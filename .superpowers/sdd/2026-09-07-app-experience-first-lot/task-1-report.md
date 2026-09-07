# Task 1 report: Library collection correctness

Status: implemented and focused verification passed.

## Changes

- Added additive cursor metadata to both listing APIs while retaining the existing `assets` and `outputs` arrays.
- Added server-side search bounded to 200 characters with parameterized, escaped `ILIKE` patterns.
  - Saved assets: authored label, `fileName`/`filename`, and linked job ID.
  - Recent outputs: job prompt, exact/displayed job ID, output label, and `fileName`/`filename`.
- Added exact owned `jobId` filtering for recent outputs before pagination.
- Kept `listRecentOutputs` backward-compatible up to its prior 200-item maximum while exposing cursor pages through `listRecentOutputPage`.
- Converted the library hook to SWR infinite pages of 60, with cursor termination, ID deduplication, account/filter/search/job-isolated keys, inactive-view suppression, stale-result action suppression, and infinite-aware mutation revalidation.
- Added `searchQuery`, `setSearchQuery`, `hasMore`, `loadMore`, `isLoadingMore`, `activeJobId`, and `clearJobFilter`.
- Preserved original media URLs, ownership predicates, source/kind filters, and legacy asset merging.

## Verification

Passed:

- `node node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test tests/media-library-pagination-postgres.test.ts tests/media-library-contract.test.ts tests/media-library-server-architecture.test.ts tests/library-performance-contract.test.ts tests/workspace-library-page-architecture.test.ts tests/storyboard-library-category.test.ts` — 45/45 passed.
- `node node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test tests/media-library-pagination-postgres.test.ts` — disposable PostgreSQL behavior passed for 125-result cursor traversal, equal timestamps, cursor termination, search beyond page one, cross-user isolation, literal wildcard escaping, legacy search, source filtering, and exact old-job lookup.
- `cd frontend && ./node_modules/.bin/eslint 'server/media-library.ts' 'server/media-library/*.ts' 'app/api/media-library/assets/route.ts' 'app/api/media-library/recent-outputs/route.ts' 'app/(core)/(workspace)/app/library/_hooks/useLibraryPageData.ts' 'app/(core)/(workspace)/app/library/_hooks/useLibraryAssetMutations.ts' 'app/(core)/(workspace)/app/library/_lib/library-page-helpers.ts'` — passed with no warnings.
- `git diff --check` — passed.
- `cd frontend && ./node_modules/.bin/tsc --noEmit` — passed before concurrent parent UI edits. The latest shared-tree run is blocked by the parent's unrelated `components/groups/CompositePreviewDock.tsx:324` change (`Property 'items' does not exist on type 'never'`).

## Limits and concerns

- Search intentionally does not return raw metadata and only checks the supported fields listed above.
- Search text is trimmed and capped at 200 characters; page size is 60 and server cursor page size is capped at 100.
- The broader shared-tree contract run had unrelated concurrent failures from parent-owned navigation line count and missing root React resolution in two tests; all task-owned focused contracts passed.

## Review fixes

- Replaced page-local multi-query deduplication with one parameterized SQL union. It normalizes source fields, partitions the filtered collection by media kind and canonical origin URL, selects the established current/output/legacy representative, and applies the stable `(created_at, id)` cursor after deduplication.
- Invalid explicit `jobId` values, including values over 256 characters, now return `400 INVALID_JOB_ID`; they cannot fall through to an unfiltered recent-output listing.
- Removed the migrated `savedAssetLimit` and `recentOutputLimit` hook arguments.
- Expanded the disposable PostgreSQL fixture to 125 current assets, 125 legacy mirrors, and one distinct legacy asset. Traversal returns exactly 126 unique logical assets across three pages, preserves the current representative, covers an origin URL whose current and legacy URLs differ, and still verifies search, ownership, and exact old-job lookup.

Review-fix verification passed:

- `node node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test tests/media-library-pagination-postgres.test.ts tests/media-library-contract.test.ts tests/media-library-server-architecture.test.ts tests/library-performance-contract.test.ts tests/workspace-library-page-architecture.test.ts tests/storyboard-library-category.test.ts` — 47/47 passed.
- `cd frontend && ./node_modules/.bin/tsc --noEmit` — passed.
- Focused ESLint over all owned server/API/hook/helper files — passed with no warnings.
- `git diff --check` — passed after removing one trailing blank line reported by the combined verification command.
