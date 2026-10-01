# Local pricing completion — 2026-10-01

Branch: `codex/bytedance-pricing-grid`. This record supersedes the earlier local
coverage and inactive-cutover checkpoints. It certifies the isolated review
sandbox, not current production prices or production activation readiness.

## Result

- One compact `/admin/pricing` workspace: Video, Image, Audio, Tools, Storyboard.
- All 48 app-published models and 15 families have current editable customer prices.
  Legacy app models retain independent public publication policy.
- Model prices use explicit retail cells and literal unit tariffs. The generic
  model percentage rule is historical/read-only in this active local sandbox.
- Supplier references are blue, customer prices purple, indicative margins green
  or amber. LIST/catalogue estimates, account costs and observed invoices remain
  separate; an unknown actual cost is never zero or a verified margin.
- Canonical quote owners feed charging, live estimates, MCP, Studio/Storyboard,
  public Pricing, model pages/cards/specs, comparison pages/specs, home and examples.
  Admin edits their persisted inputs; it does not introduce another price formula.
- Public examples show today's price for known generation parameters, a labeled
  comparable current reference when parameters are incomplete, or no price when
  unavailable. Original paid receipts and historical job snapshots stay immutable.
- Restore Video, Denoise, Fix Blur and Smooth Motion expose their seven released
  quality profiles and scoped prices. Special extras retain their actual units,
  included quantities, rounding and block boundaries.
- Local routing selects Alibaba for Wan 3/Prime and Fal for MiniMax. Provider
  credentials are blank and generation is mocked in the isolated sandbox.

## Change a price

