# P0 video model family refresh design

**Date:** 2026-09-01

**Status:** approved; implementation plan ready

**Owner:** MaxVideoAI product owner

## Objective

Ship the current P0 video-model wave as one complete MaxVideoAI product update:
runtime execution, exact pricing, lifecycle policy, localized marketing pages,
real examples, scoreboards, comparison pages, SEO continuity, and MCP parity.

The release adds seven public model identities across four families:

- Wan 3.0 and Wan 3.0 Prime;
- LTX 2.5 Fast and LTX 2.5 Pro;
- Grok Imagine Video 1.5;
- FLUX 3 Video and FLUX 3 Video Draft.

Grok and FLUX become new first-class model families. Wan and LTX extend their
existing families. The launch is not complete while any new public model page
has an empty example playlist, missing score cells, placeholder pricing, or a
catalog/MCP capability mismatch.

## Approved product decisions

- Canonical P0 model slugs are:
  - `wan-3`;
  - `wan-3-prime`;
  - `ltx-2-5-fast`;
  - `ltx-2-5-pro`;
  - `grok-imagine-video-1-5`;
  - `flux-3`;
  - `flux-3-draft`.
- Canonical families are `wan`, `ltx`, `grok`, and `flux`.
- Grok and FLUX receive new family definitions, family discovery copy, brand
  ownership, and family-level example behavior.
- LTX 2.5 Pro and Fast become the current LTX generation.
- LTX 2.3 Pro and Fast become SEO-active legacy models. They remain published,
  indexable, directly selectable, and executable, but are excluded from default
  recommendations and receive an explicit upgrade path to 2.5.
- LTX 2.0 Pro and Fast become deep legacy. They disappear from current product
  discovery and new-generation recommendations while historical jobs remain
  readable. Their SEO pages initially remain as self-canonical transition
  pages instead of receiving an immediate redirect.
- Wan 3 and Wan 3 Prime become current. Wan 2.6 becomes the executable legacy
  fallback. Wan 2.5 becomes deep legacy.
- No Wan model receives an immediate launch-day redirect.
- Every new model launches with at least two accepted, real videos. The P0
  minimum is therefore fourteen videos.
- Model pages and family example pages must contain their accepted videos before
  public publication and sitemap inclusion.
- Every published comparison involving a P0 model must contain a complete
  scoreboard.
- P0 comparison pages use scoreboard-only presentation. They do not contain a
  face-to-face or side-by-side video showdown.
- MCP catalog, model details, recommendations, budgeting, validation, pricing,
  request projection, and generation execution ship in the same release as the
  app surfaces.
- There is no administrator-only, page-only, or MCP-only partial launch.

## P0 source contract

The runtime authority is the live Fal contract, cross-checked against the
model owner's current public documentation immediately before implementation
and again before paid launch generations.

| Model | MaxVideoAI modes | Fal endpoints |
| --- | --- | --- |
| Wan 3 | `t2v`, `i2v`, `ref2v` | `alibaba/wan-3.0/text-to-video`, `alibaba/wan-3.0/image-to-video`, `alibaba/wan-3.0/reference-to-video` |
| Wan 3 Prime | `t2v`, `i2v`, `ref2v` | the corresponding `alibaba/wan-3.0-prime/*` endpoints |
| LTX 2.5 Fast | `t2v`, `i2v`, `a2v` | `lightricks/ltx-2.5/text-to-video/fast`, `lightricks/ltx-2.5/image-to-video/fast`, `lightricks/ltx-2.5/audio-to-video/fast` |
| LTX 2.5 Pro | `t2v`, `i2v`, `a2v` | the corresponding `lightricks/ltx-2.5/*/pro` endpoints |
| Grok Imagine Video 1.5 | `t2v`, `i2v`, `ref2v` | `xai/grok-imagine-video/v1.5/text-to-video`, `xai/grok-imagine-video/v1.5/image-to-video`, `xai/grok-imagine-video/v1.5/reference-to-video` |
| FLUX 3 Video | `t2v`, `i2v`, `fl2v`, `extend` | `blackforestlabs/flux-3/text-to-video`, `blackforestlabs/flux-3/image-to-video`, `blackforestlabs/flux-3/first-last-frame-to-video`, `blackforestlabs/flux-3/extend-video` |
| FLUX 3 Video Draft | `t2v`, `i2v`, `fl2v`, `extend` | the corresponding `blackforestlabs/flux-3/*/draft` endpoints |

