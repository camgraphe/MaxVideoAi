# Kling Provider Routing Design

Date: 2026-05-14
Status: approved for implementation planning
Scope: design only, no code implementation in this phase

## Goal

Add a durable but lightweight video provider-routing layer so MaxVideoAI can route existing Kling 3 public engines through Kling direct first, with Fal as a controlled fallback before provider acceptance.

The first implementation target is Kling direct for:

- `kling-3-standard`
- `kling-3-pro`
- `kling-3-4k`

Public engine IDs, URLs, SEO pages, pricing anchors, and `/app?engine=...` links must remain unchanged.

## Non-Goals

- Do not migrate Seedance into the new provider-router in phase 1.
- Do not rename public engine slugs.
- Do not recalculate the user-facing MaxVideoAI price when fallback happens.
- Do not mark Kling direct jobs as completed using provider-hosted output URLs.
- Do not add automatic fallback after Kling direct has accepted a job.

## Official References

- Overview API: https://kling.ai/document-api/quickStart/productIntroduction/overview
- API key / user manual: https://kling.ai/document-api/quickStart/userManual
- Auth / common info: https://kling.ai/document-api/apiReference/commonInfo
- Callback protocol: https://kling.ai/document-api/apiReference/callbackProtocol
- Text to Video: https://kling.ai/document-api/apiReference/model/textToVideo
- Image to Video: https://kling.ai/document-api/apiReference/model/imageToVideo
- Video Omni: https://kling.ai/document-api/apiReference/model/OmniVideo
- Motion Control: https://kling.ai/document-api/apiReference/model/motionControl
- Billing Method: https://kling.ai/document-api/productBilling/billingMethod
- Prepaid Resource Packs: https://kling.ai/document-api/productBilling/prePaidResourcePackage
- Terms of API Service: https://kling.ai/document-api/protocols/paidServiceProtocol
- SLA: https://kling.ai/document-api/protocols/paidLevelProtocol
- Dev pricing page: https://kling.ai/dev/pricing

The official docs pages are rendered by Kling's web app. The details below were loaded from the live docs in a browser session on 2026-05-14. Implementation should still re-check them before shipping because provider docs can change without a versioned contract.

## Loaded Official API Details

Kling API base URL for this integration:

- `https://api-singapore.klingai.com`

Authentication:

- Requests use `Authorization: Bearer <API Token>`.
- The API token is a JWT signed with `HS256`.
- JWT header: `alg: "HS256"`, `typ: "JWT"`.
- JWT payload uses `iss: <access key>`, `exp: now + 1800 seconds`, and `nbf: now - 5 seconds`.
- The JWT is signed with `KLING_SECRET_KEY`.

Common async task statuses:

- `submitted`
- `processing`
- `succeed`
- `failed`

Common successful create-task response shape:

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_info": {
      "external_task_id": "string"
    },
    "task_status": "submitted",
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

Task query and callback responses include `task_result.videos[].url` and `final_unit_deduction`. Kling notes that generated images/videos are cleared after 30 days, so MaxVideoAI must copy video outputs into its own storage before marking jobs as completed.

Confirmed video endpoints:

- Text to Video create: `POST /v1/videos/text2video`
- Text to Video query single: `GET /v1/videos/text2video/{task_id}`
- Text to Video query list: `GET /v1/videos/text2video?pageNum=1&pageSize=30`
- Image to Video create: `POST /v1/videos/image2video`
- Image to Video query single: `GET /v1/videos/image2video/{task_id}`
- Omni Video create: `POST /v1/videos/omni-video`
- Omni Video query single: `GET /v1/videos/omni-video/{task_id}`
- Motion Control create: `POST /v1/videos/motion-control`

Confirmed request fields relevant to phase 1:

- Text to Video supports `model_name`, `prompt`, `negative_prompt`, `duration`, `mode`, `sound`, `aspect_ratio`, `callback_url`, `external_task_id`, `multi_shot`, `shot_type`, `multi_prompt`, and `cfg_scale`.
- Image to Video supports `model_name`, `image`, `image_tail`, `prompt`, `negative_prompt`, `duration`, `mode`, `sound`, `callback_url`, `external_task_id`, `multi_shot`, `shot_type`, `multi_prompt`, `cfg_scale`, `element_list`, `camera_control`, `static_mask`, and `dynamic_masks`.
- Omni Video supports `model_name`, `prompt`, `image_list`, `video_list`, `duration`, `mode`, `sound`, `aspect_ratio`, `callback_url`, `external_task_id`, `multi_shot`, `shot_type`, and `multi_prompt`.
- Kling `watermark_info` is intentionally not exposed or sent in phase 1; MaxVideoAI should always request the clean output path.
- `mode` enum: `std`, `pro`, `4k`.
- `sound` enum: `on`, `off`.
- `aspect_ratio` enum for relevant routes: `16:9`, `9:16`, `1:1`.
- `duration` enum for current Kling 3 routes: `3` through `15`.
- `cfg_scale` range: `[0, 1]`; docs state Kling v2.x models do not support it.

