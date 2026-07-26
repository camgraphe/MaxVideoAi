import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import test from 'node:test';

import {
  mergeEngineLocalizedContent,
  type EngineOverlay,
} from '../frontend/lib/models/i18n-normalization';

const root = process.cwd();
const overlayPaths = {
  en: join(root, 'docs/model-launch/seedance-2-5/en.overlay.json'),
  fr: join(root, 'docs/model-launch/seedance-2-5/fr.overlay.json'),
  es: join(root, 'docs/model-launch/seedance-2-5/es.overlay.json'),
} as const;
const launchPacketPath = join(root, 'docs/model-launch/seedance-2-5.md');
const engineStubPath = join(root, 'docs/model-launch/seedance-2-5.engine.stub.ts');
const forbiddenRuntimeIdentity = /seedance[-_. ]?2[-_. ]?5/i;
const allowedSeedance25Paths = new Set([
  'docs/model-launch/seedance-2-5.engine.stub.ts',
  'docs/model-launch/seedance-2-5.md',
  'docs/model-launch/seedance-2-5/en.overlay.json',
  'docs/model-launch/seedance-2-5/es.overlay.json',
  'docs/model-launch/seedance-2-5/fr.overlay.json',
  'docs/superpowers/plans/2026-07-25-seedance-2-5-byteplus-fail-closed.md',
  'docs/superpowers/plans/2026-07-25-seedance-2-5-hidden-launch-content.md',
  'docs/superpowers/plans/2026-07-25-seedance-2-5-reference-budget.md',
  'docs/superpowers/specs/2026-07-25-seedance-2-5-prelaunch-readiness-design.md',
  'tests/byteplus-seedance-profiles.test.ts',
  'tests/generate-byteplus-submission.test.ts',
  'tests/seedance-2-5-readiness.test.ts',
  'tests/seedance-2-pricing.test.ts',
]);
const approvedSeedance25GitlinkPaths = new Set<string>();
const exposureMatchOrder = [
  'path',
  'index_content',
  'index_symlink_target',
  'index_symlink_resolved_content',
  'worktree_redirect',
  'worktree_content',
  'worktree_symlink_target',
  'worktree_symlink_resolved_content',
  'gitlink',
] as const;
type ExposureMatch = (typeof exposureMatchOrder)[number];
type ForbiddenIdentityExposure = {
  path: string;
  matches: ExposureMatch[];
};
type GitIndexEntry = {
  mode: string;
  objectId: string;
  stage: number;
  path: string;
};
type GitRepositorySnapshot = {
  canonicalRepositoryRoot: string;
  candidatePaths: string[];
  candidatePathSet: ReadonlySet<string>;
  indexEntriesByPath: Map<string, GitIndexEntry[]>;
  indexBlobs: Map<string, Buffer>;
};
const approvedLaunchPacketSections = {
  'Current state': `- Prepared on: 2026-07-26
- Future source template: \`seedance-2-0\`
- Canonical candidate ID: \`seedance-2-5\`
- Family: \`seedance\`
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

The localized files in \`docs/model-launch/seedance-2-5/\` are unpublished
launch drafts. They are not a live generation offer. Move them to
\`content/models/{en,fr,es}/\` only when a factual engine and canonical registry
entry exist.`,
  'Dreamina-announced product-surface claims': `Official source: https://dreamina.capcut.com/seedance/seedance-2-5

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
API availability.`,
  'BytePlus prelaunch marketing evidence': `Official sales page: https://www.byteplus.com/en/contact-us/ai-seedance2-5-official

Checked on 2026-07-26, BytePlus also labels Seedance 2.5 as coming soon and
mentions 30-second generation, up to 50 references, and editable output. This
is a sales/contact page, not ModelArk API documentation. Its statements are
prelaunch marketing evidence only: they do not establish a provider model ID,
payload contract, executable limits, availability, entitlement, regions, or
unit pricing.

Any percentage discount shown on the sales page is promotional marketing
evidence only. It must not be used as MaxVideoAI customer pricing or BytePlus
ModelArk unit pricing.`,
  'Official BytePlus API evidence required': `No public BytePlus ModelArk Seedance 2.5 API contract was located as of 2026-07-26; access may still be private or sales-gated.

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
entry, registry entry, customer price, or generation CTA.`,
  'Legal and commercial clearance required': `Before any public launch, obtain written confirmation that MaxVideoAI may
integrate and redistribute the service and use the relevant BytePlus and
Seedance marks. Have counsel review both official documents:

- https://docs.byteplus.com/en/docs/modelark/Specific_Terms_for_the_BytePlus_Video_Generation_Model_Services
- https://docs.byteplus.com/en/docs/ModelArk/2353368

Treat this as a publication gate, independent of technical readiness. Private
or sales-gated access does not satisfy it.`,
  'Promotion state machine': `### 1. Hidden execution

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

- Publish the model route with \`indexable=false\`.
- Keep sitemap, pricing, comparison, examples, and broad app discovery disabled
  until each prerequisite passes.
- Use limited-availability messaging only when generation access is
  intentionally restricted.

### 4. Public indexed

- Enable app, pricing, sitemap, examples, comparisons, and indexation
  independently in the canonical registry.
- Keep Seedance 2.0 available unless a separate retirement decision is approved.`,
  'Codex production handoff': `Treat this packet as the single operational entry point for a future Seedance
2.5 launch. On a request such as “put Seedance 2.5 in production”, Codex must
first read the current \`AGENTS.md\`, \`docs/engineering/model-registry.md\`,
\`docs/engineering/pricing-engine.md\`,
\`docs/deployment/github-vercel.md\`, and this packet. It must re-check the
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
- [x] EN, FR, and ES launch overlays are stored outside runtime content.
- [x] The readiness contract proves that Seedance 2.5 is absent from runtime
  and public discovery while API facts remain unconfirmed.

These items are reusable foundation, not launch toggles. Do not recreate or
bypass them in the factual integration batch.

### Hidden artefact inventory

- \`docs/model-launch/seedance-2-5/{en,fr,es}.overlay.json\` contains unpublished
  copy. Rewrite it from confirmed facts before moving it to
  \`content/models/{en,fr,es}/seedance-2-5.json\`.
- \`docs/model-launch/seedance-2-5.engine.stub.ts\` is an evidence gate only. It
  stays under \`docs/\` and must never be imported by runtime code.
- \`tests/seedance-2-5-readiness.test.ts\` deliberately blocks runtime and public
  exposure today. During hidden execution, replace only its global-absence
  contract with assertions for a disabled, admin-only, fully unpublished
  registry entry. Preserve the evidence, content-safety, and exposure checks.
- The Seedance 2.5 specifications and implementation plans under
  \`docs/superpowers/\` are historical design evidence. They stay documentation
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
  \`frontend/src/config/fal-engines/\` and register it through the current raw
  engine registry. Use canonical ID \`seedance-2-5\`; keep provider IDs out of
  canonical aliases.
- [ ] Add a dedicated Seedance 2.5 BytePlus profile through the current owners
  under \`frontend/src/server/video-providers/\`. Give it explicit capability,
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
- [ ] Add factual vendor cost through \`frontend/server/byteplus-accounting.ts\`
  and the canonical pricing owners described by
  \`docs/engineering/pricing-engine.md\`. Review billing and public quotes
  independently.
- [ ] Add \`seedance-2-5\` to \`frontend/config/model-registry.json\` with every
  publication surface false, no speculative aliases, and no replacement.
- [ ] Rewrite the three overlays from confirmed facts, move them into
  \`content/models/{en,fr,es}/seedance-2-5.json\`, and review every localized
  decision, prompting, example, CTA, href, and claim.
- [ ] Convert the readiness global-absence assertion into a hidden-stage
  contract: the engine and registry entry may exist, but app discovery, model
  publication, pricing, examples, comparisons, sitemap, and indexation must
  remain false.
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

### Phase 3 execution checklist — public noindex

- [ ] Obtain explicit approval to open the model route.
- [ ] Set only \`publication.model.published=true\` and keep
  \`publication.model.indexable=false\`. Keep app discovery, public pricing,
  examples, comparisons, and sitemap publication disabled unless separately
  approved for this phase.
- [ ] Replace all “coming soon” and unavailable copy with reviewed factual
  availability language appropriate to the actual access level.
- [ ] Verify EN, FR, and ES canonical URLs, hreflang, robots \`noindex\`, JSON-LD,
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
  \`frontend/config/model-registry.json\`, regenerate every projection, and
  review the generated diff.
- [ ] Review final customer prices, estimator output, pricing page, model-page
  offers, structured data, wallet preflight, receipts, and refunds.
- [ ] Review examples membership, comparison opponents, family ranking, app
  discovery rank, localized navigation, sitemap membership, canonical URLs,
  hreflang, robots, and JSON-LD.
- [ ] Keep Seedance 2.0 published unless a separate retirement plan is approved.
- [ ] Deploy through the normal reviewed \`main\` branch flow and complete the
  production smoke checks before announcing availability.

### Production smoke checks

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

The launch is complete only when the evidence record is current, legal and
commercial gates are linked, canary evidence is retained, intended registry
surfaces are explicit, every verification command below passes, production
smoke checks pass, monitoring is healthy, and the rollback state is recorded.
Update “Current state” and this checklist in the same reviewed launch change.

### Instruction to give Codex

\`\`\`text
Read AGENTS.md, docs/engineering/model-registry.md,
docs/engineering/pricing-engine.md, docs/deployment/github-vercel.md,
and docs/model-launch/seedance-2-5.md. Treat the launch packet as the
authoritative runbook. Re-check official BytePlus API evidence and current
repository owners, then execute only the next approved promotion phase. Do not
infer missing provider facts, reuse Seedance 2.0 pricing, or enable unapproved
publication surfaces. Return the verification evidence and rollback state
before asking to advance.
\`\`\``,
  'Verification commands': `\`\`\`bash
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
\`\`\``,
} as const;
const approvedLaunchPacket = `# Seedance 2.5 launch packet

${Object.entries(approvedLaunchPacketSections)
  .map(([heading, body]) => `## ${heading}\n\n${body}`)
  .join('\n\n')}
