# Media Delivery Guide

Read this guide when changing image/video presentation, poster URLs, generated media, thumbnail repairs, or public model examples. Keep model identity in `frontend/config/model-registry.json`; media delivery is not another model registry.

For sharing generated videos or public examples, also read `docs/engineering/video-sharing.md`.

## Portrait backdrops on examples pages

`ExamplesMainVideoFeature` keeps its blurred portrait backdrop on the same responsive
Next Image source as `ExamplesHeroVideo`. Both use `EXAMPLES_HERO_POSTER_SIZES` from
`components/examples/hero-poster.ts`; only the foreground poster has high priority.
The backdrop must not request the original through a CSS `background-image`: that
extra request was the LCP bottleneck in the D91 mobile production-build fixture.
The original video/source identity, main poster geometry and manual mobile playback
remain unchanged. Verify matching `currentSrc` and one network transfer for both
images when changing either side; `tests/examples-acquisition-journey.test.ts`
covers the server-rendered URL selection contract.

## Comparison detail galleries

Comparison detail pages load optional public `examples-<modelSlug>` playlists through the route-local `compare-gallery-loader.ts`. `compare-gallery-data.ts` rechecks exact normalized model identity, public visibility, usable poster/original URLs, deduplication and the three-item limit. Prelaunch models skip media lookup; missing media must not break the page or substitute a sibling model. The historical same-prompt showdown configuration remains separate and is not used by this template.

`CompareGalleryCard.client.tsx` owns intent and visibility only, delegating incidental muted previews to `useExampleCardPlayback`. Preserve responsive lazy covers, the configured image quality and fixed geometry. Ordinary activation opens `CompareVideoDialog.client.tsx`, loaded on demand; modified clicks and the underlying HTML link retain the watch-page URL. The modal delegates focus, Escape and restoration to `useAccessibleModal` and full playback to `PublicVideoPlayer`, with original fidelity and `preload="none"`. No automatic playback of all gallery items. Show independent-example labeling; do not imply identical prompts or controlled test conditions.

## Model detail examples

Model routes retain playlist curation, public validation and the shared
`projectModelPageGallery` ordering policy. Their own examples view model and
`ModelDefaultExamplesSection` / `ModelDecisionExamplesGallery` do not consume card
prices, so the route does not quote those media batches. The pure `toGalleryCard`
still accepts supplied current prices, and the shared `ExampleGalleryCard` keeps
its price display for other readers. Visible model specs, decision scenarios and
the current visible/JSON-LD offer retain their canonical pricing owners.
`tests/model-unused-example-pricing.test.ts` executes the real gallery callback
and checks localized video/image consumers with and without card price labels.

The public model route rechecks playlist media membership with `getPublicVideoIds`
in the server videos owner, projecting only IDs with the same public visibility and
nullable-indexable predicate as `getPublicVideosByIds`. It still builds cards from
the original playlist records and hydrates missing featured/preferred records with
the full reader. The shared projection's optional ID reader leaves transaction-bound
admin previews on their existing full-reader fallback; no fresh validation is cached
or replaced by playlist membership. Source/deletion eligibility remains owned by its
existing readers. `tests/public-video-presence-postgres.test.ts` guards this parity.

The active model input owner starts the canonical unit/spec price projection as
soon as the same request's engine override resolves. That read is its only
asynchronous dependency; gallery, score and spec reads continue independently.
Each input and projection starts once, with the existing one image/two video
quote workers. Hero and gallery selection still consume the complete input
result. Model-only diagnostic completion observes all started siblings before
emitting one timing record; an original loader error rejects the public result
promptly even while another read remains pending. Observers retain late errors
without supplying successful fallbacks. The new `model-pricing` phase measures
the projection, so model `dataDurationMs` now includes work absent from older
records; those historical aggregate durations are not directly comparable.
`tests/model-page-input-overlap.test.ts` covers this dependency and error boundary.

The 2026-10-09 controlled owner check used a 240 ms gallery, 40 ms override and
8 ms per-quote fixture. Across an ABBA sequence, median route-owner duration
changed 296.05→241.80 ms for Veo 3.1 and 402.67→241.42 ms for GPT Image 2, with
identical output and quote counts. An override-limited control showed no
meaningful gain. Exact route/layout/metadata/quote parity covers EN/FR/ES,
including partial and unavailable prices. These are local scheduling
measurements, not HTTP/browser LCP or field CWV gains. Evidence is under
`.reports/cwv-next-phase-2026-10-09/model/`; retain separate browser and deployed
delivery verification before making a user-visible performance claim.

## Paginated discovery gallery

Examples routes read24 items per logical page from the SQL catalog; all24 watch links and posters are rendered on the server. Four optional opening videos belong to the same page and are never reinserted on page2. `examples-discovery-layout.ts` chooses compatible opening formats from the current page only; CSS owns geometry and native continuation ratios. Measured media dimensions take priority over declared ratios. Only the two side previews are cropped. Empty managed destinations stay empty and out-of-range URLs redirect to the last valid page.

Family metadata uses route-local `selectFamilyMetadataVideo` to read the first
playlist item through `listExampleFamilyPage`, independently of URL sort/page.
An empty result stops there. A nonempty result without a playable original retries
the existing 60-item selection window, preserving SQL normalization and local
snapshot compatibility. A playable item without a thumbnail keeps the brand OG
image; later posters do not replace it. Both reads propagate their original errors.
The rare retry adds a catalog read and can observe a later concurrent update.
The 24-card gallery, other 60-item selectors and cache policy retain their owners.

The opening card owns the one prioritized responsive poster. No separate route hero or competing image preload is rendered. `useGalleryPreviewBudget` allows three visible short previews on desktop or one on mobile, prioritizes hover/focus intent, and supports global pause. Cards delegate playback preferences, visibility, rejection and telemetry to `useExampleCardPlayback`; absent short previews remain posters until manual playback. No original-video fallback is used for incidental gallery animation. The reader suspends this budget while open. A continuation heading and spacing distinguish the opening four from later cards without changing their media geometry. Family introductions, complete authored guidance, model links and FAQ remain visible and server-rendered below pagination; do not truncate their source text in route data. Canonical, hreflang and existing JSON-LD ownership stay with the route. Test initial loading and first Play separately; this structure alone does not establish a Core Web Vitals gain.

A compact, full-width guide follows all four opening cards in reading order. It tells visitors to open any video for its prompt, settings and current price, and offers a generic app entry point without implying that it will reuse the lead video's prompt. The full prompt, original settings and qualified current estimates remain available in the reader and canonical watch page. Gallery cards receive exact/reference/unavailable current prices from the request-local canonical quote owner through `current-examples-gallery-data.ts`; the pure gallery builder formats the supplied map. Unavailable prices are omitted. Never display a historic charge as a current public price; stored billing history remains unchanged. Per-video reuse links still follow the source engine's app availability rule in the reader.

## Public example comparison handoff

`frontend/lib/example-recreation.ts` owns the explicit text-only comparison URL and its scalar settings contract. Prices never travel as trusted URL inputs. `remix=1` requires engine, mode, duration, resolution, aspect and audio; unsupported settings are rejected rather than silently replaced with another quote scenario. `workspace-example-recreation.ts` checks the actual workspace engine capabilities and form coercion before producing the snapshot. `workspace-example-resolution.ts` maps equivalent public resolution labels to native capability tokens; incompatible coupled LTX Fast duration/resolution/fps settings are refused before hydration. The ordinary public snapshot projection lives in `workspace-shared-video-snapshot.ts`.

`useWorkspaceVideoSettings` captures this intent before removing `from`. After the public video loads, it applies the selected model and full prompt once and skips private/original-job hydration for this comparison. Reference inputs from the source and the visitor's previous form are not carried into this explicitly text-only mode. Ordinary example links retain their existing recreation flow; their derived snapshot now includes public audio and a conventional resolution only when measured dimensions support it. Saved job snapshots remain authoritative on the ordinary path.