1. Open [the local admin](http://localhost:3106/admin/pricing) and choose a category,
   family and model/product.
2. Expand the row. Select the priced variant and compare supplier reference,
   customer rate/total and indicative gross margin.
3. Enter the customer rate. Video uses USD/second, images USD/image; extras show
   the relevant quantity. Open media/token tariffs expose their continuous range.
4. Click **Preview**, inspect the total, affected scope and warnings, then confirm.
   A stale quote/revision requires a new preview. History records the change and
   rollback requires another preview/confirmation.

Editing a selected exact variant does not silently alter neighboring variants.
Continuous tariffs cover their explicitly displayed quantity domain. “Preserve”
keeps the captured original rounding; entering new unit rates replaces it across
that domain with the documented upward rounding.

## Actual persistent local cutover

Activation code: `24ad70c3f5e0c1e6c3a1521ad48620e271cd4b10`.
Base `main`, local `main`, `origin/main`, and fresh remote `main` query:
`10589cc6b368bae3647ec9d00fba1b73c8b20128`.

| Evidence | Observed result |
| --- | --- |
| Effective capture and persisted manual quotes | 20,113 / 20,113 |
| Initial amounts unchanged | 20,089 |
| Separately approved GPT Image 2.5 edit floors | Exactly 24, each +1 cent |
| Active customer cells | 14,658 |
| Reviewed continuous classes | 591 |
| Remaining supported-domain gaps | 0 |
| Tariff revision | 3 → 4, active locally |
| Archived old staged cells | 66,549, immutable activation event |
| Billing products / dynamic coefficient overrides | 13 / 0, unchanged |
| Topaz / FlashVSR minimum customer cents | 80 / 18, unchanged |
| Authored production code switch | `false`, unchanged |

Fingerprint:
`e951591b0e36467b845fb59c22d320d2440ff371987bd44b4157a2a84c2b44d3`.
Activation event: `ea47034b-b958-4119-ba7c-4484adb256db`,
effective from `2026-10-01T01:48:18.424Z`.

Private artifacts: `/tmp/mva-pricing-complete-reviewed-20261001/`, including
baseline, full candidate, report, manifest, activation receipt and the read-only
post-activation `active-grid-audit.json`. The pre-cutover SQL backup is
`/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-pricing-pre-cutover-vVNOLy/sandbox.sql`.
These files contain local evidence; they are not a portable production seed.

The previous approval's effective-policy hash became stale after restoring the
unrelated local finishing-tool rule. A separate one-off evidence record verified
every original model scenario's ID/cents/currency, database, registry, factual
environment and staged state, plus the exact same 24 supplier ceilings. It carries
the original certificate hash and preserves the existing human-approved amounts.
The generic approval refresh gate was not weakened and no new increase was inferred.

## Verification

- Full committed cutover snapshot `24ad70c3f`: **6,606 standard + 11 isolated Studio tests passed**, zero failures; three standard tests skipped. Optimized build succeeds with 920 static pages. Logs: `/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-pricing-validation-056q1V/`.
- Subsequent HTTP boundary correction `b5a2e4de2`: **13 focused tests passed**, including safe open quantities and negative/fractional/unsafe/wrong-model rejection; TypeScript, frontend lint, exposure lint and diff checks pass. The full suite above was not rerun for this small transport correction.
- Optimized build of `b5a2e4de2` also passes, including type/lint and offline registry/SEO gates, with 920 static pages. Logs: `/var/folders/y_/v1ytsmzd3295fcx7b_m6_n6c0000gn/T/mva-pricing-final-build-dOJ1Oo/`. The sanitized env file is restored and the private admin runtime is restarted.
- Independent full-matrix PostgreSQL certificate regression verifies stale confirmations, fingerprint/context/revision changes, full archival, immutable history, active quote parity and retirement of the old generic percentage editor.

The actual persistent private database was also audited after activation:
all 20,113 reconstructed scenarios quote the expected cents with `manual_tariff`;
the event archives all 66,549 preceding staged cells. No model quote falls through
to `legacy_margin_rule` in this audit. This is separate from disposable fixture tests.

Actual local HTTP inventory: 48 models / 15 families, active revision 4, zero coverage gaps, zero missing representative customer or supplier-reference values; unauthenticated requests remain 401. Policy inventory confirms model percentage editing is retired.

Ten Pricing/model/index/comparison routes in EN/FR/ES return 200 with canonical, hreflang and JSON-LD. Exact per-second Pika and Seedance comparison amounts match current quotes. Additional no-store HTTP checks quote Luma Modify 131s at 2,044 cents, H3 Max with 20,000 tokens at 94 cents, and the approved GPT Image Flare medium one-reference scenario at 3 cents.

The real browser verifies Mini preview 95 → 100 cents, then cancellation/reset without a saved edit. H3 reference mode at 20,000 tokens displays the same 94-cent total and the independent output/extra-token rates. At 390 × 844, document/client widths are both 378px and the token editor is readable; the viewport override is restored. The existing admin tab is reloaded on the final source and retained as the user-facing deliverable, with no new tariff edit saved.

Screenshots of the actual app: `/tmp/maxvideoai-pricing-final-mobile.jpg` and `/tmp/maxvideoai-pricing-final-desktop.jpg`.

## Review and decisions

One fresh whole-branch review (`10589cc6b..fbbe4cd28`) found no verified Critical
or Important blocker. Its MiniMax billed-token metadata finding was fixed:
included references now report zero billed tokens, and normalized arithmetic units
are labeled separately. Customer amounts did not change. The parent later caught
and fixed the command/reproduction certificate serialization mismatch with a real
PostgreSQL RED → GREEN regression, keeping full fingerprint checks intact.

Rulings made in the final completion:

- Keep open Luma Modify seconds and H3 reference tokens open; preserve native cent
  operation order in captured literal tariffs, rather than invent a generation cap.
- Reproduce the entire baseline/candidate under locks and archive the full old grid
  atomically. Hash equality alone does not establish quote parity.
- Use one interval advisory lock for the bulk seed while retaining overlap checks;
  per-selector locks exhausted PostgreSQL shared lock memory at full scale.
- Keep actual billed token quantities separate from equivalent normalized units.
- Reuse the same open-domain classifier in the public HTTP parser; preserve safe-integer and every unrelated request boundary instead of retaining obsolete generic transport caps.
- Keep exact current per-second public amounts; update stale two-decimal display
  tests rather than restore inaccurate rate approximations.
- Use one serializer for prepared and locked baseline provenance; preserve the
  certificate's complete integrity check.
- Carry only the same 24 approved cent increases after all 20,113 original retail
  amounts and supplier ceilings have been rechecked; preserve the old evidence.

The [execution ledger](../../.superpowers/sdd/2026-09-29-all-model-manual-customer-tariffs/progress.md)
retains every earlier ruling and its risk. Deferred minor from earlier reviews:
whole-grid admin recomputation has no dedicated performance acceptance. Final
review leaves no unfixed minor; no Core Web Vitals improvement is claimed.

The reviewer declined production parity/activation/migration behavior, real
supplier contracts/invoices/availability/profitability, external operations,
persistent-sandbox activation, independent full validation/build/full matrix and
concurrency reruns, browser/accessibility/performance, exhaustive safe-integer
enumeration, and a fresh exhaustive re-audit of every older subsystem. Parent
verification above supplies the local functional gates only.

## Remaining release work

- Capture effective production quotes/overrides at the reviewed release revision,
  reconcile them to the complete candidate and disclose only the same 24 approved
  deltas. Review migrations and activation against that actual environment.
- Confirm account-effective supplier/settlement/invoice provenance. Reconcile
  historical direct PaymentIntents that lack the new immutable quote binding.
- Review/PR/Quality CI/merge/deploy through the documented GitHub/Vercel path after
  separate production authorization and verify public/admin/client surfaces.
- The approved local admin session is used for review; the separate localhost
  Google OAuth callback problem is not resolved by this pricing work.
- Seedance Draft remains an unpublished 480p → optional 1080p final foundation.
  Connecting quotes, charging, polling, refunds and creator controls, plus direct
  provider canaries and post-release SEO/GEO monitoring, remain separate gates.

No production database write, provider job, payment, storage/email/support action,
push, merge or deployment was performed. The review worktree and branch are kept.
