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
| Exhaustive financial cutovers | Both complete cutover/rollback tests, including all 26,982 historical canonical quote checkpoints and 89 separately labeled new-offer proposals (27,071 total) | Tariff/billing changes and explicit commercial inputs; full runs |
| Browser | Connected Studio, editorial media, prompting tabs and admin smoke | UI/layout/translation changes; runtime/financial changes; full runs |

These lanes run in parallel. The initial financial migration's complete matrix is
preserved; no quote sampling or assertions were removed. Fast pricing, canonical
quote and wallet policy tests remain in the fast lane on every PR and main push,
including when exhaustive cutovers are not selected. The fast lane requires no
PostgreSQL, FFmpeg or Chromium installation. Full runs occur daily at 03:23 UTC and
on manual dispatch of Quality CI. Network source checks and the optional remote
runtime audit run on these full runs as non-blocking audits.

The exhaustive tariff and database/media lanes use Ubuntu 24.04, keeping their validation toolchain
stable during the `ubuntu-latest` migration to 26.04. The 2026-10-22 release checks
observed prolonged dependency downloads on the new image. The shared PostgreSQL
17/FFmpeg setup and the complete tariff suite remain required; the runner pin does
not change coverage or the aggregate Quality CI gate.

The browser lane installs Chromium and WebKit so the mobile prompt and Modify navigation regressions run against both engines. It uses Ubuntu 24.04 and has a 40-minute total budget. On the
2026-10-23 candidate, tool/browser installation consumed over 12 minutes before
the tests, so the former 25-minute limit canceled the still-progressing browser
suite before admin smoke. All browser tests and the admin suite remain required.
The same run exposed a stale initial-cutover test total: the reviewed Luma Modify
expansion adds 36 cells (12 extra duration classes × 3 resolutions) to the 128
FLUX Max cells and historical 26,818 checkpoints. The exhaustive fixture asserts
these expansions before replay and preserves all monetary and rollback checks.

The fast job has a 30-minute limit, including setup, audits, type checking and
lint. Its 1,300+ tools-free test files include complete pricing projections;
the former 20-minute job limit canceled a still-progressing suite on hosted
runners. This time allowance does not change lane selection or test coverage.

## Change selection and conservative fallback

`scripts/select-ci-validation.mjs` compares the entire PR against its base using
the merge base, or all commits in a main push against the event's previous SHA.
Rename detection is disabled so both removed and added paths participate.
An empty diff, unavailable history or invalid event requests all lanes because
the comparison cannot establish which inputs changed. Manual and scheduled runs
always request all lanes. A known diff containing an unrecognized path retains
database/media and browser coverage without automatically selecting exhaustive
financial cutovers.

`scripts/_lib/ci-validation-policy.mjs` owns the selection policy:

- Human Markdown documentation and AGENTS instructions use fast checks.
- Authored Markdown/MDX/JSON content and media/font/text assets use fast checks
  unless their path identifies financial behavior, which retains database/media
  and browser checks. Runtime TS/JS files in these
  directories (including `frontend/content/feature-flags.ts`) retain database/media
  and browser coverage.
  Marketing TSX components, CSS and JSON message dictionaries
  additionally retain real browser checks.
- Other component TSX, route-local UI hooks/clients, server pages, route handlers
  and shared helpers retain database/media and browser checks.
- Display components, styles, translated copy and ordinary validation tests do
  not select exhaustive cutovers merely because their path contains a financial
  word. Their existing fast, database/media and browser checks are preserved.
- Pricing, tariffs, billing, wallets, checkout, payment, Stripe, quote, credit,
  transaction, membership, subscription, refund, invoice, ledger, top-up and
  currency runtime paths and financial fixtures request the complete financial
  coverage. Both exhaustive cutover test files also select their own lane.
- Commercial inputs without financial filenames are selected explicitly: the
  generated engine catalogue, published supplier rates, FAL model fixtures and
  engine definitions, image/tool supplier rates and monetary formulas, live
  FAL/audio pricing readers, exchange rates, Studio assistance/media-analysis
  tariffs and billing formulas, engine-settings pricing storage/projection,
  its migration, and provider cost/accounting modules. These explicit owners
  take priority over display/test exemptions.
  Model identity and marketing-only configuration do not own monetary amounts.
- Other shared backend/library code, API routes, model configuration, migrations,
  dependency/build inputs, tests/fixtures/helpers, scripts, CI files and unknown
  paths do not select exhaustive financial cutovers merely because of their
  location. They retain normal integration coverage and receive the exhaustive
  replay on nightly/manual full runs.

Keep the commercial-input list explicit and update the selection tests when a
new tariff or billing owner has no financial filename. If a presentation
component gains ownership of financial logic, move that logic into its established
server/library owner. Changes to financial fixtures and the two exhaustive
cutover test files select exhaustive cutovers; changes to other tests or CI
configuration alone do not.

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
the disposable PostgreSQL/Studio runtime helpers, a `*-postgres-fixture` helper,
the external fal import evidence owner (which probes real video bytes),
or using initdb/FFmpeg in the
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

