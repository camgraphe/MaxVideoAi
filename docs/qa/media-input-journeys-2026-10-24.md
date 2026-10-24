# Import and reuse review — 24 October 2026

This is a local follow-up to deployed PR509, based on main `638c4ac6e248905a661aebefd656c89a033ec74d`. It does not record a new production deployment.

## Reproduced user journeys

1. The user's existing Chrome tab still loads PR508 assets (`dpl_GaERM95rfcVUHyiyHtLWhkefRdvi`), without the H3 operation selector. The current API rejects its missing operation. A separately opened current page has explicit Recast/Relight and the 2,000-character Recast limit. The original tab's prompt and attachments were preserved.
2. The selected four-second source opens a range dialog for H3 Recast, whose minimum is five seconds. No range can satisfy it. The current copy says to choose a range without explaining that a longer source is required.
3. The earlier source, selected from the library on the current deployed frontend, fails with “This video reference has no trusted dimension metadata.” Server inspection already measures its bytes; the admission path discards the measured width/height before validating stored metadata.

## Required regression coverage

- Exact model/mode/operation/slot, with short, legal, long and unknown-duration media.
- Library and recent media, new upload and reused original, audio and video reference roles.
- Operation-specific H3 Recast/Relight, Kling Reference/Edit, Luma, Wan/Prime, Seedance variants and Draft, FLUX Draft/FAST/Enhance and owned-provider continuation rules.
- Authoritative source facts, private access, cancellation, replacement and account isolation remain enforced.
- Click a supported reference label at the prompt cursor; remove an earlier referenced asset without silently retargeting another image.
- Desktop and narrow mobile layouts; no eager fetching of video originals for thumbnail cards.

## Capabilities still intentionally pending

| Capability | Reason / next evidence |
| --- | --- |
| H3 Max Extend | Supplier endpoint exists; exact context/window billing remains to be measured. One qualification trial is prepared but explicitly deferred by Adrien. No new mode or tariff activation in this change. |
| H3 Max Insert / Reframe | Still deferred under the earlier pricing decision. Extend qualification alone will not prove their different cost domains. |
| H3 Max Director / Reference Director | Public references did not establish a usable provider API contract in the captured audit. Reconfirm before implementation. |
| H3 Max fractional creation durations | Broader supplier duration domain needs canonical quote support; current supported integer creation durations remain. |
| Gemini Omni Retake through MCP / Studio | Requires owned private provider interaction recovery. Existing site flow is separate. |
| Enhance from a FLUX Draft Extend cache | Exact cache/artifact/segment mapping remains unqualified. Regular Draft and its supported Extend/Enhance flows remain distinct. |

Base H3/Hailuo do not inherit H3 Max editing operations. Likewise LTX2.5 does not inherit LTX2.3 editing endpoints; Kling native creation and Omni Edit are distinct; Happy Horse1.1 does not inherit1.0 Edit; Grok1.5 does not inherit the older base Edit/Extend endpoint. These are version distinctions, not admin restrictions.

## Deferred H3 Max Extend qualification

**Status: prepared, not submitted.** The user chose “Préparer l’essai pour plus tard.” Existing credential can generate but billing reads returned403, so it cannot prove exact supplier cost. Do not dispatch until ordinary authorized billing access is available and the user resumes the trial.

- Endpoint: `minimax/h3-max/extend-video`.
- Official demonstration source: `https://storage.googleapis.com/falserverless/example_inputs/flux-3-red-panda.mp4`.
- Requested new duration:5s; resolution:768P; framing:auto; output:extended; no reference audio; safety enabled.
- Prompt: “The red panda keeps walking along the log, then looks up at a bird.”
- Published base observed during preparation:$0.40; context supplements and billable output-window interpretation are not included in that figure.
- Save the exact request ID and before/after billing events. Match the event by request ID, record quantity/unit/subtotal/discount/total, and measure original/output durations independently.
- One measurement qualifies only that input configuration. It does not establish prices for Insert, Reframe, longer source/context, audio or other resolutions. Review literal client tariffs and margin before exposure.

