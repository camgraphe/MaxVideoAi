# MCP release-candidate checklist

This checklist is the short launch path extracted from
`2026-09-12-mcp-ecosystem-rollout-checklist.md`. The larger checklist remains the
source of truth for later platform, store, SEO, and evidence work. Unfinished future
platform tasks do not block the first staging candidate.

## Frozen candidate scope

- Preserve the existing live, indexable Claude, ChatGPT, and Codex pages and their
  current installation floor.
- Keep OpenClaw and n8n as rendered `preview_noindex` pages with acquisition disabled.
- Keep Cursor, GitHub Copilot, Gemini CLI, and Microsoft Copilot visible only as
  preparing ecosystem entries; their dedicated routes remain hidden.
- Keep ClawHub and the n8n template library in `preparing`; no external submission is
  part of this candidate.
- Keep paid generation, public indexing, store publication, deployment, and production
  mutations outside the local verification gate.

## Gate A — local candidate verification

- [x] Work in the isolated `codex/mcp-integration-ecosystem` worktree.
- [x] Confirm the branch contains the current target branch and is not behind it.
- [x] Run the complete top-level repository test suite.
- [x] Run the three hermetic MCP integration suites, with disposable PostgreSQL and
  fake providers only.
- [x] Run frontend lint, exposure lint, TypeScript checking, i18n checks, SEO checks,
  model registry checks, model audits, and the production build.
- [x] Run the current architecture audit and record findings without turning unrelated
  cleanup into a release blocker.
- [x] Review the complete branch diff for credentials, generated-file drift, accidental
  public routes, unsupported marketing claims, and unrelated changes.
- [x] Start the production build locally and smoke-test the MCP hub plus all live and
  preview EN/FR/ES integration routes; confirm hidden routes return 404.
- [x] Verify canonical, reciprocal hreflang, robots, JSON-LD, sitemap, `llms.txt`,
  acquisition allowlist, and privacy-safe analytics/admin attribution.
- [x] Record exact commands, pass/fail counts, accepted limitations, and the rollback
  commit before proposing a staging deployment.

### Gate A evidence — 2026-09-13

- Final branch relation: `git rev-list --left-right --count main...HEAD` returned `0 33`.
  The reviewed code rollback baseline is `ab2cb9fbd552e2eab7b07b8c519aff0f219e1d07`
  (`main` and the merge base at verification time). A deployment-level rollback target
  must still be captured from staging before promotion.
- Complete repository suite:
  `./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test --test-reporter=dot tests/*.test.ts`
  passed across all 721 top-level test files with exit code 0.
- Hermetic MCP integrations:
  `./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/integration/mcp-openclaw-interrupted-confirmation.test.ts tests/integration/mcp-paid-generation.test.ts tests/integration/mcp-seedance-mini-trial.test.ts`
  passed 11/11 with disposable PostgreSQL and fake providers.
- Focused acquisition, privacy-safe analytics, admin, publication, and SEO contracts
  passed 80/80.
- `npm --prefix frontend run lint`, `npm run lint:exposure`,
  `pnpm --prefix frontend exec tsc --noEmit`,
  `pnpm --prefix frontend run i18n:check`, and
  `pnpm --prefix frontend run seo:check` all exited 0. Localization parity covered
  4,235 French keys and 4,229 Spanish keys.
- `pnpm model:registry:check && pnpm models:audit` exited 0 for 53 registry models,
  52 published roster entries, and no critical finding. The existing
  `seedance-2-0-fast-byteplus` examples-family resolver warning remains accepted.
- `npm run architecture:audit -- --min-lines 500` exited 0. It reported current large
  files for follow-up; this candidate does not mix in unrelated architecture cleanup.
- `npm --prefix frontend run build` exited 0 and generated 868 static pages. The known
  Supabase Edge-runtime warning and local Node 23 versus required Node 22 warning remain
  non-blocking; staging must use the declared Node 22 runtime.
- Production-server smoke on port 3320 passed for 18 hub/integration routes across
  EN/FR/ES. The 12 Cursor, GitHub Copilot, Gemini CLI, and Microsoft Copilot route
  combinations returned 404 after canonical redirects.