`keyframes-to-video`, `draft-enhance`, and any provider mode that does not map
cleanly to an existing canonical MaxVideoAI workflow are outside this P0. They
may be proposed later as distinct capability work rather than being disguised
as a supported mode.

The final source check must capture exact durations, resolutions, aspect
ratios, audio behavior, reference counts, media limits, defaults, provider
availability, and prices. A provider change updates the implementation and
tests before publication; stale audited values are never silently retained.

## Canonical ownership and generated projections

`frontend/config/model-registry.json` remains the only authored owner of model
identity, aliases, family, lifecycle, publication, comparison relationships,
replacement policy, and route tombstones.

Raw Fal engine modules own mode schemas, provider endpoints, provider facts,
UI capability notes, and Fal-facing identifiers. Generated runtime, catalog,
roster, and documentation projections must be regenerated through the existing
model-registry workflow and never hand-edited.

The implementation should add explicit lifecycle semantics to the canonical
registry rather than infer them from scattered marketing copy:

```text
current       actively recommended and ranked as the family default
legacy        still executable and indexable, but not recommended by default
deep_legacy   historical product identity; no current discovery or recommendation
retired       unpublished and permanently mapped to a replacement
```

Legacy and deep-legacy records may include a direct canonical `successorId`;
generated projections derive the public successor slug from that identity. A
retired record uses the existing enforced replacement contract. Generated
projections must preserve the distinction so the app, marketing routes,
pricing, compare pages, admin tools, and MCP cannot disagree about a model's
status.

## LTX lifecycle and SEO design

### Search Console evidence

The 2026-09-01 live Search Console review compared 2026-05-30 through
2026-08-29 with the preceding three months:

- all LTX queries: 27,051 impressions versus 20,377, and 561 clicks versus 472;
- queries containing LTX 2.3: 13,028 impressions versus 12,437, with position
  stable at 8.6;
- `/examples/ltx` on LTX 2.3 queries: 8,219 impressions versus 6,440;
- `/models/ltx-2-3-fast`: 749 impressions versus 1,790;
- `/models/ltx-2-3-pro`: 384 impressions versus 1,376;
- `/models/ltx-2`: 4,367 LTX-query impressions and 8 clicks in the current
  three-month window;
- `/models/ltx-2-fast`: 922 LTX-query impressions and 3 clicks;
- the exact query `ltx 2.5` already produced 410 impressions, while the visible
  2.5-vs-2.3 query variants produced at least 374 impressions with almost no
  clicks.

This is a ranking-ownership shift, not the disappearance of LTX 2.3 demand.
The family example page has absorbed authority while the individual 2.3 model
pages have weakened. Redirecting 2.3 now would discard useful version-specific
intent and break the connection to existing 2.3 examples.

### LTX page policy

- New 2.5 Pro and Fast pages are self-canonical, indexable, and current.
- Existing 2.3 Pro and Fast pages remain self-canonical and indexable. They gain
  a legacy badge, a concise version-history block, a direct upgrade CTA, and a
  link to the relevant 2.5-vs-2.3 scoreboard page.
- Existing 2.0 Pro and Fast pages become deep-legacy transition pages. They
  explain that generation has moved to 2.5, preserve useful 2.0-specific facts,
  and link directly to the matching successor.
- Deep-legacy 2.0 pages are removed from current-family navigation, app model
  selection, default MCP discovery, recommendations, and current pricing grids.
- Existing 2.0 comparison pages with measurable Search Console impressions may
  remain indexable as historical scoreboard-only comparisons. They must not
  imply that 2.0 is a current generation choice.
- Historical 2.0 and 2.3 video detail pages remain accessible and retain their
  truthful original model labels.

