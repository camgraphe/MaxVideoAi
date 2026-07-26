# Seedance 2.5 launch packet

## Current state

- Prepared on: 2026-07-26
- Page template: canonical model-page `prelaunch` variant
- Canonical ID: `seedance-2-5`
- Family: `seedance`
- Presentation identity: present in the canonical registry and runtime projection
- Executable engine: absent
- Public routes: present in EN, FR, and ES
- Robots: `noindex, follow`
- Sitemap, app, pricing, examples, and comparison surfaces: disabled
- MaxVideoAI generation availability: unavailable
- BytePlus ModelArk API availability: unconfirmed
- Customer and provider pricing: unconfirmed
- MaxVideoAI launch commitment: none

The published page is an editorial coming-soon surface only. It has no raw
engine, provider profile, provider model ID, executable alias, customer price,
or generation CTA. Any future generation integration depends on official
BytePlus API evidence, successful technical validation, and the required legal
and commercial clearances.

The localized files in `content/models/{en,fr,es}/seedance-2-5.json` own the
live presentation-only copy. The earlier files in
`docs/model-launch/seedance-2-5/` remain evidence snapshots and are not runtime
configuration.

## Dreamina-announced product-surface claims

Official source: https://dreamina.capcut.com/seedance/seedance-2-5

Checked on 2026-07-26, Dreamina labels Seedance 2.5 as coming soon and states
that its product surface is designed to offer:

- 4K output
- standard video generation up to 30 seconds
- beta long-video mode up to 180 seconds
- up to 50 multimodal inputs
- reference-to-video control
- precise editing of selected video regions

These are attributed product-surface statements. They do not establish
BytePlus ModelArk API availability, payloads, limits, regions, pricing, or
release timing.

The same Dreamina page also describes a generation workflow and free credits.
That copy is internally mixed with the “coming soon” label, so this packet
records the label as a Dreamina observation rather than inferring product or
API availability.

## BytePlus prelaunch marketing evidence

Official sales page: https://www.byteplus.com/en/contact-us/ai-seedance2-5-official

Checked on 2026-07-26, BytePlus also labels Seedance 2.5 as coming soon and
mentions 30-second generation, up to 50 references, and editable output. This
is a sales/contact page, not ModelArk API documentation. Its statements are
prelaunch marketing evidence only: they do not establish a provider model ID,
payload contract, executable limits, availability, entitlement, regions, or
unit pricing.

Any percentage discount shown on the sales page is promotional marketing
evidence only. It must not be used as MaxVideoAI customer pricing or BytePlus
ModelArk unit pricing.

## Official BytePlus API evidence required

No public BytePlus ModelArk Seedance 2.5 API contract was located as of 2026-07-26; access may still be private or sales-gated.

Record every item below from official BytePlus documentation before adding a
runtime profile:

1. Canonical model ID, supported regions, entitlement, and release status.
2. Supported input modes, payload roles, reference ordering, and anchor syntax.
3. Duration, resolution, aspect-ratio, FPS, generated-audio, editing, and extension behavior.
4. Combined and per-media reference limits, formats, file sizes, and media durations.
5. Task creation, polling, webhook, output, expiration, usage, moderation, and error schemas.
6. Concurrency, RPM, quota, and service-tier limits.
7. Vendor pricing units, input-type distinctions, failed-task charging, cancellation, and refund behavior.

Until every item is recorded, do not convert the presentation-only identity
into an executable engine, add a provider profile or engine-catalog entry,
publish a customer price, or expose a generation CTA.

## Legal and commercial clearance required

Before any public launch, obtain written confirmation that MaxVideoAI may
integrate and redistribute the service and use the relevant BytePlus and
Seedance marks. Have counsel review both official documents:

- https://docs.byteplus.com/en/docs/modelark/Specific_Terms_for_the_BytePlus_Video_Generation_Model_Services
- https://docs.byteplus.com/en/docs/ModelArk/2353368

Treat this as a publication gate, independent of technical readiness. Private
or sales-gated access does not satisfy it.

## Promotion state machine

### 0. Presentation only — current

- Publish the canonical localized model route with `presentationOnly=true`,
  `model.published=true`, and `model.indexable=false`.
- Keep engine catalog, provider profiles, app, pricing, examples, comparisons,
  and sitemap surfaces absent or disabled.
- Show attributed product announcements and links to currently available
  Seedance surfaces. Keep API, provider, and pricing uncertainty documented in
  this packet, not in customer-facing copy.