- Each rendered route exposed its self-canonical URL, reciprocal EN/FR/ES/x-default
  hreflang, and JSON-LD. Claude, ChatGPT, Codex, and the hub remained indexable;
  OpenClaw and n8n returned `noindex, follow`. Localized sitemaps included only the
  hub and three live integration pages, while `llms.txt` excluded preview clients.
- The visible browser smoke rendered the complete hub hierarchy — three live clients,
  two validation previews, and four preparing clients — with no browser console warning
  or error.
- `git diff --check` passed. The final branch delta covered 120 files with 9,381
  insertions and 1,332 deletions. No credential-bearing filename, private key, literal
  secret assignment, or credential-bearing URL was detected. Build and model checks
  produced no generated-file drift; every changed source is scoped to MCP ecosystem,
  reference cleanup, admin reporting, localization, SEO, distribution artifacts, or
  their tests and documentation.
- No paid generation, store submission, deployment, staging database migration, live
  storage mutation, or production mutation was performed during Gate A.

## Gate B — staging candidate

Run only after explicit approval for a staging deployment and staging database
migration.

- [x] Deploy one immutable, unaliased candidate to `maxvideoai-mcp-staging`.
- [x] Apply migrations 43 and 44 only to the staging Neon database and verify their rollback plan.
- [x] Re-run transport, OAuth, account, discovery, quote preparation, recovery, admin,
  and localized marketing smoke tests without paid confirmation.
- [x] Upload one tiny disposable private reference, verify Library ownership, delete it,
  run bounded cleanup, and prove both database projections and exact storage objects are
  removed.
- [x] Verify cleanup cron, logs, error redaction, preview `noindex`, hidden-route 404s,
  and rollback to the previous staging deployment.

### Gate B evidence — 2026-09-13

- The final immutable candidate is commit `b6d797ad5` on
  `codex/mcp-integration-ecosystem`, deployed as
  `dpl_8VL7X4A6AhVN8wYeAneyc3WDNo6L`. The wrapper built all 868 pages, proved the
  candidate was unaliased before promotion, and verified that the production project,
  domains, and protection configuration were unchanged.
- Migrations 43 and 44 were applied only to the expiring `preview/mcp-staging` Neon
  branch. Migration 43 is additive and rollback uses the retained previous deployment;
  migration 44 widens the staging namespace constraints without rewriting production
  data. The previous staging deployment remained available throughout the test.
- Public smoke passed for root, protected-resource discovery, the anonymous MCP
  challenge, and the admin and cleanup authorization boundaries. All 18 EN/FR/ES hub
  and rendered integration URLs returned 200; all 12 hidden Cursor, GitHub Copilot,
  Gemini CLI, and Microsoft Copilot URLs returned 404. OpenClaw and n8n returned
  `noindex`; the hub, Claude, ChatGPT, and Codex remained indexable at page level while
  the staging deployment retained its global noindex header.
- The dual-use staging hostname initially exposed a real browser/API collision on the
  default-locale `/mcp` route. Commit `b6d797ad5` now keeps only HTML `GET`/`HEAD`
  navigation on the marketing route for staging and loopback, while JSON/SSE requests
  and all POSTs remain transport-owned. The focused routing, staging, transport, and
  marketing suite passed 55/55 before deployment.
- Bundled Codex `0.154.0-alpha.6.2` with `gpt-5.6-luna` at low effort completed
  OAuth-backed `get_account_status` and `list_recent_generations`, then a separate
  `get_model_details` plus `prepare_generation` quote smoke. The production MCP server
  was explicitly disabled and `confirm_generation` was never called, so no provider
  submission or spend occurred.
- Admin staging checks proved unauthenticated access returns 401 and the authenticated
  disposable non-admin principal receives the concealed 404 boundary. The 80/80 local
  acquisition/admin/SEO contracts remain the dashboard implementation evidence; no
  staging admin role was created solely to manufacture a visual smoke result.
- One tiny private image was uploaded through the real MCP handoff, matched by
  `list_media`, and then deleted together with the previously approved failed-upload
  residue. The first cleanup exposed a released-object edge case for an aborted attempt.
  Commit `e45b6db79` fixed it with a failing-first disposable PostgreSQL regression;
  the full reference suite then passed 128/128.
- Final cleanup reached a zero batch. Database proof reports two deleted target assets,
  five of five cleanup rows deleted, three of three object fences deleted, and zero
  active `media_assets`, `job_outputs`, or legacy `user_assets` projections for the
  exact target keys. The dedicated staging cleanup secret was rotated, stored in the
  local macOS Keychain, and never written to Git or an environment file.
