# Seedance 2.5 Hidden Launch Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare canonical-shape EN, FR, and ES Seedance 2.5 launch drafts plus an API-evidence packet without creating an orphan model-content slug, public route, or executable engine.

**Architecture:** The existing model setup workflow runs in dry-run mode to verify the future scaffold and print an all-false registry skeleton without writing files. Localized overlays remain under `docs/model-launch/seedance-2-5/` until a factual engine and registry entry exist; a readiness contract proves that the drafts are safe while all runtime and publication surfaces remain absent.

**Tech Stack:** JSON model overlays, Markdown launch documentation, TypeScript documentation stub, Node test runner through `tsx`, canonical model-registry and model-audit tooling.

## Global Constraints

- Use the official Dreamina page as the canonical detailed product-claims source: `https://dreamina.capcut.com/seedance/seedance-2-5`.
- Record the narrower official BytePlus sales page, `https://www.byteplus.com/en/contact-us/ai-seedance2-5-official`, only as prelaunch marketing evidence; never treat it as an API contract, executable limit, or pricing source.
- Use “Dreamina states”, “Dreamina describes”, or “Dreamina-announced product-surface claims”; do not present the capabilities as independently verified or available through BytePlus.
- State in EN, FR, and ES that Seedance 2.5 is not yet available for generation on MaxVideoAI.
- State that MaxVideoAI API availability, customer pricing, BytePlus pricing, technical API limits, and timing are unconfirmed.
- State that no MaxVideoAI launch is committed; any future integration depends on official BytePlus API evidence, successful technical validation, and the required legal and commercial clearances.
- Keep drafts at `docs/model-launch/seedance-2-5/{en,fr,es}.overlay.json`; do not add an orphan slug under `content/models/`.
- Do not add a `seedance-2-5` runtime engine, canonical registry entry, generated projection, app CTA, public route, sitemap entry, pricing card, examples membership, or comparison.
- Do not invent or reserve a provider model ID, release date, rate, payload field, entitlement, region, quota, failure-charging rule, or API limit.
- Do not reuse or publish BytePlus's sales discount as MaxVideoAI or ModelArk unit pricing.
- Require written integration, redistribution, and trademark clearance before any public launch, with the BytePlus video-generation terms and Platform Customer Code reviewed by counsel.
- Do not copy Seedance 2.0 pricing, prompts, decision content, examples content, runtime specs, or generation CTA into the drafts.
- The registry skeleton printed by `model:setup --dry-run` is review output only and must not be inserted.
- The engine evidence stub is documentation-only and must not be imported by runtime code.
- Follow red-green-refactor, make one focused commit per implementation task, and keep unrelated worktree changes intact.

---

## File Map

- Create `tests/seedance-2-5-readiness.test.ts`: overlay safety, evidence, and no-runtime exposure contract.
- Create `docs/model-launch/seedance-2-5/en.overlay.json`: English Dreamina-attributed draft.
- Create `docs/model-launch/seedance-2-5/fr.overlay.json`: French Dreamina-attributed adaptation.
- Create `docs/model-launch/seedance-2-5/es.overlay.json`: Spanish Dreamina-attributed adaptation.
- Create `docs/model-launch/seedance-2-5.engine.stub.ts`: documentation-only official API evidence gate.
- Create `docs/model-launch/seedance-2-5.md`: staged launch packet and promotion gates.
- Verify, but do not modify, canonical registry, generated model projections, raw engines, provider mappings, accounting, and API routes.

### Task 1: Create safe localized launch drafts

**Files:**
- Create: `tests/seedance-2-5-readiness.test.ts`
- Create: `docs/model-launch/seedance-2-5/en.overlay.json`
- Create: `docs/model-launch/seedance-2-5/fr.overlay.json`
- Create: `docs/model-launch/seedance-2-5/es.overlay.json`

**Interfaces:**
- Consumes: `EngineOverlay` and `mergeEngineLocalizedContent` from `frontend/lib/models/i18n-normalization.ts`.
- Produces: three canonical-shape overlays that can later move to `content/models/{locale}/seedance-2-5.json` without copying runtime assumptions.

- [ ] **Step 1: Write the failing localized-overlay contract**

Create `tests/seedance-2-5-readiness.test.ts`:

The complete reader-facing SEO, overview, pricing, hero, and two-FAQ copy is
an approved prelaunch safety snapshot. Any copy change must be reviewed
deliberately instead of relying on broad pricing or timing regexes.

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

function asRecord(value: unknown, path: string): Record<string, unknown> {
  assert.equal(
    Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    true,
    `${path} must be an object`
  );
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string
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
    `${path} top-level keys`
  );
  ['marketingName', 'versionLabel', 'overview', 'pricingNotes'].forEach((key) =>
    assertString(overlay[key], `${path}.${key}`)
  );

  const seo = asRecord(overlay.seo, `${path}.seo`);
  assertExactKeys(seo, ['title', 'description'], `${path}.seo keys`);
  assertString(seo.title, `${path}.seo.title`);
  assertString(seo.description, `${path}.seo.description`);

  const hero = asRecord(overlay.hero, `${path}.hero`);
  assertExactKeys(
    hero,
    ['title', 'intro', 'badge', 'ctaPrimary', 'secondaryLinks'],
    `${path}.hero keys`
  );
  ['title', 'intro', 'badge'].forEach((key) =>
    assertString(hero[key], `${path}.hero.${key}`)
  );
  const primary = asRecord(hero.ctaPrimary, `${path}.hero.ctaPrimary`);
  assertExactKeys(primary, ['label', 'href'], `${path}.hero.ctaPrimary keys`);
  const secondaryLinks = hero.secondaryLinks;
  assert.equal(Array.isArray(secondaryLinks), true);
  assert.equal((secondaryLinks as unknown[]).length, 1);
  [primary, asRecord((secondaryLinks as unknown[])[0], `${path}.hero.secondaryLinks[0]`)]
    .forEach((link, index) => {
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
    `${path}.custom.prelaunch keys`
  );
  [
    'dreaminaLabel',
    'checkedAt',
    'apiAvailability',
    'pricingAvailability',
    'productSurface',
    'sourceUrl',
  ].forEach((key) =>
    assertString(prelaunch[key], `${path}.custom.prelaunch.${key}`)
  );
  assert.equal(Array.isArray(prelaunch.announcedProductClaims), true);
  (prelaunch.announcedProductClaims as unknown[]).forEach((claim, index) =>
    assertString(claim, `${path}.custom.prelaunch.announcedProductClaims[${index}]`)
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
      `${locale} launch FAQ must use conditional non-commitment wording`
    );
    assert.deepEqual(
      JSON.parse(readerCopy),
      approvedCopy,
      `${locale} reader copy must match the approved safe draft`
    );
    assert.equal(content.overview, approvedCopy.overview);
    assert.equal(content.overview?.includes(unavailable), true);
    assert.equal(content.hero?.ctaPrimary?.href, approvedCopy.hero.ctaPrimary.href);
    assert.equal(
      content.hero?.secondaryLinks?.[0]?.href,
      approvedCopy.hero.secondaryLinks[0].href
    );
    assert.equal(prelaunch?.dreaminaLabel, 'coming_soon');
    assert.equal(prelaunch?.checkedAt, '2026-07-26');
    assert.equal(prelaunch?.apiAvailability, 'unconfirmed');
    assert.equal(prelaunch?.pricingAvailability, 'unconfirmed');
    assert.equal(prelaunch?.productSurface, 'Dreamina');
    assert.equal(
      prelaunch?.sourceUrl,
      'https://dreamina.capcut.com/seedance/seedance-2-5'
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
```

- [ ] **Step 2: Run the test and verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts
```

Expected: FAIL on the missing English overlay.

- [ ] **Step 3: Verify the future model scaffold without writing files**

Run:

```bash
pnpm model:setup -- \
  --from seedance-2-0 \
  --slug seedance-2-5 \
  --name "Seedance 2.5" \
  --family seedance \
  --stage hidden \
  --availability paused \
  --version "2.5" \
  --engine seedance-2-5 \
  --dry-run
```

Expected: the command prints dry-run writes plus an all-false registry skeleton; it does not create content, documentation, registry, or runtime files. `--stage hidden` affects packet text only, while the printed registry skeleton remains fully unpublished.

- [ ] **Step 4: Create the English overlay**

Set `docs/model-launch/seedance-2-5/en.overlay.json` to:

```json
{
  "marketingName": "Seedance 2.5",
  "versionLabel": "2.5",
  "seo": {
    "title": "Seedance 2.5: Dreamina-Announced Features and API Status",
    "description": "Track Dreamina-announced product information and BytePlus API status for Seedance 2.5. Generation is not yet available on MaxVideoAI."
  },
  "overview": "Dreamina labels Seedance 2.5 as coming soon and describes 4K output, standard videos up to 30 seconds, a beta long-video mode up to 180 seconds, as many as 50 multimodal inputs, reference-to-video control, and precise editing of selected video regions on its product surface. Seedance 2.5 is not yet available for generation on MaxVideoAI.",
  "pricingNotes": "MaxVideoAI API access, customer pricing, BytePlus pricing, technical API limits, and launch timing are unconfirmed. No Seedance 2.0 rate is being reused for Seedance 2.5, and no launch is committed.",
  "hero": {
    "title": "Seedance 2.5 — launch status and Dreamina-announced information",
    "intro": "Dreamina currently labels Seedance 2.5 as coming soon. The capabilities summarized here are Dreamina product-surface statements, not a confirmed BytePlus ModelArk API contract. Seedance 2.5 is not yet available for generation on MaxVideoAI.",
    "badge": "Coming soon on Dreamina · BytePlus API unconfirmed",
    "ctaPrimary": {
      "label": "Explore Seedance 2.0",
      "href": "/models/seedance-2-0"
    },
    "secondaryLinks": [
      {
        "label": "View examples from available Seedance models",
        "href": "/examples/seedance"
      }
    ]
  },
  "faqs": [
    {
      "q": "Can I generate with Seedance 2.5 on MaxVideoAI now?",
      "a": "No. Seedance 2.5 is not yet available for generation on MaxVideoAI. No launch is committed. Any future MaxVideoAI integration would depend on official BytePlus API evidence, successful billing, reliability, safety, and output validation, and the required legal and commercial clearances."
    },
    {
      "q": "Are Dreamina’s announced features confirmed for the BytePlus API?",
      "a": "No. Dreamina product-surface statements do not establish BytePlus API modes, limits, payloads, regions, pricing, or release timing."
    }
  ],
  "custom": {
    "prelaunch": {
      "dreaminaLabel": "coming_soon",
      "checkedAt": "2026-07-26",
      "apiAvailability": "unconfirmed",
      "pricingAvailability": "unconfirmed",
      "productSurface": "Dreamina",
      "sourceUrl": "https://dreamina.capcut.com/seedance/seedance-2-5",
      "announcedProductClaims": [
        "4k_output",
        "standard_mode_up_to_30_seconds",
        "beta_long_video_mode_up_to_180_seconds",
        "up_to_50_multimodal_inputs",
        "reference_to_video_control",
        "precise_local_video_editing"
      ]
    }
  }
}
```

- [ ] **Step 5: Create the French overlay**

Set `docs/model-launch/seedance-2-5/fr.overlay.json` to:

```json
{
  "marketingName": "Seedance 2.5",
  "versionLabel": "2.5",
  "seo": {
    "title": "Seedance 2.5 : annonces Dreamina et statut de l’API",
    "description": "Suivez les informations produit annoncées par Dreamina et le statut de l’API BytePlus pour Seedance 2.5. La génération n’est pas encore disponible sur MaxVideoAI."
  },
  "overview": "Dreamina présente Seedance 2.5 comme un modèle à venir et décrit, sur son propre produit, une sortie 4K, des vidéos standard allant jusqu’à 30 secondes, un mode vidéo longue durée en bêta allant jusqu’à 180 secondes, jusqu’à 50 entrées multimodales, un contrôle par référence vidéo et la retouche précise de zones vidéo spécifiques. Seedance 2.5 n’est pas encore disponible pour générer des vidéos sur MaxVideoAI.",
  "pricingNotes": "L’accès via l’API MaxVideoAI, le prix client, le tarif BytePlus, les limites techniques de l’API et le calendrier de lancement ne sont pas confirmés. Aucun tarif Seedance 2.0 n’est réutilisé pour Seedance 2.5 et aucun lancement n’est confirmé.",
  "hero": {
    "title": "Seedance 2.5 — état du lancement et annonces Dreamina",
    "intro": "Dreamina présente actuellement Seedance 2.5 comme un modèle à venir. Les capacités résumées ici sont des déclarations concernant le produit Dreamina, pas un contrat API BytePlus ModelArk confirmé. Seedance 2.5 n’est pas encore disponible pour générer des vidéos sur MaxVideoAI.",
    "badge": "Bientôt sur Dreamina · API BytePlus non confirmée",
    "ctaPrimary": {
      "label": "Découvrir Seedance 2.0",
      "href": "/fr/modeles/seedance-2-0"
    },
    "secondaryLinks": [
      {
        "label": "Voir des exemples de modèles Seedance disponibles",
        "href": "/fr/galerie/seedance"
      }
    ]
  },
  "faqs": [
    {
      "q": "Puis-je générer avec Seedance 2.5 sur MaxVideoAI maintenant ?",
      "a": "Non. Seedance 2.5 n’est pas encore disponible pour générer des vidéos sur MaxVideoAI. Aucun lancement n’est confirmé. Toute future intégration à MaxVideoAI dépendrait de preuves officielles concernant l’API BytePlus, de la validation de la facturation, de la fiabilité, de la sécurité et des résultats générés, ainsi que des autorisations juridiques et commerciales requises."
    },
    {
      "q": "Les fonctions annoncées par Dreamina sont-elles confirmées pour l’API BytePlus ?",
      "a": "Non. Les déclarations concernant le produit Dreamina ne confirment ni les modes, ni les limites, ni les formats de requête, ni les régions, ni les tarifs, ni le calendrier de l’API BytePlus."
    }
  ],
  "custom": {
    "prelaunch": {
      "dreaminaLabel": "coming_soon",
      "checkedAt": "2026-07-26",
      "apiAvailability": "unconfirmed",
      "pricingAvailability": "unconfirmed",
      "productSurface": "Dreamina",
      "sourceUrl": "https://dreamina.capcut.com/seedance/seedance-2-5",
      "announcedProductClaims": [
        "4k_output",
        "standard_mode_up_to_30_seconds",
        "beta_long_video_mode_up_to_180_seconds",
        "up_to_50_multimodal_inputs",
        "reference_to_video_control",
        "precise_local_video_editing"
      ]
    }
  }
}
```

- [ ] **Step 6: Create the Spanish overlay**

Set `docs/model-launch/seedance-2-5/es.overlay.json` to:

```json
{
  "marketingName": "Seedance 2.5",
  "versionLabel": "2.5",
  "seo": {
    "title": "Seedance 2.5: anuncios de Dreamina y estado de la API",
    "description": "Consulta la información de producto anunciada por Dreamina y el estado de la API de BytePlus para Seedance 2.5. La generación todavía no está disponible en MaxVideoAI."
  },
  "overview": "Dreamina presenta Seedance 2.5 como un próximo lanzamiento y describe, en su propio producto, salida 4K, vídeos estándar de hasta 30 segundos, un modo de vídeo largo en beta de hasta 180 segundos, hasta 50 entradas multimodales, control mediante vídeo de referencia y edición precisa de regiones concretas del vídeo. Seedance 2.5 todavía no está disponible para generar vídeos en MaxVideoAI.",
  "pricingNotes": "El acceso mediante la API de MaxVideoAI, el precio para clientes, el precio de BytePlus, los límites técnicos de la API y el calendario de lanzamiento no están confirmados. No se está aplicando ninguna tarifa de Seedance 2.0 a Seedance 2.5 y no hay ningún lanzamiento confirmado.",
  "hero": {
    "title": "Seedance 2.5 — estado del lanzamiento y anuncios de Dreamina",
    "intro": "Dreamina presenta actualmente Seedance 2.5 como un próximo lanzamiento. Las capacidades resumidas aquí son declaraciones sobre el producto Dreamina, no un contrato confirmado de la API BytePlus ModelArk. Seedance 2.5 todavía no está disponible para generar vídeos en MaxVideoAI.",
    "badge": "Próximamente en Dreamina · API de BytePlus sin confirmar",
    "ctaPrimary": {
      "label": "Explorar Seedance 2.0",
      "href": "/es/modelos/seedance-2-0"
    },
    "secondaryLinks": [
      {
        "label": "Ver ejemplos de modelos Seedance disponibles",
        "href": "/es/galeria/seedance"
      }
    ]
  },
  "faqs": [
    {
      "q": "¿Puedo generar con Seedance 2.5 en MaxVideoAI ahora?",
      "a": "No. Seedance 2.5 todavía no está disponible para generar vídeos en MaxVideoAI. No hay ningún lanzamiento confirmado. Cualquier futura integración en MaxVideoAI dependería de documentación oficial sobre la API de BytePlus, de la validación de la facturación, la fiabilidad, la seguridad y los resultados generados, y de las autorizaciones legales y comerciales necesarias."
    },
    {
      "q": "¿Las funciones anunciadas por Dreamina están confirmadas para la API de BytePlus?",
      "a": "No. Las declaraciones sobre el producto Dreamina no confirman los modos, límites, formatos de las solicitudes, regiones, precios ni fechas de la API de BytePlus."
    }
  ],
  "custom": {
    "prelaunch": {
      "dreaminaLabel": "coming_soon",
      "checkedAt": "2026-07-26",
      "apiAvailability": "unconfirmed",
      "pricingAvailability": "unconfirmed",
      "productSurface": "Dreamina",
      "sourceUrl": "https://dreamina.capcut.com/seedance/seedance-2-5",
      "announcedProductClaims": [
        "4k_output",
        "standard_mode_up_to_30_seconds",
        "beta_long_video_mode_up_to_180_seconds",
        "up_to_50_multimodal_inputs",
        "reference_to_video_control",
        "precise_local_video_editing"
      ]
    }
  }
}
```

- [ ] **Step 7: Run the localized contract**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts
```

Expected: PASS with the exact approved reader copy and two FAQs in each locale.

- [ ] **Step 8: Commit localized drafts and their green contract**

```bash
git add \
  tests/seedance-2-5-readiness.test.ts \
  docs/model-launch/seedance-2-5/en.overlay.json \
  docs/model-launch/seedance-2-5/fr.overlay.json \
  docs/model-launch/seedance-2-5/es.overlay.json
git commit -m "content: prepare Seedance 2.5 launch drafts"
```

### Task 2: Add the official API evidence and publication gates

**Files:**
- Modify: `tests/seedance-2-5-readiness.test.ts`
- Create: `docs/model-launch/seedance-2-5.engine.stub.ts`
- Create: `docs/model-launch/seedance-2-5.md`

**Interfaces:**
- Consumes: the approved hidden execution → admin canary → public noindex → public indexed state machine.
- Produces: a documentation-only evidence checklist and a persistent no-runtime exposure contract.

- [ ] **Step 1: Extend the readiness contract**

Extend the Node imports:

```ts
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
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
```

Keep the exact documentation/test allowlist, then add mode-aware result types and
a separate, initially empty gitlink approval set:

```ts
const launchPacketPath = join(root, 'docs/model-launch/seedance-2-5.md');
const engineStubPath = join(root, 'docs/model-launch/seedance-2-5.engine.stub.ts');
const forbiddenRuntimeIdentity = /seedance[-_. ]?2[-_. ]?5/i;
const approvedSeedance25GitlinkPaths = new Set<string>();
const exposureMatchOrder = [
  'path',
  'index_content',
  'index_symlink_target',
  'index_symlink_resolved_content',
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
  candidatePaths: string[];
  candidatePathSet: ReadonlySet<string>;
  indexEntriesByPath: Map<string, GitIndexEntry[]>;
  indexBlobs: Map<string, Buffer>;
};
```

Implement the repository snapshot and scanner with these exact semantics:

- Parse `git ls-files --stage -z` into deterministic `GitIndexEntry` records.
  Preserve every index stage and classify by mode instead of relying on
  worktree `lstat`.
- Read unique mode `100xxx` and `120000` objects with one
  `git cat-file --batch` invocation. Keep blob bytes internal; no assertion or
  result may expose matched content.
- Union indexed paths with `git ls-files --others --exclude-standard -z`.
  Ignored untracked files remain outside the candidate set and must never be
  read.
- Scan every non-allowlisted candidate path. Scan indexed regular-file blobs
  and the current worktree regular file independently, so staged-safe /
  worktree-forbidden, staged-forbidden / worktree-safe, and deleted-worktree
  states are all explicit.
- For mode `120000`, scan the target text, resolve only repository-internal
  targets, and recursively scan the indexed target on behalf of the generic
  link path. For the current worktree link, scan `readlink` text and the
  resolved regular target only when that target is itself in the tracked or
  untracked-nonignored candidate set. The target allowlist never exempts a
  non-allowlisted link.
- For mode `160000`, emit `gitlink` unless the exact link path appears in the
  distinct `approvedSeedance25GitlinkPaths`. There is no current approval.
  Any other unsupported index mode fails closed.
- Keep binary filtering for regular blobs/files, resolve symlink cycles and
  missing links safely, normalize repository-relative paths, and sort paths
  and match kinds deterministically.
- Return only `{ path, matches }`, where `matches` contains the labels in
  `exposureMatchOrder`. Never return a matched line, blob, symlink target, or
  secret value.

Add the complete packet snapshot. `Verification commands` belongs inside
`approvedLaunchPacketSections` with the exact fenced body below; compose the
title, every section, ordering, whitespace, and final newline into one
approved packet:

```ts
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
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
\`\`\``,
} as const;
const approvedLaunchPacket = `# Seedance 2.5 launch packet

${Object.entries(approvedLaunchPacketSections)
  .map(([heading, body]) => `## ${heading}\n\n${body}`)
  .join('\n\n')}
