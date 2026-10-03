# Studio assistant — allowances, recharges and unit economics

Date: 3 October 2026. Status: working product proposal. The user has requested shared Agent capabilities and account continuity; commercial allowances and customer prices below are hypotheses, not activated tariffs. Existing media billing remains authoritative.

Scope update: all Create assistant work is explicitly deferred, including the compact helper, its button, model selector and any Prompt/Agent mode switch. The user found the helper unclear and requested concentration on Studio and MCP. Preserve the Create concepts below as exploratory background only; they are not approved launch requirements. Current priority remains Studio interaction auditing and conversational cost/allowance design. Existing Create workflows remain the product baseline.

Earlier Create exploration (now parked): retain the direct workflow by default; an optional helper might return a proposed prompt to the existing form. Neither that helper nor the earlier two-mode idea is part of this release. Keep deeper conversation, project work and editing in Studio. Keep MCP as external access to shared capabilities, not another mode the web customer must understand.

## Studio direction and deferred Create concepts

- **Agent** was an explored entry name; a new Create entry is now deferred.
- Selecting Agent requires an authenticated MaxVideoAI account, including for an included/free allowance. Preserve the draft through login/account creation and return to the originating field.
- Defer assistance in Create video/image and other prompt fields. Revisit these surfaces only after the Studio experience and economics are qualified.
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

## Current Studio baseline and deferred assistant choices

Studio uses Sol as its default assistant, with an explicitly selected, sponsored Luna continuation when the Sol allowance or authorized budget runs out. The Create candidates below remain deferred; no assistant entry or selector is being added there. A user's explicitly selected model must never be silently replaced.

| Experience | Initial candidate | Scope and commercial treatment |
| --- | --- | --- |
| Agent · Quick | GPT-6 Luna | Included, bounded prompt clarification/rewrite help; one compact request where possible. Candidate subject to real prompt-quality evaluation. |
| Agent · Creative | GPT-6.1 Sol | More involved direction and iteration; discovery allowance followed by included customer entitlement or explicitly paid assistance budget. |
| Studio Agent | GPT-6.1 Sol | Context, references, tools and editing; same usage accounting as Creative, with different observed per-turn costs. |
| Studio continuation | GPT-6 Luna | Optional assistance at no extra chat cost within a disclosed sponsored allowance; ongoing work, not a wrap-up-only mode. Media generation remains separately priced. Subject to Studio quality and tool-use qualification. |

Keep Sol as Studio's default experience. Offer Luna as a continuation choice at allowance exhaustion, without adding a prominent model selector to the initial experience. The Create Quick/Creative split remains a future candidate requiring evaluation. Model names remain discoverable, and a model change must not silently downgrade the client's selected experience. Store model choice centrally with a policy version; do not scatter hardcoded IDs across Create fields. Never market a cheaper tier as artistically equivalent without evidence.

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

### Studio allowance and manual recharge proposal

The user's latest direction is a limited Sol allowance per customer followed by a choice between recharge and sponsored Luna continuation. Luna can continue ordinary creative work and is not restricted to finishing the current conversation. This establishes the commercial mechanism to explore, not approval of a numerical allowance, retail tariff or debit implementation.

- Start with a one-time discovery allowance per eligible authenticated account. Bound both its supplier cost and the total acquisition campaign budget; account creation alone cannot prevent repeated trial abuse. Do not launch an automatically renewing free allowance before cohort economics justify it.
- Meter actual token categories, model requests and other billable assistant work internally. A raw token count or fixed number of messages is not a reliable monetary ceiling: context, images, cache reuse, output and tool loops change the cost. A per-message API ceiling is an additional guardrail, not the customer-facing sales unit.
- Show an understandable included-usage indicator and the customer's authorized Studio spending balance/cap. Use the existing wallet funding path for manual recharges. Avoid introducing a second cash wallet: identify Studio charges separately and require explicit authorization before consuming a wallet previously funded for media. Promotional Studio entitlement is separately tracked and does not change the customer's cash balance.
- Warn before exhaustion. Once the Sol allowance or authorized budget is spent, offer an explicit choice between recharge and Luna at no extra assistance cost within its disclosed sponsored allowance. Pause new paid assistant requests until the customer enables a visible Studio budget. Funding the wallet and authorizing its use for Studio are distinct steps. A rejected recharge preserves the project, conversation and existing editing access. Automatic recharge is off at launch.
- Give paid Studio use its own published, versioned customer tariff with enough contribution to cover provider usage and variable operating costs. Tokens can remain available in detailed usage; the main experience should make remaining money and consumption understandable. Do not promise a fixed number of messages for a recharge. Supplier rate changes inform future reviewed tariffs and do not reprice settled usage.
- Before every provider dispatch, reserve a conservative amount within both the account's supplier-cost allowance and, for paid use, its authorized customer budget. Bound the input and output behind that reservation; settle once, release unused amounts and reconcile unknown outcomes. Concurrent sessions share the same cap. A global operational ceiling limits aggregate subsidized exposure. No ledger implementation is implied by this document.

