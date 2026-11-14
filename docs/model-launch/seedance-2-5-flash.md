# Seedance 2.5 Flash — integration candidate, 14 November 2026

## Identity and evidence

- Canonical model/slug: `seedance-2-5-flash`; family `seedance`; label **Seedance 2.5 Flash**.
- Direct ModelArk ID: `dreamina-seedance-2-5-flash-261115`, `https://ark.ap-southeast.bytepluses.com/api/v3`. No Fal or LAS fallback.
- The account activation row was observed as **Activated**. Activation is separate from a successful generation.
- [Official model card](https://console.byteplus.com/ark/region:ap-southeast-1/model/detail?name=dreamina-seedance-2-5-flash): up to 30 seconds, 480p/720p, up to 10 images, 5 videos and 5 audio references; multimodal generation and editing.
- [Official pricing](https://console.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing), checked 2026-11-13: $0.007/1,000 tokens without video input and $0.0043/1,000 with video input. No 1080p, 4K or offline inference. Actual provider usage remains authoritative.
- [Task API](https://console.byteplus.com/ark/region:ap-southeast-1/docs/create-video-generation-task-api) still announces general API availability for 2026-11-15 at 14:00 UTC+8. Its detailed parameters describe standard 2.5. Flash account activation does not establish those advanced capabilities.

### Authorized account test

One explicitly approved attempt on 2026-11-13 submitted the exact Flash ID with
a text-only cup scene, 4 seconds, 480p, 16:9 and generated audio off. The estimated
LIST cost was $0.26901. BytePlus returned HTTP **404**, stating that the model or
endpoint does not exist or is not accessible. It returned **no generation ID**.
Initial request ID:
`0217946081602479f6cd41e8514911883ec9f138006f90f614575`.

A read-only `GET /api/v3/models` using the same existing project credential
returned HTTP 200 and 35 visible model versions, including
`dreamina-seedance-2-5-260628` but no Flash version. The account console still
showed Flash as **Activated**. This establishes a current API admission blocker,
not a successful render or a definitive cause. No completion usage or billing
receipt was returned. The documentation still announced 15 November API access
when rechecked. Private request/response evidence stays under
`.local/seedance-25-flash/`; it contains no exported API credential.

Adrien subsequently authorized a retest and an alternative calling method. A
direct HTTPS request on 2026-11-13, without the MaxVideoAI provider adapter,
submitted the same minimal payload and received HTTP **404** with the explicit
code `InvalidEndpointOrModel.NotFound`. Request ID:
`021794609347377a2f4933af3443b601e52f5659e0d958f813645`.
The preceding read-only model listing again returned HTTP 200, the same 35
versions and no Flash. A private, read-only comparison established that the test
credential exactly matches Vercel's production `BYTEPLUS_ARK_API_KEY`; no secret
was displayed or exported. The console's server key is Active with All
permissions and Flash remains Activated. Thus the refusal is reproduced outside
the application adapter with the production credential. The release date remains
a possible explanation, not a proven cause. No task ID or completion usage was
returned by either provider attempt.

This diagnostic also exposed an observability defect: HTTP failures read only
top-level error codes although BytePlus returns `error.code`. The client now
reuses its existing nested/flat response-code parser for create, retrieve and
delete failures. Offline regressions preserve status, code and sanitized messages
and verify that no automatic retry or fallback is introduced.

The adapter prepares the five ModelArk workflows (text, first/last frames, multimodal references, edit, extension). The 4–30-second range, Auto, six explicit ratios plus Auto, 24 FPS, source-derived edit timing/framing, input formats and duration budgets reuse the documented 2.5 protocol. They remain **candidate parameters pending exact Flash qualification**. At Adrien's request on 14 November, the branch prepares public catalog and indexing settings directly for launch, without a separate prelaunch marketing stage. Provider execution still uses its existing environment and per-mode controls; only `t2v` is admitted by default when explicitly enabling a canary. Validate final provider settings before release.

Flash has independent 10/5/5 limits at schema and provider boundaries. MOV output, native Draft/final, 1080p, 4K and audio-only references are not admitted. Optional watermark and return-last-frame remain retired product controls. Input MOV clips are different from MOV output.

The 2.5-series raster/minimum formula is an estimate for Flash. It reproduces the published Flash 5-second 16:9 examples ($0.34/$0.76 without video at 480p/720p; the source duration also contributes with video). This does not replace returned usage or a completed Flash raster check. No signed Flash discount was established; do not inherit another Seedance model's contract.

## Commercial decisions

Adrien explicitly selected on 2026-11-13:

- Flash: public BytePlus LIST **×1.6**.
- Standard Seedance 2.5: public BytePlus LIST **×2 exactly for every case**, including existing prices that increase. This includes normal generation and its supported Draft/final stages.

`server/pricing/seedance25-commercial-tariffs.ts` authors literal fixed or continuous prices. It does not change active database cells, historical charges, account contracts or global margins. Customer cents are rounded upward once, after applying the multiplier to unrounded LIST. Video inputs retain the published minimum plateau and fractional source seconds.

The production inventory was read at tariff revision **4731**: 4,860 standard cells and no Flash cells. Production Vercel configuration selects `SEEDANCE_2_5_EDIT_TRANSPORT=modelark` with ModelArk editing enabled. LAS tariff replacement is deliberately rejected by the proposal builder.

| 5-second output, 16:9 | Standard ×2 | Flash ×1.6 |
| --- | ---: | ---: |
| 480p, no input video | $1.03 | $0.54 |
| 720p, no input video | $2.32 | $1.21 |
| 720p, 4-second source video | $2.49 | $1.34 |
| 1080p, no input video | $5.69 | Unsupported |

These are **prepared prices**, not an assertion that production charges changed. At a representative two-second source duration, the complete standard comparison has 1,215 lower and 3,645 higher cells; these are option classes, not weighted customer usage. There are 1,944 new Flash classes. Retain the user's explicit exact-multiplier decision when reviewing the changes.

Reproduce the read-only proposal from a complete current export:

```sh
TSX_TSCONFIG_PATH=frontend/tsconfig.json node --import tsx frontend/scripts/prepare-seedance25-commercial-tariffs.ts CURRENT_SNAPSHOT_JSON OUTPUT_DIRECTORY
```

The command also emits **31 native admin JSON imports** in `admin-batches/`: 22 standard replacement batches and 9 Flash initialization batches, each at most 226 classes. Import them in **Admin Pricing → Tariff batches → Import exact JSON**, then preview and confirm sequentially. A preview binds the current source, target, supplier facts, policy, actor and tariff revision. Preparing every preview ahead of time would make subsequent previews stale when the first batch changes that revision.

`pricing-admin/tariff-batches/seedance.ts` plugs these selectors and literal amounts into the existing admin planner. Normal, Draft and final selectors remain distinct. Flash accepts only its reviewed 480p/720p normal classes. Source-video amounts preserve the exact proportional slope and minimum; comparing that slope against LIST proves the entire fractional source-duration range, including Draft/final's identical token minimum. No runtime multiplier or alternative tariff write route is introduced.

The existing service retains the 226-class and five-second transaction limits, same-origin admin authorization, stale-preview rejection, atomic version/history/event/receipt writes, idempotent confirmation, reconciliation and rollback review. Confirmed changes call `pricing-admin/revalidation.ts` for the homepage, pricing hub, model/category cards, localized pages, examples/watch, comparisons and PAYG. A failed refresh stays **pending** and retries only page refresh, never pricing mutation. Each batch is atomic; the complete 31-batch rollout is sequential and must be tracked to completion. Historical pricing snapshots and paid jobs remain immutable; repricing is not a refund trigger.

Local PG17 verification exercised all 6,804 classes through those native admin transactions, retained all 4,860 previous versions and the preexisting paid job, and verified canonical billing/public quote parity after repricing. It also injected a refresh failure and checked that retry preserves the receipt and revision. These are disposable-database results, not a production activation claim.

## Surface audit

| Surface | Owning source and candidate behavior |
| --- | --- |
| Model identity, aliases, picker variant | `config/model-registry.json`; independent Flash identity, grouped with Seedance variants. Model, examples, compare, app, pricing and sitemap publication are enabled in this branch; model and comparison indexing are enabled. Generated runtime/catalog/roster are regenerated. |
| Workspace Create / Modify / Extend | Dedicated raw engine and shared Seedance controls; reference limits, 30-second Auto bound, inherited framing, owned edit source and ordered extension clips. |
| MCP discovery, details, prepare and confirm | Existing catalog and canonical mode projection follow registry publication and runtime availability. All five typed request projections tested without paid execution. No new tool/schema text is needed. |
| Studio | Conversation certification intersects canonical catalog readiness; reference fields and prices use the shared request/quote owners. No retired Canvas certification is added. |
| Milo | Composer context reads the same canonical mode details and Seedance prompt profile. Guidance includes reference limits, current-quote instructions and the provisional benchmark qualification. No hardcoded Flash price or unsupported output format is injected. |
| Payments and provider accounting | Separate Flash LIST profile, 30-second source pricing, required active manual tariff, independent commercial grid. Missing Flash tariffs fail closed. |
| Polling, Activity, Media, recovery | Existing BytePlus provider polling; Flash edit participates in owned durable submission state, immutable paid snapshots and durable output recovery. |
| Model page / SEO / translations | `/models/seedance-2-5-flash`, `/fr/modeles/seedance-2-5-flash`, `/es/modelos/seedance-2-5-flash` are prepared as indexable routes with localized copy, generation CTA, current-price scenarios and comparison links. Page design is coordinated with **Moderniser les pages modèles**. |
| Pricing hub, model cards, Product offers, comparisons | Project the same canonical active quote after publication; no authored retail amount or supplier promotion in public copy. Standard ×2 needs cache revalidation even without a layout change. |
| Examples, watch, recreate, home, PAYG strip | Flash requires its own attributed renders, managed playlist and launch assets. Existing standard 2.5 clips remain standard 2.5. No home video/source is replaced by this candidate. |
| Comparisons and scoreboard | Six full EN/FR/ES comparisons: standard 2.5, 2.0 Fast, Kling 4 Flash, Veo 3.1 Fast, LTX 2.5 Fast and MiniMax H3. Hub, popular pairs, related comparisons, reciprocal links and localized sitemap discovery include them. All eleven Flash scores use the existing editorial-estimate display. |
| Best for | Flash is an additional workflow option on fast drafts, image-to-video, character references, reference-to-video, multi-shot, ads, UGC ads and product videos. Localized MDX, FAQs and related links agree with the canonical lists. Existing editorial picks retain their order; no 4K or measured-quality winner is invented. |
| Navigation, footer, family pages, PAYG, assistants | Curated model/comparison links, Seedance family explanations, example-page onward links and PAYG discovery include Flash. PAYG and model price cards use canonical quotes. Assistant guidance, llms.txt and AI-training page targets include the new routes and preserve estimate qualifications. |

## Qualification and release

### Offline preparation on 14 November

The PR's fast lane exposed an extension regression: the new generic reference
limit also widened standard Seedance 2.5 extension from three sources to ten.
The execution guard now preserves standard's three-source behavior independently
of its reference-video budget; the separate Flash candidate permits five and
rejects six. The registry and image-dimension inventories include Flash. All 144
focused request, MCP, image-dimension, registry and Flash regressions passed.

`content/models/{en,fr,es}/seedance-2-5-flash.json` now supplies localized decision,
Prompt Lab and Examples content using the existing strict contracts. Scene plans
are explicitly unrendered; no standard Seedance video is attributed to Flash.
The normal template has three current-price scenarios (4s/480p, 8s/720p with
audio and 30s/720p), comparisons and examples enabled. Missing active tariffs
produce unavailable price labels through the canonical commercial builder,
never stale fallback amounts. Publication and indexing are prepared in the
branch now; deployment waits for the final qualification below. Scene plans
remain explicitly unrendered. The separate design proposal does not change the
content schema or turn illustration images into Flash video evidence.
Each authored illustration occupies one place on the model page: one hero and
five distinct demonstration scenes. Prompt Lab must not repeat the hero or
gallery images unless an explicit comparison needs the repetition; retain its
text and prompts. The model-page design task owns this visual assembly.

The launch-state marketing batch passed the complete fast suite (11,213 passed,
one existing skip), TypeScript, registry/projection checks, the public-exposure
guard and the full production build (1,038 generated pages). ESLint has no errors
and seven preexisting warnings. Three local PostgreSQL tests passed for the
6,804 Seedance classes, native batch receipts, immutable paid history and current
price propagation across public consumers. Browser/HTTP smoke checked all 45
localized model/comparison/Best-for routes for 200 responses, canonicals,
hreflang, indexability and JSON-LD. It also checked the estimated benchmark,
llms.txt, mobile comparison overflow and the public pricing endpoint's unavailable
response without an active Flash tariff. No browser exceptions were observed on
the benchmark, comparison and pricing pages. These checks use a disposable local
database and do not establish production access, activated tariffs or field CWV.

### Sourced editorial benchmark

`data/benchmarks/seedance-2-5-flash-evidence.v1.json` records the exact sources,
retrieval limitations, rationale and confidence for all eleven criteria. The
canonical score row derives **≈8.0/10** from prompt adherence, motion and
consistency. These are provisional editorial judgments, not an external
numerical benchmark or controlled MaxVideoAI results. Text rendering, lip sync
and multi-shot sequencing are explicitly low-confidence capability priors.

The dossier uses the [official Dreamina Flash page](https://dreamina.capcut.com/seedance/seedance-2-5-flash)
and attributed first-person reports from [Quantslant](https://quantslant.com/seedance-2-5-flash/)
and [SpicyAPI](https://spicyapi.ai/models/seedance-2-5-flash). The latter two were
available as indexed page text, without a direct playback review. Their prices,
endpoint variants and queue times do not establish MaxVideoAI behavior. The
value estimate uses the prepared native admin tariffs, with activation pending.

Public UI uses the existing estimate marker, one short localized explanation and
a methodology link. The full source list stays in the evaluation dossier;
assistant-facing guidance retains the qualification. Production median/P90
latency remains a separate measured series with its existing sample thresholds.

1. Complete local provider, canonical quote, MCP/Studio projection, recovery and PostgreSQL checks. Offline mocks are not provider canaries.
2. Resolve the observed Flash API admission blocker. Both approved provider attempts above were refused; before any later paid submission, establish its authorized scope, then verify API acceptance, output, usage and raster. Qualify additional reference/edit/extension modes independently before widening `SEEDANCE_2_5_FLASH_BYTEPLUS_MODES`.
3. Validate literal tariff proposals against the current database and apply through the existing admin batch preview/confirmation path. Track all 31 receipts and complete any pending refresh; verify visible prices after cache revalidation. Flash activation and standard repricing are separate from a successful code build.
4. Finalize the separate page design and exact Flash media/launch assets with the marketing task. Review the launch-state copy against actual qualified modes, reassess provisional scores when real outputs exist, and verify registry, launch-assets, localized SEO and browser checks.
5. Follow `docs/deployment/github-vercel.md`: clean committed candidate, PR, required Quality CI, current main, reviewed production release and both-domain verification.

Relevant Flash environment keys: `BYTEPLUS_ARK_SEEDANCE_2_5_FLASH_MODEL_ID`, `SEEDANCE_2_5_FLASH_BYTEPLUS_ENABLED`, `SEEDANCE_2_5_FLASH_PROVIDER`, `SEEDANCE_2_5_FLASH_BYTEPLUS_ADMIN_ONLY`, `SEEDANCE_2_5_FLASH_BYTEPLUS_MODES`. Closing these controls must not prevent recovery of an already accepted job.
