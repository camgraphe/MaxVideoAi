# SDD ledger — plan: docs/superpowers/plans/2026-09-29-all-model-manual-customer-tariffs.md

Base: b886734fc. Worktree: codex/bytedance-pricing-grid.
Pre-flight: Task 1 inventory feeds Task 2 versioned cells and Task 6 coverage gate; Task 2 state feeds Task 3 canonical resolution and Task 4 editor; Task 3 feeds Task 5 public consumers; Task 4 preview/history feeds Task 6 acceptance. No independent activation path exists.
Ruling: Start with the read-only Task 4 inventory slice before Task 1 — user explicitly needs to see every family in admin; it is reversible and does not activate or edit tariffs. Cost if wrong: the comparison can show a representative scenario that is not the eventual tariff cell, so its scenario label and provenance must stay explicit.
Task 1: read-only collector and dated report complete for 66,549 sampled scenarios, with zero quote gaps and 122 explicitly unresolved capability boundaries. Local database identity matched the linked Vercel production environment by host, database and username. See `docs/engineering/2026-09-29-customer-tariff-baseline.md`. Do not activate manual tariffs until continuous and media-dependent options are resolved and full parity is proven.
Task 5: current server quote route and browser estimator/chip, Pricing video/image table, model visible offer/Product JSON-LD and decision cards, and homepage Wan 3 price demo implemented. Unsupported public scenarios omit a numeric amount. Focused tests, TypeScript, lint, billing/public baselines, zero-mismatch pricing audit, 53-case SEO check and full Next.js build pass. The local browser verified FR Pricing image/video tables, Pika model Product offer, and the 48-model/15-family admin grid. MCP marketing budget projection and revision binding for an active manual-tariff edit remain unresolved. Task 6 activation stays off behind the 122 capability gaps and missing complete manual seed.

Continuation 2026-09-29: user explicitly requires no production effects. Added local socket PostgreSQL launcher, stripped external runtime credentials and persisted sanitized worktree .env.local with private backup. Local staged seed copies 66,549 reviewed cents; global activation remains off. Added migration 55 immutable closed versions, active edit/rollback transaction support, exact-selector quote reads and public revalidation. Focused tests RED→GREEN; TypeScript passes. Runtime session 33224 on port 3106; local DB directory maxvideoai-pricing-sandbox-0R5CZY. Full coverage, settlement provenance and charge revision binding still pending.

## Continuation — displayed revisions and immutable paid recovery

Local commit `946d73d5a` binds web/image/Studio/Storyboard displayed manual revisions to new wallet reservations. The debit transaction locks and validates the tariff revision; MCP maps the race to stale_quote. Browser estimates refresh without auto-submit. Paid owned image/storyboard retries return their stored quote before current-price/reference/provider work; recovered reservations preserve audit snapshots. Included first-frame generation follows owned paid-parent validation without a new charge.

Review found two P2 gaps (early paid-image recovery and Storyboard snapshot propagation), both fixed and accepted on follow-up review. Full standard validator: 6,284 pass / 0 fail / 2 skip. Committed-snapshot isolated Studio integrations: 11 pass / 0 fail. Local build, TS, lint, exposure, registry and i18n pass; billing baseline 178/public baseline 577 and pricing audit pass. Sanitized env was moved/restored for isolated Studio tests, never replaced with remote credentials. Admin stays on localhost:3106 with a private socket DB; production manual flag false.

Not cutover-ready: 122 unresolved coverage boundaries, complete reviewed versioned seed, temporal quote acceptance of the first versioned-only override, supplier settlement provenance, captured direct PaymentIntent original-quote contract, remaining consumer and visual/localized acceptance, complete atomic activation gate. No push, deploy, production write, provider request or support message.

## Supplier continuation — 2026-09-30

Ruling: the user wants missing Supplier LIST explained and populated, not retail repriced. Share exact server pricing contexts across comparison/detail; project independent published rates where reviewed, otherwise label dated repository references and cross-provider uncertainty. No margin, customer total, receipt or settlement mutation. Initial Fal public rates independently verified with primary model pages; BytePlus source remains the reviewed 2026-09-28 tariff. Cost if wrong: overstating list verification or labeling another provider as the execution account; statuses, dates and routeMatches make both explicit.

Additional authorized Task 4 gate: first active override of a fixed versioned-only tariff previously recorded null history and could not roll back. Disposable PostgreSQL RED→GREEN now proves original versioned provenance, 26→31→26, an appended closed version and no deletion of active coverage. Production seed/flag remain unchanged.

Review follow-up at 256651142 accepts GPT source normalization/exact components, known Seedance reference inputs, selected Ark/LAS readiness, Google Veo provenance and preview race protection. Independent 60 focused tests and TS pass. Full final validator at 4257fdad6: 6,297 standard + 11 isolated Studio pass, zero failures, two skips. First run caught two old UI label assertions; updated view contracts pass. Source env was held/restored in finally, guard unchanged.

Build passed. Restarted the same private PostgreSQL 14 / sanitized Next runtime (tool session 5425, Next PID 78607). HTTP accepts 48 models/15 families, 8 reviewed LIST/40 catalogue references, zero representative supplier gaps, all pre-supplier customer scenario IDs/cents unchanged, active false/revision 3. Exact Mini durations and GPT source count checked via API; actual invoice/account evidence remains absent. See supplier-http-acceptance.json. No visual acceptance claimed.


## Continuation — original captured direct quotes, 2026-09-30

Base: b8a92a36a. Resumed partial Task 3 payment gate; prior implemented Tasks 1–5 are not repeated.
Ruling: persist complete immutable original quotes before Stripe creation, bind normalized text-to-video scenarios, refuse unverified input-media modes — preserving a captured amount requires complete trusted facts, and supplier catalogue estimates cannot reconstruct a paid quote. Cost if wrong: a legacy unsupported direct request is refused; normal wallet generation is unchanged.
Ruling: global receipt payment identifiers remain unique; refunds retain original references in metadata — avoids silently discarding a refund that shares an existing charge's PI. Cost if wrong: callers requiring the old refund PI column must read the documented metadata field.
RED→GREEN: captured revision-7 recovery at revision 8; immutable quote creation/stale revision rejection; historical EUR settlement under current USD preference; refunded capture refusal; actual charge/refund uniqueness; stable failed-Stripe retry; absent-vs-off audio; loop binding. Existing wallet stale-revision guard remains tested. Fresh independent reviewer found and drove corrections to initial job revision validation, scenario defaults, source media refusal, refund replay, current currency dependence, duplicate PI/job, retry idempotency and refund uniqueness.
Global manual activation remains off. Full coverage, reviewed current seed, supplier/account settlement provenance, legacy unbound PaymentIntent reconciliation and final activation certificate remain gates.

Final review correction: shared wallet-funding classification excludes direct card charge/refund rows from wallet readers/reservations, summary, Timeline and fraud balance. PostgreSQL RED 800!=1000 → GREEN, including unfunded refund-only reservation refusal. First complete run: 6,333 pass / 5 fail / 3 skip; corrected partial membership guard, two extracted-owner architecture assertions and two missing explicit current-policy rendering fixtures. Full committed correction validation remains pending. Task 3 remains partial; activation off.

Final correction acceptance at 9a8ff881f: 6,339 standard + 11 isolated Studio pass, 0 fail, 3 standard skips (1,069 standard files). A second full run exposed one reduced MCP receipt fixture missing real funding columns; diagnostic RED unknown-column, completed fixture GREEN. Final focused payment/wallet/Timeline/fraud group 43/43. TS, focused server ESLint, app lint, exposure and diff checks pass. Reviewer accepts wallet/card funding fix without additional P1/P2. Sanitized env held/restored in finally. Runtime session 84781 restarted localhost:3106; admin/inventory HTTP200, 48 models/15 families, no missing representative amounts, active false/revision3/gaps122. Browser reload of existing internal error tabs rejected by URL protocol policy; no workaround. Task3 remains partial for actual settlement evidence and legacy unbound PI reconciliation; full coverage/seed/activation certificate remain pending. No remote writes, push/deploy, real Stripe/provider/storage/email or support calls.


## Continuation — bounded matrix and charging selectors, 2026-09-30

Base: 3c7bfd309. Resume partial Task 1 and its admin/public consumers. Ruling: enumerate schema-bounded image batches and priced references, image-only video references and actual legacy loop controls; retain mixed-media/auto/continuous gates. Cost if wrong: catalog bounds may lag executable validation, so independent generation-shaped selectors and retained gaps are mandatory. No commercial formula or global activation change.

The shared collector now owns selectors and quantities through buildManualTariffScenario; removed duplicate admin reference expansion. Independent read-only coverage review found video ref2v inputImageCount and fixed GPT customImageSize mismatches. Reproduced RED, corrected both; cascade references before their derived input count; preserve Seedream supplier primary-image projection. Public defaults and image batch labels accepted. Remaining minor review note: whole-grid admin recomputation is not a performance acceptance.

Corrected private read-only report: 118,007/118,007 quotes, zero quote gaps, 119 capability gaps (six image-reference boundaries closed, three Ray 3.2 HDR/EXR projection gates added). All 66,549 original baseline scenarios reconciled, 1,380 normalized identities, zero missing or changed cents/currency. Historical report and staged seed unchanged. Local model rows all use default; this is parity against the reviewed Sept 29 capture, not a new production-state guarantee.

Focused 102/102; independent charging-context tests 8/8; billing immutable178/public577 and pricing audit zero mismatches; TS, app/owner lint, exposure and diff checks pass. HTTP200 admin and inventories, 48/15, unchanged representative cents, active false / revision 3 / gaps 119. App panel opener returned queued; no browser visual acceptance claimed. Full committed-snapshot validator still pending at this checkpoint. Task 1 remains partial; complete current seed, continuous/metadata inputs, actual settlement evidence, legacy unbound PI and activation certificate remain gates. No remote request, production write, push/deploy or support message.

Final committed-snapshot validation at 70eb58797: 6,346 standard + 11 isolated Studio pass, zero failures, three standard skips. Sanitized .env.local held outside checkout and restored in finally; private DB preserved. Runtime restart and exact HTTP selection acceptance follow. Task 1 remains partial; no activation, remote write, push, deploy or support message.

