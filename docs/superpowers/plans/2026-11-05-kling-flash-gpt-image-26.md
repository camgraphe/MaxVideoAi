# Kling Flash and GPT Image 2.6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution or superpowers:subagent-driven-development for separately reviewed task implementation. Steps use checkbox syntax for tracking.

**Goal:** Deliver three usable models across App, conversational Studio and MCP, with canonical pricing, owned media and localized marketing.

**Architecture:** Preserve the deployed Kling 4 fal queue/recovery path for Flash, with a separate strict Flash contract. Add OpenAI Images as a real direct image provider for 2.6 while retaining shared jobs, quotes, reservations and output persistence. Registry publication, runtime admission, Studio certification, tariffs and marketing readiness remain separate gates.

**Tech Stack:** Existing Next.js/TypeScript, Node 22, PostgreSQL 17 disposable test helper, fal queue, OpenAI Images HTTP API, existing object storage and Vitest/node:test/tsx/browser tooling as configured in the repository.

**Spec:** `../specs/2026-11-05-kling-flash-gpt-image-26-design.md`.

## Global Constraints

- Canonical IDs: `kling-v4-flash`, `gpt-image-2-6-flare`, `gpt-image-2-6-sunburst`.
- Flash: T2V/I2V/REF2V, 720p, 3–20 whole seconds; no Modify/Extend/end frame/structured multi_prompt/voice binding.
- Images: T2I/I2I raster only in this lot; GIF/SVG/markup stay closed. Explicit complexity low/medium/high, proposed default high.
- Do not retire, redirect or silently substitute existing models or saved jobs.
- Do not copy 2.5 fal image prices into the OpenAI 2.6 direct route.
- No second provider submission after an uncertain acceptance. Preserve accepted IDs, original outputs and historical quotes.
- Every paid qualification has a concrete approved quote or bounded explicit budget; no automatic retry spending.
- Use the normal GitHub PR → required Quality CI → main → Vercel Git delivery and verify both domains.
- Follow the complete release ledger `../../launch/2026-11-05-model-refresh/TASKS.md`; tasks below group its independently testable implementation units.

## Review Focus

1. A restored Kling 4 preset contains 1080p, 30s, end frame or shot-plan settings: Flash must refuse incompatible controls before a debit (task 1).
2. Multiple repeated/video-subject references exceed 20s or change between quote and confirmation: use exact owned facts, no deduplication discount or stale charge (tasks 1/3/4).
3. An OpenAI POST times out after possible acceptance, or storage fails after a complete response: preserve pending/recovery evidence, never auto-resubmit (task 2).
4. A model appears in the public catalog while Studio certification or MCP provider admission is absent: executable status and UI must stay truthful (task 4).
5. Complexity, references, dimensions or tariff revision change after approval: a stale quote cannot execute even when the displayed number happens to be unchanged (tasks 3/4).

## Task 1 — Flash definition, owned references and durable queue transport

**Files:** create `frontend/src/config/fal-engines/kling-v4-flash.ts`, `frontend/src/lib/kling-v4-flash.ts`, `tests/kling-v4-flash-contract.test.ts`, `tests/kling-v4-flash-recovery.test.ts`; extend `frontend/src/lib/fal-request-body.ts`, `frontend/src/lib/fal.ts`, the existing `frontend/app/api/generate/_lib/kling-v4-owned-media.ts` ownership boundary and video generation facts owners where necessary. Preserve the current V4 public contracts and file-boundary tests.

**Interfaces:** `isKlingV4FlashEngineId(id: string | null | undefined): boolean`; `getKlingV4FlashConstraintViolation(mode: string, input: Record<string, unknown>): {field: string; message: string} | null`; `buildKlingV4FlashFalRequest(payload: GeneratePayload): {model: string; requestBody: Record<string, unknown>}`. Return the three exact `kling/v4/flash/*` endpoint IDs. Downstream code consumes existing `GeneratePayload`/queue receipt types, not a new job protocol.

- [ ] Pin the three official schemas as sanitized fixtures, including element subtypes and the exact mixed-reference limit. If a limit is not established, retain an explicit conservative validated envelope and document it; never invent an advertised provider maximum.
- [ ] Write failing tests for 3/20 accepted versus 2/21/fractional durations, 720p only, unsupported fields, I2V source, private references, repeated video facts, subject constraints and aggregate 20s boundary. Reuse V4 fixtures for unchanged baseline assertions.
- [ ] Run the new tests with `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/kling-v4-flash-contract.test.ts tests/kling-v4-flash-recovery.test.ts`; establish the expected missing-definition/behavior failures.
- [ ] Implement the strict definition/adapter and thread Flash through owned-media and queue lifecycle owners. Reuse the common queue implementation; do not add it to the Kling direct map.
- [ ] Add a simulated accepted-request/receipt-persistence failure and assert exactly one POST, durable ID and recoverable state. Repeat with ordinary timeout/definite rejection and rollback of publication.
- [ ] Run Flash tests plus V4 current-contract, owned-media, queue-transport and receipt-recovery suites; all must pass. Commit only this bounded unit and its evidence.

