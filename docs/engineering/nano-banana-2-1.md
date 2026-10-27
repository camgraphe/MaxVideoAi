# Nano Banana 2.1 — approved fixed image prices (2026-10-27)

The distinct identity is `nano-banana-2-1`, provider model `gemini-nano-banana-2.1`, through the existing Google **Vertex AI** account. Only this model uses `global`; Nano2 and other Google models retain their own identity, payload and location policy.

## Commercial decision and canonical prices

Adrien approved **USD 0.07 in 1K, 0.11 in 2K and 0.23 in 4K**, per requested image. These are twice the undiscounted Standard/global output-image component, rounded upward to a wallet cent. Google separately bills input text/images and output text/thinking; the business absorbs those variable costs. This is not twice the actual complete supplier invoice, a guaranteed margin or a verified supplier-cost ceiling. Supporting usage remains measured independently and cannot create a later customer surcharge.

The existing `config/customer-tariffs.json` canonical versioned source contains six absolute fixed cells: t2i/i2i × three sizes. There is no quote-time supplier multiplier or alternate billing path. The active DB-backed tariff reader remains required and refuses unavailable/inactive state; ordinary admin database overrides retain precedence and immutable history. The code release itself changes no production DB row, wallet, price receipt or historical job. Exact missing cells never fall through to another model or legacy policy.

Only mode and output size are priced dimensions. Ratio, reasoning, reference count, supported search choices, system instruction and native output cap remain bound to the canonical request hash and saved settings, without multiplying tariff classes or adding surcharges. All three reasoning levels, fourteen ratios and up to fourteen ordered references are retained. One selected image per native request is the existing factual transport contract. Normal account, ownership, input-format and native token limits remain.

The former `pending-review` economic admission is superseded by the explicit fixed-price decision. Its historical inability to prove a total provider bound must not be relabeled a proved bound; it simply does not block this commercially approved offer. Raw supplier image/reference components remain labeled incomplete, and usage/invoice unknowns never become zero.

## Native transport and recovery

The proven `generationConfig.imageConfig` transport is retained, with TEXT+IMAGE, MINIMAL/MEDIUM/HIGH, default MEDIUM and native max output 32768. The exact chosen thinking value reaches the submitted payload without overriding Nano2's earlier correction. Supported system and search fields pass through the canonical MCP schema and native builder. Unsupported provider controls are refused, not silently translated.

Nano21 submits at most one native POST. Network/protocol ambiguity or a received image followed by persistence failure retains the original paid job for recovery instead of a second generation. Definite safety/empty outcomes use the existing original-amount refund. Response usage separates input, text, images and thoughts; counts of inline parts do not establish billed quantity. Current tariffs never rewrite accepted pricing snapshots.

## Model page and media

The registry publishes the image identity, app/pricing surfaces and targeted indexable model route/sitemap in EN/FR/ES. The template supplies three current-quote scenarios and no fabricated score, comparison or media. Existing Nano21 NINE trial images have a separate exact media packet; final public image bindings and browser acceptance are required before this candidate is shipped. A local flag does not prove Google indexing or account execution.

## Validation boundaries

Offline tests cover native payload/global routing, explicit unknown-model rejection, canonical pricing across 504 size/ratio/reasoning/reference scenarios, unpriced option equivalence and MCP request fidelity. PostgreSQL tests cover versioned launch prices, admin precedence, historical receipts, original refunds and single-POST recovery. No paid Google call is made by these tests. Required release CI, current-main reconciliation, both-domain alignment and live read-only price checks remain separate gates.

Sources: [model](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/nano-banana-2-1), [Standard pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing). Checked 2026-10-27; output-image allocations are 1120/1680/3780 tokens at USD30/million, with other modalities billed separately.