Confirmed model name enums relevant to phase 1:

- Text to Video includes `kling-v3`.
- Image to Video includes `kling-v3`.
- Omni Video includes `kling-v3-omni`; this route is intentionally deferred. Do not wire `kling-video-o1`.

Error classification details from General Info:

- Auth errors are HTTP `401`, service codes `1000`-`1004`; never fallback automatically.
- Account/resource errors include HTTP `429` service codes `1100`, `1101`, `1102`, and HTTP `403` service code `1103`; `1101` and `1102` represent arrears or depleted/expired resource packs and must not fallback automatically.
- Invalid request errors are service codes `1200`-`1203`; never fallback automatically.
- Policy/moderation errors are service codes `1300` and `1301`; never fallback automatically.
- Rate/concurrency errors are HTTP `429` service codes `1302` and `1303`; fallback can be allowed before provider acceptance.
- Internal provider errors are service codes `5000`, `5001`, and `5002`; fallback can be allowed before provider acceptance.

## Product Decisions

Kling direct starts in admin/test mode:

- `KLING_DIRECT_ENABLED`
- `KLING_DIRECT_PUBLIC_ROUTING_ENABLED=false`
- `KLING_DIRECT_FALLBACK_TO_FAL_ENABLED`
- `KLING_DIRECT_ADMIN_ONLY=true`
- `KLING_ACCESS_KEY`
- `KLING_SECRET_KEY`
- optional: `KLING_API_BASE_URL`

Secrets must only live in local or Vercel environment variables. They must not be pasted into chat, docs, fixtures, or logs.

## Provider Interface

Create a small server-only provider abstraction under `frontend/src/server/video-providers/`:

```ts
type VideoProviderAdapter = {
  key: 'fal' | 'kling_direct';
  submit(input: ProviderSubmitInput): Promise<ProviderSubmitResult>;
  poll(input: ProviderPollInput): Promise<ProviderPollResult>;
  normalizeResult(raw: unknown): NormalizedVideoProviderTask;
  normalizeError(error: unknown): NormalizedProviderError;
  estimateCost(input: ProviderCostInput): ProviderCostEstimate;
};
```

Phase 1 should adapt Fal with a thin wrapper around existing helpers and implement Kling direct as new focused modules:

- `kling-direct/client.ts`
- `kling-direct/payload.ts`
- `kling-direct/response.ts`
- `kling-direct/errors.ts`
- `kling-direct/cost.ts`
- `kling-direct/model-map.ts`

Keep `/api/generate` as an orchestrator. It should ask the provider router for an execution plan instead of embedding Kling-specific branches.

## Routing Flow

For Kling 3 engines, when flags allow Kling direct:

1. Create the normal `app_jobs` record using the public MaxVideoAI engine and price.
2. Create `provider_attempts` attempt `1` for `kling_direct`.
3. Submit to Kling direct.
4. If Kling returns a usable `task_id` / `provider_job_id`, mark the attempt accepted and set:
   - `app_jobs.provider = 'kling_direct'`
   - `app_jobs.provider_job_id = <task_id>`
5. Poll only Kling direct after acceptance.
6. If Kling submit fails without a usable task id and the error is fallback-safe, close attempt `1`, create attempt `2` for `fal`, and submit through Fal.
7. If Kling submit fails with a non-fallback-safe error, fail/refund using the existing payment failure rules.

Fallback-safe pre-acceptance errors:

- network timeout during submit
- HTTP 429 only when the service code is provider/rate/concurrency-related, such as `1302` or `1303`
- HTTP 5xx / service codes `5000`, `5001`, `5002`
- provider unavailable
- invalid provider response with no usable task id

Never fallback automatically for:

- moderation / safety rejection
- invalid request
- auth error
- insufficient credits
- unsupported params
- account arrears, depleted resource pack, expired resource pack, unauthorized API/model access
- any error after Kling direct returned a task id

## Polling Rules

After Kling direct acceptance:

- Poll Kling only.
- Do not submit Fal automatically during polling.
- If Kling reports failure, mark the job failed and refund according to the current job/payment rules.
- If polling stalls or times out, keep the job in a provider review state and record the attempt as stalled/admin-review. Do not launch Fal.
- Only mark `completed` after copying the provider output to MaxVideoAI/S3 and generating the normal media-library artifacts.

`app_jobs.provider` and `app_jobs.provider_job_id` remain the active accepted provider fields used by polling, media, and admin workflows.

