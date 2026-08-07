# Seedance 2.5 launch packet

This file is the operational handoff for every future Seedance 2.5 deployment.
Read it before changing a flag, publication surface, price, or provider route.

## Current state — hidden execution

- Updated: 2026-08-07
- Canonical MaxVideoAI ID: `seedance-2-5`
- ModelArk model ID: `dreamina-seedance-2-5-260628`
- ModelArk region: `ap-southeast-1`
- ModelArk release status: GA
- Runtime engine and dedicated provider profile: present
- Safe runtime defaults: disabled, administrator-only, text-to-video; generated
  audio is optional when the hidden runtime is explicitly enabled
- Local MaxVideoAI administrator happy-path canary: completed
- Long-form marketing heroes: City and Train copied durably, passed technical
  and sampled-frame QA, and accepted for marketing by product-owner signoff
- Dialogue/audio marketing candidate: generated and copied durably; publication
  held for human review of exact wording, speaker attribution, and lip-sync
- Real timeout/failure/refund canary: still pending
- Public page: the shared localized marketing model-page renderer, published
  `noindex` without generation or pricing actions
- Robots: `noindex, follow`
- Public app discovery, pricing, examples-family publication, comparison, and
  sitemap: disabled
- Dedicated page playlist: public with City then Train; those two media records
  are public/indexable, while `publication.examples.published=false` keeps
  examples-family discovery closed
- Public generation: closed
- Customer-price policy: approved at 2.5× the factual ModelArk cost
- Commercial use for the hidden internal phase: confirmed by the product owner
  on 2026-08-07
- Implementation and handoff: reviewed and committed directly on local `main`
- Push, deployment, production flags, public generation, and indexation: not
  performed by this preparation batch

The raw engine is intentionally present in the generated engine catalog and
model roster so the API can resolve it during a controlled internal canary. It
is absent from `getBaseEngines()` and every public generation surface. The
public route uses the standard shared production marketing-model template with
`noindex, follow`; it must not expose the internal price, provider, model ID,
generation action, or public pricing action.

## Official ModelArk evidence

Official model card, checked 2026-08-07:

https://console.byteplus.com/ark/region:ap-southeast-1/model/detail?name=dreamina-seedance-2-5

Official asynchronous video-generation API flow:

https://docs.byteplus.com/en/docs/modelark/1520757

Facts recorded from the model card:

- canonical model ID `dreamina-seedance-2-5-260628`
- GA in the AP ModelArk region
- output resolutions 480p and 720p
- duration 4–30 seconds
- output frame rate 24 FPS
- concurrency limit 10 and RPM 600
- ModelArk list prices: USD 10.7 per million tokens without video input and
  USD 6.4 per million tokens with video input
- up to 50 combined references: up to 30 images, 10 videos, and 10 audio files
- advertised task families include multimodality-to-video, editing, and
  extension

Only the subset proven by the authenticated canary is executable now:

- text-to-video
- 4–30 seconds
- 480p or 720p
- 16:9
- 24 FPS
- generated audio optional; its payload, accounting, durable video/audio path,
  and infrastructure are proven
- motion controls off
- no image, video, or audio references
- no edit or extension mode

The broader capabilities remain blocked until each has its own payload,
polling, storage, accounting, and refund canary. Do not infer their runtime
contract from the headline limits on the model card.

The two four-second provider and MaxVideoAI happy-path canaries below were
intentionally silent and remain valid evidence for the audio-off path. The
separate 15-second Dialogue render proves optional generated-audio
infrastructure, but that asset remains non-public until human dialogue,
speaker-attribution, and lip-sync review is complete.

## Authenticated provider canary evidence

Executed 2026-08-07 with the configured ModelArk account:

- request: text-to-video, 4 seconds, 480p, 16:9, generated audio off
- lifecycle observed: queued → running → succeeded
- response model: `dreamina-seedance-2-5-260628`
- response: 480p, 4 seconds, 24 FPS
- response usage: 38,830 completion / total tokens
- output video URL: present
- output expiry: 172,800 seconds (48 hours)
- last-frame output: absent
- Provider task ID: deliberately not stored in this repository
- Signed output URL: deliberately not stored in this repository

At the no-video ModelArk rate, the observed provider cost was
`38,830 / 1,000,000 × 10.7 = USD 0.415481`. At the approved 2.5× policy this
corresponds to about USD 1.04. MaxVideoAI preflight estimates the smallest
request at USD 1.03 from its deterministic token dimensions; completion
accounting must prefer the provider's actual usage value when present.

## MaxVideoAI end-to-end administrator canary

Executed locally on 2026-08-07 with only the five dedicated controls enabled:

- request: text-to-video, 4 seconds, 480p, 16:9, generated audio off
- API response: accepted and queued
- final MaxVideoAI status: completed, progress 100
- payment: `paid_wallet`
- customer amount: 103 cents
- receipt result: one charge and zero refunds
- provider usage persisted: 38,830 tokens
- provider cost persisted: USD 0.415481
- provider task relationship: present, identifier not copied into this packet
- durable MaxVideoAI video: present
- durable thumbnail and preview video: present
- active video output in `job_outputs`: present
- range download from the durable video: HTTP 206, `video/mp4`, 1,024 bytes
- signed provider URL and durable storage URL: not copied into this packet
- keyframe URLs observed on the inspected job: zero; thumbnail and preview are
  present, but validate keyframes separately if they become a public UX
  requirement

Access and fail-closed proofs from the same local build:

- an unauthenticated/non-admin valid request returned HTTP 401 with zero jobs
  and zero provider tasks
- an administrator request using unsupported 1080p returned
  `BYTEPLUS_RESOLUTION_UNSUPPORTED` with zero jobs and zero provider tasks
- after returning to committed safe defaults, a valid administrator request
  returned HTTP 404 `Engine unavailable` with zero jobs and zero provider tasks

These results cover the successful MaxVideoAI submission, wallet reservation,
receipt, polling, actual-token accounting, durable copy, library projection,
preview, thumbnail, and download path. They do not yet prove a real provider
timeout/failure followed by exactly one wallet refund.

## Marketing-render acceptance ledger

Executed locally on 2026-08-07 through the hidden administrator-only route.
No identifier, signed URL, user ID, or wallet ID is recorded here.

| Concept | Disposition | Requested output | Observed output | Customer quote and receipt | Actual provider usage and cost | Durable assets | Acceptance notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The city in the suitcase | Accepted for marketing — product-owner signoff | 24 s, 720p, 16:9, audio off | 1280×720, 24 FPS, 24.0417 s, H.264 video only | USD 13.87; one wallet charge, zero refunds | 519,300 tokens; USD 5.556510 | Video, preview, and poster present; range request returned HTTP 206 `video/mp4` | Agent technical and sampled-frame QA pass: woman and suitcase remain stable; the city remains contained inside the suitcase; camera progression appears continuous; coastal city, water, buildings, and final reveal remain coherent; final sampled frames are clean; no visible text, logo, watermark, or material anatomy defect. The video was presented to the product owner, who signed off on its marketing use without reporting a defect or timestamp. This does not claim an agent full-playback review |
| The glass lightning train | Accepted for marketing — product-owner signoff | 24 s, 720p, 16:9, audio off | 1280×720, 24 FPS, 24.0417 s, H.264 video only | USD 13.87; one wallet charge, zero refunds | 519,300 tokens; USD 5.556510 | Video, preview, and poster present; range request returned HTTP 206 `video/mp4` | Agent technical and sampled-frame QA pass: locomotive and wagons remain stable; lightning visibly forms luminous glass arches; the train stays legible through apparent continuous lateral motion and the final aerial reveal; the silent opening reads clearly; no visible text, logo, duplication, or derailment. The video was presented to the product owner, who signed off on its marketing use without reporting a defect or timestamp. This does not claim an agent full-playback review |
| The runaway sock | Conditional — keep non-public until human audio review | 15 s, 720p, 16:9, generated audio on | 1280×720, 24 FPS, 15.0417 s, H.264 video plus AAC stereo audio at 32 kHz | USD 8.67; one wallet charge, zero refunds | 324,900 tokens; USD 3.476430 | Video, preview, and poster present; range request returned HTTP 206 `video/mp4`; durable audio playback stream present | Infrastructure and sampled visual QA pass: stable people, clothes, faces, eyelines, laundromat, red-sock pickup/offer, continuous camera, natural interaction, and no visible subtitles, text, logo, or watermark. Exact dialogue transcription, speaker attribution, and lip-sync remain a required manual review before publication |

City completed at the provider on its initial take. The first three durable-copy
passes reached the local 45-second download timeout. The existing retry policy
kept the job in `processing`; the fourth scheduled pass completed the durable
video, poster, preview, accounting, and HTTP range path. This consumed no
content retry and created no additional provider task or wallet charge.

The durable-copy root cause was the source-body timeout, not the provider
render. Commit `23d8b420` preserves the 45-second header limit and gives the
already-started body transfer 120 seconds. Train and Dialogue subsequently
copied on their first durable pass. Train's initial preview derivative timed
out separately; the normal idempotent preview helper completed it from the
durable MaxVideoAI video without another provider request or customer charge.