The comparison UI shows three distinct executable model proposals, each with its own duration, resolution, aspect and audio. `server/example-comparison-quotes.ts` ranks configurations by duration distance first, then aspect, resolution and audio; exact configurations win. Explicitly highlight every adapted setting. Unknown source settings stay unknown; label those quotes as proposed configurations. Validate each proposal with the workspace handoff owner before quoting it once through the canonical public price owner. Retain historical billing separately without displaying it as the public price, and confirm the final quote in the app before generation. A genuine quote-service failure may leave fewer proposals; never fabricate prices to fill a slot. Preserve the full request through the existing login redirect owner. Tests: `example-recreation`, `workspace-example-recreation-dom`, `workspace-video-settings`, `workspace-shared-video-load-dom`.

## Existing ownership

The homepage example loader owns selection, curation and promotion media, with no
card quote projection: `HomeCreativeWorlds` / `HomeModelDiscovery` do not display
those card prices. Current hero prices and the
guided price demonstration retain their separate canonical reads in
`home-page-data.ts`. The pure `assembleHomepageExampleCards` still accepts supplied
current prices for its explicit callers. `tests/home-unused-example-pricing.test.ts`
checks the real loader and localized rendered consumers; the PostgreSQL curation
fixture preserves the separate selection and SQL-read contract.

The five approved hero items use curated media and exact-locale `imageAlt` fields
in `home.redesign.hero.mockup.engineRecommendations`. Gallery candidates do not
describe those different sources. MiniMax's scene description stays unchanged;
the other four descriptions state the approved model, duration and image-to-video
mode where applicable without inferring a scene from an unrelated gallery image.
Programmed slots still determine the item IDs consumed by playback, and current
hero prices retain their canonical quote read.

`prepareHomePageData` starts all five retained reads once. The hero still awaits
slots, scores, hero pricing and demonstration pricing; discovery alone awaits the
gallery beneath its own Suspense boundary. The four authored CreativeFilms remain
outside that boundary. Its fallback uses the same six authored fallback cards and
reader geometry, with real model/example links; final cards retain the existing
curation, promotion and SQL-read policy. Do not stream a replacement hero or entire
CreativeWorlds section, which could remount an already playing video.

The one bounded timing record waits for every started read to settle, including
when a critical read fails early. Immediate observers prevent unhandled rejections
without converting any returned promise into a successful fallback. The complete
`loadHomePageData` API remains available and propagates the original loader error.
The route's ordinary listing failures retain the existing gallery fallbacks.
Unexpected gallery failures after shell emission reject the discovery boundary;
React/Next handles that error and may retain its server fallback until error/retry
handling, rather than silently treating fallback cards as final data. Once a shell
has been sent, its HTTP status cannot be replaced by a later gallery error.

`tests/home-streaming.test.ts` uses the React renderer bundled with Next and real
homepage owners to hold gallery reads, check early critical poster/films/JSON-LD,
and compare the final EN/FR/ES discovery markup. This proves the server composition
boundary. Home entries retain `revalidate = 60`, which alone does not establish
static versus dynamic delivery or cache buffering.

Local production-build verification on 2026-10-09 marks home as dynamic (`ƒ`).
With the same disposable PostgreSQL gallery table held, the reference sent no
bytes or critical poster during a 2,200 ms observation; the candidate delivered
hero HTML at about 87 ms while gallery data remained blocked. Early Play at
EN/390 px retained the same playing video through discovery reveal, advancing
from 0.87 s to 5.13 s. FR/390 px and ES/1440 px reveal checks retained the hero
and all four film nodes; measured section/card box deltas and reveal-only CLS
were zero. Evidence lives under `.reports/cwv-large-phase-2026-10-09/`, including
`candidate-held-active.json`, `baseline-held-active.json` and
`held-gallery-summary.json`. These controlled local checks prove the HTTP
boundary and reveal continuity. They do not establish CDN HIT behavior, a field
LCP reduction or a CrUX gain; retain comparable browser and deployed cache
verification for future performance claims.

The comparable six-run ABBAAB browser check used the same builds and PostgreSQL
fixture with 4× CPU throttling, 40 ms latency and 1.6 Mbit/s bandwidth. Encoded
HTML increased from 57,538 to 63,663 bytes (+6,125 bytes, +10.6%) because both
fallback and final discovery markup are sent; JavaScript increased from 215,470
to 215,567 bytes (+97 bytes). Median LCP was 848 ms versus 840 ms, with overlapping
run ranges, and all six runs had zero CLS. This does not establish a significant
LCP gain. The additional HTML is an explicit accepted cost of removing the proven
gallery wait from critical hero delivery, and remains part of future comparisons.

Homepage mobile composition puts the main video before the comparison and assistant
links. When its thumbnail strip becomes visible, the first thumbnail reuses
`HOME_LCP_MOBILE_DELIVERY_SRC`, already loaded by the critical poster; do not request
the larger desktop asset for that mobile thumbnail. Its observer, lazy scheduling,
fixed geometry and exact original/derivative playback policy remain independent.
`HomeHeroSecondaryLinks` owns comparison and guarantees after the player in mobile
document order; assistant access lives in the following app section. Keep secondary
actions outside the main intro.

Automatic hero transitions retain the previous decoded frame on a local canvas (at most 1280 px wide) until the new video presents a frame. The canvas is never exported or read back, and no next-video prefetch is added. Explicit selection and terminal failure restore the ordinary poster path. Keep current-node/generation guards around frame callbacks.

`useHeroVideoPlayback` advances the selected model on the current video’s natural
`ended` event and wraps after the last playable item. Do not add native `loop` or a
timer: the selected model, price and links must follow the playing source. Automatic
transitions preserve the sound preference, respect user pause and visibility, and
load only the next selected source through the shared playback policy. Initial
mobile/reduced-motion/data-saving playback remains manual; desktop initial playback
retains visible idle scheduling. Late end events from replaced videos are ignored.

The critical homepage poster's authored identity and geometry stay in
`home-lcp-image.ts`. `pnpm --prefix frontend media:home-posters:prepare` copies those
two approved WebP files without re-encoding to `public/hero/prepared/<sha256>.webp`
and generates `config/home-posters.generated.json`. Do not hand-edit the projection
or overwrite an existing hash URL. `home-lcp-delivery.ts` exposes only display URLs;
`HomeLcpPoster` and its corresponding thumbnails reuse the same responsive file.
Only this verified hash namespace receives year-long immutable browser caching.
Authored files, originals, other posters and page cache policies are unchanged.

Run `pnpm --prefix frontend media:home-posters:check` after changing either critical
source. The same read-only check runs in `prebuild`: source hashes, manifest, copied
bytes and every retained prepared filename must agree. Preparation keeps older hash
files because cached HTML may still reference them. Updating a critical source means
preparing a new URL, never replacing bytes under a cached URL. Check cold and warm
mobile rendering when changing the hero's visibility: moving the image above the fold
can make it the LCP element even when its weight is unchanged.