### 1. Hidden execution

- Add a factual raw engine and convert the existing registry identity out of
  presentation-only mode in the same reviewed change.
- Keep every execution and discovery publication surface false; the editorial
  noindex page may remain published.
- Default the engine to disabled and admin-only.
- Configure the real provider model ID through the provider environment layer.
- Record written integration, redistribution, and trademark clearance before
  advancing beyond internal evaluation.

### 2. Admin canary

- Enable authenticated admins only.
- Verify submission, polling, storage copying, expiration, moderation errors,
  usage accounting, cancellation, and refunds.
- Run the fixed quality and cost benchmark suite.

### 3. Public noindex generation

- Publish the model route with `indexable=false`.
- Keep sitemap, pricing, comparison, examples, and broad app discovery disabled
  until each prerequisite passes.
- Use limited-availability messaging only when generation access is
  intentionally restricted.

### 4. Public indexed

- Enable app, pricing, sitemap, examples, comparisons, and indexation
  independently in the canonical registry.
- Keep Seedance 2.0 available unless a separate retirement decision is approved.

## Codex production handoff

Treat this packet as the single operational entry point for a future Seedance
2.5 launch. On a request such as “put Seedance 2.5 in production”, Codex must
first read the current `AGENTS.md`, `docs/engineering/model-registry.md`,
`docs/engineering/pricing-engine.md`,
`docs/deployment/github-vercel.md`, and this packet. It must re-check the
current repository owners instead of assuming that the file paths below have
not moved. The request does not authorize skipping a promotion phase, inventing
provider facts, or publishing every surface at once.

### Prelaunch foundation already completed

- [x] BytePlus Seedance routing uses explicit per-engine profiles and rejects
  unknown engine, capability, and pricing profiles before submission or charge.
- [x] Aggregate reference budgets and typed media provenance flow from the
  workspace through server validation into the BytePlus payload.
- [x] BytePlus image-to-video canonicalizes one opening image and rejects
  missing, mismatched, or ambiguous provenance.
- [x] The canonical EN, FR, and ES coming-soon routes use the shared model-page
  shell and a dedicated `prelaunch` renderer.
- [x] The canonical registry marks Seedance 2.5 as presentation-only, published
  noindex, and disabled on app, pricing, examples, comparison, and sitemap
  surfaces.
- [x] The readiness contract proves that the page is public while every
  executable engine, provider, pricing, and generation path remains absent.

These items are reusable foundation, not launch toggles. Do not recreate or
bypass them in the factual integration batch.

### Hidden artefact inventory

- `content/models/{en,fr,es}/seedance-2-5.json` owns the live localized
  presentation copy. The overlays under `docs/model-launch/seedance-2-5/` are
  retained as the original evidence snapshots.
- `docs/model-launch/seedance-2-5.engine.stub.ts` is an evidence gate only. It
  stays under `docs/` and must never be imported by runtime code.
- `tests/seedance-2-5-readiness.test.ts` and
  `tests/seedance-2-5-coming-soon.test.ts` permit only the presentation
  identity and canonical page assets. They continue to block executable
  aliases, engine-catalog membership, app discovery, pricing, examples,
  comparisons, sitemap publication, and provider configuration.
- The Seedance 2.5 specifications and implementation plans under
  `docs/superpowers/` are historical design evidence. They stay documentation
  and are not production configuration.
- The BytePlus profile, reference-budget, validation, accounting, and payload
  modules already in runtime are the prepared integration foundation. Extend
  their current owners; do not copy them into a parallel Seedance 2.5 stack.

### Release evidence record — blocking

Before changing runtime code, update this packet with official URLs, access
dates, and reviewed values for every item in “Official BytePlus API evidence
required”. In addition:

- [ ] Record the exact provider model ID, supported region, account entitlement,
  and a successful authenticated discovery or test response.
- [ ] Record the exact modes, payload roles, media ordering, reference budgets,
  durations, resolutions, aspect ratios, FPS, audio, editing, and extension
  behavior.
- [ ] Record polling, webhook, output expiry, usage, moderation, cancellation,
  failure-charging, and refund behavior.
- [ ] Record vendor pricing units and an approved MaxVideoAI customer-price
  decision without reusing a Seedance 2.0 rate.
- [ ] Link written integration, redistribution, and trademark clearance.

Stop the launch if any fact needed by the next phase is missing or comes only
from a marketing page.

### Phase 1 execution checklist — hidden and admin-only

