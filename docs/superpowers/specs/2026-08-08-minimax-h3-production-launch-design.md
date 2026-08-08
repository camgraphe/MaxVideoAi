# MiniMax H3 production launch design

**Date:** 2026-08-08

**Status:** approved

**Owner:** MaxVideoAI product owner

## Objective

Integrate MiniMax H3 into MaxVideoAI as a complete, public, production-ready
model launch. H3 becomes the current and default model in the Hailuo family,
while MiniMax Hailuo 02 remains published as a secondary budget model.

The release must ship as one finished public product. There is no hidden engine,
administrator-only phase, presentation-only page, staged indexation state, or
production canary deployment. The only paid pre-production generations are two
character-led videos that also become the official model-page marketing assets.
Additional production generations happen after launch and are not a release
gate.

The launch includes the generation runtime, unified workspace experience,
pricing, localized model pages, Hailuo family discovery, examples, Benchmark Lab
and fully populated scoreboard data for H3 and Seedance 2.5, three localized VS
pages, internal linking, sitemap output, and indexation readiness.

## Approved decisions

- Canonical product ID and public slug: `minimax-h3`.
- Product family: `hailuo`.
- H3 is the family's `current` model and default route target.
- Hailuo 02 remains published, indexable, selectable, and priced as a secondary
  family member.
- One engine card exposes three workflows: text-to-video, image-to-video, and
  reference-to-video.
- H3 audio is native and always part of the generated video. MaxVideoAI does not
  expose an audio toggle and does not send a synthetic `generate_audio` field.
- There is no database migration and no new admin UI.
- Provider identity, limits, and pricing remain code-owned and versioned through
  the existing engine registry and canonical pricing architecture.
- All public launch surfaces are complete before the production deploy.
- The two paid launch generations use original adult characters, not products,
  packshots, public figures, copyrighted characters, or recognizable brands.
- The release publishes three primary comparison pages: H3 vs Seedance 2.5, H3
  vs Kling O3 Pro, and H3 vs Veo 3.1.
- The public benchmark hierarchy is Seedance 2.5 at 9.1, Kling O3 Pro at 8.6,
  then MiniMax H3 very slightly below at 8.5.
- H3 and Seedance 2.5 expose a numeric value for every one of the eleven public
  scoreboard criteria. Public pages present these as the normal MaxVideoAI
  editorial scores without provisional labels, sample-size warnings, launch
  disclaimers, or empty cells.

## Source contract

The execution contract is the current fal.ai H3 API, checked again immediately
before implementation and immediately before the two paid generations:

- overview: <https://fal.ai/minimax-h3>
- text-to-video: <https://fal.ai/models/minimax/h3/text-to-video/api>
- image-to-video: <https://fal.ai/models/minimax/h3/image-to-video/api>
- reference-to-video: <https://fal.ai/models/minimax/h3/reference-to-video/api>
- MiniMax launch article: <https://minimaxi.com/blog/minimax-h3>

The approved contract on 2026-08-08 is:

| Concern | Contract |
| --- | --- |
| Text endpoint | `minimax/h3/text-to-video` |
| Image endpoint | `minimax/h3/image-to-video` |
| Reference endpoint | `minimax/h3/reference-to-video` |
| Output duration | Every integer second from 5 through 15 |
| Frame rate | 24 FPS |
| Resolutions | `768P`, `2K`, `4K`; default `2K` |
| Fixed aspect ratios | `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16` |
| Reference aspect mode | Provider value `adaptive`; MaxVideoAI label `Auto` |
| Prompt limit | 7,000 characters |
| Audio | Native stereo output; no request toggle |
| Text input | Prompt, duration, resolution, aspect ratio |
| Image input | Prompt, duration, resolution, required start image, optional end image; aspect follows source |
| Reference input | Prompt, duration, resolution, aspect ratio, image/video/audio reference arrays |
| Reference images | Up to 9 |
| Reference videos | Up to 3; each 2–15 seconds; 15 seconds combined |
| Reference audios | Up to 3; each 2–15 seconds; 15 seconds combined |
| Total references | Up to 12 unique references |
| Audio-only reference request | Invalid; at least one image or video is required |
| Provider base rate | USD 0.08/s at 768P, USD 0.13/s at 2K, USD 0.16/s at 4K |
| Reference-image surcharge | First five images included; USD 0.08 for each additional image |

