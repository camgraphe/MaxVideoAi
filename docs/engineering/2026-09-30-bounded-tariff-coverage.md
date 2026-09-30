# Bounded tariff coverage — 2026-09-30

This continuation expands the incomplete sellable matrix on `codex/bytedance-pricing-grid`. It neither activates manual tariffs nor changes the current commercial formula. All database reads used the private local PostgreSQL socket with external runtime credentials blank. No production query, write, provider request, push or deployment was performed in this continuation.

## Supported additions

- Image output counts follow each applicable `num_images` schema, including four GPT outputs, eight Nano Banana outputs and fifteen Seedream Lite outputs.
- GPT Image 2.5 edit sources, Luma Uni additional edit references, and the priced image-only H3 slice use their existing factual owners and schema bounds. Mixed H3 references remain unresolved.
- Gemini Omni, Happy Horse 1.0/1.1, Veo 3.1/Fast and Grok image-only reference modes now enumerate bounded image counts. Seedance, Wan and Kling mixed or optional-primary reference semantics remain gaps.
- Legacy Ray 2 loop choices are represented only where generation forwards them into pricing.
- Selectors and quantities come from `buildManualTariffScenario`, including both video reference/input image counts and fixed GPT pixel dimensions. Tests construct independent generation-shaped contexts; rebuilding only the collector's context would miss these mismatches.
- Admin and public quotes consume this matrix. References narrow their derived input count; the editor hides the duplicate video control. Image output controls and public quote labels use images instead of seconds. Public defaults retain zero Luma additional references, one GPT edit reference and no loop.

## Read-only quote evidence

The corrected local capture ran at `2026-09-30T11:17:15.810Z` in `REPEATABLE READ READ ONLY`.

| Evidence | Result |
| --- | ---: |
| App-published models / families | 48 / 15 |
| Current sampled local quotes | 118,007 / 118,007 |
| Quote failures | 0 |
| Historical baseline scenarios reconciled | 66,549 / 66,549 |
| Unchanged selector identities / normalized identities | 65,169 / 1,380 |
| Missing historical scenarios / changed customer cents or currency | 0 / 0 |
| Current private database rules | 3 |
| Global manual state / revision | inactive / 3 |

Identity normalization adds the priced default reference count, video input count and fixed GPT size that charging already supplies. It does not substitute a neighboring configuration. All historical and current model rows use the effective `default` rule; the original four-rule snapshot included a rule outside these model rows. This comparison establishes parity with the reviewed 2026-09-29 capture, not a fresh production-state guarantee.

Ignored raw evidence lives under `.superpowers/sdd/2026-09-29-all-model-manual-customer-tariffs/`: `effective-local-bounded-v2-2026-09-30.json` and `bounded-parity-v2-2026-09-30.json`. The original `effective-baseline-v3.json` and staged 66,549-cell database seed were preserved. The old seed must fail current complete-matrix validation rather than silently seed the expanded matrix.

## Remaining coverage gates

Six image-reference boundaries close and three newly identified Ray 3.2 HDR/EXR projection gates are recorded: the count changes from 122 to **119**, not to complete coverage.

| Unresolved boundary | Count |
| --- | ---: |
| Automatic aspect ratio from trusted metadata | 59 |
| Automatic/open output duration | 29 |
| Mixed reference count and metadata | 12 |
| Automatic/custom image resolution | 6 |
| Fractional input-video duration | 4 |
| Open input-video duration | 3 |
| Ray 3.2 HDR/EXR generation projection | 3 |
| Open input-audio duration | 2 |
| Unbounded reference token budget | 1 |

Continuous unit terms, verified metadata projections, a complete reviewed current seed, actual supplier settlement evidence, legacy unbound PaymentIntent reconciliation and the atomic activation certificate remain release gates. Task 1 and the overall plan remain partial. Whole-grid construction is also a future admin latency improvement; no performance acceptance is claimed here.

## Acceptance

Independent code review identified missing video input counts and fixed GPT pixel sizes; both were reproduced as failing charging-context tests and corrected. The focused pricing/admin/public/PostgreSQL group passes 102 tests. TypeScript, app lint, exposure and owner lint pass. The frozen billing/public baselines and pricing audit remain unchanged.

Authenticated HTTP reads verify the admin page, model tariff inventory and policy inventory return 200. There are 48 models in 15 families, no missing representative customer amount, and no representative cent change versus the pre-continuation local inventory. Manual activation remains false at revision 3. After runtime restoration, exact HTTP requests verify identical admin/public cents for GPT Image 2.5 Flare (four outputs, sixteen edit sources), Veo 3.1 (two image references), and Luma Uni (zero additional edit references).

The panel opener initially returned `queued`. A later browser inventory found functioning local admin tabs; tab 7 was inspected directly, showing the populated Pricing page, five categories, supplier/customer unit prices and estimated margins. The integrated browser was made visible and that tab retained as a deliverable. Old browser error tabs were not reloaded or inspected. This verifies the page's visible nonblank state, not every new variant control or a new mobile-layout acceptance.

Complete committed-snapshot validation at `70eb58797`: 6,346 standard tests and 11 isolated Studio tests pass, zero failures, three standard skips. The standard validator covers 1,069 test files. The sanitized local environment was held outside the checkout during validation and restored in `finally`; no external credentials were loaded.