| Area | Owner |
| --- | --- |
| Homepage presentation | `frontend/components/marketing/home/HeroVideoShowcase.tsx` |
| Homepage playback lifecycle | `frontend/components/marketing/home/useHeroVideoPlayback.ts` |
| Critical homepage poster | `HomeLcpPoster.tsx` and `home-lcp-image.ts` in the same directory |
| Example gallery presentation / incidental playback | `frontend/components/examples/ExampleGalleryCard.tsx` / `useExampleCardPlayback.ts` |
| Example hero playback | `frontend/components/examples/ExamplesHeroVideo.client.tsx` |
| Model hero playback | `frontend/components/marketing/ModelHeroMedia.client.tsx` |
| Shared public playback policy and observations | `frontend/lib/public-video-playback.ts` |
| Shared browser attempt/fallback lifecycle | `frontend/components/media/usePublicVideoPlayback.ts` |
| App curated demonstration cards / selected preview | `frontend/components/media/AppDemoCardMedia.client.tsx` / `AppDemoVideo.client.tsx` |
| Manual watch/comparison controls | `frontend/components/media/usePublicVideoControls.ts` |
| Watch / native comparison presentation | `frontend/components/watch/WatchVideoPlayer.tsx` / `frontend/components/media/PublicVideoPlayer.client.tsx` |
| Optimized poster URLs | `frontend/lib/media-helpers.ts` and `frontend/config/image-optimizer.json` |
| Angle public orbit display and responsive preparation | `frontend/src/components/tools/angle/landing/AngleOrbitStudio.client.tsx` |
| Generated image thumbnails | `frontend/server/image-thumbnails.ts` |
| Uploaded image/video thumbnails | `frontend/server/upload-thumbnails.ts` |
| Small video previews | `frontend/server/video-preview.ts` |
| Public rendition CLI and stable contracts | `frontend/scripts/public-video-renditions.ts` and `_lib/public-video-renditions.ts` |
| Public rendition media I/O | `frontend/scripts/_lib/public-video-renditions-runtime.ts` |
| Public rendition manifest/activation state | `frontend/scripts/_lib/public-video-rendition-state.ts` |
| Authored public-demo source catalogue | `frontend/config/public-video-sources.json` |
| Rendition profile definition and measured state | `frontend/config/public-video-rendition-profiles.json` and `public-video-renditions.manifest.json` |
| Browser-safe public rendition lookup | `frontend/lib/public-video-renditions.ts` and `frontend/config/public-video-renditions.generated.json` |
| Offline coherence and critical-home coverage | `frontend/scripts/check-public-video-coverage.ts` and `_lib/public-video-coverage.ts` |
| Storage and reusable assets | `frontend/server/storage.ts` and `frontend/server/media-library/` |
| Image thumbnail repair entry | `frontend/scripts/backfill-image-thumbnails.ts` |
| Image repair inventory, references and guarded transactions | `frontend/scripts/_lib/image-thumbnail-projections.ts` |

Playback hooks stay client-side; encoding, storage and database work stay server-side. Pages compose these owners. Do not put provider, pricing, storage or encoding responsibilities in a playback component. Route-specific workspace behavior stays under its existing `_hooks`, `_lib` and `_components` boundaries.

### Demonstration media inside the app

Image and Audio newcomer samples use separate editorial starter collections and a
bundled public fallback; see `app-starter-media.md` for ownership, preparation,
playlist migration, original artwork provenance and validation limits.

Curated workspace examples use `AppDemoCardMedia`: responsive lazy posters remain
visible at rest, and a video element mounts only for visible hover playback intent.
The existing `useExampleCardPlayback` owner applies hidden-tab, reduced-motion and
Save-Data restrictions. A short preview takes precedence over the full source.
Selecting Play in the main preview mounts `AppDemoVideo`, which consumes the shared
public rendition selector and exact-original error fallback. Personal media retain
their existing reader, and download/reuse/edit URLs remain originals.

Replacing an app demonstration automatically retains these loading rules, but does
not automatically encode the replacement. Verify the exact original selected by the
app reader, register that source in `public-video-sources.json`, then use the explicit
asset-scoped prepare/review/publish/HTTP-check/activate lifecycle below. Unknown or
unprepared sources use the exact original. Do not infer app rendition coverage from
the homepage coverage gate. Keep posters versioned when their bytes change.

The no-idle-video boundary is covered by `tests/app-demo-media-contract.test.ts`.
Browser smoke confirmed no mounted video on an idle app sample at desktop width;
this is a loading-policy check, not a measured Core Web Vitals improvement. Comparable
production cold/warm measurements and Safari/iOS playback remain rollout checks.

## Original, thumbnail and preview are different contracts

- Keep the durable original URL available for downloads, editing and precise inspection. A presentation optimization must not silently substitute a low-resolution derivative in these actions.
- Use a thumbnail sized for a grid or reference slot. A missing thumbnail is a repair condition; do not eagerly fetch a large original for every small tile.
- Angle and Character Builder image pickers request `kind=image` from `/api/media-library/assets` through the shared media-library client. They load 30 items initially and expose a localized load-more control while the response has another cursor page. Upscale uses the same 30-item saved-asset pages and keeps its complementary generated-video jobs request on the initial load; loading another saved-asset page does not refetch those jobs. `LibraryImageThumbnail.client.tsx` displays stored `thumbUrl` directly and lazily, with exact-original fallback for absent or failed thumbnails. It must not proxy private/signed thumbnails through the public image optimizer or replace the original asset passed to selection/generation. `isLibraryImageAsset` supports legacy responses while rejecting explicit video/audio kinds. Both page and modal layouts of `AssetLibraryBrowser` use this reader for stored images and video posters; a poster fallback remains an image and must never load the original video as an image.
- Exact saved-state checks through `/api/media-library/assets?limit=1&originUrl=...` use a bounded origin lookup. It reads canonical `media_assets` first and falls back to `user_assets` for legacy compatibility, with account, kind and source filters applied in each lookup. This path does not scan `job_outputs` or run the paginated listing's cross-source window. The general paginated listing remains the compatibility owner for merged ordering and deduplication; qualify any rewrite of that query with representative production `EXPLAIN (ANALYZE, BUFFERS)` evidence.
- The canonical `/api/media-library/assets` GET reads already-migrated `media_assets`, `job_outputs`, `app_jobs`, and legacy `user_assets` tables. It passes `ensureSchema: false` for both paginated and exact-origin reads so an authenticated request never waits for request-time DDL. The server listing helpers retain schema setup by default for legacy and mutation-adjacent callers. A new database must use the explicit application bootstrap and ordered Neon migrations before serving Media.
- Existing video grid previews are short, silent and deliberately lower cadence/resolution. They are not suitable evidence of a model's full motion quality or audio.
- Use a representative full-duration rendition for a model demonstration after its derivative has passed the measured media gates, explicit visual/audio review, public HTTP readiness and activation. A profile with a validated savings omission deliberately uses the original.
- Preserve private/signed URL behavior. Public image optimization does not forward a user's authorization headers; do not strip signatures or publish a private source to make optimization work.
- `server/owned-media-read-access.ts` grants 300-second server GET access only to exact owner-prefixed objects in configured storage. The storage ownership helper also recognizes existing content-addressed uploads under approved `prefix/by-content/SHA256(userId)[0:32]/` namespaces, including configured staging prefixes. Library copies and image/video thumbnail creation use this reader and persist only durable originals/derivatives and original provenance. Foreign-owner or unowned internal objects fail closed; external provider sources retain their existing URLs. The operator thumbnail backfill may explicitly opt ownerless rows into an unsigned HTTPS GET for the exact `renders/images/anonymous/` legacy prefix, without query strings, credentials or fragments. This never signs anonymous media or opens private storage; account-facing callers do not receive the exception. `tests/owned-media-read-access.test.ts` covers ownership denial, signing failure, actual content-addressed uploads, library promotion and the legacy backfill/Sharp/upload path using network doubles.
- `server/fal-provider-media-access.ts` extends that reader at the server-only Fal submission boundary with grants bounded to one hour for asynchronous input retrieval. Sign only typed media fields in a transport copy and pass the authenticated owner through all fallback adapters. The exact-owner check includes the existing authenticated `inline` upload namespace, including its content-addressed form; anonymous and foreign inline objects are not granted access. Persist canonical inputs and enqueue summaries, never access grants. The provider diagnostic sanitizer covers synchronous submission and asynchronous webhook/poll logs, including up to three URL encoding layers, because validation bodies may echo input URLs. Local ownership/signing denial must occur before a paid provider call; a failed input download must not be reported as a completed render whose output could not be stored. `tests/fal-provider-media-access.test.ts` exercises the real submission/request-body owner with local signing and provider doubles.
- `server/media-library/owned-video-facts.ts` owns missing measured video facts for editing. It validates the ready owned original and provenance, obtains server read access, and runs the bounded downloader plus local-file FFprobe in `src/server/audio/source-video-probe.ts`. Exact owner, current original URL and ready/nonhidden state guard persistence to `job_outputs` and matching promoted assets. Store only measured duration, dimensions and audio presence in `metadata.mediaFacts` with `source: 'probe'`; requested duration remains history and no frame rate is inferred. Library promotion forwards validated facts. The shared conversation edit command releases its initial validation transaction before inspection, then rechecks the receipt, revision, project scope and media ownership in a fresh transaction. `studio/media-resolver.ts` remains read-only and never downloads or repairs a source. Probe errors expose no signed URL or FFprobe command.
- Audio completion passes its measured byte duration to the legacy output mapper, which preserves canonical `metadata.mediaFacts` separately from the historical integer duration. Synchronous Audio confirmation promotes only completed outputs after the exact owned quote is accepted; a promotion outage never fails or refunds the completed paid result. An accepted confirmation replay may retry this bounded promotion without generating or reserving again. Studio's read-only project projection exposes only validated probe durations for video/audio. Library insertion uses those same facts and floors source-limited frames, so an integer duration or a fractional final frame cannot extend a clip past its source. Focused coverage lives in `audio-reserved-execution-postgres`, `mcp-audio-services`, `media-library-contract`, `studio-conversation-media-scope-postgres` and `studio-conversation-timeline` tests.
- Preserve aspect ratio, alpha/transparency when required, orientation, and the distinction between original quality and display quality.

