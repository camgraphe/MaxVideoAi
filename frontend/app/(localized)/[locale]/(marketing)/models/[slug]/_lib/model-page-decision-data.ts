import type { AppLocale } from '@/i18n/locales';
import { localePathnames } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';
import { buildSlugMap } from '@/lib/i18nSlugs';

import { buildDecisionPricingScenarios, type ModelDecisionPricingScenario } from './model-page-decision-pricing';
import { buildCanonicalComparePath, COMPARE_BASE_PATH_MAP } from './model-page-links';

export type ModelDecisionLink = {
  label: string;
  href: string;
};

export type ModelDecisionFeature = {
  title: string;
  body: string;
  tone: 'audio' | 'continuity' | 'reference' | 'quality' | 'duration' | 'price';
};

export type ModelDecisionCard = {
  title: string;
  body: string;
  cta: ModelDecisionLink;
};

export type ModelDecisionReferenceWorkflow = {
  title: string;
  body: string;
};

export type ModelDecisionData = {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    paragraph: string;
    primaryCta: ModelDecisionLink;
    secondaryCta: ModelDecisionLink;
    quickLinks: ModelDecisionLink[];
  };
  media: {
    caption: string;
    description: string;
    renderLabel: string;
    badges: string[];
    altContext: string;
  };
  features: ModelDecisionFeature[];
  decisionCards: ModelDecisionCard[];
  referenceWorkflows: ModelDecisionReferenceWorkflow[];
  pricing: {
    title: string;
    subtitle: string;
    footnote: string;
    cta: ModelDecisionLink;
    scenarios: ModelDecisionPricingScenario[];
  };
  meta: {
    title: string;
    description: string;
  };
};

const PRICING_SLUG_MAP = buildSlugMap('pricing');
const GALLERY_SLUG_MAP = buildSlugMap('gallery');
const PRICING_ANCHOR = 'seedance-2-0-pricing';
const SEEDANCE_EXAMPLES_FAMILY_SLUG = 'seedance';

function localizedPrefix(locale: AppLocale) {
  const pathname = localePathnames[locale];
  return pathname ? `/${pathname}` : '';
}

function localizedPath(locale: AppLocale, segment: string, suffix = '') {
  return `${localizedPrefix(locale)}/${segment}${suffix}`.replace(/\/{2,}/g, '/');
}

function pricingHref(locale: AppLocale) {
  const segment = PRICING_SLUG_MAP[locale] ?? PRICING_SLUG_MAP.en;
  return `${localizedPath(locale, segment)}#${PRICING_ANCHOR}`;
}

function examplesHref(locale: AppLocale) {
  const segment = GALLERY_SLUG_MAP[locale] ?? GALLERY_SLUG_MAP.en;
  return localizedPath(locale, segment, `/${SEEDANCE_EXAMPLES_FAMILY_SLUG}`);
}

function compareHref(locale: AppLocale, left: string, right: string, orderSlug = left) {
  const compareBase = COMPARE_BASE_PATH_MAP[locale] ?? COMPARE_BASE_PATH_MAP.en;
  return `${localizedPrefix(locale)}${buildCanonicalComparePath({
    compareBase,
    pairSlug: [left, right].sort().join('-vs-'),
    orderSlug,
  })}`.replace(/\/{2,}/g, '/');
}

type CopyWithoutPricingScenarios = Omit<ModelDecisionData, 'pricing'> & {
  pricingCopy: Omit<ModelDecisionData['pricing'], 'cta' | 'scenarios'> & { ctaLabel: string };
};