`;

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

test('Seedance 2.5 packet contract rejects verification command omissions', () => {
  const packet = readFileSync(launchPacketPath, 'utf8');
  const incompletePacket = packet.replace('pnpm pricing:audit\n', '');
  assert.notEqual(incompletePacket, packet);
  assert.throws(
    () => assertApprovedLaunchPacket(incompletePacket),
    /complete approved launch packet/,
  );
});
```

The synthetic
`Seedance 2.5 exposure scan reconciles index and worktree states` fixture must
initialize and commit `.gitignore`, then create all of these independent
regressions before running the scanner:

- tracked regular content present in both index and worktree;
- safe indexed content changed to forbidden worktree content;
- forbidden indexed content changed to safe worktree content;
- forbidden indexed content deleted from the worktree;
- an untracked path-only route;
- a generic tracked symlink to the allowlisted
  `docs/model-launch/seedance-2-5.md`;
- a tracked generic symlink to ignored `frontend/.env.local`, which must not
  leak or appear in results;
- a mode `160000` generic provider gitlink;
- a true binary containing identity bytes, which remains excluded.

Assert the exact eight result paths and exact match-kind arrays. Keep the real
repository assertion:

```ts
test('Seedance 2.5 is absent from runtime and publication sources', () => {
  assert.deepEqual(findForbiddenSeedance25Exposures(root), []);
});
```

