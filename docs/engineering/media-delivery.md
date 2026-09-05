# Media Delivery Guide

Read this guide when changing image/video presentation, poster URLs, generated media, thumbnail repairs, or public model examples. Keep model identity in `frontend/config/model-registry.json`; media delivery is not another model registry.

## Existing ownership

| Area | Owner |
| --- | --- |
| Homepage presentation | `frontend/components/marketing/home/HeroVideoShowcase.tsx` |
| Homepage playback lifecycle | `frontend/components/marketing/home/useHeroVideoPlayback.ts` |
| Critical homepage poster | `HomeLcpPoster.tsx` and `home-lcp-image.ts` in the same directory |
| Example gallery playback | `frontend/components/examples/ExampleGalleryCard.tsx` and `ExamplesHeroVideo.client.tsx` |
| Model hero playback | `frontend/components/marketing/ModelHeroMedia.client.tsx` |
| Shared public playback policy and observations | `frontend/lib/public-video-playback.ts` |
| Shared browser attempt/fallback lifecycle | `frontend/components/media/usePublicVideoPlayback.ts` |
| Optimized poster URLs | `frontend/lib/media-helpers.ts` and `frontend/config/image-optimizer.json` |
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

Playback hooks stay client-side; encoding, storage and database work stay server-side. Pages compose these owners. Do not put provider, pricing, storage or encoding responsibilities in a playback component. Route-specific workspace behavior stays under its existing `_hooks`, `_lib` and `_components` boundaries.

## Original, thumbnail and preview are different contracts

- Keep the durable original URL available for downloads, editing and precise inspection. A presentation optimization must not silently substitute a low-resolution derivative in these actions.
- Use a thumbnail sized for a grid or reference slot. A missing thumbnail is a repair condition; do not eagerly fetch a large original for every small tile.
- Existing video grid previews are short, silent and deliberately lower cadence/resolution. They are not suitable evidence of a model's full motion quality or audio.
- Use a representative full-duration rendition for a model demonstration after its derivative has passed the measured media gates, explicit visual/audio review, public HTTP readiness and activation. A profile with a validated savings omission deliberately uses the original.
- Preserve private/signed URL behavior. Public image optimization does not forward a user's authorization headers; do not strip signatures or publish a private source to make optimization work.
- Preserve aspect ratio, alpha/transparency when required, orientation, and the distinction between original quality and display quality.

## Playback and Core Web Vitals

The homepage poster must remain discoverable in server-rendered HTML with its existing responsive source, dimensions and critical priority. Do not make it depend on hydration, a video download or an idle callback. Initial media scheduling and an explicit Play action have different priorities.

- Automatic video loading remains deferred and subject to device/motion/data-saving preferences and visibility. Never mount or preload every video to make selection appear faster.
- A user Play action may load immediately. Show loading until actual playback; keep a stable cover through buffering and failures. Do not interpret the `play` event as proof that frames are being presented.
- Pause offscreen/hidden playback; respect a user pause when visibility returns. Cancel pending callbacks and ignore stale media events/play promises after source changes.
- Preserve fixed media geometry and control layout through idle/loading/playing/paused/error states. Avoid an extra native poster download when an optimized image already provides the cover.
- Keep playback behavior independent of model IDs. A new item should receive the same policy through data, not a new conditional in the hook.

Shared public playback chooses one profile when an attempt begins and keeps it for that attempt: `mobile` below 768 px, `desktop` otherwise, with an explicit user start allowed to prefer `mobile` when the browser reports Save-Data. Unknown, private or signed inputs pass through the exact original URL. If a known derivative fails, the attempt falls back to the original at most once while retaining play intent, mute state and startup timing. Original download, edit and schema URLs never change to derivative URLs.

Homepage mobile loading remains lazy, and the critical poster and fixed geometry remain present before hydration. Model, examples and homepage readers share rendition/fallback mechanics while retaining their surface-specific controls, autoplay eligibility, visibility rules and posters. Do not add per-model playback branches.

### Playback observations

The shared observer emits only `public_video_startup`, `public_video_rebuffer` and `public_video_error` through the existing consented analytics dispatcher. Common fields are allowlisted `asset_id`, `playback_profile` (`original`, `mobile`, `desktop`), `playback_surface` (`home`, `model`, `examples`) and `playback_trigger` (`user`, `automatic`). Startup adds `measurement_method` (`video_frame_callback` or explicitly labelled `playing_fallback`) and `duration_ms` from 0 to 120,000. Rebuffer adds `duration_ms` from 0 to 120,000 and `rebuffer_count` from 1 to 5. Error may add the native `media_error_code` from 1 to 4 and emits at most twice per observer.

The first-frame callback is armed when the video node attaches. `playing` is used for startup only when that callback API is unavailable; otherwise it completes a valid post-presentation rebuffer. Rebuffer timing starts only after first presentation while playback is intended and visible. Pausing, hiding, source replacement and disposal cancel pending observations. The payload does not admit URLs, private media, prompts, queries, user/job IDs or arbitrary model labels.

These bounded observations describe browser startup, rebuffer and errors for known public assets. They do not establish physical display, comparable Core Web Vitals or field performance by themselves.

Do not assume a lighter file or a higher Lighthouse score proves improvement. Before merging a performance-sensitive lot, compare the reference and candidate production builds on the same routes, media and conditions. Record the commit, environment, individual runs and variability. Include mobile/desktop and cold/warm cache scenarios; identify browser versus server cache explicitly. Check LCP/CLS, blocking work, critical requests and time until the form is usable. Exercise the actual interactions for INP diagnosis: Lighthouse TBT is not field INP.

