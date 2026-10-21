# Kling V4 — qualification and owned-media publication

Prepared 2026-10-22. This is the execution procedure for a later authorized batch. No paid attempt, render, upload or public playlist edit has been performed. The ten scenarios in `films.json` are unrendered creative proposals; `films.md` explains them in French.

## Before a render

Establish the direct V4 account entitlement and exact create/poll/callback contract, then separately establish fal access. Neither an HTTP200 public schema nor a working legacy account query proves V4 execution permission. Qualify each provider independently; do not send V3-shaped requests to an inferred V4 route.

Use the existing Camgraph admin generation/library workflow once the actual App, Studio or MCP controls are certified. Bind each reference to its owned asset identity and exact original. Validate dimensions, bytes, duration and FPS from server-resolved metadata. The 30-second video-reference budget includes element videos; the provider's mixed fifteen-asset counting and fractional source billing still need confirmation. Per-element voices need provider-specific provenance and ownership; a fal voice ID is not automatically portable to Kling direct.

Record the exact prompt or shot plan, model/mode, references in authored order, duration/resolution, provider and immutable quote. Obtain the user's approval of the actual bounded quote before the first paid attempt. Existing FLUX spending approvals do not cover Kling V4. A retry or fallback must preserve the quoted request and obey its authorized attempt/spend limits.

## Qualification matrix

| Mode | Evidence required |
| --- | --- |
| Text to video | Prompt-only and actual multishot scenes, 720p/1080p, valid total duration, framing and native audio checked in the entire result |
| Image to video | Owned start image and optional end image, composition/identity continuity, geometry inherited correctly from frames |
| References to video | Ordered images, optional start, reference videos and elements; seven-subject and max-three voiced/video-element boundaries; cross-shot identity and reference influence inspected |
| Edit | Exact owned source, image references/elements, explicit and inherited duration behavior, source-audio/edit semantics and measured billable duration |
| Provider recovery | Known non-acceptance, accepted job followed by persistence error, timeout/missing task ID, poll/callback replay, failure/refund and fallback portability |

Fault/replay cases should use deterministic fixtures first. Never create a second paid task merely to test whether an ambiguously accepted first task exists. Preserve provider task identity and the existing attempt/ledger owner. Direct-first routing must remain unavailable until these cases and the verified direct transport are implemented; the branch's conservative fallback predicate alone is not that integration.

## Accepting and delivering media

Inspect every complete output with audio, not just its poster. Record actual duration, dimensions, bytes, codec, audio and provider job evidence; mark incoherent outputs rejected/private. Criterion scores must cite the evaluated clips and method, distinguish vendor claims from observations and disclose the sample size. Do not infer scores from the model name, publicity or another model's output.

Keep the canonical owned original in MaxVideoAI media storage and retain its generation/job/library ownership. Generate a representative image thumbnail and a short silent card preview through the established media pipeline. Verify projections in `app_jobs`, `job_outputs`, `media_assets` and any legacy `user_assets`; preserve the original URL for downloads, editing and schema.

The existing `external-fal-import/contract.ts` is FLUX-specific. Do not rename a Kling job into that manifest or write around it with SQL. If the approved official workflow cannot generate, add and test an explicit Kling importer with owner/idempotency/payment guards before importing real results.

For every accepted original, poster and short preview, verify durable owned URLs, public HTTP200 when publication is authorized, byte range206 for videos, measured file hashes and playable output. For hero/full-duration display derivatives, use `public-video-sources.json` and the documented rendition preparation, review, publication and activation flow. Run the public-rendition check. Do not overwrite immutable hash URLs or equate a short card preview with a full hero rendition.

## Marketing placement after approval

1. At least two accepted landscape videos are required by the V4 launch-asset gate. Each needs its owned original, poster, short preview, prompt/settings and exact V4 attribution. More creative scenes can be selected for the model hero, prompt demo and family gallery only after review.
2. Add accepted clips to the exact V4 model playlist and existing Kling family through the dedicated admin module. Snapshot the current owner order and preserve it; add new entries deliberately without replacing historical Kling clips, URL, canonical or core family copy.
3. Enroll only selected complete videos through the dedicated video-SEO admin workflow, with accurate English descriptions, localized page copy where supported, transcript/audio facts, visible prompt/settings and useful model/family links. Do not bulk index every render or emit VideoObject without playable owned media.
4. Create the real source manifest at `docs/model-launch/kling-v4-video-example-pack.json` only after evidence exists. Run `pnpm model:launch-assets:generate` and `pnpm model:launch-assets:check`. A fabricated manifest, public flag, fallback demo or empty playlist cannot satisfy readiness.
5. Verify model/family/home readers select the approved exact source, preserve responsive geometry and poster priority, lazy card previews and manual `preload=none`. Test first Play and actual network transfers; measure comparable Core Web Vitals when changing initial-loading media.

No production placement or indexing flip belongs to this preparation branch. Existing owner-curated Kling/FLUX playlists, historical SEO pages and the completed FLUX launch stay intact.