Fal is a new and actively changing integration. If an official endpoint, schema,
limit, or price differs at the final source check, the implementation and tests
must be updated to the new official fact before any paid request or deployment.
The design does not authorize silently retaining stale values.

## Chosen architecture

### Alternatives considered

1. A configuration-only engine addition is rejected. The current generic Fal
   serializer rewrites reference field names in `ref2v`, resolves `auto` to a
   fixed ratio, and may send `generate_audio`. It also cannot represent H3's
   per-image surcharge accurately.
2. A dedicated H3 integration with small schema-driven improvements is chosen.
   It keeps one product identity, uses the existing engine/input schemas, and
   introduces narrowly scoped provider mapping, validation, workspace, and
   pricing changes.
3. A general rewrite of every multimodal workflow is rejected for this launch.
   It would create unnecessary release risk and mix H3 delivery with unrelated
   model migrations.

### Ownership boundaries

- `frontend/config/model-registry.json` owns H3 identity, family membership,
  aliases, publication, comparison relationships, app discovery, and sitemap
  policy.
- A new raw Fal engine module owns H3 capabilities, input schema, provider
  endpoints, UI notes, provider-cost facts, and marketing registry metadata.
- The Fal request builder owns provider-specific request projection.
- API validation owns prompt, mode, reference, duration, format, size, and
  reference-budget enforcement before billing or provider submission.
- The canonical pricing engine owns the customer quote. The H3 pricing helper
  supplies exact provider facts, including reference-image count.
- Localized JSON under `content/models/{locale}/minimax-h3.json` owns model-page
  editorial content.
- Localized comparison documents under `content/comparisons/` own the three VS
  page editorial decisions.
- Benchmark JSON owns public specification and evaluated score data.
- Existing model-page, comparison, examples, pricing, sitemap, and navigation
  builders render those authorities. No H3-only route or page component is
  introduced unless the existing template contract cannot express an approved
  requirement.

## Engine and workspace design

### Unified engine

The engine uses `minimax-h3` for every public and stored MaxVideoAI identity.
Provider endpoint selection is mode-specific:

| MaxVideoAI mode | Fal endpoint | Visible controls |
| --- | --- | --- |
| `t2v` | `minimax/h3/text-to-video` | Prompt, 5–15 s, 768P/2K/4K, six fixed ratios |
| `i2v` | `minimax/h3/image-to-video` | Prompt, start image, optional end image, 5–15 s, 768P/2K/4K |
| `ref2v` | `minimax/h3/reference-to-video` | Prompt, reference images/videos/audios, 5–15 s, 768P/2K/4K, Auto plus six fixed ratios |

The engine advertises 24 FPS and native stereo audio. It does not advertise an
audio pricing toggle, optional audio, motion-control widgets, keyframes, or
unsupported editing modes.

The workspace remains schema-driven. H3 must not be disguised as Seedance or
added to Seedance-specific helpers. The shared reference workflow is extended
only enough to express these generic rules:

- reference-to-video can start from an image, a video, or both;
- audio can accompany visual reference media but cannot be the only reference;
- the active mode resolves to `ref2v` when H3 reference image, video, or audio
  fields are populated;
- H3 video-only reference input is accepted;
- the composer explains that audio is generated natively rather than presenting
  an on/off control;
- image-to-video uses one required start image and one optional end image;
- the upload UI displays per-field count, format, size, and duration limits.

### Provider request projection

The request adapter must preserve H3's exact provider field names:

- `reference_image_urls`
- `reference_video_urls`
- `reference_audio_urls`

It must not project those fields to generic `image_urls`, `video_urls`, or
`audio_urls` for H3. It must also:

- omit `aspect_ratio` entirely in image-to-video;
- map the MaxVideoAI `auto` selection to provider value `adaptive` only for H3
  reference-to-video;
- send fixed H3 aspect ratios unchanged in text/reference modes;
- omit `generate_audio` and `audio` boolean fields in all modes;
- preserve `image_url` and optional `end_image_url` in image-to-video;
- preserve the integer duration and provider resolution casing;
- select exactly one of the three H3 endpoints from the active mode;
- keep attachment slot provenance so validation and provider serialization use
  the same fields.

