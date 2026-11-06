# Character Studio — visibility and pricing audit, 2026-11-05

## Verified state

This audit concerns `codex/character-studio-v2` and its isolated
`character-studio-test` preview. It does not authorize a production deployment,
copy preview media into production, or execute a new paid generation.

Four completed Recast jobs were returned by the authenticated preview video feed
for the test owner. The jobs are owned and playable through `/app?job=<jobId>`.
Character Studio's image history deliberately requests `surface=character`;
Recast submissions use `surface=video`. The submission's job link is transient.
The navigation now exposes a persistent **My videos / Mes vidéos / Mis vídeos**
link in Recast, opening the existing account-scoped video workspace. This is an
access fix, not a new Recast-only gallery or a cross-environment transfer.

## Customer prices and supplier evidence

Current Character Studio image generations, new looks and character sheets use
the native Nano Banana 2.1 tariff. One sheet is one generated image. Image size,
not the number of drawn views, selects the customer price.

| Output | Current customer USD | Supplier output-image component USD | Margin using only that component |
| --- | ---: | ---: | ---: |
| 1K | 0.07 | 0.0336 | 52.00% |
| 2K | 0.11 | 0.0504 | 54.18% |
| 4K | 0.23 | 0.1134 | 50.70% |

The last column is **not the complete margin**. Google also bills input text,
input images and output text/reasoning. Each reference image adds approximately
USD 0.00168 at the current Standard/global rate. Search fees, where enabled, are
also separate. The configured output-token limit does not prove a total supplier
cost ceiling.

Four completed 1K images in the isolated preview have persisted provider usage
in `fal_queue_log.payload.providerUsage`. At USD 0.07 each, their list-price cost
estimates including measured input and reasoning were:

| Sample | Supplier usage estimate USD | Gross difference USD | Estimated gross margin |
| --- | ---: | ---: | ---: |
| A | 0.0383490 | 0.0316510 | 45.22% |
| B | 0.0398175 | 0.0301825 | 43.12% |
| C | 0.0374565 | 0.0325435 | 46.49% |
| D | 0.0402210 | 0.0297790 | 42.54% |
| Mean | 0.0389610 | 0.0310390 | 44.34% |

These are four observed usage estimates, not a complete production cohort or
reconciled supplier invoices. Seven older completed Nano21 images in this preview
had no matching completed usage log; they are not assigned zero cost. There is no
observed 2K/4K sample in this audit. Fees, storage, processing and support are not
deducted from any gross-margin figure above.

## Recast: baseline before the preview activation

At the initial audit, Recast preparation and confirmation used ordinary Wan 3 Prime
customer pricing. They do **not** use the separate five-creator-tools ×2.2 policy.
At the configured Singapore supplier rates, 720p costs USD 0.14 per billable
second and 1080p USD 0.28. Billable video seconds are source excerpt duration plus
generated output duration. Audio does not add video seconds. Without source
video, only generated video duration enters this quantity.

| Scenario | Source + output | Supplier LIST USD | Current customer USD | Current gross margin | Selected ×2 candidate USD |
| --- | --- | ---: | ---: | ---: | ---: |
| Marcel, 720p | 8 + 8 s | 2.24 | 2.92 | 23.29% | 4.48 |
| Vesper, 720p | 14 + 14 s | 3.92 | 5.10 | 23.14% | 7.84 |
| Dixie, 720p | 15 + 15 s | 4.20 | 5.46 | 23.08% | 8.40 |
| Dixie, 1080p | 15 + 15 s | 8.40 | 10.92 | 23.08% | 16.80 |

The current amounts were read from fresh unconfirmed preview quotes. Supplier
values are published-list estimates, not invoice reconciliation. Current retail
is approximately a 30% markup, giving about 23% margin on revenue after rounding.

Adrien selected **supplier cost ×2** on 2026-11-05 for the independent Recast
product. That is 100% markup and 50% gross margin before other fees, subject to
final wallet-cent rounding. This was initially an unactivated target; the isolated
preview activation is recorded below. It does not approve a new render or change past receipts.
No new image price has been selected.

## Preview Recast activation — 2026-11-05 22:35 UTC

