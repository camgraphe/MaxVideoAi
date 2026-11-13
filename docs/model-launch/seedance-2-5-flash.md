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

The adapter prepares the five ModelArk workflows (text, first/last frames, multimodal references, edit, extension). The 4–30-second range, Auto, six explicit ratios plus Auto, 24 FPS, source-derived edit timing/framing, input formats and duration budgets reuse the documented 2.5 protocol. They remain **candidate parameters pending exact Flash qualification**. The public catalog and submission switches remain closed. Only `t2v` is admitted by the default per-mode switch when explicitly enabling a canary.

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
| Model identity, aliases, picker variant | `config/model-registry.json`; independent Flash identity, grouped with Seedance variants. Public switches remain false. Generated runtime/catalog/roster are regenerated. |
| Workspace Create / Modify / Extend | Dedicated raw engine and shared Seedance controls; reference limits, 30-second Auto bound, inherited framing, owned edit source and ordered extension clips. |
| MCP discovery, details, prepare and confirm | Existing read-only catalog and canonical mode projection; explicit prelaunch access only. All five typed request projections tested without paid execution. No new tool/schema text is needed. |
| Studio | Conversation certification intersects canonical catalog readiness; reference fields and prices use the shared request/quote owners. No retired Canvas certification is added. |
| Milo | Composer context reads the same canonical mode details and Seedance prompt profile. No hardcoded Flash price, unsupported output format or quality ranking is injected. Public discovery remains gated. |
| Payments and provider accounting | Separate Flash LIST profile, 30-second source pricing, required active manual tariff, independent commercial grid. Missing Flash tariffs fail closed. |
| Polling, Activity, Media, recovery | Existing BytePlus provider polling; Flash edit participates in owned durable submission state, immutable paid snapshots and durable output recovery. |
| Model page / SEO / translations | Future `/models/seedance-2-5-flash`, `/fr/modeles/seedance-2-5-flash`, `/es/modelos/seedance-2-5-flash`. EN/FR/ES copy and the normal page template are prepared without changing publication. Marketing design is coordinated with **Moderniser les pages modèles**; publish only after exact feature qualification. |
| Pricing hub, model cards, Product offers, comparisons | Project the same canonical active quote after publication; no authored retail amount or supplier promotion in public copy. Standard ×2 needs cache revalidation even without a layout change. |
| Examples, watch, recreate, home, PAYG strip | Flash requires its own attributed renders, managed playlist and launch assets. Existing standard 2.5 clips remain standard 2.5. No home video/source is replaced by this candidate. |
| Navigation, footer, family pages, best-for, llms, sitemap | Registry-driven lists follow publication. Curated home/nav/footer/best-for selections require a separate editorial choice; a new model does not silently replace the flagship. |

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
The normal template is registered for future use, with pricing presets,
comparisons and examples disabled. Every registry publication flag stays false.
This prepares content, not a publicly accessible prelaunch page. Before launch,
review the copy against completed qualification, replace availability language,
connect reviewed Flash media, enable canonical live pricing scenarios and verify
the localized rendered pages. The separate design proposal does not change the
content schema or authorize media generation/publication.
The 123 focused model-content, template, view-model and Seedance marketing tests
passed, including unpublished-surface checks and render-data assertions that no
Flash playback, example or generation link is fabricated from the scene plans.

1. Complete local provider, canonical quote, MCP/Studio projection, recovery and PostgreSQL checks. Offline mocks are not provider canaries.
2. Resolve the observed Flash API admission blocker. Both approved provider attempts above were refused; before any later paid submission, establish its authorized scope, then verify API acceptance, output, usage and raster. Qualify additional reference/edit/extension modes independently before widening `SEEDANCE_2_5_FLASH_BYTEPLUS_MODES`.
3. Validate literal tariff proposals against the current database and apply through the existing admin batch preview/confirmation path. Track all 31 receipts and complete any pending refresh; verify visible prices after cache revalidation. Flash activation and standard repricing are separate from a successful code build.
4. Finalize the prepared localized model content and exact Flash media/launch assets with the marketing task. Run registry, launch-assets, SEO and browser checks when publishing those surfaces.
5. Follow `docs/deployment/github-vercel.md`: clean committed candidate, PR, required Quality CI, current main, reviewed production release and both-domain verification.

Relevant Flash environment keys: `BYTEPLUS_ARK_SEEDANCE_2_5_FLASH_MODEL_ID`, `SEEDANCE_2_5_FLASH_BYTEPLUS_ENABLED`, `SEEDANCE_2_5_FLASH_PROVIDER`, `SEEDANCE_2_5_FLASH_BYTEPLUS_ADMIN_ONLY`, `SEEDANCE_2_5_FLASH_BYTEPLUS_MODES`. Closing these controls must not prevent recovery of an already accepted job.
