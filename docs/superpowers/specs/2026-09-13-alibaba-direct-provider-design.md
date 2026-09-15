# Alibaba Direct Video Provider Design

**Date:** 2026-09-13

**Status:** Approved in conversation; pending final written-spec review before implementation planning

## Goal

Add Alibaba Cloud Model Studio as one direct video provider inside MaxVideoAI's
existing provider architecture. The first complete implementation includes Wan 3 Standard,
Wan 3 Prime, and HappyHorse 1.1. It must cover the application, MCP, Studio,
pricing, job, administration, storage, failure handling, storage, and tests without
deploying, enabling public routing, creating an Alibaba API key, or making a paid
provider call.

## Scope

### Included

- A generic `alibaba_model_studio` provider adapter.
- `wan-3` mapped to `wan3.0-video`.
- `wan-3-prime` mapped to `wan3.0-video-prime`.
- `happy-horse-1-1` mapped to the Alibaba HappyHorse 1.1 T2V, I2V, and R2V
  model identifiers.
- Wan 3 T2V, I2V, Ref2V, video editing, and extension capabilities where the
  Alibaba API contract can represent them exactly.
- Existing Fal routes retained as exact-mode fallbacks where semantic parity is
  proven.
- Admin-only canary routing behind disabled-by-default environment flags.
- Provider-attempt auditing, cost accounting, polling, permanent output copy,
  recovery, user-safe failures, and refund integration.
- Shared catalog projection into the main app, MCP, pricing, and Studio, with
  fail-closed visibility where certification is required.
- A provider-neutral architecture consistent with the current Kling, Google
  Vertex Veo, Luma Agents, and BytePlus/Seedance direct integrations.

### Excluded

- Deploying or enabling Alibaba direct in any environment.
- Creating, reading, or rotating a real Alibaba API key.
- Calling a paid Alibaba API or spending PoC credit.
- Sending questions or messages to Alibaba staff.
- Automatically migrating Wan 2.5 or Wan 2.6 from Fal.
- Publicly advertising a direct-provider relationship.
- Changing unrelated providers or refactoring the entire provider subsystem.

Wan 2.5, Wan 2.6, Wan 2.7, HappyHorse 1.0, and future Alibaba models may reuse
the adapter later. Their model mappings are not activated until their exact
capabilities, pricing rules, and output behavior are certified.

## Architectural Decision

Alibaba direct is an adapter within the existing provider stack, not a parallel
generation system and not a new product identity.

```text
Canonical model and mode
        |
        v
Shared validation and canonical customer quote
        |
        v
Existing provider routing plan
        |
        +-- Fal
        +-- Kling direct
        +-- Google Vertex direct
        +-- Luma Agents direct
        +-- BytePlus/Seedance direct
        `-- Alibaba Model Studio direct
                |
                v
      submit -> persist task id -> poll -> copy -> finalize/refund
```

The canonical IDs remain `wan-3`, `wan-3-prime`, and
`happy-horse-1-1`. Provider model IDs and endpoints belong to routing and
adapter metadata. No `*-alibaba` engine or duplicate public model is added.

## Provider Boundary

The Alibaba implementation follows the existing focused-provider layout:

```text
frontend/src/server/video-providers/alibaba-model-studio/
  client.ts        HTTP transport, authentication, and timeouts
  model-map.ts     canonical engine/mode to Alibaba model mapping
  payload.ts       validated provider payload construction
  response.ts      task and result normalization
  errors.ts        provider error classification and fallback eligibility
  cost.ts          Alibaba factual cost estimates and actual cost projection
  index.ts         VideoProviderAdapter composition