The dedicated branch commit `e555923b65f53ab72719f0aacb100a9243a9989c` was
deployed through Git to Vercel's `character-studio-test` custom environment
(`dpl_2wyCrZix2Yp3hSqmGa3Vwx5qEsPc`). After the exact Git/production-isolation
check passed, the normal admin preview/confirmation flow created only
`admin-character-recast-recast-video`, scope `character-recast / recast / video`,
coefficient ×2. Immutable event: `ce011683-f366-48c1-8d13-c065c7ebce29`.
The affected Neon branch is `br-square-king-aenyqhsq` (`character-studio-v2-test`).
Production was neither configured nor deployed.

The 51-scenario server preview showed no invented previous product price.
Twelve live estimates covered fractional source seconds, 480p/720p/1080p,
output-only jobs and audio on/off. Two real unconfirmed six-second portrait
quotes returned USD 1.68 at 720p and USD 3.36 at 1080p. The 15-second source plus
15-second output examples returned USD 8.40 / 16.80. Ledger rows and amounts
remained unchanged; no provider render was submitted. Other policy rows and
ordinary Wan/Nano21 public quotes were identical before and after activation.

Disposable PostgreSQL 17 tests cover real quote/reservation/receipt/refund
transactions with mocked supplier submission, including insufficient funds,
duplicates, stale coefficients, unavailable rules and old accepted quotes.
The admin has an editable coefficient in Pricing → Tools, using preview,
confirmation, immutable history and coefficient rollback. Public pricing
examples use the same Recast pricing owner.

## Character image admin integration still to implement

Add a distinct Character Studio section to the existing pricing admin, reusing
its server preview, explicit confirmation, immutable change history and rollback.
The current legacy `character-draft` / `character-final` products do not control
new Nano21 work. Editing a native Nano21/Wan model tariff would also affect normal
model generations and cannot implement the requested independent positioning.

The scoped controls must cover:

1. **Generate Character, new looks and sheets:** fixed customer USD/image by
   1K/2K/4K, initially preserving 0.07/0.11/0.23. Display known image components
   separately from observed usage cost; unavailable complete cost means unknown
   margin, not a falsely precise positive margin.
2. **MaxVideoAI Recast (implemented in preview):** editable supplier-cost coefficient, active ×2,
   with 720p/1080p examples, separate source/output seconds, total customer price,
   absolute difference and estimated gross margin. The base must be the supplier
   estimate, never the already marked-up Wan customer quote.
3. **Scope and activation:** changes apply only to the selected Character Studio
   product. Preview distinguishes current price from proposed price. No generic
   model tariff, historical quote, accepted job, payment or refund is rewritten.
   Any schema initialization is an explicit Neon migration, not a GET side effect.
4. **Single price authority:** public pricing, the Generate button, prepared quote
   and locked confirmation must use the same scoped owner and revision. Changed
   policy or source facts require a fresh quote before payment. Recovery of an
   already accepted quote retains its original amount.

Required validation before activation: ordinary/admin account authorization;
preview without writes; duration/resolution/reference matrix; estimate/quote/
reservation/public-page parity; stale preview and stale quote rejection; concurrent
updates; insufficient funds; duplicate confirmation; lost-response recovery;
transaction rollback and original-price refunds; explicit proof that ordinary
Nano21/Wan prices and other creator tools are unchanged. Use disposable PG17 and
the isolated preview; no provider call is necessary for these checks.

## Evidence and current code owners

- `frontend/src/lib/nano-banana-2-1-pricing.ts`: incomplete image cost components.
- `frontend/src/server/images/google-vertex-image-response.ts`: observed token
  usage cost estimate; invoice cost remains unknown.
- `frontend/src/server/tools/character-builder/runner.ts`: native image execution.
- `frontend/server/character-studio/recast.ts`: scoped Recast request preparation
  and confirmation; currently ordinary model pricing.
- `frontend/server/character-studio/recast-public-price.ts`: current estimator.
- `frontend/server/pricing/quote-creator.ts`: separate ×2.2 policy for five other
  tools; not currently selected by Recast.
- `frontend/server/pricing-admin/product-pricing-inventory.ts`: existing admin
  inventory and explicitly legacy Character products.

Primary supplier sources checked on 2026-11-05:
[Google Standard Nano Banana 2.1 pricing](https://cloud.google.com/model-garden/pricing?hl=en)
and [Alibaba Wan 3 billing and Singapore rates](https://www.alibabacloud.com/help/en/model-studio/model-pricing).
