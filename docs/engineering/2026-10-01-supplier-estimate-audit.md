# Supplier estimate audit — October 1, 2026

Scope: the private Unix-socket local pricing sandbox on
`codex/bytedance-pricing-grid`. No production price capture or write is covered.
The audit uses a repeatable-read, read-only transaction and unchanged before/after
tariff fingerprints. Customer revision 328 is active locally with 14,982 cells.

## All-model check

| Check | Result |
| --- | ---: |
| App-published models / families | 48 / 15 |
| Supported normal and separate Draft/final scenarios | 20,437 |
| Current canonical manual quotes | 20,437 |
| Quote errors / legacy percentage fallbacks | 0 / 0 |
| Published supplier LIST scenarios | 3,618 |
| Repository catalogue estimates matching the selected route | 13,516 |
| Catalogue reference for a different provider | 117 |
| Video-input scenarios without supplied input duration | 3,186 |
| Below estimated cost among 17,134 comparable scenarios | 0 |

Catalogue references are dated authored facts, **not a new verification of every
provider's October 1 price**. The 117 other-route references all concern Happy
Horse 1.1; no factual supplier margin is asserted for them. The 3,186 unresolved
rows concern Seedance reference/edit/extension modes. The retail price is known,
but supplier cost and margin cannot be determined without source-video duration.

## Corrections verified against primary evidence

BytePlus's [pricing documentation](https://docs.byteplus.com/en/docs/ModelArk/1544106)
includes input plus output duration and video-input minimum consumption. The
former estimate omitted both source duration and the minimum. The shared server
owner now includes both for admin, normal manual supplier facts and poll fallback;
provider-reported usage takes precedence. All 531 published 2.0/2.5 minimum-table
rows and their ratios match the estimator. The fixture retains primary source
links and captured values. Source durations come from server-resolved records,
including fractional values, never client claims. Missing facts show an explicit
unavailable reason in the admin.

The preceding correction also replaced historical short-side assumptions with
the actual 1.5/2.0/2.5 supplier rasters. Neither correction changes authored
customer cents or historical receipts. Mini trial funding uses the corrected
480p dimensions; known historical accepted quotes retain their original funding.

## Video-input price stress check

Each of the 3,186 affected priced variants was checked with a 2-second input and
the supported maximum source duration (15 seconds for 2.0, 30 seconds for 2.5).
These are hypothetical priced scenarios, not newly submitted provider tasks.

| Model | Variants checked per duration | Below cost with 2s input | Below cost with maximum input |
| --- | ---: | ---: | ---: |
| Seedance 2.0 | 864 | 0 | 186 |
| Seedance 2.0 Fast | 432 | 0 | 0 |
| Seedance 2.0 Mini | 432 | 0 | 0 |
| Seedance 2.5 | 1,458 | 273 | 1,137 |

Across 6,372 checks, 1,596 totals were below the factual LIST/signed-contract
estimate. The canonical quote guard rejected all 1,596. This establishes a
pricing/release issue, not realized losses or a certificate covering every
possible input duration.

Example: Seedance 2.5 reference-to-video, 4-second square 480p output and a
2-second source, has a stored **$0.35** retail price against **$0.43008** estimated
supplier cost. A cent-rounded break-even floor would be **$0.44**, with no margin
allowance. Seedance 2.0, 4-second 16:9 480p output with a 15-second source, is
**$0.68** retail against **$0.820595** cost; its corresponding floor is **$0.83**.
These proposed floors have not been applied.

Release work: author an explicit input-video tariff/supplement per model and
variant, expose its real source duration in the admin, preserve separate LIST and
contract evidence, and verify the complete continuous input domain. A single fixed
price raised for maximum input would also overprice short references. Do not
restore a global percentage rule or introduce a silent supplier-driven customer
price change. Until reconciled, these modes are not certified for release under
the active manual cutover. The existing generation cost guard remains in force.

## Audio, Tools and Storyboard

The same read-only sandbox check projects all 38 current admin product scenarios
through their real quote owners. There are no missing customer or supplier
reference totals, inventory warnings, or negative estimated differences.
Supplier evidence is still catalogue/budget evidence: finishing budgets include
block rounding and minimums; they are not confirmed supplier invoices. Actual
dimensions, durations, frame rates and reference sizes can change the scenario.

## Evidence and limits

Private full rows, all selectors, stress totals, rejected-quote reasons and product
details: `.superpowers/sdd/2026-09-29-all-model-manual-customer-tariffs/current-supplier-audit-20261001.json`.
The companion script checks the actual Unix-only database and read-only session;
it cannot use a remote production connection or provider credentials.

Primary spot checks also read Fal's [GPT Image 2.5 edit
endpoint](https://fal.ai/models/openai/gpt-image-2.5/flare/edit), its [measured
pricing explanation](https://fal.ai/gpt-image-2.5), and Alibaba's [pricing
page](https://help.aliyun.com/en/model-studio/model-pricing). GPT's token-based
actual charge varies with input size and prompt; a fixed catalogue matrix is an
estimate. These checks do not turn every catalogue entry into confirmed account
pricing. Contract console activation and observed invoices remain release gates.
