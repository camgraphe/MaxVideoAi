# Studio and MCP — conversation learning and model positioning

Date: 3 October 2026. Status: proposed product and engineering strategy, grounded in the current worktree. This document does not enable collection, change model recommendations, or establish production readiness.

## Intended outcome

Studio should be our primary source of evidence about how clients create with an assistant. We need to inspect an interaction, identify what helped or failed, test a correction, and carry useful improvements into both Studio and MCP. English is the primary evaluation language; French remains a required secondary cohort.

The assistant is expected to exercise creative judgment. What is currently missing is measured evidence of the quality of that judgment. A successful tool call, a downloaded file, and an artistically satisfactory result are different outcomes.

We should instrument every in-scope observable interaction, measure collection gaps, and review selected cases in depth. This is not a promise to retain every client's content indefinitely or to obtain conversations held inside an external host.

## Existing evidence and its limits

These observations come from source inspection, not a query of customer data or a production deployment check.

| Area | Existing owner | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| Studio submitted messages and replies | `frontend/src/server/studio/image-conversation-repository.ts`; migration 50 | Account/project/request identity, submitted input, retained draft/reply, quote association and retry state | Complete model context, instruction version or user satisfaction |
| Studio action-based dialogue | `frontend/src/server/studio/conversation-run-repository.ts`; migration 52 | Saved model responses, usage, elapsed time, actions/results and observed project revision | A unified review interface, every pre-validation failure, or exact historical context reconstruction |
| Older image director | `frontend/src/server/studio/image-model-usage.ts`; migration 51 | Model identity, usage and latency evidence, with unresolved calls kept unknown | Raw text content in the usage ledger |
| MCP activity | `frontend/src/server/agent-api/audit-events.ts`, `frontend/src/server/mcp/http-handler.ts` | Coarse authenticated discovery/call outcomes and client attribution | Host transcript, every argument/result, reliable conversation grouping or all failed dispatches |
| Admin reporting | `frontend/server/admin-mcp-metrics.ts`, `admin-mcp-outcomes.ts` | Existing operational reporting and explicit unavailable states | Fully instrumented commercial or quality funnels |

The MCP audit intentionally rejects prompts, secrets, email and raw/reference URLs. Its transport-level call events currently leave model, surface and error details null; storage is best effort. `admin-mcp-producer-capabilities.ts` enables audit and polling while several other metric producers remain disabled. Preserve these honest boundaries instead of treating an existing reporting field as collected data.

The Studio history reader's 30-turn limit and the director's eight-turn context window are not retention policies. Project memory is mutable. A later database read must not be presented as the exact context that an earlier model saw.

## Recommended approach

Use existing domain records as authoritative evidence and add a shared, structured review projection. This avoids two weaker approaches: retaining unbounded raw payloads everywhere, or retaining only counters that cannot explain an incident. A hosted tracing product may later receive a sanitized projection; it should not become a second source of billing, media ownership or conversation truth.

### 1. Studio: record the observable creative journey

Connect the submitted brief, visible assistant reply, tool calls, proposed model, selected model, price read, confirmed quote, job/output and subsequent edits. Record explicit feedback separately from behavioral signals. A client may be exploring successfully without ever generating; prompt-only and editing-only sessions are valid completions.

For each turn retain or reference:

- Internal account/project/turn/call identities and the originating surface; exact quote/job/output links when present.
- Server build, instruction and tool-schema versions, catalog/editorial-policy versions, feature gates, requested and returned assistant-model identity. Keep an immutable manifest for the actual context used: selected history turns, memory/project revision and tool-fact snapshots or durable versioned references. A hash alone is not reconstructable evidence.
- Validated settings and media identities/roles, never signed access URLs in analytical exports. Media permissions are checked again whenever a reviewer opens an asset.
- Lifecycle timestamps, error category, recovery/retry relationship, usage and quoted/charged/refunded amounts with currency and pricing identity where available. Preserve missing or ambiguous outcomes as unknown.
- Displayed recommendation and its stated rationale, candidate choices and observed user override. This concerns visible explanations and tool decisions, not hidden model reasoning.
- Feedback attached to a message or output: helpful/not helpful, optional reason or comment. Keep explicit acceptance distinct from download, timeline insertion, revision, regeneration and inferred abandonment.

Recommendation exposure must be recorded before selection so we can distinguish what we recommended from what the client actually chose. Each derived outcome keeps its source and confidence; LLM-inferred satisfaction is never substituted for customer feedback.