After the new 2.5 pages have been indexed and observed for at least one stable
28-day window, the 2.0 model-page transition is reviewed. If the 2.5 pages own
the successor intent and the 2.0 pages continue to generate negligible clicks,
the one-hop permanent mapping becomes:

- `/models/ltx-2` to `/models/ltx-2-5-pro`;
- `/models/ltx-2-fast` to `/models/ltx-2-5-fast`;
- localized equivalents to their same-locale successor.

Any permanent redirect must be server-side, one-to-one, relevant, chain-free,
and retained for at least one year. The new destination must be live,
self-canonical, internally linked, and present in the sitemap before the old
URL leaves it.

### LTX family examples

`/examples/ltx` remains the stable family hub and keeps its URL. Its order is:

1. LTX 2.5 Pro examples;
2. LTX 2.5 Fast examples;
3. a clear 2.5-versus-2.3 upgrade explanation;
4. preserved LTX 2.3 examples and prompting content;
5. a compact historical 2.0 note when useful.

Existing 2.3 videos are not relabeled as 2.5 and are not removed merely because
2.5 launches.

## Wan lifecycle and SEO design

The same Search Console comparison showed 3,369 Wan-query impressions versus
2,813, but only 13 clicks versus 16 and a position decline from 11 to 17.7.
Wan 3-specific queries represented only 39 impressions and zero clicks.

The launch policy is therefore:

- Wan 3 and Wan 3 Prime are current;
- Wan 2.6 is legacy, remains executable, and acts as the production fallback;
- Wan 2.5 is deep legacy and leaves default product discovery;
- no Wan model route receives an immediate permanent redirect;
- `/examples/wan` remains the family hub, presents Wan 3 first, and preserves
  correctly labeled older examples below it;
- Wan redirects are reconsidered only after Wan 3 has an indexed page,
  accepted examples, stable runtime telemetry, and at least one 28-day Search
  Console comparison window.

This also avoids removing the fallback while the standard Wan 3 enterprise
availability signal remains less mature than Wan 3 Prime.

## Engine and provider-request design

The seven models are added as dedicated raw Fal engine modules and registered
through the existing aggregator. Shared schema primitives should be reused,
but model-specific provider fields must be preserved by small tested adapters.

### Required special projections

- Grok reference-to-video sends `reference_image_urls`. The generic
  `image_urls` mapping is not valid for this endpoint.
- FLUX first/last-frame mode sends `start_image_url` and `end_image_url`. The
  generic `first_frame_url` projection is not valid for this endpoint.
- LTX audio-to-video uses the canonical `a2v` workflow and a required private
  source-audio asset. It must not be represented as an optional audio toggle on
  text-to-video.
- Wan reference-to-video uses its exact provider reference fields and limits.
- Draft and non-Draft FLUX variants share helpers only where their endpoint,
  input, output, and pricing facts are truly identical.

Targeted tests assert the complete provider request for every mode and the
absence of unsupported or synthetic fields. Required references, duration,
resolution, aspect ratio, reference count, media kind, and trusted metadata
are validated before billing.

## Pricing and billing design

The audited Fal base-rate facts are implementation inputs, not marketing copy:

| Model | Audited provider pricing shape |
| --- | --- |
| Wan 3 | USD 0.05/s at 480p, 0.10/s at 720p, 0.20/s at 1080p |
| Wan 3 Prime | USD 0.068/s at 480p, 0.14/s at 720p, 0.28/s at 1080p |
| LTX 2.5 Fast | resolution-dependent per-second rates from USD 0.09 through USD 0.30 |
| LTX 2.5 Pro | resolution-dependent per-second rates starting at USD 0.12 and USD 0.17 for the currently documented tiers |
| Grok Imagine Video 1.5 | USD 0.08/s, 0.14/s, or 0.25/s by resolution, plus USD 0.01 per reference image when applicable |
| FLUX 3 Video | USD 0.17/s or 0.29/s by resolution; extend is priced separately |
| FLUX 3 Video Draft | USD 0.06/s for the audited 720p route; extend is priced separately |

Every value is re-read from the live endpoint before implementation. Exact
provider facts flow through the canonical pricing engine. Localized content
must not hard-code customer-facing totals.

