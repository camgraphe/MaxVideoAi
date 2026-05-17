# Google Vertex Veo Provider Routing Design

Date: 2026-05-17
Status: approved for implementation planning
Scope: Vertex AI / Agent Platform direct provider routing for public Veo engines, with Fal fallback retained

## Goal

Add Google Vertex AI / Agent Platform as the primary internal provider for MaxVideoAI Veo engines, while keeping existing public slugs, URLs, SEO pages, pricing anchors, and `/app?engine=...` links unchanged.

Public engine IDs remain:

- `veo-3-1`
- `veo-3-1-fast`
- `veo-3-1-lite`

The internal provider key is `google_vertex_veo_direct`. Fal remains the fallback provider, but only before Google accepts a job and returns a usable long-running operation name.

## Non-Goals

- Do not use Gemini API key auth for this integration.
- Do not rename public engine slugs.
- Do not recalculate the user-facing MaxVideoAI price when fallback happens.
- Do not mark Google jobs as completed using provider-hosted output URLs.
- Do not add automatic fallback after Google returns an operation name.
- Do not route `veo-3-1-lite` to a non-Lite Vertex model.
- Do not expose Lite 4K; current Agent Platform docs list Lite output resolutions as `720p` and `1080p`.
- Do not expose multi-output `sampleCount` in phase 1 because MaxVideoAI job/media/pricing still assumes one output per generation.

## Official References

- Agent Platform model index: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models
- Agent Platform Veo 3.1 model details: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate
- Agent Platform Veo video generation API: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation
- Text-to-video guide: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-text
- Image-to-video guide: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-an-image
- Reference images guide: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/use-reference-images-to-guide-video-generation
- Extend guide: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/extend-a-veo-video
- Agent Platform pricing, Veo section: https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing
- Vertex AI locations: https://docs.cloud.google.com/vertex-ai/docs/general/locations
- Generative AI on Vertex AI locations: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations

Implementation must re-check the official docs before shipping because Google is actively moving Vertex AI generative services into Gemini Enterprise Agent Platform and provider docs can change without a versioned app contract.

## Confirmed Account Context

- Google Cloud project ID: `dark-furnace-496521-g5`
- Initial location: `us-central1`
- Organization has API-key authentication disabled.
- Billing/trial is active.
- Required Agent Platform APIs are reported as enabled in console.
- Service account to create: `maxvideoai-veo-provider`
- Secrets must only be stored in local or Vercel environment variables. They must not be pasted into chat, docs, fixtures, or logs.

## Auth And Env

Phase 1 uses a dedicated service account JSON in Vercel sensitive environment variables. Workload Identity Federation can replace the JSON key later.

Required flags:

- `GOOGLE_VERTEX_VEO_ENABLED=true`
- `GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED=false`
- `GOOGLE_VERTEX_VEO_FALLBACK_TO_FAL_ENABLED=true`
- `GOOGLE_VERTEX_PROJECT_ID=dark-furnace-496521-g5`
- `GOOGLE_VERTEX_LOCATION=us-central1`
- `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON`
- `GOOGLE_VERTEX_VEO_POLL_TOKEN`

Optional future flags:

- `GOOGLE_VERTEX_VEO_ADMIN_ONLY=true`
- `GOOGLE_VERTEX_VEO_OUTPUT_GCS_URI`
- `GOOGLE_VERTEX_VEO_INPUT_GCS_URI`

Minimum IAM target for the service account:

- Start with Vertex AI user permissions sufficient for publisher model `predictLongRunning` and operation polling.
- Add Cloud Storage object permissions for the configured output bucket and, if Extend uses non-`gs://` source videos, the configured `GOOGLE_VERTEX_VEO_INPUT_GCS_URI` bucket/prefix.

## Vertex API Shape

Vertex publisher model requests use the regional AI Platform endpoint:

```text
POST https://us-central1-aiplatform.googleapis.com/v1/projects/dark-furnace-496521-g5/locations/us-central1/publishers/google/models/{MODEL_ID}:predictLongRunning
```

