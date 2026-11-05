# Google Vertex Omni / Gemini Omni Flash 1.2

This guide covers the MaxVideoAI direct integration for Gemini Omni Flash 1.2 through Google Vertex / Agent Platform Interactions.

## Scope

- Engine id: `gemini-omni-flash`
- Provider key: `google_vertex_omni_direct`
- Google model id: `gemini-omni-1.2-flash`
- API family: Interactions API, not Veo `predictLongRunning`
- Supplier status: generally available (November 5, 2026)
- Source candidate: 1.2 upgrade; production deployment remains separate from account access

The route supports text-to-video, image-to-video, reference-to-video, first/last-frame generation, short source-video edit and extension, and conversational refine through `previous_interaction_id`. Google announced 1.2 GA on November 5, 2026. A direct account-scoped 3-second 360p text-to-video Interactions request completed that day. This establishes that route only; it does not certify every mode, resolution or the deployed app. See [launch evidence](../model-launch/gemini-omni-flash-1-2-upgrade.md). The older September 3 staging rejection remains historical: background interactions require `store=true`.

## Rollout Flags

The upgrade preserves existing environment flags. The values below illustrate the disabled rollback state, not a claim about production configuration. Enablement and a production release follow the normal delivery policy.

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
- The current `gemini-omni-1.2-flash` Vertex route is documented for `global`. Any explicit value other than `global` is rejected before provider submission.

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
For generation and extension, the video response format is a list containing the selected integer duration from 3 through 10 seconds in the currently sold MaxVideoAI domain, `16:9` or `9:16`, one of `360p`, `720p`, `1080p`, or `4k`, and an isolated `gcs_uri` output prefix. Edit/refine requests omit duration and aspect ratio so Google inherits them from the source interaction. The service stages HTTP media inputs, including both ordered frame images, into the configured Google Vertex input bucket before submission and rejects images above the documented 30 MB limit. Polling must still handle inline base64 data because Google can return bytes instead of a URI.

Background Interactions requests always send `store: true`; this is provider-required and is not a user control. Negative prompt, seed, and audio-reference inputs remain unsupported.

## Polling

Polling is handled by:

- `frontend/server/google-vertex-omni-poll.ts`
- `frontend/app/api/cron/google-vertex-omni-poll/route.ts`
- `frontend/vercel.json`

The cron route accepts Vercel Cron auth and the optional `x-google-vertex-omni-poll-token` header.

Poller responsibilities:

- Fetch the stored interaction (including accepted 1.1 jobs) with `GET /interactions/{id}`. Do not use the empty-body `POST` shown on some Google video task pages: a production probe on August 28, 2026 returned `200` for `GET` and `404` for `POST` against the same completed `video-*` interaction.
- Normalize Interactions responses, including `steps[].content` and SDK-style `output_video`.
- Download `gs://` or URI video output through the Google client.
- Copy the final video into MaxVideoAI storage.
- Complete the `app_jobs` row and update the latest `provider_attempts` snapshot.
- Mark unresolved jobs for manual review after 45 minutes without retrying, rerouting, or automatically refunding them. Confirmed terminal provider failures still use the standard idempotent wallet refund flow.

Terminal Interactions failures may expose `errors[]` rather than the legacy
`error` or `message` fields. The response normalizer owns reading the supplier
code and message. The poller retains those two diagnostic fields on the provider
attempt, without copying the interaction's prompt, input media or reasoning into
the failure snapshot. A `safety` code projects fixed Google moderation guidance
through the shared EN/FR/ES generation-failure messages. It never authorizes a
resubmission or fallback; the existing terminal-failure refund remains unchanged.
`tests/google-vertex-omni-failures.test.ts` covers this production response shape,
the public guidance and the terminal polling/refund boundary.

Studio's creation card projects only fixed public failure messages through
`conversationFailurePresentation`, including the available moderation reason and
the other known public journal failures. Unknown historical reasons stay
explicitly unavailable; no prompt, supplier payload or lost cause is reconstructed.
The card receives the app's EN/FR/ES locale and confirms a wallet refund only from
the persisted `refunded_wallet` status. A failed generation takes priority over
stale quote readiness or expiration. The real-route browser fixture in
`tests/studio-failure-card-browser.test.ts` checks these messages, read-only journal
refresh/reopening and the Spanish locale boundary using synthetic records; it
does not establish access to an authenticated customer's production history.