Block a reproducible regression beyond baseline variability even if a metric remains in the green range. Inconclusive measurements are not evidence of a gain. Target field p75 LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 per device; confirm with route-level real-user samples after deployment and keep the old code/media references available for rollback. Functional and architecture tests do not certify field Core Web Vitals.

## Images and URL configuration

Use `buildExamplePosterProjection` for the shared API/gallery poster fields, or the shared poster builder and its named presets when an explicit optimized URL is needed. `next/image` should normally receive the original allowed source plus responsive `sizes`; do not optimize an already optimized URL again. Widths and qualities in emitted `/_next/image` requests must be admitted by the actual Next configuration. Do not add per-route quality constants or hand-build optimizer query strings.

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

The two profiles are independent. Insufficient savings records an explicit omission and keeps the exact original for that profile. An operational encode/probe failure is retryable and does not erase a sibling success. Publishing a replacement preserves an already active rendition until the new pending candidate passes current HTTP/Range verification and activation. Pending-only candidates and failures without an active rendition or omission do not satisfy critical-home coverage.

`public-video-sources.json` is the authored source catalogue. `public-video-renditions.manifest.json` is the full measured and reviewed state, including immutable storage identity, hashes, bytes, probes, omissions, failures, pending candidates and active HTTP evidence. `public-video-renditions.generated.json` is a browser-only projection of active display URLs and must not be edited by hand. The offline check validates source/manifest/projection coherence and fails on a stale projection. Activation writes the manifest before the projection, so an interrupted projection write can leave a recoverable stale projection; rerun the explicit `activate` command after verifying the intended manifest state and current public object to regenerate it.

Derivative URLs are content- and profile-version-addressed immutable objects. Do not change profile settings under a profile version that has already been published. A future profile change needs a new version and a reviewed migration of preparation, manifest and projection state; this migration is not automatic.

Review evidence records explicit visual and audio content acceptance. It is separate from deployment readiness: HTTP/Range verification and activation establish public object readiness, while Safari/iOS, other supported browsers, comparable Core Web Vitals and actual interactions still gate rollout. Keep original files and rollback references; this work does not authorize original or broad storage deletion.

## Repair and cleanup

Thumbnail repair must start with a truly read-only inventory: SELECTs are allowed; schema creation, original downloads, encoding, uploads and UPDATEs are not. Use the repair command's explicit apply mode only for an authorized bounded repair. Test against controlled fixtures before touching live data. Schema changes belong to application migrations, not to a simulation entry point.

Keep scan order stable when repairs update rows. Preserve valid originals and thumbnails; report candidate, successful, failed and skipped work separately. Do not equate attempted uploads with completed repair. Bound total work, batches and retries, and avoid overwriting concurrent edits.

### Image thumbnail repair command

`frontend/scripts/backfill-image-thumbnails.ts` owns the CLI and deferred I/O imports; `frontend/scripts/_lib/image-thumbnail-backfill.ts` owns option validation and the injected scan/update orchestration. The default is a read-only inventory. With pnpm, pass flags directly, without a separating `--`:

```sh
pnpm --prefix frontend run thumbs:image-backfill --dry-run --after-id=0 --max=100 --batch-size=25
# Apply the SAME inventoried range, starting from its original cursor:
pnpm --prefix frontend run thumbs:image-backfill --apply --after-id=0 --max=100 --batch-size=25
```

Apply requires an authorized bounded repair. Batch size is 1–100 (default 25 or `IMAGE_THUMB_BACKFILL_BATCH`); maximum scanned rows per invocation is 1–10,000 (default 100 or `IMAGE_THUMB_BACKFILL_MAX`). `--after-id` accepts 0 through PostgreSQL's signed bigint maximum, defaults to 0, and is retained as a string. Unknown/conflicting flags fail before database/encoding modules load.

The summary reports actual `lastScannedId` and a separate conservative `resumeAfterId`. Use the latter to continue a run in the **same mode**: it freezes before the first failed or partially failed apply row. A dry-run cursor only continues inventory; switching to apply must use that inventory range's original starting cursor, or candidates would be skipped. Existing repaired rows are reread and skipped without regenerating their thumbnails.

An apply row can increment both `updated` and `failed` after a partial repair; remaining missing thumbnails remain retryable. Apply exits nonzero if any row failed, and conflicts never overwrite a newer row. The optimistic predicate uses exact `updated_at::text`, prior JSONB renders and the previous hero URL, preserving PostgreSQL timestamp precision.

No checkpoint file is written. A hard process kill can prevent the final summary from printing; restart from the prior saved starting cursor. Tests simulate rejected operations/lost acknowledgments before upload, after upload and after database update, rather than OS signal handling. An uncertain upload can leave an unreferenced derivative and a retry can upload again. Do not claim exactly-once processing or delete originals/other assets to compensate. A lost database acknowledgment is treated as failure; retry rereads stored state before deciding whether repair is still needed.

Remove obsolete code/configuration in the lot that replaces it. Keep compatibility adapters only while known consumers still need them. For storage deletion, first inventory references from jobs, the library, public examples, watch pages and localized content. Distinguish temporary files, replaced derivatives and user originals; never delete a broad set simply because it is old.

## Validation checklist

- Behavioral tests for the edited playback or URL/repair boundary, including the bug's reproduction.
- Existing relevant performance, media, architecture and localized-route contracts.
- `npm --prefix frontend run lint`, `npm run lint:exposure`, `git diff --check`.
- Production build and browser smoke for changed public surfaces; explicit before/after performance evidence for initial-load changes.
- Supported browser checks for media behavior, including Safari/iOS before broad rollout; record any untested environment rather than claiming coverage.
- Documentation describes shipped code without treating incomplete browser, device or field-performance validation as finished.