Polling uses the operation returned by Google. The exact operation polling endpoint should be verified during implementation from the live response shape; store the full operation `name` as `provider_job_id`.

Google acceptance boundary:

- Accepted means Google returns a usable `operation.name`.
- Before `operation.name`, fallback to Fal may be considered for safe transient errors.
- After `operation.name`, Google is authoritative and must be polled until terminal success/failure/stall.

## Model Mapping

Initial conservative mapping:

| Public engine | Vertex model | Phase 1 routing |
| --- | --- | --- |
| `veo-3-1` | `veo-3.1-generate-001` | Google direct primary for supported modes; 4K is a Preview capability |
| `veo-3-1-fast` | `veo-3.1-fast-generate-001` | Google direct primary for supported modes; 4K is a Preview capability |
| `veo-3-1-lite` | `veo-3.1-lite-generate-001` | Google direct primary for supported modes, including Extend, `720p`/`1080p` only |

The docs also list preview model IDs such as `veo-3.1-generate-preview` and `veo-3.1-fast-generate-preview`. Do not choose preview IDs by default if `-001` IDs are available for the required mode. `veo-3.1-lite-generate-001` is a `-001` model ID but its launch stage is Preview, so keep it behind the same phase-1 routing flags until smoke-tested.

## Supported Options To Expose

Google Vertex Veo options that should be represented in MaxVideoAI controls where supported by the selected public engine and mode:

- `prompt`
- `image` for start-frame image-to-video
- `lastFrame` for first/last-frame interpolation
- `referenceImages` up to three images when using a supported Vertex model
- `aspectRatio`: `16:9`, `9:16`
- `durationSeconds`: `4`, `6`, `8` for generation; `7` fixed for Extend output
- `resolution`: `720p`, `1080p`; `4k` for Standard/Fast only
- `generateAudio`
- `enhancePrompt`
- `personGeneration`
- `seed`
- `compressionQuality`
- `resizeMode`: `pad`, `crop` for image-input workflows only
- `video.gcsUri` for Extend, with non-`gs://` source videos staged to `GOOGLE_VERTEX_VEO_INPUT_GCS_URI`

MaxVideoAI should remove or mark Fal-only options that Google cannot represent exactly. In particular:

- `1:1` aspect ratio is not a Google Vertex Veo phase 1 option.
- Reference image count should be capped at three for Google direct.
- Reference asset images are not supported by `veo-3.1-lite-generate-001`.
- Extend is Google-direct capable when the request has a source MP4 and output duration is fixed to `7s`. Standard/Fast expose `720p`, `1080p`, and `4k`; Lite exposes `720p` and `1080p`.
- `veo-3-1-lite` should not expose `4k` because current Google docs list Lite output resolutions as `720p` and `1080p`.
- `sampleCount` stays fixed at `1`.

## Provider Interface

Reuse the provider abstraction already introduced for Kling under `frontend/src/server/video-providers/`.

The Google implementation should be focused modules, not a large branch inside `/api/generate`:

- `google-vertex-veo/client.ts`
- `google-vertex-veo/payload.ts`
- `google-vertex-veo/response.ts`
- `google-vertex-veo/errors.ts`
- `google-vertex-veo/cost.ts`
- `google-vertex-veo/model-map.ts`
- `google-vertex-veo/video-input.ts`
- `google-vertex-veo/index.ts`

Existing `provider_attempts` should be reused. No new migration is expected unless implementation discovers that provider-specific audit data cannot fit into `request_snapshot`, `response_snapshot`, `provider_cost_usd`, and `provider_cost_units`.

## Routing Flow

For supported Veo engines and modes when flags allow Google direct:

1. Create the normal `app_jobs` record using the public MaxVideoAI engine and public price.
2. Create `provider_attempts` attempt `1` for `google_vertex_veo_direct`.
3. Submit to Vertex AI `predictLongRunning`.
4. If Google returns `operation.name`, mark attempt accepted and set:
   - `app_jobs.provider = 'google_vertex_veo_direct'`
   - `app_jobs.provider_job_id = <operation.name>`
5. Poll only Google after acceptance.
6. If Google submit fails without `operation.name` and the error is fallback-safe, close attempt `1`, create attempt `2` for `fal`, and submit through Fal.
7. If Google submit fails with a non-fallback-safe error, fail/refund using the existing payment failure rules.

For unsupported Google-direct options or modes:

- Route to Fal as the primary provider before any Google submit.
- Record only the accepted provider attempt that actually runs unless a Google attempt was made.
- Do not silently drop user intent to make a request fit Google.

## Fallback Rules

Fallback-safe before Google acceptance:

- network timeout during submit
- HTTP `429` quota/rate/concurrency failure
- HTTP `5xx`
- provider unavailable
- invalid provider response with no usable `operation.name`

Never fallback automatically for:

- moderation or safety rejection
- invalid request
- auth or IAM error
- billing disabled or hard account access error
- unsupported params
- any error after Google returned `operation.name`
- options that cannot be represented in the Fal payload without losing intent

## Polling Rules

After Google acceptance:

- Poll Google only.
- Do not submit Fal automatically during polling.
- If Google reports terminal failure, mark the job failed and refund according to current job/payment rules.
- If polling stalls or times out, keep the job in provider review/stalled state and record the attempt as stalled/admin-review. Do not launch Fal.
- Only mark `completed` after copying the provider output to MaxVideoAI storage and creating normal media-library artifacts.

## Cost Audit

User-facing MaxVideoAI price remains the existing public engine price.

Provider audit cost should store a best available estimate or actual provider cost:

- `provider_cost_usd`: Google cost estimate based on model, duration, resolution, and audio setting unless Google returns a more authoritative cost signal.
- `provider_cost_units`: leave `NULL` unless Google returns a native unit value.

Known public pricing baseline to encode for estimates:

- Veo 3.1 video + audio: `$0.40/s` for `720p` and `1080p`; `$0.60/s` for `4k`
- Veo 3.1 video-only: `$0.20/s` for `720p` and `1080p`; `$0.40/s` for `4k`
- Veo 3.1 Fast video + audio: `$0.10/s` for `720p`; `$0.12/s` for `1080p`; `$0.30/s` for `4k`
- Veo 3.1 Fast video-only: `$0.08/s` for `720p`; `$0.10/s` for `1080p`; `$0.25/s` for `4k`
- Veo 3.1 Lite video + audio: `$0.05/s` for `720p`; `$0.08/s` for `1080p`
- Veo 3.1 Lite video-only: `$0.03/s` for `720p`; `$0.05/s` for `1080p`
- Veo 2 video: `$0.50/s`

Keep pricing estimates isolated in `google-vertex-veo/cost.ts` so future Google SKU changes are easy to update.

## Phase Plan

Phase 1:

- Add spec and implementation plan.
- Add `google_vertex_veo_direct` adapter and router support.
- Wire `veo-3-1`, `veo-3-1-fast`, and `veo-3-1-lite` for Google-direct supported modes.
- Wire Google-direct Extend for Standard/Fast with MP4 source staging and fixed `7s` output, including 4K when selected.
- Wire Lite Extend with MP4 source staging and fixed `7s` output, without 4K.
- Add cron route for Google Vertex Veo polling.
- Keep public routing disabled by default.

Phase 2:

- Enable admin/test routing locally and in Vercel preview.
- Run smoke tests with service account credentials.
- Confirm exact Vertex response shape, output copy behavior, and cost estimates.
- Decide whether preview model IDs are needed for reference images or extension.

Phase 3:

- Enable public routing for supported modes only.
- Monitor `provider_attempts` for Google acceptance, fallback rate, failure classes, and actual margin.
- Consider Workload Identity Federation to remove long-lived service account JSON.