Angle's public orbit prepares the other three views after its existing idle boundary. Derive their `src`, `srcSet` and `sizes` with Next Image's `getImageProps` and the same sizing policy as the displayed image; assign `sizes` and `srcset` before `src`. Loading the authored source URL would warm a different resource and waste a second transfer on selection. Keep the initial view as the only mounted image, preserve scheduled-work cleanup, and check `tests/angle-orbit-responsive-preload.test.ts` when changing this behavior. Future display quality or sizing changes must stay shared with preparation; validate actual browser selection at the relevant viewport and DPR.

The first orbit view uses the still-image style in server HTML and through hydration. Enable the existing entrance transition only after a button, keyboard or drag action changes the view; returning to the initial view remains an interaction. Keep reduced-motion handling and image-error fallback intact. An opacity-zero entrance can defer the LCP observation well beyond the image download, so do not infer render speed from image bytes alone.

## Playback and Core Web Vitals

The homepage poster must remain discoverable in server-rendered HTML with its existing responsive source, dimensions and critical priority. Do not make it depend on hydration, a video download or an idle callback. Initial media scheduling and an explicit Play action have different priorities.

The examples routes prioritize only the first visible gallery poster. Other surfaces that use `ExamplesHeroVideo` keep its existing responsive poster priority, without competing gallery hints. Validate scheduling changes with comparable browser measurements; the HTML contract alone does not establish a performance gain.

The examples hero waits for the first IntersectionObserver result before automatic
playback. Each new automatic reader keeps `preload="none"` while visibility is
unknown; a confirmed offscreen result must not trigger `play()`. No extra timer or
new threshold is introduced: the existing 0.55 observer controls visibility.
Native/manual playback and explicit retry do not wait for this initial automatic
gate. Preserve environment resume, user pauses, source fallback and observer
cleanup; `tests/examples-hero-visibility.test.ts` covers those transitions with
controlled browser APIs. Only real network/first-Play checks establish transferred
bytes or loading gains.

Character Builder's initial reference sheet uses the shared Next Image responsive optimizer and explicit high fetch priority. Preserve its authored source and fixed stage geometry; mount the alternate portrait only after selection. Do not restore `unoptimized` for this public static sheet. `McpStoryVisual` gives high fetch priority only to its `priority` hero instances; secondary instances stay lazy. `tests/marketing-critical-image-delivery.test.ts` checks both SSR boundaries. D95's comparable production-build measurements are recorded in `docs/redesign/performance-optimization-2026-09-15.md`.

- Automatic video loading remains deferred and subject to device/motion/data-saving preferences and visibility. Never mount or preload every video to make selection appear faster.
- Below-fold manual demonstrations, including Character Builder's workflow video, use `preload="none"` with their existing poster and fixed geometry. Native `metadata` is a loading hint, not a byte budget: browsers can transfer a large part of a file before any playback. Verify actual cold/warm mobile and desktop requests plus the first native Play when adding these surfaces; keep the original source and controls available.
- The integration conversation demo follows this native manual contract in Claude, ChatGPT and Codex pages, with its poster built by `buildPublicVideoPosterUrl`.
- The PAYG strip keeps its cards, copy and watch links server-rendered. Its route-local `PayAsYouGoPreview.client.tsx` always renders a responsive lazy cover, without prioritizing below-fold posters. It delegates playback to `useExampleCardPlayback` only when at least 25% of a desktop card is visible, including horizontal clipping. Narrow mobile keeps the cover and existing watch link. Reduced motion, Save-Data and hidden-document handling remain in the shared lifecycle. Do not restore unconditional autoplay or mount all seven video sources during SSR. Tests in `secondary-media-readers.test.ts` cover this boundary and the image picker selection contract.
- A user Play action may load immediately. Show loading until actual playback; keep a stable cover through buffering and failures. Do not interpret the `play` event as proof that frames are being presented.
- Pause offscreen/hidden playback; respect a user pause when visibility returns. Cancel pending callbacks and ignore stale media events/play promises after source changes.
- Preserve fixed media geometry and control layout through idle/loading/playing/paused/error states. Avoid an extra native poster download when an optimized image already provides the cover.
- Keep playback behavior independent of model IDs. A new item should receive the same policy through data, not a new conditional in the hook.

Shared public playback chooses one profile when an attempt begins and keeps it for that attempt: `mobile` below 768 px, `desktop` otherwise, with an explicit user start allowed to prefer `mobile` when the browser reports Save-Data. Unknown, private or signed inputs pass through the exact original URL. If a known derivative fails, the attempt falls back to the original at most once while retaining play intent, mute state and startup timing. Original download, edit and schema URLs never change to derivative URLs.

Homepage mobile loading remains lazy, and the critical poster and fixed geometry remain present before hydration. Model, examples and homepage readers share rendition/fallback mechanics while retaining their surface-specific controls, autoplay eligibility, visibility rules and posters. Do not add per-model playback branches.

Watch pages use Auto by default; prepared sources expose Auto/Original. Comparisons default to Original, including under Save-Data, so judging model fidelity does not silently use a smaller rendition. Auto is offered only for a source present in the active projection. Unknown and signed videos keep their exact URL and have no misleading quality selector. Profile omissions can make Auto and Original resolve to the same URL; changing the label then must not reload or restart playback.

`usePublicVideoControls` owns manual play intent, visibility pauses, native/custom events, quality changes and original fallback. It changes only the live video source, synchronously before a requested play, while the original remains in SSR/React props and in separate schema/download/edit data. Quality changes and fallback retain the same native video element, time, mute and volume; a different original remounts it. Guard stale events/promises, seek after metadata, and never resume a manually paused or hidden reader automatically. All manual readers use `preload="none"`.

Gallery cards retain their responsive optimized image underneath the video until actual `playing`, and show it again when waiting, paused or failed. A visible idle card has no video element. The examples gallery requests short previews through its bounded controller (three desktop, one mobile); `useExampleCardPlayback` applies hidden-tab, reduced-motion and Save-Data restrictions. Missing or failed previews keep the poster and watch link. Examples never fall back to full originals for incidental animation. Other users of this shared hook retain their own intent and mobile policies. No native raw poster duplicates the optimized image request.

On mobile, the gallery initially keeps incidental previews idle. A deliberate scroll gesture or the “Animate previews” control enables the one-video budget. Desktop starts one visible preview and expands to up to three after a card receives hover or keyboard focus. This preserves the server-rendered posters and watch links during first load while allowing visitors to animate the gallery as they explore it. Pausing stays explicit until the visitor resumes it.

The opening and continuation layouts use one server-rendered page of 24 videos. Only the first poster receives high priority; side posters and narrow continuation portraits request image widths matched to their rendered columns. Later pages contain distinct entries and no repeated opening. `tests/examples-gallery-opening.test.ts` and `tests/examples-lcp-performance.test.ts` own this HTML boundary.

