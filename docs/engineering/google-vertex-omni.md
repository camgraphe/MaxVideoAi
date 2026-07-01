# Google Vertex Omni / Gemini Omni Flash

This guide covers the MaxVideoAI direct integration for Gemini Omni Flash through Google Vertex / Agent Platform Interactions.

## Scope

- Engine id: `gemini-omni-flash`
- Provider key: `google_vertex_omni_direct`
- Google model id: `gemini-omni-flash-preview`
- API family: Interactions API, not Veo `predictLongRunning`
- Public status: preview / limited

The route supports text-to-video, image-to-video, reference-to-video, short source-video edit, and conversational refine through `previous_interaction_id`.

## Rollout Flags

Keep public routing disabled until quota, moderation behavior, storage, and pricing have been smoke-tested in production.

```txt
GOOGLE_VERTEX_OMNI_ENABLED=false
GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED=false
GOOGLE_VERTEX_OMNI_ADMIN_ONLY=true
GOOGLE_VERTEX_OMNI_FALLBACK_TO_FAL_ENABLED=false
```

Routing behavior:

- `GOOGLE_VERTEX_OMNI_ENABLED=false`: disables the direct route.
- `GOOGLE_VERTEX_OMNI_ADMIN_ONLY=true`: lets admins test when public routing is off.
- `GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED=false`: prevents non-admin traffic from using the route.
- `GOOGLE_VERTEX_OMNI_FALLBACK_TO_FAL_ENABLED=false`: no fallback should be assumed for Omni unless a compatible fallback is explicitly validated.

## Credentials And Region

Omni-specific environment variables override the shared Google Vertex variables:

```txt
GOOGLE_VERTEX_OMNI_PROJECT_ID=
GOOGLE_VERTEX_OMNI_LOCATION=global
GOOGLE_VERTEX_OMNI_API_BASE_URL=
GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON=
GOOGLE_VERTEX_OMNI_POLL_TOKEN=
```

Fallbacks:

- `GOOGLE_VERTEX_OMNI_PROJECT_ID` falls back to `GOOGLE_VERTEX_PROJECT_ID`.
- `GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON` falls back to `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON`.
- `GOOGLE_VERTEX_OMNI_LOCATION` defaults to `global`.

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
- `v2v` -> `edit`
- `retake` -> `edit` with `previous_interaction_id`

Do not add negative prompt, seed, first/last-frame, extend, or 4K controls unless Google changes the Omni docs and the payload contract tests are updated.

## Polling

Polling is handled by:

- `frontend/server/google-vertex-omni-poll.ts`
- `frontend/app/api/cron/google-vertex-omni-poll/route.ts`
- `frontend/vercel.json`

The cron route accepts Vercel Cron auth and the optional `x-google-vertex-omni-poll-token` header.

Poller responsibilities:

- Fetch the stored interaction id.
- Normalize Interactions responses, including `steps[].content` and SDK-style `output_video`.
- Download `gs://` or URI video output through the Google client.
- Copy the final video into MaxVideoAI storage.
- Complete the `app_jobs` row and update the latest `provider_attempts` snapshot.

## Workspace UI

The Omni UI is intentionally route-local:

- `frontend/app/(core)/(workspace)/app/_components/omni/OmniStudioPanel.client.tsx`
- Mounted from `WorkspaceComposerSurface.tsx`
- Hidden unless `selectedEngine.id === 'gemini-omni-flash'`

The panel owns mode-specific source fields, Store interaction, previous interaction id, sound direction, camera direction, and edit instruction. `AppClient.tsx` should stay a route orchestrator.

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