For strict TDD, add the symlink/divergence/deletion/gitlink fixture expectations
before replacing the prior worktree-only scanner, observe the regression test
fail, then implement the mode-aware snapshot. Add the ignored-secret symlink
before its candidate-set guard and observe that privacy regression fail. Add
the packet-command mutation before composing the complete packet snapshot and
observe that mutation test fail.

- [ ] **Step 2: Run the extended test and verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts
```

Expected in the original Task 2 sequence: the localized and runtime-absence
tests PASS; the documentation test FAILS because the dry-run created no packet
or stub. In the round-two regression sequence against the prior scanner, the
synthetic scanner test FAILS because index/worktree divergence, a deleted
indexed file, the generic symlink, and the gitlink are missing. The privacy
variant FAILS because the ignored secret target is read, and the packet
mutation FAILS because an omitted verification command is accepted.

- [ ] **Step 3: Create the documentation-only engine evidence stub**

Set `docs/model-launch/seedance-2-5.engine.stub.ts` to:

```ts
/**
 * Documentation-only Seedance 2.5 launch gate.
 *
 * Runtime code must not import this file.
 * An executable engine entry can be authored only from official BytePlus
 * ModelArk documentation.
 */
export const seedance25EngineEvidenceGate = {
  canonicalEngineId: 'seedance-2-5',
  documentationOnly: true,
  runtimeEntryAllowed: false,
  requiredOfficialApiFacts: [
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
  ],
  promotionOrder: [
    'hidden_execution',
    'admin_canary',
    'public_noindex',
    'public_indexed',
  ],
} as const;
```

- [ ] **Step 4: Create the launch packet**

Set `docs/model-launch/seedance-2-5.md` to:

````markdown
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
````

- [ ] **Step 5: Run the complete readiness contract**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts
```

