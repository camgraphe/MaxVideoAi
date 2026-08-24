# Operational Seedance 2.5 MCP Design

**Date:** 2026-08-25  
**Branch:** `codex/mcp-foundation-clean`  
**Target:** the dedicated hosted MCP staging environment first; production remains unchanged

## Goal

Make Seedance 2.5 a genuinely executable flagship model in the MaxVideoAI MCP. A connected Codex or Claude client must be able to discover the model, compare it, build a project budget, upload or select every supported reference type, prepare an exact quote, obtain explicit user confirmation, submit the generation, and recover its final status.

"Without restriction" means no accidental MCP-only limitation, no administrator-only routing, and all five provider-backed workflows exposed when their requirements are met:

- text to video (`t2v`);
- image to video (`i2v`);
- multimodal reference to video (`ref2v`);
- video to video (`v2v`);
- extend or stitch source clips (`extend`).

It does not remove commercial or safety invariants. Every paid generation still requires an exact quote, an explicit confirmation, sufficient wallet balance, the user's spending controls, idempotent charging, and the existing failure/refund path.

## Current Evidence

The hosted staging MCP exposes 42 models. Thirty-eight report `generationEnabled: true`; four report `false`: Seedance 2.5, Seedance 2.0 Mini, Seedream 5.0 Lite, and Seedream 5.0 Pro.

Seedance 2.5 and Mini use direct BytePlus ModelArk routes. The isolated staging project intentionally has no provider key or provider enablement variables, so those routes fail closed. The two Seedream image models also fail the current shared executability test because a `byteplus_modelark` declaration is sent through a Seedance-video profile resolver that has no Seedream profile.

The MCP currently exposes only read-only discovery tools on hosted staging. Paid tools are controlled by the static publication source, reference discovery is image-only, and the canonical MCP generation modes exclude `v2v` and `extend`. Therefore an environment-variable change alone cannot deliver the approved outcome.

## Design Decisions

### 1. One authoritative runtime-capability decision

Replace the provider-name shortcut with a surface-aware execution policy:

- Seedance video engines use the existing BytePlus Seedance profile, global provider switch, model switch, provider selection, public/admin policy, and allowed-mode policy.
- Seedream image engines use a dedicated Seedream readiness policy that checks the direct image route and required BytePlus configuration without pretending that they are Seedance engines.
- Other public engines retain their existing provider path.
- The result includes a closed internal reason code for tests and diagnostics, while the public DTO continues to expose only `generationEnabled` and safe capabilities.

The catalog, recommendation service, exact model details, budget service, prepare service, and confirm service must consume the same authoritative decision. A model must never be recommended as executable when prepare or confirm would reject it for the same runtime configuration.

### 2. Staging-only operational gate

Keep all eight static MCP publication flags false. Add a fail-closed hosted-staging operational gate that is true only when all of the following are exact:

- production runtime mode;
- `MCP_STAGING_ENABLED=true`;
- request host, configured API host, resource URL, and approved staging host all match `maxvideoai-mcp-staging.vercel.app`;
- a dedicated operational staging flag is true;
- the host is not any MaxVideoAI production host.

This gate enables paid generation, recovery tools, reference-media tools, and their backing services only on the dedicated staging host. Prepare and confirm receive the same runtime decision; they must not continue consulting a different static flag after the tools have been exposed.

The production project, production domains, production deployment protection, production database, and production publication flags remain untouched.

### 3. Complete Seedance 2.5 capability contract

Extend the canonical MCP video-mode union and strict tool schemas with `v2v` and `extend`. Mode capabilities come from the existing authored engine registry rather than copied constants.

The public Seedance 2.5 contract must preserve these provider-backed facts:

- 4–30 second output;
- 480p and 720p;
- native audio toggle;
- start image and optional end image for `i2v`;
- images, video clips, and audio clips for `ref2v`;
- one source video plus optional image/audio references for `v2v`;
- one to three source clips for `extend`;
- the existing total and per-kind reference limits.

Validation remains closed-world. Unsupported settings, missing required sources, excessive references, wrong media types, unsupported modes, and settings that cannot be priced are rejected before a quote or provider request exists.

### 4. Private multimodal media references

Generalize the private MCP media DTO and resolver from raster images to `image`, `video`, and `audio` while preserving the existing privacy boundary:

- query by both `asset_id` and authenticated `user_id`;
- return the same not-found result for missing and other-user assets;
- require ready, non-deleted assets;
- use explicit MIME allowlists and byte/duration limits for each kind;
- expose only controlled signed preview URLs, never raw storage origins;
- materialize short-lived signed provider input URLs only on the server;
- keep storage URLs out of tool responses, logs, and audit payloads.