Runtime session 20617 restored on localhost:3106 with the same private socket DB. Final HTTP verifies 48 models / 15 families, unchanged representative cents, active false / revision 3 / 119 gaps; GPT four-output/sixteen-reference, Veo two-reference and Luma zero-additional-reference admin/public quotes match. A later browser inventory exposed functioning normal HTTP tabs: inspected tab 7 populated with the five categories and unit-cost/margin rows, made the integrated browser visible and retained the tab. Old blocked error tabs were untouched. No new mobile acceptance or tariff confirmation performed. Task 1 stays partial.


## Continuation — GPT billing-size tiers, 2026-09-30

Base: 09d47ae6e. Resume partial Task 1 with public/admin consumers. Ruling: author six existing factual GPT billing tiers rather than unbounded raw sizes or unpriced orientations — the current billing owner already maps these dimensions. Preserve requested pixels, legacy policy selection, qualities, output batches and priced references. Cost if wrong: different raw sizes could share a manual price despite a resolution-specific legacy override; all captured aliases must reconcile without a cent conflict before seed activation. Public auto quotes require known dimensions, custom quotes use generation bounds; automatic source bounds remain those of actual charging.

RED→GREEN proves three-model/mode/quality/batch/reference mapping, active injected tier override/revision, stale raw selector refusal and malformed public size rejection. Private read-only report 79,991/79,991 quotes; all 118,007 prior bounded rows map with zero missing or changed cents/currency; all 66,549 original rows also match. Twelve GPT resolution/aspect boundaries close; 107 coverage gaps remain. Historical captures and inactive staged seed preserved. Billing178/public577 unchanged; pricing audit passes, focused111/111 plus new public validation7/7, TS/app lint/exposure pass. Review and committed full validation pending. No activation or external side effects.

Independent GPT slice review at e281001d9: three P2 findings, no minors. Fixed in one RED→GREEN pass: omitted/null quality -> factual high; delegated GPT25 i2i confirmation -> same reference count as preparation (preexisting stale-quote failure, snapshot guard protected debit); mode-scoped fixed preset context retained in collector for matching default tier -> precise legacy alias policy preserved in inventory/detail/public. Reviewed221/221, TS/owner lint pass. Corrected read-only capture at 2026-09-30T12:32:27.522Z has identical79,991 IDs/cents/currencies/policy IDs and107 gaps. Initial e281001d9 full validator6350 standard+11 Studio passed; corrected committed validation pending.
Ruling: keep conflicting legacy alias prices observable and block later no-change activation if captured — a single authored tier cannot preserve two distinct effective alias totals. Cost if wrong: an unnoticed alias policy could change a customer price at cutover; baseline conflict validation is required.
Final: Ruling: review set aside complete seed/107 boundaries/global activation — still explicit blocking gates, no completion claim; cost if wrong is an incomplete cutover, so activation remains off.
Final: Ruling: review set aside production parity and actual supplier/account costs — evidence remains private/offline and supplier estimates retain provenance; cost if wrong is overstated cost certainty, so no such assertion is made.
Final: Ruling: review set aside browser layout and grid latency — verify the visible changed admin control after runtime restoration; full responsive/latency acceptance remains pending. Cost if wrong: usability or performance issue, no performance claim.

Final pricing-code validator at 9ed669452:6353 standard+11 isolated Studio pass,0 failures,3 standard skips,1070 standard files. Sanitized env restored in finally. Runtime8825 resumes same private socket DB. HTTP200 admin and inventories;48/15, unchanged representative cents, inactive/revision3/gaps107;12 exact GPT fixed/preset/custom/auto requests match admin and public. Unknown/invalid dimensions omit prices.
Browser acceptance found the legacy client aspect-required guard rejected new GPT identities and hid the editor. All79,991 real identities reproduced RED, guard permits omitted aspect only for GPT GREEN; focused editor/preview/decision/tier10/10, TS/client lint pass. This UI follow-up was after full pricing-code validation; no later full-suite claim. Real browser verifies six tiers/options, 4K+three refs supplier0.13608/customer0.18/margin24.4% with preview available. No confirmation/write. Visible tab7 retained, actual screenshot/tmp/maxvideoai-gpt-tiers-admin.jpg. Current aliases must be re-quoted for conflicts before activation, historical default capture is insufficient for a new alias rule. Task1 remains partial; same activation/settlement/legacy PI gates, no production/provider/Stripe/support/push/deploy.


## Continuation — exact fractional Wan input scenarios, 2026-09-30

Base: 379c1b6f2. Resume partial Task 1 and admin/public consumers.
Task 1: Ruling: the intended continuous Wan unit tariff cannot be obtained by dividing a captured total or multiplying the current retail rate: the existing standard margin rounds separately (82.5 exact supplier cents + ceil(24.75) -> 108 customer cents; nearest(8.25 × 13) -> 107). Implement exact fractional read-only/admin scenarios first, keeping the four continuous-input gaps and inactive seed/activation. A later continuous seed must prove all effective-policy rounding boundaries or carry explicitly approved deltas; no runtime percentage fallback disguised as an authored tariff. Cost if wrong: a price cent changes or an exact cell wrongly covers neighboring media; unchanged formula and exact identity tests guard both.
RED→GREEN: four Wan/Prime v2v/extend decimal identities, actual 3.25-second source facts, 29-second output limit, unsupported/malformed metadata, bounded schema reconstruction, zero writes for stale fingerprints, staged live-price preservation, active injected billing/public parity, temporal rollback and immutable versions on disposable PostgreSQL. Client numeric control remains correctable after invalid input and cancels prior approval; original pending-preview race tests retained. Focused 86/86 and TS pass. Original 79,991-scenario matrix and 107 boundaries remain unchanged. Full validation/review/local browser acceptance pending. Production seed flag false, no remote writes/provider/payment/email/support calls or push/deploy.

Independent fresh-context Wan review of 379c1b6f2..1f897d59e: no actionable P1/P2 and no minors; independent scenario/client 6/6 passed.
Final: Ruling: review set aside continuous coverage/complete seed/activation — the 107 boundaries remain explicit gates, original seed preserved, global state inactive; cost if wrong is an incomplete or price-changing cutover, so no activation certificate is claimed.
Final: Ruling: review set aside production parity/current account supplier costs — new capture is private local only, estimate provenance retained; cost if wrong is overstating current production prices or profitability, so no production/account assertion is made.
Final: Ruling: review set aside real browser layout/performance — verify actual source field and quoted totals after runtime restoration; full responsive/latency acceptance stays pending. Cost if wrong is a usability/performance defect, no such acceptance claimed.
Final: Ruling: review set aside unchanged payment/publication/outage contracts — complete committed-snapshot validator passed and inactive global gate retained; actual settlement, legacy unbound payments and final cutover remain pending. No complete-plan claim.
Complete validator at 1f897d59e:6,361 standard + 11 isolated Studio pass, 0 failures, 3 standard skips, 1,073 standard files. Sanitized env held/restored in finally; same private DB preserved. Runtime 12598 restored localhost:3106. Read-only effective capture at 2026-09-30T13:30:21.285Z:79,991 rows / 0 quote gaps / 107 capability gaps, identical IDs/cents/currency/provenance to corrected GPT capture. Original captured/staged data unchanged. Billing 178 / public 577 immutable/current, pricingaudit0mismatches; TS/app lint/exposure/diff pass. HTTP 24 exact decimal cases (Wan/Prime,v2v/extend,480p / 720p / 1080p,source 3.25 / output 5 andsource 0.75 / output 29) match admin/public; invalid source/missing facts rejected. Inventory 48 models / 15 families, unchanged representative customer cents, inactive / revision 3. No HTTP confirmation or writes. Task 1 stays partial; no production/provider/payment/email/support/push/deploy.

Real browser acceptance after restart: existing normal tab 7 reloaded, Video/Wan filtered, v2v 5 s 720p source 3.25 s -> supplier 0.825 / customer 1.08 / margin 23.6%. Actual numeric field accepts decimals; 16 s rejected, approval disabled, field correctable; restoring 3.25 reloads correct quote. Server preview opened at 1.08, no confirmation. Screenshot /tmp/maxvideoai-wan-fractional-admin.jpg, tab retained. Final private DB SELECT confirms inactive / revision 3 / 66,549 staged cells, unchanged. Full responsive/latency acceptance not claimed.


## Continuous execution — authored Wan source units, 2026-09-30

Base: 81dfada40. User explicitly requests uninterrupted execution toward a complete local result; no additional per-task approval is needed. Production remains a separate gate.
Task 1/3/4: Ruling: preserve exact scenario IDs and explicit point exceptions, then resolve a reviewed Wan v2v/extend continuous source class with all other dimensions exact — this preserves previously prepared/historical identities while allowing trusted decimal quantities. Cost if wrong: a point exception may retain a different price after a range edit; active preview warns and keeps that exception precedence. No wildcard or generic fallback is introduced.
Task 1/3: Ruling: freeze independent absolute component rates/flats plus quantity/component/final rounding, rather than deriving retail from supplier or a live percentage — preserves current cent boundaries including microscopic input quantities. Cost if wrong: an unreviewed compatibility profile could change cents; the offline compiler rejects it and initial coverage/seed gates remain open.
Task 4: Ruling: validate every supplier-ceil-cent interval on the entire bounded input range before preparing or applying a continuous change — nonnegative customer amounts and Wan supplier amounts are monotone, so the first representable input of each interval is the worst point. Cost if wrong: below-reference pricing could occur between displayed examples; boundary tests include such an interior loss, and actual contract cost remains explicitly unknown.
RED→GREEN: rounded-components kernel, store/quote fallback, offline Wan compiler across model/mode/resolution/output/effective-margin boundaries, whole-range loss guard, real PostgreSQL preview/confirm/revision/public quotes/versioned rollback, per-second client conversion and approval cancellation. Preserve-current explicitly copies live legacy prices while inactive, current authored amounts after activation (prepared draft 129 vs live108 reproduced and corrected). Original exact exception behavior remains tested.
Focused original regressions72/72, continuous pure/integration11/11, actual PostgreSQL continuous+exact2/2, UI3/3; TypeScript, app lint, exposure and diff checks pass. Billing178/public577 remain unchanged; pricing audit zero mismatches. Browser verifies preserve1.08→1.08 and linear draft1.07 with full-range guard; cancelled without confirmation/write. Actual screenshot/tmp/maxvideoai-wan-continuous-admin.jpg. Same private DB/runtime12598, original staged seed/activation unchanged. Four continuous matrix boundaries and complete seed evidence remain open at this checkpoint; execution continues, not a completed-plan claim. No production/provider/Stripe/storage/email/support/push/deploy.


