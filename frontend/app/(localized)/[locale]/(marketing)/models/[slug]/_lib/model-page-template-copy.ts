import type { AppLocale } from '@/i18n/locales';
import { localePathnames } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';

import type { ModelDecisionData } from './model-page-decision-data';
import { buildCanonicalComparePath, COMPARE_BASE_PATH_MAP } from './model-page-links';

export type CopyWithoutPricingScenarios = Omit<ModelDecisionData, 'pricing'> & {
  pricingCopy: Omit<ModelDecisionData['pricing'], 'cta' | 'scenarios'> & {
    ctaLabel: string;
    ctaHref: string;
    maxDurationNote?: string;
  };
};

const PRICING_SLUG_MAP = buildSlugMap('pricing');
const GALLERY_SLUG_MAP = buildSlugMap('gallery');
const PRICING_ANCHOR = 'seedance-2-0-pricing';
const SEEDANCE_EXAMPLES_FAMILY_SLUG = 'seedance';
const LTX_EXAMPLES_FAMILY_SLUG = 'ltx';

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
      badges: ['Fast route', 'Social draft', '9:16'],
      altContext: 'LTX fast draft for a vertical social video concept',
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
      title: 'LTX 2.3 Fast: Draft Pricing & Prompt Testing | MaxVideoAI',
      description:
        'Use LTX 2.3 Fast for fast LTX 2.3 draft loops, visual exploration, prompt testing and vertical or social video drafts.',
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
      badges: ['Fast', 'Social', '9:16'],
      altContext: 'brouillon LTX Fast pour un concept vidéo vertical social',
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
      badges: ['Fast', 'Social', '9:16'],
      altContext: 'borrador LTX Fast para un concepto vertical de video social',
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

export const COPY_BY_MODEL_SLUG: Record<string, Record<AppLocale, LocalizedCopyWithoutPricingScenarios>> = {
  'seedance-2-0': SEEDANCE_20_COPY,
  'seedance-2-0-fast': SEEDANCE_20_FAST_COPY,
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
