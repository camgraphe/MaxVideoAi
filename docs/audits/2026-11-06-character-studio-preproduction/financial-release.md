# Character Studio / Recast — financial and release readiness

Audit snapshot: **6 November 2026, 00:49 Europe/Madrid** (5 November 23:49 UTC).

Candidate: `codex/character-studio-v2`, `c1bc6d0623ab34ad1868b6a71718b0d04adecf30`.
Scope: financial contracts, explicit schema/configuration dependencies and production delivery prerequisites. No product source was changed, production write/migration was performed, secret value was fetched or printed, or paid generation/deployment was started. The existing untracked `output/character-studio-v2/` was left intact.

**Decision: the focused financial checks pass; production readiness is not established.** No incorrect debit, repeated debit or incorrect refund was reproduced in the audited tests. The remaining release gates below must not be represented as financial code failures, nor as already completed operational qualification.

## Findings and release gates

| Priority | Finding | Evidence and required disposition |
| --- | --- | --- |
| **P1 — release gate** | The candidate omits current `main`. | Fresh Git state: `origin/main=f868a026bd56fc2bd75d355512e3f03417ec0853`; `git rev-list --left-right --count HEAD...origin/main` returned **40 / 7**. Incorporate current main in the isolated branch, resolve conflicts, validate the resulting commit and obtain its required Quality CI. Do not release this immutable candidate as-is. Policy: `docs/deployment/github-vercel.md:16-44`. |
| **Passed on the audited SHA** | Required Quality CI completed successfully after the initial snapshot. | Run [42128806072](https://github.com/camgraphe/MaxVideoAi/actions/runs/42128806072) is for the exact candidate. At the parent audit's 00:57 Europe/Madrid refresh, fast, database/media, Browser 1/2, Browser 2/2, **Exhaustive financial cutovers and Quality CI all succeeded**. The newly aligned commit will need its own successful required gate. `docs/engineering/ci-validation.md:3-22`. |
| **P1 — confirmed enablement prerequisite** | Production Character schema and scoped commercial policy are absent; runtime dependencies remain to qualify. | The read-only Neon addendum below confirms missing 93–95 relations and zero exact Recast rules in the verified production branch. The documented ×2 activation was only the isolated test branch. Missing exact policy correctly fails closed. Private HTTPS storage, mode admission, actual account routing, excerpt execution and the poller must also belong to the intended environment; these remain unqualified here. Owners: `recast-readiness.ts:5-27`, `quote-recast.ts:24-30`, migrations 93–95, and `docs/engineering/character-studio.md:440-448`. These are release prerequisites, not evidence of a current production outage. |
| **P2 — qualification gap** | No fresh end-to-end paid Recast execution under the new ×2 owner is established for `c1bc6d062`. | The harness makes executability true, replaces excerpt preparation, and substitutes provider execution (`tests/helpers/character-recast-harness.ts:126-187`). The copied-output recovery test uses the real Alibaba poll owner but substitutes provider reads/storage/projections (`character-studio-recast-payment-postgres.test.ts:208-276`). The earlier live ×2 activation only prepared unconfirmed quotes and explicitly submitted no render (`docs/operations/2026-11-05-character-studio-pricing-audit.md:79-102`). Earlier real videos cannot certify code introduced afterward. Qualify the resulting release candidate through the actual authenticated application, exact reviewed quote, provider acceptance, closed-browser polling, durable storage and immutable final receipt. This audit did not authorize or perform that spend. |
| **P2 — rollback constraint** | Turning off the Recast live flag also prevents same-quote confirmation recovery at the HTTP endpoint. | `frontend/app/api/tools/character-studio/recast/confirm/route.ts:12-20` returns `RENDER_DEFERRED` before authentication/shared quote replay when the flag is off. The shared owner otherwise recovers claimed/accepted/failed quotes before expiry (`confirm-generation.ts:318-331,535-538`). A rollback runbook must retain job/history access and accepted-job polling, and tell operators how to recover affected jobs without preparing another purchase. This does not demonstrate a duplicate charge; the one-quote transaction remains idempotent. |
| **P2 — optional content gate** | Preview marketing copies are not a production publication plan. | The reader requires direct `character-studio-recast` playlist membership, a public independent `/marketing-media/` URL and one of two exact reviewed video IDs (`frontend/server/character-studio/marketing-demos.ts:7-30`). Those copies are documented as test-environment publications (`docs/redesign/2026-11-05-character-studio-marketing/README.md:41-43`). New production identities must be reconciled with that allowlist through the reviewed promotion process; copying preview database or wallet rows is not acceptable. Until publication is separately qualified, the existing still-image fallback is the expected safe result. This blocks claiming production video proof, not deploying a page intentionally using stills. |

## Financial contracts inspected and exercised

### Recast pricing and consent

- Public estimates, preparation and transactional confirmation use `computeCanonicalRecastBillingSnapshot` (`frontend/server/pricing/quote-recast.ts:19-43`). Its exact selector is `character-recast / recast / video`. A database-backed precise policy is required; generic Wan retail, global rules and versioned defaults cannot substitute.
- `frontend/src/lib/character-recast-pricing.ts:3-12` requires USD, standard-compatible rounding, coefficient ×1–×10 and zero flat/audio/upscale extras. The chosen ×2 is represented by `marginPercent=1`. Cost facts use the underlying Wan Prime source-plus-output duration, preserving fractional source seconds. Audio references do not add video seconds. Standard cent rounding means a nominal ×2 does not promise exactly 50% margin for every fractional scenario.
- `frontend/server/character-studio/recast.ts:54-143` resolves an owned portrait/product, prepares each audio/video excerpt independently and uses measured output assets. A quote-binding row is inserted in the same transaction as the shared quote. Confirmation is strict (`quoteId`, `confirmed:true`, nonnegative integer amount, USD), locks the owner/hash binding and checks the approved amount before reservation (`recast.ts:146-182`).
- The shared creator adapter owns quote scope and resolves/locks references again (`frontend/src/server/tools/creator-generation-service.ts:33-97`). Raw generation settings cannot opt into Recast pricing. The initial reservation additionally locks and validates the exact product rule and snapshot provenance (`frontend/server/pricing/recast-reservation-policy.ts:10-25`).

### Charge, expiry, replay and refund

- In `frontend/src/server/agent-api/confirm-generation.ts:318-331`, a claimed/accepted/failed quote recovers its existing job before expiry checks. New work requires a fresh prepared quote, current reference facts, current full pricing snapshot, spending checks and reservation/claim in the transaction (`:343-469`, `:470-507`). Provider submission occurs only after that transaction; repeat confirmation reads the existing job (`:535-579`).
- Fresh PG tests reject wrong owner/amount/currency/consent, expired or tampered approvals, a changed Recast coefficient, missing scoped rules and unavailable policy. They preserve the independence of ordinary model-tariff revisions and reject unaccepted legacy model-price quotes without debit.
- Depleted funds roll back job and receipt creation; a topup permits retrying the same still-valid quote. Concurrent confirmation and a lost response recover one job, one provider call and the original receipt even after expiry/rate change. Terminal rejection refunds the recorded charge exactly once. Ambiguous acceptance retains one charge and does not blindly resubmit or refund. A failed durable-copy attempt retries storage for the existing provider job. Already accepted legacy work retains/refunds its original snapshot.
- The provider double invokes the real reserved-generation submission/rejection-refund owner; the network execution itself is substituted (`tests/helpers/mcp-paid-e2e-harness.ts:181-230`). This supports transactional accounting claims, not actual provider availability or successful remote delivery.

### Images, admin and account isolation

- New Character Studio images/looks/sheets use the native Nano Banana 2.1 tariff and one generated image. The same estimate revision, reservation and immutable receipt were exercised for t2i/i2i at 1K/2K/4K. EN/FR/ES pricing rows were compared with those same values. Existing-job replay produces one receipt (`tests/character-studio-nano21-price-postgres.test.ts:13-103`). The fixed-product exemption is restricted to a matching internal historical product snapshot; ordinary native tariffs retain the revision lock (`frontend/src/server/images/image-initial-job.ts:176-189`).
- **$0.07 / $0.11 / $0.23** are the task's current test-environment prices, also recorded in the prior preview audit; they are not a newly queried production tariff. This audit's deterministic tests prove parity with their configured tariff, not those literal live amounts. No separate Character-only image price was activated, and editing a native Nano21 model tariff can affect ordinary image generation too.
- The admin PG test exercises missing baseline, explicit scoped creation, concurrent confirmation (one succeeds), immutable history, rollback, refusal to roll back to no rule and atomic failure when audit-event insertion fails. Unrelated global policy remains unchanged (`tests/admin-recast-pricing-postgres.test.ts:30-73`). The authorization/route contract and 51 authored scenario parity checks also pass.
- Fresh library tests exercise durable recipes, independent casting notes, duplicate/concurrent saves, foreign IDs/URLs, unfinished/hidden jobs, stored look lineage, renaming, deleted outputs and bounded pagination. SQL readers scope both character and look ownership (`frontend/server/character-studio/store.ts:41-85`); migration 93 enforces the composite `(character_id,user_id)` foreign key. This supplements the financial wrong-owner rejection; it is not a complete browser account-switch qualification.

## Fresh verification on the exact candidate

All commands below completed with exit code 0. PostgreSQL resolved automatically to `/opt/homebrew/opt/postgresql@17/bin`; databases were disposable. No inherited application database was used.

```sh
node scripts/run-postgres-tests.mjs pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/character-studio-recast-payment-postgres.test.ts \
  tests/character-studio-recast-price-parity-postgres.test.ts \
  tests/character-studio-recast-generation-postgres.test.ts \
  tests/character-studio-nano21-price-postgres.test.ts \
  tests/admin-recast-pricing-postgres.test.ts \
  tests/character-studio-library-postgres.test.ts
```

**68 passed, 0 failed, 0 skipped; 9.499 seconds.** The Recast sampled price matrix covers i2v/ref2v/v2v × 480p/720p/1080p × 2/8/15 output seconds, six framings, fractional independent excerpts and the 15+15-second boundary. It is not exhaustive coverage of every continuous source duration. The fixture's “reservation observations unavailable” message concerns an approximate timing estimate; no financial assertion was skipped.

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/character-studio-recast-commercial-pricing.test.ts \
  tests/admin-recast-pricing.test.ts \
  tests/admin-recast-pricing-routes.test.ts \
  tests/recast-pricing-page.test.ts \
  tests/wan-prime-reference-compatibility.test.ts \
  tests/character-studio-recast-request.test.ts
```

**18 passed, 0 failed, 0 skipped; 9.803 seconds.** Historical unnumbered Wan reference hashes and already claimed/accepted work remain compatible. `git diff --check` also passed. No duplicate full local suite/build was started while required CI was already running.

## Required production runbook

1. **Immutable delivery candidate.** Incorporate freshly fetched main, rerun appropriate focused checks and obtain successful required Quality CI on the final commit, including exhaustive financial and both browser lanes. Qualify its exact READY Git preview. Run the documented read-only `pnpm deployment:check --preview <exact-origin>` and premerge `pnpm deployment:check` from that committed candidate. Repeat the main/provenance check immediately before merge; use GitHub PR → main → Vercel Git deployment. No CLI production upload, promotion or manual alias shortcut is implied.
2. **Schema before feature exposure.** Read-only inventory the actual target Neon project/branch/database first, then explicitly apply the approved ordered migrations through the migration owner. 93 requires `profiles` and creates owner-indexed characters/looks; 94 adds object-valued casting presentation; 95 requires `mcp_generation_quotes` and binds each quote to owner/hash/passages. Confirm tables, columns, keys/indexes and ordinary app access afterward. The library already queries its tables without request-time bootstrap. Do not use a missing-schema page error as a migration mechanism. No schema rollback by dropping paid/history tables.
3. **Environment-specific commercial setup.** In production's authenticated Pricing → Tools, preview and explicitly confirm only the exact Recast rule at ×2, USD, standard rounding and zero extras. Record the rule ID, immutable event and before/after snapshots. Verify representative fresh public estimates and actual prepared quotes, including 6-second output-only 720p/1080p, fractional video source, audio on/off and 15+15 limits; retain exact cent-rounded results. Compare ordinary Wan/Nano21 and the separate creator-tool policies before/after. Re-read native Nano21 1K/2K/4K prices; do not reactivate legacy Character Draft/Final products as a substitute. Never import test topups/receipts or describe seeded credit as Stripe funding.
4. **Runtime admission.** Verify `CHARACTER_STUDIO_RECAST_LIVE_ENABLED`, underlying provider availability and actual intended non-admin modes in the newly built environment. Rehearsal is development/loopback-only (`recast-rehearsal.ts:19-37`) and cannot certify a hosted purchase. Check Alibaba master/public-routing/admin-only flags, region/credential/endpoint coupling and the selected modes; readiness alone does not exercise the provider. The invalid historical region-in-hostname endpoint must not survive an environment override. Do not enable new fallback routes merely to pass a canary. Configuration repairs require qualification of a new deployment, not assumptions about an already built one.
5. **Private originals and excerpt workers.** Qualify the target private HTTPS bucket, owner-bound upload and signed/provider access; verify originals remain private, independent video/audio FFmpeg excerpts contain the requested content and measurements, and provider URLs are readable through the intended grants. `recastReadiness` checks configuration and URL shape, not end-to-end network/content delivery. Keep the source and final exact originals distinct from thumbnails/previews.
6. **Full-pipeline acceptance evidence.** On the final candidate, use an explicitly approved bounded test scene/quote and record authenticated browser preparation, reviewed total, confirmation, one quote/job/charge, provider task acceptance, polling, durable original copy, thumbnail/library/history visibility and unchanged receipt. Include one video+audio passage case and relevant reference mode(s); qualify image create/look/sheet flows separately. Test real-browser lost-response recovery, insufficient funds/topup retry, expiry before confirmation and reload/account-switch behavior with controlled boundaries. Do not force a supplier outage or spend on every edge case: use the existing deterministic tests for those failure cases and qualify operational incident handling without duplicating paid work.
7. **Polling and recovery.** Production declares `/api/cron/alibaba-model-studio-poll` every minute (`frontend/vercel.json:22`); verify authorized execution against the same database and storage until originals are durable. Preview requires interactive or explicitly targeted existing polling, not assumed production cron. Record accepted task IDs and pending-copy/unknown-acceptance handling. During rollback, stop new Recast orders while preserving accepted-job polling and owner history; the Recast confirmation endpoint itself stops recovery when its live flag is off. Never blindly resubmit an ambiguous accepted job or refund while a recoverable provider result is pending.
8. **Marketing promotion, if included.** Follow `docs/engineering/marketing-media.md:41-48`, including migration 78 / `MARKETING_MEDIA_ENABLED` only where needed. Use independently prepared marketing copies, exact source/reference rights, intended reviewed identities and direct playlist membership. Preserve the allowlist semantics when reconciling production IDs. Verify public HEAD/GET/206 Range, poster, zero original-video requests before Play, first frame, seeking/audio and mobile/desktop playback. Reuse no private preview URLs and copy no preview database/ledger. Otherwise document the deliberate still-image fallback.
9. **Postdeployment provenance.** After Git deployment is READY, fetch the merged main and rerun `pnpm deployment:check`; both `maxvideoai.com` and `api.maxvideoai.com` must equal the merged commit. Smoke-test the relevant authenticated/public/localized routes, fresh price readers and runtime errors. Retain PR, merge SHA, deployment ID, schema/policy evidence and the agreed rollback target. A successful build alone establishes none of these environment checks.

## Evidence boundaries

- At the initial snapshot, no live production inventory had been performed. The read-only Neon addendum below subsequently verifies the target, missing schema/policy and missing marketing publications. Runtime flags, storage, cron execution and domain alignment remain outside this sub-audit's live checks.
- The dated documents are provenance for earlier test-environment activity. Their earlier “not activated” sections predate the later isolated ×2 activation and must not override its later scope. Conversely, that test activation must not be projected onto production.
- Native image supplier usage figures and Wan LIST-based cost facts are not reconciled invoices or a complete profit calculation. Fees, storage, processing, support and possible provider account adjustments are separate.
- This report is tied to the commit above. Incorporating current main creates a new release candidate requiring renewed relevant evidence.

## Read-only production prerequisite inventory — 00:54 Europe/Madrid

Follow-up observation: **6 November 2026, 00:54 Europe/Madrid** (5 November 23:54 UTC). This section supersedes the **unverified schema/policy** part of the initial P1 finding and the unknown production-publication part of the P2 content finding. It does not change their release disposition or qualify the other runtime dependencies.

### Target verification before SQL

The connected Neon metadata identifies:

| Field | Observed value |
| --- | --- |
| Project | `DATAMAXVIDEOAI` / `shy-flower-71253790` |
| Region / PostgreSQL | `aws-us-east-2` / 17 |
| Production branch | `main` / `br-late-term-aeo22xpz` |
| Branch metadata | `primary=true`, `default=true`, `current_state=ready` |
| Explicit production evidence | Branch restricted-action reasons include **`vercel production branch`** and **`vercel production branch read-write endpoint`** |
| Database | `neondb`, returned by the branch-specific database listing |
| Separate test branch | `character-studio-v2-test` / `br-square-king-aenyqhsq`, `primary=false`, `default=false`; no follow-up SQL was sent there |

Tools: `describe_project`, `list_branches`, `get_branch`, `list_postgres_databases`, then `run_sql`. Every SQL request explicitly supplied project `shy-flower-71253790`, branch `br-late-term-aeo22xpz` and database `neondb`. Production identity is supported by the explicit Vercel production designation, not inferred from the test branch's ancestry or from the name `main` alone. This establishes the Neon production target; it is not a revalidation of both live website domain deployments.

### Confirmed prerequisites

| Check | Live result | Release implication |
| --- | --- | --- |
| `public.character_studio_characters` | **Absent** | Migration 93's character storage is not installed. |
| `public.character_studio_looks` | **Absent** | Migration 93's look storage/composite owner constraint is not installed. |
| `character_studio_characters.presentation` | **Absent with its owning table** | Migration 94's casting notes cannot be present in the expected table. |
| `public.character_studio_recast_quotes` | **Absent** | Migration 95's Recast quote binding is not installed. |
| Existing prerequisite relations | `public.profiles`, `public.mcp_generation_quotes`, `public.app_pricing_rules` present | Basic relation existence only; this does not certify every pre-existing column/constraint. |
| Precise Recast policy | **0 rows** for `engine_id='character-recast' AND mode='recast' AND resolution='video'` | The test ×2 rule has not been installed in this production branch. The new quote owner will correctly refuse a price until explicit production policy configuration. |
| `character-studio-recast` playlist | **0 matching**, **0 public**, **0 direct memberships** | Required production placement has not been created. |
| Reviewed Dixie ID `5833eee1-6c61-451c-a455-a5b08716cffc` | **0 marketing-copy rows**, **0 ready copies**, **0 public target-playlist memberships** | No independent production copy exists under the reviewed identity. |
| Reviewed Vesper ID `b95c603e-2339-440e-b50e-7b7b2757da3c` | **0 marketing-copy rows**, **0 ready copies**, **0 public target-playlist memberships** | Same prerequisite for the second demo. |
| Existing marketing infrastructure | `public.marketing_media`, `public.playlists`, `public.playlist_items` present | Do not assume these tables' existence means the two content publications are ready. |

**P1 confirmed:** production needs the explicit 93–95 schema installation and precise scoped Recast policy configuration before the new feature can be enabled successfully. **P2 confirmed:** the two video demonstrations cannot appear through the current production playlist/allowlist reader until a reviewed production publication and placement exists. The still-image fallback remains valid in the meantime.

### Query boundaries and reproducibility

Catalog queries inspected only `pg_catalog.pg_class`, `pg_catalog.pg_namespace` and `information_schema.columns`, scoped to the named Character/pricing/playlist/marketing relations. A second catalog check found no public `character_studio%` relation. Pricing read selected only commercial rule fields, omitted vendor-account and actor identifiers, and used this exact predicate:

```sql
SELECT id, engine_id, mode, resolution, margin_percent, margin_flat_cents,
       surcharge_audio_percent, surcharge_upscale_percent, currency,
       compatibility_profile, effective_from, updated_at
FROM public.app_pricing_rules
WHERE engine_id = 'character-recast'
  AND mode = 'recast' AND resolution = 'video'
ORDER BY effective_from DESC NULLS LAST, id
LIMIT 10;
```

Content queries returned only counts for the exact playlist slug and the two reviewed IDs. Marketing-copy presence was checked in `public.marketing_media` by exact `video_id`, with readiness counts filtered to `state='ready'`; public membership counted only joins to the exact slug with `playlists.is_public=true`. Since no copy rows exist, there was no publication visibility or URL to inspect. No private jobs, users, wallets, receipts, media URLs, snapshots or reference assets were read. No connection string was requested or returned. All SQL was `SELECT`; no migration, policy activation, publication, permission or environment change occurred.