### One reader for gallery and direct watch URLs

`ExampleReaderContent` is the shared video, prompt, commercial actions and editorial view. `VideoWatchContent` renders it with an H1 on direct `/video/[id]` or canonical-slug requests and keeps metadata, JSON-LD, breadcrumbs and related links on the server. From the gallery, `ExampleReader.client` wraps the same content in an accessible dialog. `useGalleryReader` creates one browser-history entry at the actual watch URL and replaces it for next/previous navigation. Closing or Back returns to the original gallery URL, filter, page and scroll; refreshing the video URL loads the standalone page. Modified clicks remain ordinary watch links. No second video identity or separate popup content is authored.

`example-watch-detail-loader` rechecks public eligibility and reads the selected editorial entry only. Curation and direct SEO watch readers share `PUBLIC_VIDEO_SOURCE_ELIGIBILITY` from `videos-query.ts`, excluding incomplete jobs and deleted output/asset sources before hydration. Gallery discovery keeps its explicit indexable flag, while direct SEO readers retain the existing legacy null-indexability policy. Both modes use the watch signals owner for title, introductory copy, approved references and contextual details. `ExampleReaderContext` preserves secondary editorial information in a native disclosure. Original download, schema and recreation URLs stay intact. Gallery cards show qualified current price labels when available. The reader shows current prompt-only estimates with their explicit priced settings and no-reference basis; adapted or suggested settings are identified beside the headline and each proposal. Missing current estimates never fall back to stored charges.

`example-watch-detail-loader` loads the read-only configured video catalog used by the
app once per response. Both the proposal selector and the workspace handoff validator
consume that same catalog, including disabled models and administrator capability
limits. The public projection receives it explicitly; offline tests supply their
own authored catalog fixture. Historical render costs remain independent of current
canonical quotes. A disabled source model keeps its public video readable, but has
no direct recreation action or comparison proposal.

`ExampleReaderContext` omits empty disclosures, headings and lists. Its intro remains
visible even when there is no additional context. `ExampleReaderDisclosure.client`
keeps populated children in the initial server HTML and owns only the native toggle
interaction. Opening near the bottom of the viewport brings the summary and first
content below the sticky toolbar; mounting, closing and already-visible content do
not move the reading position. An empty keyframe URL object does not create a
keyframe section. Tests: `example-reader-context-dom` and `video-page-architecture`.

Admin SEO writes revalidate the affected ID and canonical-slug routes after persistence, including the previous slug when changed, plus the video sitemap routes. Failed validation or persistence does not invalidate. SEO status and existing quality gates still govern robots, redirect and sitemap eligibility; opening a public gallery video does not approve it for indexing.

### Playback observations

The shared observer emits only `public_video_startup`, `public_video_rebuffer` and `public_video_error` through the existing consented analytics dispatcher. Common fields are allowlisted `asset_id`, `playback_profile` (`original`, `mobile`, `desktop`), `playback_surface` (`home`, `model`, `examples`, `watch`, `comparison`, `examples-card`) and `playback_trigger` (`user`, `automatic`). Startup adds `measurement_method` (`video_frame_callback` or explicitly labelled `playing_fallback`) and `duration_ms` from 0 to 120,000. Rebuffer adds `duration_ms` from 0 to 120,000 and `rebuffer_count` from 1 to 5. Error may add the native `media_error_code` from 1 to 4 and emits at most twice per observer.

The first-frame callback is armed when the video node attaches. `playing` is used for startup only when that callback API is unavailable; otherwise it completes a valid post-presentation rebuffer. Rebuffer timing starts only after first presentation while playback is intended and visible. Pausing, hiding, source replacement and disposal cancel pending observations. The payload does not admit URLs, private media, prompts, queries, user/job IDs or arbitrary model labels.

These bounded observations describe browser startup, rebuffer and errors for known public assets. They do not establish physical display, comparable Core Web Vitals or field performance by themselves.

Do not assume a lighter file or a higher Lighthouse score proves improvement. Before merging a performance-sensitive lot, compare the reference and candidate production builds on the same routes, media and conditions. Record the commit, environment, individual runs and variability. Include mobile/desktop and cold/warm cache scenarios; identify browser versus server cache explicitly. Check LCP/CLS, blocking work, critical requests and time until the form is usable. Exercise the actual interactions for INP diagnosis: Lighthouse TBT is not field INP.

Block a reproducible regression beyond baseline variability even if a metric remains in the green range. Inconclusive measurements are not evidence of a gain. Target field p75 LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 per device; confirm with route-level real-user samples after deployment and keep the old code/media references available for rollback. Functional and architecture tests do not certify field Core Web Vitals.

## Images and URL configuration

Decorative animated audio equalizer overlays have been removed from public and
workspace media cards. Keep the existing localized screen-reader availability
labels and the actual player controls. Audio metadata still belongs to the media
and generation contracts; removing decoration must not change tracks, mute state,
playback policy, poster geometry or resource priority.

Use `buildExamplePosterProjection` for the shared API/gallery poster fields, or the shared poster builder and its named presets when an explicit optimized URL is needed. `next/image` should normally receive the original allowed source plus responsive `sizes`; do not optimize an already optimized URL again. Widths and qualities in emitted `/_next/image` requests must be admitted by the actual Next configuration. Do not add per-route quality constants or hand-build optimizer query strings.

Native comparison posters use `buildPublicVideoPosterUrl` and the shared hero preset. It admits only unsigned HTTPS sources on `media.maxvideoai.com`; query strings, credentials, unknown origins, relative and opaque URLs pass through exactly. It never converts private/signed media into a public optimizer request. Image-only comparison sides continue to use responsive `next/image`.

`frontend/config/image-optimizer.json` is the shared source for admitted widths/qualities and fallback values, consumed by `next.config.js` and the URL helper. Use `HERO_POSTER_OPTIONS` (1080/75) or `GALLERY_POSTER_OPTIONS` (640/75). A positive finite width rounds up to the next admitted size and caps at the largest; quality uses the nearest admitted value, preferring the lower on ties. Invalid values fall back to 1080/75. No options preserve the original source; data/blob and already optimized URLs pass through.

Sharp encoding quality and Next's admitted request quality are separate contracts. A source thumbnail encoded at one quality does not authorize that number as a Next request parameter. For public immutable images, source/version and cache lifetime must agree; replacing bytes beneath a long-lived immutable URL is not an update mechanism.

## Adding a public model example or replacing a media file

1. Resolve the canonical model identity through the registry/runtime. Do not edit generated runtime/catalog/roster projections directly.
2. Record a durable original and a valid poster. Check the actual content type, dimensions, duration/cadence and audio when relevant; labels alone do not prove these properties.
3. Select the appropriate existing display path: small grid preview, responsive image, full demonstration, or original action. New media must not increase eager requests across all items.
4. Verify poster URLs against allowed optimizer settings and HTTP responses in the intended environment. Check loading/error, mobile single-click playback, visibility and reduced-motion/data-saving behavior when touching a reader.
5. For a new selected homepage hero source, add it to `public-video-sources.json`, prepare and content-review its derivatives, publish, HTTP-check and activate them, then run `pnpm --prefix frontend run media:public-renditions:check`. Pending profiles and retryable failures are not ready; every desktop/mobile profile needs an active rendition or validated omission.
6. Run the relevant tests and `pnpm model:launch-assets:check`. Run `pnpm model:registry:check` for any model policy change, along with the model guide's generation commands when needed.
7. Check public canonical/hreflang/JSON-LD and localized links if the owning page changes. Update this guide and relevant AGENTS ownership rules with any new implemented responsibility.

The model launch-asset validator does not enforce rendition readiness. The public rendition command below owns measured byte, metadata, review, and HTTP activation gates. Historical grids and model pages outside the selected homepage set keep exact-original fallback until prepared; the critical-home build check is intentionally not a claim that every historical public video has been transcoded.