`;
const requiredOfficialApiFacts = [
  'canonical BytePlus model ID and supported regions',
  'entitlement and release status',
  'supported input modes and payload roles',
  'duration, resolution, aspect-ratio, FPS, and audio options',
  'combined and per-media reference limits, formats, sizes, and durations',
  'prompt and reference anchor syntax plus ordering rules',
  'editing and extension semantics',
  'task status, webhook, output, expiration, and usage schemas',
  'moderation and provider error codes',
  'concurrency, RPM, quotas, and service tiers',
  'vendor pricing units, failure charging, and refund behavior',
  'written integration, redistribution, and trademark clearance',
] as const;
const promotionOrder = [
  'hidden_execution',
  'admin_canary',
  'public_noindex',
  'public_indexed',
] as const;
const approvedReaderCopy = {
  en: {
    seo: {
      title: 'Seedance 2.5: Dreamina-Announced Features and API Status',
      description:
        'Track Dreamina-announced product information and BytePlus API status for Seedance 2.5. Generation is not yet available on MaxVideoAI.',
    },
    overview:
      'Dreamina labels Seedance 2.5 as coming soon and describes 4K output, standard videos up to 30 seconds, a beta long-video mode up to 180 seconds, as many as 50 multimodal inputs, reference-to-video control, and precise editing of selected video regions on its product surface. Seedance 2.5 is not yet available for generation on MaxVideoAI.',
    pricingNotes:
      'MaxVideoAI API access, customer pricing, BytePlus pricing, technical API limits, and launch timing are unconfirmed. No Seedance 2.0 rate is being reused for Seedance 2.5, and no launch is committed.',
    hero: {
      title: 'Seedance 2.5 — launch status and Dreamina-announced information',
      intro:
        'Dreamina currently labels Seedance 2.5 as coming soon. The capabilities summarized here are Dreamina product-surface statements, not a confirmed BytePlus ModelArk API contract. Seedance 2.5 is not yet available for generation on MaxVideoAI.',
      badge: 'Coming soon on Dreamina · BytePlus API unconfirmed',
      ctaPrimary: {
        label: 'Explore Seedance 2.0',
        href: '/models/seedance-2-0',
      },
      secondaryLinks: [
        {
          label: 'View examples from available Seedance models',
          href: '/examples/seedance',
        },
      ],
    },
    faqs: [
      {
        q: 'Can I generate with Seedance 2.5 on MaxVideoAI now?',
        a: 'No. Seedance 2.5 is not yet available for generation on MaxVideoAI. No launch is committed. Any future MaxVideoAI integration would depend on official BytePlus API evidence, successful billing, reliability, safety, and output validation, and the required legal and commercial clearances.',
      },
      {
        q: 'Are Dreamina’s announced features confirmed for the BytePlus API?',
        a: 'No. Dreamina product-surface statements do not establish BytePlus API modes, limits, payloads, regions, pricing, or release timing.',
      },
    ],
  },
  fr: {
    seo: {
      title: 'Seedance 2.5 : annonces Dreamina et statut de l’API',
      description:
        'Suivez les informations produit annoncées par Dreamina et le statut de l’API BytePlus pour Seedance 2.5. La génération n’est pas encore disponible sur MaxVideoAI.',
    },
    overview:
      'Dreamina présente Seedance 2.5 comme un modèle à venir et décrit, sur son propre produit, une sortie 4K, des vidéos standard allant jusqu’à 30 secondes, un mode vidéo longue durée en bêta allant jusqu’à 180 secondes, jusqu’à 50 entrées multimodales, un contrôle par référence vidéo et la retouche précise de zones vidéo spécifiques. Seedance 2.5 n’est pas encore disponible pour générer des vidéos sur MaxVideoAI.',
    pricingNotes:
      'L’accès via l’API MaxVideoAI, le prix client, le tarif BytePlus, les limites techniques de l’API et le calendrier de lancement ne sont pas confirmés. Aucun tarif Seedance 2.0 n’est réutilisé pour Seedance 2.5 et aucun lancement n’est confirmé.',
    hero: {
      title: 'Seedance 2.5 — état du lancement et annonces Dreamina',
      intro:
        'Dreamina présente actuellement Seedance 2.5 comme un modèle à venir. Les capacités résumées ici sont des déclarations concernant le produit Dreamina, pas un contrat API BytePlus ModelArk confirmé. Seedance 2.5 n’est pas encore disponible pour générer des vidéos sur MaxVideoAI.',
      badge: 'Bientôt sur Dreamina · API BytePlus non confirmée',
      ctaPrimary: {
        label: 'Découvrir Seedance 2.0',
        href: '/fr/modeles/seedance-2-0',
      },
      secondaryLinks: [
        {
          label: 'Voir des exemples de modèles Seedance disponibles',
          href: '/fr/galerie/seedance',
        },
      ],
    },
    faqs: [
      {
        q: 'Puis-je générer avec Seedance 2.5 sur MaxVideoAI maintenant ?',
        a: 'Non. Seedance 2.5 n’est pas encore disponible pour générer des vidéos sur MaxVideoAI. Aucun lancement n’est confirmé. Toute future intégration à MaxVideoAI dépendrait de preuves officielles concernant l’API BytePlus, de la validation de la facturation, de la fiabilité, de la sécurité et des résultats générés, ainsi que des autorisations juridiques et commerciales requises.',
      },
      {
        q: 'Les fonctions annoncées par Dreamina sont-elles confirmées pour l’API BytePlus ?',
        a: 'Non. Les déclarations concernant le produit Dreamina ne confirment ni les modes, ni les limites, ni les formats de requête, ni les régions, ni les tarifs, ni le calendrier de l’API BytePlus.',
      },
    ],
  },
  es: {
    seo: {
      title: 'Seedance 2.5: anuncios de Dreamina y estado de la API',
      description:
        'Consulta la información de producto anunciada por Dreamina y el estado de la API de BytePlus para Seedance 2.5. La generación todavía no está disponible en MaxVideoAI.',
    },
    overview:
      'Dreamina presenta Seedance 2.5 como un próximo lanzamiento y describe, en su propio producto, salida 4K, vídeos estándar de hasta 30 segundos, un modo de vídeo largo en beta de hasta 180 segundos, hasta 50 entradas multimodales, control mediante vídeo de referencia y edición precisa de regiones concretas del vídeo. Seedance 2.5 todavía no está disponible para generar vídeos en MaxVideoAI.',
    pricingNotes:
      'El acceso mediante la API de MaxVideoAI, el precio para clientes, el precio de BytePlus, los límites técnicos de la API y el calendario de lanzamiento no están confirmados. No se está aplicando ninguna tarifa de Seedance 2.0 a Seedance 2.5 y no hay ningún lanzamiento confirmado.',
    hero: {
      title: 'Seedance 2.5 — estado del lanzamiento y anuncios de Dreamina',
      intro:
        'Dreamina presenta actualmente Seedance 2.5 como un próximo lanzamiento. Las capacidades resumidas aquí son declaraciones sobre el producto Dreamina, no un contrato confirmado de la API BytePlus ModelArk. Seedance 2.5 todavía no está disponible para generar vídeos en MaxVideoAI.',
      badge: 'Próximamente en Dreamina · API de BytePlus sin confirmar',
      ctaPrimary: {
        label: 'Explorar Seedance 2.0',
        href: '/es/modelos/seedance-2-0',
      },
      secondaryLinks: [
        {
          label: 'Ver ejemplos de modelos Seedance disponibles',
          href: '/es/galeria/seedance',
        },
      ],
    },
    faqs: [
      {
        q: '¿Puedo generar con Seedance 2.5 en MaxVideoAI ahora?',
        a: 'No. Seedance 2.5 todavía no está disponible para generar vídeos en MaxVideoAI. No hay ningún lanzamiento confirmado. Cualquier futura integración en MaxVideoAI dependería de documentación oficial sobre la API de BytePlus, de la validación de la facturación, la fiabilidad, la seguridad y los resultados generados, y de las autorizaciones legales y comerciales necesarias.',
      },
      {
        q: '¿Las funciones anunciadas por Dreamina están confirmadas para la API de BytePlus?',
        a: 'No. Las declaraciones sobre el producto Dreamina no confirman los modos, límites, formatos de las solicitudes, regiones, precios ni fechas de la API de BytePlus.',
      },
    ],
  },
} as const;

const unavailableCopy = {
  en: 'Seedance 2.5 is not yet available for generation on MaxVideoAI.',
  fr:
    'Seedance 2.5 n’est pas encore disponible pour générer des vidéos sur MaxVideoAI.',
  es: 'Seedance 2.5 todavía no está disponible para generar vídeos en MaxVideoAI.',
} as const;

function splitNulList(value: string): string[] {
  return value.split('\0').filter(Boolean);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readGitIndexEntries(repositoryRoot: string): GitIndexEntry[] {
  const records = splitNulList(
    execFileSync('git', ['ls-files', '--stage', '-z'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }),
  );
  return records
    .map((record) => {
      const separatorIndex = record.indexOf('\t');
      assert.notEqual(separatorIndex, -1, 'git index record must contain a tab');
      const header = record.slice(0, separatorIndex);
      const path = record.slice(separatorIndex + 1);
      const [mode, objectId, stageValue, ...extra] = header.split(' ');
      assert.equal(extra.length, 0, `unexpected git index header for ${path}`);
      assert.equal(Boolean(mode && objectId && stageValue), true, path);
      const stage = Number(stageValue);
      assert.equal(Number.isInteger(stage), true, `invalid git stage for ${path}`);
      return {
        mode,
        objectId,
        stage,
        path,
      };
    })
    .sort((left, right) => {
      return (
        compareStrings(left.path, right.path) ||
        left.stage - right.stage ||
        compareStrings(left.mode, right.mode) ||
        compareStrings(left.objectId, right.objectId)
      );
    });
}

function readGitIndexBlobs(
  repositoryRoot: string,
  entries: GitIndexEntry[],
): Map<string, Buffer> {
  const objectIds = Array.from(
    new Set(
      entries
        .filter((entry) => entry.mode.startsWith('100') || entry.mode === '120000')
        .map((entry) => entry.objectId),
    ),
  ).sort();
  if (objectIds.length === 0) return new Map();

  const output = execFileSync('git', ['cat-file', '--batch'], {
    cwd: repositoryRoot,
    input: `${objectIds.join('\n')}\n`,
    maxBuffer: 256 * 1024 * 1024,
  });
  const blobs = new Map<string, Buffer>();
  let offset = 0;

  for (const objectId of objectIds) {
    const headerEnd = output.indexOf(10, offset);
    assert.notEqual(headerEnd, -1, `missing git blob header for ${objectId}`);
    const header = output.subarray(offset, headerEnd).toString('ascii');
    const [returnedId, objectType, sizeValue, ...extra] = header.split(' ');
    assert.equal(extra.length, 0, `unexpected git blob header for ${objectId}`);
    assert.equal(returnedId, objectId);
    assert.equal(objectType, 'blob', objectId);
    const size = Number(sizeValue);
    assert.equal(Number.isSafeInteger(size) && size >= 0, true, objectId);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    assert.equal(contentEnd < output.length, true, objectId);
    assert.equal(output[contentEnd], 10, objectId);
    blobs.set(objectId, Buffer.from(output.subarray(contentStart, contentEnd)));
    offset = contentEnd + 1;
  }
  assert.equal(offset, output.length, 'unexpected trailing git cat-file output');
  return blobs;
}

function readGitRepositorySnapshot(
  repositoryRoot: string,
): GitRepositorySnapshot {
  const indexEntries = readGitIndexEntries(repositoryRoot);
  const indexEntriesByPath = new Map<string, GitIndexEntry[]>();
  for (const entry of indexEntries) {
    const entries = indexEntriesByPath.get(entry.path) ?? [];
    entries.push(entry);
    indexEntriesByPath.set(entry.path, entries);
  }
  const untrackedPaths = splitNulList(
    execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard', '-z'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      },
    ),
  );
  const candidatePaths = Array.from(
    new Set([...indexEntriesByPath.keys(), ...untrackedPaths]),
  ).sort();
  return {
    canonicalRepositoryRoot: realpathSync(repositoryRoot),
    candidatePaths,
    candidatePathSet: new Set(candidatePaths),
    indexEntriesByPath,
    indexBlobs: readGitIndexBlobs(repositoryRoot, indexEntries),
  };
}

function repositoryPathInside(
  repositoryRoot: string,
  absolutePath: string,
): string | null {
  const repositoryPath = relative(repositoryRoot, absolutePath);
  if (
    repositoryPath === '' ||
    repositoryPath === '..' ||
    repositoryPath.startsWith(`..${sep}`) ||
    isAbsolute(repositoryPath)
  ) {
    return null;
  }
  return repositoryPath.split(sep).join('/');
}

function resolveIndexSymlinkTarget(
  repositoryRoot: string,
  linkPath: string,
  target: string,
): string | null {
  return repositoryPathInside(
    repositoryRoot,
    resolve(dirname(join(repositoryRoot, linkPath)), target),
  );
}

function isTextLike(buffer: Buffer): boolean {
  if (buffer.length === 0) return true;
  if (buffer.includes(0)) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  let controlBytes = 0;
  for (const byte of sample) {
    const isTextWhitespace = byte === 9 || byte === 10 || byte === 13;
    if ((byte < 32 && !isTextWhitespace) || byte === 127) controlBytes += 1;
  }
  return controlBytes / sample.length < 0.03;
}

function bufferHasForbiddenIdentity(buffer: Buffer): boolean {
  return (
    isTextLike(buffer) &&
    forbiddenRuntimeIdentity.test(buffer.toString('utf8'))
  );
}

function indexPathHasForbiddenIdentity(
  repositoryRoot: string,
  repositoryPath: string,
  snapshot: GitRepositorySnapshot,
  visitedPaths: ReadonlySet<string> = new Set(),
): boolean {
  if (visitedPaths.has(repositoryPath)) return false;
  const nextVisitedPaths = new Set(visitedPaths);
  nextVisitedPaths.add(repositoryPath);

  for (const entry of snapshot.indexEntriesByPath.get(repositoryPath) ?? []) {
    if (entry.mode.startsWith('100')) {
      const blob = snapshot.indexBlobs.get(entry.objectId);
      assert.equal(Boolean(blob), true, entry.path);
      if (bufferHasForbiddenIdentity(blob as Buffer)) return true;
      continue;
    }
    if (entry.mode === '120000') {
      const blob = snapshot.indexBlobs.get(entry.objectId);
      assert.equal(Boolean(blob), true, entry.path);
      const target = (blob as Buffer).toString('utf8');
      if (forbiddenRuntimeIdentity.test(target)) return true;
      const resolvedPath = resolveIndexSymlinkTarget(
        repositoryRoot,
        entry.path,
        target,
      );
      if (
        resolvedPath &&
        indexPathHasForbiddenIdentity(
          repositoryRoot,
          resolvedPath,
          snapshot,
          nextVisitedPaths,
        )
      ) {
        return true;
      }
      continue;
    }
    if (entry.mode === '160000') return true;
    assert.fail(`unsupported git index mode ${entry.mode} at ${entry.path}`);
  }
  return false;
}

function tryLstat(path: string): ReturnType<typeof lstatSync> | null {
  try {
    return lstatSync(path);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
}

type WorktreeCandidateAccess =
  | { kind: 'missing' }
  | { kind: 'redirect' }
  | { kind: 'direct'; absolutePath: string }
  | {
      kind: 'approved_redirect';
      absolutePath: string;
      resolvedPath: string;
    };

function resolveWorktreeCandidateAccess(
  repositoryRoot: string,
  candidatePath: string,
  snapshot: GitRepositorySnapshot,
): WorktreeCandidateAccess {
  const absolutePath = join(repositoryRoot, candidatePath);
  let canonicalParent: string;
  try {
    canonicalParent = realpathSync(dirname(absolutePath));
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return { kind: 'missing' };
    }
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ELOOP'
    ) {
      return { kind: 'redirect' };
    }
    throw error;
  }

  const expectedCanonicalParent = resolve(
    snapshot.canonicalRepositoryRoot,
    dirname(candidatePath),
  );
  if (canonicalParent === expectedCanonicalParent) {
    return { kind: 'direct', absolutePath };
  }

  let resolvedPath: string;
  try {
    resolvedPath = realpathSync(join(canonicalParent, basename(candidatePath)));
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      ['ENOENT', 'ELOOP'].includes((error as NodeJS.ErrnoException).code ?? '')
    ) {
      return { kind: 'redirect' };
    }
    throw error;
  }
  const resolvedRepositoryPath = repositoryPathInside(
    snapshot.canonicalRepositoryRoot,
    resolvedPath,
  );
  if (
    !resolvedRepositoryPath ||
    !snapshot.candidatePathSet.has(resolvedRepositoryPath)
  ) {
    return { kind: 'redirect' };
  }
  return {
    kind: 'approved_redirect',
    absolutePath,
    resolvedPath,
  };
}

function addWorktreeMatches(
  repositoryRoot: string,
  candidatePath: string,
  snapshot: GitRepositorySnapshot,
  matches: Set<ExposureMatch>,
) {
  const access = resolveWorktreeCandidateAccess(
    repositoryRoot,
    candidatePath,
    snapshot,
  );
  if (access.kind === 'missing') return;
  if (access.kind === 'redirect') {
    matches.add('worktree_redirect');
    return;
  }
  const { absolutePath } = access;
  const stats = tryLstat(absolutePath);
  if (!stats) return;

  if (stats.isFile()) {
    let resolvedPath: string;
    if (access.kind === 'approved_redirect') {
      resolvedPath = access.resolvedPath;
    } else {
      try {
        resolvedPath = realpathSync(absolutePath);
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          ['ENOENT', 'ELOOP'].includes(
            (error as NodeJS.ErrnoException).code ?? '',
          )
        ) {
          return;
        }
        throw error;
      }
      const resolvedRepositoryPath = repositoryPathInside(
        snapshot.canonicalRepositoryRoot,
        resolvedPath,
      );
      if (
        !resolvedRepositoryPath ||
        !snapshot.candidatePathSet.has(resolvedRepositoryPath)
      ) {
        matches.add('worktree_redirect');
        return;
      }
    }
    if (bufferHasForbiddenIdentity(readFileSync(resolvedPath))) {
      matches.add('worktree_content');
    }
    return;
  }
  if (!stats.isSymbolicLink()) return;

  const target = readlinkSync(absolutePath);
  if (forbiddenRuntimeIdentity.test(target)) {
    matches.add('worktree_symlink_target');
  }

  let resolvedTarget: string;
  try {
    resolvedTarget = realpathSync(absolutePath);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      ['ENOENT', 'ELOOP'].includes((error as NodeJS.ErrnoException).code ?? '')
    ) {
      return;
    }
    throw error;
  }
  const resolvedRepositoryPath = repositoryPathInside(
    snapshot.canonicalRepositoryRoot,
    resolvedTarget,
  );
  if (
    !resolvedRepositoryPath ||
    !snapshot.candidatePathSet.has(resolvedRepositoryPath)
  ) {
    return;
  }
  const resolvedStats = tryLstat(resolvedTarget);
  if (
    resolvedStats?.isFile() &&
    bufferHasForbiddenIdentity(readFileSync(resolvedTarget))
  ) {
    matches.add('worktree_symlink_resolved_content');
  }
}

function findForbiddenSeedance25Exposures(
  repositoryRoot: string,
  allowedPaths: ReadonlySet<string> = allowedSeedance25Paths,
  approvedGitlinkPaths: ReadonlySet<string> = approvedSeedance25GitlinkPaths,
): ForbiddenIdentityExposure[] {
  const snapshot = readGitRepositorySnapshot(repositoryRoot);
  return snapshot.candidatePaths.flatMap((candidatePath) => {
    const indexEntries = snapshot.indexEntriesByPath.get(candidatePath) ?? [];
    const matches = new Set<ExposureMatch>();
    if (
      indexEntries.some((entry) => entry.mode === '160000') &&
      !approvedGitlinkPaths.has(candidatePath)
    ) {
      matches.add('gitlink');
    }
    if (allowedPaths.has(candidatePath)) {
      return matches.size === 0
        ? []
        : [{ path: candidatePath, matches: ['gitlink'] as ExposureMatch[] }];
    }
    if (forbiddenRuntimeIdentity.test(candidatePath)) matches.add('path');

    for (const entry of indexEntries) {
      if (entry.mode.startsWith('100')) {
        const blob = snapshot.indexBlobs.get(entry.objectId);
        assert.equal(Boolean(blob), true, entry.path);
        if (bufferHasForbiddenIdentity(blob as Buffer)) {
          matches.add('index_content');
        }
        continue;
      }
      if (entry.mode === '120000') {
        const blob = snapshot.indexBlobs.get(entry.objectId);
        assert.equal(Boolean(blob), true, entry.path);
        const target = (blob as Buffer).toString('utf8');
        if (forbiddenRuntimeIdentity.test(target)) {
          matches.add('index_symlink_target');
        }
        const resolvedPath = resolveIndexSymlinkTarget(
          repositoryRoot,
          entry.path,
          target,
        );
        if (
          resolvedPath &&
          indexPathHasForbiddenIdentity(repositoryRoot, resolvedPath, snapshot)
        ) {
          matches.add('index_symlink_resolved_content');
        }
        continue;
      }
      if (entry.mode !== '160000') {
        assert.fail(`unsupported git index mode ${entry.mode} at ${entry.path}`);
      }
    }

    addWorktreeMatches(repositoryRoot, candidatePath, snapshot, matches);
    const orderedMatches = exposureMatchOrder.filter((match) =>
      matches.has(match),
    );
    return orderedMatches.length === 0
      ? []
      : [
          {
            path: candidatePath,
            matches: orderedMatches,
          },
        ];
  });
}

function assertApprovedLaunchPacket(packet: string) {
  assert.equal(
    packet,
    approvedLaunchPacket,
    'packet must match the complete approved launch packet',
  );
  assert.doesNotMatch(packet, /26\s*%/);
  assert.doesNotMatch(
    packet,
    /(?:[$€£]\s*\d|\d+(?:[.,]\d+)?\s*(?:USD|EUR|GBP|%|credits?\s*(?:per|\/)))/i,
  );
}

function quotedArrayValues(source: string, property: string): string[] {
  const propertyStart = source.indexOf(`${property}: [`);
  assert.notEqual(propertyStart, -1, `missing ${property}`);
  const arrayStart = source.indexOf('[', propertyStart);
  const arrayEnd = source.indexOf(']', arrayStart);
  assert.notEqual(arrayEnd, -1, `unterminated ${property}`);
  return Array.from(
    source.slice(arrayStart, arrayEnd).matchAll(/'([^']+)'/g),
    (match) => match[1],
  );
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  assert.equal(
    Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    true,
    `${path} must be an object`,
  );
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), path);
}

function assertString(value: unknown, path: string) {
  assert.equal(typeof value, 'string', `${path} must be a string`);
  assert.notEqual((value as string).trim(), '', `${path} must not be empty`);
}

function parseLaunchOverlay(path: string): EngineOverlay {
  const overlay = asRecord(JSON.parse(readFileSync(path, 'utf8')), path);
  assertExactKeys(
    overlay,
    [
      'marketingName',
      'versionLabel',
      'seo',
      'overview',
      'pricingNotes',
      'hero',
      'faqs',
      'custom',
    ],
    `${path} top-level keys`,
  );
  ['marketingName', 'versionLabel', 'overview', 'pricingNotes'].forEach((key) =>
    assertString(overlay[key], `${path}.${key}`),
  );

  const seo = asRecord(overlay.seo, `${path}.seo`);
  assertExactKeys(seo, ['title', 'description'], `${path}.seo keys`);
  assertString(seo.title, `${path}.seo.title`);
  assertString(seo.description, `${path}.seo.description`);

  const hero = asRecord(overlay.hero, `${path}.hero`);
  assertExactKeys(
    hero,
    ['title', 'intro', 'badge', 'ctaPrimary', 'secondaryLinks'],
    `${path}.hero keys`,
  );
  ['title', 'intro', 'badge'].forEach((key) =>
    assertString(hero[key], `${path}.hero.${key}`),
  );
  const primary = asRecord(hero.ctaPrimary, `${path}.hero.ctaPrimary`);
  assertExactKeys(primary, ['label', 'href'], `${path}.hero.ctaPrimary keys`);
  const secondaryLinks = hero.secondaryLinks;
  assert.equal(Array.isArray(secondaryLinks), true);
  assert.equal((secondaryLinks as unknown[]).length, 1);
  [
    primary,
    asRecord((secondaryLinks as unknown[])[0], `${path}.hero.secondaryLinks[0]`),
  ].forEach((link, index) => {
    assertExactKeys(link, ['label', 'href'], `${path}.hero link ${index}`);
    assertString(link.label, `${path}.hero link ${index}.label`);
    assertString(link.href, `${path}.hero link ${index}.href`);
  });

  assert.equal(Array.isArray(overlay.faqs), true);
  assert.equal((overlay.faqs as unknown[]).length, 2, `${path}.faqs length`);
  (overlay.faqs as unknown[]).forEach((entry, index) => {
    const faq = asRecord(entry, `${path}.faqs[${index}]`);
    assertExactKeys(faq, ['q', 'a'], `${path}.faqs[${index}] keys`);
    assertString(faq.q, `${path}.faqs[${index}].q`);
    assertString(faq.a, `${path}.faqs[${index}].a`);
  });

  const custom = asRecord(overlay.custom, `${path}.custom`);
  assertExactKeys(custom, ['prelaunch'], `${path}.custom keys`);
  const prelaunch = asRecord(custom.prelaunch, `${path}.custom.prelaunch`);
  assertExactKeys(
    prelaunch,
    [
      'dreaminaLabel',
      'checkedAt',
      'apiAvailability',
      'pricingAvailability',
      'productSurface',
      'sourceUrl',
      'announcedProductClaims',
    ],
    `${path}.custom.prelaunch keys`,
  );
  [
    'dreaminaLabel',
    'checkedAt',
    'apiAvailability',
    'pricingAvailability',
    'productSurface',
    'sourceUrl',
  ].forEach((key) => assertString(prelaunch[key], `${path}.custom.prelaunch.${key}`));
  assert.equal(Array.isArray(prelaunch.announcedProductClaims), true);
  (prelaunch.announcedProductClaims as unknown[]).forEach((claim, index) =>
    assertString(claim, `${path}.custom.prelaunch.announcedProductClaims[${index}]`),
  );

  return overlay as unknown as EngineOverlay;
}

test('Seedance 2.5 launch overlays are safe and structurally canonical in EN, FR, and ES', () => {
  for (const [locale, path] of Object.entries(overlayPaths)) {
    assert.equal(existsSync(path), true, `${locale} launch overlay is required`);
    const overlay = parseLaunchOverlay(path);
    const content = mergeEngineLocalizedContent({}, overlay);
    const serialized = JSON.stringify(overlay);
    const readerCopy = JSON.stringify({
      seo: overlay.seo,
      overview: overlay.overview,
      pricingNotes: overlay.pricingNotes,
      hero: overlay.hero,
      faqs: overlay.faqs,
    });
    const approvedCopy =
      approvedReaderCopy[locale as keyof typeof approvedReaderCopy];
    const unavailable = unavailableCopy[locale as keyof typeof unavailableCopy];
    const prelaunch = content.custom?.prelaunch as
      | {
          dreaminaLabel?: string;
          checkedAt?: string;
          apiAvailability?: string;
          pricingAvailability?: string;
          productSurface?: string;
          sourceUrl?: string;
          announcedProductClaims?: string[];
        }
      | undefined;

    assert.equal(content.marketingName, 'Seedance 2.5');
    assert.equal(content.versionLabel, '2.5');
    assert.equal(
      overlay.faqs?.[0]?.a,
      approvedCopy.faqs[0].a,
      `${locale} launch FAQ must use conditional non-commitment wording`,
    );
    assert.deepEqual(
      JSON.parse(readerCopy),
      approvedCopy,
      `${locale} reader copy must match the approved safe draft`,
    );
    assert.equal(content.overview, approvedCopy.overview);
    assert.equal(content.overview?.includes(unavailable), true);
    assert.equal(content.hero?.ctaPrimary?.href, approvedCopy.hero.ctaPrimary.href);
    assert.equal(
      content.hero?.secondaryLinks?.[0]?.href,
      approvedCopy.hero.secondaryLinks[0].href,
    );
    assert.equal(prelaunch?.dreaminaLabel, 'coming_soon');
    assert.equal(prelaunch?.checkedAt, '2026-07-26');
    assert.equal(prelaunch?.apiAvailability, 'unconfirmed');
    assert.equal(prelaunch?.pricingAvailability, 'unconfirmed');
    assert.equal(prelaunch?.productSurface, 'Dreamina');
    assert.equal(
      prelaunch?.sourceUrl,
      'https://dreamina.capcut.com/seedance/seedance-2-5',
    );
    assert.deepEqual(prelaunch?.announcedProductClaims, [
      '4k_output',
      'standard_mode_up_to_30_seconds',
      'beta_long_video_mode_up_to_180_seconds',
      'up_to_50_multimodal_inputs',
      'reference_to_video_control',
      'precise_local_video_editing',
    ]);
    assert.equal(Object.hasOwn(overlay, 'decision'), false);
    assert.equal(Object.hasOwn(overlay, 'prompting'), false);
    assert.equal(Object.hasOwn(overlay, 'examples'), false);
    assert.equal(Object.hasOwn(overlay, 'prompts'), false);
    assert.equal(Object.hasOwn(overlay, 'faqTitle'), false);
    assert.doesNotMatch(serialized, /dreamina-seedance[-_. ]?2[-_. ]?5/i);
    assert.doesNotMatch(serialized, /\/app\?engine=seedance[-_. ]?2[-_. ]?5/i);
  }
});

test('Seedance 2.5 launch documentation records evidence and publication gates', () => {
  assert.equal(existsSync(launchPacketPath), true, 'launch packet is required');
  assert.equal(existsSync(engineStubPath), true, 'engine evidence stub is required');
  const packet = readFileSync(launchPacketPath, 'utf8');
  const stub = readFileSync(engineStubPath, 'utf8');

  assertApprovedLaunchPacket(packet);

  assert.match(stub, /documentationOnly: true/);
  assert.match(stub, /runtimeEntryAllowed: false/);
  assert.deepEqual(
    quotedArrayValues(stub, 'requiredOfficialApiFacts'),
    requiredOfficialApiFacts,
  );
  assert.deepEqual(quotedArrayValues(stub, 'promotionOrder'), promotionOrder);
  assert.doesNotMatch(stub, /RawFalEngineEntry/);
  assert.doesNotMatch(stub, /dreamina-seedance[-_. ]?2[-_. ]?5/i);
  assert.doesNotMatch(stub, /unitPrice|priceUsd|costPer/i);
});

test('Seedance 2.5 packet contract rejects verification command omissions', () => {
  const packet = readFileSync(launchPacketPath, 'utf8');
  const incompletePacket = packet.replace('pnpm pricing:audit\n', '');
  assert.notEqual(incompletePacket, packet);
  assert.throws(
    () => assertApprovedLaunchPacket(incompletePacket),
    /complete approved launch packet/,
  );
});

test('Seedance 2.5 exposure scan reconciles index and worktree states', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'seedance-2-5-exposure-'));
  const externalFixtureRoot = mkdtempSync(
    join(tmpdir(), 'exposure-external-'),
  );
  const writeFixture = (path: string, content: string | Uint8Array) => {
    const target = join(fixtureRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };

  try {
    writeFixture(
      '.gitignore',
      'frontend/.env.local\nfrontend/ignored-parent-secrets/\n',
    );
    execFileSync('git', ['init', '-q'], { cwd: fixtureRoot, stdio: 'ignore' });
    execFileSync('git', ['add', '--', '.gitignore'], {
      cwd: fixtureRoot,
      stdio: 'ignore',
    });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Exposure Probe',
        '-c',
        'user.email=exposure-probe@example.invalid',
        'commit',
        '-qm',
        'fixture base',
      ],
      { cwd: fixtureRoot, stdio: 'ignore' },
    );

    writeFixture(
      'data/benchmarks/engine-scores.v1.json',
      '{"engine":"seedance.2.5"}\n',
    );
    writeFixture(
      'data/benchmarks/worktree-only.json',
      '{"engine":"safe-engine"}\n',
    );
    writeFixture(
      'docs/model-launch/seedance-2-5.md',
      '# Allowed Seedance 2.5 packet\n',
    );
    writeFixture(
      'frontend/.env.local.example',
      'BYTEPLUS_SEEDANCE_NEXT_MODEL=dreamina-seedance_2_5\n',
    );
    writeFixture(
      'frontend/.env.local',
      'IGNORED_LOCAL_PLACEHOLDER=seedance-2-5\n',
    );
    writeFixture(
      'frontend/app/models/seedance-2-5/page.tsx',
      "export { default } from '../generic/page';\n",
    );
    writeFixture(
      'frontend/config/deleted-provider.env',
      'BYTEPLUS_STAGED_MODEL=seedance-2-5\n',
    );
    writeFixture(
      'frontend/config/staged-provider.env',
      'BYTEPLUS_STAGED_MODEL=seedance-2-5\n',
    );
    writeFixture(
      'frontend/redirected-external/provider.env',
      'BYTEPLUS_STAGED_MODEL=safe-engine\n',
    );
    writeFixture(
      'frontend/redirected-internal/provider.env',
      'BYTEPLUS_STAGED_MODEL=safe-engine\n',
    );
    const ignoredSecretSymlinkPath = join(
      fixtureRoot,
      'frontend/config/local-secret-link.ts',
    );
    mkdirSync(dirname(ignoredSecretSymlinkPath), { recursive: true });
    symlinkSync('../.env.local', ignoredSecretSymlinkPath);
    const symlinkPath = join(fixtureRoot, 'frontend/config/upcoming-engine.ts');
    mkdirSync(dirname(symlinkPath), { recursive: true });
    symlinkSync('../../docs/model-launch/seedance-2-5.md', symlinkPath);
    writeFixture(
      'frontend/public/provider-cache.bin',
      Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from('seedance-2-5')]),
    );

    execFileSync(
      'git',
      [
        'add',
        '--',
        'data/benchmarks/engine-scores.v1.json',
        'data/benchmarks/worktree-only.json',
        'docs/model-launch/seedance-2-5.md',
        'frontend/.env.local.example',
        'frontend/config/deleted-provider.env',
        'frontend/config/local-secret-link.ts',
        'frontend/config/staged-provider.env',
        'frontend/config/upcoming-engine.ts',
        'frontend/public/provider-cache.bin',
        'frontend/redirected-external/provider.env',
        'frontend/redirected-internal/provider.env',
      ],
      { cwd: fixtureRoot, stdio: 'ignore' },
    );
    writeFixture(
      'data/benchmarks/worktree-only.json',
      '{"engine":"seedance-2-5"}\n',
    );
    writeFixture(
      'frontend/config/staged-provider.env',
      'BYTEPLUS_STAGED_MODEL=safe-engine\n',
    );
    rmSync(join(fixtureRoot, 'frontend/config/deleted-provider.env'));
    rmSync(join(fixtureRoot, 'frontend/redirected-external'), {
      recursive: true,
    });
    rmSync(join(fixtureRoot, 'frontend/redirected-internal'), {
      recursive: true,
    });
    writeFixture(
      'frontend/ignored-parent-secrets/provider.env',
      'INTERNAL_REDIRECT_SENTINEL=seedance-2-5\n',
    );
    writeFileSync(
      join(externalFixtureRoot, 'provider.env'),
      'EXTERNAL_REDIRECT_SENTINEL=seedance-2-5\n',
    );
    symlinkSync(
      externalFixtureRoot,
      join(fixtureRoot, 'frontend/redirected-external'),
    );
    symlinkSync(
      'ignored-parent-secrets',
      join(fixtureRoot, 'frontend/redirected-internal'),
    );
    const gitlinkObject = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fixtureRoot,
      encoding: 'utf8',
    }).trim();
    execFileSync(
      'git',
      [
        'update-index',
        '--add',
        '--cacheinfo',
        '160000',
        gitlinkObject,
        'frontend/providers/upcoming-provider',
      ],
      { cwd: fixtureRoot, stdio: 'ignore' },
    );

    const exposures = findForbiddenSeedance25Exposures(
      fixtureRoot,
      new Set(['docs/model-launch/seedance-2-5.md']),
    );
    assert.doesNotMatch(
      JSON.stringify(exposures),
      /INTERNAL_REDIRECT_SENTINEL|EXTERNAL_REDIRECT_SENTINEL/,
    );
    assert.deepEqual(
      exposures,
      [
        {
          path: 'data/benchmarks/engine-scores.v1.json',
          matches: ['index_content', 'worktree_content'],
        },
        {
          path: 'data/benchmarks/worktree-only.json',
          matches: ['worktree_content'],
        },
        {
          path: 'frontend/.env.local.example',
          matches: ['index_content', 'worktree_content'],
        },
        {
          path: 'frontend/app/models/seedance-2-5/page.tsx',
          matches: ['path'],
        },
        {
          path: 'frontend/config/deleted-provider.env',
          matches: ['index_content'],
        },
        {
          path: 'frontend/config/staged-provider.env',
          matches: ['index_content'],
        },
        {
          path: 'frontend/config/upcoming-engine.ts',
          matches: [
            'index_symlink_target',
            'index_symlink_resolved_content',
            'worktree_symlink_target',
            'worktree_symlink_resolved_content',
          ],
        },
        {
          path: 'frontend/providers/upcoming-provider',
          matches: ['gitlink'],
        },
        {
          path: 'frontend/redirected-external/provider.env',
          matches: ['worktree_redirect'],
        },
        {
          path: 'frontend/redirected-internal/provider.env',
          matches: ['worktree_redirect'],
        },
      ],
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
    rmSync(externalFixtureRoot, { recursive: true, force: true });
  }
});

test('Seedance 2.5 is absent from runtime and publication sources', () => {
  assert.deepEqual(findForbiddenSeedance25Exposures(root), []);
});