Targeted adapter tests must assert the complete provider body for each mode and
assert the absence of every unsupported field.

## Validation design

Validation happens before billing. H3 must fail locally with a precise field
error rather than spending money on a provider rejection.

### Request constraints

- Prompt is required in all three modes and is limited to 7,000 characters.
- Duration accepts only the integers 5 through 15.
- Resolution accepts only `768P`, `2K`, and `4K`.
- Text mode accepts the six documented fixed ratios.
- Image mode rejects or omits a client-supplied aspect ratio.
- Reference mode accepts `auto` plus the six fixed ratios.
- Image mode requires exactly one start image and accepts at most one end image.
- Reference mode accepts at most 9 images, 3 videos, and 3 audios.
- Reference mode accepts at most 12 unique references across all active fields.
- Reference audio requires at least one reference image or video.
- Video-only reference mode is valid.

### Media constraints

MaxVideoAI enforces the provider limits exposed in the engine input schema:

- image: 30 MB maximum;
- video: 50 MB maximum, 2–15 seconds each, 15 seconds combined;
- audio: 15 MB maximum, 2–15 seconds each, 15 seconds combined.

The accepted upload formats must be the intersection of the current Fal
contract and formats that MaxVideoAI can verify and persist safely. The launch
does not broaden generic upload formats based on assumptions.

The existing trusted-metadata validation is generalized so its messages and
logic work for image, video, and audio fields rather than describing every
failure as an audio failure. Managed uploads use stored owner-scoped metadata.
Existing allowlisted remote-image behavior remains intact. Video/audio
duration-bound references require trustworthy duration metadata; missing or
unverifiable metadata fails before billing.

Field-level and combined-duration tests cover exact boundaries, one-unit
overflow, duplicate URL handling, media-kind mismatches, unsupported fields,
and unverified metadata.

## Pricing and billing design

The exact provider subtotal is:

```text
base = duration_seconds × resolution_rate
extra_images = max(0, reference_image_count - 5)
provider_subtotal = base + (extra_images × USD 0.08)
```

Resolution rates are 8, 13, and 16 cents per second for 768P, 2K, and 4K.
Native audio has no separate addon. Image-to-video end frames, reference video,
and reference audio receive no surcharge unless current official Fal pricing
adds one before implementation.

The generation billing preflight receives the normalized H3 reference-image
count. Billing and public pricing use one H3 factual calculator so the wallet
quote, receipt, estimator, pricing page, model-page presets, shadow audit, and
public projections cannot drift.

The provider subtotal is passed through the existing canonical MaxVideoAI
pricing policy, including the current global margin and membership rules. No
hard-coded customer-facing dollar amount is authored in localized content.
Receipts record duration, resolution, reference-image count, included image
count, paid extra-image count, provider fact source, and the resulting cost
breakdown.

Required pricing cases include every resolution, 5 and 15 seconds, zero/five/six
and nine reference images, every mode, membership projections, and billing vs
public equivalence where the contexts are equivalent.

## Model registry and Hailuo family

The authored registry adds `minimax-h3` as a fully published video model:

- model page published and indexable;
- examples published, included in Hailuo family copy, `current: true`, family
  rank 0;
- app published with a discovery rank ahead of Hailuo 02;
- pricing published;
- comparison published and indexed;
- sitemap published.

Hailuo 02 changes only its family position:

- remains published on every existing surface;
- `current` becomes false;
- family rank becomes 1;
- its app label/links continue to identify Hailuo 02 accurately;
- it gains a crawlable route to the H3 model page as the current Hailuo option.

The Hailuo family definition changes its default model to `minimax-h3`, nav
label to `MiniMax H3`, and adds H3/Hailuo 03 aliases and provider prefixes while
preserving all existing Hailuo 02 aliases.

Generated runtime, catalog, roster, and docs projections are regenerated only
through the documented model-registry commands. They are never edited by hand.

## Marketing asset design

### Research basis

MiniMax's official launch article describes native multi-shot generation,
native stereo audio, and natural-language relationships between reference
media and the target video. Current H3 community examples consistently use
explicit subject definitions, repeated identity details, chronological shot
descriptions, retention instructions, and separate soundscape directions:

- <https://minimaxi.com/blog/minimax-h3>
- <https://www.reddit.com/r/StableDiffusion/comments/1vgf6qx/assemble_the_multiverse_minimax_h3_r2v_is_awesome/>
- <https://www.reddit.com/r/StableDiffusion/comments/1vf7vrl/nothing_fancy_just_character_replacement_with/>

The launch prompts use those structural lessons without copying a published
creative concept, named character, dialogue, or proprietary visual identity.
They aim for 2,500–5,500 characters, remain under the official 7,000-character
limit, and use original adult characters.

Each production prompt includes:

1. subject definitions and immutable identity/wardrobe details;
2. a concise target-video summary;
3. chronological, time-bounded shot descriptions;
4. explicit camera, lighting, physical-action, and ending-state directions;
5. reference-retention instructions where relevant;
6. dialogue attribution and an overall stereo soundscape;
7. constraints against text, logos, watermarks, subtitles, identity swaps,
   malformed anatomy, and unrelated objects.

### Video A — The lighthouse messenger

**Workflow:** text-to-video

**Settings:** 15 seconds, 2K, 16:9, native stereo audio

**Purpose:** show character performance, physical movement, weather, camera
language, multi-shot continuity, dialogue, and stereo sound.

An original adult woman in a rust-red storm coat climbs a lighthouse spiral
staircase during a coastal storm, reaches the lantern room, activates a rescue
signal, and delivers one short original line. The prompt keeps her face,
wardrobe, brass signal device, and direction of movement stable across a small
number of deliberate shots. Wind, rain, footsteps, machinery, distant surf,
and dialogue are positioned in the stereo soundscape.

Acceptance requires stable identity and anatomy, coherent stair movement,
readable cause and effect, restrained multi-shot editing, intelligible dialogue,
useful first-frame impact, a clean final composition, and no generated text,
logo, watermark, public figure, or recognizable franchise design.

### Video B — The cartographers' last train

**Workflow:** reference-to-video

**Settings:** 15 seconds, 4K, 16:9, native stereo audio

**Purpose:** show reference-led identity preservation, two-character blocking,
object handoff, motion, atmosphere, and audio conditioning.

Two original adult cartographers meet on a rain-slick night platform, exchange
a folded hand-drawn map, hear the last-train announcement, and run together
toward the arriving train. Original, owned character references define their
distinct faces, proportions, coats, and accessories. An owned audio reference
defines station ambience and voice character without introducing protected
music or a recognizable performer.

The prompt uses explicit `<Subject>` and `<Picture>` relationships and repeats
the identity contract at every relevant shot. Acceptance requires distinct and
stable identities, correct map handoff, believable hand contact, consistent
wardrobe, coherent direction of travel, intelligible native audio, a clean
ending, and no product focus, brand, subtitle, logo, watermark, or identity
swap.

### Generation policy

- These are the only two paid pre-production H3 generation requests authorized
  by this design.
- They run through the implemented MaxVideoAI request builder, validation,
  billing preflight, provider submission, polling, durable-storage, and receipt
  paths connected to real Fal endpoints. A provider-console shortcut would not
  validate the product integration.
- They run before the public production deployment, through the local launch
  environment. There is no hidden production engine or public incomplete page.
- There is one planned take per concept and no automatic content variation or
  retry. An additional paid request requires explicit product-owner approval.
- A technical failure is reconciled normally and does not silently authorize a
  third request.
- Current expected provider cost is USD 1.95 for the 15-second 2K clip and USD
  2.40 for the 15-second 4K clip, plus any official reference surcharge that
  applies to the final selected inputs. The expected base total is USD 4.35.
- The exact MaxVideoAI quote and provider basis are recorded before submission.
- Every accepted asset receives a durable MaxVideoAI URL, poster, title,
  localized description, prompt disclosure, accessibility text, and provenance
  entry. No signed provider URL or private identifier is committed.
- Full-video review, frame sampling, `ffprobe` metadata, stereo-stream presence,
  storage durability, receipt, and download-range behavior are verified before
  the assets are accepted.