Expected: PASS with all five tests green, including the complete-packet
mutation guard, the synthetic index/worktree/symlink/gitlink regression, and
the repository-wide absence boundary.

- [ ] **Step 6: Commit the evidence packet and persistent boundary**

```bash
git add \
  tests/seedance-2-5-readiness.test.ts \
  docs/model-launch/seedance-2-5.engine.stub.ts \
  docs/model-launch/seedance-2-5.md
git commit -m "docs: add Seedance 2.5 launch gates"
```

## Final Verification

- [ ] **Step 1: Run focused setup and readiness tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-setup-cli.test.ts \
  tests/seedance-2-5-readiness.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 2: Parse all three overlay files independently**

```bash
node -e "for (const locale of ['en','fr','es']) JSON.parse(require('node:fs').readFileSync('docs/model-launch/seedance-2-5/'+locale+'.overlay.json','utf8')); console.log('Seedance 2.5 launch overlays: OK')"
```

Expected: prints `Seedance 2.5 launch overlays: OK`.

- [ ] **Step 3: Prove runtime and publication surfaces remain absent**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  --test-name-pattern='Seedance 2.5 is absent from runtime and publication sources' \
  tests/seedance-2-5-readiness.test.ts
```

Expected: the repository-wide Git candidate scan exits 0 after checking every
non-allowlisted path, every indexed regular/symlink blob, every current
tracked/untracked non-ignored worktree candidate, and every unapproved gitlink,
including the provider environment template and benchmark data. Ignored
untracked secrets are neither read nor reported.

- [ ] **Step 4: Run model, registry, pricing, and repository guards**

```bash
pnpm model:check
pnpm models:audit
pnpm model:registry:check
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: every command exits 0; no orphan content slug or generated projection changes.

