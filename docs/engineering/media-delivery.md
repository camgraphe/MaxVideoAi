# Media Delivery Guide

Read this guide when changing image/video presentation, poster URLs, generated media, thumbnail repairs, or public model examples. Keep model identity in `frontend/config/model-registry.json`; media delivery is not another model registry.

## Existing ownership

Homepage mobile composition puts the main video before the comparison and assistant
links. When its thumbnail strip becomes visible, the first thumbnail reuses
`HOME_LCP_MOBILE_DELIVERY_SRC`, already loaded by the critical poster; do not request
the larger desktop asset for that mobile thumbnail. Its observer, lazy scheduling,
fixed geometry and exact original/derivative playback policy remain independent.
`HomeHeroSecondaryLinks` owns the comparison/assistant destinations after the player
in mobile document order; keep those secondary actions outside the main intro.

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

## Original, thumbnail and preview are different contracts

- Keep the durable original URL available for downloads, editing and precise inspection. A presentation optimization must not silently substitute a low-resolution derivative in these actions.
- Use a thumbnail sized for a grid or reference slot. A missing thumbnail is a repair condition; do not eagerly fetch a large original for every small tile.
- Angle and Character Builder image pickers request `kind=image` from `/api/media-library/assets` through the shared media-library client. They load 30 items initially and expose a localized load-more control while the response has another cursor page. Upscale uses the same 30-item saved-asset pages and keeps its complementary generated-video jobs request on the initial load; loading another saved-asset page does not refetch those jobs. `LibraryImageThumbnail.client.tsx` displays stored `thumbUrl` directly and lazily, with exact-original fallback for absent or failed thumbnails. It must not proxy private/signed thumbnails through the public image optimizer or replace the original asset passed to selection/generation. `isLibraryImageAsset` supports legacy responses while rejecting explicit video/audio kinds. Both page and modal layouts of `AssetLibraryBrowser` use this reader for stored images and video posters; a poster fallback remains an image and must never load the original video as an image.
- Exact saved-state checks through `/api/media-library/assets?limit=1&originUrl=...` use a bounded origin lookup. It reads canonical `media_assets` first and falls back to `user_assets` for legacy compatibility, with account, kind and source filters applied in each lookup. This path does not scan `job_outputs` or run the paginated listing's cross-source window. The general paginated listing remains the compatibility owner for merged ordering and deduplication; qualify any rewrite of that query with representative production `EXPLAIN (ANALYZE, BUFFERS)` evidence.
- The canonical `/api/media-library/assets` GET reads already-migrated `media_assets`, `job_outputs`, `app_jobs`, and legacy `user_assets` tables. It passes `ensureSchema: false` for both paginated and exact-origin reads so an authenticated request never waits for request-time DDL. The server listing helpers retain schema setup by default for legacy and mutation-adjacent callers. A new database must use the explicit application bootstrap and ordered Neon migrations before serving Media.
- Existing video grid previews are short, silent and deliberately lower cadence/resolution. They are not suitable evidence of a model's full motion quality or audio.
- Use a representative full-duration rendition for a model demonstration after its derivative has passed the measured media gates, explicit visual/audio review, public HTTP readiness and activation. A profile with a validated savings omission deliberately uses the original.
- Preserve private/signed URL behavior. Public image optimization does not forward a user's authorization headers; do not strip signatures or publish a private source to make optimization work.
- Preserve aspect ratio, alpha/transparency when required, orientation, and the distinction between original quality and display quality.

Angle's public orbit prepares the other three views after its existing idle boundary. Derive their `src`, `srcSet` and `sizes` with Next Image's `getImageProps` and the same sizing policy as the displayed image; assign `sizes` and `srcset` before `src`. Loading the authored source URL would warm a different resource and waste a second transfer on selection. Keep the initial view as the only mounted image, preserve scheduled-work cleanup, and check `tests/angle-orbit-responsive-preload.test.ts` when changing this behavior. Future display quality or sizing changes must stay shared with preparation; validate actual browser selection at the relevant viewport and DPR.

The first orbit view uses the still-image style in server HTML and through hydration. Enable the existing entrance transition only after a button, keyboard or drag action changes the view; returning to the initial view remains an interaction. Keep reduced-motion handling and image-error fallback intact. An opacity-zero entrance can defer the LCP observation well beyond the image download, so do not infer render speed from image bytes alone.

## Playback and Core Web Vitals

The homepage poster must remain discoverable in server-rendered HTML with its existing responsive source, dimensions and critical priority. Do not make it depend on hydration, a video download or an idle callback. Initial media scheduling and an explicit Play action have different priorities.

The examples route hero also owns one responsive poster with explicit high fetch priority in the initial HTML. Keep this hint on `ExamplesHeroVideo`, alongside its existing `priority` setting; do not create another route-head preload or prioritize gallery cards while a route hero is present. This scheduling hint does not change the selected image, its quality, geometry, or mobile video loading policy. Validate its effect with comparable browser measurements; the HTML contract alone does not establish a performance gain.

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

Gallery cards retain their responsive optimized image underneath the video until actual `playing`, and show it again when waiting, paused or failed. A visible idle card has no video element. The card's visibility and hover/first-card policy request playback; `useExampleCardPlayback` applies hidden-tab, reduced-motion and Save-Data restrictions, then uses the shared attempt owner. Existing short previews remain preferred; only a missing-preview full video can use its prepared full-duration rendition. A failed short preview leaves the poster and watch link instead of fetching a large full video. Cards keep their existing narrow-mobile poster-only behavior. No native raw poster duplicates the optimized image request.

### Playback observations

The shared observer emits only `public_video_startup`, `public_video_rebuffer` and `public_video_error` through the existing consented analytics dispatcher. Common fields are allowlisted `asset_id`, `playback_profile` (`original`, `mobile`, `desktop`), `playback_surface` (`home`, `model`, `examples`, `watch`, `comparison`, `examples-card`) and `playback_trigger` (`user`, `automatic`). Startup adds `measurement_method` (`video_frame_callback` or explicitly labelled `playing_fallback`) and `duration_ms` from 0 to 120,000. Rebuffer adds `duration_ms` from 0 to 120,000 and `rebuffer_count` from 1 to 5. Error may add the native `media_error_code` from 1 to 4 and emits at most twice per observer.

The first-frame callback is armed when the video node attaches. `playing` is used for startup only when that callback API is unavailable; otherwise it completes a valid post-presentation rebuffer. Rebuffer timing starts only after first presentation while playback is intended and visible. Pausing, hiding, source replacement and disposal cancel pending observations. The payload does not admit URLs, private media, prompts, queries, user/job IDs or arbitrary model labels.

These bounded observations describe browser startup, rebuffer and errors for known public assets. They do not establish physical display, comparable Core Web Vitals or field performance by themselves.

Do not assume a lighter file or a higher Lighthouse score proves improvement. Before merging a performance-sensitive lot, compare the reference and candidate production builds on the same routes, media and conditions. Record the commit, environment, individual runs and variability. Include mobile/desktop and cold/warm cache scenarios; identify browser versus server cache explicitly. Check LCP/CLS, blocking work, critical requests and time until the form is usable. Exercise the actual interactions for INP diagnosis: Lighthouse TBT is not field INP.

Block a reproducible regression beyond baseline variability even if a metric remains in the green range. Inconclusive measurements are not evidence of a gain. Target field p75 LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 per device; confirm with route-level real-user samples after deployment and keep the old code/media references available for rollback. Functional and architecture tests do not certify field Core Web Vitals.

## Images and URL configuration

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