The strongest accepted clip becomes the model-page hero media. Both clips
appear in the model examples section and the Hailuo examples family page. Their
prompts become reproducible Prompt Lab examples in English, French, and Spanish
editorial context while the executable provider prompt remains in English.

## Localized model page

The H3 model page uses the existing production model template and is complete
in English, French, and Spanish. It includes:

- accurate metadata, canonical, reciprocal hreflang, Open Graph media, and
  complete commercial structured data;
- primary CTA to `/app?engine=minimax-h3`;
- Hailuo examples CTA;
- quick links to the primary H3 vs Seedance 2.5 page, live pricing, and Prompt
  Lab;
- pricing presets for entry 768P, common 2K, flagship 4K, and maximum duration;
- the two accepted character-led videos and localized supporting copy;
- workflow descriptions for text, start/end image, and multimodal reference;
- native-audio, reference-limit, duration, resolution, and aspect-ratio facts;
- decision scenarios, prompt examples, production tips, limitations, safety,
  FAQs, comparison section, specs, and source-backed update date;
- no rollout, provider-routing, admin, canary, or infrastructure language.

The page never claims that H3 was evaluated on more outputs than were actually
reviewed and never presents Hailuo 02 media as H3 output.

## Comparison pages

The three launch comparisons are:

1. `minimax-h3-vs-seedance-2-5` — unified multimodal references, native audio,
   duration, resolution, and production workflow.
2. `kling-o3-pro-vs-minimax-h3` — character/reference control, motion, quality,
   audio, and pricing position.
3. `minimax-h3-vs-veo-3-1` — premium cinematic generation, 4K, native audio,
   multi-shot behavior, and value.

Each pair is published symmetrically in the model registry, exposed in the
comparison hub, and backed by one strict localized content document containing
complete EN/FR/ES projections. Numeric prices are always injected from live
pricing data and never authored in the documents.

These pages use the normal MaxVideoAI scorecard and specification comparison
format. Their localized copy links to the model pages, generation routes,
pricing, methodology, and related comparisons. It does not add provisional,
launch-sample, confidence, or disclaimer copy to the public product surfaces.

The three pairs are included in comparison discovery, related-comparison maps,
appropriate Best For pages, and the indexation matrix. The primary H3 vs
Seedance page is promoted in the model-page quick links and the bounded global
comparison navigation, replacing a lower-priority item rather than expanding
the menu without limit.

## Benchmark Lab and scoreboard

H3 receives a source-backed `engine-key-specs.v1.json` entry covering modes,
duration, output resolutions, ratios, native audio, reference limits, pricing
dimensions, and official source URLs.

`engine-scores.v1.json` receives a complete H3 row and the existing Seedance 2.5
row is completed. The values use the repository's existing
`manual-v1-internet-calibrated-with-platform-pricing` method: official model and
provider material, current public benchmark context, observed platform pricing,
current product contracts, and launch output review inform the editorial
calibration. The source map and reasoning remain internal engineering evidence;
the public scorecards contain only the finished values and the standard global
Benchmark Lab methodology.

The approved launch values are:

| Criterion | MiniMax H3 | Seedance 2.5 |
| --- | ---: | ---: |
| Fidelity | 8.6 | 9.1 |
| Visual quality | 8.5 | 9.2 |
| Motion | 8.4 | 9.2 |
| Consistency | 8.4 | 9.0 |
| Anatomy | 8.1 | 8.9 |
| Text rendering | 8.3 | 8.5 |
| Lip-sync quality | 8.7 | 9.3 |
| Sequencing quality | 8.6 | 9.4 |
| Controllability | 9.0 | 9.0 |
| Speed and stability | 7.6 | 7.7 |
| Pricing/value | 9.7 | 7.2 |

Under the canonical overall formula—arithmetic mean of fidelity, motion, and
consistency rounded to one decimal—H3 is 8.5, Kling O3 Pro remains 8.6, and
Seedance 2.5 remains 9.1. H3 may lead on pricing/value without moving ahead of
either model in the public overall ranking. No H3 or Seedance 2.5 score is
`null`, and no special public disclaimer is introduced.

## Internal linking

The launch creates crawlable, localized links through existing owners:

- H3 model page to generation, Hailuo examples, pricing, Prompt Lab, three VS
  pages, Benchmark Lab, and relevant related models;
