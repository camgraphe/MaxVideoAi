# Agent across Create and Studio — experience and unit economics

Date: 3 October 2026. Status: working product proposal. The user has requested shared Agent capabilities and account continuity; commercial allowances and customer prices below are hypotheses, not activated tariffs. Existing media billing remains authoritative.

Scope update: the broader Create image/video redesign is explicitly deferred. Preserve this direction for a later coherent release: prompt assistance and reusable prompt context, image/reference selection, account continuity, and visual/interaction consistency with Studio. Do not add isolated buttons or a second incompatible media picker now. Current priority remains Studio interaction auditing and conversational cost/allowance design; the Create flow below is a future requirement, not an instruction to implement it in the current batch.

## Agreed direction

- Use **Agent** as the user-facing entry name.
- Selecting Agent requires an authenticated MaxVideoAI account, including for an included/free allowance. Preserve the draft through login/account creation and return to the originating field.
- Offer help wherever a creation prompt is authored, starting with Create video/image, then qualified additional surfaces. Do not attach an agent indiscriminately to unrelated text inputs.
- The assistant can suggest a prompt, a generation model, compatible settings and references. It should understand the current surface and selected media model.
- In Create, the existing **Generate** action is the explicit confirmation of the visible media request and price. Agent cannot silently generate or spend for the client.
- Studio retains the deeper conversation and editing experience. GPT-6.1 Sol is the initial quality baseline, not a permanent architectural dependency.
- Preserve the existing commercial strategy for media and external MCP access. This proposal addresses the additional cost of the first-party conversational API.

## Shared capabilities, distinct interfaces

Create, Studio and external MCP should expose adapters over the same server services for model facts, recommendation policy, reference validation, pricing, preparation, generation and recovery. Our web interface need not call our remote MCP transport or obtain an OAuth identity for itself. First-party session authority and external client authority remain distinct.

An assistant LLM proposes validated actions through a surface-specific tool set. In Create, it starts with read/recommend/propose-draft capabilities; Studio additionally has qualified timeline and project tools. Media submission stays outside the assistant's authority. This is not a new independent pricing or execution backend.

Current foundations include `frontend/src/server/agent-api`, the Studio conversation owners, canonical `packages/pricing`, and the native workspace generation runner. The native Create request path and agent quote path are not assumed interchangeable; audit their normalization, iteration pricing, stale-price checks and recovery contracts before unifying a boundary.

## Create interaction

1. Client clicks Agent near the prompt. An unauthenticated client signs in or creates an account. Use a same-origin return destination and existing draft persistence; never put prompt text or private asset links in an auth URL.
2. A compact conversation opens with the current draft, selected model and explicitly provided references. Explain any included allowance before first use. The account gate grants neither payment authorization nor unrelated data access.
3. Agent proposes a prompt/settings change. Present a readable preview and **Apply** / **Keep current** controls. Preserve the original and undo. If the client edited the field while the agent worked, require a deliberate merge/apply instead of overwriting the newer draft.
4. Applied changes refresh the visible generation price. Capture a request fingerprint covering prompt, exact model/mode, settings, ordered references and output count. The server remains responsible for validation.
5. **Generate** confirms that reviewed media request at the displayed valid price. A stale quote, changed price or changed request refreshes the review before a new click; double clicks and interrupted acknowledgements recover one submission.
6. Account-bound history preserves accepted changes, relevant conversation and output links. A new account or project cannot inherit another account's private drafts or grants.

The media confirmation cannot retroactively authorize chat charges incurred while discussing the prompt. If an included Agent allowance ends, continuing with paid assistance requires an explicitly enabled budget before the next paid conversation request. Keep that authorization separate from media confirmation.

## Proposed assistant choices

| Experience | Initial candidate | Scope and commercial treatment |
| --- | --- | --- |
| Agent · Quick | GPT-6 Luna | Included, bounded prompt clarification/rewrite help; one compact request where possible. Candidate subject to real prompt-quality evaluation. |
| Agent · Creative | GPT-6.1 Sol | More involved direction and iteration; discovery allowance followed by included customer entitlement or explicitly paid assistance budget. |
| Studio Agent | GPT-6.1 Sol | Context, references, tools and editing; same usage accounting as Creative, with different observed per-turn costs. |

Launch with two underlying models if evaluations support them. Do not add a third premium model just to fill a selector. Model names remain discoverable, and a model change must not silently downgrade the client's selected experience. Store model choice centrally with a policy version; do not scatter hardcoded IDs across Create fields. Never market a cheaper tier as artistically equivalent without evidence.