## Continuous execution — priced aspect identities, 2026-09-30

Base:32c473983. Task1/4/5: Ruling: only factual price-changing orientations author separate cells; keep raw orientation in generation/public contexts and independent supplier comparison. Token dimensions stay separate, configured equal auto dimensions alias default; unknown synthetic facts preserve exact behavior. Cost if wrong: unequal factual costs could alias, so the contract checks every current unpriced owner across supported orientation/options combinations and the read-only prior matrix is reconciled.
RED→GREEN aspect/default/inherited-i2v/public/active-cell tests; coverage/editor/real PostgreSQL continuous+exact group19/19. Original regressions74/75 then corrected synthetic Wan billing fixture to use actual factual owner; isolated corrected5/5. TS passes; immutable billing178/current public577 and pricing audit0mismatches. Private repeatable-read capture28,144/28,144,0 quote gaps/54 capability gaps; all79,991 prior rows reconcile with0 missing/changed cents/currency/provenance. Existing capture/staged66549/activation retained. Reports effective-local-priced-aspect-2026-09-30.json and priced-aspect-reconciliation-2026-09-30.json. Full integrated validation/review pending; execution continues. No production/external action.


## Continuous execution — factual media and extras, 2026-09-30

Base:5c0ad6d14. Task1/3/4/5: Ruling: normalize identities using consumed factual media quantities and generation addon flags; preserve priced reference counts, source/audio timing, token budgets, Seedance input tiers and Kling voices. Unknown synthetic facts retain previous behavior. Cost if wrong: a billed reference/audio surcharge could alias; current generation-zero/media/audio parity contracts and definition-override regression guard this.
Ruling: align raw catalog quoting with the existing generation mode projection before capturing a seed. Four previous captured amounts were not the generation price (Happy Horse v2v720p/1080p5s, Kling2.5 i2i5/10s); record those corrections openly, never mutate frozen fixtures or claim zero changes to the old report. Cost if wrong: a stale incorrect capture seeds retail; all28,144 prior identities were compared to actual generation-normalized quotes in a private repeatable-read transaction. No new generation cent delta observed.
RED→GREEN media zero/unused fields, billed tiers, counted generic references under rate overrides, audio flags, priced voice coverage and public forced-audio parity. Focused47/47 plus current coverage/media/admin19/19 and architecture/resolution/continuous72/72; TS, app lint/exposure/diff pass. Billing178/current public577 unchanged; pricing audit0mismatches. Current private capture18,127/18,127,0 quote gaps/44 capability gaps; all28,144 prior rows map,4 documented collector corrections,0 actual-generation mismatches/alias conflicts. Reports effective-local-priced-media-v2-2026-09-30.json and priced-media-reconciliation-v2-2026-09-30.json. Original staged data/state and older reports retained. Integrated full validation/review pending; continuation proceeds to timing coverage, not a complete-plan claim. No production/provider/payment/email/support/push/deploy.

#### 2026-09-30 — timing and priced effects continuation

- Factual duration/units replace unpriced requested timing in manual identities. Reviewed automatic and bounded source-timed modes close 27 redundant timing gaps; Ray SDR/HDR/EXR variants close three further gates. Remaining: 14 continuous/budget gates.
- Validated HDR/EXR extras are carried into final generation and direct checkout. Captured direct payments bind effect flags; old missing flags stay SDR. This corrects an existing final-billing omission, not a hidden tariff-cutover delta. SDR 130c is unchanged; 5s720p HDR/EXR bill 260/390c with the existing rule. Historical snapshots are untouched.
- RED→GREEN duration 3 and effect 3 tests; timing/media/aspect suite 18 passes; preflight/admin/wallet suite 42 passes; continuous/direct-payment PostgreSQL integration 9 passes. TypeScript/lint/exposure/diff checks pass. Immutable billing178/public577 and audit266 with zero unapproved mismatches pass.
- Private read-only timing capture:18,287 rows, zero quote gaps,14 capability gates. No staged data reseed or activation. Execution continues on continuous media classes.
# Wan mixed-reference continuation

Ruling: use the reviewed Wan source curve for `ref2v` as well as v2v/extend — its factual price adds the same source-second component, and zero source is a valid reference scenario. Cost if wrong: a reference quote could lose source charges; exact/public/admin/charging parity and domain boundary checks cover zero, decimal inputs and the 30-second floating boundary.
RED→GREEN reference curve and boundary regression; focused 20/20 then boundary/coverage 14/14. No seed activation or original private database mutation. Six Wan continuous capability gates still await the complete seed certificate. Continue with LTX audio-second tariffs.

## LTX audio continuation

Ruling: extend the existing continuous input confirmation protocol with an audio-second class, keeping its original Wan exports stable — shares revision/history/stale-preview semantics without duplicated mutation ownership. Cost if wrong: a source-timed quote might use selected output seconds; RED→GREEN decimal admin/public/charging identity, fractional public output metadata and comparison quantity regressions.
Ruling: retain current rounding through frozen absolute components, while a user-selected linear unit rate is a reviewed separate proposal; no automatic activation or percentage fallback.
Focused integrated57/57, final media40/40, compilation/domain7/7; disposable PostgreSQL active edits/public parity/stale confirmation/rollback3/3. LTX source field starts at2s and a decimal duration changes all consumers. PostgreSQL test setup first exceeded the local Unix socket path limit; shortened its disposable directory label. One hand-calculated expected half-cent was corrected to162c and then verified through stored rollback. UI observed the new source-audio editor; original database/revision/history unchanged. Capability seed gates remain14 until the complete certificate; continue with remaining quantity-priced owners.

## Omni owned-media continuation — 2026-09-30

Task 1/3 ruling: freeze bounded raw-token cent bands with literal authored terms and first-representable-double boundaries. Multiplying a newly combined unit rate can alter the former floating-point operation order at rounding transitions; point sampling would not prove zero deltas. Cost if wrong: discontinuous cent changes; boundary neighbors, supported media contexts and a whole-cost-interval guard are verified. Quote-time authored prices do not read live supplier rates or percentages.
Task 4/5 ruling: v2v source and inherited output share one owned timing; retake uses the previous owned interaction with zero submitted clip; only extend has independent output/source timing. This follows the provider pricing-context owner, rather than exposing unsupported combinations. Cost if wrong: a public estimate could describe an impossible generation; invalid combinations fail closed. LTX fractional timing is also admitted by the actual public HTTP parser.
Focused regression67/67, new kernel/media/UI/public8/8, disposable PostgreSQL1/1 (preserve→active update→public/billing→stale preview rejection→historical rollback), TypeScript, lint, exposure and diff checks pass. Private capture20,113/20,113 with zero quote gaps; 18,167 common identities retain all amounts/provenance. Removed120 impossible Omni rows; added56 owned Omni and1,890 preceding Wan ref2v rows. Original private staged66,549 cells/revision3/global-inactive unchanged. Eleven reviewed continuous modes still need the complete seed certificate; three unbounded modes remain gates. No production/provider/payment/storage/email/support/push/deploy actions.

## Reviewed seed and independent correction — 2026-09-30

Task 1/3 ruling: build a read-only candidate, share the admin's continuous compiler/whole-domain guard, bind the effective policy hash, preserve unknown/unreviewed gates, and require actual quote acceptance separately from copied fixed cents. Cost if wrong: a sampled or below-reference amount could be mistaken for activation evidence; `activationReady` is always false and guard failures are explicit. No seeding or activation occurs.
Independent review found P1 Wan decimal cent drift: source3.4999 at5s/480p ref2v was56→55, and5.0001 was65→66. RED reproduces38!=39 at another adjacent boundary. Ruling: capture every actual source-second cent band, preserving the original operation order; include the existing IEEE sum-validator endpoint. Price comparisons and linear proposals remain separate. Cost if wrong: no-change migration changes a cent; complete band transitions plus boundary probes and real PG preserve/edit/rollback are verified. LTX's existing compiler independently passed3,330,000 default-policy adjacent-boundary probes without a mismatch.
Pure/compiler/seed12/12 and disposable Wan/LTX/Omni PostgreSQL3/3 pass after correction. Private read-only candidate:20,113 recorded scenarios,14,691 cells,552 continuous classes, eleven model/mode domains reviewed.20,089 actual manual quotes accepted;24 GPT2.5 Flare/Sunburst i2i fixed prices are retained but blocked by the reference settlement guard. Three unbounded domains remain, plus this settlement/provenance decision and fresh production parity. Existing staged data/revision3/inactive flag unchanged. Full candidate validation and review follow-up still pending.

## Complete validator contract alignment — 2026-09-30

The committed bab6bb60b standard suite reported 6,405 pass,4 fail,3 skip; build and isolated Studio integrations did not run. Focused rerun reproduced all four failures (35 pass/4 fail). These were obsolete test assumptions: Seedream supplier dimensions must retain requested aspect independently of the unpriced tariff selector; Wan ref2v now accepts its verified decimal source; browser facts omit charging-only manual identity metadata. Tests now retain exact monetary/itemization equality, assert owned source metadata, accept the reviewed reference mode, and still reject source media in i2v. Focused rerun39/39 passes; no production calculator changed to accommodate assertions. Full fresh committed validation follows.

Whole-branch review follow-up found no new findings and independently checked108 Wan classes/29,880 boundary and neighbor quotes with zero deltas. Eleven focused follow-up tests passed. The original P1 is fixed; the reviewer retains24 settlement blockers,three unbounded modes and complete seed certificate as explicit open gates. No global activation or production action.

## Dynamic video Tools — continuous local execution