### 2. MCP: collect useful evidence within the actual boundary

The external host manages its own dialogue. Our server can observe requests addressed to us and our responses. It does not automatically receive unrelated messages, the assistant's final wording or the host model's hidden reasoning. See the [MCP architecture](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture).

Extend structured tool observations with validated non-content parameters, latency, actionable error codes and exact business-object links. Keep the existing coarse audit contract intact. Deeper content review uses a separate restricted mechanism and an applicable content-use policy, not arbitrary JSON added to the analytics table.

Group calls by server-validated project, quote, job or another explicitly issued operation handle. OAuth client ID and timestamp proximity do not identify a conversation. A host-provided identifier is an untrusted hint and never an authorization boundary. Unlinked discovery calls remain unlinked. Record client/model/version as unknown when unavailable; do not infer a host's model from its brand.

Optional user-shared transcripts or instrumented test-host sessions can supply fuller evidence. Label them separately and record provenance. Studio evidence can improve shared guidance, tool responses and error recovery, but host-specific discovery, context limits and presentation still require external-host tests.

### 3. Collection quality, access and retention

Keep mandatory transactional records and recovery checkpoints in their existing owners. Project analytical events asynchronously through idempotent event IDs and bounded retry/outbox processing where appropriate. An analytics outage must not cause duplicate generation or change payment authority. Conversely, existing mandatory pre-dispatch checkpoints must not be weakened to best-effort logging.

Expose capture health, unresolved attempts, projection lag and missing version/context coverage. Cross-check expected events against authoritative turns/jobs. Deduplicate retries without hiding individual attempts. Report unknown coverage when no authoritative denominator exists; never claim 100% collection from received logs alone.

Separate customer history from improvement datasets. Detailed review requires restricted admin access, an access/export audit, appropriate customer information and a defined content-use policy. Do not start exporting customer content to another LLM merely because it is already stored for the service. Keep tokens, secrets, signed links and unnecessary identifiers out of review bundles. Automated redaction is a safeguard, not a claim of complete anonymization.

Before activating content review, configure and verify retention/expiry and deletion across source references, review copies, exports and derived datasets. Financial records retain their own lifecycle. Proposed initial review-copy window: 30 days, configurable and subject to the product's approved data policy; operational retention must be decided separately. The engineering design must not silently create indefinite storage or change existing customer-history retention.

### 4. Review and improve

Provide an admin interaction viewer with filters for surface, host, language, model/policy version, failure and feedback. Show the available conversation, action sequence, prices and media links, alongside a prominent full/partial/unknown coverage label. Support bounded redacted JSONL exports and human annotations with source event IDs.

“Full” means complete against the declared observable scope, never access to hidden reasoning or unseen host messages. Any export states that scope, its time window, schema version, source versions and missing evidence. During beta, review critical incidents daily and a stratified sample weekly; this is a proposed operating cadence, not an automation activated by this document.

The review loop is: representative sample plus failures and negative feedback → human/LLM diagnosis → evidence-linked hypotheses → a small versioned change → offline regression evaluation → real Studio/host qualification → staged release and outcome comparison. This is product iteration, not automatic training or automatic production prompt rewriting.

A review LLM treats transcripts and tool output as untrusted data. It receives no spending, production mutation or messaging tools. Findings must cite observed events, distinguish fact from inference and admit missing evidence. Evaluate the reviewer against human-labelled cases. Replaying a trace uses mocks or read-only tools; no historical confirmation is replayed as new spending authority.

Evaluate task success, unnecessary clarification, wrong-reference mistakes, violated model preference, unsupported parameters, price/debit discrepancies, unrecovered failures, time to first useful result, and cost/attempts to an explicitly accepted result. Publish sample sizes and unavailable denominators. Segment by brief type, host, language and version; popularity alone does not prove quality because recommendations influence exposure.

## Competitor positioning: evidence, not a copied ranking

Public sources consulted on 3 October 2026. These describe vendor positioning, not access to their private measurements. Do not import their prices or provider-specific capabilities into MaxVideoAI.