Grok reference-image count and FLUX extend duration/context must reach both the
billing and public factual-pricing adapters. Required tests prove equivalence
between wallet preflight, MCP exact quotes, receipts, pricing-page projections,
and model-page estimates for the same normalized request.

The pricing hub is not treated as an automatic side effect of catalog
publication. Its authored display order, family order, highlight eligibility,
and previous-generation grouping must be updated explicitly. Current P0
variants appear before legacy variants within their family. LTX 2.3 and Wan
2.6 are labeled as previous-generation choices, while LTX 2.0 and Wan 2.5 are
excluded from the current pricing grid. The page's links, anchors, scenario
quotes, cheapest-state calculations, and Product/Offer JSON-LD continue to
consume the canonical public quote instead of authored totals.

`/pay-as-you-go-ai-video-generator` is a separate decision and acquisition
surface, not a duplicate of `/pricing`. Its supported-model list, preferred
family rows, price lookups, example-cost cards, comparison allowlist, and
English, French, and Spanish copy must be refreshed so it recommends current
P0 representatives without erasing still-useful legacy context.

## Marketing page design

Each of the seven identities receives complete English, French, and Spanish
model content, for twenty-one reviewed localized files. Content uses the
existing `decision`, `prompting`, and `examples` contracts and passes locale
parity and localized-link checks.

Every page includes:

- a precise current/legacy family position;
- supported workflows and exact constraints;
- pricing scenarios derived from the canonical calculator;
- a decision section explaining best-fit and non-fit use cases;
- official-source-backed prompting advice;
- two accepted launch examples;
- relevant family and competitor comparisons;
- canonical, hreflang, JSON-LD, sitemap, and internal-link coverage.

Grok and FLUX receive family names, family summaries, navigation behavior,
logos/brand attribution where licensed, and provider entries for xAI and Black
Forest Labs. Marketing copy must distinguish provider ownership from Fal
distribution and must not imply a direct xAI or Black Forest account
relationship when execution is through Fal.

No page may claim benchmark superiority, native audio, resolution, reference
support, speed, or cost without a corresponding source or generated fact.

## Discovery and propagation matrix

The seven model pages are necessary but not sufficient. Publication requires
an explicit update or an explicit evidence-backed decision for every manual
discovery owner below:

| Surface | Required P0 behavior |
| --- | --- |
| Homepage | Refresh current-example priorities and featured engine mappings only with accepted P0 assets; do not surface an empty or prelaunch family. |
| Models catalogue | Add family mappings, top-pick/recommended eligibility, use-case cards, popular comparisons, and lifecycle-aware current/legacy presentation. |
| Pricing hub | Add all executable P0 rows, exact canonical scenarios, explicit family/model order, and lifecycle grouping. |
| Pay-as-you-go hub | Add current P0 representatives to supported models, price lookups, example-cost cards, comparison links, and localized decision copy. |
| Examples hub | Add Grok and FLUX family cards, refresh promoted models/comparisons, and preserve the stable LTX and Wan family URLs. |
| Family examples | Lead LTX with 2.5 and Wan with 3; create complete Grok and FLUX family pages; retain truthful historical labels and assets. |
| Header and footer | Add one current representative for each new or upgraded family without listing every variant; remove deep-legacy models from current navigation. |
| Compare hub | Add the eight P0 routes to popular/use-case/opponent ownership where relevant and keep older indexed comparisons available outside current recommendations. |
| Best-for guides | Update only guides supported by live capability facts and accepted examples; never mass-insert every model into every guide. |
| `llms.txt` | Promote current P0 engines and primary comparisons; retain legacy LTX context in an explicitly historical role rather than as a current recommendation. |
| Brand/provider surfaces | Add xAI and Black Forest Labs attribution and licensed assets; update Wan and Lightricks engine membership. |
| Agent guidance | Add model-selection and prompting sources for app and MCP recommendations without creating a second catalog. |
| SEO cockpit | Add Grok and FLUX family classification so Search Console queries, opportunities, and post-launch monitoring are not reported as `Other`. |