The approved three-render wallet ceiling was USD 36.41. Actual Task 4 wallet
spend was exactly USD 36.41: three unique charges, zero refunds, and an ending
wallet balance of USD 20.66. There were exactly three provider submissions,
all completed on their initial content take, with cumulative actual provider
cost USD 14.589450. The initial provider-cost envelope was USD 14.56; the
actual usage-based cost is USD 0.029450 higher, a variance of approximately
0.20%. The envelope was a preflight estimate, while USD 14.589450 comes from
persisted provider usage. This variance did not affect customer billing and
the USD 36.41 wallet ceiling was respected exactly. No content retry or
substitute request was made.

City and Train are accepted as the two marketing heroes by product-owner
signoff after the videos were presented. The agent evidence remains limited to
technical checks and sampled-frame visual QA; no agent full-playback claim is
made, and the owner reported no defect or timestamp. Dialogue is retained as
the audio candidate but must remain non-public until a human confirms its
exact English lines, speaker attribution, and lip-sync.

### Benchmark Lab evidence boundary — 2026-08-07

The initial Benchmark Lab row is an evidence-bounded editorial score based only
on the accepted City and Train outputs above. It is not a complete run of the
versioned eight-prompt pack, and it does not extend the sampled-frame and
product-owner acceptance claims already recorded in this ledger.

| Criterion | Initial value | Existing evidence boundary |
| --- | ---: | --- |
| Prompt adherence (`fidelity`) | 9.1 | City preserved the requested woman, suitcase-contained coastal city, camera progression, and final reveal; Train preserved the requested train, lightning-built glass arches, lateral movement, and aerial reveal. |
| Visual quality (`visualQuality`) | 9.2 | Both accepted outputs passed sampled-frame QA with coherent environments and clean final frames; no material visual defect was reported at signoff. |
| Motion realism (`motion`) | 9.2 | City showed apparent continuous camera progression; Train remained legible through apparent continuous lateral motion and the crane-like final reveal. |
| Temporal consistency (`consistency`) | 9.0 | The woman and suitcase remained stable in City, while the locomotive and wagons remained stable without duplication or derailment in Train. |
| Controllability (`controllability`) | 9.0 | Both initial takes followed their requested camera progression, framing, scene containment, and final reveal closely enough for marketing acceptance. |
| Human fidelity (`anatomy`) | `null` | Neither accepted hero was the methodology's targeted human-interaction evaluation; the absence of a sampled material anatomy defect is not scored as a dedicated anatomy result. |
| Text legibility (`textRendering`) | `null` | Neither accepted hero requested text; observing no text or logo does not evaluate requested typography. |
| Audio and lip sync (`lipsyncQuality`) | `null` | City and Train are silent, and Dialogue still requires human dialogue, attribution, and lip-sync review. |
| Multi-shot sequencing (`sequencingQuality`) | `null` | City and Train explicitly requested continuous movement without cuts, so they do not evaluate continuity across the explicit shot changes required by the methodology. The proposed 9.1 launch value was therefore not used. |
| Speed and stability (`speedStability`) | `null` | Two marketing renders do not meet the methodology's normal operational sample requirements. |
| Value score (`pricing`) | `null` | The recorded costs establish billing facts, not a comparative editorial production-value score. |

The displayed overall score is **9.1**, using the unchanged arithmetic mean of
prompt adherence 9.1, motion realism 9.2, and temporal consistency 9.0. Null
criteria do not enter that formula. The row will be recalibrated from normal
post-launch usage under the existing versioned methodology; unevidenced fields
remain null until qualifying evidence exists.

## Final noindex marketing handoff — 2026-08-07

The marketing pack is ready for the existing noindex model pages with exactly
two accepted videos: **The city in the suitcase** first and **The glass
lightning train** second. Both are public/indexable media records with durable
video, preview, and poster assets. The dedicated public playlist is named
`Model · Seedance 2.5`, uses slug `examples-seedance-2-5`, has description
`Drives /models/seedance-2-5.`, and returns City then Train. This media-level
moderation does not open the examples-family registry surface or index the
model page.

**The runaway sock** is the successful generated-audio canary. Its durable
video, preview, poster, and audio stream are present, but the asset remains
private, non-indexable, and outside every public playlist until a human validates
the exact dialogue, speaker attribution, and lip-sync. It must not be used on a
marketing page before that review.

The three approved initial submissions cost **USD 14.589450** at the provider
and debited **USD 36.41** from the MaxVideoAI wallet. There were exactly three
provider submissions, zero content retries, and zero refunds. City required
automatic retries of the already-generated source's durable-copy operation;
those attempts did not submit another provider task, generate new content, or
create another wallet charge. The later timeout correction let the normal
durable pipeline complete.