## Task 2 — OpenAI Images provider and durable image execution

**Files:** create `frontend/src/server/images/openai-image-client.ts`, `openai-image-payload.ts`, `openai-image-response.ts`, `openai-image-error.ts`, `openai-image-execution.ts`, and `tests/openai-image-provider.test.ts`; extend `image-direct-provider-execution.ts`, `execute-image-generation.ts`, image provider failure/completion/accounting owners only where required, plus the existing environment configuration owner.

**Interfaces:** expose `isOpenAIImageConfigured(): boolean`, `assertOpenAIImageAvailable(engine: EngineCaps): void`, and `executeOpenAIImageGeneration(params: OpenAIImageExecutionParams): Promise<ImageGenerationResponse>`. Define `OpenAIImageExecutionParams` beside the executor from the shared direct image inputs, adding the validated 2.6 quality, size, complexity and background values. Reuse the existing generation response/receipt/storage interfaces; do not expose raw keys or base64 outputs to logs/browser DTOs.

- [ ] Read current official generate/edit contracts and existing direct provider architecture tests; fix raster format/dimension/reference/count bounds before writing the schema. Explicitly decide and test supported mask behavior.
- [ ] Write injected-fetch tests for exact model IDs and endpoints, multipart/JSON edit contract as documented, owned-reference fetching, MIME/size bounds, b64 decoding, usage parsing, sanitized errors, unsupported GIF/SVG/markup and zero automatic POST retries.
- [ ] Run the tests and confirm failure, then implement the client/payload/response modules. Reuse the existing key server-side; do not create or copy credentials.
- [ ] Add the dispatcher branch and persist outputs/thumbnails/completion through existing owners. Fail before charging when provider/storage configuration is absent.
- [ ] Add PostgreSQL-backed reservation and failure regressions: duplicate confirmation, ambiguous transport, post-provider storage failure, partial valid outputs and a terminal rejection. Verify the existing recovery/accounting invariants rather than copying another provider's unverified retry policy.
- [ ] Run provider tests and `tests/image-generation-paid-recovery-postgres.test.ts` through the repository PG17 helper, plus image-generation architecture tests. Commit the validated unit.

## Task 3 — Canonical definitions, settings and pricing facts

**Files:** create `frontend/src/config/fal-engines/gpt-image-2-6.ts`, `frontend/lib/image/gptImage26.ts` and focused 2.6/Flash pricing tests; extend raw engine registration, `frontend/config/model-registry.json`, `frontend/types/image-generation.ts`, `frontend/src/server/images/estimate-image-generation.ts`, `image-generation-pricing.ts`, shared billing facts and the canonical manual-tariff inventory/scenario owners. Regenerate projections with the documented commands.

**Interfaces:** `normalizeGptImage26Settings(input: Partial<ImageGenerationRequest>): GptImage26Settings` returns explicit validated raster settings; the canonical request uses `settings.complexity` and the website body uses `complexity` with the same enum. Supplier facts are returned to the existing pricing owner; they never author a customer price directly.

- [ ] Add failing identity/settings tests for both exact IDs, qualities, dimensions, format/background combinations and default complexity. Keep old GPT2/2.5 normalization assertions unchanged.
- [ ] Add Flash supplier formula tests: no-video `9.4 * outputSeconds` cents; video `6.3 * (outputSeconds + max(inputSeconds, outputSeconds))` cents, with exact trusted aggregate timing and no premature rounding.
- [ ] Establish 2.6-specific output-token estimates from official evidence and input-token bounds from the real request. Capture provenance and conservative cases. If an exact bounded scenario cannot be quoted safely, leave that scenario unavailable and report the explicit release blocker; do not use the old fal 2.5 table as a fallback.
- [ ] Implement supplier facts, inactive commercial scenario inventory and exact quote propagation. Keep complexity in immutable request fingerprints even when price-neutral.
- [ ] Add PostgreSQL parity tests across admin/public/App/Studio/MCP prices, inactive/missing-cell rejection, reference mutation and tariff revision. No production tariff writes.
- [ ] Run registry generation/check, focused pricing and settings tests plus the selected exhaustive financial lane. Commit definitions and all generated projections together.

## Task 4 — App, Studio, MCP, Milo and library coverage

**Files:** extend schema-driven App/image settings owners, settings snapshots, canonical normalization/details/paid-request builders under `frontend/src/server/agent-api`, `frontend/src/server/agent-runtime/model-executability.ts`, Studio `conversation-capabilities.ts`/`conversation-reference-limits.ts` and shared `workspace-model-certification.ts`; update `frontend/config/agent-model-guidance.json` and `agent-model-prompting-sources.json` only with factual reviewed sources. Use existing library/media owners.

**Interfaces:** every surface consumes the same registry identity, validated settings, owned references and canonical quote. New provider availability is explicitly represented in `AgentGenerationExecutabilityEnvironment`. Studio image count remains one per action; preserve the surface's established reference bound.

