# P1 Video Model Refresh Evidence

Evidence snapshot: 2026-09-03. This private engineering record freezes only
what was observed from primary documentation and safe, non-mutating checks.
Provider polling and result envelopes remain unproven because neither approved
staging submission reached provider acceptance.

## Scope

| Model ID | Public product | Runtime policy | Publication state |
| --- | --- | --- | --- |
| `gemini-omni-flash` | Gemini Omni Flash 1.1 | Google direct | blocked by Google pre-acceptance rejection |
| `kling-3-turbo-standard` | Kling 3.0 Turbo Standard | Kling direct, Fal fallback | blocked by direct account-balance rejection |
| `kling-3-turbo-pro` | Kling 3.0 Turbo Pro | Kling direct, Fal fallback | blocked by direct account-balance rejection |
| `minimax-h3-max` | MiniMax H3 Max | current available route | blocked pending implementation and pricing parity |

Canonical Gemini stays `/models/gemini-omni-flash`. The two permanent,
single-hop version-search aliases are `gemini-omni-flash-1-1` and
`gemini-omni-1-1-flash`.

The existing Gemini comparison pages remain published and self-canonical; only
their visible current-model label is updated:

- `gemini-omni-flash-vs-veo-3-1`
- `gemini-omni-flash-vs-veo-3-1-fast`
- `gemini-omni-flash-vs-sora-2`
- `gemini-omni-flash-vs-seedance-2-0`

## Google

Observed 2026-09-03 from the [Google Cloud model page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-1-flash): the Agent Platform model ID is
`gemini-omni-1.1-flash-preview`, its documented region is `global`, and the
page declares text-to-video, image-to-video, reference-to-video, first/last
frames, audio, video editing, and extension support. The page is dated
2026-09-02 and describes this specific Agent Platform model as Preview.

