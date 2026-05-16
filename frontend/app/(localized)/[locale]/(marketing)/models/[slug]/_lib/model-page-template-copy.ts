import type { AppLocale } from '@/i18n/locales';
import { localePathnames } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';

import type { ModelDecisionData } from './model-page-decision-data';
import { buildCanonicalComparePath, COMPARE_BASE_PATH_MAP } from './model-page-links';
import { ADDITIONAL_TEMPLATE_COPY } from './model-page-template-copy-additional';

export type CopyWithoutPricingScenarios = Omit<ModelDecisionData, 'pricing'> & {
  pricingCopy: Omit<ModelDecisionData['pricing'], 'cta' | 'scenarios'> & {
    ctaLabel: string;
    ctaHref: string;
    maxDurationNote?: string;
  };
};

const PRICING_SLUG_MAP = buildSlugMap('pricing');
const GALLERY_SLUG_MAP = buildSlugMap('gallery');
const MODELS_SLUG_MAP = buildSlugMap('models');
const PRICING_ANCHOR = 'seedance-2-0-pricing';
const SEEDANCE_EXAMPLES_FAMILY_SLUG = 'seedance';
const LTX_EXAMPLES_FAMILY_SLUG = 'ltx';
const VEO_EXAMPLES_FAMILY_SLUG = 'veo';
const KLING_EXAMPLES_FAMILY_SLUG = 'kling';

function localizedPrefix(locale: AppLocale) {
  const pathname = localePathnames[locale];
  return pathname ? `/${pathname}` : '';
}

function localizedPath(locale: AppLocale, segment: string, suffix = '') {
  return `${localizedPrefix(locale)}/${segment}${suffix}`.replace(/\/{2,}/g, '/');
}

function pricingHref(locale: AppLocale, anchorId = PRICING_ANCHOR) {
  const segment = PRICING_SLUG_MAP[locale] ?? PRICING_SLUG_MAP.en;
  return `${localizedPath(locale, segment)}#${anchorId}`;
}

function examplesHref(locale: AppLocale, familySlug = SEEDANCE_EXAMPLES_FAMILY_SLUG) {
  const segment = GALLERY_SLUG_MAP[locale] ?? GALLERY_SLUG_MAP.en;
  return localizedPath(locale, segment, `/${familySlug}`);
}

function modelsHref(locale: AppLocale, modelSlug: string) {
  const segment = MODELS_SLUG_MAP[locale] ?? MODELS_SLUG_MAP.en;
  return localizedPath(locale, segment, `/${modelSlug}`);
}

function modelsIndexHref(locale: AppLocale) {
  const segment = MODELS_SLUG_MAP[locale] ?? MODELS_SLUG_MAP.en;
  return localizedPath(locale, segment);
}

function compareHref(locale: AppLocale, left: string, right: string, orderSlug = left) {
  const compareBase = COMPARE_BASE_PATH_MAP[locale] ?? COMPARE_BASE_PATH_MAP.en;
  return `${localizedPrefix(locale)}${buildCanonicalComparePath({
    compareBase,
    pairSlug: [left, right].sort().join('-vs-'),
    orderSlug,
  })}`.replace(/\/{2,}/g, '/');
}

type LocalizedCopyWithoutPricingScenarios = Omit<ModelDecisionData, 'pricing'> & {
  pricingCopy: Omit<ModelDecisionData['pricing'], 'cta' | 'scenarios'> & {
    ctaLabel: string;
    maxDurationNote?: string;
  };
};