The main model dropdown promotes exactly one P0 representative per family:
`ltx-2-5-pro`, `wan-3-prime`, `grok-imagine-video-1-5`, and `flux-3`.
Fast, Draft, and sibling variants remain discoverable through the models hub,
family page, pricing page, and comparison routes. This keeps the menu curated
while giving every identity multiple crawlable entry points.

Homepage promotion is evidence-gated. A P0 family may enter the homepage
example priority only after it has an accepted, durable asset. The homepage
does not need to display all seven variants simultaneously, but its authored
priority and default-family maps must be reviewed and tested in the launch
change rather than left stale accidentally.

## SEO and internal-link design

Existing URL ownership is preserved. The release does not rename the stable
`/examples/ltx` or `/examples/wan` hubs, does not replace LTX 2.3 canonicals,
and does not delete existing comparison or watch-page identities merely
because a newer generation exists.

Each new model page must receive crawlable inbound links from:

- `/models`;
- its family examples page;
- its `/pricing` row;
- at least one primary comparison or evidence-backed best-for guide.

Each new model page must contain contextual links to its family examples,
pricing anchor, workspace generation path, successor or sibling variant when
relevant, and primary comparisons. Excluding persistent navigation and the
generation CTA, each model page contains two to four unique contextual
editorial links. Family/category pages link to every current child model and
place legacy children in a separately labeled history or previous-generation
section. No new indexable page may be orphaned, and no all-to-all model linking
is introduced merely to increase link count.

Localized model pages target at least 400 words of useful on-page copy with at
least 80 percent page-specific content. New Grok and FLUX family pages target
at least 400 words of unique family-level copy in each locale. Titles and meta
descriptions remain unique by locale and generation; legacy pages retain their
version-specific search intent instead of copying the successor page.

The localized model, family-example, comparison, and relevant best-for routes
must emit self-canonicals and reciprocal hreflang. New model routes enter the
localized and model sitemaps only after their three locale files pass content
validation. New comparison routes enter the sitemap only when their localized
indexation policy and scoreboard are complete. Manual sitemap timestamps are
updated for every materially changed acquisition route.

`llms.txt` is refreshed in the same release so assistants see current engine
pages, current family examples, and the primary P0 comparisons. It must not
describe LTX 2.3, Wan 2.6, or deep-legacy models as current recommendations.

## Video search and example indexation

All fourteen accepted videos appear on their model pages and the matching
family playlists. Individual watch-page indexation remains quality-gated:

- at least one accepted asset per P0 model is prepared as a watch-page
  candidate;
- a watch page enters `sitemap-video.xml` and
  `sitemap-video-pages.xml` only after editorial approval;
- approval requires a durable public video URL, durable thumbnail, truthful
  model and mode identity, a unique title/H1/description, sufficient prompt
  context, valid canonical state, and internal-link targets;
- a weak candidate remains accessible through the model/family gallery but is
  not forced into the video sitemap.

Existing LTX 2.3 and Wan historical watch pages keep their original engine
labels, canonicals, and publication dates. The launch never relabels an older
video as a P0 output.

## SEO baseline and post-launch monitoring

The P0 branch may not publish on top of a known failing SEO baseline. The
2026-09-01 pre-plan check recorded:

- canonical SEO guard: passing;
- `llms.txt` guard: passing;
- public-media-origin guard: passing across 1,630 scanned references;
- French and Spanish message-key parity: passing;
- internal-link guard: failing because
  `frontend/lib/analytics/journey.ts` contains an unexpected `/company`
  reference.

The existing internal-link failure is corrected and committed separately
before feature publication. Final acceptance requires the complete SEO guard
suite to be green, not merely unchanged from the baseline.

Search Console monitoring is recorded at launch and after 7, 14, and 28 days
for the LTX, Wan, Grok, and FLUX families. The report separates model, examples,
comparison, pricing, and generic-query intent. No LTX 2.0 or Wan redirect is
activated before the destination has been indexed and at least one stable
28-day window has been reviewed.

## Launch example pack

### Quantity and reuse

The release gate is fourteen accepted videos: exactly two initial accepted
assets per model unless a rejected output requires a separately approved retry.
Each accepted asset may be reused on:

- its model page;
- the relevant stable family example page;
- an individual indexable video detail page when it meets the existing
  editorial threshold;
- social or launch content after separate curation.

Comparison pages do not embed these clips in a side-by-side showdown.

### Coverage pattern

Where the live model contract supports both modes, each model receives:

1. one text-to-video example focused on motion, physical coherence, camera
   control, and visual fidelity;
2. one image-to-video example focused on source fidelity, anatomy, temporal
   consistency, and controllability.

If a model's live contract makes that pair impossible, the second example uses
the most representative supported mode and the page states the mode truthfully.
LTX audio-to-video and reference-heavy modes are supported product capabilities
but are not additional P0 generation requirements.

The prompts use two shared evaluation briefs with small syntax adaptations only
where the provider requires them. They avoid public figures, copyrighted
characters, recognizable brands, generated logos, and essential on-screen
text. Output uses 16:9 and 720p where supported, with the lowest practical
duration of at least five seconds allowed by each live contract. Any deviation
is recorded in the launch packet and reflected in score interpretation.

### Acceptance and stop-loss

An accepted video must have a readable opening, stable subject identity,
coherent motion, no major anatomy or geometry failure, no unintended text or
watermark, and a stable final beat suitable for the model page.

Before generation, the complete fourteen-video project receives a comparable
budget estimate. Every paid attempt then uses an exact short-lived quote and
explicit user approval. One initial attempt per asset is the default. A failed
or rejected creative retry requires a new quote and new approval; retries are
never automatic.

No model is publicly published until both accepted assets are durable in the
MaxVideoAI library and attached to the correct playlist.

## Scoreboard and comparison design

### Score ownership

`data/benchmarks/engine-scores.v1.json` remains the owner of the eleven public
editorial criteria. `engine-key-specs.v1.json` owns comparable model facts. The
overall score remains the one-decimal arithmetic mean of fidelity, motion, and
consistency.

The fourteen launch videos are reviewed with the same rubric and prompt-family
context. Official limits and observable capability facts inform
controllability, pricing, and unavailable-mode interpretation. Scores are
editorial comparisons, not claims of a statistically significant laboratory
benchmark.

Initial calibration priors, to be confirmed or adjusted after reviewing the
accepted assets, are:

| Model | Initial overall prior |
| --- | ---: |
| Wan 3 | 8.1 |
| Wan 3 Prime | 8.5 |
| LTX 2.5 Fast | 7.9 |
| LTX 2.5 Pro | 8.4 |
| Grok Imagine Video 1.5 | 8.3 |
| FLUX 3 Video | 8.6 |
| FLUX 3 Video Draft | 7.7 |

These are not published placeholders. Final values for fidelity, motion,
consistency, anatomy, text rendering, lip-sync quality, sequencing,
controllability, speed/stability, visual quality, and pricing are authored only
after the real output review. Every cell must be numeric before publication,
and each final overall value must match the repository formula.

### P0 comparison set

The initial scoreboard-only comparison set is:

- LTX 2.5 Pro vs LTX 2.3 Pro;
- LTX 2.5 Fast vs LTX 2.3 Fast;
- LTX 2.5 Pro vs LTX 2.5 Fast;
- Wan 3 vs Wan 2.6;
- Wan 3 Prime vs Wan 3;
- FLUX 3 Video vs FLUX 3 Video Draft;
- Grok Imagine Video 1.5 vs Sora 2;
- Grok Imagine Video 1.5 vs FLUX 3 Video.

Additional pairs are published only when they have a distinct search or
decision intent. The registry does not generate a combinatorial P0 comparison
matrix.

Every listed pair is added to `scoreboardOnlyComparisons`. It receives complete
scores, key specs, localized title/decision copy where the route requires it,
canonical/hreflang behavior, and suggested-opponent relationships. It receives
no `showdown` playlist and no side-by-side media placeholder.

## MCP design

The MCP remains a projection of the canonical app model registry and authored
engine schemas. The P0 work must not add a second hand-maintained MCP catalog.

For current models:

- `list_models` exposes the model, family, modes, lifecycle, pricing shape, and
  generation readiness;
