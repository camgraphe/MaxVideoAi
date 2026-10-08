# CI validation and fast feedback

Quality CI runs on every PR update targeting main and every main push. Keep the
required check named `Quality CI`: branch protection already requires that name.
There are no workflow-level path filters or skip-message shortcuts. The final gate
runs even after failures or skipped jobs, checks the selection outputs, and rejects
failed, canceled, missing or unexpectedly skipped required jobs.

## Validation lanes

| Lane | Coverage | Trigger |
| --- | --- | --- |
| Fast checks | Exposure guard, catalogue/roster audits, TypeScript, ESLint, image alt checks and fast validation files | Every run |
| Database and media integration | Disposable PostgreSQL, real FFmpeg tests and three isolated Studio route integrations | Runtime/UI changes; financial changes; full runs |
| Exhaustive financial cutovers | Both complete cutover/rollback tests, including all 26,818 canonical quote checkpoints | Financial/shared runtime inputs; CI changes; full runs |
| Browser | Connected Studio, editorial media, prompting tabs and admin smoke | UI/layout/translation changes; runtime/financial changes; full runs |

These lanes run in parallel. The initial financial migration's complete matrix is
preserved; no quote sampling or assertions were removed. The fast lane requires no
PostgreSQL, FFmpeg or Chromium installation. Full runs occur daily at 03:23 UTC and
on manual dispatch of Quality CI. Network source checks and the optional remote
runtime audit run on these full runs as non-blocking audits.

## Change selection and conservative fallback

`scripts/select-ci-validation.mjs` compares the entire PR against its base using
the merge base, or all commits in a main push against the event's previous SHA.
Rename detection is disabled so both removed and added paths participate.
An empty diff, unavailable history, invalid event or unknown path requests all
lanes. Manual and scheduled runs always request all lanes.

`scripts/_lib/ci-validation-policy.mjs` owns the selection policy:

- Human Markdown documentation and AGENTS instructions use fast checks.
- Authored Markdown/MDX/JSON content and media/font/text assets use fast checks
  unless their path identifies financial behavior. Runtime TS/JS files in these
  directories (including `frontend/content/feature-flags.ts`) request all lanes.
  Marketing TSX components, CSS and JSON message dictionaries
  additionally retain real browser checks.
- Other component TSX and route-local UI hooks/clients retain database/media and
  browser checks. Server pages, route handlers and shared helpers request all lanes.
- Pricing, tariffs, billing, wallets, checkout, payment, Stripe, quote, credit,
  transaction, membership and subscription paths always
  request the complete financial coverage.
- Shared backend/library code, API routes, model configuration, migrations,
  dependency/build inputs, tests/fixtures/helpers, scripts, CI files and
  unrecognized paths request all lanes.

Keep these exemptions small. If a presentation component gains ownership of
financial logic, move that logic into its established server/library owner and
update the selection tests. New runtime owners default to exhaustive coverage.

## Local commands and test placement

`pnpm test:validate` still runs every root `tests/*.test.ts` file and then the
four isolated Studio integrations. It does not include the separately owned
`tests/integration/` paid-provider scenarios or Playwright specs; those remain
explicit commands as before.

To run one CI lane:

```bash
pnpm run test:validate -- --suite fast
pnpm run test:validate -- --suite integration
pnpm run test:validate -- --suite tariffs
pnpm run test:validate -- --suite studio
pnpm run test:validate -- --suite browser
pnpm test:admin-smoke
node scripts/run-validation-tests.mjs --plan
```

### Local PostgreSQL version selection

Database validation and `pnpm test:editor` (also used by `pnpm qa:editor`) select
PostgreSQL 17 automatically through `scripts/_lib/test-postgres-toolchain.mjs`.
The resolver looks for a complete PG17 installation in PATH, then the standard
Apple Silicon/Intel Homebrew directories on macOS or `/usr/lib/postgresql/17/bin`
on Linux. An older PostgreSQL installation earlier in PATH does not take precedence.
The selected directory is printed before the suite starts. Every selected tool
(`postgres`, `initdb`, `pg_ctl`, `psql`, `pg_isready`) must report major version 17.

If PG17 is unavailable, validation stops before allocating a disposable database
with installation guidance. On macOS use `brew install postgresql@17`; no service
needs to be started. For a nonstandard installation, set `TEST_POSTGRES_BIN` to
its bin directory. This override is strict: an invalid or mixed-version directory
fails rather than silently falling back to a different installation.

Focused tests use the same resolver through `tests/helpers/disposable-postgres.ts`;
legacy fixtures that own their lifecycle use its `testPostgresCommand` helper.
Database initialization, startup and cleanup use the selected absolute executable
paths. Manual PATH prefixes are no longer needed, including for direct `tsx --test`
runs. The fast suite and `--plan` do not require PostgreSQL. The toolchain regression
uses executable doubles and stays in the fast suite.

This selection only affects test child processes. It does not change shell startup
files, Homebrew links or running services, and never connects to an inherited
`DATABASE_URL`. Existing disposable-database isolation and PG17 qualification
assertions remain in place. CI continues to install PostgreSQL 17 with its existing
setup action.

The runner automatically places `*-postgres.test.ts` files and tests importing
the disposable PostgreSQL/Studio runtime helpers or using initdb/FFmpeg in the
integration lane. Tests directly launching Chromium, Firefox or WebKit, or using
their installed executable paths for a renderer, belong in the browser lane, as
do tests importing the connected browser fixture helper. The real composition
render test checks that Chromium is installed before allocating servers, so a
missing browser fails promptly without leaving a Remotion server open.
The two exhaustive financial files and the four Studio files
have explicit owners. When adding another slow fixture helper, update this
classification and its partition test. No test may disappear between lanes.

For a development iteration, run tests relevant to the change and continue while
CI runs. A new PR push cancels obsolete validation for that PR. Main, nightly and
manual runs use separate concurrency groups and do not cancel the PR's check.
Before merge, wait for Quality CI on the latest candidate and follow the normal
production alignment checks in `docs/deployment/github-vercel.md`.

## Lighthouse

Lighthouse measures the live production URLs daily at 05:41 UTC and on manual
dispatch. It no longer starts on a main push before Vercel finishes deploying.
For a performance-sensitive release, dispatch it after the Git-backed deployment
is READY. The existing measurement-integrity check and six reports remain intact;
reports are uploaded even after a measurement failure.

## Verification contracts

- `tests/ci-validation-policy.test.ts` executes selection against real temporary
  Git histories and verifies gate success/failure behavior.
- `tests/validation-test-runner.test.ts` proves every root validation file occurs
  in exactly one CI suite and retains the original complete local test plan.
- `tests/quality-ci-contract.test.ts` locks the required gate name/dependencies,
  full Git history, conditional jobs, concurrency and scheduled Lighthouse.

The shared toolchain lives in `.github/actions/setup-project/action.yml`.
PostgreSQL 17 and FFmpeg installation live in
`.github/actions/setup-validation-tools/action.yml`. Keep pinned pnpm and Node
versions aligned with the workspace package manifests.
