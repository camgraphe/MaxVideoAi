# Seedance 2.5 production handoff

This is the operational source of truth for the Seedance 2.5 public flagship
launch. Read it before changing a Seedance 2.5 flag, publication surface,
price, provider route, or rollback state. It documents a target configuration;
it does not authorize or perform an environment, provider, generation, payment,
push, or deployment mutation.

## Current state — public flagship launch

- Updated: 2026-08-08
- Canonical MaxVideoAI ID: `seedance-2-5`
- ModelArk model ID: `dreamina-seedance-2-5-260628`
- ModelArk region: `ap-southeast-1`; release status: GA
- Approved target: **public flagship launch** with all five modes:
  text-to-video, image-to-video, reference-to-video, video-to-video, and
  extension.
- Public surfaces are open: app discovery, pricing, examples, comparison,
  sitemap, and indexation. The model page is indexable and keeps its localized
  self-canonical and hreflang metadata.
- City and Train are public marketing media in that order. Dialogue remains
  private pending human confirmation of its exact dialogue, speaker attribution,
  and lip-sync.
- The approved customer-price policy remains 2.5× the factual ModelArk cost.
- There is **no additional pre-launch paid generation**. This packet records
  existing evidence and the read-only production smoke checks only.

The public flagship posture does not replace safety controls: the hard kill
switch stays available, existing work continues through terminal reconciliation,
and a failed charged job is refunded from its stored charge amount. No secret,
provider task ID, signed URL, user ID, or wallet ID belongs in this repository.

## Production environment matrix

Apply these values only through the approved production configuration workflow.
They are intentionally documented here rather than copied into
`frontend/.env.local.example`.

```dotenv
BYTEPLUS_ARK_ENABLED=true
BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID=dreamina-seedance-2-5-260628
SEEDANCE_2_5_BYTEPLUS_ENABLED=true
SEEDANCE_2_5_PROVIDER=byteplus_modelark
SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=false
SEEDANCE_2_5_BYTEPLUS_MODES=t2v,i2v,ref2v,v2v,extend
```

`BYTEPLUS_ARK_ENABLED=true` is the production prerequisite for ModelArk
submission, polling, durable copying, and terminal reconciliation. The
Seedance-specific switch below remains the first rollback control.

`SEEDANCE_2_5_BYTEPLUS_ENABLED=false` is the hard kill switch. It stops new
Seedance 2.5 submissions before provider work; it is not a reason to remove
marketing or SEO surfaces. `SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=false` is required
for public generation and is not a substitute for the kill switch.

### Checked-in local and review defaults — fail closed

`frontend/.env.local.example` must stay deliberately different from the
production matrix: it has the factual model ID, but sets the provider to
`disabled`, execution to `false`, administrator-only to `true`, and modes to
`t2v`. Fresh local and review environments therefore cannot accidentally submit
to ModelArk. Credentials remain in existing secret variables and are never
committed here.

## Phase status

- Prior phases: complete — implementation, authenticated canaries, public
  publication surfaces, and launch documentation are recorded.
- Current phase: `public_flagship_launch`.
- Next phase: `post_launch_monitoring`.

These values match the documentation-only evidence stub. Post-launch monitoring
does not authorize new paid canaries or a production mutation.

## Runtime and publication contract

The public runtime contract has five modes: `t2v`, `i2v`, `ref2v`, `v2v`, and
`extend`. It supports 4–30 seconds, 480p or 720p, 16:9, 24 FPS, generated audio,
and up to 50 combined references (30 images, 10 videos, 10 audio files). The
corresponding payload, polling, storage, accounting, and refund paths are the
existing executable owners; this document is documentation-only.

Publication is public and coherent across the product:

- model page: published and indexable;
- app: published, first in the Seedance selector, with the `New` badge;
- pricing and Benchmark Lab: included;
- examples: published, current, and listed with City followed by Train;
- compare: published against Seedance 2.0, Kling 3 Pro, and Veo 3.1;
- sitemap: published with localized model URLs and self-canonical metadata.

Do not publish Dialogue merely because the five-mode runtime is public. Its
private status is a media review decision, independent of the public model
launch.

## Evidence retained from the authenticated canaries

Official ModelArk model card (checked 2026-08-07):