Illustrative retail arithmetic, **not a selected price**: if assistant work costs $0.05 at the provider and the published customer tariff charges $0.15 for that work, $0.10 remains before payment fees, infrastructure, support, subsidies and other costs. This is not $0.10 of net profit. Likewise, a one-time $0.50 provider-cost discovery cap gives at most $500 of trial API exposure across 1,000 eligible accounts, provided reservations enforce that cap; it is not an observed $500 spend. The actual cap must be large enough to demonstrate a useful creative task and small enough for the acquisition budget.

Cursor documents a comparable included-usage then optional paid-usage mechanism with spending controls. This supports the intelligibility of the pattern, not our prices, margins or conversion assumptions. [Cursor usage-based charges](https://prod.cursor.com/help/account-and-billing/overages), checked 3 October 2026.

### Luna continuation and contextual reminders

The user explicitly rejected a wrap-up-only restriction. Luna is a continuing assistant, not a final-message grace mode. Keep the same project and available references; qualify the handoff of relevant conversation context before release. Luna may propose prompts, discuss creative ideas and use the Studio tools for which it passes evaluation. Existing generation authorization, ownership, quote and payment checks apply identically.

At Sol allowance or budget exhaustion, proposed English copy:

> **Keep creating**
>
> Top up to continue with Sol, or continue with Luna at no extra cost.
>
> Included Luna assistance has usage limits. Image and video generation are charged separately.
>
> **Top up for Sol** · **Continue with Luna**

After the customer's choice, show a discreet persistent **Luna · Included assistance** label. For each new relevant creative-planning action or generation preparation/review, show a short inline reminder beside the action rather than an interrupting modal:

> You're using Luna. For more in-depth creative guidance, top up to use Sol.
>
> **Top up for Sol**

Continuing with Luna remains available through the normal action. Attach reminders to observable task/action types such as creative planning, storyboard development and generation preparation, not an attempt to inspect hidden reasoning. A repeated render or polling update must not repeat the notice as a new message. Simple navigation and ordinary chat need only the persistent model label.

Generation review must distinguish the **assistant** (Luna) from the actual **image/video model** and show the normal media price. Switching assistant does not itself switch that generation model, imply that every generated result will be worse, or make generation free. Do not say Luna cannot be creative; the Sol recommendation is positioning to validate with representative Studio evaluations, not a measured artistic-quality guarantee.

Luna's provider usage is a product-funded expense and needs a durable account-level cost cap plus an aggregate subsidy budget. New conversations do not reset the account allowance. The allowance size and renewal policy remain open; disclose the actual limits before uptake and show an approaching-limit notice. No unlimited-free claim or automatic customer wallet debit is authorized. Recharge does not retroactively authorize earlier calls, and paid Sol continuation still uses the explicitly enabled budget.

- Deferred Quick assistance would need its own small acquisition/activation budget. Account creation enables continuity and enforcement; it is not sufficient anti-abuse protection or proof of conversion.
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

The current scope is Studio and MCP, with all Create assistant entries deferred. Studio's direction is Sol by default, a choice of recharge or Luna continuation when its budget runs out, and contextual model reminders around demanding creative work and generation preparation. The exact Sol and Luna allowances, paid assistance rate, renewal rules and model-quality thresholds remain proposals. No new API call, customer-data export, wallet debit, model substitution or production deployment was performed to prepare this document.
