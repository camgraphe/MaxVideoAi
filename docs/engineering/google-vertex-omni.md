# Google Vertex Omni / Gemini Omni Flash 1.1

This guide covers the MaxVideoAI direct integration for Gemini Omni Flash 1.1 through Google Vertex / Agent Platform Interactions.

## Scope

- Engine id: `gemini-omni-flash`
- Provider key: `google_vertex_omni_direct`
- Google model id: `gemini-omni-1.1-flash-preview`
- API family: Interactions API, not Veo `predictLongRunning`
- Public status: preview / limited
- Publication gate: blocked until a separately authorized smoke is accepted

The route supports text-to-video, image-to-video, reference-to-video, first/last-frame generation, short source-video edit and extension, and conversational refine through `previous_interaction_id`. This implementation does not claim GA status or account acceptance: the 2026-09-03 staging probe was rejected before acceptance because background interactions require `store=true`.

## Rollout Flags

Keep the route disabled while the publication gate is blocked. After a separately authorized accepted smoke and release approval, the existing flags control preview and rollback.

```txt
GOOGLE_VERTEX_OMNI_ENABLED=false
GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED=true
GOOGLE_VERTEX_OMNI_ADMIN_ONLY=false
```

Routing behavior:

- `GOOGLE_VERTEX_OMNI_ENABLED=false`: disables the direct route.
- `GOOGLE_VERTEX_OMNI_ENABLED=true`: enables the direct route for users unless a restriction flag below is set.
- `GOOGLE_VERTEX_OMNI_ADMIN_ONLY=true`: restricts the route to admins.
- `GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED=false`: prevents non-admin traffic from using the route.
- Gemini Omni is Vertex-only. When the direct route is disabled or unavailable, the engine is unavailable; it does not fall back to Fal.

## Credentials And Region

Omni-specific environment variables override the shared Google Vertex variables:

```txt
GOOGLE_VERTEX_OMNI_PROJECT_ID=
GOOGLE_VERTEX_OMNI_LOCATION=global
GOOGLE_VERTEX_OMNI_API_BASE_URL=
GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON=
GOOGLE_VERTEX_OMNI_POLL_TOKEN=
GOOGLE_VERTEX_OMNI_INPUT_GCS_URI=
GOOGLE_VERTEX_OMNI_OUTPUT_GCS_URI=
```

Fallbacks:

- `GOOGLE_VERTEX_OMNI_PROJECT_ID` falls back to `GOOGLE_VERTEX_PROJECT_ID`.
- `GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON` falls back to `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON`.
- `GOOGLE_VERTEX_OMNI_LOCATION` defaults to `global` and never inherits `GOOGLE_VERTEX_LOCATION`, which may use a Veo-only regional value.
- `GOOGLE_VERTEX_OMNI_INPUT_GCS_URI` and `GOOGLE_VERTEX_OMNI_OUTPUT_GCS_URI` fall back to the shared `GOOGLE_VERTEX_INPUT_GCS_URI`; media inputs and generated output stay on Google Cloud Storage.
- The current `gemini-omni-1.1-flash-preview` Vertex route is documented for `global`. Any explicit value other than `global` is rejected before provider submission.

Do not commit service account JSON. Configure it only through deployment secrets.

## Submission Flow

Generation requests are routed through:

- `frontend/src/server/video-providers/router.ts`
- `frontend/app/api/generate/_lib/google-vertex-omni-submission.ts`
- `frontend/src/server/video-providers/google-vertex-omni/*`

The payload builder maps app modes to documented Interactions tasks:

- `t2v` -> `text_to_video`
- `i2v` -> `image_to_video`
- `ref2v` -> `reference_to_video`
- `fl2v` -> `image_to_video` with ordered `<FIRST_FRAME>` and `<LAST_FRAME>` images
- `v2v` -> `edit`
- `extend` -> `extend` with one owned source video
- `retake` -> `edit` with `previous_interaction_id`

