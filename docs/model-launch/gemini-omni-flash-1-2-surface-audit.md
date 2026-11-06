# Gemini Omni Flash 1.2 — provider, score and marketing audit

Source audit: November 5, 2026. This describes the PR candidate, not a production deployment.

## SEO and route ownership

The canonical model owner remains `/models/gemini-omni-flash`, with the existing
French and Spanish localized paths. Existing Omni/Veo and Omni/Kling comparison
owners remain intact. The two new 1.2 aliases redirect to the current owner; old
aliases remain valid. No separate indexable version page or duplicate launch
article is introduced.

This preserves existing inbound/internal links and comparison discovery while
updating current titles, descriptions and calls to action. Historical 1.1 prompts
and examples still answer version-specific searches. Search Console evidence
favored the existing comparison owners; exact account metrics remain private.
This does not prove an existing cannibalization problem or guarantee a ranking
increase. After deployment and recrawl, compare complete equivalent windows for
Google/Omni query cohorts, landing pages, clicks, impressions, CTR and position.

## Provider coverage

Sources: [Vertex 1.2 model card](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-2-flash)
and [launch announcement](https://cloud.google.com/blog/products/ai-machine-learning/gemini-omni-1-2-flash-generally-available).
The model card was fetched directly with HTTP 200 during this audit when the web
reader could not open it. See the launch note for the real account probe.

| Capability | Candidate implementation | Boundary |
| --- | --- | --- |
| Routing | `gemini-omni-1.2-flash`, global Vertex Interactions | Direct route; no Fal fallback or GenerateContent call |
| Text / image generation | `t2v`, `i2v` | One starting image for i2v |
| Reference generation | `ref2v`, up to 10 images | No arbitrary video/audio reference input is exposed |
| First / last frame | `fl2v`, two ordered images | Private ownership validation retained |
| Video editing | `v2v`, one source clip | Output timing follows the owned source; 3–10s product domain |
| Extension | `extend`, one source clip | Source capped at 10s here; Google documents longer inputs using their tail |
| Conversational refinement | `retake`, stored private interaction | Authenticated workspace; intentionally absent from public MCP |
| Resolutions / aspect ratios | 360p, 720p, 1080p, 4K; 16:9 and 9:16 | Only 3s/360p/16:9 t2v was exercised live in the access probe |
| Durations | Current sellable 3–10s | Google generation/edit supports 15s; 11–15s tariff coverage is deferred. First/last frames and extension addition remain 3–10s on the model card |
| Sound / camera / edit direction | Prompt instructions | Native sound is not a binary audio on/off provider parameter |
| Images | JPEG, PNG, WebP, HEIC, HEIF; 30MB GCS path | Inputs are staged to GCS; the model card's inline/console limit is a separate 20MB boundary |
| Standalone upscale | Not exposed by this candidate | 4K generation output does not mean a separate upscale tool has been added |
| Multiple source videos | One source clip in edit/extend | The model card's general limit of 3 videos per prompt is not a three-clip UI workflow |
| Audio files as references | Not exposed | Not a standard capability on the Vertex model card; no account entitlement is assumed |
| Sampling / advanced API controls | Provider defaults | Temperature/topP, token APIs and throughput provisioning are not new product controls. No seed, negative prompt or configurable FPS is promised |

The advertised product modes are implemented, but this is not complete exposure of
every provider feature. Unit/integration checks establish request construction,
ownership, validation and polling; they do not certify every mode/resolution on
the live account. The existing 12,000-character prompt limit and other product
upload constraints are retained independently of Google's maximum token capacity.

### Audio audit correction

The workspace already requires a real input-schema audio switch before displaying
an on/off control. The marketing budget card and API discovery were less precise:
they could respectively call Omni silent and advertise optional audio despite the
provider payload only supporting prompt sound direction.

A shared, mode-scoped helper now recognizes the authored native sound-direction
contract only when there is no actual boolean audio control. The budget card says
audio is enabled, API discovery says `always_generated` and omits an editable
binary audio setting, and an explicit `audio: false` is rejected before submission
instead of being silently ignored. Omitted audio and the existing `audio: true`
request remain accepted. This audio correction leaves provider prompts, tariff identity and other engines' real audio switches unchanged; the separate retail decision is described below. Three regression failures were observed before this fix;
94 focused API/MCP checks passed afterwards.

## Scores and evidence

The old editorial row is the September 3, 2026 **1.1** review. The published overall
formula averages fidelity (8.8), motion (8.2) and consistency (7.9), rounded to one
decimal: **8.3/10**. It is not the average of all eleven dimensions.

| Existing 1.1 dimension | Preserved score |
| --- | ---: |
| Fidelity | 8.8 |
| Visual quality | 8.5 |
| Motion | 8.2 |
| Consistency | 7.9 |
| Anatomy | 8.1 |
| Text rendering | 7.6 |
| Lip sync | 8.9 |
| Sequencing | 8.0 |
| Controllability | 9.2 |
| Speed / stability | 6.8 |
| Pricing | 8.1 |

The exact row is archived under `historicalScores` with `modelVersion: "1.1"`.
**1.2 has no new editorial score.** Current app, comparison, engine-hub and
benchmark readers do not inherit the 1.1 score. A single access probe and a lower
supplier rate do not establish improved image quality, speed or reliability.
The old pricing score is also historical; it is not automatically raised because
output-video pricing dropped from $17.50 to $12 per million tokens (31.4%).

A new rating needs the existing benchmark prompt pack, representative modes,
retained outputs/settings, comparable scoring and enough operational observations
for latency/reliability. New 1.2 marketing demonstrations remain separate work.

## Marketing surface inventory

| Surface | Audit result |
| --- | --- |
| EN / FR / ES model pages | Current 1.2 title, metadata, positioning, capabilities, pricing owner, CTA and transition explanation; old demo/prompt evidence stays 1.1 |
| Model catalog / navigation / workspace selector | Registry-derived current 1.2 identity; unchanged canonical engine ID |
| Omni vs Veo 3.1, Veo Fast and Kling Turbo Pro | Current comparison copy and historical evidence notes; retained owners and internal links |
| Other Veo comparison pages | Inbound Omni recommendations/links updated |
| Best-for ads, 4K, reference-to-video | Current 1.2 recommendation names in all three locales |
| Pay-as-you-go landing | Current product names / links updated; real historical example captions retained |
| Google/Veo family examples | Stable Veo gallery intent; 1.1 subtitle/intro remains factual for the available historical renders; onward model/comparison links resolve current 1.2 |
| Public example cards, modal readers, watch pages, API and JSON-LD | Recorded engine labels retained; old clips are not relabeled 1.2 |
| Compact version / prompt links | Preserve the original label and put an older recorded numeric version in the historical group |
| Creative-film demonstrations | The remaining 1.1 label describes the actual existing film, not a current model recommendation |
| Pricing, estimator, schema offers and example quotes | Existing canonical pricing owners retained; 150% saved-price release prepared for all modes, with billing/public parity and no separate marketing price formula |
| App, comparison, hub and benchmark scores | Current 1.2 does not inherit historical 1.1 ratings |
| MCP landing / model discovery | Current registry identity, localized model links, native-audio correction; private retake remains excluded from public MCP |
| Machine discovery / sitemap / aliases | `llms` text, generated rosters/runtime/catalog and relevant timestamps updated; localized 301 aliases and existing canonical/hreflang retained |

A residual-version scan of authored content, frontend and benchmark data found
1.1 mentions only in historical media/example copy, transition explanations and
legacy-cost handling. Historical gallery headings were deliberately not rewritten
as claims that those videos were created with 1.2.

## Verification and release boundaries

The initial committed candidate passed the complete required Quality CI run
[42117386761](https://github.com/camgraphe/MaxVideoAi/actions/runs/42117386761).
Local browser coverage passed 313/313 checks, and database/media integration passed
1,642 checks with three intentional skips. The follow-up audio correction has its
own focused tests; the added retail release must also pass final PR CI before merge.

Nine real localized model/comparison pages, nine one-hop aliases, historical API
labels, mobile layout and the comparison dialog were checked on an isolated local
Next.js server using anonymous public example snapshots. No production database
was connected to that preview. A fresh independent review found no actionable
issue in the initial upgrade and ran 44 focused checks.

No production flags, customer-tariff records, receipts or media bytes were changed.
A read-only production capture confirms 456 active Omni tariff classes; their
150% projection was validated locally across 544 scenarios and 5,999 saved band
amounts. The [retail release report](gemini-omni-flash-1-2-tariffs.md) gives concrete
figures and the explicit activation sequence. Active tariff data was inspected;
Real production invoices, checkout acceptance and deployment were not exercised.
Merge/deployment and domain alignment remain outside this draft PR delivery.