- The alias was rolled back to `dpl_4TA9mrqaWqKm2Kg2a5RLH3Bgzv6W`; root, discovery,
  MCP 401, and the authentication challenge remained healthy. The exact final candidate
  was then re-promoted and is READY on `https://maxvideoai-mcp-staging.vercel.app`.
  The final 180-record log scan found zero 5xx, zero application error/fatal records,
  and zero detected secret, asset ID, storage-key, filename, or email leaks.

## Pre-push integration recheck — 2026-09-13

- The stale local base was not used for the final decision. `origin/main` at
  `08a0c93322559086683d763297f0cf2348c2d202` was fetched and merged into the
  feature branch as `9a0480d990907bf8c6c08d5984e9b8ca3e3735fe`. The resulting branch relation
  was `0 39`; the working tree was clean.
- The five merge conflicts were resolved by retaining both owners where required:
  current Studio/runtime capabilities from `main`, injectable MCP services, current
  owned-asset reads, and the transaction-safe MCP reference deletion path. The
  combined tool-selection policy fingerprint was regenerated and its 70-fixture
  deterministic evaluation returned zero diagnostics.
- The complete 887-file top-level suite passed with exit code 0 under Node 22,
  PostgreSQL 17, bounded test concurrency, and the repository environment links
  temporarily isolated and then restored. The hermetic MCP integrations passed
  11/11, and focused post-conflict media, transport, policy, pricing, and timeline
  coverage passed 55/55.
- Frontend lint, public-exposure lint, TypeScript, i18n, SEO, model-registry, model
  audit, and architecture audit all exited 0. Localization parity covered 5,618
  French keys and 5,612 Spanish keys. The one accepted models-audit warning remains
  the disabled examples-family resolver for `seedance-2-0-fast-byteplus`.
- The Node 22 production build passed all model and media prebuild gates and generated
  879/879 static pages, including the localized MCP hub and Claude, ChatGPT, Codex,
  OpenClaw, and n8n integration owners. `git diff --check`, conflict-marker checks,
  generated-file drift checks, and the high-confidence added-secret scan passed. The
  final application delta against `origin/main` covered 134 files, with 9,829
  insertions and 1,363 deletions.
- A fresh staging deployment of that merged application commit was attempted through
  the fail-closed wrapper as `dpl_AMEP4NzEuV7DsRziKeWZdpuzxVME`. Vercel compiled the
  application, then remained at `Linting and checking validity of types` until the
  platform returned `Error` after roughly 45 minutes without a code diagnostic. The
  wrapper did not promote the candidate. The stable staging alias remains on READY
  deployment `dpl_8VL7X4A6AhVN8wYeAneyc3WDNo6L`; a post-failure smoke returned hub
  200, protected-resource discovery 200, and anonymous transport 401 with the OAuth
  resource-metadata challenge. Therefore the merged branch is locally green, but its
  fresh hosted staging promotion remains an explicit infrastructure follow-up before
  any production rollout.

## Gate C — monitored production rollout

Run only after a separately approved production release.

- [ ] Promote the exact staging-verified candidate and retain the previous deployment
  as the rollback target.
- [ ] Re-run critical HTTP, OAuth, MCP, Library, admin, SEO, and cleanup checks.
- [ ] Keep OpenClaw and n8n noindex/acquisition-disabled until their evidence and store
  decisions are approved independently.
- [ ] Monitor OAuth failures, confirmation recovery, refunds, cleanup failures, support
  reports, and funnel events closely during the initial rollout.
- [ ] Promote platforms, stores, indexing, and acquisition one at a time through the
  larger ecosystem checklist.

## Accepted launch limitations

- Not every host version, attachment surface, inline-media renderer, store lifecycle,
  or enterprise tenant will be tested before the first release.
- OpenClaw remains `tested_with_limits`; n8n remains a preview candidate.
- Cursor, GitHub Copilot, Gemini CLI, Microsoft Copilot, ClawHub publication, n8n
  template submission, and refreshed Claude Code/ChatGPT graphical evidence remain
  post-candidate work unless separately promoted.
- The initial release is treated operationally as a monitored rollout even if the site
  does not display a public beta label.