Media blocks should use the documented Interactions content fields only, such as `type`, `uri`, `data`, and `mime_type`.
Do not add internal media role fields to the JSON body. Image roles are expressed in the prompt text with Google Omni tags such as `<FIRST_FRAME>` and `<IMAGE_REF_N>`.
For generation and extension, the video response format is a list containing the selected integer duration from 3 through 10 seconds, `16:9` or `9:16`, one of `360p`, `720p`, `1080p`, or `4k`, and an isolated `gcs_uri` output prefix. Edit/refine requests omit duration and aspect ratio so Google inherits them from the source interaction. The service stages HTTP media inputs, including both ordered frame images, into the configured Google Vertex input bucket before submission and rejects images above the documented 30 MB limit. Polling must still handle inline base64 data because Google can return bytes instead of a URI.

Background Interactions requests always send `store: true`; this is provider-required and is not a user control. Negative prompt, seed, and audio-reference inputs remain unsupported.

## Polling

Polling is handled by:

- `frontend/server/google-vertex-omni-poll.ts`
- `frontend/app/api/cron/google-vertex-omni-poll/route.ts`
- `frontend/vercel.json`

The cron route accepts Vercel Cron auth and the optional `x-google-vertex-omni-poll-token` header.

Poller responsibilities:

- Fetch the stored `gemini-omni-1.1-flash-preview` interaction with `GET /interactions/{id}`. Do not use the empty-body `POST` shown on some Google video task pages: a production probe on August 28, 2026 returned `200` for `GET` and `404` for `POST` against the same completed `video-*` interaction.
- Normalize Interactions responses, including `steps[].content` and SDK-style `output_video`.
- Download `gs://` or URI video output through the Google client.
- Copy the final video into MaxVideoAI storage.
- Complete the `app_jobs` row and update the latest `provider_attempts` snapshot.
- Mark unresolved jobs for manual review after 45 minutes without retrying, rerouting, or automatically refunding them. Confirmed terminal provider failures still use the standard idempotent wallet refund flow.

## Pricing And Cost Estimate

The factual calculator in `frontend/src/lib/google-omni-pricing.ts` is the single Google Omni cost source. Output uses 1,931/5,792/8,688/17,376 tokens per second at 360p/720p/1080p/4k and `$17.50` per million output tokens. Each input image uses 1,120 tokens; source video uses 5,792 tokens per second; both are charged at `$1.50` per million input tokens. Fractional dollars are retained until the final integer-cent boundary.

Billing and public pricing facts consume that calculator before the canonical commercial policy is applied. Source-video modes require verified duration metadata for an exact paid quote. Provider-attempt estimates use the same calculator and record `google_omni_1_1_token_pricing`; provider code does not own margin or customer-price policy.

## Workspace UI

The Omni UI is intentionally route-local:

- `frontend/app/(core)/(workspace)/app/_components/omni/OmniStudioPanel.client.tsx`
- Mounted from `WorkspaceComposerSurface.tsx`
- Hidden unless `selectedEngine.id === 'gemini-omni-flash'`

The panel owns mode-specific source fields, previous interaction id, sound direction, camera direction, and edit instruction. Interaction storage is mandatory for background requests and is not exposed as a toggle. `AppClient.tsx` should stay a route orchestrator.

## Marketing And SEO Boundaries

Public pages should not teach the internal Vertex implementation. Keep intent split as:

- `/models/gemini-omni-flash`: specs, limits, workflows, pricing, app CTA.
- `/ai-video-engines/gemini-omni-flash-vs-veo-3-1`: Omni vs Veo decision page.
- `/pricing#gemini-omni-flash-pricing`: pricing anchor once live pricing is confirmed.

Do not create an examples page until approved real MaxVideoAI Omni outputs exist.

## Rollback

Fast rollback:

```txt
GOOGLE_VERTEX_OMNI_ENABLED=false
```

If jobs were already accepted, keep the cron route available until running Omni jobs either complete, fail, or are manually reconciled.
