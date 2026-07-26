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