The4801c322f committed candidate passed6,409 standard tests/3 skips plus11 isolated Studio tests and optimized local build; sanitized environment was restored. After restart the admin rendered current48-model rows. This integrated evidence precedes the following Tools continuation.
Ruling: extend the existing product preview/confirm/history service with one allowlisted persisted coefficient; preserve missing overrides at the current ×4 upscale/×2 background defaults, reject malformed or out-of-range values1..1000, and keep provider estimates and operational metadata separate. Cost if wrong: a tool or preview could charge another price; real disposable PostgreSQL, source-rounding and client-reconfirmation tests cover the edit. Reference preview clips are illustrative; trusted actual source facts still determine each charge.
RED3/3: edits were ignored (80!=50,10!=15, no editable state change). GREEN focused25/25, architecture40/40, Tool quote consumers6/6, TypeScript, frontend lint, exposure and unchanged178-row baseline pass. The integration confirms effective factor persistence, supplier cost independence, stale preview rejection, rollback with current routing metadata retained, old client acceptance rejection, paid stored job snapshot unchanged and current-database failure. Only test databases were mutated. Fresh integrated validation and actual browser editor acceptance follow; original staged model cells/revision/global-inactive remain untouched.

## Integrated verification and actual HTTP correction — 2026-09-30

Committed168d6c679: full validator6,412 standard passes/3 skips plus11 isolated Studio passes; optimized local build succeeds with916 static pages. Sanitized environment restored. Independent continuation review initially found no actionable issue.
Actual browser uncovered coefficient input3 still previewing4→4. Root cause: both preview/confirm HTTP pickProposal allowlists omitted dynamicPriceMultiplier although draft and service carried it. Ruling: retain the existing explicit allowlists and add only that commercial field to both adapters; arbitrary metadata and client actor IDs remain excluded. Cost if wrong: UI confirmation could apply a different coefficient than selected; real POST regression checks preview and confirmation separately, and existing real PG integration verifies downstream persistence and stale/revision behavior.
RED: both POST adapters reproduce undefined!==3 (unauthorized test passes). GREEN: focused HTTP/service/real PostgreSQL/rounding/architecture42/42; TypeScript, frontend lint, exposure and diff checks pass. Independent follow-up finds no actionable issue;7 focused tests pass including HTTP and PG. Whole suite/build evidence precedes the two-field transport correction; focused verification covers the final correction.
Browser: Tools→Topaz video→Edit pricing, minimum80→60 and coefficient4→3. Indicative margin75.0→66.7%; server preview1/10s1080p80→60,30s240→180,60s480→360,10s2160p320→240. Cancelled, selected stored product again, inputs80/4 restored. Actual screenshots/tmp/maxvideoai-pricing-tools-editor.jpg and/tmp/maxvideoai-pricing-tools-preview.jpg; visible admin tab retained, Next detached localhost3106 listener persists.
Read-only original sandbox verification after acceptance: revision3/global-inactive,66,549 staged cells,13 products,0 dynamic coefficient overrides,Topaz minimum80. No original seed/product/history mutation, provider/payment/storage/email/support/push/merge/deployment. Manual-cutover gates remain three unbounded domains,24 reference settlement refusals, complete certificate and fresh production parity. Plan is not complete or globally activated; no further per-task permission needed for authorized local work.

## Compact review, temporal acceptance and approved reference floor — 2026-09-30

Base:58bcd0e35. The first versioned-only active override/rollback now checks real
historical quote resolution immediately before and at both effective instants:
26c versioned →31c database →26c database, with earlier periods preserved.
Focused admin/product/HTTP/temporal/architecture group64/64 passes.

Ruling: keep readable product/scenario names, current/proposed amounts and deltas
in the primary four-column confirmation table; retain stable IDs and provenance
in collapsed audit details and the fingerprint. Cost if wrong: users could
misunderstand which prices change; RED→GREEN actual dialog rendering and dynamic
server labels check readable rows and nonzero-delta count. Browser verified six
scenarios/two changed prices; cancelled minimum80→60 draft at coefficient4 and
reopened stored80/4. Screenshot/tmp/maxvideoai-pricing-compact-preview.jpg.

Human chose upward rounding over a subsidy exception for24 GPT2.5 reference
scenarios. Ruling: only an explicit capture/registry/rules/database-bound list of
old/new cents can raise these fixed cells by exactly1c to the current supplier
ceiling. Cost if wrong: blanket repricing could bypass parity; stale/duplicate/
unrelated/broader approvals reject, normal audit still preserves original cents
and settlement guard stays intact. RED2fail/4pass →GREEN8/8 with dialog tests.
Read-only full candidate accepts20113/20113,24 approved increases,20089 unchanged,
14691 cells/552 continuous classes, three open domains,activationReadyfalse.
Original private state revision3/global-inactive remains unchanged. Original
baseline and earlier reports retained; separate approved candidate report saved.

Existing FlashVSR provider2×/billing1080p normalization discrepancy discovered
and documented; no charge changed. Independent review flagged the new target
label for this factor-only engine: RED then corrected to source720p/2×/30fps,
with a warning about the existing billing basis in comparison/confirmation.
Real source costing and customer reference need aligned proposal/evidence before
release. Focused compiler/domain/seed/dialog21/21; final floor/label9/9 pass.
Independent review also passes11 focused tests including disposable PostgreSQL;
no other issue. Full integrated verification follows. No production/provider/
payment/storage/email/support/push/merge/deployment action.

## Factor pricing continuation and full preceding verification — 2026-09-30

Candidatea0f41e49b: fresh whole validator6421 standard passes/3 skips plus11
isolated Studio passes; optimized local build succeeds. Private environment
restored. Independent reviewer confirms floor/history and factor label; its
warning wording finding was corrected before that candidate.

Continue authorized local work: Ruling: current source pricing must normalize
supported mode/target/factor exactly as provider submission. Cost if wrong:
factor jobs can be billed against an unrelated target. RED actual/pure Flash
125≠222 and invalidfactor498≠222. Initial correction left SeedVR249≠443; traced
resolveUpscaleMode ignoring an explicit supportedfactor when defaulttarget.
Fix both normalizers, propagateinput.mode to actual pricing, use2x/4x audit
identities and include a4x admin reference. Obsolete mismatch warning removed.

Literal10s720p30fps coefficient4/min80: Flash2x supplier55.3c/customer222c,
Flash4x885c, SeedVR2x443c, unchangedSeedVR1080target249c/Topaz80c. Product
records were not edited; these are disclosed current source-estimation changes,
separate from the24 model-floor proposal. Actual paid125c snapshot preserved and
old125c acceptance rejected against222c. Focused pure/provider-input/realPG/
admin/minimum/architecture18/18 passes; TS/lint pass. Fresh final full validation
and independent review follow. Global model switch remains off; three unbounded
domains and complete seed/certificate remain open. No production/provider/
payment/storage/email/support/push/merge/deployment action.

Independent factor review: no actionable finding; normalizers, source cost and
provider payload align; stale acceptance rejects and paid snapshots retain stored
amounts. Reviewer11/11 focused tests including disposable PG. Actual browser
FlashVSR reference10s/720p30fps2x: supplier0.553/current2.22/margin75.1%.
Coefficient4→5 preview shows222→277c and4x885→1106c, six scenarios/five changed;
cancelled and reopened storedminimum18/coefficient4, no original write. Screenshot
/tmp/maxvideoai-pricing-factor-preview.jpg; admin tab retained. Exposure/diff pass.
Fresh full committed validation follows this factor correction.

## Final factor candidate verification — 2026-09-30

Code candidate e0283ab37: fresh standard validator 6,425 passes/0 fail/2 skip
(1,097 files), plus 11 isolated Studio passes/0 fail; total 6,436 passes. Optimized
local build succeeds with 916 static pages. TypeScript, frontend lint, exposure
and diff pass. Full logs:
/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-pricing-validation-NJ0Ypn.
Private sanitized environment restored; Next restarted detached on localhost3106.
Read-only original sandbox: revision3/activefalse/codeActivefalse; staged66,549,
products13, dynamic coefficient overrides0, Flashminimum18/Topazminimum80.
Browser cancelled coefficient4→5, reopened4, current10sFlash2x222c. No production,
provider, payment, storage, email, support, push, merge or deployment action.
Manual model cutover still needs three unbounded domains, complete reviewed
versioned seed/certificate and fresh effective production parity. No global
activation. This closes the compact confirmation, historical first override,
approved24-cent candidate preparation and actual factor pricing continuation.


## Main synchronization and rebased public price consumers — 2026-10-01

Fresh fetch/ls-remote main10589cc6b368bae3647ec9d00fba1b73c8b20128. Local main
was24 commits behind/0 ahead; no main checkout was active. Advanced only its ref
with compare-and-swap, preserving the original Desktop working files. Backup
codex/pricing-before-main-rebase-20260930 retains original branch1a15cca48.
Replayed78 local commits onto main; rebased HEAD5eeca3696, main/origin-main0/0,
branch/origin-main78/0. No push or production action. Next stopped during rebase.

Ruling: retain main's shared watch reader, gallery validation and new media layout;
port the approved current-price semantics into those owners — copying obsolete
watch markup would discard main's media and architecture fixes. Cost if wrong:
public prices could diverge or media behavior regress; source/DOM/route tests and
fresh full validation cover the integration. Main's localized family hero titles
remain; Fast/Mini positioning and1.5 retirement copy are retained.
Ruling: standardize quote-public dependencies to the wrapped pricingPolicy interface
and migrate main's new loader/test callers — inconsistent raw dependencies would
read the wrong effective policy. Use computeCurrentPublicSnapshot for a public
current estimate: unavailable policy removes the quote, without default/history
fallback. Comparison proposals remain executable, explicitly text-only and
no-reference, with their priced settings/adaptations shown beside the headline.
Ruling: current gallery prices are read in a route-local async data owner; the pure
builder only receives/formats a quote map — route stays below400 lines and no
server DB work migrates into client data helpers. Paid historical amounts stay
unchanged; unknown/archived prices remain unavailable. EN/FR/ES guidance follows
current estimates rather than promising historic render costs.

