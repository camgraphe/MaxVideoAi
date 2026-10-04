# Studio + MCP expanded validation — 4 October 2026

This report records the additional preproduction validation requested after the
first release-candidate handoff. It preserves failures as well as corrections.
No production database, customer wallet, media generation, publication or
deployment was used. The user authorized the existing OpenAI key for at most $5
of cumulative text API validation. One journal covers the entire authorization.

## Live conversations and measured cost

The actual Studio director made **83 Responses calls: 61 Sol and 22 Luna**, across
43 synthetic customer turns. Calculated supplier cost was **$0.490465965**; there
are no unresolved holds or unknown usage. Every preflight input-token count
matched the returned input usage: **83/83**. These are observed API usage and
versioned supplier-cost calculations, not a provider invoice or a long-term unit
economics forecast. No paid image/video calls were made.

Seven principal journeys contain four adaptive customer turns each. The simulated
customer saw the visible replies and adapted its next request; it did not inspect
backend state. Scenarios cover a workshop product, a $6 video budget, a precise
Veo shot, Luna planning beyond wrap-up, English-to-French refinement, and exact
Spanish poster lettering. The [visible-dialogue review](studio-human-dialogue-review-2026-10-04.md)
retains the individual assessments; there is no aggregate success score or claim
that these were real customers.

The runner uses real director instructions, schemas and tool sequencing, but
controlled runtime availability, in-process memory and **fixture** image/video
prices of 18/120 cents. Preparation, generation, editing and export are blocked.
Consequently these conversations do not certify canonical price amounts, durable
memory, media execution or real account billing. The
[runner guide](../engineering/studio-live-validation.md) defines the boundaries.
Earlier calls identify their source commit; later calls additionally retain
content-addressed snapshots of the relevant local source files. This evidence
must not be described as one run of an unchanged clean commit.

## Findings and follow-up

| Finding | Change and observed follow-up |
| --- | --- |
| Budget inquiry exhausted four model responses on reads and optional memory, leaving a generic limit notice. Later replies referred to an estimate the customer had never seen. | Each response now carries the remaining-call budget and asks the director to leave room for a useful answer. Final-response guidance defers optional housekeeping. Two fresh Sol price probes returned the amount and a next step; subsequent explicitly requested preparations reached the deliberately blocked fixture boundary. The original failed journey remains in the evidence. |
| Assistance help could confuse the authorization ceiling with a charge, or use outdated project-menu naming. | Stable help now names Projects, explains included assistance, explicit paid authorization, limited Luna and separate media costs. A fresh $5-authorization question answered without catalog/tool reads. |
| Studio's five-model pilot list hid current published, certified models such as Veo 3.1. | Removed that duplicate list; canonical publication/runtime facts are intersected with existing Studio certification and supported modes. Fresh Sol advice selected Kling Omni Pro and Veo 3.1 for concrete supported differences; Luna correctly described Veo's six-second widescreen options. |
| A new open poster inquiry recommended legacy GPT Image 2 because Studio omitted model lifecycle. | Summary/details now transmit registry lifecycle. The director prefers compatible current image/video models, preserving explicit legacy choices or an explained capability exception. Fresh Sol selected Nano Banana Pro and Luna selected GPT Image 2.5 Flare. Sunburst was correctly reported unavailable in this chat. |
| Expanded mode coverage exposed Wan 2.6's string safety default while shared validation expects a boolean. | Canonical model-details projection converts the historical boolean enum. All 78 exposed model/mode request pipelines pass settings/reference/quote validation with an injected tariff. |
| Sora's runtime retirement was not consistently reflected in public discovery and historical pages; Seedance 1.5 was accidentally active on this branch. | Registry, generation gates, localized archive pages, navigation, comparison controls and saved-draft handling were reconciled. Historical identities/media and billing audit scenarios are preserved; no silent replacement occurs. |

The H04 reviewer could not verify a saved-state claim from text alone. The backend
journal contains a successful fixture `project.remember` receipt for that turn;
it therefore does not establish a fabricated save. The H10 preparation failure
was intentionally injected by the runner and is not a live provider defect.
Luna's assumption that the customer owned a suggested lamp remains a minor
conversational observation, not a resolved deterministic defect.

## Catalog and recommendation evidence

Read-only calls through the connected live MCP returned **38 current models
(29 video, 9 image), without Sora**. Action-specific probes returned Seedance 2.5
and Kling Omni Pro for a cinematic text-to-video request, Wan 3 and Gemini Omni
Flash 1.1 for source-video editing, and Pika for an explicit Pika request. These
are live factual discovery observations, not proof that this branch's new
editorial policy has already been deployed or that a model is artistically best.