```

The generic provider interfaces remain the public boundary. Alibaba-specific
types do not leak into UI, MCP, wallet, or marketing modules. A separate
server-side poll owner may be added alongside the existing direct-provider
pollers because polling coordinates database, storage, refunds, and operational
recovery rather than only provider HTTP calls.

## Configuration and Routing

The routing plan gains one Alibaba-direct variant and these server-only controls:

- provider enabled;
- public routing enabled;
- admin-only, defaulting to true;
- fallback to Fal enabled, defaulting to false;
- Singapore region;
- workspace-dedicated endpoint;
- API key.

Every flag is disabled by default in code and deployment examples. Missing or
inconsistent endpoint, region, workspace, or key configuration fails closed to
Fal for existing equivalent modes. It must never expose the secret or workspace
endpoint to browser bundles.

The initial routing mappings are:

| Canonical engine | Canonical mode | Alibaba target | Fal fallback |
| --- | --- | --- | --- |
| `wan-3` | `t2v`, `i2v`, `ref2v` | `wan3.0-video` | exact existing Wan 3 route |
| `wan-3-prime` | `t2v`, `i2v`, `ref2v` | `wan3.0-video-prime` | exact existing Prime route |
| `wan-3`, `wan-3-prime` | `v2v`, `extend` | corresponding Wan 3 all-in-one request | disabled until a Fal-equivalent contract exists |
| `happy-horse-1-1` | `t2v`, `i2v`, `ref2v` | matching HappyHorse 1.1 endpoint | exact existing HappyHorse route only if request parity passes |

Unsupported modes continue through their current provider. Alibaba direct is
selected per engine and mode; family membership alone never selects a provider.

## Request and Media Mapping

Shared request normalization remains authoritative for prompt, duration,
resolution, aspect ratio, audio, references, and attachment ownership. The
Alibaba payload builder only translates already-validated facts.

The direct adapter must enforce Alibaba limits that are stricter than or missing
from the current Fal schema, including:

- 2-30 second Wan 3 output;
- 480p, 720p, or 1080p;
- adaptive and supported fixed aspect ratios;
- image count, dimensions, format, alpha, and 20 MB limit;
- video count, duration, dimensions, fps, format, size, and combined duration;
- audio count, size, duration, and combined duration;
- total Wan 3 input-video plus output duration no greater than 30 seconds;
- mutual exclusion and trust rules for file and web references.

Large media is passed by bounded HTTPS URL, not Base64. Private media uses an
ownership-checked, narrowly scoped, short-lived URL. File and arbitrary web
references remain closed until the existing MCP SSRF and import boundaries can
express them safely end to end.

Provider-specific parameters are never silently translated to a different
meaning. In particular, Fal's safety-checker option is not treated as an
Alibaba moderation switch. Alibaba prompt expansion, watermark, audio, and
smart-duration settings are mapped only when their canonical behavior is
defined and tested.

## Submission, Idempotence, and Fallback

Submission uses the existing app job and provider-attempt lifecycle:

1. Create or resolve the idempotent MaxVideoAI job.
2. Reserve the canonical customer charge.
3. Create provider attempt zero with a sanitized request summary.
4. Acquire the existing job submission concurrency protection.
5. Submit once to Alibaba.
6. Persist the Alibaba task ID and mark the attempt accepted before returning.
7. Poll the accepted task and persist status transitions.
8. Copy a successful temporary output to MaxVideoAI-owned storage.
9. Finalize the job and provider cost, or apply the existing failure/refund path.

No automatic Fal submission is permitted after an Alibaba task ID has been
observed. Ambiguous network failure after request transmission is reconciled
before any new provider attempt. A single fallback attempt is allowed only when
all of the following are true:

- no Alibaba task was accepted;
- the fallback flag is enabled;
- the exact engine, mode, and parameters have a proven Fal equivalent;
- the error is a pre-acceptance timeout, network failure, 429, or retryable 5xx;
- the request uses no Alibaba-only feature.

Moderation, invalid media, invalid parameters, authentication, regional mismatch,
or post-acceptance polling failures do not trigger fallback. Credit exhaustion
does not trigger fallback unless a separate explicit operational flag is added
and enabled later.

## Polling, Storage, and Recovery

Alibaba jobs normalize to the existing queued, running, completed, and failed
provider states. Polling uses bounded exponential backoff with jitter and respects
the account's five-concurrent-task limit. A 429 pauses submission pressure rather
than spawning fallback work immediately.

Successful output URLs are temporary and must be copied to MaxVideoAI storage
before job completion. The original result remains distinct from display
renditions. Storage copy retries are bounded and idempotent. A provider success
with a pending storage copy remains recoverable and is not reported as a new
generation failure.

Jobs whose provider state cannot be confirmed become `polling_stalled`; they are
reconciled without charging twice or submitting another task. Terminal provider
failure flows through the existing user-safe message and wallet refund owners.

## Pricing and Cost Accounting

Customer price remains owned by the canonical pricing package. The adapter
supplies factual provider cost only.

For Wan 3, factual cost uses:

```text
billable seconds = successful output seconds + billable input-video seconds
provider cost = billable seconds * regional model/resolution rate
```

T2V therefore has zero input-video seconds. I2V image input is not treated as
video duration. Ref2V, edit, and extension include billable input video according
to Alibaba's current rule. Failed requests have zero Alibaba generation cost.

The current customer quote must not change merely because the provider route
changes. Existing modes keep their canonical price and stored quote. New `v2v`
or `extend` offerings require canonical pricing scenarios and explicit pricing
parity tests before becoming selectable. Provider attempts record estimated and
actual cost separately so margin and coupon usage can be audited without
recalculating historical customer charges.

## Security and Privacy

- API keys, authorization headers, account IDs, workspace IDs, endpoints with
  private identifiers, signed URLs, query tokens, and raw private references are
  removed from logs and provider snapshots.
- Snapshot sanitization is extended beyond binary omission and covered by tests.
- Only server modules may import provider configuration.
- Input URLs are produced from already-authorized media and have minimum viable
  lifetime and scope.
- Alibaba results are fetched with size, type, redirect, and timeout limits before
  persistence.
- User-facing errors never expose Alibaba, DashScope, internal request IDs, keys,
  endpoints, or billing-account details.
- Inference logging that records prompts or responses is not enabled as part of
  this work.

## Product Surfaces

### Main application

Existing model IDs and controls remain stable. Provider selection is invisible
to users. Wan 3 Edit/Extend controls appear only when the shared capability,
pricing, validation, and routing contracts are all complete.

### MCP

MCP continues deriving models and modes from the canonical engine catalog.
Provider names and keys remain private. T2V, I2V, and Ref2V retain current request
hashing and confirmation behavior. Edit/Extend are projected only after the paid
continuation path validates the exact inputs and price.

### Studio

Studio remains fail-closed. Wan 3, Prime, and HappyHorse workflows are added to
`workspace-model-certification.ts` only after their exact block, connector,
pricing, payload, and output tests pass. Certification records readiness; it does
not duplicate capability values from the engine catalog.

### Admin and operations

Provider attempts and MCP/admin metrics add Alibaba as a provider dimension.
Required operational facts are submission count, accepted count, queue and total
latency, completion rate, moderation rate, 429 rate, stalled polls, storage-copy
failures, fallback count, provider cost, and customer/provider margin. Billing
remains the reconciliation source of truth if Alibaba video telemetry is absent.

### Marketing and examples

The existing model pages, comparison identities, URLs, metadata, and localization
remain stable. No public claim changes because of provider routing. New example
assets are outside implementation verification and require a separately approved
paid generation run and the normal media preparation workflow.

## Test Strategy

Implementation follows red-green-refactor. Each behavior is first represented by
a failing focused test.

Required coverage:

- Alibaba model and mode mapping;
- request payloads for every included workflow;
- response and status normalization;
- provider error classes and safe fallback decisions;
- routing flags, admin-only behavior, and disabled defaults;
- missing/invalid regional configuration;
- no duplicate submission under concurrent requests;
- no fallback after an accepted task ID;
- one fallback maximum before acceptance;
- polling, stalled recovery, and terminal failure;
- temporary-output copy and copy retry;
- factual provider cost including input-video duration;
- canonical customer-price stability;
- provider-attempt lifecycle and secret/URL redaction;
- user-safe error copy;
- application request-body and validation parity;
- MCP discovery, budget, confirmation, and paid execution parity;
- Studio certification and incompatible-block exclusion;
- model-registry and generated-projection coherence;
- admin metrics and provider-cost aggregation;
- media and provider-original storage contracts.

Focused tests run before the complete validation set. Final verification includes
the model registry check, relevant provider/MCP/Studio/pricing contracts, exposure
lint, frontend lint, TypeScript, build, and `git diff --check` under Node 22.

No live Alibaba test belongs to the automated suite. A later manual canary needs
explicit authorization to create/use a key and consume the PoC allowance.

## Implementation Checklist

- [ ] Prepare Node 22 and install the locked dependencies.
- [ ] Add Alibaba to provider types, routing plans, and disabled-default flags.
- [ ] Implement the focused Alibaba client, mappings, payloads, responses, errors,
      and cost facts.
- [ ] Integrate submission with existing job/payment/provider-attempt owners.
- [ ] Add poll, recovery, permanent copy, finalization, and refund behavior.
- [ ] Harden snapshot and log redaction for secrets and signed URLs.
- [ ] Add exact Fal fallback compatibility and no-double-submit protections.
- [ ] Project capabilities and pricing through canonical engine owners.
- [ ] Preserve MCP parity and enable new modes only when end-to-end complete.
- [ ] Certify the included Studio workflows only after their contracts pass.
- [ ] Add Alibaba dimensions to admin/provider observability.
- [ ] Update the provider and model-registry engineering documentation.
- [ ] Run focused tests and all mandated repository validation under Node 22.
- [ ] Review the final diff for unrelated changes and public exposure.
- [ ] Stop before deployment, public routing, key creation, or paid generation.

## Completion Criteria

The branch is implementation-complete when all included models and modes have a
tested Alibaba direct route, current Fal behavior remains available, no direct
route is enabled by default, pricing and MCP contracts remain coherent, Studio is
explicitly certified or fail-closed, provider outputs are permanently stored,
retry/fallback cannot double-submit, secrets are absent from snapshots and client
bundles, and the full required verification succeeds under Node 22.

Completion of the branch does not authorize deployment or consumption of the
Alibaba PoC credit.
