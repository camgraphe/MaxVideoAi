# Seedance 2.5 launch packet

## Current state

- Prepared on: 2026-07-26
- Future source template: `seedance-2-0`
- Canonical candidate ID: `seedance-2-5`
- Family: `seedance`
- Runtime status: absent
- Registry status: absent
- Public route: absent
- MaxVideoAI generation availability: unavailable
- BytePlus ModelArk API availability: unconfirmed
- Customer and provider pricing: unconfirmed
- MaxVideoAI launch commitment: none

No MaxVideoAI launch is committed. Any future integration depends on official
BytePlus API evidence, successful technical validation, and the required legal
and commercial clearances.

The localized files in `docs/model-launch/seedance-2-5/` are unpublished
launch drafts. They are not a live generation offer. Move them to
`content/models/{en,fr,es}/` only when a factual engine and canonical registry
entry exist.

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

Until every item is recorded, do not add a provider profile, engine catalog
entry, registry entry, customer price, or generation CTA.

## Legal and commercial clearance required

Before any public launch, obtain written confirmation that MaxVideoAI may
integrate and redistribute the service and use the relevant BytePlus and
Seedance marks. Have counsel review both official documents:

- https://docs.byteplus.com/en/docs/modelark/Specific_Terms_for_the_BytePlus_Video_Generation_Model_Services
- https://docs.byteplus.com/en/docs/ModelArk/2353368

Treat this as a publication gate, independent of technical readiness. Private
or sales-gated access does not satisfy it.

## Promotion state machine

### 1. Hidden execution

- Add a factual raw engine and canonical registry entry.
- Keep every publication field false.
- Default the engine to disabled and admin-only.
- Configure the real provider model ID through the provider environment layer.
- Record written integration, redistribution, and trademark clearance before
  advancing beyond internal evaluation.

### 2. Admin canary

- Enable authenticated admins only.
- Verify submission, polling, storage copying, expiration, moderation errors,
  usage accounting, cancellation, and refunds.
- Run the fixed quality and cost benchmark suite.

### 3. Public noindex

- Publish the model route with `indexable=false`.
- Keep sitemap, pricing, comparison, examples, and broad app discovery disabled
  until each prerequisite passes.
- Use limited-availability messaging only when generation access is
  intentionally restricted.

### 4. Public indexed

- Enable app, pricing, sitemap, examples, comparisons, and indexation
  independently in the canonical registry.
- Keep Seedance 2.0 available unless a separate retirement decision is approved.

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
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```