## Provider Attempts Schema

Create a real Postgres migration in `neon/migrations/` and keep runtime schema bootstrap in sync if the project still relies on `ensureBillingSchema` for local/dev setup.

Minimal table:

```sql
CREATE TABLE provider_attempts (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES app_jobs(id) ON DELETE CASCADE,
  attempt_index INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_model TEXT,
  status TEXT NOT NULL,
  provider_job_id TEXT,
  started_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_code TEXT,
  error_class TEXT,
  fallback_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_to_attempt_id BIGINT REFERENCES provider_attempts(id),
  request_snapshot JSONB,
  response_snapshot JSONB,
  provider_cost_usd NUMERIC(12, 6),
  provider_cost_units NUMERIC(12, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, attempt_index)
);
```

Indexes:

- `(job_id, attempt_index)`
- `(provider, provider_job_id)` where `provider_job_id IS NOT NULL`
- `(status, updated_at)`
- `(provider, created_at DESC)`

In this schema, `provider_attempts.job_id` intentionally references `app_jobs.id` as requested. The public string job id remains `app_jobs.job_id`.

## Kling Direct Mapping

Initial mapping remains conservative and explicit for current phase 1 implementation:

- `kling-3-standard` -> Kling direct `model_name: "kling-v3"`, `mode: "std"`.
- `kling-3-pro` -> Kling direct `model_name: "kling-v3"`, `mode: "pro"`.
- `kling-3-4k` -> Kling direct `model_name: "kling-v3"`, `mode: "4k"`.

`kling-v3-omni` should be implemented later as a separate endpoint-family route, not hidden behind the current `text2video` / `image2video` mapping. `kling-video-o1` is excluded from the active plan.

Current V3 capability notes from the official capability map:

- `kling-v3` voice control is not supported; do not expose or submit `voice_list` for current direct routes.
- `kling-v3` I2V `std` and `pro` support `camera_control`, `static_mask`, `dynamic_masks`, and `element_list`.
- `kling-v3` I2V `4k` supports `element_list`, but not `camera_control` or motion brush.
- `image_tail`, `camera_control`, and `static_mask`/`dynamic_masks` are mutually exclusive and must be rejected before provider submit.

## Cost Accounting

The user price remains the MaxVideoAI public engine price already computed before provider submission. Provider fallback must not change the user-facing quote.

Kling direct cost audit should store returned `final_unit_deduction` or equivalent in:

- `provider_attempts.provider_cost_units`
- `provider_attempts.provider_cost_usd`
- existing job `cost_breakdown_usd` when the accepted provider completes

Known pricing facts to encode as implementation test fixtures or comments after verification:

- Video-3O Standard, no video input, no native audio: `0.6 units/s` = `$0.084/s`
- Video-3O Standard, no video input, native audio: `0.8 units/s` = `$0.112/s`
- Video-3O Pro, no video input, no native audio: `0.8 units/s` = `$0.112/s`
- Video-3O Pro, no video input, native audio: `1.0 unit/s` = `$0.14/s`
- Video-3O Pro, with video input, no native audio: `1.2 units/s` = `$0.168/s`
- Video-3O 4K: `3 units/s` = `$0.42/s`
- Kling V3.0 Pro with native audio: `1.2 units/s` = `$0.168/s`
- Failed tasks do not deduct credits according to Kling Billing Method.

## Testing Plan

Add focused architecture and behavior tests:

- Provider router builds `kling_direct -> fal` only for eligible Kling 3 engines and flags.
- Public engine IDs remain unchanged.
- `provider_attempts` migration contains required columns, FK, unique constraint, and indexes.
- Kling direct fallback is allowed only before provider acceptance.
- A returned `task_id` blocks automatic Fal fallback.
- Non-fallback errors fail without submitting Fal.
- Completed Kling direct jobs require copied MaxVideoAI/S3 media URLs.
- `/api/generate` remains an orchestrator and does not own Kling payload construction.

Manual smoke tests after implementation:

- Admin-only `kling-3-standard` text-to-video.
- Admin-only `kling-3-pro` text-to-video with `sound: "on"`.
- Admin-only `kling-3-pro` image-to-video.
- Admin-only `kling-3-4k` if the exact 4K request field is confirmed.
- Forced pre-acceptance fallback to Fal by simulating 429/5xx/no-task-id.
- Confirm Kling dashboard shows key `maxvideoai-kling` usage and that failed tasks are not deducted.

## Open Implementation Confirmations

- When to add `kling-v3-omni` as a separate endpoint family for Omni references.
- Exact provider status values and terminal failure messages.
- Whether callbacks are reliable enough for phase 1 or polling should be primary with callback support added later.