For an explicitly known Google moderation refusal, `conversationGoogleSafetyHelp`
adds a collapsed native disclosure with fixed EN/FR/ES guidance. It covers prompt
wording/meaning, reference media, generated content and illustrative prohibited
content categories; it never identifies a particular word or reference as the
cause, or promises that rewording will pass. Other failures and unknown historical
reasons do not receive Google guidance. Keyboard and mobile disclosure behavior
are covered by the same synthetic browser fixture. The content is based on
[Google's Omni documentation](https://ai.google.dev/gemini-api/docs/omni) and
[Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy),
reviewed on October 26, 2026. This is explanatory copy, not a change to provider filters.

## Pricing And Cost Estimate

The factual calculator in `frontend/src/lib/google-omni-pricing.ts` is the single Google Omni cost source. Output uses 1,931/5,792/8,688/17,376 tokens per second at 360p/720p/1080p/4k and `$12.00` per million output video tokens for 1.2. Each input image uses 1,120 tokens; source video uses 5,792 tokens per second; both are charged at `$1.50` per million input tokens. Fractional cents are retained through canonical commercial math and rounded only at the final customer-money boundary.

Billing and public pricing facts consume that calculator before the canonical commercial policy is applied. Source-video modes require verified duration metadata for an exact paid quote. Video edit pricing inherits trusted source duration, and conversational retake pricing resolves the duration only from the user's completed, owned previous interaction; a selected UI duration cannot change either edit charge. Provider-attempt estimates use the same calculator and record `google_omni_1_2_token_pricing` for new 1.2 jobs; provider code does not own margin or customer-price policy. A media-free provider-pricing snapshot is stored on the provider attempt so polling can reconstruct mode, resolution, and verified media inputs even when price-only receipt snapshots omit provider metadata.

Historical attempts are estimated from their stored `providerModel`, not the current route. 1.1 keeps its $17.50 output-token rate and source label; missing or unknown model provenance returns an unavailable estimate. Paid receipt snapshots stay unchanged. The explicit [1.2 tariff release](../model-launch/gemini-omni-flash-1-2-tariffs.md) authors new customer amounts at 150% of saved 1.1 cents; it never runs during quotation or deployment. Historical $17.50 authored token bands retain their original price expression/domain; new band compilation uses the current $12 supplier reference. In an environment with inactive customer tariffs, the existing legacy margin policy still derives quotes from current supplier facts; those development/audit projections are not evidence of production customer prices.

These are media-token estimates, not observed invoices: prompt text and variable reasoning usage are not included in the deterministic preflight estimate. The successful smoke reported additional text/reasoning tokens.

Google supports up to 15 seconds for 1.2 generation/editing, while first/last-frame and added extension remain 3–10 seconds. This candidate deliberately retains the existing 3–10-second sellable domain and source limits. Open 11–15 seconds only with reviewed tariff coverage and end-to-end validation. Audio-file references are not exposed; the current Vertex model card does not list them as a standard supported input. No new upscale mode is added.

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

Retain the current examples and original 1.1 media/prompt attribution. Existing model/comparison URLs stay canonical; the new 1.2 aliases redirect to that owner. The old score row is retained under `historicalScores` with `modelVersion: "1.1"` in the benchmark data, outside current score loaders. It must not become a 1.2 rating. Comparison galleries carry each stored example label through captions, accessible names and the watch dialog. New 1.2 proof requires separately reviewed real renders; the access-smoke clip is not a marketing example.

## Rollback

Fast rollback:

```txt
GOOGLE_VERTEX_OMNI_ENABLED=false
```

If jobs were already accepted, keep the cron route available until running Omni jobs either complete, fail, or are manually reconciled.

The supplemental [provider and marketing audit](../model-launch/gemini-omni-flash-1-2-surface-audit.md) records option coverage, intentional provider-feature gaps, the historical 8.3 score and every affected discovery surface. Native sound direction is not a binary audio switch: the shared prompt-directed-audio policy keeps MCP budget labels and API discovery truthful and rejects a silent setting that the provider payload cannot apply.