https://console.byteplus.com/ark/region:ap-southeast-1/model/detail?name=dreamina-seedance-2-5

This authenticated console page is private launch evidence for the exact model
identity and availability. It is not presented as a public benchmark source.

Official asynchronous video API flow:

https://docs.byteplus.com/en/docs/modelark/1520757

This public document establishes only the generic asynchronous ModelArk video
task mechanics. It is not evidence for Seedance 2.5 durations, resolutions,
reference limits, audio formats, pricing, or model-specific capabilities. The
public Benchmark Lab therefore labels the Seedance 2.5 limits as the
**MaxVideoAI production route contract**, keeps its external source list empty,
and links the generic API document separately as mechanics context.

The recorded four-second provider and MaxVideoAI administrator happy path used
480p, 16:9, 24 FPS, generated audio off, and model
`dreamina-seedance-2-5-260628`. It reached `queued → running → succeeded`,
recorded 38,830 tokens, persisted durable video/preview/thumbnail, and returned
a range download of HTTP 206 `video/mp4`. The wallet receipt was `paid_wallet`:
one charge and zero refunds. An invalid 1080p request returned
`BYTEPLUS_RESOLUTION_UNSUPPORTED` before provider work.

City and Train were accepted for marketing by product-owner signoff after
technical and sampled-frame QA. They each have durable video, preview, and
poster assets with media range responses. Dialogue has durable generated-audio
infrastructure but remains private for the manual review stated above.

The factual provider rates remain USD 0.0107 per 1,000 tokens without video
input and USD 0.0064 per 1,000 tokens with video input. Customer pricing stays
owned by `frontend/src/config/fal-engines/launch-config.ts`; provider accounting
stays owned by `frontend/server/byteplus-accounting.ts`. Do not copy a Seedance
2.0 rate or alter the approved 2.5× policy in this handoff.

## Read-only production smoke checks

Run these checks after an approved deployment without creating a generation,
provider task, wallet charge, or payment mutation. Capture status, timestamp,
release identifier, and redacted result in the private launch record.

1. Request HTTP 200 for `/models/seedance-2-5`,
   `/fr/modeles/seedance-2-5`, and `/es/modelos/seedance-2-5`.
2. Open the authenticated generator with `engine=seedance-2-5`; verify the
   selected engine boots without submitting a job.
3. Verify the selector puts Seedance 2.5 first in its family and shows `New`.
4. Verify all five visible modes and their expected upload fields: image input
   for I2V, reference image/video/audio fields for Ref2V, video input for V2V,
   and extension source video for Extend.
5. Request read-only live quotes for T2V and V2V; both must be positive. Do not
   accept a quote or submit a generation.
6. Verify sitemap inclusion, self-canonical metadata, and indexable model-page
   robots metadata for all three localized model URLs.
7. Request HTTP 200 for all three comparison pages: Seedance 2.5 vs Seedance
   2.0, Kling 3 Pro, and Veo 3.1.
8. Verify Benchmark Lab and the pricing page include Seedance 2.5.
9. Request media ranges for City and Train; each must return HTTP 206 with an
   appropriate video content type. Confirm Dialogue remains private.

## Monitoring and incident response

Monitor submission acceptance, provider queue/running/terminal state duration,
failure codes, wallet reservation/charge/refund events, quote anomalies,
durable-copy failures, and HTTP status/error rates for the model, generator,
compare, pricing, examples, and sitemap surfaces. Alert the on-call owner on a
submission spike, elevated terminal failures, failed reconciliation, duplicate
charge/refund signal, or a sitemap/indexation regression.

For an execution incident, record affected internal job identifiers, provider
task identifiers, pricing events, deployment ID, cause, and owner only in the
private incident record. Do not paste secrets, signed URLs, wallet IDs, or
customer identifiers into this handoff. Preserve provider and wallet evidence
until reconciliation is terminal.

## Ordered rollback

Rollback is reversible and preserves marketing/indexation unless the content is
itself inaccurate.

1. Set `SEEDANCE_2_5_BYTEPLUS_ENABLED=false` to stop new submissions while
   leaving marketing pages online. Verify no new provider request or wallet
   charge is created.
2. Keep `BYTEPLUS_ARK_ENABLED=true` while existing jobs poll, copy to durable
   storage, and reconcile until each reaches a terminal state. Disable the
   global ModelArk gate only after no in-flight job still depends on it.
