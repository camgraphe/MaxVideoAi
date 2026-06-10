# Luma Agents Provider

Date: 2026-06-10
Status: implemented behind feature flags

## Overview

MaxVideoAI supports Luma Agents through two paths:

- Luma direct, using `https://agents.lumalabs.ai/v1/generations`.
- fal.ai fallback, using the public fal Luma Agent model endpoints.

The public engine slugs are:

- `luma-ray-3-2` for video text-to-video and image-to-video.
- `luma-uni-1` for image text-to-image and image-to-image editing.
- `luma-uni-1-max` for higher-fidelity image text-to-image and image-to-image editing.

Direct Luma routing is primary only when flags are enabled and the request shape can be handled safely. fal.ai remains the safety path for rate limits, concurrent-job limits, transient provider errors, timeouts, or public options that only fal can cover.

## Public Scope

Public launch exposes only routes that keep a fal fallback path:

- Ray 3.2 video: `t2v` and `i2v`, 5s/10s, 540p/720p/1080p, loop where valid, public aspect ratios from the app controls, source images for direct image-to-video, and fal-only fallback-safe reference-image shapes where the fal schema accepts them.
- Uni-1 image: `t2i` and `i2i`, 2K output, supported aspect ratios for generation, source image plus references for edit, `auto`/`manga` style, PNG/JPEG, optional web search for generation.
- Uni-1 Max image: same public controls as Uni-1, with the Max pricing and model route.

Ray 3.2 video comparisons are allowed only against video models. Uni image models are excluded from public compare/VS pages.

## Advanced Scope

`LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED` gates Luma-only options that do not have a fal-equivalent fallback. Keep it false for public rollout.

Deferred direct-only scope includes:

- Ray 3.2 `video_edit`.
- Ray 3.2 `video_reframe`.
- HDR / EXR output.

Single-keyframe extend workflows remain unsupported in the current runtime, even when advanced direct-only routing is enabled.

If this flag is enabled in an admin/labs context, do not silently send those requests to fal. If the direct request cannot be accepted, fail/refund through the normal provider error path.

## Environment

Server-only variables:

```txt
LUMA_AGENTS_API_KEY=
LUMA_AGENTS_BASE_URL=https://agents.lumalabs.ai
LUMA_AGENTS_ENABLED=false
LUMA_AGENTS_PUBLIC_ROUTING_ENABLED=false
LUMA_AGENTS_ADMIN_ONLY=true
LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED=true
LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED=false
LUMA_AGENTS_IMAGE_DIRECT_ENABLED=false
LUMA_AGENTS_VIDEO_DIRECT_ENABLED=false
LUMA_AGENTS_SUBMIT_TIMEOUT_MS=30000
LUMA_AGENTS_POLL_TIMEOUT_MS=30000
LUMA_AGENTS_POLL_INTERVAL_MS=5000
LUMA_AGENTS_VIDEO_POLL_MAX_MINUTES=35
LUMA_AGENTS_IMAGE_SYNC_TIMEOUT_MS=180000
LUMA_AGENTS_POLL_TOKEN=
```

`LUMA_AGENTS_POLL_TOKEN` is optional when `CRON_SECRET` and Vercel Cron authentication are configured. It is useful for local/manual cron calls through the `x-luma-agents-poll-token` header.

## Pricing Policy

Customer-facing prices are based on fal reference costs plus the existing MaxVideoAI display pricing rule. Do not discount the customer quote when direct Luma is cheaper.

The direct Luma cost is stored as internal provider-attempt metadata, and video completions also mirror the accepted direct cost in the job cost breakdown for reconciliation:

- `provider_attempts.provider_cost_usd`
- `provider_attempts.provider_cost_units`
- `provider_attempts.request_snapshot`
- `provider_attempts.response_snapshot`

This means:

- customer quotes stay stable across direct and fallback paths;
- direct Luma increases internal margin when it is cheaper than fal;
- reconciliation can compare charged display price, fal-reference basis, and actual direct-provider cost.

## Fallback Policy

Fallback to fal is allowed only before Luma accepts a generation.

Allowed pre-acceptance fallback cases:

- HTTP 429 rate limit or concurrent-job limit.
- transient HTTP 5xx provider errors.
- network failure or submit timeout.
- invalid direct response with no accepted generation id.
- a public request shape that is supported by fal but not by Luma direct.

Never fallback automatically for:

- auth or missing API key;
- billing/access failures;
- moderation or policy rejection;
- invalid user request;
- unsupported direct-only options;
- any failure after Luma returns an accepted generation id.

Once Luma returns a generation id, polling stays on Luma. If the accepted job fails later, mark the job failed and refund according to normal job/payment rules. Do not launch a second fal render.

## Polling And Output Copy

Luma output URLs are temporary provider URLs. MaxVideoAI must copy completed outputs to its own storage before marking the job completed.

Video:

- Accepted video jobs are polled by `/api/cron/luma-agents-poll`.
- Polling selects active `app_jobs` with provider `luma_agents_direct`.
- Completed provider MP4s pass through the normal fast-start/copy path before completion.
- Thumbnails, previews, keyframes, and legacy media-library outputs are written after the stable copy exists.
- Stalled jobs are marked for provider review rather than submitted to fal.

Image:

- Image direct execution is synchronous from the API point of view.
- It polls until complete, failed, or `LUMA_AGENTS_IMAGE_SYNC_TIMEOUT_MS`.
- Direct image outputs must be copied to MaxVideoAI storage before the common image persistence path runs.
- If the copy still points to an expiring provider URL, the direct result is rejected instead of being persisted.

## Rollout Checklist

1. Deploy with all Luma direct flags false. Confirm fal-only behavior for the three Luma engines.
2. Set:

```txt
LUMA_AGENTS_ENABLED=true
LUMA_AGENTS_VIDEO_DIRECT_ENABLED=true
LUMA_AGENTS_IMAGE_DIRECT_ENABLED=true
LUMA_AGENTS_ADMIN_ONLY=true
LUMA_AGENTS_PUBLIC_ROUTING_ENABLED=false
LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED=true
LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED=false
```

3. Run admin smoke tests:
   - Uni-1 text image.
   - Uni-1 image edit.
   - Uni-1 Max text image.
   - Ray 3.2 5s 720p text-to-video.
   - Ray 3.2 5s image-to-video.
4. Force a pre-acceptance fallback by mocking Luma 429 or transient 5xx. Verify `provider_attempts` records Luma failed before acceptance and fal started.
5. Verify an accepted Luma video completes through `/api/cron/luma-agents-poll`, copies to MaxVideoAI storage, and records provider cost.
6. Enable public image direct first:

```txt
LUMA_AGENTS_PUBLIC_ROUTING_ENABLED=true
LUMA_AGENTS_ADMIN_ONLY=false
LUMA_AGENTS_IMAGE_DIRECT_ENABLED=true
LUMA_AGENTS_VIDEO_DIRECT_ENABLED=false
```

7. Enable public Ray 3.2 direct after image direct is stable by setting `LUMA_AGENTS_VIDEO_DIRECT_ENABLED=true` while keeping `LUMA_AGENTS_PUBLIC_ROUTING_ENABLED=true` and `LUMA_AGENTS_ADMIN_ONLY=false`.
8. Keep `LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED=false` until product explicitly accepts no-fallback advanced options.

## Operational Checks

Use these focused checks after provider changes:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/luma-agents-pricing.test.ts \
  tests/luma-agents-provider-routing.test.ts \
  tests/luma-agents-payload.test.ts \
  tests/luma-agents-response.test.ts \
  tests/luma-agents-video-submission.test.ts \
  tests/luma-agents-poll.test.ts \
  tests/luma-agents-image-payload.test.ts \
  tests/luma-agents-image-provider.test.ts \
  tests/luma-agents-marketing-surfaces.test.ts
pnpm model:check
pnpm models:audit
git diff --check
```

Before enabling public traffic, also smoke-test localized model pages:

- `/models/luma-ray-3-2`
- `/fr/modeles/luma-ray-3-2`
- `/es/modelos/luma-ray-3-2`
- `/models/luma-uni-1`
- `/fr/modeles/luma-uni-1`
- `/es/modelos/luma-uni-1`
- `/models/luma-uni-1-max`
- `/fr/modeles/luma-uni-1-max`
- `/es/modelos/luma-uni-1-max`
