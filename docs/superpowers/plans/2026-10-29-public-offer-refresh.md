# Public offer refresh

> **For agentic workers:** Use superpowers:executing-plans. Continue in PR #555.

**Goal:** Make Pricing, PAYG and general marketing reflect current model availability and actual price reads, with clear Studio/Milo discovery.

**Architecture:** Keep canonical quote ownership and the existing streamed pricing promises. Runtime-enabled catalog filtering belongs in the server pricing projection; static capability support must not depend on a legacy amount. Keep model history, tariffs and provider submission unchanged. Authored copy stays with its existing EN/FR/ES owners.

**Review focus:** New models without old prices; disabled models with old prices; unsupported audio/resolution; missing current quotes; translated discovery links and historical examples.

## Task 1 — Current pricing coverage

Files: Pricing `currentPricingHubData.ts`, `pricingHubData.ts`, `pricingHubCopy.ts`; `tests/current-pricing-hub-data.test.ts`, `tests/payg-current-video-pricing.test.ts`.

- Add regression tests that current quotes are requested for Kling 4, FLUX 3 Max, MiniMax H3 and Seedance 2.5 without legacy numeric prices; a lower returned price wins only its matching scenario.
- Add injectable configured-engine read to server builders; filter disabled rows before quote requests. Verify a disabled cheap model is absent from rows/highlights and is never quoted. Unknown catalog access fails closed.
- Derive quote input from supported settings independently of static price availability. Preserve unsupported combinations and canonical rejection; never fill missing current amounts from static values.
- Describe rankings as the lowest quoted option for the displayed settings, not a whole-market or quality ranking. Keep amounts and exact scenario visible.
- Run focused pricing, queue, policy and PAYG projection checks; commit.

## Task 2 — Current model and assistance discovery

Files: PAYG `_content/*`, `_lib/payg-discovery-config.ts`, `_lib/payg-page-data.ts`, guide/trust components; shared marketing messages/dictionary owners and Pricing example content as needed.

- Include FLUX 3 Max, MiniMax H3, Kling 4 and Seedance 2.5 in relevant model choices, quote examples and lookups. Keep exact model identity and supported settings; no invented comparative quality or budget claims.
- Remove Pika and archived-model current-use promotion from general homepage/about/catalog/Pricing copy in all locales. Preserve named historical media, comparisons and source identities. Do not change registry lifecycle merely because a runtime switch closes execution.
- Show Milo for prompt help and Studio for planning a project; preserve sign-in, separate assistance/media charges and existing public paths.
- Audit rendered general routes and authored references; document remaining historical mentions and limitations. Run localized content/discovery/metadata tests; commit.

## Task 3 — Qualification

- Run focused pricing/PAYG suites, TypeScript, lint/exposure, registry coherence and build. Inspect desktop/mobile Pricing and PAYG and representative localized pages without submitting paid work.
- Obtain one fresh independent final review, fix material findings with regression coverage, update PR and leave production unchanged.

No paid generations are needed for this correction. Existing $10 media allowance remains unused.
