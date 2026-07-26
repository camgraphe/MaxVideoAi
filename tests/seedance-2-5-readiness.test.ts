import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
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
type ForbiddenIdentityExposure = {
  path: string;
  matches: Array<'path' | 'content'>;
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
} as const;
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

function toRepositoryPath(repositoryRoot: string, path: string): string {
  return relative(repositoryRoot, path).split(sep).join('/');
}

function listRepositoryCandidatePaths(repositoryRoot: string): string[] {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  )
    .split('\0')
    .filter(Boolean)
    .sort();
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

function findForbiddenSeedance25Exposures(
  repositoryRoot: string,
  allowedPaths: ReadonlySet<string> = allowedSeedance25Paths,
): ForbiddenIdentityExposure[] {
  return listRepositoryCandidatePaths(repositoryRoot).flatMap((candidatePath) => {
    if (allowedPaths.has(candidatePath)) return [];
    const matches: Array<'path' | 'content'> = [];
    if (forbiddenRuntimeIdentity.test(candidatePath)) matches.push('path');

    const absolutePath = join(repositoryRoot, candidatePath);
    if (existsSync(absolutePath) && lstatSync(absolutePath).isFile()) {
      const buffer = readFileSync(absolutePath);
      if (
        isTextLike(buffer) &&
        forbiddenRuntimeIdentity.test(buffer.toString('utf8'))
      ) {
        matches.push('content');
      }
    }

    return matches.length === 0
      ? []
      : [
          {
            path: toRepositoryPath(repositoryRoot, absolutePath),
            matches,
          },
        ];
  });
}

function readMarkdownSection(markdown: string, heading: string): string {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker.trim()}`);
  const bodyStart = start + marker.length;
  const nextHeading = markdown.indexOf('\n## ', bodyStart);
  return markdown
    .slice(bodyStart, nextHeading === -1 ? markdown.length : nextHeading)
    .trim();
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

  assert.equal(packet.startsWith('# Seedance 2.5 launch packet\n'), true);
  assert.deepEqual(
    Array.from(packet.matchAll(/^## (.+)$/gm), (match) => match[1]),
    [
      ...Object.keys(approvedLaunchPacketSections),
      'Verification commands',
    ],
  );
  for (const [heading, approvedSection] of Object.entries(
    approvedLaunchPacketSections,
  )) {
    assert.equal(
      readMarkdownSection(packet, heading),
      approvedSection,
      `${heading} must retain the approved launch-safety semantics`,
    );
  }
  assert.match(packet, /pnpm model:registry:check/);
  assert.doesNotMatch(packet, /26\s*%/);
  assert.doesNotMatch(
    packet,
    /(?:[$€£]\s*\d|\d+(?:[.,]\d+)?\s*(?:USD|EUR|GBP|%|credits?\s*(?:per|\/)))/i,
  );

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

test('Seedance 2.5 exposure scan catches path-only routes and provider or benchmark content', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'seedance-2-5-exposure-'));
  const writeFixture = (path: string, content: string | Uint8Array) => {
    const target = join(fixtureRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };

  try {
    writeFixture('.gitignore', 'frontend/.env.local\n');
    writeFixture(
      'data/benchmarks/engine-scores.v1.json',
      '{"engine":"seedance.2.5"}\n',
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
      'frontend/public/provider-cache.bin',
      Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from('seedance-2-5')]),
    );

    execFileSync('git', ['init', '-q'], { cwd: fixtureRoot, stdio: 'ignore' });
    execFileSync(
      'git',
      [
        'add',
        '--',
        '.gitignore',
        'data/benchmarks/engine-scores.v1.json',
        'docs/model-launch/seedance-2-5.md',
        'frontend/.env.local.example',
        'frontend/public/provider-cache.bin',
      ],
      { cwd: fixtureRoot, stdio: 'ignore' },
    );

    assert.deepEqual(
      findForbiddenSeedance25Exposures(
        fixtureRoot,
        new Set(['docs/model-launch/seedance-2-5.md']),
      ),
      [
        {
          path: 'data/benchmarks/engine-scores.v1.json',
          matches: ['content'],
        },
        {
          path: 'frontend/.env.local.example',
          matches: ['content'],
        },
        {
          path: 'frontend/app/models/seedance-2-5/page.tsx',
          matches: ['path'],
        },
      ],
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('Seedance 2.5 is absent from runtime and publication sources', () => {
  assert.deepEqual(findForbiddenSeedance25Exposures(root), []);
});