- Hailuo 02 model page to H3 as the current Hailuo model;
- Hailuo examples page to H3 first, without relabeling older media;
- models catalog and pricing page to the H3 model and generation route;
- comparison hub, primary comparison navigation, related comparisons, and Best
  For pages to the three H3 pairs;
- Best For placements for cinematic realism, character reference,
  reference-to-video, multi-shot video, 4K video, and lip-sync/dialogue where
  the published contract supports the placement;
- Benchmark Lab spec/score rows back to the H3 model page and official sources;
- model family aliases and canonical selectors to H3 without breaking Hailuo 02
  historical URLs.

No new standalone link registry is introduced. Each link is authored in the
current route/navigation/content owner and protected by existing path-safety,
locale, and publication contracts.

## Indexation and structured data

The final release emits and verifies:

- indexable H3 model URLs for EN, FR, and ES;
- indexable URLs for all three comparison pairs in EN, FR, and ES;
- self-canonical URLs and reciprocal hreflang including `x-default`;
- model-page Product/SoftwareApplication-compatible schema through the existing
  model schema builder, plus breadcrumb and FAQ data where applicable;
- comparison WebPage/Breadcrumb schemas through the existing comparison
  builder;
- sitemap membership exactly once per localized route;
- comparison indexation matrix rows classified for retention;
- no prelaunch/noindex language or stale Hailuo 02 default canonical;
- crawlable internal anchors without `nofollow`.

After deployment, the existing production SEO workflow checks response status,
canonical, hreflang, JSON-LD, sitemap presence, and robots output for every new
localized URL. Search Console inspection/submission may follow through the
existing authenticated operating workflow, but no separate indexing API or new
admin screen is introduced.

## Verification strategy

### Focused contracts

- H3 engine registry and endpoint/mode mapping.
- Complete Fal request bodies for T2V, I2V, and Ref2V.
- Absence of `generate_audio`, image-mode aspect ratio, and renamed reference
  fields.
- Prompt, duration, resolution, aspect, reference count, total budget,
  audio-only, size, format, per-item duration, and combined-duration limits.
- Schema-driven workspace mode selection and generation guards.
- Exact H3 pricing and extra-image surcharge propagation through preflight.
- H3 family default/current behavior with Hailuo 02 retained.
- Model registry projections and authored-source ownership.
- EN/FR/ES model content and production-template completeness.
- Three comparison documents, symmetric publication, discovery, related links,
  and indexation.
- Benchmark specs, complete H3 and Seedance 2.5 score rows, and the approved
  9.1 > 8.6 > 8.5 ordering contract.
- Navigation, examples, pricing, Best For, sitemap, metadata, hreflang, JSON-LD,
  and internal-link contracts.

### Repository gates

At minimum, the final implementation runs:

```bash
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
pnpm model:registry:check
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

It also runs the focused Node test files introduced or updated for H3, the
pricing audit and public projection checks, comparison indexation generation,
the broader repository validation required by current package scripts, and a
production Next.js build.

### Browser and route QA

Before deployment, local browser QA covers:

- all three workspace modes on desktop and mobile;
- all duration/resolution/aspect combinations represented by their boundary and
  default cases;
- start/end image fields and reference image/video/audio slots;
- quote changes between five and six reference images;
- audio-only rejection and video-only reference acceptance;
- model, examples, pricing, benchmark, and three VS routes in EN/FR/ES;
- navigation and family selection;
- canonical, hreflang, schemas, autoplay-muted behavior, posters, and no layout
  shift around the accepted videos;
- console and network errors.

The two paid marketing requests then validate the live Fal submission,
polling, persistence, pricing receipt, durable output, and audio metadata before
their assets are committed. Their review can confirm the editorial calibration
but is not used to leave any public scoreboard cell pending.

## Release sequence

1. Re-read the official H3 and Fal source contract and record any drift.
2. Implement the engine, provider adapter, validation, workspace, and pricing
   paths with focused tests.
3. Add the registry/family state and regenerate every projection.
4. Author complete EN/FR/ES model content, model template, comparison content,
   benchmark specs, the complete H3 and Seedance 2.5 score rows, internal links,
   and indexation configuration.
5. Run focused tests, repository validation, pricing audits, and the production
   build locally.
6. Prepare original character reference/audio assets with documented ownership.
7. Submit exactly the two approved marketing requests through the real local
   MaxVideoAI integration and review them against their acceptance criteria.
8. Record the accepted assets, pricing evidence, technical metadata, and review
   notes. Wire their durable URLs, posters, prompts, and localized copy into the
   final marketing surfaces without provisional public scoring language.
9. Rerun all focused and broad validation, rebuild, and perform final local
   route/browser QA with the real assets.
10. Commit, push, review, and deploy the finished public release once. H3 is
    immediately visible, current, indexable, and selectable in production.
11. Verify production routes, metadata, sitemaps, pricing, workspace selection,
    and asset playback without issuing an additional launch-gating generation.
12. Perform the separately planned post-launch production renders to exercise
    more combinations and fix any discovered issue through the normal release
    process.

There is no production deployment between steps 1 and 9 and no public phase in
which H3 is hidden, incomplete, or noindex.

## Failure and rollback policy

- If either authorized marketing request fails or is rejected, do not invent a
  replacement URL, reuse Hailuo 02 media, or deploy an incomplete page. Reconcile
  the job and ask for explicit approval before spending on another request.
- If source facts drift, update the implementation and re-run affected tests
  before continuing.
- If a pre-deploy gate fails, no production release occurs.
- If the finished deployment fails operational verification, use the existing
  recoverable Vercel rollback/revert workflow. Restore Hailuo 02 as family
  default and remove H3 publication only if the H3 runtime itself is unsafe;
  preserve user jobs and accepted media.
- A rollback never deletes generated assets, receipts, or user data.

## Non-goals

- New admin pricing, model, benchmark, or publication screens.
- A database migration or stored-job ID rewrite.
- A new generic multimodal framework for unrelated engines.
- Product packshots, brand commercials, celebrity likenesses, copyrighted
  characters, or recognizable music in launch media.
- More than two paid pre-production H3 requests without new approval.
- A new public score-confidence system, provisional badge, launch-sample
  disclaimer, or empty H3/Seedance 2.5 scoreboard cell.
- A hidden engine, prelaunch page, waitlist, feature flag, administrator-only
  route, or production canary phase.

## Acceptance criteria

The launch is complete only when:

- `minimax-h3` is one unified engine with all three documented workflows and
  correct Fal bodies;
- every documented control and constraint is represented and validated before
  billing;
- wallet, receipt, public estimator, pricing page, and model-page quotes agree,
  including the sixth-reference-image surcharge;
- H3 is the current/default Hailuo model and Hailuo 02 remains a truthful
  secondary option;
- the two accepted original-character videos play from durable MaxVideoAI URLs
  and their public claims match the generated evidence;
- the localized model pages and three localized VS page sets are complete,
  crawlable, indexable, internally linked, and included in sitemaps;
- Benchmark Lab exposes source-backed H3 specs, all eleven H3 values, and all
  eleven Seedance 2.5 values with no `null` cells or public provisional copy;
- the canonical overall formula renders Seedance 2.5 at 9.1, Kling O3 Pro at
  8.6, and MiniMax H3 at 8.5 on the benchmark, catalog, and VS surfaces;
- no admin UI, migration, hidden production state, or stale generated registry
  file is introduced;
- all focused and repository-wide validation, production build, browser QA, and
  post-deploy route checks pass;
- the final production deployment exposes the complete finished product on its
  first public H3 release.

## Decision record

The product owner approved H3 as the current/default Hailuo model on 2026-08-08,
with Hailuo 02 retained as a secondary published model. The owner approved the
targeted unified-engine architecture, then replaced the proposed hidden
production validation phase with a finished public release. The owner requires
exactly two paid pre-production H3 launch generations, both character-led and
reused as model-page marketing assets, followed by a complete release including
internal linking, Benchmark Lab/scoreboard data, localized VS pages, and
indexation. The owner subsequently required every H3 and Seedance 2.5 scoreboard
cell to be populated without public disclaimer language and fixed H3 at 8.5,
very slightly below Kling O3 Pro at 8.6 and below Seedance 2.5 at 9.1. Additional
production renders occur after launch.