Final localized smoke evidence:

- `/models/seedance-2-5`, `/fr/modeles/seedance-2-5`, and
  `/es/modelos/seedance-2-5` returned HTTP 200 in the safe localized smoke;
- the shared model-page layout rendered City then Train, excluded Dialogue,
  exposed localized self-canonicals and the complete hreflang set, and kept
  `noindex, follow`;
- WebPage, BreadcrumbList, and Product schema rendered with no public Offer;
- no Seedance 2.5 app-generation destination, public pricing action, provider
  jargon, or rollout copy was exposed;
- both accepted public watch pages returned HTTP 200, while the private
  Dialogue watch page remained unavailable;
- the model route remained absent from the model and locale sitemaps;
- poster-first markup and the muted-video client contract were present. This
  is not a new agent full-playback claim beyond the recorded product-owner
  acceptance.

Final automated verification passed on `main`: 123 focused tests, model
registry/projection checks, model audit with zero critical findings, immutable
and public pricing baselines, pricing audit with zero mismatches, frontend
ESLint, public-exposure lint, FR/ES i18n parity, SEO guards, TypeScript, and
`git diff --check`. The Next.js production build completed successfully and
generated all 717 static pages, including the localized Seedance 2.5 params.

The following controls remain closed and require separate explicit approval:
public app generation, public pricing, examples-family publication,
comparisons, sitemap publication, and indexation. Deployment and push were not
performed by this handoff.

Separate next work—not part of this packet—is: add a Benchmark Lab score,
prepare and publish approved VS pages, strengthen internal linking, select any
homepage promotion, complete human review of the Dialogue asset, prove a real
failure/refund reconciliation, and plan public generation, pricing, and
indexation as distinct promotion steps.

## Dedicated controls and safe defaults

These controls belong only to Seedance 2.5. Never substitute a Seedance 2.0
flag, model ID, profile, or price.

| Control | Safe/default value | Hidden admin-canary value |
| --- | --- | --- |
| `BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID` | `dreamina-seedance-2-5-260628` | same factual model ID |
| `SEEDANCE_2_5_BYTEPLUS_ENABLED` | `false` | `true` |
| `SEEDANCE_2_5_PROVIDER` | `disabled` | `byteplus_modelark` |
| `SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY` | `true` | `true` |
| `SEEDANCE_2_5_BYTEPLUS_MODES` | `t2v` | `t2v` |

`SEEDANCE_2_5_BYTEPLUS_ENABLED=false` is the hard kill switch. The generation
route checks it before administrator authorization. When the route is enabled
and administrator-only, authorization then runs before configured-engine
resolution, database bootstrap, billing schema work, or provider submission.
The submission adapter repeats the kill-switch check as defence in depth and
rolls back an already-created billing reservation if it ever encounters the
disabled state.

The committed defaults remain disabled. Enabling a local or deployed admin
canary requires both `SEEDANCE_2_5_BYTEPLUS_ENABLED=true` and
`SEEDANCE_2_5_PROVIDER=byteplus_modelark`; administrator-only must remain true.
Credentials stay in the existing ModelArk secret variables and must never be
added to this packet or committed files.

## Price ownership

- Provider cost ownership: `frontend/server/byteplus-accounting.ts`
- Customer pricing ownership: `frontend/src/config/fal-engines/launch-config.ts`
- Provider no-video rate: USD 0.0107 per 1,000 tokens
- Provider video-input rate: USD 0.0064 per 1,000 tokens
- Approved customer policy: 2.5× provider list cost
- Pricing source key: `byteplus_seedance_2_5_260628_approved_2_5x`

The customer rate is normalized against the existing canonical 1.3 pricing
margin so the final member quote equals the approved 2.5× multiple. Do not copy
a Seedance 2.0 rate. Do not publish this internal price on the shared noindex
marketing page or any pricing surface before explicit approval.

## Phase checklist

### Phase 1 — hidden execution (implemented locally, not deployed)

- [x] Add factual raw engine `seedance-2-5`.
- [x] Add a dedicated provider profile and model-ID key.
- [x] Add a disabled-by-default hard kill switch and administrator-only policy.
- [x] Limit execution to the canary-proven text-to-video contract.
- [x] Add factual provider rates and approved 2.5× customer pricing.
- [x] Convert the registry identity out of `presentationOnly` while keeping
  public app, pricing, examples-family, comparison, and sitemap publication
  false.
- [x] Keep the public route on the localized standard shared production
  marketing renderer with `noindex, follow` and no generation or pricing
  action.