For additional public sources, prioritize the exact media observed in the rendered page using recent page exposure and measured file size. A model's fallback demo in configuration may differ from its selected gallery hero. Page views are not video plays or CDN transfer counts. Add each verified original to the same authored catalogue and run the lifecycle with explicit `--asset-id` selections; the default five-asset limit can otherwise leave later entries unprocessed. Confirm the generated URL is actually selected by the owning reader before calling that surface optimized. Watch and full-video card fallback consume the shared projection; comparison readers deliberately retain Original by default. Short card previews remain a separate display role. An integrated reader does not mean all historical source files have been prepared. Do not replace full-quality download, editing or schema sources when extending display coverage.

### Public full-duration rendition command

The public rendition command defaults to a read-only offline coherence check. Preparation is local and resumable; publishing requires explicit review evidence; activation independently requires current public MP4 and Range readiness. The generated projection is the only rendition data imported by browser-safe code.

```sh
pnpm --prefix frontend run media:public-renditions check
pnpm --prefix frontend run media:public-renditions check --http
pnpm --prefix frontend run media:public-renditions prepare --work-dir=/absolute/path --asset-id=elevator-reunion
pnpm --prefix frontend run media:public-renditions publish --work-dir=/absolute/path --asset-id=elevator-reunion --review-evidence="review record"
pnpm --prefix frontend run media:public-renditions activate --asset-id=elevator-reunion
# Full offline coherence plus selected-homepage coverage; also runs during frontend prebuild:
pnpm --prefix frontend run media:public-renditions:check
```

Run the lifecycle in order: `prepare`, content review, `publish`, `check --http`, then `activate`. Preparation and publishing process at most five authored assets by default and twenty when explicitly raised. The implementation accepts one square-pixel, unrotated SDR H.264/yuv420p video stream up to 16,384×16,384 and 60 seconds, at constant 24, 25 or 30 fps, with zero or one AAC audio stream. Frame evidence is bounded to 2–3,600 frames. Desktop output is bounded to 1920×1080 at CRF 20; mobile to 1280×720 at CRF 22. Outputs must avoid upscale, preserve aspect ratio, complete frame timeline and cadence, video timing, and AAC packet payload/timing, decode successfully, use faststart, and save at least 15% of original bytes.

The command checks FFmpeg scale-filter support before using an encoder. Some platform binaries from `@ffmpeg-installer/ffmpeg` are too old for `force_divisible_by`; if the bundled binary is incompatible, the command tries `ffmpeg` on PATH. Install a current FFmpeg with libx264, or explicitly select it with `PUBLIC_VIDEO_FFMPEG_PATH`. An incompatible explicit choice fails instead of silently selecting another binary. Quality CI installs and selects the system FFmpeg for the real encoding fixture. This selection belongs in `frontend/scripts/_lib/public-video-ffmpeg.ts`; it does not change the authored profile settings or already published media, and does not alter server-side generation/thumbnail binaries.

The two profiles are independent. Insufficient savings records an explicit omission and keeps the exact original for that profile. An operational encode/probe failure is retryable and does not erase a sibling success. Publishing a replacement preserves an already active rendition until the new pending candidate passes current HTTP/Range verification and activation. Pending-only candidates and failures without an active rendition or omission do not satisfy critical-home coverage.

`public-video-sources.json` is the authored source catalogue. `public-video-renditions.manifest.json` is the full measured and reviewed state, including immutable storage identity, hashes, bytes, probes, omissions, failures, pending candidates and active HTTP evidence. `public-video-renditions.generated.json` is a browser-only projection of active display URLs and must not be edited by hand. The offline check validates source/manifest/projection coherence and fails on a stale projection. Activation writes the manifest before the projection, so an interrupted projection write can leave a recoverable stale projection; rerun the explicit `activate` command after verifying the intended manifest state and current public object to regenerate it.

Derivative URLs are content- and profile-version-addressed immutable objects. Do not change profile settings under a profile version that has already been published. A future profile change needs a new version and a reviewed migration of preparation, manifest and projection state; this migration is not automatic.

Review evidence records explicit visual and audio content acceptance. It is separate from deployment readiness: HTTP/Range verification and activation establish public object readiness, while Safari/iOS, other supported browsers, comparable Core Web Vitals and actual interactions still gate rollout. Keep original files and rollback references; this work does not authorize original or broad storage deletion.

## Repair and cleanup

Thumbnail repair must start with a truly read-only inventory: SELECTs are allowed; schema creation, original downloads, encoding, uploads and UPDATEs are not. Use the repair command's explicit apply mode only for an authorized bounded repair. Test against controlled fixtures before touching live data. Schema changes belong to application migrations, not to a simulation entry point.

Keep scan order stable when repairs update rows. Preserve valid originals and thumbnails; report candidate, successful, failed and skipped work separately. Do not equate attempted uploads with completed repair. Bound total work, batches and retries, and avoid overwriting concurrent edits.

### Image thumbnail repair command

`frontend/scripts/backfill-image-thumbnails.ts` owns the CLI and deferred I/O imports; `frontend/scripts/_lib/image-thumbnail-backfill.ts` owns option validation and the injected scan/update orchestration. `image-thumbnail-projections.ts` in the same directory owns the stored-reader inventory, conservative matching, and reference transaction. The CLI always wires it: a healthy `app_jobs` row can still be a candidate when its API/library references need repair. The default is a read-only inventory. With pnpm, pass flags directly, without a separating `--`:

```sh
pnpm --prefix frontend run thumbs:image-backfill --dry-run --after-id=0 --max=100 --batch-size=25
# Apply the SAME inventoried range, starting from its original cursor:
pnpm --prefix frontend run thumbs:image-backfill --apply --after-id=0 --max=100 --batch-size=25
```

Apply requires an authorized bounded repair. Batch size is 1–100 (default 25 or `IMAGE_THUMB_BACKFILL_BATCH`); maximum scanned rows per invocation is 1–10,000 (default 100 or `IMAGE_THUMB_BACKFILL_MAX`). `--after-id` accepts 0 through PostgreSQL's signed bigint maximum, defaults to 0, and is retained as a string. Unknown/conflicting flags fail before database/encoding modules load.

An explicitly supplied environment variable, including `DATABASE_URL`, takes precedence over `.env.local`, then `.env`. Keep connection strings outside logs and command arguments. The inventory performs SELECTs only and can run with PostgreSQL `default_transaction_read_only=on`; it never creates missing tables. Install the application's normal migrations before using the repair tool.

For each eligible job, the adapter inventories image `job_outputs`, undeleted image `media_assets` linked to the job or one of its outputs, and image `user_assets` linked by legacy job metadata. Ownership must match, including a null owner. Each table is capped at 1,000 references per job; an oversized inventory fails explicitly rather than silently omitting references. Hidden/video jobs, deleted records, foreign owners and other jobs remain outside the repair scope.

Match output positions and original URLs before copying a thumbnail. A saved asset with an explicit output link must agree with that output; other saved assets need an unambiguous original-to-thumbnail match. Valid existing thumbnails win and are not replaced, even when they differ from the job thumbnail. A saved asset's existing valid column/metadata thumbnail can fill its own missing counterpart. Unknown or ambiguous originals fail the reference phase and remain operator-review items; never guess a match from a model name or generate another original.

After thumbnail creation, the runner first durably updates the job with its optimistic predicate. The adapter then uses a separate, short transaction for the references: lock and validate the current job source, reread the references, and guard every UPDATE with the exact `to_jsonb(record)::text` snapshot. This preserves timestamp and numeric precision. Change only missing thumbnail fields and the relevant update timestamp; metadata updates use `jsonb_set` in PostgreSQL so unrelated fields remain intact. No upserts, record creation, originals, status/payment changes or storage deletion belong in this phase. A conflict rolls back all reference writes for that job. Transaction statement and lock waits are limited to 15 seconds and 2 seconds respectively.