TDD evidence: reader/policy/gallery/commercial integration RED4fail/6pass;
paginated current-price projection RED1fail/3pass; family/route RED3fail/12pass;
headline priced-scenario basis RED1/1fail. Final focused consumer14/14 and related
architecture/editorial/watch/current-price64/64 pass. TypeScript passes; full
rebased validation/build will be recorded separately. Read-only original private
sandbox remains revision3/inactive,66549 staged cells,13 products,0 coefficient
overrides,Flash minimum18/Topaz minimum80; code manual switch remains false.
No provider/payment/storage/email/support/push/merge/deployment action. Three
unbounded domains, complete versioned seed/certificate and fresh production parity
still prevent global activation; the full plan is not complete.


Rebased review/fix pass: fresh independent reviewer inspected the whole local
candidate and rebase resolutions;26 sanitized focused tests pass. Two P2 findings
stand: legacy Luma catalog5s/9s were parsed with Number(), and global resolutions
could label an unsupported mode combination exact. RED2fail/7pass; fix uses the
existing suffix-aware numeric duration parser and resolvePublicModelScenario's
reviewed mode/coupled scenario contract. Reference candidates use the actual
mode's supported dimensions and remain labelled reference, never a successor.
No-reference t2v counts remain zero; unsupported scenarios are never quoted exact.
Focused current-price/public-model/display/actual reader/architecture25/25 GREEN.
Ruling: reuse the existing public scenario validator rather than duplicate mode
and coupled capability checks — cost if wrong: unsupported or cheaper scenarios
could masquerade as exact; explicit Kling2.5 t2v720p→1080p reference and both Luma
exact/reference regressions cover the findings. Publication remains unchanged.

First full rebased candidate8ab2c283f: standard6578pass/1fail/3skip. Failure is the
watch-page-signals architecture test's obsolete direct-watch formatter assertion,
which rebase kept while main moved watch presentation into the shared reader.
Ruling: migrate that contract to wrapper→sharedreader/currentquote/nohistoric and
visible price basis, preserving signal-module separation — no stale old markup
restored. This failure prevents claiming a passing whole-candidate gate; fresh
full validation/build follows the committed review fixes.


Final review fix-batch adjustment: the initial reuse of resolvePublicModelScenario
was correct but first-call initialization enumerated every sellable scenario and
added2.2 seconds synchronous CPU to a public single-example read. Reviewer
reproduced it without DB/network. Cold-process regression RED(~2.1sec CPU exceeds
500ms per-process budget). Ruling: check only the target mode's catalog dimensions
and reuse the workspace example recreation/form-coercion owner for coupled
constraints; never initialize audit-wide coverage on this display read. Cost if
wrong: incorrect capability matching or public latency; Luma/Kling regressions,
shared-handoff tests and real cold CPU gate cover it. Final focused32/32 GREEN,
TypeScript/frontend lint pass. Existing global mode/frame/audio constraints,
commercial quote owner and no-reference basis remain intact. Prior validator
choice recorded above is superseded by this bounded validator.


## Rebased candidate acceptance — 2026-10-01

Code5bd8d857b: fresh full standard suite6581pass/0fail/3skip across1129files,
plus11 isolated Studio integrations/0fail; total6592pass. Optimized local build
succeeds,920static pages. Logs:
/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-pricing-validation-A4WGJ0.
Sanitized private environment restored. Final independent fix review: no remaining
actionable finding;16 focused tests pass; isolated injected-quote first-call timing
falls2.206sec→1.14ms, not a claim about browser Core Web Vitals.

Next restarted detached localhost3106,parent21192,listener21195; log
/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-pricing-next-cqm_s1ms/next.log.
Old IAB tab1 failed CDP interaction; fresh visible admin tab2 displays all five
categories. Seedance Mini details show supplier0.0756/s/customer0.19/s,total0.95,
estimate margin60.2%; actual customer-rate input and preview are enabled. No draft
was applied. Real screenshot/tmp/maxvideoai-pricing-rebased-admin.jpg. Retained
fresh admin tab; temporary public smoke tab closed.

Browser public Pricing confirms Mini5s720p0.95. French Kling2.5 model page shows
5s1080p0.46 and10s1080p0.91, matching admin. Canonical, EN/FR/ES/x-default
alternates and JSON-LD scripts present on Pricing/model/family routes; French
model→gallery navigation lands at/fr/galerie/kling. Gallery is empty in the
private DB, so no browser first-Play claim is made. Actual reader DOM, batching,
media-loading boundaries and comparison/current-price behavior are covered by
focused/full tests. No media URLs, loading controllers or paid records changed.

Browser found six remaining localized promises of recorded-render costs outside
the earlier phrase regex. Copy-only final correction: Veo EN and Kling/H3 FR/ES
now describe current estimates for the settings shown. Strengthened existing
commercial copy contract RED; related localized/editorial/family/route29/29 GREEN.
This text correction follows the full code5bd gate; it changes no quote arithmetic
or route/media behavior. Original private state rechecked after browser: revision3
inactive,66549cells,13products,0coefficient overrides,Flashmin18/Topazmin80,
codeActivefalse. Fresh ls-remote remainsmain10589cc6b; localmain/origin-main0/0.
No push, merge, deployment, production write, provider job, payment, external
storage write, email or support communication. The three unbounded model domains,
complete versioned seed/certificate and fresh production parity remain open;
manual activation and full-plan completion are not claimed.

## Reproducible local release preparation — 2026-10-01

Base4a7bdc17e. Continue authorized local work after the completed main rebase.
Inspected actual Ray2 Modify integer-second factual pricing and H3 Max's included
4096/excess-token owner. Their domains remain open; no invented cap, universal
linear substitution, disguised live percentage or coverage completion claim.

Task1/6: Ruling: prepare a fingerprinted **inactive local** versioned candidate
and report before a complete activation certificate — binds exact full amounts,
baseline, scenarios/contexts, code, registry, policy, factual environment and
original tariff state/revision; current integrity/coverage/settlement failures
reject readiness. Cost if wrong: local evidence could be mistaken for production
parity or activation authorization; report hardcodes activationReady=false and
the helper is explicitly not an activation API.

Task1/6: Ruling: carry the already approved24 exact +1cent floor amounts across
the registry rebase/fresh capture only if the same database, policy hash and
original cents still match, then revalidate exact IDs/model/mode/current supplier
ceilings in the existing reviewed seed owner. Cost if wrong: an unrelated price
could inherit approval; stale policy/database/amounts reject, no change IDs or
amounts are recalculated, original approval remains immutable in its manifest.

RED missing evidence/input owners → GREEN6 new tests; integrated seed/compiler
focused24/24. Command is sandbox-file-only, verifies actual Unix socket and
repeatable-read/read-only transaction, requires clean committed code, refuses
overwrite and leaves original staged data/history/global switch unchanged.
Fresh full private matrix preparation and final types/lint checks follow commit.
Task1 and6 remain partial; no support/provider/payment/storage/push/deployment.

Committed5418f7d30. Fresh actual command produces20113/20113 accepted quotes,
20089 unchanged/24 approved +1cent floors,14691 inactive versioned cells,
552 reviewed bounded classes. Actual artifact integrity check passes and local
readiness rejects exactly the three unbounded domains. Capture at
2026-09-30T23:06:40.278Z (Oct1 local); fingerprint
5e07f3bb2849264a80497619fc4ece4a05524440dccbf6ee99127d7f005954f0.
Artifacts/tmp/maxvideoai-pricing-release-20261001-5418f7d. Original sourceDB
read-only before/after:revision3/inactive,66549 cells,13 products,0 coefficient
overrides,Topaz80/Flash18 minima; no writes/history changes. Main/origin/main/
fresh ls-remote10589cc6b aligned. TS, app/new-owner lint/exposure/diff pass.
New code is operational preparation only, no full-suite/build rerun claim.
Browser reads existing actual admin with supplier/customer per-second rates and
margin/simulator; tab2 marked deliverable, no edits/confirmation or new auth.
Following documentation commit requires a fresh candidate to bind final HEAD;
no complete-plan/final-review/activation claim, workspace remains for continuation.

2026-10-01 finishing follow-up: current user asks missing Restore/Denoise/Fix Blur/
Smooth Motion prices and Wan 3/H3 Max provider/disabled labels. Four RED regression
failures reproduced missing finishing scenarios, H3's wrong provider and absent
local isolation reason; PostgreSQL RED reproduced shared unscoped tool editor.
Restored existing migration42 only to verified private Unix sandbox; state3/off,
66549 cells/13 products unchanged. Future sandbox startup includes42, preserves
configured rule. Seven tool/quality scoped editors, budget/factual parity and
representative priced extras/block boundaries implemented; global fallback refused
in billing and preview. H3 Max provenance is Fal catalogue; Wan retains Alibaba
cross-provider basis. Local isolation reason explicitly projected to UI.
Focused69/69 and real PostgreSQL preview/stale/confirm/rollback pass. Browser actual
seven prices and scoped30-scenario +5c preview verified, preview cancelled. Older
release artifact now has stale effective policy hash; recapture/binding gates stay
strict. Full validation/build and final commit follow; plan/global gates unchanged.

Code8019c89da committed. Fresh complete gate passes6592 standard/11 Studio,
zero failures/three standard skips, optimized920-page build. Logs privately at
/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-pricing-validation-xotdtN.
Sanitizedenv restored, Next restarted by pid49971 (listener child may differ),
log/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-finishing-admin-3LuoqR/next.log.
Original sourceDB state audit unchanged3/off/66549/13/0 coefficient overrides,
Topaz80/Flash18. UI tab5 actual Tools prices and cancelled scoped preview verified;
prior tab2 became stale. Admin reloaded after gate; no generation/payment/provider
or production action. Three unbounded model domains and fresh release recapture
after local finishing rule remain open; this is not full-plan completion.

2026-10-01 Wan routing correction: user confirms Wan3/Prime must use Alibaba,
MiniMax Fal. Credential isolation cleared Alibaba's master/public switches and
the real router therefore selected its default Fal route on compatible modes.
Sandbox now authors/persists Alibaba master/public=true, admin-only/fallback=false;
credentials remain blank and result providers mock. Production router untouched.
RED actual Wan t2v Fal vs Alibaba -> GREEN50 focused sandbox/comparison/Alibaba
provider/architecture tests. All five Wan/Prime modes cover admin/public selection;
actual comparison rows for both Wan and all three MiniMax models retain matching
supplier provenance and local-disabled generation, with unknown account costs.
Updated four flags only in existing guarded private .env.local; database unchanged
3/off/66549/13/0 coefficient overrides, Topaz80/Flash18. Restart pid56782,
log/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-finishing-admin-JUdkWN/next.log.
Actual tab5 shows Alibaba filter with Wan3/Prime rows; marked deliverable,
screenshot/tmp/maxvideoai-wan-alibaba-routing-20261001.png. No tariff confirmation,
provider submission, support message, production action, push or deployment.
Fresh TypeScript, app/script lint, public exposure and diff checks pass. The first
TypeScript attempt overlapped Next type regeneration during restart; the subsequent
complete typecheck passes after runtime compilation settles. Full-suite/build
evidence remains the preceding8019 gate; this correction uses the focused50 gate.