The [Google Gemini API changelog](https://ai.google.dev/gemini-api/docs/changelog)
records a separate GA `gemini-omni-1.1-flash` release on 2026-08-27 and says
the prior `gemini-omni-flash-preview` endpoint is deprecated on 2026-09-30.
The [Gemini deprecations page](https://ai.google.dev/gemini-api/docs/deprecations)
and [Omni guide](https://ai.google.dev/gemini-api/docs/omni) are retained as
primary-source migration references. Those public Gemini API names must not be
substituted for the configured account's Vertex Interactions model ID.

Confirmed staging probe, 2026-09-03: one 3-second text-to-video request was
submitted through Vertex Interactions with model
`gemini-omni-1.1-flash-preview`, request keys `background`,
`generation_config`, `input`, `model`, `response_format`, and `store`, plus a
3-second 720p URI-delivery response format. No credential, token, full header,
prompt, or output URL is retained here.

Google staging probe: HTTP 400 pre-acceptance rejection. The sanitized error
envelope had top-level `error` and nested `code`/`message` keys; no interaction
ID, poll result, terminal status, or output location was issued. Provider
message: `store=true is required for background interactions.` The request
used `store: false`, so this proves the configured account requires `store:
true` when `background: true`; it does not prove the revised request envelope
or a successful provider model acceptance. No retry is authorized in this
batch.

Google direct publication gate: blocked (the approved single probe was
rejected before acceptance; a later separately approved smoke must use the
required store behavior and record its accepted envelope).

## Kling Direct

Primary source checked 2026-09-03:
[Kling 3.0 Turbo text-to-video API documentation](https://kling.ai/document-api/api/video/3-0-turbo/text-to-video).
The documentation page is JavaScript-rendered in this retrieval environment,
so its account-specific accepted path and envelope cannot be treated as
observed from a page fetch alone.

Safe local adapter inspection establishes only the existing pre-smoke proposal:
the smallest Standard text request is 3 seconds; it uses the direct adapter's
`model_name`, `duration`, `mode`, `sound`, and `external_task_id` fields. These
are not evidence that the new Turbo account accepts the path or body.

Confirmed staging probe, 2026-09-03: one 3-second Standard direct
text-to-video request used the candidate path `/v1/videos/text2video`, model
`kling-v3`, mode `std`, `sound: off`, and the key set `aspect_ratio`,
`duration`, `external_task_id`, `mode`, `model_name`, `prompt`, and `sound`.
The external task ID value itself is not retained.

Kling staging probe: HTTP 429 pre-acceptance rejection. The sanitized envelope
had `code`, `message`, and `request_id` keys, with no task ID, status value,
output location, poll result, or media URL. Provider message: `Account balance
not enough`. No retry is authorized in this batch. This is an account-balance
failure before direct-task acceptance, not evidence that a Fal-only product can
be published.

Kling direct publication gate: blocked (the confirmed Standard direct probe
was rejected before acceptance for insufficient account balance; direct access
must be funded and separately re-proven before publication).

## Kling Fal Fallback

The seven live Fal endpoint documentation pages and their OpenAPI schemas were
fetched without authentication on 2026-09-03:

| Product/mode | Endpoint ID | Primary source |
| --- | --- | --- |
| Standard text | `fal-ai/kling-video/v3/turbo/standard/text-to-video` | [API](https://fal.ai/models/fal-ai/kling-video/v3/turbo/standard/text-to-video/api) |
| Standard image | `fal-ai/kling-video/v3/turbo/standard/image-to-video` | [API](https://fal.ai/models/fal-ai/kling-video/v3/turbo/standard/image-to-video/api) |
| Pro text | `fal-ai/kling-video/v3/turbo/pro/text-to-video` | [API](https://fal.ai/models/fal-ai/kling-video/v3/turbo/pro/text-to-video/api) |
| Pro image | `fal-ai/kling-video/v3/turbo/pro/image-to-video` | [API](https://fal.ai/models/fal-ai/kling-video/v3/turbo/pro/image-to-video/api) |
| H3 Max text | `minimax/h3-max/text-to-video` | [API](https://fal.ai/models/minimax/h3-max/text-to-video/api) |
| H3 Max image | `minimax/h3-max/image-to-video` | [API](https://fal.ai/models/minimax/h3-max/image-to-video/api) |
| H3 Max reference | `minimax/h3-max/reference-to-video` | [API](https://fal.ai/models/minimax/h3-max/reference-to-video/api) |

The four Kling schemas expose queue submit, status, result, and cancellation
paths. Both text schemas allow either `prompt` or `multi_prompt`; both image
schemas require `image_url`; the currently observed duration enum is 3–15
seconds. These are fallback-contract inputs only. Fallback remains allowed
only before a direct task ID for pre-acceptance network/timeout, rate-limit,
provider-5xx, invalid-empty-response, or explicitly flagged credit-depletion
conditions. It is not allowed after a direct task ID, nor for validation,
moderation, authentication/account, or incompatible-projection failures.

## MiniMax H3 Max

The live queue OpenAPI schemas were fetched without authentication on
2026-09-03 from the three API sources in the table above. All expose a
5–15-second duration bound and `480P`/`768P` resolution enum, with `768P` as
the default. `image-to-video` has optional `image_url` and optional
`end_image_url`; the latter is the first-to-last-frame field. The reference
schema accepts at most 9 images, 3 videos, and 3 audio clips, capped at 12
files total. It requires an image or video when audio is supplied.

Native audio is automatic, generated with the visual output; no audio-toggle
field appears in these three current OpenAPI input schemas.

The live text/image endpoint pricing notice is a temporary launch promotion:

- H3 Max 480P rate: $0.0125/s.
- H3 Max 768P rate: $0.02/s.
- The notice states that the promotion ends 2026-09-07, after which the listed
  rates are $0.05/s at 480P and $0.08/s at 768P. Those non-promotional amounts
  must be rechecked immediately before pricing publication.

The separately released reference-to-video endpoint currently states output
video at $0.08/s plus reference tokens: the first 4,096 pooled tokens are
included, then each 1,000 reference tokens costs $0.02. Its stated image
formula is `(width * height) / 1024` tokens; reference-video tokens depend on
reference duration and requested generation resolution. This endpoint’s
published pricing differs from the text/image launch-promotion notice, so no
single H3 Max price may be published until canonical scenario pricing selects
and validates the exact mode.

## Pricing Inputs

The smallest two billable smoke proposals use existing adapter constraints and
cost estimators, not a generated provider result:

| Probe | Minimal request | Maximum provider debit |
| --- | --- | --- |
| Google | 3-second Google-direct text-to-video request | $0.300 |
| Kling | 3-second direct Standard text-to-video request with `sound: off` | $0.252 |

Combined maximum wallet/provider debit: **$0.552 USD**. This excludes any
separately billed storage/network charges that the current estimators do not
model; it is the maximum generation debit currently derived by the configured
code paths. No customer wallet quote exists yet because these P1 identities
are not published in the registry/pricing pipeline.

Actual provider debit: $0.000 USD for each rejected probe. Google rejected the
request at HTTP 400 before issuing an interaction; Kling rejected it at HTTP
429 before issuing a task. Neither response reported a provider-deduction
field, and no poll or generated media was created.

## Search Console

Snapshot window: 2026-06-01 through 2026-08-31.

- Gemini-query aggregate: 809 impressions and 11 clicks.
- `gemini omni flash`: 310 impressions.
- `gemini omni flash vs veo 3.1`: 98 impressions.
- Preservation decision: retain the canonical Gemini page and all four
  existing comparison URLs; update current visible 1.1 facts rather than
  replacing their URL ownership.
- Queries containing `minimax h3`: 756 impressions, 17 clicks, 2.2% CTR, and
  average position 14.9.
- Exact `minimax h3 max`: 350 impressions, six clicks, 1.7% CTR, and average
  position 7.6.
- Current URL ownership: ES H3 page 261 impressions/six clicks/position 5.9;
  FR H3 page 74/zero/9.5; EN H3 page 15/zero/26.9.

Operational blocker: the local/admin Search Console refresh flow currently
returns `invalid_grant`. No refresh token, client secret, authorization code,
or full authorization header is stored in this evidence record.

## Release Gates

| Gate | State | Evidence or required next step |
| --- | --- | --- |
| Scope and public identity freeze | proven | Four canonical IDs and canonical/alias ownership recorded above. |
| Google direct provider contract | blocked | The approved probe returned HTTP 400 before acceptance: `store=true` is required for background interactions. |
| Kling direct provider contract | blocked | The approved Standard probe returned HTTP 429 before task acceptance: `Account balance not enough`. |
| Kling Fal fallback documentation | proven | Four endpoint schemas fetched; direct-first boundary recorded. |
| H3 Max live schema research | proven | Three schemas, pricing notices, end frame, reference formula, duration, and native-audio behavior recorded. |
| Search Console token refresh | blocked | Local/admin refresh currently returns `invalid_grant`. |
| Public publication | blocked | Provider smokes, canonical pricing parity, implementation, examples, and broader release gates remain outstanding. |
| Excluded-product release gate | not-applicable | No excluded product is included in this P1 scope. |