`list_media` receives an optional kind filter. `create_reference_upload_link` receives a required media kind and reuses the current MaxVideoAI upload/storage owners for image, video, and audio instead of creating a second storage implementation. If a kind cannot yet use a safe existing uploader, the tool returns an explicit MaxVideoAI handoff rather than accepting unvalidated bytes.

### 5. Mode-aware provider materialization

The confirmed immutable request remains the source of truth. At job creation, resolved references are projected into the existing Seedance 2.5 provider fields according to mode and MIME type:

- `i2v`: start image and optional end image;
- `ref2v`: image, video, and audio reference arrays;
- `v2v`: required source video plus optional image and audio arrays;
- `extend`: one to three ordered source videos.

Provider-specific IDs and URLs remain inside the provider adapter. Aspect ratio stays omitted when source framing owns it. No default or pricing formula is duplicated in MCP code.

### 6. Financial and operational safety

Operational staging uses normal wallet funding; it does not create a free Seedance 2.5 trial. The existing Seedance Mini acquisition trial remains a separate preset.

The flow is:

1. discovery and optional project-budget comparison;
2. `prepare_generation` validates capabilities and returns an immutable exact quote;
3. Codex or Claude displays the amount and asks the user;
4. `confirm_generation` requires the exact quote and explicit confirmation token;
5. the wallet is reserved once and the provider job is submitted once;
6. status tools expose progress and final receipts;
7. provider rejection or terminal failure follows the existing reconciliation/refund owner.

No automatic retry may create an additional paid job. Creative attempts are budget-planning inputs, not silent provider retries.

### 7. Provider credentials and rollout

The staging project requires a dedicated BytePlus ModelArk credential with only the models and region needed for this test. The credential is added through Vercel's secret environment storage and is never written to Git, logs, reports, or shell output. A production provider credential is not copied into staging without a separate explicit approval.

The staging runtime will set the existing Seedance 2.5 provider switches to enabled, select `byteplus_modelark`, disable admin-only routing, and allow all five supported modes. Seedream and Mini are enabled only when their own direct-route readiness checks pass.

Deployment continues through the reviewed staging wrapper. Its allowlist and documentation must be updated so provider secrets are permitted only for the operational staging profile while production-project invariants remain read-only and verified before and after deployment.

## Error Handling

Public errors stay stable and actionable:

- unavailable provider or disabled mode: `ENGINE_UNAVAILABLE` or `MODE_UNSUPPORTED`;
- missing or invalid media: the existing reference error family;
- invalid setting or unpriceable request: `PARAMETER_INVALID` with a safe edit action where available;
- insufficient balance or account spending policy: existing top-up or approval handoff;
- provider failure: sanitized status plus existing receipt/refund behavior.

Secrets, provider payloads, raw URLs, user identifiers, filenames, and upstream error messages must not appear in MCP responses or logs.

## Verification Strategy

Implementation follows test-driven development. Each production change begins with a failing contract or integration test.

Required local gates:

- executability parity for Seedance video, Seedream image, and unrelated providers;
- strict mode/schema tests for all five Seedance 2.5 modes;
- media owner, MIME, size, duration, deletion, and cross-user non-leak tests;
- reference-to-provider projection tests for image, video, audio, ordering, and limits;
- exact quote, confirm, concurrency, wallet, receipt, refund, and recovery regressions;
- staging host and production-host fail-closed tests;
- MCP tool inventory, instructions, plugin contract, and offline tool-selection evaluation;
- TypeScript, lint, exposure lint, model-registry check, diff check, and production build.

Hosted verification uses the installed Codex client against the dedicated staging origin. It first proves tool discovery and a zero-spend prepare-only quote. Then, after explicit confirmation, it submits exactly one low-cost 4-second 480p Seedance 2.5 generation with audio. The prompt should produce a clean, brand-safe cinematic asset that can be reused in MaxVideoAI marketing. No additional generation is made unless the first request fails before provider acceptance and a new attempt is explicitly approved.

Success requires:

- Seedance 2.5 reports `generationEnabled: true`;
- all five modes appear with exact capabilities;
- a real quote and confirmation complete through OAuth;
- the provider accepts one job;
- status reaches a terminal success and the media appears in the authenticated library;
- the wallet and final receipt match the exact quote once;
- no other model or media is generated;
- production remains unchanged.

## Delivery Boundary

All code and documentation remain on `codex/mcp-foundation-clean`. The dedicated staging deployment may be updated after local gates pass. There is no merge to `main`, production deployment, public indexing, marketplace publication, or production flag change in this work.