The summary reports actual `lastScannedId` and a separate conservative `resumeAfterId`. Use the latter to continue a run in the **same mode**: it freezes before the first failed or partially failed apply row. A dry-run cursor only continues inventory; switching to apply must use that inventory range's original starting cursor, or candidates would be skipped. Existing repaired rows are reread and skipped without regenerating their thumbnails.

An apply row can increment both `updated` and `failed` after a partial repair; remaining missing thumbnails remain retryable. Apply exits nonzero if any row failed, and conflicts never overwrite a newer row. The optimistic predicate uses exact `updated_at::text`, prior JSONB renders and the previous hero URL, preserving PostgreSQL timestamp precision.

`updated` counts jobs changed in either phase, once per job; it is not an upload or reference-row count. If references fail after the job thumbnail was committed, that job is both updated and failed. Retry the saved range: the existing thumbnail is reused and only the remaining references are repaired. A repair affecting references alone does not rewrite the healthy job or its timestamp. A successful retry becomes a zero-candidate inventory once all eligible representations are healthy.

`tests/image-thumbnail-projections-postgres.test.ts` exercises the actual CLI and SQL against disposable PostgreSQL, including read-only inventory, healthy-job/stale-library detection, environment target precedence, reference rollback, retry without duplicate encoding, concurrent edits, bounded scope and metadata preservation. Quality CI installs PostgreSQL binaries for these checks. These operational tests do not measure page speed or alter public routes, metadata, canonicals, hreflang, sitemaps, or browser loading behavior.

No checkpoint file is written. A hard process kill can prevent the final summary from printing; restart from the prior saved starting cursor. Tests simulate rejected operations/lost acknowledgments before upload, after upload and after database update, rather than OS signal handling. An uncertain upload can leave an unreferenced derivative and a retry can upload again. Do not claim exactly-once processing or delete originals/other assets to compensate. A lost database acknowledgment is treated as failure; retry rereads stored state before deciding whether repair is still needed.

Remove obsolete code/configuration in the lot that replaces it. Keep compatibility adapters only while known consumers still need them. For storage deletion, first inventory references from jobs, the library, public examples, watch pages and localized content. Distinguish temporary files, replaced derivatives and user originals; never delete a broad set simply because it is old.

## Validation checklist

- Behavioral tests for the edited playback or URL/repair boundary, including the bug's reproduction.
- Existing relevant performance, media, architecture and localized-route contracts.
- `npm --prefix frontend run lint`, `npm run lint:exposure`, `git diff --check`.
- Production build and browser smoke for changed public surfaces; explicit before/after performance evidence for initial-load changes.
- Supported browser checks for media behavior, including Safari/iOS before broad rollout; record any untested environment rather than claiming coverage.
- Documentation describes shipped code without treating incomplete browser, device or field-performance validation as finished.

### Model editorial hero framing (redesign D81)

`ModelDecisionMediaCard` declares `data-media-kind` from the resolved playable source. Model heroes use a 16:9 frame at desktop and mobile widths; video and poster use `object-fit: cover`, while image-only heroes use `contain` to preserve typography and composition. For galleries without admin curation, prefer a reviewed landscape video; preserve the order of admin-curated galleries. Video hero badges describe the selected render's audio, duration and aspect ratio; capability claims belong in the specs section. The full-render link preserves access to the original. Keep `ModelHeroMedia` priority and public playback policy unchanged. Compare equivalent production builds before claiming initial-loading gains.


### Tools illustrations and workspace captures (redesign D84)

`src/components/tools/toolbox-art.ts` owns the shared curated illustrations used by `ToolboxScene`, the marketing hub and tool cards. Empty app states keep their Illustration label. Character Builder’s generated fictional portrait and eight-view sheet are illustrations, not recorded app outputs; real workflow demos retain their existing sources and manual playback.

`src/components/tools/landing/tool-workspace-assets.ts` owns versioned WebP captures of the current local tool UI. Capture the actual interface, preserve visible settings, state the locale and visitor/authenticated context, and do not fabricate outputs. Replace captures with new versioned files after UI changes. `ToolWorkspacePreview` preserves intrinsic geometry and lazy loading with a full-size link. Angle keeps its route-local frame; its interactive orbit assets and responsive preparation policy remain separate. New direct WebP captures are bounded below 150 KB; validate loading and production-build performance before rollout, without inferring CWV improvements from byte size alone.

### Private timeline export transport

Export manifests, estimate hashes, reservations and stored artifacts retain canonical unsigned URLs. After canonical Project/Sequence and storage-owner validation, `timeline-exports/media-security.ts` uses a method-specific 300-second HEAD grant for private source metadata. Its validation result stays canonical. The worker validates again using `job.user_id`, then builds a separate GET-only render copy with one-hour access, covering the bounded 45-minute render; it never saves that copy. Public allowlisted originals retain their existing validation, content-type/size limits, redirect refusal and timeouts. Renderer diagnostics redact signed URLs and browser-console output is not forwarded.

`timeline-exports/media-access.ts` projects completed artifacts with a stable authenticated `/api/studio/timeline-exports/{id}/media` delivery URL and a separate `canonicalOriginalUrl`. Individual reads, POST replay and owned Project history share this projection, so polling never resets playback with a new signature. Delivery performs a read-only exact-owner completed-job lookup and redirects with a fresh method-specific 300-second GET/HEAD grant; its 307 preserves Range and uses private/no-store caching. Reopening a saved download renews access without a new job. The owned projection resolves legacy internal `output_asset_id` values to `media_assets.public_id` through an exact owner/source lookup and the Studio media resolver; it leaves the stored job unchanged. Canvas assets persist the canonical original and public asset ref; their playback uses the existing ephemeral media-access mechanism, stripped from workspace snapshots. A signing failure never returns an inaccessible private original as a fallback. Offline tests cover real method-specific signatures, exact-owner denial, canonical manifest preservation and actual route/renderer orchestration with network/storage doubles. These checks do not qualify remote ECS dispatch or live storage delivery; the deployed worker must include this transport correction before the isolated pilot renders private sources.


New timeline exports record provenance in `media_assets.metadata.timelineExportId`; `source_job_id` remains reserved for `app_jobs` and is unset by this writer. Some legacy exports incorrectly stored their `tlx_*` ID in `source_job_id`. They remain subject to all normal Studio resolver guards: do not add a read-time exemption or silently repair them while listing. An explicit, separately authorized repair must match one completed `app_timeline_exports` row to its exact owner, `output_asset_id` and `output_url`, require the same `source_job_id` and a null `source_output_id`, verify there is no corresponding `app_jobs` record, then preserve provenance in metadata while clearing only the incorrect `source_job_id`. Preserve public identity, original URL, payment/job state and unrelated metadata. Missing measured facts are handled by the existing `hydrateOwnedVideoMediaFacts` insertion path, outside editor locks, followed by full mutation revalidation; export duration/settings are never relabeled as probe results.

### Conversational timeline thumbnails

`studio/conversation-preview-media.ts` resolves each owned media reference and grants thumbnail access separately from original playback. Canonical `thumbnailUrl` stays unsigned; `thumbnailAccessUrl` belongs only to the preview response. The conversation timeline uses that access field for private thumbnails, an image original may supply the fallback, and video bytes must never be sent to an image element. Both client snapshot serialization and the server workspace writer strip thumbnail access alongside original grants. Export manifests retain only canonical source/thumbnail URLs.

## Video discovery gallery and reader

The examples route now renders 24 unique cards per URL page. `videos-catalog-page.ts`
counts, orders, deduplicates and selects eligible IDs in one SQL snapshot before
hydrating only the selected page. There is no catalog-wide 120/400 limit. Homepage
request-scoped readers retain their separate batching contract. Without an explicit global
curation, the general catalog combines the hub plus public family/model destinations.
Family curations suppress their inherited model destinations; an explicit global
manual/hybrid curation remains authoritative. Membership already authored in the hub
stays independent of a family's inherited selection; family exclusions are not a
catalog-wide deletion. Resolve stored engine IDs and aliases
through the registry and apply discovery policy before count and pagination. The four optional
opening slots count within page one: 16:9, 9:16, 16:9, 16:9. Only the two small
landscape preview frames crop; original watch media stays unchanged. Other sorts
and later pages use native-ratio rows. Incomplete opening sets fall back to those rows.