| Source | Public position | Implication for us |
| --- | --- | --- |
| [Higgsfield catalog](https://raw.githubusercontent.com/higgsfield-ai/skills/main/higgsfield-generate/references/model-catalog.md) | Seedance 2.5 is its general video default; Seedance 2.0 covers native 4K. Kling 3/Turbo serves simpler motion, cost or speed. Seedance 1.5 Pro is budget-oriented. Wan 3/Prime is available on request. Ads route to its own Marketing Studio workflow. | Prefer exact versions by task; neither a family-wide quality score nor an assumption that its internal workflows are available here. |
| [Artlist video catalog](https://artlist.io/ai/video-generator) | It describes comparison across common briefs, motion, prompt adherence and continuity. Wan 3 is positioned for connected shots and character consistency; Kling Turbo for iteration. Its realism guidance includes Veo, Kling, Hailuo and Seedance. | Wan merits task-specific consideration. Preserve alternatives; its method is useful even though its underlying comparative results are not disclosed here. |
| [Runway router configuration](https://docs.dev.runwayml.com/model-routers/configuration/) | Eligible models are filtered by constraints and a cost ceiling, then optimized for cost, latency or quality. This page does not disclose the underlying artistic ranking. | Separate execution eligibility, affordability and creative preference. An exposed quality option is not a reproducible quality benchmark. |

Higgsfield also positions GPT Image 2.5 as general image/design default, Nano Banana 2 for illustration/characters, and Seedream 5 Pro for face-led work. These are image hypotheses to compare against our executable image catalog, not an authorization to publish or activate models.

### Proposed MaxVideoAI starting position for discussion

1. **Open video brief:** Seedance 2.5 is a candidate default supported by explicit competitor positioning, subject to actual availability, references and budget.
2. **Motion/control or quick iteration:** select an appropriate exact Kling version; verify that the advertised control exists on our route. Use actual MaxVideoAI quotes before calling it cheaper.
3. **Sequence/character continuity:** include Wan 3 and suitable alternatives when their executable modes fit. Artlist supports investigating this role; Higgsfield's on-request treatment is not proof of inferiority.
4. **Realism or audio-led requirements:** keep Veo and other appropriate alternatives eligible. Do not eliminate a good task match to protect a three-family preference.
5. **Older, cheaper or specialized variants:** use for a concrete tradeoff or an explicit client choice. Keep Pika available on request; absence from these sources is not a measured negative judgment.

Normally propose one option with a short explanation, plus an alternative only when useful. Any compatible explicit client choice remains authoritative. Our current editorial file marks 15 exact video variants as reference entries; this is broader than the proposed use-case approach and remains unchanged pending the product discussion.

## Release sequence and evidence gates

**Before an instrumented Studio beta:** implement the version/context manifest, reliable trace linkage and capture-health reporting; add restricted review/export and explicit feedback; exercise account isolation, deletion/expiry, redaction, retry deduplication and the analytics-failure path. Verify the ability to reconstruct a seeded success, interrupted turn, price change, model override and reference mistake. Run a real assistant qualification on fixed English/French briefs. Existing offline fixtures alone do not meet this gate.

**During beta:** review all critical price/authorization/reference incidents and a representative sample of ordinary, successful and unsuccessful interactions. Start with a proposed 30-brief evaluation corpus covering ideation, image, video, editing, prices and recovery. For costly creative comparisons, predefine the same brief, references, number of attempts and spend cap; use blind human review alongside measurable outcomes. No paid benchmark is launched by this document.

**Before broad rollout:** demonstrate a working review-to-fix loop with a versioned regression case and before/after evidence; qualify each claimed external MCP host separately. Publish actual sample counts and uncertainty. Do not postpone all learning until after release, and do not require an invented universal artistic score to ship a bounded, observed beta.

## Implementation boundaries

This requires three increments: (1) versioned capture and safe projections, (2) admin review/feedback/export, (3) evaluation and policy iteration. Keep server persistence and analysis under server owners, admin pages as orchestrators, and UI feedback local to the conversation feature. Reuse current pricing, quotes, jobs and project-command identities. New Neon migrations are explicit; reporting reads must not bootstrap schema. Relevant existing contracts include `tests/mcp-audit-events.test.ts`, `tests/admin-mcp-metrics.test.ts`, `tests/studio-conversation-runs-postgres.test.ts` and the Studio conversation architecture tests.

Implementation and activation remain outstanding. No production data was accessed, no new collection was enabled, and no commercial price or model policy was modified to write this strategy.

The subsequent [Agent entry and economics proposal](2026-10-03-agent-entry-and-economics-design.md) extends the review surface to authenticated prompt assistance in Create and defines separate provider-cost, included-allowance and optional customer-charge evidence. It preserves existing media billing and external MCP authority.