The Studio branch exposes **29 current and 10 executable legacy models** when
runtime readiness is available, across 78 certified conversation modes. Nine
current MCP models remain outside existing Studio certification; source-video
editing, extension and other unsupported conversation actions remain excluded.
See the [exact-ID coverage audit](studio-model-coverage-audit-2026-10-04.md).
Compatibility is checked before editorial preference; explicit choices and exact
quote authority are retained. New versions do not inherit a quality judgment
solely from their family name.

## Browser and financial evidence

The later IAB pass used a committed `eb581c5cd` snapshot, synthetic authentication,
disposable PostgreSQL, real project/timeline services and local media fixtures.
It verified direct `/app/studio` entry, two-project selection, image attachment,
`@Image1` mention without submission, explicit timeline insertion (4 to 9 seconds,
revision 1), collapse without losing the reference/draft, and app appearance
switching. At 390 × 844, document width and scroll width were both 390; no page
exceptions or fetch failures remained. The earlier desktop capture preserves
the centered chat and tilted reference arrangement.

The first temporary proxy was lost when its owner process ended; its resulting
fetch failure was retained and then rerun with a root-owned runtime. The later
runtime/database/auth fixture was stopped and removed. This was not real Google
authentication, a production balance, a browser-to-live-LLM journey, or a
physical-device certification. No preview was reopened for the user.

Separately, [financial simulations](studio-financial-simulations-2026-10-04.md)
exercise double-send, reconnect, in-flight model changes, stopping authorization,
exhausted allowance, unfunded wallet and unknown provider usage against real
disposable PostgreSQL. Five human action sequences pass within a 27-test focused
suite. Ten injected calls produce six fixture cents of net charges with no final
unresolved hold; recovery does not duplicate dispatch, edit or refund. These
figures are test receipts, not customer revenue or live API spend.

## Evidence locations and release boundary

Local, uncommitted evidence is under `output/studio-creative-workspace/`:

- `human-validation/journal.json`, `cost-summary.json`, request rounds, source
  snapshots, visible transcripts and live MCP snapshots.
- `human-validation/catalog-live-probes.log` retains the legacy recommendation;
  `lifecycle-live-probes.log` records the fresh corrected probes.
- `human-validation/studio-eb581-mobile-dark.jpg` and the desktop reference
  captures record browser appearance; the runtime cleanup logs preserve lifecycle.
- Financial and published-baseline focused logs identify their separate fixtures.

The first expanded full attempt at `eb581c5cd` failed 11 standard tests (6,069 passed, two
skipped). Failures exposed incomplete Sora public retirement and stale active-model
pricing fixtures. Those were corrected rather than deleting historical billing
coverage or changing commercial arithmetic. The final combined suite/build
results belong in the [candidate handoff](studio-release-candidate-2026-10-04.md).

This work does not qualify a replacement of current main, the intended staging
environment, native MCP host installation, a new package version, provider invoice
reconciliation or production activation. The
[published-baseline report](studio-published-baseline-validation-2026-10-04.md)
and [distribution checklist](studio-mcp-distribution-rollout-2026-10-04.md)
retain those concrete release steps.

A later complete standard pass at `66934ab3c` ran 6,204 tests: 6,199 passed,
three failed, two skipped. Two expectations still treated newly available or
archived models as the old catalog; they were updated while preserving actual
unavailable-model rejection, historical routes and locale indexation. The third
was a midnight-only fixture error: spending dated 00:01 UTC was correctly excluded
before that time. The test now dates the claim at day start and exercises the
first minute through the real spending query. No financial owner changed.

The production browser check also exposed nested main landmarks on archive pages,
now corrected. Apparent localized redirect loops came from the QA runner binding
Next to 127.0.0.1 while NextURL normalized rewrite targets to localhost. The same
immutable build served all nine localized archives with HTTP 200 when bound to
localhost. The runner was corrected; product routing was unchanged. Current
Veo/Wan marketing pages requiring DATABASE_URL remain outside this sanitized
no-database fixture; their 500 responses are not attributed to an archive defect.

Final immutable product/test candidate `48d2796c4` passes the complete standard
and isolated plan: 6,214 passed, zero failures, two explicit skips (6,216 total).
Its full production build generates 895 pages; 17 HTTP checks pass. The final
handoff records the detailed build/browser evidence and remaining environment
limitations. No more live API calls were made after the 83-call cost summary.