Primary contract: [fal H3 Max Extend](https://fal.ai/models/minimax/h3-max/extend-video). Billing evidence: [fal billing events](https://fal.ai/docs/platform-apis/v1/models/billing-events).

## Implemented local changes

- One known-facts eligibility projection for full/recent libraries and the owned import path, including exact field constraints and existing strict provider validators. Default usable filter retains long preparable sources and unknown facts; all-media view explains exclusions. A fully filtered page does not claim the account has no media.
- Account, model/mode and target-slot changes retire delayed local probes. Normalizable raw images retain existing compression; slot byte checks use prepared image bytes. Audio imports use their owned audio path.
- H3 Recast sources shorter than five seconds show a replacement instruction, without opening an impossible passage dialog. Longer originals remain recoverable after a short selection. Section/passage/fragmento copy replaces Excerpt in the user-facing shared control.
- Existing H3/FLUX/LTX owned byte inspection supplies measured dimensions to the later constraint check. A reused source with missing stored dimensions reaches the quote using measured duration; caller-supplied dimensions do not override it. No tariff or supplier-cost change.
- Selected reference cards show separate thumbnails and original identities, readable sequence/role names, and removal. Only supported tokens insert at the prompt cursor. Removal/reordering, Kling aliases and retained single/multi-prompt text cannot silently retarget a used reference without review.
- H3 labels explain character replacement and lighting adjustment. A stale form missing the required operation gets an explicit recovery message, without guessing an operation or requesting a quote.

## Verification evidence and limits

- Parent integrated regression batch: 251/251 tests across actual upload hooks/transport, library picker, all-model slot policy, source media admission/preflight, passage policy, DOM and workspace model/control contracts.
- Parent Chromium/helper batch: 11/11 tests covering 320/390/1440 layouts, source File/blob playback, denied-CORS fallback, decoded filmstrips, keyboard/pointer controls, Apply/Cancel/Escape focus, owner replacement, mention aliases and preserved inactive prompt forms.
- Eligibility catalog enumeration: 253 model/mode/slot combinations over 44 models and eight operations. This checks authored known-facts rules, not paid-provider output quality or universal codec support.
- Full TypeScript passed; frontend ESLint passed with six pre-existing warnings in unchanged files; public-exposure and whitespace checks passed. Final specialized Kling-element, import, picker and server-constraint rerun: 85/85 tests passed. The focused suites overlap; do not sum their counts as unique tests.
- Manual Chrome review uses actual Composer, library and passage components with local files, at desktop and 390-pixel iframe width. Click-to-insert, video playback, 1–6-second selection, apply/focus return, too-short guidance and library availability were exercised. The local demo simulates prepared-asset results, does not call a quote API, upload media or generate. It does not replace an authenticated hosted preview test before delivery.
- Demo: http://127.0.0.1:3288/ . Screenshots and reproducible private fixture server are in `/Users/adrienmillot/.codex/tmp/h3-reference-followup-2026-10-24/review/` (`desktop-references.jpg`, `mobile-references.jpg`, `desktop-passage.jpg`, `mobile-passage.jpg`).
- No commit, push, PR, deployment, paid generation, tariff activation or production media modification in this local review. A marketing capability pass remains a subsequent release task.

## Final independent review

The specialized Kling element path now uses the existing 300-pixel minimum for
known images at selection and prepared-file upload, and routes library imports
through the account-owned uploader. Missing dimensions/timing remain unverified.
Changing model/mode or replacing a slot retires its import; pending placeholders
are cleaned by initiating asset ID without deleting a replacement. A separate
review reproduced and then verified this cancellation regression. The independent
final review reported no remaining actionable findings after 57 focused tests and
a pending-network cancellation probe. These checks overlap parent suites.

## Delivery follow-up

Adrien authorized delivery after reviewing the local journey. The release uses a
new PR from `codex/media-input-journeys`, based on the current deployed main.
Required Quality CI, authenticated hosted checks and both-domain Git provenance
remain release gates. No new model operation, tariff, migration or paid-provider
trial is part of this follow-up. Final immutable evidence belongs in the PR.

Hosted qualification of the first candidate found one additional shared wiring
regression: `WorkspaceComposerSurface` omitted the inferred mode capabilities
when rendering `Composer`. Explicit Modify worked, but a successful20s Wan Create
audio import had no section control. The surface now passes its canonical
capability projection; an ownership contract locks that connection.85focused
composer, source-workflow, model-matrix and real-hook tests and TypeScript pass.
The exact new candidate must repeat hosted audio qualification before release.

The first hosted candidate also reproduced the missing-dimension H3 source from
the user's library: its measured6s source now quotes234cents, enables generation
at1440/390px and prepares a5s private section without a provider render. The
preview's DATABASE_URL is explicitly scoped to its separate Neon branch; the
bounded audio QA import exists there and is absent from production.