2026-10-01 effective-price propagation audit: user requests one customer price
across live generators/MCP/Studio, Pricing, model/catalogue cards, model specs,
comparisons/specs, examples and homepage. RED tests expose authored-price priority
in model specs, catalogue-margin comparison fallback without a pricing engine,
missing comparison/category/localized cache invalidation, and whole-cent unit
rounding (26c/5s displayed0.05/s instead of0.052/s). Current labels are now strict,
normalized rates preserve the total/quantity, and actual localized route patterns
are refreshed alongside translated URLs. Shared format-only helper remains pure.

Fresh consolidated126/126 pass with no skips/failures; disposable Unix-socket PG
admin preview/confirmation26->31 propagates to billing/public/model/cards/specs/
comparisons/examples/Pricing and price-sensitive revisions. The later fixture
extension additionally exercises actual live preflight and MCP pricing, then
passes again. Wan homepage+5c updates only the affected guided-demo step; immutable
original paid999c retained. Fixture-only activation; source sandbox state remains
3/off/66549cells/13products/0coefficientoverrides, Topaz80/Flash18/codeActivefalse.
Frozen178-row billing and577-row public baselines pass;266 billing scenarios have
zero mismatches/four reviewed changes. Ten local EN/FR/ES routes return200 with
canonical/hreflang/JSON-LD; HTTP quote and visible English unit amounts match.
TS/app lint/exposure/diff gates pass. Logs/tmp/mva-current-price-{final,live-mcp,
smoke,doc-contracts}-20261001.log. No broad-suite/build rerun claim for this patch.

Global manual activation is still off: three unbounded model domains, complete
fresh seed, release binding and production parity remain open. No provider job,
payment, production mutation, support message, push or deployment. Admin HTML is
an editor of persisted inputs; canonical effective quotes remain the price owner.

2026-10-01 authorized local completion continuation (base0d35201e7).
Ruling: open Luma Modify and H3 Max reference cells capture literal customer unit
components with frozen native quantity normalization, rather than imposing a
generation limit or extrapolating sampled fixed prices. Cost if wrong: rounding
could drift at an unseen quantity; native operation order, large safe-integer
regressions and structural whole-domain guards must pass before cutover.
Ruling: local activation reproduces the complete effective baseline/candidate
under tariff revision and policy/cell locks. The entire previous staged grid is
archived immutably in the activation transaction. Cost if wrong: a local review
grid becomes stale; hash/revision/registry/code/environment checks reject it.
Ruling: use one interval advisory lock for atomic bulk seed writes; the existing
per-selector lock exhausts default PostgreSQL shared lock memory at full scale.
Cost if wrong: independent retail edits serialize; the singleton revision already
serializes these writes. No reduced interval/overlap protection.
Task1/2/3/4/6 remaining local implementation: RED open quantity cases, unseen admin/
public selections, old percentage retirement, absent cutover owner; GREEN native
curves/edit guards/selectors, locked local owner and historical rule controls.
Full disposable PostgreSQL matrix20113 passes after migration58: initial capture
plus24 explicitly approved floors, no coverage gaps, every persisted candidate
quotes with manual_tariff, stale confirmations/state/candidate rejection, atomic
event and immutable activation history. Local source sandbox remains inactive
until fresh committed release preparation and review. Production release gate
remains distinct; no provider/support/payment/storage/push/deployment.

Final fresh whole-branch review10589cc6b..fbbe4cd28: no verified Critical or
Important blocker. Reviewer classified H3 reference-token billedQuantity as Minor.
Ruling: treat the false billed-token count as an audit correctness fix for the
requested pricing decision tool: native normalized arithmetic includes the output
base and must not be presented as reference tokens billed. Customer totals remain
unchanged; normalizedQuantity is separate and billedQuantity subtracts the4096
included tokens. RED4096tokens→20000 billed instead of0; GREEN31/31 open-quantity
and model-page tests. No deferred minor from this review remains.
Full suite6604pass/2fail/3skip exposed two older display assertions expecting
two-decimal per-second approximations. Ruling: preserve canonical current amounts
and update those expectations to exact current quoted rates, rather than restore
stale public approximations. Fresh complete validation/build follows the commit.
Review declined production parity/activation/migration behavior, actual supplier
contracts/invoices/availability/profitability, external operations, persistent
sandbox activation, independent full-suite/build/matrix/concurrency reruns,
browser/accessibility/performance, exhaustive safe-integer enumeration, and a
fresh exhaustive audit of all older subsystems. Parent owns the local gates;
production evidence and external actions remain outside this authorization.
Private sandbox backup created before migrations57/58; actual Unix connection,
inactive revision3 unchanged. Local activation and final acceptance remain pending.

Committed9eecd4d58 passes full6606 standard/11 isolated Studio tests,0fail and3
standard skips, plus optimized local build920 pages. Real command-format test then
exposed a cutover certificate mismatch: preparation included capture provenance
while locked reproduction omitted it. Ruling: one shared local baseline serializer
owns those exact fields in both paths; retain full fingerprint validation instead
of ignoring provenance. RED actual CLI-format certificate rejected under locks;
GREEN real full20113-scenario PostgreSQL cutover, stale rejection/archival/manual
parity/immutable history. TypeScript and app lint pass. This fixes an operational
blocker without changing customer amounts. Final committed whole-candidate gate
and actual persistent sandbox cutover follow.
Ruling: rebind the existing24 approved +1cent floors after the unrelated private
finishing-tool policy restoration only through a one-off record that verifies all
20113 original model IDs/cents/currencies, original database/registry/factual/staged
state identities and the exact24 unchanged supplier ceilings. The generic approval
refresh helper stays strict; its policy-hash check is not weakened. Cost if wrong:
an unrelated change could inherit approval; any mismatch stops the operation.
Old certificate/approval stay immutable, new record retains their hashes and reason.

Actual private preparation24ad70c3f:14658 cells/591 continuous classes,20113
accepted quotes,20089 unchanged/24 approved exact +1c floors,0 remaining gaps.
Certificate e951591b0e36467b845fb59c22d320d2440ff371987bd44b4157a2a84c2b44d3;
locked activation2026-10-01T01:48:18.424Z,revision3→4,event
ea47034b-b958-4119-ba7c-4484adb256db,archives66549 old staged cells. Actual
post-activation read-only audit20113/20113 expected cents/manual_tariff, no legacy
model fallback. Products13/coefficients0/Topaz80/Flash18 unchanged/codeActivefalse.
Fresh complete24ad70c3f validator6606 standard+11 Studio pass,0fail/3standard
skips,optimized920-page build succeeds. Privateenv restored, localhost3106 started.
HTTP unauthorized401; approved local session inventory200:48models/15families,
active4,coverageGapCount0,no missing representative customer/supplier amounts.
Policy inventory modelTariffsActivetrue; actual UI percentage rules historical/
read-only. Ten EN/FR/ES pages200 with canonical/hreflang/JSON-LD, currentPika0.052/s
andcomparisonSeedanceunit amounts. Actual Mini preview95→100 then cancelled/reset.
Actual H3ref2v editor4096→20000tokens quotes94c, output0.104USD/s and0.026USD/1ktokens;
390×844mobile has equal document/client widths378px and readable unit editor.

Ruling: the public HTTP parser must share the already reviewed open quantity
classification; its prior generic120s/10000token transport limits reject valid
Luma Modify/H3 reference quotes even though the canonical owner accepts them.
Scope the exception to those model/modes and safe nonnegative integer units; keep
all other transport/coupled validation. Cost if wrong: browser and admin disagree
or malformed amounts reach quoting. HTTP RED400vs200; focused13/13 GREEN including
negative/fractional/unsafe/wrong-model rejection. Actual public HTTP quotesLuma131s
2044c,H3budget20000=94c,approvedFlaremedium1ref=3c, all no-store and exact. TS/app
lint pass. Final optimized build of this small transport correction follows;
full24ad core acceptance above is not relabeled as a full rerun of this patch.

Final transport codeb5a2e4de2 optimized build passes920pages plus prebuild/type/lint
gates. Log/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-pricing-final-build-dOJ1Oo.
Sanitizedenv restored; private Next restarted localhost3106 by75162,
log/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-finishing-admin-pMJpNg/next.log.
Actual admin tab5 reloaded, Mini0.19USD/s/95c live editor enabled, retained visible
with default viewport; desktop/mobile real screenshots saved outside repository.
Final source read-only state4/active/14658cells/13products/0coefficients/Topaz80/
Flash18/codeActivefalse. Freshremote main10589cc6b matches localmain/originmain.
Local implementation/review acceptance complete, production plan gates pending.
No deferred minor from the final review; earlier admin whole-grid performance
acceptance remains deferred. The final completion report links every earlier
ruling, review limitation and remaining release gate. Keep the existing worktree/
ledger for the production continuation; no push/merge/deploy/external action.

2026-10-02 proportional Seedance input pricing accepted locally. User approved
preserving each positive variant gross margin as supplier input consumption rises.
Literal unit components store one billable-second rate, the published minimum,
included input threshold and final upward cent rounding. Quotes use trusted actual
source duration; unresolved references do not establish a numeric current tariff.
Negative minima use the matching positive no-video margin, or matching t2v output
options for v2v/extend lacking a no-video counterpart. Cost if wrong: an unpriced
source can exhaust a formerly profitable margin; all-domain guards and explicit
initialization scope are required. No blanket percentage rule is restored.