- [ ] Create the factual raw engine beside the current files in
  `frontend/src/config/fal-engines/` and register it through the current raw
  engine registry. Use canonical ID `seedance-2-5`; keep provider IDs out of
  canonical aliases.
- [ ] Add a dedicated Seedance 2.5 BytePlus profile through the current owners
  under `frontend/src/server/video-providers/`. Give it explicit capability,
  routing, environment, and pricing keys; never fall back to a 2.0 profile.
- [ ] Add dedicated environment configuration with disabled and admin-only safe
  defaults. Store the real provider ID and credentials only in the provider
  environment layer and deployment secret store.
- [ ] Implement one model-specific fail-closed hard-disable control that blocks
  every Seedance 2.5 submission path, including administrators, before billing
  and provider submission. Record its exact name, scope, safe default, and
  deployment location in this packet, then prove that disabled admin and
  non-admin attempts cause no provider request or charge.
- [ ] Record the exact names and defaults of the model-specific provider ID,
  enable, routing, admin-only, and allowed-mode controls. Do not share a fallback
  control with Seedance 2.0.
- [ ] Implement only officially documented request fields, reference budgets,
  payload roles, polling states, errors, and accounting behavior.
- [ ] Add factual vendor cost through `frontend/server/byteplus-accounting.ts`
  and the canonical pricing owners described by
  `docs/engineering/pricing-engine.md`. Review billing and public quotes
  independently.
- [ ] Convert the existing `seedance-2-5` registry identity out of
  `presentationOnly` only in the same reviewed change that adds its factual raw
  engine. Keep app, pricing, examples, comparisons, sitemap, and indexation
  disabled, with no speculative aliases and no replacement.
- [ ] Replace the presentation-only copy with confirmed execution facts and add
  reviewed localized decision, prompting, examples, CTA, href, and claim data
  only for capabilities that passed the canary.
- [ ] Extend the presentation-only readiness contract into a hidden-execution
  contract: the factual engine may exist, but public execution, app discovery,
  pricing, examples, comparisons, sitemap, and indexation must remain disabled.
- [ ] Regenerate runtime, engine-catalog, and roster projections using the model
  registry workflow; never edit generated JSON or roster files directly.
- [ ] Add focused profile, payload, validation, polling, accounting, billing,
  refund, and hidden-publication tests from real official fixtures.

### Phase 2 execution checklist — admin canary

- [ ] Deploy a trusted preview or production-hidden build with model-specific
  provider configuration disabled by default.
- [ ] Enable the model for authenticated administrators only and begin with the
  smallest confirmed mode, duration, resolution, and reference set.
- [ ] Execute real text, image, and every other confirmed workflow. Record
  provider task IDs, MaxVideoAI job IDs, inputs, outputs, duration, token or
  usage data, vendor cost, customer quote, receipt, and refund result.
- [ ] Verify submission, polling, storage copying, output expiry, moderation,
  cancellation, timeouts, retries, concurrency, quota handling, and sanitized
  user-facing errors.
- [ ] Compare observed provider usage and invoices with stored accounting and
  canonical pricing. Resolve every unexplained difference before promotion.
- [ ] Confirm logs, analytics, and error reporting contain no credentials,
  signed media URLs, prompts, or billing identifiers that should stay private.
- [ ] Keep the rollback controls below tested and immediately available.

### Phase 3 execution checklist — public noindex generation

- [ ] Obtain explicit approval to open restricted generation; the editorial
  route is already public noindex.
- [ ] Keep `publication.model.published=true` and
  `publication.model.indexable=false`. Keep app discovery, public pricing,
  examples, comparisons, and sitemap publication disabled unless separately
  approved for this phase.
- [ ] Replace all “coming soon” and unavailable copy with reviewed factual
  availability language appropriate to the actual access level.
- [ ] Verify EN, FR, and ES canonical URLs, hreflang, robots `noindex`, JSON-LD,
  internal links, authentication behavior, and absence from every sitemap.
- [ ] If access remains restricted, use explicit limited-availability language
  and do not expose a generation CTA to ineligible users.

### Phase 4 execution checklist — public indexed

- [ ] Approve the intended production execution audience before enabling public
  surfaces. Set the recorded model-specific enable, routing, admin-only, and
  allowed-mode controls to their reviewed production values, confirm there is
  no fallback to another provider or profile, and verify eligible and ineligible
  access in the reviewed deployment.
- [ ] Obtain explicit approval for each registry surface: app, pricing, sitemap,
  examples, comparisons, and model indexation.