- [ ] **Step 5: Inspect the implementation range**

```bash
LAUNCH_BASE_SHA="$(
  git rev-parse "$(
    git log --format=%H \
      --grep='^content: prepare Seedance 2.5 launch drafts$' \
      -n 1
  )^"
)"
git diff "$LAUNCH_BASE_SHA"..HEAD -- \
  docs/model-launch/seedance-2-5 \
  docs/model-launch/seedance-2-5.engine.stub.ts \
  docs/model-launch/seedance-2-5.md \
  tests/seedance-2-5-readiness.test.ts
```

Expected: only Dreamina-attributed drafts, explicit unavailability, API evidence gates, and the readiness contract are present.

- [ ] **Step 6: Commit verification corrections only when required**

If a guard required a scoped correction, make the correction and repeat Final
Verification Steps 1–4 in full. Do not commit until every repeated command is
green. Then run:

```bash
git add \
  tests/seedance-2-5-readiness.test.ts \
  docs/model-launch/seedance-2-5/en.overlay.json \
  docs/model-launch/seedance-2-5/fr.overlay.json \
  docs/model-launch/seedance-2-5/es.overlay.json \
  docs/model-launch/seedance-2-5.engine.stub.ts \
  docs/model-launch/seedance-2-5.md
git commit -m "test: complete Seedance 2.5 launch readiness"
```

If no correction was needed, do not create an empty commit.

- [ ] **Step 7: Inspect the final verified commit range**

```bash
LAUNCH_BASE_SHA="$(
  git rev-parse "$(
    git log --format=%H \
      --grep='^content: prepare Seedance 2.5 launch drafts$' \
      -n 1
  )^"
)"
git diff --check "$LAUNCH_BASE_SHA"..HEAD
git diff "$LAUNCH_BASE_SHA"..HEAD -- \
  docs/model-launch/seedance-2-5 \
  docs/model-launch/seedance-2-5.engine.stub.ts \
  docs/model-launch/seedance-2-5.md \
  tests/seedance-2-5-readiness.test.ts
```

Expected: the committed range is whitespace-clean and contains only the
verified draft overlays, evidence gates, persistent unavailability boundary,
and readiness tests.