const COPY: Record<AppLocale, CopyWithoutPricingScenarios> = {
  en: {
    hero: {
      eyebrow: 'BYTEDANCE CURRENT-GEN MODEL',
      title: 'Seedance 2.0',
      subtitle:
        'Native audio, multi-shot continuity, and reference-guided video for polished ads, launches and cinematic branded content.',
      paragraph:
        'Use Seedance 2.0 when you need the current Seedance production route: stronger continuity than older versions, native audio in the same generation flow, and multimodal references for text-to-video or image-to-video work.',
      primaryCta: { label: 'Generate with Seedance 2.0', href: '/app?engine=seedance-2-0' },
      secondaryCta: { label: 'View examples', href: examplesHref('en') },
      quickLinks: [
        { label: 'Compare vs Fast', href: compareHref('en', 'seedance-2-0', 'seedance-2-0-fast') },
        { label: 'View pricing', href: pricingHref('en') },
        { label: 'Prompt examples', href: '#image-to-video' },
      ],
    },
    media: {
      caption: 'Seedance 2.0 example',
      description: 'Native-audio cinematic sequence',
      renderLabel: 'View render',
      badges: ['Audio on', '12s', '16:9'],
      altContext: 'cinematic rooftop running scene',
    },
    features: [
      { title: 'Native audio', body: 'Dialogue, ambience and SFX generated in sync.', tone: 'audio' },
      {
        title: 'Multi-shot continuity',
        body: 'Keep characters, style and scene continuity across short sequences.',
        tone: 'continuity',
      },
      { title: 'Reference-guided', body: 'Use supported references to guide the output.', tone: 'reference' },
      { title: 'Max 1080p', body: 'Crisp output for most production needs.', tone: 'quality' },
      { title: 'Max 15s', body: 'Up to 15 seconds per generation.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Seedance 2.0 or Fast?',
        body: 'Use Seedance 2.0 for final-quality, native-audio, multi-shot work. Use Fast for cheaper draft passes and timing tests.',
        cta: {
          label: 'Compare Seedance 2.0 vs Fast',
          href: compareHref('en', 'seedance-2-0', 'seedance-2-0-fast'),
        },
      },
      {
        title: 'Upgrading from Seedance 1.5?',
        body: 'Seedance 2.0 is the current route for stronger multi-shot continuity, native audio and broader reference workflows.',
        cta: {
          label: 'Compare 1.5 vs 2.0',
          href: compareHref('en', 'seedance-1-5-pro', 'seedance-2-0', 'seedance-2-0'),
        },
      },
      {
        title: 'Need prompt examples?',
        body: 'Start with text-to-video, image-to-video, reference-guided and multi-shot prompt templates.',
        cta: { label: 'Open Prompt Lab', href: '#image-to-video' },
      },
    ],
    referenceWorkflows: [
      {
        title: 'Text-to-video',
        body: 'Start with subject, action, camera, style and audio cues in one clean brief.',
      },
      {
        title: 'Image-to-video',
        body: 'Use a start image to lock character, product, composition or environment.',
      },
      {
        title: 'Reference roles',
        body: 'Give each supported reference one job so identity, motion and mood do not fight each other.',
      },
      {
        title: 'Timeline beats',
        body: 'Use short timestamps and transition verbs when you need internal cuts or a sequence.',
      },
    ],
    pricingCopy: {
      title: 'Seedance 2.0 pricing at a glance',
      subtitle: 'Preset total prices - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
    },
    meta: {
      title: 'Seedance 2.0: Pricing, Native Audio & Examples | MaxVideoAI',
      description:
        'Explore Seedance 2.0 pricing, examples, native audio, multi-shot video and reference-guided workflows. Compare Seedance 2.0 vs Fast and older versions.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODELE BYTEDANCE DE GENERATION ACTUELLE',
      title: 'Seedance 2.0',
      subtitle:
        'Audio natif, continuite multi-plans et video guidee par reference pour des publicites, lancements et contenus de marque cinematographiques.',
      paragraph:
        "Utilisez Seedance 2.0 quand vous voulez la route Seedance de production actuelle : meilleure continuite que les versions precedentes, audio natif dans le meme flux et references multimodales pour le texte-vers-video ou l'image-vers-video.",
      primaryCta: { label: 'Generer avec Seedance 2.0', href: '/app?engine=seedance-2-0' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr') },
      quickLinks: [
        { label: 'Comparer vs Fast', href: compareHref('fr', 'seedance-2-0', 'seedance-2-0-fast') },
        { label: 'Voir les tarifs', href: pricingHref('fr') },
        { label: 'Exemples de prompts', href: '#image-to-video' },
      ],
    },
    media: {
      caption: 'Exemple Seedance 2.0',
      description: 'Sequence cinematographique avec audio natif',
      renderLabel: 'Voir le rendu',
      badges: ['Audio on', '12 s', '16:9'],
      altContext: 'scene cinematographique de course sur un toit',
    },
    features: [
      { title: 'Audio natif', body: 'Dialogue, ambiance et SFX generes en synchronisation.', tone: 'audio' },
      { title: 'Continuite multi-plans', body: 'Gardez les personnages, le style et la scene coherents.', tone: 'continuity' },
      { title: 'Guide par references', body: 'Utilisez les references prises en charge pour guider le rendu.', tone: 'reference' },
      { title: 'Max 1080p', body: 'Sortie nette pour la plupart des besoins de production.', tone: 'quality' },
      { title: 'Max 15 s', body: "Jusqu'a 15 secondes par generation.", tone: 'duration' },
      { title: "Paiement a l'usage", body: 'Voyez le prix exact avant de generer.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Seedance 2.0 ou Fast ?',
        body: 'Utilisez Seedance 2.0 pour les rendus finaux, audio natif et multi-plans. Utilisez Fast pour les brouillons moins chers et les tests de rythme.',
        cta: {
          label: 'Comparer Seedance 2.0 vs Fast',
          href: compareHref('fr', 'seedance-2-0', 'seedance-2-0-fast'),
        },
      },
      {
        title: 'Vous venez de Seedance 1.5 ?',
        body: 'Seedance 2.0 est la route actuelle pour une meilleure continuite multi-plans, audio natif et des workflows de reference plus larges.',
        cta: {
          label: 'Comparer 1.5 vs 2.0',
          href: compareHref('fr', 'seedance-1-5-pro', 'seedance-2-0', 'seedance-2-0'),
        },
      },
      {
        title: 'Besoin d exemples de prompts ?',
        body: 'Commencez avec des modeles texte-vers-video, image-vers-video, references et multi-plans.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#image-to-video' },
      },
    ],
    referenceWorkflows: [
      {
        title: 'Texte-vers-video',
        body: 'Commencez par sujet, action, camera, style et indications audio dans un brief clair.',
      },
      {
        title: 'Image-vers-video',
        body: 'Utilisez une image de depart pour fixer personnage, produit, composition ou environnement.',
      },
      {
        title: 'Roles des references',
        body: 'Donnez un role a chaque reference prise en charge pour eviter les conflits entre identite, mouvement et ambiance.',
      },
      {
        title: 'Temps forts',
        body: 'Utilisez des timestamps courts et des verbes de transition pour des coupes internes ou une sequence.',
      },
    ],
    pricingCopy: {
      title: 'Tarifs Seedance 2.0 en un coup d oeil',
      subtitle: "Prix totaux par scenario - voyez le prix exact dans l'app avant de generer.",
      footnote: 'Tous les prix sont des prix affiches MaxVideoAI en credits USD pour des scenarios predefinis.',
      ctaLabel: 'Voir tous les tarifs',
    },
    meta: {
      title: 'Seedance 2.0 : tarifs, audio natif et exemples | MaxVideoAI',
      description:
        'Explorez les tarifs Seedance 2.0, les exemples, l audio natif, la video multi-plans et les workflows guides par reference. Comparez Seedance 2.0 vs Fast et les anciennes versions.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO ACTUAL DE BYTEDANCE',
      title: 'Seedance 2.0',
      subtitle:
        'Audio nativo, continuidad multi-shot y video guiado por referencias para anuncios, lanzamientos y contenido de marca cinematografico.',
      paragraph:
        'Usa Seedance 2.0 cuando necesites la ruta Seedance de produccion actual: mas continuidad que versiones anteriores, audio nativo en el mismo flujo y referencias multimodales para texto a video o imagen a video.',
      primaryCta: { label: 'Generar con Seedance 2.0', href: '/app?engine=seedance-2-0' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es') },
      quickLinks: [
        { label: 'Comparar vs Fast', href: compareHref('es', 'seedance-2-0', 'seedance-2-0-fast') },
        { label: 'Ver precios', href: pricingHref('es') },
        { label: 'Ejemplos de prompts', href: '#image-to-video' },
      ],
    },
    media: {
      caption: 'Ejemplo Seedance 2.0',
      description: 'Secuencia cinematografica con audio nativo',
      renderLabel: 'Ver render',
      badges: ['Audio on', '12 s', '16:9'],
      altContext: 'escena cinematografica de carrera en una azotea',
    },
    features: [
      { title: 'Audio nativo', body: 'Dialogo, ambiente y SFX generados en sincronizacion.', tone: 'audio' },
      { title: 'Continuidad multi-shot', body: 'Mantiene personajes, estilo y escena coherentes.', tone: 'continuity' },
      { title: 'Guiado por referencias', body: 'Usa referencias compatibles para guiar el resultado.', tone: 'reference' },
      { title: 'Max 1080p', body: 'Salida nitida para la mayoria de necesidades de produccion.', tone: 'quality' },
      { title: 'Max 15 s', body: 'Hasta 15 segundos por generacion.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Seedance 2.0 o Fast?',
        body: 'Usa Seedance 2.0 para trabajo final con audio nativo y multi-shot. Usa Fast para borradores mas baratos y pruebas de ritmo.',
        cta: {
          label: 'Comparar Seedance 2.0 vs Fast',
          href: compareHref('es', 'seedance-2-0', 'seedance-2-0-fast'),
        },
      },
      {
        title: 'Vienes de Seedance 1.5?',
        body: 'Seedance 2.0 es la ruta actual para mas continuidad multi-shot, audio nativo y flujos con referencias mas amplios.',
        cta: {
          label: 'Comparar 1.5 vs 2.0',
          href: compareHref('es', 'seedance-1-5-pro', 'seedance-2-0', 'seedance-2-0'),
        },
      },
      {
        title: 'Necesitas prompts?',
        body: 'Empieza con plantillas de texto a video, imagen a video, referencias y multi-shot.',
        cta: { label: 'Abrir Prompt Lab', href: '#image-to-video' },
      },
    ],
    referenceWorkflows: [
      {
        title: 'Texto a video',
        body: 'Empieza con sujeto, accion, camara, estilo y pistas de audio en un brief limpio.',
      },
      {
        title: 'Imagen a video',
        body: 'Usa una imagen inicial para fijar personaje, producto, composicion o entorno.',
      },
      {
        title: 'Roles de referencia',
        body: 'Da una tarea a cada referencia compatible para que identidad, movimiento y ambiente no compitan.',
      },
      {
        title: 'Momentos de timeline',
        body: 'Usa timestamps cortos y verbos de transicion cuando necesites cortes internos o una secuencia.',
      },
    ],
    pricingCopy: {
      title: 'Precios de Seedance 2.0 de un vistazo',
      subtitle: 'Precios totales por escenario - ve el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en creditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
    },
    meta: {
      title: 'Seedance 2.0: precios, audio nativo y ejemplos | MaxVideoAI',
      description:
        'Explora precios de Seedance 2.0, ejemplos, audio nativo, video multi-shot y flujos guiados por referencias. Compara Seedance 2.0 vs Fast y versiones anteriores.',
    },
  },
};

export function buildModelDecisionPricingScenarios(entry: FalEngineEntry, locale: AppLocale) {
  return buildDecisionPricingScenarios(entry, locale);
}

export function buildModelDecisionData({
  engine,
  locale,
}: {
  engine: FalEngineEntry;
  locale: AppLocale;
}): ModelDecisionData | null {
  if (engine.modelSlug !== 'seedance-2-0') return null;
  const copy = COPY[locale] ?? COPY.en;
  return {
    hero: copy.hero,
    media: copy.media,
    features: copy.features,
    decisionCards: copy.decisionCards,
    referenceWorkflows: copy.referenceWorkflows,
    meta: copy.meta,
    pricing: {
      title: copy.pricingCopy.title,
      subtitle: copy.pricingCopy.subtitle,
      footnote: copy.pricingCopy.footnote,
      cta: { label: copy.pricingCopy.ctaLabel, href: pricingHref(locale) },
      scenarios: buildModelDecisionPricingScenarios(engine, locale),
    },
  };
}