- [x] Publish only the dedicated page playlist with City then Train while
  keeping examples-family discovery closed.
- [x] Regenerate model runtime, engine catalog, and model roster.
- [x] Replace the old presentation-only readiness contract with the hidden-
  execution contract.
- [x] Complete all verification commands below on the implementation diff.
- [x] Review the implementation and handoff diff.
- [x] Commit the reviewed changes directly on local `main`.
- [ ] Push local `main`. This requires a later explicit instruction.
- [ ] Deploy. This requires a later explicit instruction.

### Phase 2 — MaxVideoAI administrator canary (happy path completed locally)

- [x] Enable only the five controls in the table for a trusted environment.
- [x] Prove a non-admin request is rejected before billing and provider access.
- [x] Run a 4-second, 480p, 16:9, silent text-to-video request through the real
  MaxVideoAI generation route with an authenticated administrator.
- [x] Verify wallet preflight, debit/reservation, provider submission, polling,
  actual usage capture, provider cost, customer receipt, and job ownership.
- [x] Verify the provider output is copied to durable MaxVideoAI storage before
  the signed provider URL expires.
- [x] Verify library visibility and download from the durable URL.
- [x] Trigger a safe validation failure and prove no provider request or charge.
- [ ] Exercise timeout/failure reconciliation and prove exactly one refund.
- [x] Confirm the inspected logs contain no API keys, signed URLs, wallet IDs, or
  provider task IDs that should remain private.
- [x] Record only sanitized evidence in this packet.

Do not enable references, image-to-video, editing, or extension during this
phase. Generated audio now has a successful infrastructure and durable-media
canary, but it remains blocked from publication until the recorded manual
dialogue review is complete.

### Phase 3 — restricted public generation

Requires explicit approval after Phase 2. Keep the model page `noindex`, the
sitemap off, and public pricing, examples-family discovery, and comparisons off
unless each surface is approved separately. The dedicated City/Train playlist
may continue to serve the noindex model page without opening those surfaces.

### Phase 4 — indexed public launch

Requires explicit approval for app discovery, pricing, sitemap,
examples-family discovery, comparisons, and indexation. Change only the
authored publication fields in `frontend/config/model-registry.json`, regenerate
all projections, and review the customer price and localized pages. Keep
Seedance 2.0 live unless a separate retirement decision is approved.

## Production handoff for Codex

When asked to “put Seedance 2.5 in production”, Codex must first read:

1. `AGENTS.md`
2. `docs/engineering/llm-working-guide.md`
3. `docs/engineering/model-registry.md`
4. `docs/engineering/pricing-engine.md`
5. `docs/deployment/github-vercel.md`
6. this packet

Then Codex must inspect the current `main`, worktree, generated projections,
and deployment configuration. A production request does not authorize skipping
Phase 2, enabling every public surface, changing the approved price, exposing
new modes, or deleting Seedance 2.0. Re-check the official ModelArk card because
model limits and prices can change.

## Rollback

1. Set `SEEDANCE_2_5_BYTEPLUS_ENABLED=false` first. Verify both administrator
   and non-administrator attempts produce no provider request or charge.
2. Keep polling, durable-storage copying, reconciliation, and refund handling
   alive for existing tasks until each reaches a terminal state.
3. Keep `SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=true`; admin-only is an access policy,
   not the emergency stop.
4. If publication fields were opened, revert them in
   `frontend/config/model-registry.json`, regenerate every projection, and
   deploy the reviewed rollback.
5. Do not delete the engine/profile while jobs remain in flight. Do not rewrite
   receipts or recompute historical refunds.
6. Record affected MaxVideoAI job IDs, provider task IDs, pricing events,
   rollback commit, deployment ID, cause, and owner in the private incident
   record—not in this public repository if the identifiers are sensitive.

## Verification commands

```bash
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
pnpm model:registry:check
pnpm model:check
pnpm models:audit
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
pnpm test:validate
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm --prefix frontend run build
git diff --check
```

## Instruction to give Codex later

```text
Read AGENTS.md and docs/model-launch/seedance-2-5.md, then inspect the current
main branch and deployment state. Continue only with the next incomplete,
explicitly approved promotion phase. Preserve the dedicated Seedance 2.5 kill
switch, admin-only gate, factual ModelArk model ID and rates, 2.5× customer
policy, standard shared production marketing page with `noindex, follow` and no
generation or pricing actions, dedicated City/Train page playlist, and closed
app, pricing, examples-family, comparison, sitemap, and indexation flags. Return
verification, canary, billing, storage, and rollback evidence before proposing
any broader opening.
```