3. If UI execution exposure must be removed, set only
   `publication.app.published=false` and `publication.pricing.published=false`
   in `frontend/config/model-registry.json`, regenerate projections, review,
   and deploy. Do not edit generated projections directly.
4. Keep the model page indexable and online unless its content is inaccurate;
   an execution incident alone does not justify deleting SEO equity.
5. If indexation must be reversed, set the model indexable and sitemap flags to
   `false` without redirecting or deleting the route, regenerate projections,
   and deploy the focused change.
6. Reconcile pending jobs and refund their stored charged amounts through the
   existing wallet/refund logic. There is **no automated retry** for a charged
   failed generation: never issue a blind retry or recompute historical charges.
7. Record the rollback commit, release, cause, owner, and private reconciliation
   evidence. Do not delete the engine/profile while jobs are in flight.

## LinkedIn launch package

The Task 12 repository-only copy, approved City/Train choices, tracked links,
and publication guard remain discoverable in
[`seedance-2-5-linkedin-launch.md`](./seedance-2-5-linkedin-launch.md). That
package does not authorize an external post or deployment.

## Verification before an approved rollout

Run the focused readiness contract first, then the normal repository checks:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts
pnpm model:registry:check
pnpm test:validate
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm --prefix frontend run build
git diff --check
```

Before any registry policy edit, follow `docs/engineering/model-registry.md` and
regenerate its projections. This handoff does not authorize a production
environment update, provider request, paid generation, payment action, push, or
deployment.

## Pre-launch verification evidence — 2026-08-08

The verified source commit is
`8412da8321eec3c38c97cff3b1411e9d8ed80f75`. This SHA is the complete
runtime, product, marketing, SEO, and smoke-fix state immediately before this
evidence-only documentation commit; the documentation commit cannot cite its
own SHA without becoming self-referential.

The visual smoke found and closed two launch-scope gaps before this SHA was
recorded: Seedance 2.5 now reports `available` rather than a restricted-access
label in the selector and generated rosters, and Generate is disabled whenever
the active workflow is missing a required media asset (confirmed with Extend
and no source clip).

### Command evidence

- Focused Seedance/runtime suite: PASS, 97/97 tests.
- Focused marketing/SEO suite: PASS, 101/101 tests.
- `pnpm model:registry:check`: PASS; 42 models, 2 tombstones, and current
  runtime/catalog/roster projections.
- `pnpm model:check` and `pnpm models:audit`: PASS; 41 roster entries,
  0 critical findings, and 9 non-blocking existing audit warnings.
- `pnpm pricing:baseline`: PASS; immutable 178-row baseline.
- `pnpm pricing:public-baseline`: PASS; current 504-row public projection.
- `pnpm pricing:audit`: PASS; 182/182 matches and 0 mismatches.
- `pnpm test:validate`: PASS; 2,483/2,483 tests and 0 failures.
- `pnpm --prefix frontend run lint`: PASS.
- `pnpm lint:exposure`: PASS.
- `pnpm --prefix frontend run i18n:check`: PASS; FR parity at 4,197 keys and
  ES parity at 4,191 keys.
- `pnpm --prefix frontend run seo:check`: PASS; canonical, llms, internal-link,
  and 1,538-public-media-origin checks passed.
- `pnpm --prefix frontend exec tsc --noEmit --pretty false`: PASS.
- `pnpm --prefix frontend run build`: PASS with Next.js 15.5.18; production
  compilation, integrated lint/type check, 729 static pages, build traces, and
  post-build sitemap generation completed.
- `git diff --check`: PASS before the source commit and after this evidence
  update.

### Local route and workspace smoke

Playwright inspected 1440×1000 desktop and 390×844 mobile viewports without
pressing Generate. All requested pages returned HTTP 200 and showed no
horizontal overflow:

- EN, FR, and ES Seedance 2.5 model pages;
- pricing, Benchmark Lab, homepage, model catalogue, Seedance examples, and
  the Seedance 2.0 upgrade surface;
- Seedance 2.0 vs Seedance 2.5, Kling 3 Pro vs Seedance 2.5, and Seedance 2.5
  vs Veo 3.1 comparisons.

The workspace booted from `/app?engine=seedance-2-5`, kept Seedance 2.5
selected, showed `New`, score 9.1, `Available`, all five mode indicators,
4–30-second controls, 480p/720p, 16:9, audio, and the expected start/end image,
source video, 30-image, 10-video, 10-audio, and extension-source upload
surfaces. A positive local T2V quote displayed; switching to Extend without a
source clip kept the quote visible but disabled Generate on desktop and mobile.

The browser smoke used the local Next.js development server because local
`next start` under Node.js 23.9.0 hit an Edge middleware string-code-generation
restriction. The production build itself passed; deployment smoke must still
run against the approved production runtime. The unauthenticated workspace also
returned the expected 401 for the private export-summary request and emitted
development-only image/LCP warnings. No provider request, paid generation,
wallet mutation, production environment change, push, deployment, indexation
request, or LinkedIn publication was performed.

## Final review correction evidence — 2026-08-08

The verified source commit for the final review corrections is
`075ea11a62be564d26d9ab1265db82505980eb6b`. This SHA is intentionally
recorded from the source commit before this evidence-only documentation commit.

The final review closed six launch-quality gaps without changing the approved
price, scores, publication state, model routes, Seedance 2.0 SEO, or paid
generation policy:

- I2V now sends the original user prompt with exact `first_frame` and optional
  `last_frame` roles; reference-to-video keeps `reference_image` roles.
- Runtime expansion preserves the authored Seedance 2.5 labels and the
  30-image, 10-video, and 10-audio counts.
- Homepage proof remains truthfully attributed to Seedance 2.0 and cannot
  relabel a family-level Seedance 2.5 asset as 2.0; the model catalogue links
  Seedance 2.5 to the established Seedance example family.
- Benchmark Lab separates the MaxVideoAI production route contract from the
  generic ModelArk task-mechanics link, with no provider or model identifier on
  the public surface.
- Seedance 2.5 audio references use an exact 15 MiB MP3/WAV contract in the
  selector, browser validation, upload API, and pre-billing generation path.
  Generation validates user-owned stored size, MIME, filename, and URL identity
  rather than trusting request-authored metadata; unknown metadata fails closed.
- Attachment derivation and trusted media validation now have one focused route
  helper, keeping `/api/generate` below its 700-line architecture contract.

### Final command evidence

- Focused provider/runtime/home/catalog/benchmark/media suite: PASS, 68/68.
- Focused Seedance 2.5 media-constraint suite: PASS, 4/4, including exact
  15 MiB acceptance, oversize rejection, MP3/WAV acceptance, M4A and missing
  extension rejection, generic-upload preservation, and stored-metadata checks.
- Generate route architecture contract: PASS, 9/9; route count 686 including
  the trailing-line contract, below the 700-line ceiling.
- `pnpm test:validate`: PASS, 2,492/2,492 tests and 0 failures.
- `pnpm --prefix frontend run lint`: PASS.
- `pnpm lint:exposure`: PASS.
- `pnpm --prefix frontend run i18n:check`: PASS; FR parity at 4,197 keys and
  ES parity at 4,191 keys.
- `pnpm --prefix frontend run seo:check`: PASS; canonical, llms, internal-link,
  and public-media-origin guards passed.
- `pnpm --prefix frontend exec tsc --noEmit --pretty false`: PASS.
- `pnpm model:registry:check`: PASS; 42 models, 2 tombstones, and current
  runtime, engine-catalog, and roster projections.
- `pnpm models:audit`: PASS with 0 critical findings and 9 non-blocking optional
  catalogue warnings.
- `pnpm pricing:baseline`: PASS; immutable 178-row baseline.
- `pnpm pricing:public-baseline`: PASS; current 504-row public projection.
- `pnpm pricing:audit`: PASS; 182/182 matches and 0 mismatches.
- `pnpm --prefix frontend run build`: PASS with Next.js 15.5.18, 729 static
  pages, integrated lint/type validation, build traces, and sitemap postbuild.
- `git diff --check`: PASS before the source commit and on this documentation
  update.

No provider call, paid generation, wallet or environment mutation, push,
deployment, Search Console request, or LinkedIn publication was performed in
this correction pass. The read-only production smoke in this handoff remains
required after the approved deployment.