- [ ] Write failing parity tests for each of the seven model/mode pairs, including publication on but provider/certification off, unsupported fields and stale quotes.
- [ ] Implement App selection/controls, persistence/recreation and library handoffs. Add complexity through shared schemas and snapshots; avoid UI-only parameter branches.
- [ ] Implement Studio certification and exact model selection, details, quote/confirm, output attachment and reload/recovery for both image variants and all Flash modes. Preserve old Canvas/export gates and fixed tool choices.
- [ ] Implement MCP provider admission/details/budget/prepare/confirm/recover parity; keep output constraints and references truthful. Do not infer availability from the presence of a key alone.
- [ ] Audit Milo and Storyboard/Character Studio/Angle consumers. Change only facts/selection supported by this scope; record deliberately fixed models instead of migrating them.
- [ ] Run `pnpm mcp:client:check`, shared mode parity and Studio PostgreSQL/browser lanes, plus local responsive App tests. Verify origin ownership, loading/errors and no duplicate submission after navigation. Commit this unit.

## Task 5 — Localized pages, examples and marketing candidate

**Files:** add `content/models/{en,fr,es}/{kling-v4-flash,gpt-image-2-6-flare,gpt-image-2-6-sunburst}.json`; extend route-local template registry and templates, shared model catalogue/navigation/family/examples owners, comparison content and prompting source configuration. Follow model-registry and media-delivery guides before media changes.

**Interfaces:** content `decision.modelSlug` exactly matches the canonical slug; all prices come from canonical live readers; examples retain their real original model identity and assets. Registry surface publication controls links and indexability.

- [ ] Author nine localized pages with actual available modes, clear limits, positioning, source links, useful prompts and CTA destinations. Draft the three targeted comparison journeys without fabricated scores or output samples.
- [ ] Add tests for canonical/hreflang/JSON-LD, exact IDs, localized decisions, disabled-mode links and preserved historical routes. Verify the existing menu limits and family owner.
- [ ] Prepare original creative briefs and a bounded generation proposal; mark every unrendered example as a draft. Write site/blog announcement and optional external-channel copy as drafts.
- [ ] After task 6 yields approved real media, import originals/posters/previews, attach model/family collections with revision-aware admin preview, and validate exact replay settings. Preserve current manual order.
- [ ] Run model-page/SEO/family/media contracts, `pnpm model:launch-assets:check`, localized browser smoke tests and applicable performance evidence. Keep marketing gates closed until real assets/prices/readiness are complete.

## Task 6 — Account qualification, tariff approval and release evidence

**Files:** update the launch evidence/ledger and inactive canonical tariff proposal artifacts through existing admin owners; no custom production SQL.

**Interfaces:** each qualification row records exact model/mode/settings, caller surface, quote/budget approval, one attempt, provider receipt, measured output, cost and result. The native tariff preview returns the actual commercial diff/fingerprint before confirmation.

- [ ] Verify Production/Preview credentials and exact provider admission safely; stage only required nonsecret admission changes for a fresh normal Git deployment.
- [ ] Present the concrete canary/media batch and exact quotes or bounded budget. Wait for that spending approval, then execute one attempt per approved request; recover ambiguous outcomes.
- [ ] Review output identity/audio/format/reference preservation and actual usage/cost; fix failures before marking any mode qualified. Reuse qualifying approved media for marketing where appropriate.
- [ ] Present the inactive tariff matrix via native preview, obtain confirmation of the concrete amounts, apply only reviewed cells and verify all advertised scenarios. Record separate supplier and retail facts.
- [ ] Complete App/Studio/MCP evidence independently. If one mode fails, explicitly leave it unavailable and update public claims; never silently certify the entire family.

## Task 7 — Normal delivery, public opening and rollback verification

**Files:** publication/admission changes in existing owners and the launch ledger. No deployment bypass or unrelated cleanup.

- [ ] Split coherent PRs by family when useful, with exact final scope and focused evidence. Candidate includes current main; required Quality CI and every selected lane pass.
- [ ] Validate Git Preview identity and configuration, run `pnpm deployment:check`, merge normally and wait for Vercel Git READY. Recheck alignment immediately before merge if another task delivered.
- [ ] Verify both production domains equal the merged SHA; check live App/Studio/MCP discovery, settings and prices, plus localized pages. Distinguish read-only checks from explicitly approved paid calls.
- [ ] Open functional and marketing surfaces only when their individual gates have passed. Publish site content through the normal path; no social/email sending without an explicit instruction.
- [ ] Record errors/latency/cost observations, badge review date and rollback: close only affected new admissions/publications through Git while preserving accepted jobs, pollers, receipts, assets and tariff history.
- [ ] Report actual PRs/SHAs/deployment, tested surfaces and residual closed modes. The second-lot GIF/SVG/markup tasks remain separately tracked.

## Plan self-review

The seven units map to ledger groups A–H and leave second-lot L2 explicit. Each has a testable owner boundary. Price approval and paid media are downstream concrete decisions, not implicit consequences of this design. The plan introduces no new state library, database store, parallel pricing engine or direct Kling 4 route. Design review found no missing business decision needed to plan the work; provider contract completion and exact commercial amounts remain named implementation/release gates.