Local append d41f7269f/27282c8db preserved all prior cells/history and wrote3186
continuous classes, correcting273 minima. Private sandbox328→3514,18168cells.
Actual read-only audit20437 accepted normal/workflow quotes,0errors/legacy/negative
margins,6372 source stress cases accepted/0belowcost. Unaffected17251 quotes and38
product records unchanged. Private prewriteSQL backup and fingerprinted apply
receipts retained. These counts certify local estimates, not actual invoices/prod.

Environment-free optimized d41f7269f build succeeds920pages. Fullstandard6715pass,
1fail,3skip exposed old all-model initialization dispatching Seedance as Wan.
9d42fd2cf fixes this with the approved margin policy bound to the report/fingerprint,
reproduced under locks; alternate Fal route keeps its own captured facts/amounts.
Shared factual-env allowlist binds route/region/modes and Luma rates without secrets.
Full-matrix atomic PostgreSQL regression now passes;14 focused release tests pass.
Earlier74 admin/provider/media/MCP parity tests pass; currentTS/app/exposure lint
anddiffcheckpass. No full-suite rerun is claimed after the initialization patch.

Actual browser Standard4s480p16:9ref2v shows source2s→68c/55.5% and15s→185c/55.6%,
minimum7billable seconds and customer0.09714285714285714USD/billable second editor.
Existing approved localadmin session refreshed unchangedscope. Real screenshot
/tmp/maxvideoai-seedance-proportional-pricing.jpg; existingadmin tab retained.
Datedtrackedreport docs/engineering/2026-10-02-seedance-proportional-pricing.md
records verification scope and pending contract/production capture/CI/release gates.
No paidprovider test, support/email, prodwrite, push, merge or deploy this correction.

2026-10-02 final local preproduction acceptance. Fresh whole-branch review
main d10ad4587..dd5a133e6 found no confirmed Critical and two Important findings.
Seedream Pro source counts now cross actual image billing, estimates, MCP and
supplier comparison consistently; nine additional variants preserve 16c retail.
RED coverage 1!=10 and PostgreSQL billing/admin regressions pass. Private locked
append revision3514->3523,18177 cells,20446 scenarios across48 models,0quote gaps/
legacy fallbacks/negative estimated margins.6372source stress cases all guarded;
38products with0warnings/missing customer or supplier-reference/negative margins.
These are contract/LIST estimates, not invoices or a production certificate.

Read-only live Stripe inventory855intents,0legacy kind=run intents/unreconciled
captured/open old checkouts at2026-10-01T23:02:58Z. Keep old unbound payments
fail-closed and repeat immediately before publication; no financial write.
Fresh Git/domain mainalignment d10ad4587, same READY deployment bothdomains.
BytePlus CT20260925128931 still In contract generation, accountdiscount list empty;
user-adopted signed cost estimates retained, actualactivation not certified.
Read-only remote schema inventory confirms new53-59pricing/Draft tables absent,
trial/poll prerequisites present; explicit migration review/order documented,
including distinct53_playlist_opening vs53_seedance_draft_links and transactional60.
No DDL/schema bootstrap or environment/storage write to that remote database.

Environment-free5e8710078 validation PostgreSQL17:6721standard pass,0fail,3skip;
all11isolatedStudio tests pass. Optimizedbuild passes920pages. First wrongPATH
PG14run failed13version qualification tests and is explicitly not the green gate.
Authenticated browser uses isolated signed loopback Auth and disposablePG/media;
no actual Supabase permission change, no terms acceptance, no paid provider call.
Actual adminSeedream10sources showsLIST$.117/cost$.1053/customer$.16/margin34.2%.

Browser caught preflight's media-free shortcut discarding trusted workflow step:
final got an ordinary tariff without workflowStep and was refused by the UI.
35dda2840 forwards the server-resolved step. Real PG HTTP regression RED undefined
vsdraft -> GREEN distinct77/777workflow vs9999ordinary, inactive/unowned rejection,
zero charges.32focused tests,TS/lint/diffpass; optimizedfinalbuild920pages passes.
No full6721suite rerun is claimed after this small transport fix. Browserfinal
confirmation now shows historical52c Draft +current$5.21final =$5.73; cancelkeeps
Draft ready,finalnone,wallet$100,onlyonefixturetopup/nocharge. Real checkboxlocks
480p/1output,retains16:9,compactDraftbutton. Studio authenticatedchooser opens.
S3is intentionally unconfigured: Media save/live owned storage and StudioDraft
import not certified by the local fixture. Real providerpair previously passed;
new app-owned live canary, currentprodparity/activationmanifest/CI/deploy remain
bounded release gates. Ordinary localhostGoogleOAuth remains separate.
Testaccount signedout through actual appmenu (publichomepage/Login visible),
owned runtime/PG stopped, useradmin/session/database/worktree retained.
Dated report docs/engineering/2026-10-02-pricing-preproduction.md owns latest
counts and limitations. No prodwrite, push, merge, deploy, email/support action.

2026-10-02 user correction: BytePlus contract activation must not delay release
when customer amounts are unchanged and remain viable without the discount.
Read-only recheck of private audit 2026-10-01T23:13:42.379Z, revision3523:
discounted Mini/Fast and Seedream Lite/Pro cover1829 normal/workflow cases plus
1728 source-duration stress cases =3557 examined,0below undiscounted LIST,
minimum estimated gross margin24.4% before payment/operating fees. These are
local examined cases, not distinct selectors or observed invoices/prod evidence.
Customer cells do not recompute from contract rates. Supplier estimate still
feeds internal snapshots/vendor share/below-cost guards; not just admin display.
Mini5s720p16:9/no input stays95c,LIST37.8c/gross60.2%,contract15.12c/gross84.1%.
Latest acceptance and pricing guide now make activation non-blocking for this
unchanged LIST-validated grid, retaining signed cost estimates, visible LIST and
post-activation effective-discount/invoice reconciliation. Future retail cuts
that rely on the discount require effective-cost verification. No temporary
activation code, customer tariff edit or new paid provider call. Other production
capture/parity/migration/activation/operational gates remain. Documentation-only
correction; no external message, production write, push, merge or deployment.

2026-10-02 authorized local continuation, base e1a2b95e5.
Ruling: prepare a reproducible read-only schema inventory and exact migration
rehearsal now; keep the production activation operation at the separate release
decision specified by Task6 — a local certificate does not bind live prices or
grant remote writes. Cost if wrong: release needs a fresh target-specific review
before commercial activation, rather than an unsafe copy of the sandbox command.
Added pricing:cutover:schema with explicit private env/output, direct Neon/Unix
socket validation, default read-only connection and repeatable-read inventory.
Reports hash code/database/catalog/exact8SQL files without exporting credentials
or customer rows. Always activationReady=false/schemaReviewRequired=true.
Unit RED missing owner -> GREEN exact filenames/digests/connection rejection.
PG17 real psql exact53-60 then replay preserves historical jobs/receipts/trial
snapshots; state inactive/revision0/0cells, no inventory writes, no automatic
release approval. Full migration31 prerequisites initialized explicitly in
fixture, current/historical raster function both accepted, invalid cost rejected.
Updated stale contract-only release blockers in the rate reconciliation guide.
Runbook docs/deployment/customer-tariff-cutover.md records exact capture, migration,
activation review, live acceptance and immutable compensating rollback boundaries.

Final fresh review e1a2b95e5..9770a3867: no Critical, three Important issues in
the new inventory (duplicate TLS parameters; ambient PGPORT/PGPASSWORD and
incomplete endpoint hash; uncaught backend disconnect). One fix pass rejects all
duplicate URL keys, pins effective host/socket/port/user/database/TLS/password,
clears ambient PG overrides in the subprocess and aborts lost-connection evidence
through owned client/pool error handling and cleanup. RED duplicateSSL accepted,
missing explicit-target/controlled-client owners -> GREEN actual pg parameter
probes and terminated PG17 backend, no returned report or remaining backend.
Fresh read-only remote inventory at2026-10-02T00:37:46.807Z additionally found
the expected older31 inline funding guard (raster predicate absent). Dedicated
RED incorrectly missing required function -> GREEN marks created_by_migration_60;
real fixture now preserves all other funding checks and historic rows across
creation/replacement/replay. Migration60 explicitly accepts this old state.
No remote DDL or tariff write. The first private report remains immutable and
binds9770; recheck the corrected committed inventory before claiming its evidence.

Corrected committed inventory `951e11353` rechecked at
`2026-10-02T00:51:08.328Z`: remote/readOnly=true, mandatory missing
tables/functions=[], trialRasterPredicate=created_by_migration_60, expected six
new tables absent, activationReady=false. Schema hash:
`1f9d03e1009e33b1eafdc06951276b39d2452acf40ec2687f0ab6cd5e1a54d0a`.
Private immutable report: `/tmp/mva-pricing-cutover-schema-corrected-20261002.json`.
14 focused tests pass, 0 fail, 0 skip; frontend TypeScript/lint/exposure pass.
Environment-free optimized `951e11353` build passes 920 static pages with the
existing Supabase Edge warning. The first full-suite git-archive run has
6,725 pass, 2 fail, 3 skip: archival asset ancestor proof and IndexNow git ls-files
require Git metadata absent in an archive. This run is not accepted as a green
full-suite gate. Both files pass all 20 tests in a clean disposable local Git
clone of `951e11353` with no private env. The complete standard suite rerun there
passes 6,727 tests, 0 failures, 3 skips; all 11 isolated Studio HTTP/browser
integration tests pass, 0 failures/skips. `pnpm test:validate` exits zero.
Log: `/tmp/mva-pricing-cutover-951e11353-validation-git.log`. This whole-candidate
qualification includes `35dda2840`'s workflow preflight fix; later docs commits
do not relabel the source snapshot. Main and origin/main are aligned at
`d10ad4587`, contained in `951e11353`; no rebase needed against that revision.
Owned archive build/test directories and temporary direct reader env removed;
source private env/admin/database remain intact. No production write, push or
deployment.

Local qualification and migration preparation complete. Keep the reviewed
production operation at the separate release decision in Task 6: obtain current
deployed commercial capture/parity, review the target-specific activation path,
pass Quality CI and perform authorized app-owned storage/Studio Draft import
acceptance. A local certificate cannot bind production. No new paid provider calls,
external message, remote write or publication was authorized/performed here.

## Resumed deployed commercial comparison — 2026-10-02