OpenAI describes Luna as suited to efficient repeatable work and Sol to more complex work, and recommends evaluating representative tasks. This supports testing the split, not assuming its quality. [Deployment guidance](https://developers.openai.com/api/docs/guides/deployment-checklist#choose-a-model-for-the-workload).

## Verified provider rates and explicit scenario assumptions

Public standard-tier USD rates per million tokens, fetched on 3 October 2026; input context at most 272K tokens per request. These are provider costs, not proposed customer prices. Account agreements or processing choices may differ. [OpenAI pricing](https://developers.openai.com/api/docs/pricing).

| Model | Ordinary input | Cache read | Cache write | Output |
| --- | ---: | ---: | ---: | ---: |
| GPT-6 Luna | $0.10 | $0.01 | $0.125 | $0.50 |
| GPT-6.1 Sol | $2.00 | $0.10 | $2.50 | $10.00 |

Calculate each API response separately, then aggregate the interaction. Ordinary input = input minus cache reads minus cache writes. Reasoning tokens are part of output usage; do not add them twice. Include image-input tokens, system/tool context and repeated history in observed usage, not just the user's text. Use the actual returned service tier and applicable dated rates. Missing usage stays unknown; cache savings are measured, not presumed. [Cache accounting](https://developers.openai.com/api/docs/guides/prompt-caching).

The current Studio action director permits up to four model requests per client message, with a 2,200-output-token ceiling per request. It does not yet implement a durable account-wide monetary allowance. Existing cost estimation is QA-only in `scripts/qa/studio-sol-cost.ts` and `studio-project-usage-report.ts`; it is not a customer billing ledger.

The following are reproducible planning scenarios, not measured averages or maximums. All non-read input is charged at the cache-write rate for this conservative comparison. Standard/global processing only; exclude media generation, voice, infrastructure, payments, taxes and subsequent review-model costs.

| Scenario | Assumed API work | Provider cost |
| --- | --- | ---: |
| Quick prompt help | Luna; 1 request; 5,000 input + 1,000 output; no cache reuse | $0.001125 |
| Creative prompt help | Sol; same counts | $0.0225 |
| Studio, 10 client messages | Sol; 3 requests/message; each 12,000 input + 1,000 output; no cache reuse | $1.20 |
| Same Studio session with reuse | Same counts; 80% input cache reads, remaining input cache writes | $0.5088 |

Arithmetic: Quick = (5,000 × 0.125 + 1,000 × 0.50) / 1,000,000. Creative = (5,000 × 2.50 + 1,000 × 10) / 1,000,000. Studio without reuse = 30 × (12,000 × 2.50 + 1,000 × 10) / 1,000,000. Reuse case = 30 × (9,600 × 0.10 + 2,400 × 2.50 + 1,000 × 10) / 1,000,000. Real images, longer contexts, output lengths and retries change these figures.

## Business recommendation

Use a **bounded included allowance plus an optional paid assistance budget**. Do not impose a subscription or charge every isolated click merely to introduce Agent. Do not fund unlimited Studio conversation by assuming every curious visitor will later generate.

- Quick assistance has a small acquisition/activation budget. Account creation enables continuity and enforcement; it is not sufficient anti-abuse protection or proof of conversion.
- Studio/Creative discovery should show the real quality baseline for a bounded trial. Limit the subsidized allowance rather than silently substituting a weak model or truncating every useful answer.
- Active paying customers can receive an included allowance calibrated against observed contribution from completed paid usage. Wallet top-ups are not generated revenue or earned margin. Existing media prices and customer wallet balances must not change implicitly.
- Additional assistance can consume an explicitly enabled, visible wallet budget. Keep its ledger separate from media consumption even if both use the same wallet. Show allowance/budget remaining and pause before paid continuation exceeds the authorization. Do not create micro card charges; reuse the wallet funding path if this option is chosen.
- Customer price multiplier, allowance renewal, caps and any expiration are commercial decisions to settle after the beta measurements. No automatic paid continuation or new debit is enabled by this proposal.

Track contribution after assistant cost:

`recognized media revenue − media supplier costs − variable fees/infra/refunds − included assistant API cost`

For paid assistance, separately track recognized assistance revenue minus its API and variable operating costs. Attribute automated quality reviews to a product-improvement budget, not silently to an individual customer's assistant allowance. Prevent double-counting refunds, subsidies and costs shared between these lines.

Illustrative acquisition stress test: a **$0.50 actual average** subsidized API cost per new account means $500 for 1,000 accounts. At 5% conversion, that is **$10 of assistant acquisition cost per converted account**, before marketing or support. At 10%, it is $5. A cap of $0.50 is not an observed average, and this figure is not an approved allowance. The cheap Quick scenario alone would cost $11.25 for ten uses by each of 1,000 accounts, while richer Studio use can dominate the budget.

Use observed p50/p95 and total cohort cost per task, account and paying cohort, including non-buyers and unresolved calls. Compare projected payback with contribution over a stated horizon. Do not label supplier markup as margin on revenue: for example, a purely illustrative 30% markup yields about 23.1% gross margin before other costs, not 30%.

## Engineering work that can proceed without setting a selling price

1. Add versioned usage/cost facts to the [interaction learning strategy](2026-10-03-studio-mcp-learning-strategy.md): model, service tier, token buckets, actual response identity, rate version, source surface and sponsored/paid category. Unknown rates do not become zero-cost events.
2. Implement a server-side allowance boundary and idempotent reservation/settlement contract before broad free access. Reserve a conservative request budget before dispatch, settle actual usage once, release unused reservation, and reconcile ambiguous timeouts. Analytics counters alone cannot enforce spending limits. Concurrency and retries must share an account-level budget.
3. In the deferred Create workstream, preserve current generation confirmation semantics and create a draft-only Agent entry after the authenticated return/continuity path is qualified. Reuse catalog/pricing tools through the shared service layer and align reference selection and visual controls with Studio. Keep this out of the current Studio cost/audit batch.
4. Measure the proposed model pair on realistic English/French prompts, references and instruction-following. Cache stable instructions/tool prefixes; avoid resending irrelevant media. Reduce unnecessary work without silently weakening the selected creative tier.
5. Compare a small set of explicit allowance and paid-price hypotheses with measured cohort economics, then activate the selected policy through the normal pricing review. Adding observability must not accidentally enable charging.

Security, ownership, retention and review-export rules remain those in the learning strategy. Any paid assistant formula belongs in the canonical commercial owner with its own product/unit definition, not in the QA cost helper or browser. The provider-cost ledger and customer-charge ledger must remain independently inspectable.

## What remains open

The desired Agent entry, account requirement, continuity and media Generate confirmation are clear. The exact included allowance, paid assistance rate, budget renewal and supported model-quality thresholds are still proposals. No new API call, customer-data export, wallet debit, model substitution or production deployment was performed to prepare this document.