`useGalleryPreviewBudget` permits up to three visible short previews on desktop and
one on mobile, with hover/focus priority, a global pause and suspension while the
reader is open. Cards still delegate reduced-motion, data-saver, hidden-document,
autoplay rejection and source fallback to `useExampleCardPlayback`. Only the first
visible poster is prioritized; the other three opening posters are eager with
normal (`auto`) fetch priority. Do not demote these visible posters to `low`:
Chrome can promote nearby lazy continuation images ahead of them, leaving opening
cards blank after the lead has painted. They add no preload or explicit high-priority
hint. The continuation remains lazy. There is no competing separate
hero. Update root LCP guidance accordingly when changing this surface again.

Every card retains its real standalone watch link. An ordinary click dynamically
loads `ExampleReader.client.tsx`. `useGalleryReader` preserves gallery page/filter
and scroll, uses one history entry, and fetches adjacent 24-card windows only at a
reader boundary. Back closes and Forward can reopen the last selection.

The server `ExamplesGalleryGrid` boundary sends card summaries without the unused
`promptFull` field. Prompt excerpts, accessible labels, sources and links stay the
same; opening the reader or continuing in the app still loads the full approved
prompt from the existing detail endpoint. Do not duplicate every complete prompt
in the initial gallery's RSC client props.

Source playback uses `usePublicVideoControls` with Auto/Original policy and `preload="none"`.
The existing standalone watch page remains the authority for canonical, metadata,
VideoObject, redirects and sitemap eligibility; the dialog is not a new SEO route.

`ExampleReaderContent` is shared by both presentations. A direct request renders
its H1, primary video, editorial context and structured data on the server. A gallery
entry uses an H2 in the dialog and the existing watch URL in browser history; closing
restores the gallery rather than fetching a second record page. Share resolves the
canonical URL, while direct legacy ID requests keep the existing slug redirect.

`VideoWatchShare` presents a persistent compact row in the public reader, with a
canonical-link copy action and an announced confirmation. Clipboard failures expose
the same URL in a selectable read-only field, and the clipboard fallback returns
focus to the reader action. Feedback belongs to its watch URL, so navigation cannot
show another video's copied state. The public reader does not mount the owned-video
social publishing panel or prepare a video file for this link action. Its six visible
link destinations (X, WhatsApp, Telegram, LinkedIn, Facebook and e-mail) reuse the
library's pure `buildVideoShareIntent` owner, always using the current canonical
watch URL. Existing local brand icons are lazy images; no platform SDK is loaded.
TikTok, Reels and Shorts in the owned-video panel are file-publication workflows,
not canonical-link destinations. Reader settings are plain text with separators;
only actions retain outlined buttons. Adapted quote values keep their gold dotted
underline without a button-like border.

`example-reader-styles.tsx` owns the reader's scoped class mapping and CSS. The
synchronous `/video` route layout emits `ExampleReaderStyles` before page data
resolves; the dialog portal emits it including loading/error states. The small
stylesheet is inline only on watch routes or with the dialog; do not
import it from the initial gallery or add it to site-wide CSS. This avoids an extra
blocking stylesheet request before the watch poster. Every class uses the
`video-reader-` prefix; descendant integration styles remain scoped beneath it.
On mobile, comparisons follow prompt/reference/share content in DOM order. Do not
move a later streamed comparison block ahead of an already painted prompt with CSS
`order`: warm-cache navigation can shift that prompt by the full quote block height.
The poster keeps its existing optimized URL and single matching preload. Verify
response headers and the network trace: moving a hint earlier in HTML alone does
not change style hints that Next has already sent in the response headers.

`GET /api/examples/[id]` is an uncached read-only detail projection. It rechecks the
same public/completed/indexable/live-output eligibility as the catalog, returns an
explicit public DTO and never exposes ownership, raw snapshots or private references.
Source images use the existing approved-editorial/public-stable-media gate. The
editorial single-video lookup is bounded to one row. No schema bootstrap belongs
on this read path.

The reader uses a landscape media/tools layout and a portrait media column with
tools and comparison offers alongside it. Container queries collapse these into
document order on narrower surfaces; small screens show compact offer rows with
44px generation controls. The media frame keeps its exact ratio and transport
controls sit outside it. The gallery toolbar keeps Previous/Next/Close available
while scrolling, including loading/error close behavior and the existing focus trap.
Historical render cost belongs with the original media settings; each new-generation
estimate belongs to its own settings and app handoff. Unknown original settings are
labelled as incomplete, without claiming that a proposed configuration is identical.
The comparison heading states that these are prices for this prompt and one new
video per estimate. Each model action opens the prompt and its displayed settings
in the app; it does not launch or charge a generation. Explain adapted settings only
when a proposal differs, and keep the prompt-only reference exclusion and final
price confirmation visible below the offers.
Persistent sharing reuses the library's link intents with the canonical link only. Prompt
copy uses the shared clipboard fallback and retains a manual full-text fallback.
The public detail DTO normalizes database dates into ISO strings for identical RSC
and JSON output, avoiding server/client differences in the editorial time attribute.

Direct watch pages start the configured engine and price-policy reads alongside
their watch-data lookup with `prepareExampleWatchDetailContext`. Both context reads
run concurrently, and every comparison reuses that one request-scoped policy and
configured catalog. The context remains server-only; only the explicit public
detail DTO reaches the reader. There is no cross-request quote cache or streamed
replacement that changes the reader geometry. Verify measured loading before
claiming that this overlap improves Core Web Vitals.

Direct watch pages pass their already prepared signals to `buildExampleWatchDetail`.
That path reuses the validated editorial/source-image projection from
`getVideoWatchPageDataById`, without reading editorial entries or resolving source
images again. API opens still perform their fresh lookup and source-image checks.

Stored example charges remain historical and immutable; public readers do not show
them as current prices. Comparison estimates use explicit executable text-to-video
proposals with no references. Measured source settings guide the proposal ranking;
unknown settings remain unknown and each proposed configuration is labelled. The
headline identifies the original model's priced settings and any adaptation, rather
than claiming to price the historical render. `computeCurrentPublicSnapshot` owns
current prices and shares one DB policy read across the response; an unavailable
policy yields no price, never a legacy or historical fallback. Up to three model
proposals are selected by duration, format, resolution, audio and distinct price,
without claiming equal quality.
`buildExampleRecreationHref` passes the full scalar scenario through login; generation
always requotes. Ordinary `/app?from=…` continues the original reuse flow.
That flow waits for the selected example to commit before exposing the composer or
clearing `from`; startup draft reconciliation cannot discard the import. Source,
route and account guards reject stale responses. The public video read projects only
the validated `requestedResolution` scalar from the stored settings, without returning
the raw snapshot or private inputs. Measured output dimensions take precedence;
the recorded resolution fills missing dimensions rather than selecting the engine default.

Regression coverage: `examples-catalog-pagination-postgres`, `examples-discovery-layout`,
`gallery-reader-navigation-dom`, `example-watch-detail`, `example-recreation`,
`workspace-example-recreation-dom`, and existing public-video/watch/SEO contracts.

### Local public gallery review data

Run `pnpm --dir frontend exec tsx --tsconfig tsconfig.json scripts/capture-public-examples-review.ts`
to capture JSON from each public family independently, paging until the API reports a complete
feed. The opt-in development snapshot unions real public hub/family media for the general
catalog, retaining current discovery policy and deduplicating IDs. Historical archive feeds
remain separate. Never derive families from the first 120 hub videos. The deployed hub API
can report its loaded window as the total; this local union reviews the new default catalog,
not the production admin's private configuration. Captured prompts and original media URLs
come only from public APIs; no production database or publication writes occur. The server
caches this file in process, so restart the opted-in dev server after recapturing it.