Base464906cd1. User reports BytePlus contract validated; adopt that reported
status, retain existing signed estimates and customer cells. No new invoice
observation, provider task, support/Zen message or production mutation.
Ruling: reproduce monetary quotes from exact deployed d10ad4587 source with actual
read-only commercial rows, rather than candidate simulated legacy/defaults.
Cost if wrong: mismatched deployment/configuration could hide a price change;
bind deployment/source/database/environment facts and preserve captured inputs.
Fresh fetch confirms main=origin/main=d10ad4587, zero divergence, included in
candidate. Both production domains remain dpl_B1xi8TtrQ1viCBJ3XbEjWG6HCS4y.
Production repeatable-read/read-only capture at2026-10-02T08:16:27.244Z:
4rules,53settings,9overrides,16billingproducts; no bootstrap or customer/payment
reads. Direct controlled reader uses target8c5b3a3228a5e3db8a4785b5da1590b2126d24b336a57bd190f5fffe95e231ad.
Commercial hashd56aba99bc939aa1a14683b68ee03c13cec25c344342619b6c761c724d98d8d5;
producthash35f5e91b10dc8ee781c30100495d19923b7d6210cade3687cfbbacdd8bcb07cf.
Final read-only capture at08:33:57.278Z finds both unchanged. Interrupted earlier
capture retained: only system-settings updated_at changed, no monetary data.

Offline clean deployed-source clone uses its own pricing package alias, actual
row mapper/system-default/configured projection/variant/canonical quote owners.
No database/provider credentials or network in calculation. Six Luma monetary
ENV dependencies absent in actual deployed environment; versioned defaults and
registry/policy/config file hashes bound. Luma intrinsic algorithms legitimately
have no pricingDetails: first diagnostic reports158 gaps; complete owner-based
reproduction resolves them without invented pricing details or provider fetch.
20122ordinary model cases:19825unchanged,24approvedGPT+1c,273approvedSeedance2.5
input minima;0errors/unexplained.324new local-only Draft/final offers separately
excluded from deployed-price parity.6372input stress cases:2913unchanged and
3459reviewed proportional increases;0errors/unrelated differences, overlaps
ordinary cases. This is exact-source monetary reconstruction, not HTTP/provider
route availability or a writable production activation certificate.

Product comparison found3sandbox default differences: QwenAngle7vs8c,
CharacterDraft8vs15c,CharacterFinal15vs30c. Fourth difference is the preceding
reviewed FlashVSR factor/source correction125→222c (10s720p30fps2x), coefficient4;
retain it and disclose other affected factor variants from that reviewed work.
Ruling: align private demonstration records to actual deployed fixed products;
preserve the reviewed factor fix and current production records at cutover.
Cost if wrong: sandbox seed amounts might silently replace live operator prices.
Private before-state retained; actual configured local admin, pinned Unix socket,
verified socket-only server/database and branded transaction. Existing product
preview/fingerprint/confirm service commits all3updates+immutable events atomically.
Initial guard correctly refused an assumed database name; actual sandbox database
is postgres, now checked against the explicit selected URL (network guard retained).
Other products and complete model state/hash remain unchanged at3523/18177cells.
Fresh actual shared product quote inventory38/38,0warnings/missingreferences.
Final deployed comparison38products:37unchanged,1disclosedFlashfix;0unexplained.
16focused confirmation/factor tests pass,0fail/skip. No application code changes;
prior whole-candidate qualification remains attributed to951e11353.

Private bundle/tmp/mva-pricing-production-capture.kpam77r5 contains immutable
captures, contexts, comparison implementation/report, monetary bindings, local
alignment receipt/current products and verification. ManifestSHA256:
58b76ef7164ab9f6740ce16f102b039816506da97a796d9370a21666350dc029.
activationReady=false,productionWriteAuthorized=false. Dated record:
docs/engineering/2026-10-02-pricing-deployed-comparison.md.
Publication-time recapture/legacy-payment/Git/schema/config freshness, reviewed
target-specific activation operation+exact migrations, Quality CI/preview and
user production decision remain release boundaries. App-owned storage/Studio
Draft import needs its separate authorized operational canary; Draft remains
local-only. No new review of the already qualified application implementation.
Owned temporary reader credentials/full environment responses and clean deployed
source clone removed after evidence binding; immutable captures/reports/scripts
retained privately. User admin/runtime/private database and source env retained.
Evidence artifact hashes, document bindings/links, inactive authored production
switch and git diff --check verified. No application implementation changed.


## Offline exact-grid package and disposable recovery — 2026-10-02

Base 9b9b6c30188dfa786b5269b5f17371244858eb48. Continue the approved Task 6
preparation locally. No application implementation or code activation change.
Pinned repeatable-read/read-only sandbox export retains revision 3523 and full
qualified model-state hash; 18177 current cells, zero closed versions. Literal
projection and separate local backup do not import local actor/history/revision
as production history. Package includes captured production products, comparison,
20446 scenario export, 6372 input-stress contexts and exact eight migration bytes.

Private durable copy: .superpowers/sdd/2026-09-29-all-model-manual-customer-tariffs/
cutover-package-20261002-9b9b6c301/. Directory 0700/files 0600, excluded from Git,
no database/provider credentials. Package manifest hash
cf3c8277518b096ed560a3393930a30258bfdaa60e7df136b739c9b9f94b39a0.
Completed evidence hash
f24fd8b5cec39b5293d737a0cb2dac076e3745587d6e135f69228383bf7c7006.
Both activationReady=false and productionWriteAuthorized=false.

Accepted private harness run 2026-10-02T09:23:18.883Z on fresh PostgreSQL 17.6,
Unix socket/no TCP, fetch prohibited. Exact migrations applied/replayed twice;
all 18177 cells bulk-loaded in one fixture transaction. Deliberate failure after
cells/state/events fully rolls back to inactive revision 0, zero cells/events.
20446 actual canonical quotes including 324 separately labeled local workflow
offers plus 6372 stress inputs match previously accepted candidate cents; zero
missing/nonmanual/discrepant quotes. Counts overlap and are not unique selectors.
Actual existing admin Pika edit 26 -> 31c revision 2 then event rollback 26c
revision 3, stale review refused; two immutable closed versions preserved.
Full-grid state deactivation is explicitly a fixture simulation, appending a
compensating event at revision 4 while retaining cells/versions. It does not
implement or certify a production activation/rollback writer under target locks.
Synthetic historical paid job/receipt/two trial snapshots unchanged byte for byte.
Captured production billing-product values preserved in fixture. Original user's
sandbox independently re-read afterward: complete model/product hashes unchanged,
revision 3523/18177 cells. Owned rehearsal DB/socket removed in finally.
Initial fixture diagnostics: unsupported one-hour MCP lifetime and incompatible
scenario-hash formats rejected, corrected to existing ten-minute lifetime and
exact export serialization; logs retained alongside accepted run. These were
harness setup errors, not application fixes. Older deployed migration-31 shape
compatibility stays attributed to its preceding dedicated qualification.

Record: docs/engineering/2026-10-02-pricing-cutover-rehearsal.md, linked from
acceptance and cutover runbook. Source attribution stays 9b9b6c301 for this data
rehearsal; subsequent documentation commits do not relabel its source. Fresh
independent review of this new private package/documentation requested once.
Production-specific activation operation, publication-time capture freshness,
Quality CI/preview, separately authorized real storage/Studio Draft canary and
user's production decision remain release boundaries. No production/network
writer, provider task, support message, push, PR, merge or deployment performed.


### Fresh offline-package review and one correction pass

Fresh reviewer: no Critical, one Important, two Minor. Important: private harness
preselected one tariff cell before canonical pricing, so first report establishes
per-cell arithmetic, not installed-grid reader parity. Fix verified RED: required
actual reader count 26818, observed 0; GREEN: use default canonical quote loader,
no tariff-state override, 26818 actual DB selector reads, all cents/manual modes
match. Corrected accepted run2026-10-02T09:50:33.309Z from clean source9b9b6c301.
No application implementation changes or second review.

Final: Ruling: acceptance-claim accuracy and unconditional failure cleanup make
the intermediate/stale-preview and startup-cleanup findings Important for this
new evidence package — address in the same pass — cost if wrong: bounded extra
fixture verification, no product behavior or production change.
Actual canonical intermediate31c, formerly valid original preview rejected after
revision2, canonical rollback26c verified. Cleanup probe RED reproduced one owned
post-creation server leak and its runner removed only that owned path; GREEN
removes the fixture before returning from deliberately injected early failure.
Complete corrected harness passes 20446matrix/6372stress, full atomic-load failure,
actual admin recovery, synthetic histories/product values and owned DB cleanup.
Independent original-sandbox verification after corrected run again finds full
model/product hashes unchanged, revision3523/18177cells.

Final: Ruling: production operation/certificates/payment/provider/storage checks
remain separately gated — package explicitly read-only/offline/local — cost if
wrong: a fixture report could be mistaken for live release authorization.
Final: Ruling: preceding outage/supplier/browser protocols retain their earlier
qualification, not a claim of new exercise here — cost if wrong: missing live
consumer behavior must still be checked at release.
Final: Ruling: only synthetic settlement rows are rehearsed — no historical
production/customer data copied — cost if wrong: actual target history needs its
backup/review and immutable settlement checks at release.
Final: Ruling: original admin model/product hashes are independently re-read;
no runtime/session mutation or new live browser inspection — cost if wrong:
runtime acceptance remains with preceding browser evidence/final smoke checks.

Original private package/evidencef24fd8b5 retained unchanged as superseded per-cell
scope. New durable copycutover-package-20261002-9b9b6c301-reader-verified, dirs0700/
files0600. Corrected completed evidence manifest hash
799484aa3c1a52fd0e98f6a6c6ba9353f7411652aebc31f30ed83c5e1a17db00;
input package manifest remains cf3c8277518b096ed560a3393930a30258bfdaa60e7df136b739c9b9f94b39a0.
Corrected result hashc46b01c7c54ee13b683c4e0d3686dbb20d1c08f6a992a103b336ba2b9f9a8f06.
activationReady=false/productionWriteAuthorized=false. Source attribution remains
9b9b6c301; docs-only final commit does not relabel executed source qualification.