- `get_model_details` returns exact required references and constraints;
- `recommend_models` may recommend the model only when it is executable and
  compatible with the requested workflow;
- project budgeting and exact quotes use the same canonical pricing facts as
  the app;
- prepare and confirm use the same mode validation and provider adapter as
  normal workspace generation.

For lifecycle behavior:

- current models are normal recommendation candidates;
- legacy models remain discoverable by exact identity and executable, but are
  excluded from default recommendations when their successor fits;
- deep-legacy models are absent from default discovery and recommendations;
- an exact deep-legacy identifier returns an actionable successor/deprecation
  result rather than silently changing the requested model;
- historical job and receipt reads retain the original model identity.

MCP tests cover catalog projection, exact details, recommendations, mode
coverage, generation capabilities, executability, lifecycle filtering,
pricing, and the Grok/FLUX provider-body adapters. The public mode-parity guard
must have no unexplained exclusions.

## Publication and rollout gates

The implementation may be developed incrementally, but public publication is
atomic at the model level and complete across product surfaces.

### Gate 1: canonical model and runtime

- registry identities, aliases, families, variants, lifecycle, and publication;
- exact Fal engine schemas and provider request adapters;
- validation, pricing, billing, receipt, and refund parity;
- generated projections regenerated and clean.

### Gate 2: app and MCP parity

- every advertised mode is selectable and locally valid;
- every selected request serializes to the exact provider endpoint;
- app and MCP expose the same constraints and price;
- legacy and deep-legacy behavior is consistent across both surfaces.

### Gate 3: public content

- twenty-one localized model content files pass schema and link checks;
- new Grok and FLUX family discovery is complete;
- family examples preserve historical assets and prioritize current models;
- canonical, hreflang, JSON-LD, sitemap, pricing, and internal links are valid.

### Gate 4: evidence and comparisons

- fourteen accepted videos are durable and attached to the correct playlists;
- all seven score records and key-spec rows are complete;
- every P0 comparison page renders a complete scoreboard;
- all P0 comparison pages are explicitly scoreboard-only;
- no empty or fabricated showdown media exists.

### Gate 5: final verification

- focused provider, adapter, pricing, registry, MCP, marketing, example,
  scoreboard, comparison, SEO, sitemap, and lifecycle tests pass;
- `pnpm model:registry:check` passes;
- architecture and MCP parity contracts pass;
- frontend lint, exposure lint, TypeScript/build checks, and `git diff --check`
  pass in proportion to the touched surface;
- the seven model pages, four family example states, and eight primary compare
  routes receive a local smoke test;
- the final live provider contract and prices are rechecked before any paid
  generation or deployment.

## Failure handling and rollback

- A provider endpoint that becomes unavailable fails closed and is not
  advertised as executable.
- A pricing mismatch blocks quote creation rather than using a stale fallback.
- A failed paid generation follows the existing receipt/refund owner and never
  retries automatically.
- A model with fewer than two accepted examples remains unpublished even if its
  runtime integration is technically ready.
- A comparison with incomplete score data remains unpublished rather than
  displaying blanks.
- A lifecycle projection mismatch blocks registry generation.
- Public rollback disables the affected current model consistently across app,
  marketing publication, sitemap, recommendations, and MCP execution while
  retaining historical jobs and receipts.

## Non-goals

- No FLUX keyframes or draft-enhance workflow in P0.
- No public face-to-face comparison videos.
- No automatic generation retries or unbounded example budget.
- No direct-provider credential integration solely to bypass Fal when the live
  Fal route is active and contract-complete.
- No blanket redirect of every old LTX or Wan URL.
- No deletion or relabeling of historical example videos.
- No combinatorial publication of every possible comparison pair.
- No invented benchmark, latency, or superiority claim before evidence exists.

## Success criteria

The launch succeeds when a user can discover, understand, price, and execute
each current P0 model consistently in the website, workspace, and MCP; every
model page already shows two truthful examples; every published compare page
shows a complete scoreboard without side-by-side video; Grok and FLUX behave as
real families; and the LTX/Wan lifecycle transition preserves valuable search
intent without presenting superseded models as current.
