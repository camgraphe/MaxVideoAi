# Kling V4 — fal-first completion plan

22 October 2026, Europe/Madrid. Continues draft PR 494 from `6a076843b28dc143662d0d86907cd62a6d816dad`.

## Scope and authority

Adrien agreed to prioritize fal for the initial integration, then asked to finish everything that can be prepared before API access. This supersedes the previous direct-first sequencing. Direct Kling account recovery and a verified direct contract remain separate future work and do not block offline fal integration.

The existing implementation-map and provider-evidence documents specify the contract. This plan finishes the known editors, owned-request projections and media tooling. It does not qualify generation, price accuracy or media quality by fixtures.

## Global constraints

- Keep all V4 execution, billing, certification and public-discovery gates closed. No paid generation, voice creation, production writes, deployment, merge, key changes or external messages.
- Preserve historical model/family URLs, models, media and owner-curated playlist ordering. Normal model pages remain private/noindex.
- Implement the published fal four-mode envelope without inheriting V3 limits or unsupported V3 controls. Strict integer output 3–30 seconds; shot prompts 1–512 characters, whole 1–30 second shots and exact 3–30 second sum. Main prompt at most 2,500 characters. Edit has no multi-shot.
- References retain owned original identity/order/metadata. R2V permits seven elements, at most three video and three voiced elements; Edit image elements only. Voice provenance is provider-specific. Never inject arbitrary element URLs via settings or silently truncate invalid requests.
- All future quotes and confirmations must bind the complete request, including ordered subjects and voice changes. Existing ownership checks are mandatory before pricing/execution. Raw external voice IDs are not proof of ownership.
- Normal fal list cost plus 30% remains the customer-authoring basis; candidate estimates never activate tariffs.
- No fake hero, media, score, video schema, provider acceptance or successful paid test. Real renders and reviews remain access/budget dependent.

## Task 1 — workspace controls and persistence

Complete explicit V4 editor projection, shot plans, reference/element limits and saved setup round trips through existing workspace owners. Keep V3 behavior unchanged. Use owned library assets for elements and expose only verified owned provider voice bindings; if no binding exists, present the prerequisite clearly. Cover mode transitions, stale duration settings, fractional/overflow rejection, seven subjects and input/reference preservation with focused tests and an offline browser fixture where feasible.

Own workspace route files, shared Kling editor components, workspace tests. Do not edit canonical server agent contracts, Studio conversation, provider builder, registry publication or pricing policy.

## Task 2 — canonical owned subjects and Studio/MCP preparation

Add an explicit canonical subject structure linked to existing canonical reference identities, with strict normalization and owned resolution. Include semantic fields in canonical hashing and confirmation snapshots and preserve body projection. Support explicit Studio shot plans through action schemas and editors, retaining exact-quote confirmation. Extend MCP schema/discovery only within closed V4 gates and existing budgets; update required offline fingerprints/evidence. Do not introduce unverified voice issuance or accept arbitrary voice IDs as owned.

Own agent-api, Studio conversation and MCP owners and their tests. Coordinate shared types by messaging Task 1. No workspace editor file edits without coordination.

## Task 3 — owned media import and release assembly

Prepare an explicit Kling V4 adapter for the existing external-fal import workflow if applicable, with owner/idempotency/payment safeguards, accepted provider evidence, prompt/settings, original/poster/short-preview roles and offline tests. Preserve FLUX compatibility. Provide a dry-run inventory/placement workflow for the model, existing Kling family and selected SEO videos without changing live data or order. Do not fabricate result manifests or assets. Document unavailable runtime prerequisites.

Own external import tooling/contracts/tests and media-qualification documentation. Do not alter registry/media publication or external state.

## Task 4 — integration, review and delivery

Refresh fal public schema evidence without a paid call. Update provider sequencing and completion status consistently in existing documentation. Run targeted verification, TypeScript/lint and relevant existing architecture contracts; address findings. Request independent spec/code review of scoped changes, then the complete new diff. Commit and update existing draft PR; preserve preview protection. Report exact tested scope and access-dependent remaining work.

## Review focus

Ownership before pricing; immutable quote binding; mode switches and saved setup restoration; no V3 regressions; unsupported input rejection without rounding/truncation; no automatic paid retry; missing media and closed gates remain truthful; legacy FLUX importer compatibility.