On the Milo release candidate, Ubuntu 26.04 spent nearly 22 minutes installing
PostgreSQL/FFmpeg before the database/media job reached its 25-minute limit.
Pinning that lane to the same stable image preserves both the complete integration
suite and the isolated Studio route checks; it does not turn a timeout into a pass.

`frontend/next.config.js` explicitly enables `experimental.webpackBuildWorker`
because next-intl adds a custom Webpack hook, which disables Next 15's automatic
worker selection. This is a build-memory mitigation; it does not establish the
cause of a previous OOM. Keep `webpackMemoryOptimizations` and lint/type gates
enabled. Changes to this setting or the plugin require a complete source build
and CSS/route output parity checks because custom plugins can be incompatible
with the worker. See [Next's memory guide](https://nextjs.org/docs/app/guides/memory-usage#webpack-build-worker)
and the [Next 15.5.25 build source](https://github.com/vercel/next.js/blob/v15.5.25/packages/next/src/build/index.ts).

## Public SEO

`Public SEO` runs daily at 06:17 UTC and on manual dispatch. After a production
release is READY, run `pnpm seo:public:check` or dispatch this workflow. It audits
the live public origin; it is not a claim that a PR preview has been validated.
The required Quality CI retains the offline SEO/route/SSR contracts before merge.

The read-only audit discovers every URL in the live sitemap index (including
video pages), follows native default-gallery pagination and declared hreflang
destinations, and checks HTTP 200 without redirects, a single self-canonical,
HTML and HTTP indexing exclusions, title/H1, JSON-LD syntax and reciprocal
alternates. Live robots.txt must match the authored public policy after removing
comments/blank lines. This catches wrong-host policy and deployment drift without
introducing a second robots policy. A policy update needs its existing robots
contract tests and a deployed version before the live check can pass.

Limits: three concurrent public GETs, 2,500 pages, 20 sitemaps, an 18-minute audit
deadline (partial report fails explicitly before the 25-minute job limit), 30-second request
timeouts, 5 MB per document, bounded 429/5xx retries, no redirects followed,
credentials, DB connection, indexing requests or off-origin destinations.
Failures retain `.reports/public-seo/report.json` as a 30-day workflow artifact.
Sort/filter noindex variants remain covered by offline tests. The audit does not
claim Google indexation, ranking, full structured-data eligibility, exhaustive
link coverage, or absence of content-quality issues.

`tests/public-seo-audit.test.ts` checks the HTTP-only noindex failure, pagination
canonical collapse, duplicate canonical, malformed JSON-LD, sitemap origin
boundary, reciprocal language links and accidental protocol-host robots policy.

## Lighthouse measurements

Lighthouse measures the live production URLs daily at 05:41 UTC and on manual
dispatch. It no longer starts on a main push before Vercel finishes deploying.
For a performance-sensitive release, dispatch it after the Git-backed deployment
is READY. The existing measurement-integrity check and six reports remain intact;
reports are uploaded even after a measurement failure.

Both `frontend/lighthouserc.js` and `lighthouserc.site.js` use
`scripts/performance/lighthouse-chrome-settings.cjs`. It resolves the Chrome
launcher used by the installed Lighthouse, preserves its complete default flag
list including Linux's sandbox setting, and restores only `RenderDocument`.
Defaults are read through the actual launcher's flag getter, with flags shared
by both default modes left to the launcher. `chromeIgnoreDefaultFlags` prevents the
original disabled-feature list from being appended again. Do not replace the
whole feature list or disable GPU, analytics, styles, media or real requests to
improve a score. The ordinary Lighthouse mobile/desktop profiles, storage reset,
consent behavior and six production URLs retain their existing settings.

The 2026-10-13 Exemples investigation found ~1-second compositor presentation gaps
under the launcher's legacy `RenderDocument`-disabled configuration. Five
interleaved pairs on unchanged production, same Chrome and runner, removed those
gaps after restoring the feature. This corrects a laboratory configuration;
it is not a production-page speedup or evidence that CrUX/field INP improved.
Raw delayed results remain part of the retained evidence and are never silently
dropped or rewritten. See the [upstream investigation](https://github.com/GoogleChrome/lighthouse/issues/17148).

For a bounded reproduction, manually dispatch Lighthouse with
`examples_diagnostics: true`. The opt-in runner collects five alternating pairs
against the unchanged public Exemples URL, preserving both flag lists, all reports,
DevTools request logs and complete traces in the existing report artifact. The
normal six-page audit runs first, so a diagnostic failure cannot suppress it.
`tests/lighthouse-render-document.test.ts`
executes both configs through the real LHCI argument builder and Lighthouse parser,
checking the real macOS/Linux launcher arguments, feature-list preservation,
headless launch and the original measurement
settings. It is included in the pre-audit `pnpm cwv:check` gate.

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
