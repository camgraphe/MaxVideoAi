# Toolbox validation — 8 September 2026

> Historical validation record. The four finishing tools were subsequently activated under the owner-approved production pilot recorded on 8 September 2026 in `frontend/src/server/tools/finishing-release.ts`.

## Delivered scope

Compact visual catalogue, simplified Upscale image/video and video background-removal workbenches, reusable presentation slots, typed identities/eligibility/results, read-only canonical quotes and accepted-price guards. Character Builder, Storyboard and Angle retain their existing rich workflows and routes. Candidate tools stay excluded pending qualification. No Studio project migration, new MCP quick-tool execution, provider activation, deployment or paid generation.

The user requested smaller quick-tool cards and then less text throughout this surface. Final visible hierarchy is cover/name → source → media → primary adjustment → run/price; secondary controls live in Options. Empty history and repeated explanatory text are removed. Main coordinator received the same simplification direction for the rest of the app.

## Evidence

- Full `npm run test:validate`: **4,486 passed, 0 failed**, 134 seconds. A later safe-download MIME-policy addition was verified separately with the existing MCP import suite and tool tests: **14 passed**. Default MCP import policy stays unchanged; explicit tool policy accepts MP4/MOV/WebM and retains private-DNS/byte guards.
- Focused UI/contracts/quote race/thumbnail suites: **23 passed**. Separate stored-thumbnail + media-library/performance contracts: **35 passed**. Final guest-action text adjustment rechecked with TypeScript and the two affected workspace contracts.
- Frontend lint, public exposure check, TypeScript and `git diff --check` passed.
- Full production build in detached temporary worktree at **99404b21f**: exit **0**, **862** static pages. Model registry, public-rendition and immutable-home-poster prebuild gates passed. Existing Supabase Edge-runtime and Webpack cache warnings remain. The subsequent guest sign-in label/layout change is isolated in `e3ba0a533` and was type/smoke/contract checked.
- Browser checks on localhost: **320, 390, 768, 1366 and 1920px** layouts; light and dark; French/English; catalogue media filters and route targets; no horizontal page overflow at measured widths. At 1366px quick cards measured **186 × 156px**; workshops retain larger covers.
- Actual workbench components exercised with explicit local simulated transport: source/library selection, loading quote, disabled run until ready, locked controls during request, completed image comparison, video source/result, video background-removal result, reuse actions. A local 2s clip reached duration/currentTime **2s**, controls active, unmuted, no video error. This is UI/playback evidence, not provider-output qualification.
- Quote DOM test covers render-time invalidation, request/account changes, delayed obsolete responses, account round trips, invalid currency response and retry. Accepted-price checks occur before job/debit in both service owners.
- Browser unknown-host/signed-query thumbnail: exact `currentSrc` preserved, lazy loaded, no `srcset`/public optimizer; DOM tests cover unknown, private/signed and localhost sources plus exact-original fallback.
- Local fixture installer/cleaner exercised successfully. Committed application routes contain no simulation/auth override. Normal preview is guest-only unless real local auth is configured.

## Integration order

Base merge `059a5f0fa` combined initial `ab2cb9fbd` with app socle `cf5acc60f`; it is ancestry, not a Toolbox cherry-pick for a coordinator that already owns the socle.

1. `1cf47ba79` — inventory/plan and versioned source brief.
2. `faf137284` — shared catalogue/contract; Studio imported as `431d69775`.
3. `cb57905b8` — visual catalogue/scenes and corrected Character Builder reference bound.
4. `ab732adf2` — canonical quote endpoint and optional accepted-quote execution guard.
5. `c063c018b` — compact utility cards.
6. `56b932ebd` — shared stored-image/poster modal fix; **already integrated by main as `229ed4961`**, so skip duplicating it.
7. `99404b21f` — final simplified workbenches, quote lifecycle, safe metadata preparation, shared result normalizer, fixtures and contracts.
8. `e3ba0a533` — compact localized guest action.

No Studio commits were imported into this Toolbox worktree. Studio owns placement/canvas/timeline/persistence and keeps legacy adapters; main owns final convergence and release validation. Long legacy URL-derived media IDs still require canonical public-ID resolution by the media owner before using v1 blocks.

Preview: `http://localhost:3036/app/tools` on branch `codex/connected-toolbox`.


## Selected finishing tools checkpoint — 8 September

Code commit: `b6ea6b36a`. Adds Restore Video, Denoise, Fix Blur and Smooth Motion, with compact shared forms and Standard/Pro candidates. All four are explicitly in validation; no paid run or commercial activation occurred.

- Full suite: **4,503 passed, 0 failed, 0 skipped** (`pnpm test:validate`, exit 0).
- Final targeted corrections: **43 passed**, including disposable PostgreSQL ownership, exact output lineage, concurrent idempotency, transaction rollback, completion claim, exact refund and migration42 pricing behavior.
- Final frontend TypeScript, lint (including explicit server pricing lint), public exposure and diff checks: exit 0.
- Final isolated production build: exit 0; optimized compilation, types, static generation and pre/postbuild gates completed. Existing Supabase Edge-runtime/cache/type-stripping warnings remain; no new lint warning.
- Browser review: compact catalogue at 320/390/1440 widths; real visitor form at 390/768; no horizontal overflow. Standard/Pro, localized library selection, stale quote invalidation, locked processing, simulated Denoise result and reuse verified in the local transport fixture. Restore reconstruction notice, Fix Blur's single mode and Smooth Motion's 60/120fps controls verified. No live account login, provider fidelity or real invoice was tested.
- Fixture cleaned before final validation/commit. The dedicated 3036 preview was stopped at the user's consolidation request.

The first full runs exposed stale auth ownership and pricing-order assumptions, then a real database default overriding the new target. The final tests cover the corrected shared auth owner and an explicit engine pricing migration with a missing-policy refusal. No production policy was changed.

Logs remain at `/tmp/toolbox-finishing-full-tests-verified.log`, `/tmp/toolbox-finishing-corrections.log`, `/tmp/toolbox-finishing-build-final.log`, `/tmp/toolbox-finishing-final-types.log`, `/tmp/toolbox-finishing-final-lint.log`. The isolated build checkout is `/tmp/maxvideoai-toolbox-finishing-build-20260908` and contains only a copy of this committed implementation plus build artifacts, without copied environment files.
