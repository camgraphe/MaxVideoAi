import type { AppLocale } from '@/i18n/locales';
import { localePathnames } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';
import { buildSlugMap } from '@/lib/i18nSlugs';

import { buildDecisionPricingScenarios, type ModelDecisionPricingScenario } from './model-page-decision-pricing';
import { buildCanonicalComparePath, COMPARE_BASE_PATH_MAP } from './model-page-links';
import { getModelPageTemplateConfig } from './model-page-template-registry';

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
        { label: 'Prompt examples', href: '#prompting' },
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
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      {
        title: 'Text prompt',
        body: 'Use the prompt for the scene brief: subject, action, camera, style and audio cues.',
      },
      {
        title: 'Image reference',
        body: 'Use images to guide identity, product details, style, composition or environment.',
      },
      {
        title: 'Video reference',
        body: 'Use video references for motion rhythm or camera pacing when the active route exposes them.',
      },
      {
        title: 'Audio reference',
        body: 'Use audio references for rhythm, ambience or mood when the active route exposes them.',
      },
      {
        title: 'Continuity anchors',
        body: 'Repeat wardrobe, props, location, lighting and final pose so short sequences stay coherent.',
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
      eyebrow: 'MODÈLE BYTEDANCE DE GÉNÉRATION ACTUELLE',
      title: 'Seedance 2.0',
      subtitle:
        'Audio natif, continuité multi-plans et vidéo guidée par références pour des publicités, lancements et contenus de marque cinématographiques.',
      paragraph:
        "Utilisez Seedance 2.0 pour le workflow Seedance actuel : meilleure continuité que les versions précédentes, audio natif dans le même flux et références multimodales pour le text-to-video ou l’image-to-video.",
      primaryCta: { label: 'Générer avec Seedance 2.0', href: '/app?engine=seedance-2-0' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr') },
      quickLinks: [
        { label: 'Comparer vs Fast', href: compareHref('fr', 'seedance-2-0', 'seedance-2-0-fast') },
        { label: 'Voir les tarifs', href: pricingHref('fr') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Seedance 2.0',
      description: 'Séquence cinématographique avec audio natif',
      renderLabel: 'Voir le rendu',
      badges: ['Audio activé', '12 s', '16:9'],
      altContext: 'scène cinématographique de course sur un toit',
    },
    features: [
      { title: 'Audio natif', body: 'Dialogue, ambiance et SFX générés en synchro.', tone: 'audio' },
      { title: 'Continuité multi-plans', body: 'Gardez personnages, style et scène cohérents d’un plan à l’autre.', tone: 'continuity' },
      { title: 'Guidé par références', body: 'Guidez le rendu avec les références prises en charge.', tone: 'reference' },
      { title: 'Max 1080p', body: 'Sortie nette pour la plupart des besoins de production.', tone: 'quality' },
      { title: 'Max 15 s', body: 'Jusqu’à 15 secondes par génération.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Seedance 2.0 ou Fast ?',
        body: 'Choisissez Seedance 2.0 pour les rendus finaux avec audio natif et continuité multi-plans. Passez à Fast pour les brouillons moins chers et les tests de rythme.',
        cta: {
          label: 'Comparer Seedance 2.0 vs Fast',
          href: compareHref('fr', 'seedance-2-0', 'seedance-2-0-fast'),
        },
      },
      {
        title: 'Vous venez de Seedance 1.5 ?',
        body: 'Seedance 2.0 est le workflow actuel pour une meilleure continuité multi-plans, l’audio natif et des références plus nombreuses.',
        cta: {
          label: 'Comparer 1.5 vs 2.0',
          href: compareHref('fr', 'seedance-1-5-pro', 'seedance-2-0', 'seedance-2-0'),
        },
      },
      {
        title: 'Besoin d’exemples de prompts ?',
        body: 'Commencez avec des modèles text-to-video, image-to-video, références et multi-plans.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      {
        title: 'Prompt texte',
        body: 'Utilisez le prompt pour le brief de scène : sujet, action, caméra, style et indications audio.',
      },
      {
        title: 'Référence image',
        body: 'Utilisez les images pour guider l’identité, le produit, le style, la composition ou l’environnement.',
      },
      {
        title: 'Référence vidéo',
        body: 'Utilisez les vidéos pour guider le rythme du mouvement ou de la caméra quand le flux actif le permet.',
      },
      {
        title: 'Référence audio',
        body: 'Utilisez l’audio pour guider le rythme, l’ambiance ou l’intention émotionnelle quand le flux actif le permet.',
      },
      {
        title: 'Ancrages de continuité',
        body: 'Répétez tenue, accessoires, lieu, lumière et pose finale pour garder la séquence cohérente.',
      },
    ],
    pricingCopy: {
      title: 'Prix Seedance 2.0 en un coup d’œil',
      subtitle: 'Prix totaux par scénario — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
    },
    meta: {
      title: 'Seedance 2.0 : tarifs, audio natif et exemples | MaxVideoAI',
      description:
        'Explorez prix, exemples, audio natif, vidéo multi-plans et workflows guidés par références. Comparez Seedance 2.0 vs Fast et les anciennes versions.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO ACTUAL DE BYTEDANCE',
      title: 'Seedance 2.0',
      subtitle:
        'Audio nativo, continuidad entre tomas y video guiado por referencias para anuncios, lanzamientos y contenido de marca con acabado cinematográfico.',
      paragraph:
        'Usa Seedance 2.0 cuando necesites el flujo principal actual de Seedance: mejor continuidad que versiones anteriores, audio nativo en la misma generación y referencias multimodales para texto a video o imagen a video.',
      primaryCta: { label: 'Generar con Seedance 2.0', href: '/app?engine=seedance-2-0' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es') },
      quickLinks: [
        { label: 'Comparar con Fast', href: compareHref('es', 'seedance-2-0', 'seedance-2-0-fast') },
        { label: 'Ver precios', href: pricingHref('es') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Seedance 2.0',
      description: 'Secuencia cinematográfica con audio nativo',
      renderLabel: 'Ver resultado',
      badges: ['Audio activado', '12 s', '16:9'],
      altContext: 'escena cinematográfica de carrera en una azotea',
    },
    features: [
      { title: 'Audio nativo', body: 'Diálogo, ambiente y efectos de sonido generados en sincronía.', tone: 'audio' },
      { title: 'Continuidad entre tomas', body: 'Mantiene personajes, estilo y escena coherentes.', tone: 'continuity' },
      { title: 'Guiado por referencias', body: 'Usa referencias compatibles para guiar el resultado.', tone: 'reference' },
      { title: 'Max 1080p', body: 'Salida nítida para la mayoría de necesidades de producción.', tone: 'quality' },
      { title: 'Max 15 s', body: 'Hasta 15 segundos por generación.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Seedance 2.0 o Fast?',
        body: 'Usa Seedance 2.0 para piezas finales con audio nativo y continuidad entre tomas. Usa Fast para borradores más económicos y pruebas de ritmo.',
        cta: {
          label: 'Comparar Seedance 2.0 vs Fast',
          href: compareHref('es', 'seedance-2-0', 'seedance-2-0-fast'),
        },
      },
      {
        title: '¿Vienes de Seedance 1.5?',
        body: 'Seedance 2.0 es el flujo actual para mayor continuidad entre tomas, audio nativo y más opciones de trabajo con referencias.',
        cta: {
          label: 'Comparar 1.5 vs 2.0',
          href: compareHref('es', 'seedance-1-5-pro', 'seedance-2-0', 'seedance-2-0'),
        },
      },
      {
        title: '¿Necesitas ejemplos de prompts?',
        body: 'Empieza con plantillas de texto a video, imagen a video, referencias y continuidad entre tomas.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      {
        title: 'Prompt de texto',
        body: 'Usa el prompt para el brief de escena: sujeto, acción, cámara, estilo e indicaciones de audio.',
      },
      {
        title: 'Referencia de imagen',
        body: 'Usa imágenes para guiar identidad, producto, estilo, composición o entorno.',
      },
      {
        title: 'Referencia de video',
        body: 'Usa videos para guiar el ritmo del movimiento o de cámara cuando el flujo activo lo permita.',
      },
      {
        title: 'Referencia de audio',
        body: 'Usa audio para marcar ritmo, ambiente o intención emocional cuando el flujo activo lo permita.',
      },
      {
        title: 'Anclas de continuidad',
        body: 'Repite vestuario, props, ubicación, luz y pose final para mantener coherente la secuencia.',
      },
    ],
    pricingCopy: {
      title: 'Precios de Seedance 2.0 de un vistazo',
      subtitle: 'Precios totales por escenario. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
    },
    meta: {
      title: 'Seedance 2.0: precios, audio nativo y ejemplos | MaxVideoAI',
      description:
        'Explora precios de Seedance 2.0, ejemplos, audio nativo, video con continuidad entre tomas y flujos guiados por referencias. Compara Seedance 2.0 vs Fast y versiones anteriores.',
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
  const template = getModelPageTemplateConfig(engine.modelSlug);

  if (!template) return null;

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
