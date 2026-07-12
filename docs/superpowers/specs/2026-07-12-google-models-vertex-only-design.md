# Google Models Vertex-Only Routing Design

## Goal

Route every Google-branded generation model through Vertex AI only. A request
that cannot be supported by Vertex AI must be unavailable; it must never fall
back to Fal or the Gemini Developer API.

## Scope

The Google catalog currently contains Gemini Omni Flash, the Veo 3.1 family,
and the Nano Banana image family. This change covers their production routing,
availability checks, provider configuration, and routing-contract tests.

It does not change user pricing, request schemas beyond Vertex compatibility,
or non-Google providers.

## Current State

- Veo 3.1, Veo 3.1 Fast, and Veo 3.1 Lite have Vertex adapters but can fall
  back to Fal according to runtime flags.
- Gemini Omni Flash has a Vertex adapter but can resolve to Fal or be
  unavailable when Vertex routing is disabled.
- Nano Banana uses Fal; Nano Banana Lite, Nano Banana 2, and Nano Banana Pro
  use the Gemini Developer API directly. The direct API key is absent in
  production, causing Nano Banana 2 and Pro requests to fail and be refunded.

## Chosen Design

### One authoritative Google route

Introduce one Google-provider routing policy that treats every Google-branded
engine as a Vertex-only engine. The route resolver must return a Vertex
provider plan only when the requested model and mode are supported by a Vertex
adapter and Vertex is configured. Otherwise it must return an explicit
unavailable result; it must not return `fal_only` for a Google engine.

### Vertex Image adapter for Nano Banana

Replace the Gemini Developer API execution path for Nano Banana Lite, Nano
Banana 2, and Nano Banana Pro with a Vertex AI image-generation adapter. Move
Nano Banana standard from Fal to the same adapter. The adapter will use the
existing Google Vertex project, location, and service-account configuration;
it will not consume any `GEMINI_API_KEY`-style variable.

The image adapter owns request construction, synchronous provider calls,
output extraction, storage upload, failure normalization, and idempotent
wallet refunds through the existing image-generation persistence helpers.

### Availability and failures

Google models are available only when their Vertex adapter can accept the
requested engine and mode and the required Vertex configuration is present.
The API must reject unavailable Google requests before a payable job is
created. This prevents the charge/refund cycle observed for Nano Banana 2 and
Pro.

### No hidden fallback

Remove the Fal fallback option from Veo and Gemini Omni routing plans. A
Vertex provider error remains a Vertex job failure; it does not submit a
second request to Fal. Unsupported modes also remain unavailable rather than
using a Fal-specific equivalent.

### Test contract

Add a single routing contract that enumerates every Google-branded engine and
asserts all of the following:

1. Its configured provider is Vertex AI.
2. Its supported route resolves to a Vertex provider only.
3. It cannot produce a Fal fallback plan.
4. Missing Vertex configuration makes the model unavailable before billing.

Keep focused adapter tests for Vertex Image payload conversion, error mapping,
and result extraction. Retain existing Veo and Gemini Omni routing tests, but
update their expectations to prohibit fallback.

## Data Flow

```text
Google engine request
  -> Google Vertex-only route resolver
  -> Vertex configuration and model/mode support check
  -> Vertex provider adapter
  -> existing job, receipt, media, and failure persistence

Unsupported or unconfigured
  -> unavailable response before initial paid job creation
```

## Operational Requirements

- Production requires valid `GOOGLE_VERTEX_PROJECT_ID`,
  `GOOGLE_VERTEX_LOCATION`, and `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON` values
  with permission to invoke every configured Google model.
- Before enabling Nano Banana, run one production smoke generation for each
  Nano model and verify a completed job has a Vertex provider attempt and no
  refund receipt.
- Keep the models hidden or unavailable until those checks pass.

## Success Criteria

- No Google-branded engine has `fal.ai` or `google_gemini_image` as its
  configured execution provider.
- No Google routing plan exposes Fal as primary or fallback.
- A missing or unsupported Vertex path rejects before wallet charging.
- Nano Banana 2 and Pro no longer create configuration-error refunds in
  production after Vertex configuration and smoke tests succeed.