- [ ] Set publication fields only in
  `frontend/config/model-registry.json`, regenerate every projection, and
  review the generated diff.
- [ ] Review final customer prices, estimator output, pricing page, model-page
  offers, structured data, wallet preflight, receipts, and refunds.
- [ ] Review examples membership, comparison opponents, family ranking, app
  discovery rank, localized navigation, sitemap membership, canonical URLs,
  hreflang, robots, and JSON-LD.
- [ ] Keep Seedance 2.0 published unless a separate retirement plan is approved.
- [ ] Deploy through the normal reviewed `main` branch flow and complete the
  production smoke checks before announcing availability.

### Presentation-only deployment smoke — current

- [ ] Confirm the production commit and deployment ID match the reviewed page.
- [ ] Confirm EN, FR, and ES routes return 200 with localized canonical and
  hreflang values and `noindex, follow`; confirm the prelaunch renderer adds
  only WebPage and BreadcrumbList beyond the site's global structured data.
- [ ] Confirm Seedance 2.5 is absent from every sitemap, the model catalog, app
  discovery, pricing, examples, and comparisons.
- [ ] Submit a controlled invalid generation request for `seedance-2-5` and
  confirm `Unknown engine` occurs before billing or provider submission.

### Future execution production smoke checks

- [ ] Confirm the production commit and deployment ID match the reviewed release.
- [ ] Confirm model pages in EN, FR, and ES return the intended status, metadata,
  canonical URL, hreflang, robots directive, and structured data.
- [ ] Confirm eligible users can select the engine and ineligible users cannot.
- [ ] Run one low-cost generation for every public mode and verify polling,
  durable media, library visibility, accounting, receipt, and downloadable
  output.
- [ ] Trigger one safe validation failure and confirm no provider request or
  charge occurs.
- [ ] Monitor provider failures, latency, usage variance, refund rate, and
  customer-facing errors during the initial release window.

### Rollback

#### Current presentation-only page

1. Roll back to the previous reviewed deployment. This page owns no provider
   tasks, billing events, or in-flight generations.
2. If a code rollback is required instead, retire the presentation route and
   its live localized content in the same reviewed change, regenerate the
   runtime projection, and deploy.
3. Confirm all three localized routes are withdrawn and that generation,
   pricing, app, examples, comparisons, and sitemap surfaces remained absent.

#### Future executable model

1. Activate the recorded model-specific hard-disable control before any other
   rollback action. It must reject both administrator and non-administrator
   submissions before billing and provider submission. Verify that both attempts
   produce no provider request or charge; admin-only mode is not an emergency
   stop.
2. Keep polling, storage, reconciliation, and refund handling alive until every
   in-flight task reaches a terminal state.
3. Revert the registry publication fields, regenerate projections, and deploy
   the reviewed rollback. Do not delete the engine or provider profile while
   jobs remain active.
4. Roll back a database commercial-policy event through the canonical immutable
   pricing history. Revert authored provider rates, engine pricing details, or
   versioned fallback policy through a reviewed code rollback and deployment
   after the hard pause. Never rewrite receipts or recompute historical refunds.
5. If the release code itself is unsafe, use the normal Vercel previous-
   deployment rollback only after new submissions are paused and in-flight-job
   ownership is understood.
6. Re-enable an administrator canary only as a separate, explicitly approved
   recovery decision after the cause is resolved and the focused checks pass.
7. Record the incident, affected job IDs, provider task IDs, pricing event IDs,
   rollback commit, deployment ID, and follow-up owner.

### Definition of done

The presentation-only deployment is complete when its current smoke checks pass
and its rollback is recorded. A future generation launch is complete only when
the evidence record is current, legal and commercial gates are linked, canary
evidence is retained, intended registry surfaces are explicit, every
verification command below passes, execution smoke checks pass, monitoring is
healthy, and the rollback state is recorded. Update “Current state” and this
checklist in the same reviewed launch change.

### Instruction to give Codex

```text
Read AGENTS.md, docs/engineering/model-registry.md,
docs/engineering/pricing-engine.md, docs/deployment/github-vercel.md,
and docs/model-launch/seedance-2-5.md. Treat the launch packet as the
authoritative runbook. Re-check official BytePlus API evidence and current
repository owners, then execute only the next approved promotion phase. Do not
infer missing provider facts, reuse Seedance 2.0 pricing, or enable unapproved
publication surfaces. Return the verification evidence and rollback state
before asking to advance.
```

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
