# Kling 4.0 provider evidence — 2026-10-21 UTC

This is launch preparation, not an execution or publication certificate. Research ran from 21:56 to after 22:00 UTC on October 21 (October 22 after midnight in Europe/Madrid). Only unauthenticated public GETs and public documentation UI reads were performed. No credentials were sought, no media was uploaded, no generation/voice/element request was submitted, and no account or production state was changed.

User-selected routing direction: **Kling direct first, fal fallback**. Neither route is qualified for live V4 execution by this evidence. Direct V4 generation request contracts remain missing from the public documentation inspected; fal explicitly says API access is coming soon. Prepare the routing and preserve fail-closed execution gates; never invent V4 routes by renaming V3 or use a playground/agent as a substitute API transport.

## Evidence levels and availability

| Evidence | Observed state | What it establishes |
|---|---|---|
| [Official Kling announcement](https://x.com/Kling_ai/status/2112946255257084260), Oct 21 | API rollout announced | Announcement only, no account entitlement |
| [Official docs overview](https://kling.ai/document-api/guides/get-started/overview) | Early-access announcement and Get Early Access CTA | Access is gated; CTA was not submitted |
| [Official model release](https://kling.ai/dev/model-release/kling-4) | Product capabilities, Flash distinguished | Broader product claims, not a request schema |
| [Official documentation index](https://kling.ai/document-api/llms.txt) | Video request pages list 3.0 Turbo, 3.0/Omni and earlier; no V4 request page | Direct V4 endpoint/model identity/input/output/poll/cancel still unverified |
| [Official API updates](https://kling.ai/document-api/updates/api.md) | Latest entry in captured document is Sep 15; no V4 contract | Updates do not fill that gap |
| [fal V4 landing](https://fal.ai/kling-4), last updated Oct 21 | Playground and fal Agent available; API coming soon | API remains unqualified despite schemas; demos explicitly come from Kling, not fal API |
| Four fal API pages and linked OpenAPI JSON | Public GET 200 with exact model schemas | Published contract candidates, not permission to execute |
| Authenticated account/package state | Root separately read the documented free endpoint: HTTP 200/code 0, packages empty in redacted evidence | Legacy authentication/read works; no V4 entitlement or applicable package proven |
| Actual generation, latency, media output, invoice | Not attempted | Unknown |

Local raw captures and hashes are in `.local/kling-v4/research/`. Each fetched source has a companion `.meta.json` with exact URL, UTC time, status and SHA-256. HTML text extracts and embedded schema extracts are derivatives. Browser-rendered official release, availability and cash pricing facts are transcribed in `kling-browser-observations.md`. No downloaded media is needed for this evidence.

## Exact fal contracts

The `kling/v4` namespace is deliberate; do not prepend `fal-ai/kling-video` or infer standard/pro suffixes.

| Mode | Endpoint | Required fields in JSON Schema | Other supported input fields |
|---|---|---|---|
| Text to video | `kling/v4/text-to-video` | No property-level required list; prose requires prompt or multi_prompt | `prompt`, `multi_prompt`, `duration`, `resolution`, `aspect_ratio` |
| Image to video | `kling/v4/image-to-video` | `start_image_url`; prose also requires prompt or multi_prompt | `prompt`, `end_image_url`, `multi_prompt`, `duration`, `resolution` |
| Reference to video | `kling/v4/reference-to-video` | No property-level required list; prose requires prompt or multi_prompt | `prompt`, `multi_prompt`, `duration`, `start_image_url`, `image_urls`, `video_urls`, `elements`, `resolution`, `aspect_ratio` |
| Video editing | `kling/v4/video-to-video/edit` | `prompt`, `video_url` | `image_urls`, `elements`, `duration`, `resolution` |

Primary schemas:

- [T2V API](https://fal.ai/models/kling/v4/text-to-video/api) / [queue OpenAPI](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=kling/v4/text-to-video)
- [I2V API](https://fal.ai/models/kling/v4/image-to-video/api) / [queue OpenAPI](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=kling/v4/image-to-video)
- [R2V API](https://fal.ai/models/kling/v4/reference-to-video/api) / [queue OpenAPI](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=kling/v4/reference-to-video)
- [Edit API](https://fal.ai/models/kling/v4/video-to-video/edit/api) / [queue OpenAPI](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=kling/v4/video-to-video/edit)

### Timing, prompts and framing

- T2V/I2V/R2V: `duration` is integer 3–30 seconds, default 5; `resolution` is `720p|1080p`, default `1080p`.
- Edit: `duration` is nullable integer 3–30; omitted/null means source-video length. How fractional measured source length becomes an integer output request is not specified. Do not silently round it into a quoted output.
- Main `prompt` is nullable for T2V/I2V/R2V and limited to 2,500 characters. Edit requires the string with the same maximum. Provider prose requires prompt or multi_prompt for generation. Both-supplied precedence and empty-string acceptance are not encoded; local validation should refuse ambiguous/empty forms instead of relying on schema permissiveness.
- `multi_prompt` is nullable, or an array with at least one shot; no `maxItems` is published. A shot is `{prompt: string, duration?: integer}`: prompt required, 1–512 characters; duration 1–30 seconds, default 5. The output duration is the sum of shot durations, within the 3–30-second overall generation domain. Do not invent a 6-shot or other fixed maximum. Conflicting global duration versus sum is not qualified.
- T2V `aspect_ratio`: `16:9|9:16|1:1|21:9`, default `16:9`. R2V additionally accepts `auto`, also defaulting to `16:9`.
- I2V has no aspect input: schema says output follows input frames. Start image is required; end image is optional. No requirement for identical frame dimensions or cropping policy is published in this schema.
- Edit has no aspect input, no multi_prompt, and no start/end frame input.

### References, elements and voices

R2V `image_urls` is nullable or up to 10 URLs. `start_image_url` is optional and counts toward the image limit. `video_urls` is nullable or up to 5 URLs; each video is nominally 3–30s, and the combined duration of reference videos plus video elements is at most 30s. `elements` is nullable or up to 7 objects; prose permits at most 3 with voice_id and at most 3 video elements. Prompt references use `@Image1`, `@Video1`, `@Element1`, etc.

R2V element shape:

```ts
{
  frontal_image_url?: string | null;
  reference_image_urls?: string[] | null; // maxItems 3; prose says 1–3
  video_url?: string | null;              // instead of image views; nominal 3–30s
  voice_id?: string | null;
}
```

The R2V schema does not encode a required image-or-video union, minimum additional-view count, or image/video mutual exclusion. Treat those as qualification gaps, not as evidence that empty/mixed elements work. The [fal landing](https://fal.ai/kling-4) and official release announce a 15-asset mixed limit. Its precise counting of voices, element-internal images and start frame is not formalized by the fal JSON schema; the per-type maxima must not be assumed independently combinable.

Edit accepts up to 10 image URLs and up to 7 image elements. Its `KlingV4ImageElement` requires both `frontal_image_url` and `reference_image_urls` with 1–3 items. It exposes no video element, voice_id, or additional video-reference list. This differs from the broader official product editing capability of up to five clips, including a primary clip.

Voice creation is a separate [fal endpoint](https://fal.ai/models/fal-ai/kling-video/create-voice/api): `fal-ai/kling-video/create-voice`, required `voice_url` for clean single-speaker `.mp3/.wav` or `.mp4/.mov` input, 5–30s, output required string `voice_id`. Its separate `enable_safety_checker` defaults true. The public embedded billing metadata says 0.007 per generation; that is an auxiliary observed reference, not a verified account charge. No voice was created. Cross-provider portability of voice/element IDs is unverified and must never be assumed during fallback.

### Media limits and missing controls

| Input | Exact schema facts |
|---|---|
| Images, including start/end and element views | Max 31,457,280 bytes; minimum width and height 300px; aspect ratio 0.4–2.5; fetch timeout 20s |
| Source/reference/element videos | Max 314,572,800 bytes; width and height each 700–4553px; ratio 0.4–2.5; min duration 3, max 30.05s; FPS 23.9–60.05; fetch timeout 30s |

The 30.05s and FPS values are media-validator tolerances; they do not authorize output duration 31s or a mixed reference total above 30s. Schema does not list image/video file extensions, output FPS, output width/height, or media-fetch retry behavior. All published file fields support hosted public URLs or base64 data URIs through fal's general file contract; storage/upload itself was not exercised.

No `audio_url`, `audio_urls`, `generate_audio`, audio on/off toggle, mask URL, asset-ID input, middle-keyframe array, seed, negative prompt, CFG scale, output FPS, watermark toggle or 4K option appears in these four fal inputs. The presence of a generic fal File type does not add such capabilities.

The [fal landing](https://fal.ai/kling-4) explicitly describes native stereo, dialogue, singing, effects and ambience with lip sync, directed through the prompt. This is an announced fixed capability, not an audio-toggle contract or verified result. Kling's broader [release](https://kling.ai/dev/model-release/kling-4) mentions 10 keyframes, 8,000-token input, 4K/HDR and extension; those must not replace fal's 2,500-character/720p–1080p schema. 4K/HDR and two-minute extension are described as coming soon in the release body. Flash is a distinct 3–20s/720p product.

### Output and lifecycle

All four fal outputs require `video: File`; File requires `url`, with nullable `content_type`, `file_name`, `file_size`. Examples are MP4. No duration, dimensions, audio channel count, frame rate, seed, billable units or actual cost is returned by this output schema. These must come from verified output metadata or a separate accounting source.

The downloadable queue OpenAPI is 3.0.4; the original schema embedded in the API HTML is 3.1.0. Both are captured. Queue base is `https://queue.fal.run`, using Authorization API key header; the [queue guide](https://fal.ai/docs/documentation/model-apis/inference/queue) specifies `Authorization: Key <FAL_KEY>`. Per-mode schema advertises POST submission, GET `requests/{request_id}/status`, GET `requests/{request_id}`, PUT `requests/{request_id}/cancel`. SDK examples use the full mode ID. Persist returned status/response/cancel URLs and request identity; do not guess root versus subpath behavior before qualification.

Queue states: `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`. `COMPLETED` is not sufficient proof of success; retrieve result/error. Queue JSON has request ID, URLs, optional logs/metrics/queue position. Direct model schema declares 422 validation errors; the queue wrapper lists only 200, so it is not an exhaustive error taxonomy.

General fal cancellation documentation is richer than the generated OpenAPI's `{success:boolean}`: queued cancellation returns 200/OK; running cancellation returns 202/CANCELLATION_REQUESTED and may still complete; already complete is 400/ALREADY_COMPLETED; missing or wrong-account request is 404/NOT_FOUND. No Kling V4 cancellation/refund behavior was tested. A client wait timeout does not prove server cancellation; a start timeout limits pre-processing wait, not inference. Generic platform inference defaults are not a measured V4 SLA.

[fal webhooks](https://fal.ai/docs/documentation/model-apis/inference/webhooks) use `OK|ERROR`, `request_id`, possibly distinct `gateway_request_id`, payload/error fields. Validate ED25519 signatures over IDs, timestamp and SHA-256 of raw body, using published JWKS with cache no longer than 24h and ±300s timestamp window. Acknowledge 2xx and deduplicate by request ID. Delivery can retry up to 31 times within result retention; redirects/private destinations are not valid delivery targets. Never convert transport ambiguity or an uncertain submit into an automatic second provider generation.

## Kling direct: verified generic contract and missing V4 contract

[Authentication](https://kling.ai/document-api/api/get-started/authentication.md) states international base `https://api-singapore.klingai.com`, replacing `api.klingai.com`. API Key authentication is available for all models using `Authorization: Bearer <API_KEY>`. AK/SK-derived HS256 JWT is explicitly for legacy design only. The docs distinguish new design by model version in the path and legacy design by `model_name` in the body. **No inspected primary source establishes the V4 generation path or a `model_name` value.** Do not make `kling-v4`, `kling-v4-0`, `/v1/videos/...` or a new `/v4/...` route executable by analogy.

The [official index](https://kling.ai/document-api/llms.txt), public navigation, search for `4.0`, updates and [official skill page](https://kling.ai/document-api/api/get-started/kling-skills.md) do not expose a V4 generation contract in this capture. The linked [official skill distribution](https://clawhub.ai/klingai-dev/klingai) was inspected read-only; its public documentation links point to 3.0/Omni, not a verified V4 route. No skill was installed or run. Product/UI tutorials are not substitutes for API docs.

The generic [new callback contract](https://kling.ai/document-api/api/get-started/callbacks.md) has `id`, `status: submitted|processing|succeeded|failed`, `message`, `create_time`, `update_time`, `external_id`, `outputs[]` and `billing[]`. Video outputs include type, id, url, watermark_url and duration string; URLs are retained 30 days per docs. Billing separates `charge_type=cash|unit`; cash has currency and list_price, while amount is the actual discounted deduction; unit has package_type and unit amount. This is useful for a future adapter, but does not qualify V4 submit/poll schemas. Legacy callbacks apply to 3.0 Omni and earlier and use different field names.

Kling webhook signing is **different from fal**: when a Webhook Secret is configured, headers `webhook-id`, `webhook-timestamp`, `webhook-signature` authenticate HMAC-SHA256 over `id.timestamp.rawBody`, using base64-decoded secret after removing `whsec_`, base64 signature, constant-time comparison and ±5min timestamp check. Standard rotation allows two valid signatures for seven days. Without configured signing, headers are absent. Setup/test callback would mutate external state/send a request and was not performed. Direct V4 polling route, cancellation contract, idempotency behavior and callback retry schedule remain unverified.

The [error table](https://kling.ai/document-api/api/get-started/error-codes.md) includes 401/1000–1004 auth, 403/1103 unauthorized resource/model, 429/1100–1102 account/package, 400/1200–1201 parameters, 404/1202–1203 method/resource, 400/1300–1301 policy/content, 429/1302–1304 rate/concurrency/IP, and 500–504/5000–5002 server errors. These are generic codes, not tested V4 acceptance. In particular, do not bypass content-policy rejection via fallback. Uncertain network/server response after submission needs reconciliation, not a second charge.

### Explicitly free account read, not a generation probe

[Account usage](https://kling.ai/document-api/api/assets/account-usage.md) documents **GET `/account/costs` as free**, with QPS≤1. `start_time` and `end_time` are required Unix milliseconds; optional `resource_pack_name` filters exactly. The response contains resource pack name/ID/type/tier, applicable-model description, quantities, validity times and `status=toBeOnline|online|expired|runOut`. The example `flagship` tier applies only to Kling 4.0/Flash. Remaining quantity has a 12-hour delay.

An authorized private read of that endpoint can establish a currently valid applicable package and delayed remaining quantity. It cannot by itself prove endpoint entitlement, sufficient fresh balance, or successful generation. The research subagent did not inspect credentials or make authenticated calls. Root subsequently performed one documented free read, using existing legacy AK/SK JWT, at Unix `1792620381` (2026-10-21 22:06:21 UTC), with a 24-hour query window and redirects forbidden. Redacted evidence `.local/kling-v4/review/account-access-read.json` reports HTTP 200, service code 0 and `packages: []`; root found no applicable-model entry. This proves legacy authentication and account-read success only. No new-style `KLING_API_KEY` variable was present in the environment inspected by root; that is not proof that the account can never obtain a key. No secrets or package IDs belong in this document. The [concurrency guide](https://kling.ai/document-api/api/get-started/concurrency-rules.md) says queries do not consume generation concurrency; respect the more specific account-read QPS≤1 despite the general guide's no-QPS wording.

## Published normal pricing, no account discount assumption

The official [pricing Markdown](https://kling.ai/document-api/pricing/base/video.md) independently confirms the fal texts. Rates are USD, per billed second, not per output second for video-input scenarios.

| Scenario |720p USD/s|1080p USD/s|Billable seconds|
|---|---:|---:|---|
|T2V, I2V, R2V without video references/elements|0.157|0.235|Output duration|
|R2V with any video reference or video element|0.094|0.141|max(input video total + output, 2 × output)|
|Video edit|0.094|0.141|max(source duration + output, 2 × output)|

Official equivalent unit rates are 1/1.5 without video and 0.6/0.9 with video. Use the published USD matrix directly; do not round-convert unit rates via an assumed unit price. Source duration includes reference videos and video character elements. Duplicate-asset charging, fractional-second quantization and invoice rounding are not documented here. Fal's generic embedded endpointBilling.price is 0.157 for every route, including edit; it cannot replace the resolution/mode-specific pricing text.

The [purchase UI](https://kling.ai/dev/pricing) explicitly excludes Kling 4.0/Flash from General package discounts. Its -10% offers therefore cannot be used as V4 effective cost. No V4-specific discount, account-effective rate or invoice was verified. These are published normal references, not a MaxVideoAI customer quote. See [pricing preparation](pricing-plan.md).

## Qualification plan and launch gates

1. **No-cost contract refresh:** re-fetch official index, V4 direct docs once published, and all four fal schemas/pricing. Diff hashes and inspect changes. Preserve exact direct path/auth/mode IDs; re-evaluate fields rather than mapping by similar names.
2. **Account read only:** with separately authorized existing credentials/session, query the documented free account usage endpoint once within QPS≤1; inspect early-access status in console without applying, buying, creating keys or exposing secrets. Record package applicability/validity and entitlement separately. Generic auth success is not V4 availability.
3. **Offline adapter tests:** enforce supported input fields and media constraints; total shot duration; total reference budgets; missing trusted source duration; no mask/audio-file/keyframe array; per-provider voice/element ownership; output parsing; both callback formats; all fail-closed gates. Verify no network call occurs while contracts/access are unqualified.
4. **Price preparation:** retain normal costs and FAL+30% customer-authoring intent separately; use canonical rounding when a candidate tariff is authored. Do not publish a price or enable quotes from this evidence. Preserve exact owned source timing and flag unknown supplier rounding.
5. **Later paid qualification only after explicit budget approval:** smallest T2V/I2V/R2V/edit cases, boundaries 3/30s and both resolutions, multi-shot totals, references/voices, native audio channels/dialogue, exact completion payload, duration/FPS/dimensions, latencies, ledger cost versus estimate, terminal failure/refund and in-flight cancel behavior. Each route requires its own entitlement and billing evidence.
6. **Direct-first/fallback contract:** bind chosen provider/path/version to each submitted job and receipt. Fallback only after evidence that the direct attempt was not accepted and only for semantically equivalent supported inputs. No fallthrough after task ID, ambiguous timeout, policy refusal, or provider-specific voice/element mismatch. Fal remains blocked while API access is unqualified.

No generation test, live customer quote, production billing change, public launch, commit or PR was performed by this research subtask.