const SEEDANCE_20_COPY: Record<AppLocale, LocalizedCopyWithoutPricingScenarios> = {
  en: {
    hero: {
      eyebrow: 'BYTEDANCE CURRENT-GEN MODEL',
      title: 'Seedance 2.0',
      subtitle:
        'Native audio, multi-shot continuity, and reference-guided video for polished ads, launches and cinematic branded content.',
      subtitleHighlights: ['Native audio', 'multi-shot continuity', 'reference-guided video'],
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
      title: 'Seedance 2.0 AI Video: Max Length, Pricing & Best Uses',
      description:
        'See Seedance 2.0 pricing, max video length, native audio, reference workflows and when to use it instead of Seedance Fast.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODÈLE BYTEDANCE DE GÉNÉRATION ACTUELLE',
      title: 'Seedance 2.0',
      subtitle:
        'Audio natif, continuité multi-plans et vidéo guidée par références pour des publicités, lancements et contenus de marque cinématographiques.',
      subtitleHighlights: ['Audio natif', 'continuité multi-plans', 'vidéo guidée par références'],
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
      subtitleHighlights: ['Audio nativo', 'continuidad entre tomas', 'video guiado por referencias'],
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

const SEEDANCE_20_FAST_COPY: Record<AppLocale, LocalizedCopyWithoutPricingScenarios> = {
  en: {
    hero: {
      eyebrow: 'BYTEDANCE FAST DRAFT ROUTE',
      title: 'Seedance 2.0 Fast',
      subtitle: 'Fast Seedance draft passes for timing tests, A/B motion checks, and quick reference-guided shot planning.',
      subtitleHighlights: ['draft passes', 'timing tests', 'A/B motion checks'],
      paragraph:
        'Use Seedance 2.0 Fast as the faster Seedance draft route when you need rapid iteration before a final render: block timing, compare motion options, and test text, image, or reference inputs in shorter cycles.',
      primaryCta: { label: 'Draft with Seedance Fast', href: '/app?engine=seedance-2-0-fast' },
      secondaryCta: { label: 'View examples', href: examplesHref('en') },
      quickLinks: [
        { label: 'Compare vs 2.0', href: compareHref('en', 'seedance-2-0-fast', 'seedance-2-0') },
        { label: 'View pricing', href: pricingHref('en', 'seedance-2-0-fast-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Seedance 2.0 Fast example',
      description: 'Rapid motion draft sequence',
      renderLabel: 'View draft',
      badges: ['Fast route', 'Draft pass', '9:16'],
      altContext: 'fast Seedance draft with a moving product camera test',
    },
    features: [
      { title: 'Fast draft route', body: 'Run quicker Seedance passes for early creative decisions.', tone: 'duration' },
      { title: 'Timing tests', body: 'Check pacing, camera beats and shot rhythm before polishing.', tone: 'continuity' },
      { title: 'Reference tests', body: 'Try supported text, image and reference inputs for shot planning.', tone: 'reference' },
      { title: 'Up to 720p', body: 'Use lower-resolution outputs for draft review loops.', tone: 'quality' },
      { title: 'Max 15s', body: 'Draft clips up to 15 seconds per generation.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Fast or Seedance 2.0?',
        body: 'Use Fast for draft passes, timing tests and A/B motion checks. Move to Seedance 2.0 when you need the production route.',
        cta: {
          label: 'Compare Fast vs 2.0',
          href: compareHref('en', 'seedance-2-0-fast', 'seedance-2-0'),
        },
      },
      {
        title: 'Planning multiple shots?',
        body: 'Use short draft loops to lock motion direction, camera language and reference behavior before committing to a final pass.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need another fast baseline?',
        body: 'Compare Seedance Fast with other fast routes when you are choosing a draft engine for social or ad concepts.',
        cta: {
          label: 'Compare with LTX Fast',
          href: compareHref('en', 'seedance-2-0-fast', 'ltx-2-3-fast'),
        },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Start with the shot idea, movement, camera direction and intended pacing.' },
      { title: 'Image reference', body: 'Use a start image to test composition, product framing or style direction.' },
      { title: 'Reference input', body: 'Use supported references to check whether a draft follows the intended visual anchors.' },
      { title: 'Motion variant', body: 'Run small prompt changes to compare camera speed, subject movement and scene rhythm.' },
      { title: 'Final handoff', body: 'Carry the strongest draft choices into the production route when polish matters.' },
    ],
    pricingCopy: {
      title: 'Seedance 2.0 Fast draft pricing',
      subtitle: 'Preset draft totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 720p',
    },
    meta: {
      title: 'Seedance 2.0 Fast: Draft Pricing & Iteration | MaxVideoAI',
      description:
        'Use Seedance 2.0 Fast for rapid Seedance draft passes, timing tests, A/B motion checks and reference-guided shot planning before final renders.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'WORKFLOW BYTEDANCE FAST POUR BROUILLONS',
      title: 'Seedance 2.0 Fast',
      subtitle: 'Des brouillons rapides Seedance pour tests de rythme, variantes de mouvement et planification de plans avec références.',
      subtitleHighlights: ['brouillons rapides', 'tests de rythme', 'variantes de mouvement'],
      paragraph:
        'Utilisez Seedance 2.0 Fast comme workflow Seedance plus rapide pour itérer avant un rendu final : cadrer le timing, comparer des mouvements et tester textes, images ou références en cycles courts.',
      primaryCta: { label: 'Créer un brouillon Seedance Fast', href: '/app?engine=seedance-2-0-fast' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr') },
      quickLinks: [
        { label: 'Comparer vs 2.0', href: compareHref('fr', 'seedance-2-0-fast', 'seedance-2-0') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'seedance-2-0-fast-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Seedance 2.0 Fast',
      description: 'Séquence de brouillon rapide',
      renderLabel: 'Voir le brouillon',
      badges: ['Fast', 'Brouillon', '9:16'],
      altContext: 'brouillon Seedance rapide avec test de caméra produit',
    },
    features: [
      { title: 'Workflow brouillon', body: 'Lancez des passes Seedance plus rapides pour décider tôt.', tone: 'duration' },
      { title: 'Tests de rythme', body: 'Vérifiez pacing, caméra et mouvement avant le rendu final.', tone: 'continuity' },
      { title: 'Tests de références', body: 'Essayez textes, images et références prises en charge.', tone: 'reference' },
      { title: 'Jusqu’à 720p', body: 'Utilisez une résolution adaptée aux revues de brouillons.', tone: 'quality' },
      { title: 'Max 15 s', body: 'Brouillons jusqu’à 15 secondes par génération.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Fast ou Seedance 2.0 ?',
        body: 'Utilisez Fast pour les brouillons, tests de rythme et variantes de mouvement. Passez à Seedance 2.0 pour le workflow de production.',
        cta: { label: 'Comparer Fast vs 2.0', href: compareHref('fr', 'seedance-2-0-fast', 'seedance-2-0') },
      },
      {
        title: 'Vous planifiez plusieurs plans ?',
        body: 'Itérez en cycles courts pour fixer mouvement, caméra et comportement des références avant la passe finale.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin d’un autre repère rapide ?',
        body: 'Comparez Seedance Fast à d’autres workflows rapides pour choisir un moteur de brouillon social ou publicitaire.',
        cta: { label: 'Comparer avec LTX Fast', href: compareHref('fr', 'seedance-2-0-fast', 'ltx-2-3-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Commencez par l’idée du plan, le mouvement, la caméra et le rythme voulu.' },
      { title: 'Référence image', body: 'Testez composition, cadrage produit ou direction de style avec une image de départ.' },
      { title: 'Entrée de référence', body: 'Vérifiez si le brouillon suit les ancrages visuels pris en charge.' },
      { title: 'Variante de mouvement', body: 'Comparez vitesse caméra, mouvement sujet et rythme avec de petites variations.' },
      { title: 'Passage final', body: 'Réutilisez les meilleurs choix de brouillon dans le workflow de production.' },
    ],
    pricingCopy: {
      title: 'Prix des brouillons Seedance 2.0 Fast',
      subtitle: 'Prix totaux par scénario de brouillon — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 720p',
    },
    meta: {
      title: 'Seedance 2.0 Fast : prix brouillons et itérations | MaxVideoAI',
      description:
        'Utilisez Seedance 2.0 Fast pour des brouillons rapides, tests de rythme, variantes de mouvement et plans guidés par références avant rendu final.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA BYTEDANCE FAST PARA BORRADORES',
      title: 'Seedance 2.0 Fast',
      subtitle: 'Ciclos de borradores rápidos de Seedance para pruebas de ritmo, variantes de movimiento y planificación con referencias.',
      subtitleHighlights: ['borradores rápidos', 'pruebas de ritmo', 'variantes de movimiento'],
      paragraph:
        'Usa Seedance 2.0 Fast como la ruta más rápida de Seedance para iterar antes del render final: ajustar timing, comparar movimiento y probar texto, imagen o referencias en ciclos cortos.',
      primaryCta: { label: 'Crear borrador con Seedance Fast', href: '/app?engine=seedance-2-0-fast' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es') },
      quickLinks: [
        { label: 'Comparar con 2.0', href: compareHref('es', 'seedance-2-0-fast', 'seedance-2-0') },
        { label: 'Ver precios', href: pricingHref('es', 'seedance-2-0-fast-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Seedance 2.0 Fast',
      description: 'Secuencia rápida de borrador',
      renderLabel: 'Ver borrador',
      badges: ['Fast', 'Borrador', '9:16'],
      altContext: 'borrador rápido de Seedance con prueba de cámara para producto',
    },
    features: [
      { title: 'Ruta de borrador', body: 'Ejecuta pasadas rápidas de Seedance para decidir antes.', tone: 'duration' },
      { title: 'Pruebas de ritmo', body: 'Revisa pacing, cámara y movimiento antes del render final.', tone: 'continuity' },
      { title: 'Pruebas con referencias', body: 'Ensaya texto, imagen y referencias compatibles.', tone: 'reference' },
      { title: 'Hasta 720p', body: 'Usa salidas de menor resolución para revisar borradores.', tone: 'quality' },
      { title: 'Max 15 s', body: 'Borradores de hasta 15 segundos por generación.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Fast o Seedance 2.0?',
        body: 'Usa Fast para borradores, pruebas de ritmo y variantes de movimiento. Pasa a Seedance 2.0 para el flujo de producción.',
        cta: { label: 'Comparar Fast vs 2.0', href: compareHref('es', 'seedance-2-0-fast', 'seedance-2-0') },
      },
      {
        title: '¿Planificas varios planos?',
        body: 'Itera en ciclos cortos para fijar movimiento, cámara y comportamiento de referencias antes de la pasada final.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas otra base rápida?',
        body: 'Compara Seedance Fast con otras rutas rápidas para elegir motor de borradores sociales o publicitarios.',
        cta: { label: 'Comparar con LTX Fast', href: compareHref('es', 'seedance-2-0-fast', 'ltx-2-3-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Empieza con la idea del plano, movimiento, cámara y ritmo previsto.' },
      { title: 'Referencia de imagen', body: 'Prueba composición, encuadre de producto o estilo con una imagen inicial.' },
      { title: 'Entrada de referencia', body: 'Comprueba si el borrador sigue los anclajes visuales compatibles.' },
      { title: 'Variante de movimiento', body: 'Compara velocidad de cámara, movimiento del sujeto y ritmo con pequeños cambios.' },
      { title: 'Paso final', body: 'Lleva las mejores decisiones del borrador a la ruta de producción.' },
    ],
    pricingCopy: {
      title: 'Precios de borradores Seedance 2.0 Fast',
      subtitle: 'Precios totales por escenario de borrador. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 720p',
    },
    meta: {
      title: 'Seedance 2.0 Fast: precios de borradores e iteración | MaxVideoAI',
      description:
        'Usa Seedance 2.0 Fast para borradores rápidos, pruebas de ritmo, variantes de movimiento y planificación con referencias antes del render final.',
    },
  },
};

const LTX_23_FAST_COPY: Record<AppLocale, LocalizedCopyWithoutPricingScenarios> = {
  en: {
    hero: {
      eyebrow: 'LTX FAST DRAFT ROUTE',
      title: 'LTX 2.3 Fast',
      subtitle: 'Fast visual exploration for prompt testing, lower-cost draft loops, and vertical/social drafts.',
      subtitleHighlights: ['visual exploration', 'prompt testing', 'vertical/social drafts'],
      paragraph:
        'Use LTX 2.3 Fast for fast text-to-video and image-to-video exploration when you need to test prompts, compare looks, and prepare social drafts before choosing a final production route.',
      primaryCta: { label: 'Draft with LTX 2.3 Fast', href: '/app?engine=ltx-2-3-fast' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', LTX_EXAMPLES_FAMILY_SLUG) },
      quickLinks: [
        { label: 'Compare vs Pro', href: compareHref('en', 'ltx-2-3-fast', 'ltx-2-3-pro') },
        { label: 'View pricing', href: pricingHref('en', 'ltx-2-3-fast-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'LTX 2.3 Fast example',
      description: 'Fast visual exploration draft',
      renderLabel: 'View draft',
      badges: ['Fast route', '10s', '16:9'],
      altContext: 'LTX 2.3 Fast cinematic draft example',
    },
    features: [
      { title: 'Visual exploration', body: 'Move through look, style and scene options quickly.', tone: 'quality' },
      { title: 'Prompt testing', body: 'Compare prompt wording before committing to a final route.', tone: 'reference' },
      { title: 'Image-to-video drafts', body: 'Use a start image when the draft needs a visual anchor.', tone: 'reference' },
      { title: 'Vertical/social drafts', body: 'Sketch short concepts for social formats and creative reviews.', tone: 'continuity' },
      { title: 'Max 20s', body: 'Draft clips up to 20 seconds per generation.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Fast or LTX 2.3 Pro?',
        body: 'Use Fast for visual exploration and prompt tests. Use Pro when you need the broader production workflow exposed by the Pro route.',
        cta: { label: 'Compare Fast vs Pro', href: compareHref('en', 'ltx-2-3-fast', 'ltx-2-3-pro') },
      },
      {
        title: 'Testing social concepts?',
        body: 'Draft vertical ideas, ad hooks and style directions before spending time on a final candidate.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Choosing a fast draft engine?',
        body: 'Compare LTX Fast with Seedance Fast when speed and iteration cost matter more than final polish.',
        cta: { label: 'Compare with Seedance Fast', href: compareHref('en', 'ltx-2-3-fast', 'seedance-2-0-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Test subject, style, camera and format instructions with short prompt variants.' },
      { title: 'Start image', body: 'Use image-to-video when a visual seed should define composition or product framing.' },
      { title: 'Vertical draft', body: 'Frame early social concepts around 9:16 or 16:9 review needs.' },
      { title: 'Look comparison', body: 'Run prompt variants to compare lighting, color and motion direction.' },
      { title: 'Production handoff', body: 'Move the strongest draft into the appropriate final route once the concept is clear.' },
    ],
    pricingCopy: {
      title: 'LTX 2.3 Fast draft pricing',
      subtitle: 'Preset draft totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Longer drafts at 1080p',
    },
    meta: {
      title: 'LTX 2.3 Fast: Pricing, Max Length & Fast vs Pro',
      description:
        'Compare LTX 2.3 Fast pricing, max length, resolution limits and when to use Fast instead of LTX 2.3 Pro for draft loops and prompt testing.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'WORKFLOW LTX FAST POUR BROUILLONS',
      title: 'LTX 2.3 Fast',
      subtitle:
        'Une exploration visuelle rapide pour tests de prompts, boucles de brouillon moins coûteuses et brouillons verticaux/social.',
      subtitleHighlights: ['exploration visuelle', 'tests de prompts', 'brouillons verticaux/social'],
      paragraph:
        'Utilisez LTX 2.3 Fast pour explorer vite en text-to-video et image-to-video : tester des prompts, comparer des directions visuelles et préparer des brouillons sociaux avant un rendu final.',
      primaryCta: { label: 'Créer un brouillon LTX Fast', href: '/app?engine=ltx-2-3-fast' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', LTX_EXAMPLES_FAMILY_SLUG) },
      quickLinks: [
        { label: 'Comparer vs Pro', href: compareHref('fr', 'ltx-2-3-fast', 'ltx-2-3-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'ltx-2-3-fast-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple LTX 2.3 Fast',
      description: 'Brouillon d’exploration visuelle rapide',
      renderLabel: 'Voir le brouillon',
      badges: ['Fast', '10 s', '16:9'],
      altContext: 'exemple de brouillon cinématique LTX 2.3 Fast',
    },
    features: [
      { title: 'Exploration visuelle', body: 'Parcourez rapidement looks, styles et scènes.', tone: 'quality' },
      { title: 'Tests de prompts', body: 'Comparez les formulations avant un workflow final.', tone: 'reference' },
      { title: 'Brouillons image-to-video', body: 'Utilisez une image de départ comme ancrage visuel.', tone: 'reference' },
      { title: 'Brouillons sociaux', body: 'Esquissez des concepts courts pour revues créatives.', tone: 'continuity' },
      { title: 'Max 20 s', body: 'Brouillons jusqu’à 20 secondes par génération.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Fast ou LTX 2.3 Pro ?',
        body: 'Utilisez Fast pour explorer et tester des prompts. Choisissez Pro pour le workflow de production plus large exposé par la route Pro.',
        cta: { label: 'Comparer Fast vs Pro', href: compareHref('fr', 'ltx-2-3-fast', 'ltx-2-3-pro') },
      },
      {
        title: 'Vous testez des concepts sociaux ?',
        body: 'Brouillonnez idées verticales, hooks publicitaires et directions de style avant de finaliser.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Choisir un moteur rapide ?',
        body: 'Comparez LTX Fast et Seedance Fast quand vitesse et coût d’itération priment sur la finition.',
        cta: { label: 'Comparer avec Seedance Fast', href: compareHref('fr', 'ltx-2-3-fast', 'seedance-2-0-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Testez sujet, style, caméra et format avec de courtes variantes.' },
      { title: 'Image de départ', body: 'Utilisez image-to-video quand une base visuelle doit guider composition ou produit.' },
      { title: 'Brouillon vertical', body: 'Cadrez tôt les concepts sociaux en 9:16 ou 16:9.' },
      { title: 'Comparaison de look', body: 'Comparez lumière, couleur et mouvement avec des variantes de prompt.' },
      { title: 'Passage production', body: 'Déplacez le meilleur brouillon vers le workflow final adapté.' },
    ],
    pricingCopy: {
      title: 'Prix des brouillons LTX 2.3 Fast',
      subtitle: 'Prix totaux par scénario de brouillon — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Brouillons longs en 1080p',
    },
    meta: {
      title: 'LTX 2.3 Fast : prix brouillons et tests de prompts | MaxVideoAI',
      description:
        'Utilisez LTX 2.3 Fast pour des boucles de brouillon rapides, exploration visuelle, tests de prompts et vidéos verticales ou sociales.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA LTX FAST PARA BORRADORES',
      title: 'LTX 2.3 Fast',
      subtitle:
        'Una exploración visual rápida para pruebas de prompts, ciclos de borrador de menor coste y borradores verticales/sociales.',
      subtitleHighlights: ['exploración visual', 'pruebas de prompts', 'borradores verticales/sociales'],
      paragraph:
        'Usa LTX 2.3 Fast para explorar rápido con texto a video e imagen a video: probar prompts, comparar estilos y preparar borradores sociales antes de una ruta final.',
      primaryCta: { label: 'Crear borrador con LTX Fast', href: '/app?engine=ltx-2-3-fast' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', LTX_EXAMPLES_FAMILY_SLUG) },
      quickLinks: [
        { label: 'Comparar con Pro', href: compareHref('es', 'ltx-2-3-fast', 'ltx-2-3-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'ltx-2-3-fast-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo LTX 2.3 Fast',
      description: 'Borrador rápido de exploración visual',
      renderLabel: 'Ver borrador',
      badges: ['Fast', '10s', '16:9'],
      altContext: 'ejemplo de borrador cinematográfico de LTX 2.3 Fast',
    },
    features: [
      { title: 'Exploración visual', body: 'Avanza rápido por opciones de look, estilo y escena.', tone: 'quality' },
      { title: 'Pruebas de prompts', body: 'Compara formulaciones antes de una ruta final.', tone: 'reference' },
      { title: 'Borradores imagen a video', body: 'Usa una imagen inicial cuando necesites un ancla visual.', tone: 'reference' },
      { title: 'Borradores sociales', body: 'Boceta conceptos cortos para formatos sociales y revisiones.', tone: 'continuity' },
      { title: 'Max 20 s', body: 'Borradores de hasta 20 segundos por generación.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Fast o LTX 2.3 Pro?',
        body: 'Usa Fast para explorar y probar prompts. Usa Pro cuando necesites el flujo de producción más amplio de la ruta Pro.',
        cta: { label: 'Comparar Fast vs Pro', href: compareHref('es', 'ltx-2-3-fast', 'ltx-2-3-pro') },
      },
      {
        title: '¿Pruebas conceptos sociales?',
        body: 'Borrador de ideas verticales, hooks de anuncio y direcciones de estilo antes del candidato final.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Eliges un motor rápido?',
        body: 'Compara LTX Fast con Seedance Fast cuando importan velocidad y coste de iteración.',
        cta: { label: 'Comparar con Seedance Fast', href: compareHref('es', 'ltx-2-3-fast', 'seedance-2-0-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Prueba sujeto, estilo, cámara y formato con variantes cortas.' },
      { title: 'Imagen inicial', body: 'Usa imagen a video cuando una base visual deba guiar composición o producto.' },
      { title: 'Borrador vertical', body: 'Enmarca temprano conceptos sociales en 9:16 o 16:9.' },
      { title: 'Comparación de look', body: 'Compara luz, color y movimiento con variantes de prompt.' },
      { title: 'Paso a producción', body: 'Lleva el mejor borrador a la ruta final adecuada.' },
    ],
    pricingCopy: {
      title: 'Precios de borradores LTX 2.3 Fast',
      subtitle: 'Precios totales por escenario de borrador. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Borradores largos en 1080p',
    },
    meta: {
      title: 'LTX 2.3 Fast: precios de borradores y prompts | MaxVideoAI',
      description:
        'Usa LTX 2.3 Fast para ciclos rápidos de borrador, exploración visual, pruebas de prompts y videos verticales o sociales.',
    },
  },
};

const VEO_31_COPY: Record<AppLocale, LocalizedCopyWithoutPricingScenarios> = {
  en: {
    hero: {
      eyebrow: 'GOOGLE PREMIUM VIDEO MODEL',
      title: 'Veo 3.1',
      subtitle: 'Short polished clips with native audio, reference-guided shots, and first-last or extend workflows.',
      subtitleHighlights: ['short polished clips', 'native audio', 'reference-guided shots'],
      paragraph:
        'Use Veo 3.1 for premium 4, 6, or 8 second shots when you need text-to-video, start images, reference stills, first/last-frame control, or clip extension inside MaxVideoAI.',
      primaryCta: { label: 'Generate with Veo 3.1', href: '/app?engine=veo-3-1' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', VEO_EXAMPLES_FAMILY_SLUG) },
      quickLinks: [
        { label: 'Compare with Kling', href: compareHref('en', 'veo-3-1', 'kling-3-pro') },
        { label: 'View pricing', href: pricingHref('en', 'veo-3-1-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Veo 3.1 example',
      description: 'Polished native-audio video shot',
      renderLabel: 'View render',
      badges: ['Native audio', '8s', '1080p'],
      altContext: 'premium Veo 3.1 cinematic shot with controlled motion',
    },
    features: [
      { title: 'Premium short clips', body: 'Build polished 4, 6 or 8 second shots for ads, launches and narrative beats.', tone: 'quality' },
      { title: 'Native audio', body: 'Generate synchronized ambience, dialogue or sound direction on supported routes.', tone: 'audio' },
      { title: 'Reference stills', body: 'Use start images or multiple references to anchor identity, styling and wardrobe.', tone: 'reference' },
      { title: 'First-last control', body: 'Bridge opening and ending frames when the final pose or product placement matters.', tone: 'continuity' },
      { title: 'Extend route', body: 'Continue an existing Veo render without changing engines.', tone: 'duration' },
      { title: '720p or 1080p', body: 'Choose the exposed MaxVideoAI resolutions before generation.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: 'When should you choose Veo 3.1?',
        body: 'Choose Veo 3.1 for short polished shots where motion quality, audio and reference fidelity matter more than the lowest iteration cost.',
        cta: { label: 'Start a Veo 3.1 render', href: '/app?engine=veo-3-1' },
      },
      {
        title: 'Need reference control?',
        body: 'Use a start image, multiple reference stills, or first-last frames when the shot has to respect a product, character or ending composition.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Comparing production routes?',
        body: 'Compare Veo 3.1 with Kling 3 Pro when you are deciding between premium short polish and longer storyboard-style control.',
        cta: { label: 'Compare Veo and Kling', href: compareHref('en', 'veo-3-1', 'kling-3-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Describe the subject, camera path, pacing, lighting and audio intention clearly.' },
      { title: 'Start image', body: 'Use one still to define the opening composition and visual identity.' },
      { title: 'Reference set', body: 'Attach still references when wardrobe, product details or style need to stay consistent.' },
      { title: 'First-last frames', body: 'Provide opening and closing images to guide the transition and final landing point.' },
      { title: 'Extend pass', body: 'Continue a Veo clip when the idea needs more time after the first render.' },
    ],
    pricingCopy: {
      title: 'Veo 3.1 pricing at a glance',
      subtitle: 'Audio-on preset totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 8s at 1080p',
    },
    meta: {
      title: 'Veo 3.1: Pricing, Native Audio & References | MaxVideoAI',
      description:
        'Generate Veo 3.1 clips with native audio, text prompts, image references, first-last frame control and extend workflows in MaxVideoAI.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODÈLE VIDÉO PREMIUM GOOGLE',
      title: 'Veo 3.1',
      subtitle: 'Des clips courts finalisés avec audio natif, plans guidés par références et workflows first-last ou extend.',
      subtitleHighlights: ['clips courts finalisés', 'audio natif', 'plans guidés par références'],
      paragraph:
        'Utilisez Veo 3.1 pour des plans premium de 4, 6 ou 8 secondes quand vous avez besoin de text-to-video, images de départ, références fixes, contrôle first/last-frame ou extension de clip dans MaxVideoAI.',
      primaryCta: { label: 'Générer avec Veo 3.1', href: '/app?engine=veo-3-1' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', VEO_EXAMPLES_FAMILY_SLUG) },
      quickLinks: [
        { label: 'Comparer avec Kling', href: compareHref('fr', 'veo-3-1', 'kling-3-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'veo-3-1-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Veo 3.1',
      description: 'Plan vidéo finalisé avec audio natif',
      renderLabel: 'Voir le rendu',
      badges: ['Audio natif', '8 s', '1080p'],
      altContext: 'plan cinématographique premium Veo 3.1 avec mouvement contrôlé',
    },
    features: [
      { title: 'Clips courts premium', body: 'Créez des plans de 4, 6 ou 8 secondes pour pubs, lancements et séquences narratives.', tone: 'quality' },
      { title: 'Audio natif', body: 'Générez ambiance, dialogue ou intention sonore synchronisés sur les routes prises en charge.', tone: 'audio' },
      { title: 'Références fixes', body: 'Utilisez images de départ ou références multiples pour ancrer identité, style et tenue.', tone: 'reference' },
      { title: 'Contrôle first-last', body: 'Reliez image d’ouverture et image finale quand la pose ou le produit doit tomber juste.', tone: 'continuity' },
      { title: 'Extension', body: 'Prolongez un rendu Veo existant sans changer de moteur.', tone: 'duration' },
      { title: '720p ou 1080p', body: 'Choisissez les résolutions exposées dans MaxVideoAI avant génération.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: 'Quand choisir Veo 3.1 ?',
        body: 'Choisissez Veo 3.1 pour des plans courts et finalisés où qualité de mouvement, audio et fidélité aux références comptent plus que le coût d’itération.',
        cta: { label: 'Lancer un rendu Veo 3.1', href: '/app?engine=veo-3-1' },
      },
      {
        title: 'Besoin de contrôle par références ?',
        body: 'Utilisez une image de départ, plusieurs références ou des images first-last quand le plan doit respecter un produit, un personnage ou une composition finale.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Comparer les routes production ?',
        body: 'Comparez Veo 3.1 et Kling 3 Pro pour choisir entre finition premium courte et contrôle storyboard sur des plans plus longs.',
        cta: { label: 'Comparer Veo et Kling', href: compareHref('fr', 'veo-3-1', 'kling-3-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Décrivez sujet, mouvement caméra, rythme, lumière et intention audio.' },
      { title: 'Image de départ', body: 'Utilisez une image fixe pour définir composition initiale et identité visuelle.' },
      { title: 'Jeu de références', body: 'Ajoutez des images quand tenue, détails produit ou style doivent rester cohérents.' },
      { title: 'Images first-last', body: 'Fournissez ouverture et fin pour guider la transition et le point d’arrivée.' },
      { title: 'Passe extend', body: 'Prolongez un clip Veo quand l’idée a besoin de temps après le premier rendu.' },
    ],
    pricingCopy: {
      title: 'Prix Veo 3.1 en un coup d’œil',
      subtitle: 'Prix totaux avec audio activé — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 8 s en 1080p',
    },
    meta: {
      title: 'Veo 3.1 : tarifs, audio natif et références | MaxVideoAI',
      description:
        'Générez avec Veo 3.1 : audio natif, prompts texte, images de référence, contrôle first-last et extension dans MaxVideoAI.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO DE VIDEO PREMIUM DE GOOGLE',
      title: 'Veo 3.1',
      subtitle: 'Clips cortos pulidos con audio nativo, tomas guiadas por referencias y flujos first-last o extend.',
      subtitleHighlights: ['clips cortos pulidos', 'audio nativo', 'tomas guiadas por referencias'],
      paragraph:
        'Usa Veo 3.1 para tomas premium de 4, 6 u 8 segundos cuando necesitas texto a video, imágenes iniciales, referencias fijas, control first/last-frame o extensión de clip dentro de MaxVideoAI.',
      primaryCta: { label: 'Generar con Veo 3.1', href: '/app?engine=veo-3-1' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', VEO_EXAMPLES_FAMILY_SLUG) },
      quickLinks: [
        { label: 'Comparar con Kling', href: compareHref('es', 'veo-3-1', 'kling-3-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'veo-3-1-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Veo 3.1',
      description: 'Toma de video pulida con audio nativo',
      renderLabel: 'Ver resultado',
      badges: ['Audio nativo', '8 s', '1080p'],
      altContext: 'toma cinematográfica premium de Veo 3.1 con movimiento controlado',
    },
    features: [
      { title: 'Clips cortos premium', body: 'Crea tomas de 4, 6 u 8 segundos para anuncios, lanzamientos y momentos narrativos.', tone: 'quality' },
      { title: 'Audio nativo', body: 'Genera ambiente, diálogo o intención sonora sincronizada en las rutas compatibles.', tone: 'audio' },
      { title: 'Referencias fijas', body: 'Usa imágenes iniciales o varias referencias para anclar identidad, estilo y vestuario.', tone: 'reference' },
      { title: 'Control first-last', body: 'Conecta imagen inicial y final cuando la pose o el producto deben cerrar con precisión.', tone: 'continuity' },
      { title: 'Extensión', body: 'Continúa un resultado de Veo sin cambiar de motor.', tone: 'duration' },
      { title: '720p o 1080p', body: 'Elige las resoluciones expuestas en MaxVideoAI antes de generar.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: '¿Cuándo conviene Veo 3.1?',
        body: 'Elige Veo 3.1 para tomas cortas y pulidas donde importan la calidad del movimiento, el audio y la fidelidad a referencias más que el costo de iterar.',
        cta: { label: 'Iniciar un resultado Veo 3.1', href: '/app?engine=veo-3-1' },
      },
      {
        title: '¿Necesitas control con referencias?',
        body: 'Usa una imagen inicial, varias referencias o cuadros first-last cuando la toma debe respetar un producto, personaje o composición final.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Comparas rutas de producción?',
        body: 'Compara Veo 3.1 con Kling 3 Pro para decidir entre acabado premium corto y control tipo storyboard en tomas más largas.',
        cta: { label: 'Comparar Veo y Kling', href: compareHref('es', 'veo-3-1', 'kling-3-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Describe sujeto, ruta de cámara, ritmo, iluminación e intención de audio.' },
      { title: 'Imagen inicial', body: 'Usa una imagen fija para definir composición inicial e identidad visual.' },
      { title: 'Set de referencias', body: 'Adjunta imágenes cuando vestuario, detalles de producto o estilo deben mantenerse.' },
      { title: 'Cuadros first-last', body: 'Aporta inicio y cierre para guiar la transición y el punto final.' },
      { title: 'Pasada extend', body: 'Continúa un clip de Veo cuando la idea necesita más tiempo después del primer resultado.' },
    ],
    pricingCopy: {
      title: 'Precios de Veo 3.1 de un vistazo',
      subtitle: 'Precios totales con audio activado. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 8 s en 1080p',
    },
    meta: {
      title: 'Veo 3.1: precios, audio nativo y referencias | MaxVideoAI',
      description:
        'Genera con Veo 3.1: audio nativo, prompts de texto, imágenes de referencia, control first-last y extensión en MaxVideoAI.',
    },
  },
};

const KLING_3_PRO_COPY: Record<AppLocale, LocalizedCopyWithoutPricingScenarios> = {
  en: {
    hero: {
      eyebrow: 'KLING PRO VIDEO MODEL',
      title: 'Kling 3 Pro',
      subtitle: 'Storyboard control, native audio, and 15s 1080p production clips for structured sequences.',
      subtitleHighlights: ['storyboard control', 'native audio', '15s 1080p production clips'],
      paragraph:
        'Use Kling 3 Pro when you need text-to-video or image-led shots with strong narrative control: 3 to 15 seconds, 1080p output, three aspect ratios, negative prompts, CFG scale and optional end-frame guidance.',
      primaryCta: { label: 'Generate with Kling 3 Pro', href: '/app?engine=kling-3-pro' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', KLING_EXAMPLES_FAMILY_SLUG) },
      quickLinks: [
        { label: 'Compare with Veo', href: compareHref('en', 'kling-3-pro', 'veo-3-1') },
        { label: 'View pricing', href: pricingHref('en', 'kling-3-pro-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Kling 3 Pro example',
      description: 'Controlled 1080p production sequence',
      renderLabel: 'View render',
      badges: ['Native audio', '15s cap', '1080p'],
      altContext: 'Kling 3 Pro cinematic sequence with storyboard-style shot control',
    },
    features: [
      { title: 'Storyboard control', body: 'Structure scene beats and camera direction for narrative shots.', tone: 'continuity' },
      { title: 'Native audio', body: 'Keep audio on for synchronized ambience and production context.', tone: 'audio' },
      { title: '3-15 seconds', body: 'Pick the exact duration range exposed in MaxVideoAI.', tone: 'duration' },
      { title: '1080p output', body: 'Use the dedicated 1080p route for production review and publishing prep.', tone: 'quality' },
      { title: 'Image and end frame', body: 'Start from an image and optionally steer the ending frame.', tone: 'reference' },
      { title: 'CFG and negative prompt', body: 'Tune prompt adherence and suppress unwanted artifacts.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: 'When should you choose Kling 3 Pro?',
        body: 'Choose Kling 3 Pro for storyboard-style control, longer 15s clips, native audio and precise 1080p shots.',
        cta: { label: 'Start a Kling 3 Pro render', href: '/app?engine=kling-3-pro' },
      },
      {
        title: 'Need tighter shot direction?',
        body: 'Use clear scene beats, a negative prompt, CFG scale and an optional end frame when the camera path needs guardrails.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Comparing premium routes?',
        body: 'Compare Kling 3 Pro with Veo 3.1 when choosing between longer controlled sequences and short premium polish.',
        cta: { label: 'Compare Kling and Veo', href: compareHref('en', 'kling-3-pro', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text sequence', body: 'Write a compact storyboard with subject, scene beats, camera and audio direction.' },
      { title: 'Start image', body: 'Use image mode when identity, product shape or composition must start from a still.' },
      { title: 'End frame', body: 'Add an ending image when the final pose or product placement needs to be controlled.' },
      { title: 'Negative prompt', body: 'Call out blur, distortion, extra limbs or off-brand details to reduce unwanted output.' },
      { title: 'CFG scale', body: 'Adjust adherence when a prompt needs either stricter control or more natural motion.' },
    ],
    pricingCopy: {
      title: 'Kling 3 Pro pricing at a glance',
      subtitle: 'Audio-on 1080p preset totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 15s at 1080p',
    },
    meta: {
      title: 'Kling 3 Pro: Pricing, Native Audio & 15s Control | MaxVideoAI',
      description:
        'Generate Kling 3 Pro clips with storyboard control, native audio, 1080p output, 3-15s duration, negative prompts, CFG scale and optional end-frame guidance.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODÈLE VIDÉO KLING PRO',
      title: 'Kling 3 Pro',
      subtitle: 'Contrôle storyboard, audio natif et clips de production 1080p jusqu’à 15 s pour des séquences structurées.',
      subtitleHighlights: ['contrôle storyboard', 'audio natif', 'clips de production 1080p jusqu’à 15 s'],
      paragraph:
        'Utilisez Kling 3 Pro pour des plans text-to-video ou guidés par image avec un fort contrôle narratif : 3 à 15 secondes, sortie 1080p, trois ratios, prompt négatif, CFG scale et image finale optionnelle.',
      primaryCta: { label: 'Générer avec Kling 3 Pro', href: '/app?engine=kling-3-pro' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', KLING_EXAMPLES_FAMILY_SLUG) },
      quickLinks: [
        { label: 'Comparer avec Veo', href: compareHref('fr', 'kling-3-pro', 'veo-3-1') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'kling-3-pro-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Kling 3 Pro',
      description: 'Séquence de production contrôlée en 1080p',
      renderLabel: 'Voir le rendu',
      badges: ['Audio natif', 'Max 15 s', '1080p'],
      altContext: 'séquence cinématographique Kling 3 Pro avec contrôle de plans façon storyboard',
    },
    features: [
      { title: 'Contrôle storyboard', body: 'Structurez les beats de scène et la caméra pour des plans narratifs.', tone: 'continuity' },
      { title: 'Audio natif', body: 'Gardez l’audio activé pour une ambiance synchronisée et un contexte de production.', tone: 'audio' },
      { title: '3 à 15 secondes', body: 'Choisissez la plage de durée exposée dans MaxVideoAI.', tone: 'duration' },
      { title: 'Sortie 1080p', body: 'Utilisez la route 1080p dédiée pour revue production et préparation publication.', tone: 'quality' },
      { title: 'Image et fin optionnelle', body: 'Démarrez depuis une image et guidez éventuellement le dernier cadre.', tone: 'reference' },
      { title: 'CFG et prompt négatif', body: 'Ajustez l’adhérence au prompt et réduisez les artefacts indésirables.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: 'Quand choisir Kling 3 Pro ?',
        body: 'Choisissez Kling 3 Pro pour le contrôle façon storyboard, les clips jusqu’à 15 s, l’audio natif et des plans 1080p précis.',
        cta: { label: 'Lancer un rendu Kling 3 Pro', href: '/app?engine=kling-3-pro' },
      },
      {
        title: 'Besoin d’une direction de plan plus stricte ?',
        body: 'Utilisez beats de scène, prompt négatif, CFG scale et image finale optionnelle quand la caméra doit rester cadrée.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Comparer les routes premium ?',
        body: 'Comparez Kling 3 Pro et Veo 3.1 pour choisir entre séquences plus longues et contrôlées ou finition courte premium.',
        cta: { label: 'Comparer Kling et Veo', href: compareHref('fr', 'kling-3-pro', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Séquence texte', body: 'Rédigez un storyboard compact avec sujet, beats, caméra et direction audio.' },
      { title: 'Image de départ', body: 'Utilisez le mode image quand identité, forme produit ou composition doivent partir d’un visuel fixe.' },
      { title: 'Image finale', body: 'Ajoutez une image d’arrivée quand la pose ou le produit final doit être contrôlé.' },
      { title: 'Prompt négatif', body: 'Signalez flou, distorsion, membres en trop ou détails hors marque pour réduire les erreurs.' },
      { title: 'CFG scale', body: 'Ajustez l’adhérence quand le prompt exige plus de contrôle ou un mouvement plus naturel.' },
    ],
    pricingCopy: {
      title: 'Prix Kling 3 Pro en un coup d’œil',
      subtitle: 'Prix totaux 1080p avec audio activé — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 15 s en 1080p',
    },
    meta: {
      title: 'Kling 3 Pro : tarifs, audio natif et contrôle 15 s | MaxVideoAI',
      description:
        'Générez avec Kling 3 Pro : contrôle storyboard, audio natif, sortie 1080p, durée 3 à 15 s, prompt négatif, CFG scale et image finale optionnelle.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO DE VIDEO KLING PRO',
      title: 'Kling 3 Pro',
      subtitle: 'Control tipo storyboard, audio nativo y clips de producción 1080p de hasta 15 s para secuencias estructuradas.',
      subtitleHighlights: ['control tipo storyboard', 'audio nativo', 'clips de producción 1080p de hasta 15 s'],
      paragraph:
        'Usa Kling 3 Pro para tomas de texto a video o guiadas por imagen con control narrativo fuerte: 3 a 15 segundos, salida 1080p, tres ratios, prompt negativo, CFG scale y cuadro final opcional.',
      primaryCta: { label: 'Generar con Kling 3 Pro', href: '/app?engine=kling-3-pro' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', KLING_EXAMPLES_FAMILY_SLUG) },
      quickLinks: [
        { label: 'Comparar con Veo', href: compareHref('es', 'kling-3-pro', 'veo-3-1') },
        { label: 'Ver precios', href: pricingHref('es', 'kling-3-pro-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Kling 3 Pro',
      description: 'Secuencia de producción controlada en 1080p',
      renderLabel: 'Ver resultado',
      badges: ['Audio nativo', 'Máx. 15 s', '1080p'],
      altContext: 'secuencia cinematográfica de Kling 3 Pro con control de tomas tipo storyboard',
    },
    features: [
      { title: 'Control tipo storyboard', body: 'Estructura momentos de escena y cámara para tomas narrativas.', tone: 'continuity' },
      { title: 'Audio nativo', body: 'Mantén el audio activado para ambiente sincronizado y contexto de producción.', tone: 'audio' },
      { title: '3 a 15 segundos', body: 'Elige el rango de duración expuesto en MaxVideoAI.', tone: 'duration' },
      { title: 'Salida 1080p', body: 'Usa la ruta dedicada 1080p para revisión de producción y preparación de publicación.', tone: 'quality' },
      { title: 'Imagen y cuadro final', body: 'Empieza desde una imagen y guía opcionalmente el cierre.', tone: 'reference' },
      { title: 'CFG y prompt negativo', body: 'Ajusta la fidelidad al prompt y reduce artefactos no deseados.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: '¿Cuándo conviene Kling 3 Pro?',
        body: 'Elige Kling 3 Pro para control tipo storyboard, clips de hasta 15 s, audio nativo y tomas precisas en 1080p.',
        cta: { label: 'Iniciar un resultado Kling 3 Pro', href: '/app?engine=kling-3-pro' },
      },
      {
        title: '¿Necesitas dirección más precisa?',
        body: 'Usa momentos de escena, prompt negativo, CFG scale y cuadro final opcional cuando la cámara necesita límites claros.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Comparas rutas premium?',
        body: 'Compara Kling 3 Pro con Veo 3.1 para elegir entre secuencias más largas con control o acabado premium corto.',
        cta: { label: 'Comparar Kling y Veo', href: compareHref('es', 'kling-3-pro', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Secuencia de texto', body: 'Escribe un storyboard compacto con sujeto, momentos, cámara y dirección de audio.' },
      { title: 'Imagen inicial', body: 'Usa modo imagen cuando identidad, forma de producto o composición deban partir de un visual fijo.' },
      { title: 'Cuadro final', body: 'Agrega una imagen de cierre cuando la pose o el producto final deban controlarse.' },
      { title: 'Prompt negativo', body: 'Indica desenfoque, distorsión, extremidades extra o detalles fuera de marca para reducir errores.' },
      { title: 'CFG scale', body: 'Ajusta la adherencia cuando el prompt necesita más control o movimiento más natural.' },
    ],
    pricingCopy: {
      title: 'Precios de Kling 3 Pro de un vistazo',
      subtitle: 'Precios totales 1080p con audio activado. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 15 s en 1080p',
    },
    meta: {
      title: 'Kling 3 Pro: precios, audio nativo y control 15 s | MaxVideoAI',
      description:
        'Genera con Kling 3 Pro: control tipo storyboard, audio nativo, salida 1080p, duración de 3 a 15 s, prompt negativo, CFG scale y cuadro final opcional.',
    },
  },
};

const SEEDREAM_COPY: Record<AppLocale, LocalizedCopyWithoutPricingScenarios> = {
  en: {
    hero: {
      eyebrow: 'REFERENCE IMAGE PREP MODEL',
      title: 'Seedream 5.0 Lite',
      subtitle: 'Clean still references, product frames, and video reference prep before you animate in a separate model.',
      subtitleHighlights: ['clean still references', 'product frames', 'video reference prep'],
      paragraph:
        'Use Seedream as an image generation and editing workspace for source stills: create product frames, character references, ad visuals and controlled image sets before sending the strongest assets to a video model.',
      primaryCta: { label: 'Prepare references with Seedream', href: '/app/image?engine=seedream' },
      secondaryCta: { label: 'Animate with Seedance', href: modelsHref('en', 'seedance-2-0') },
      quickLinks: [
        { label: 'Open image workspace', href: '/app/image?engine=seedream' },
        { label: 'View pricing', href: pricingHref('en', 'seedream-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Seedream reference example',
      description: 'Still reference prepared for later animation',
      renderLabel: 'View still',
      badges: ['Image model', 'Up to 10 refs', '2K-4K'],
      altContext: 'Seedream product reference still prepared for a later video workflow',
    },
    features: [
      { title: 'Still reference prep', body: 'Create clean source images before handing assets to a video route.', tone: 'reference' },
      { title: 'Text or image input', body: 'Start from a prompt or edit with uploaded reference images.', tone: 'reference' },
      { title: 'Up to 10 references', body: 'Guide edits with multiple source images when details need tighter control.', tone: 'continuity' },
      { title: '2K, 3K or 4K images', body: 'Prepare higher-resolution stills for product, character and layout review.', tone: 'quality' },
      { title: 'Up to 15 images total', body: 'Generated and reference images share the exposed Seedream total.', tone: 'duration' },
      { title: 'Per-image pricing', body: 'Image presets use the shared pricing helper, not video seconds.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'When should you choose Seedream?',
        body: 'Choose Seedream when the next video pass needs cleaner product, character, style or composition references first.',
        cta: { label: 'Open Seedream image workspace', href: '/app/image?engine=seedream' },
      },
      {
        title: 'Preparing product frames?',
        body: 'Generate stills with readable labels, clean backgrounds and stable framing before using them as source assets elsewhere.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need motion next?',
        body: 'Seedream prepares the stills. Pick a video model after the reference set is ready.',
        cta: { label: 'Browse video models', href: '/models' },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompted still', body: 'Describe the exact product, character, scene, surface, lens and lighting for a clean source frame.' },
      { title: 'Reference edit', body: 'Upload source images when the output must preserve identity, product geometry or brand details.' },
      { title: 'Reference set', body: 'Create multiple stills for front, side, detail and lifestyle views before the video step.' },
      { title: 'Size choice', body: 'Use 2K for fast prep, 3K for review, or 4K when the still needs extra detail.' },
      { title: 'Video handoff', body: 'Send only the strongest stills into the chosen motion model once the visual direction is clear.' },
    ],
    pricingCopy: {
      title: 'Seedream image pricing at a glance',
      subtitle: 'Per-image preset totals - see the exact live price in the image workspace before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset image scenarios.',
      ctaLabel: 'View full pricing',
    },
    meta: {
      title: 'Seedream: Image Pricing & Reference Prep | MaxVideoAI',
      description:
        'Prepare Seedream reference images, product frames, character stills and controlled visual sets in MaxVideoAI before choosing a video model.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODÈLE DE PRÉPARATION D’IMAGES RÉFÉRENCES',
      title: 'Seedream 5.0 Lite',
      subtitle: 'Des références fixes propres, frames produit et préparation visuelle pour vidéo avant animation dans un autre modèle.',
      subtitleHighlights: ['références fixes propres', 'frames produit', 'préparation visuelle pour vidéo'],
      paragraph:
        'Utilisez Seedream comme espace de génération et retouche d’images sources : créez frames produit, références personnage, visuels publicitaires et séries contrôlées avant d’envoyer les meilleurs assets vers un modèle vidéo.',
      primaryCta: { label: 'Préparer des références avec Seedream', href: '/app/image?engine=seedream' },
      secondaryCta: { label: 'Animer avec Seedance', href: modelsHref('fr', 'seedance-2-0') },
      quickLinks: [
        { label: 'Ouvrir l’espace image', href: '/app/image?engine=seedream' },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'seedream-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple de référence Seedream',
      description: 'Image fixe préparée pour une animation ultérieure',
      renderLabel: 'Voir l’image',
      badges: ['Modèle image', 'Jusqu’à 10 refs', '2K-4K'],
      altContext: 'image référence produit Seedream préparée pour un workflow vidéo ultérieur',
    },
    features: [
      { title: 'Préparation de références', body: 'Créez des images sources propres avant de les transmettre à une route vidéo.', tone: 'reference' },
      { title: 'Prompt ou image', body: 'Partez d’un prompt ou retouchez avec des images de référence importées.', tone: 'reference' },
      { title: 'Jusqu’à 10 références', body: 'Guidez les retouches avec plusieurs sources quand les détails doivent rester précis.', tone: 'continuity' },
      { title: 'Images 2K, 3K ou 4K', body: 'Préparez des visuels plus définis pour produit, personnage et revue de composition.', tone: 'quality' },
      { title: 'Jusqu’à 15 images au total', body: 'Images générées et références partagent la limite Seedream exposée.', tone: 'duration' },
      { title: 'Prix par image', body: 'Les scénarios image utilisent le helper tarifaire partagé, pas une durée vidéo.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Quand choisir Seedream ?',
        body: 'Choisissez Seedream quand la prochaine passe vidéo a d’abord besoin de références produit, personnage, style ou composition plus propres.',
        cta: { label: 'Ouvrir l’espace image Seedream', href: '/app/image?engine=seedream' },
      },
      {
        title: 'Vous préparez des frames produit ?',
        body: 'Générez des images avec labels lisibles, arrière-plans propres et cadrage stable avant de les utiliser comme assets source.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin de mouvement ensuite ?',
        body: 'Seedream prépare les images fixes. Choisissez un modèle vidéo une fois le jeu de références prêt.',
        cta: { label: 'Parcourir les modèles vidéo', href: modelsIndexHref('fr') },
      },
    ],
    referenceWorkflows: [
      { title: 'Image par prompt', body: 'Décrivez produit, personnage, scène, surface, optique et lumière pour obtenir une source propre.' },
      { title: 'Retouche avec référence', body: 'Importez des images quand il faut préserver identité, géométrie produit ou détails de marque.' },
      { title: 'Jeu de références', body: 'Créez plusieurs vues : face, profil, détail et contexte avant l’étape vidéo.' },
      { title: 'Choix de taille', body: 'Utilisez 2K pour préparer vite, 3K pour revoir, ou 4K quand l’image demande plus de détail.' },
      { title: 'Passage vers vidéo', body: 'N’envoyez que les meilleures images fixes vers le modèle de mouvement choisi.' },
    ],
    pricingCopy: {
      title: 'Prix image Seedream en un coup d’œil',
      subtitle: 'Prix par scénario image — prix exact affiché dans l’espace image avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios image prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
    },
    meta: {
      title: 'Seedream : tarifs image et préparation de références | MaxVideoAI',
      description:
        'Préparez avec Seedream des images de référence, frames produit, personnages fixes et séries visuelles contrôlées avant de choisir un modèle vidéo.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO PARA PREPARAR IMÁGENES DE REFERENCIA',
      title: 'Seedream 5.0 Lite',
      subtitle: 'Referencias fijas limpias, cuadros de producto y preparación visual para video antes de animar en otro modelo.',
      subtitleHighlights: ['referencias fijas limpias', 'cuadros de producto', 'preparación visual para video'],
      paragraph:
        'Usa Seedream como espacio de generación y edición de imágenes fuente: crea cuadros de producto, referencias de personaje, visuales para anuncios y sets controlados antes de enviar los mejores recursos a un modelo de video.',
      primaryCta: { label: 'Preparar referencias con Seedream', href: '/app/image?engine=seedream' },
      secondaryCta: { label: 'Animar con Seedance', href: modelsHref('es', 'seedance-2-0') },
      quickLinks: [
        { label: 'Abrir espacio de imagen', href: '/app/image?engine=seedream' },
        { label: 'Ver precios', href: pricingHref('es', 'seedream-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo de referencia Seedream',
      description: 'Imagen fija preparada para animación posterior',
      renderLabel: 'Ver imagen',
      badges: ['Modelo de imagen', 'Hasta 10 refs', '2K-4K'],
      altContext: 'imagen de referencia de producto en Seedream preparada para un flujo de video posterior',
    },
    features: [
      { title: 'Preparación de referencias', body: 'Crea imágenes fuente limpias antes de pasarlas a una ruta de video.', tone: 'reference' },
      { title: 'Texto o imagen', body: 'Empieza desde un prompt o edita con imágenes de referencia cargadas.', tone: 'reference' },
      { title: 'Hasta 10 referencias', body: 'Guía ediciones con varias fuentes cuando los detalles necesitan más control.', tone: 'continuity' },
      { title: 'Imágenes 2K, 3K o 4K', body: 'Prepara stills con más resolución para producto, personaje y revisión de composición.', tone: 'quality' },
      { title: 'Hasta 15 imágenes totales', body: 'Las imágenes generadas y de referencia comparten el total expuesto de Seedream.', tone: 'duration' },
      { title: 'Precio por imagen', body: 'Los escenarios de imagen usan el helper de precios compartido, no segundos de video.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Cuándo conviene Seedream?',
        body: 'Elige Seedream cuando el siguiente paso de video necesita primero referencias más limpias de producto, personaje, estilo o composición.',
        cta: { label: 'Abrir espacio de imagen Seedream', href: '/app/image?engine=seedream' },
      },
      {
        title: '¿Preparas cuadros de producto?',
        body: 'Genera imágenes con etiquetas legibles, fondos limpios y encuadre estable antes de usarlas como recursos fuente.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas movimiento después?',
        body: 'Seedream prepara las imágenes fijas. Elige un modelo de video cuando el set de referencias esté listo.',
        cta: { label: 'Explorar modelos de video', href: modelsIndexHref('es') },
      },
    ],
    referenceWorkflows: [
      { title: 'Imagen por prompt', body: 'Describe producto, personaje, escena, superficie, lente e iluminación para una fuente limpia.' },
      { title: 'Edición con referencia', body: 'Carga imágenes cuando debas conservar identidad, geometría de producto o detalles de marca.' },
      { title: 'Set de referencias', body: 'Crea varias vistas: frente, perfil, detalle y contexto antes del paso de video.' },
      { title: 'Elección de tamaño', body: 'Usa 2K para preparar rápido, 3K para revisión o 4K cuando la imagen requiera más detalle.' },
      { title: 'Paso a video', body: 'Envía solo las mejores imágenes fijas al modelo de movimiento elegido.' },
    ],
    pricingCopy: {
      title: 'Precios de imagen Seedream de un vistazo',
      subtitle: 'Precios por escenario de imagen. Consulta el precio exacto en el espacio de imagen antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios de imagen predefinidos.',
      ctaLabel: 'Ver precios completos',
    },
    meta: {
      title: 'Seedream: precios de imagen y preparación de referencias | MaxVideoAI',
      description:
        'Prepara con Seedream imágenes de referencia, cuadros de producto, personajes fijos y sets visuales controlados antes de elegir un modelo de video.',
    },
  },
};

export const COPY_BY_MODEL_SLUG: Record<string, Record<AppLocale, LocalizedCopyWithoutPricingScenarios>> = {
  ...ADDITIONAL_TEMPLATE_COPY,
  'veo-3-1': VEO_31_COPY,
  'kling-3-pro': KLING_3_PRO_COPY,
  'seedance-2-0': SEEDANCE_20_COPY,
  'seedance-2-0-fast': SEEDANCE_20_FAST_COPY,
  seedream: SEEDREAM_COPY,
  'ltx-2-3-fast': LTX_23_FAST_COPY,
};

export function getModelDecisionCopy(modelSlug: string, locale: AppLocale): CopyWithoutPricingScenarios | null {
  const copyByLocale = COPY_BY_MODEL_SLUG[modelSlug];
  if (!copyByLocale) return null;

  const copy = copyByLocale[locale] ?? copyByLocale.en;

  return {
    ...copy,
    pricingCopy: {
      ...copy.pricingCopy,
      ctaHref: pricingHref(locale, `${modelSlug}-pricing`),
    },
  };
}
