import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  Bolt,
  Camera,
  Clock3,
  Film,
  Gauge,
  ImageIcon,
  Mic2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import type { ModelGalleryCard } from '@/components/marketing/ModelsGallery';
import type { ModelsGalleryCompareHref } from '@/components/marketing/models-gallery/models-gallery-types';

const EXAMPLE_FAMILY_BY_MODEL: Record<string, string> = {
  'seedance-2-0': 'seedance',
  'seedance-2-0-fast': 'seedance',
  'seedance-1-5-pro': 'seedance',
  'kling-3-pro': 'kling',
  'kling-3-standard': 'kling',
  'kling-3-4k': 'kling',
  'kling-2-6-pro': 'kling',
  'kling-2-5-turbo': 'kling',
  'veo-3-1': 'veo',
  'veo-3-1-fast': 'veo',
  'veo-3-1-lite': 'veo',
  'ltx-2-3-fast': 'ltx',
  'ltx-2-3-pro': 'ltx',
  'ltx-2-fast': 'ltx',
  'ltx-2': 'ltx',
  'sora-2': 'sora',
  'sora-2-pro': 'sora',
  'wan-2-6': 'wan',
  'wan-2-5': 'wan',
  'pika-text-to-video': 'pika',
  'happy-horse-1-1': 'happy-horse',
  'happy-horse-1-0': 'happy-horse',
  'minimax-hailuo-02-text': 'hailuo',
};

const TOP_PICK_IDS = ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'happy-horse-1-1'] as const;
const RECOMMENDED_IDS = ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'happy-horse-1-1', 'ltx-2-3-fast', 'luma-ray-3-2'] as const;

export type ModelsCatalogDecisionBadge = {
  label: string;
  icon: LucideIcon;
};

export type ModelsCatalogTopPick = {
  id: string;
  label: string;
  reason: string;
  detail: string;
  score: number | null;
  icon: LucideIcon;
  href: LocalizedLinkHref;
};

export type ModelsCatalogUseCase = {
  id: string;
  title: string;
  subtitle: string;
  best: string;
  href: LocalizedLinkHref;
  icon: LucideIcon;
};

export type ModelsCatalogPricingLimitItem = {
  title: string;
  body: string;
  icon: LucideIcon;
};

export type ModelsCatalogPopularComparison = {
  label: string;
  href: ModelsGalleryCompareHref;
};

export type ModelsCatalogDecisionData = {
  badges: ModelsCatalogDecisionBadge[];
  topPicks: ModelsCatalogTopPick[];
  useCases: ModelsCatalogUseCase[];
  recommendedCards: ModelGalleryCard[];
  popularComparisons: ModelsCatalogPopularComparison[];
  pricingLimits: ModelsCatalogPricingLimitItem[];
  faqItems: Array<{ question: string; answer: string }>;
};

function cardMap(cards: ModelGalleryCard[]) {
  return new Map(cards.map((card) => [card.id, card]));
}

function pickCards(cards: ModelGalleryCard[], ids: readonly string[]) {
  const byId = cardMap(cards);
  return ids.map((id) => byId.get(id)).filter((card): card is ModelGalleryCard => Boolean(card));
}

export function buildModelCompareHref(left: string, right: string): ModelsGalleryCompareHref {
  const sorted = [left, right].sort();
  return {
    pathname: '/ai-video-engines/[slug]',
    params: { slug: `${sorted[0]}-vs-${sorted[1]}` },
    query: sorted[0] === left ? undefined : { order: left },
  };
}

export function buildDefaultModelCompareHref(modelSlug: string): ModelsGalleryCompareHref | null {
  if (['nano-banana', 'nano-banana-pro', 'nano-banana-2', 'gpt-image-2', 'seedream'].includes(modelSlug)) {
    return null;
  }
  const opponent = modelSlug === 'seedance-2-0' ? 'kling-3-pro' : 'seedance-2-0';
  return buildModelCompareHref(modelSlug, opponent);
}

export function buildModelExamplesHref(modelSlug: string): LocalizedLinkHref | null {
  const family = EXAMPLE_FAMILY_BY_MODEL[modelSlug];
  if (!family) return null;
  return { pathname: '/examples/[model]', params: { model: family } };
}

function textByLocale<T>(locale: AppLocale, values: Record<AppLocale | 'en', T>): T {
  return values[locale] ?? values.en;
}

function buildBadges(locale: AppLocale): ModelsCatalogDecisionBadge[] {
  const labels = textByLocale(locale, {
    en: ['Price before render', 'Pay-as-you-go', 'Updated specs', 'Video, image & audio'],
    fr: ['Prix avant rendu', "Paiement a l'usage", 'Specs a jour', 'Video, image & audio'],
    es: ['Precio antes de renderizar', 'Pago por uso', 'Specs actualizadas', 'Video, imagen y audio'],
  });
  return [
    { label: labels[0], icon: BadgeDollarSign },
    { label: labels[1], icon: Gauge },
    { label: labels[2], icon: ShieldCheck },
    { label: labels[3], icon: Sparkles },
  ];
}

function buildTopPickCopy(locale: AppLocale) {
  return textByLocale(locale, {
    en: {
      'seedance-2-0': { reason: 'Best native audio', detail: 'Native audio, lip sync, realistic motion' },
      'kling-3-pro': { reason: 'Best control', detail: 'Cinematic sequences and prompt control' },
      'veo-3-1': { reason: 'Best Google route', detail: 'Ad-ready prompts, references, and extend control' },
      'happy-horse-1-1': { reason: 'Best Alibaba audio route', detail: 'Text, image, and references with native audio' },
    },
    fr: {
      'seedance-2-0': { reason: 'Meilleur audio natif', detail: 'Audio natif, lip sync, mouvement realiste' },
      'kling-3-pro': { reason: 'Meilleur controle', detail: 'Sequences cine et controle du prompt' },
      'veo-3-1': { reason: 'Meilleure route Google', detail: 'Prompts pub, references et extension' },
      'happy-horse-1-1': { reason: 'Meilleure route audio Alibaba', detail: 'Texte, image et references avec audio natif' },
    },
    es: {
      'seedance-2-0': { reason: 'Mejor audio nativo', detail: 'Audio nativo, lip sync y movimiento realista' },
      'kling-3-pro': { reason: 'Mejor control', detail: 'Secuencias cinematicas y control de prompt' },
      'veo-3-1': { reason: 'Mejor ruta Google', detail: 'Prompts para ads, referencias y extension' },
      'happy-horse-1-1': { reason: 'Mejor ruta audio Alibaba', detail: 'Texto, imagen y referencias con audio nativo' },
    },
  });
}

function buildUseCases(locale: AppLocale): ModelsCatalogUseCase[] {
  const copy = textByLocale(locale, {
    en: [
      ['cinematic-video', 'Cinematic video', 'Film-like motion and scenes', 'Kling 3 Pro'],
      ['native-audio', 'Native audio & lip sync', 'Dialogue and ambience', 'Seedance 2.0'],
      ['fast-drafts', 'Fast drafts', 'Quick iterations', 'Seedance 2.0 Fast'],
      ['image-to-video', 'Image-to-video', 'Bring images to life', 'Seedance 2.0'],
      ['product-ads', 'Product ads', 'Ad-ready clips and references', 'Veo 3.1'],
      ['prompt-control', 'Prompt control', 'Strong adherence', 'Kling 3 Pro'],
      ['longest-duration', 'Longest duration', 'Longer clips and output limits', 'LTX 2.3 Fast'],
      ['best-value', 'Best value', 'Lower-cost iteration', 'LTX 2.3 Fast'],
    ],
    fr: [
      ['cinematic-video', 'Video cinematographique', 'Mouvement et scenes cine', 'Kling 3 Pro'],
      ['native-audio', 'Audio natif & lip sync', 'Dialogue, ambiance et voix', 'Seedance 2.0'],
      ['fast-drafts', 'Drafts rapides', 'Iterations rapides', 'Seedance 2.0 Fast'],
      ['image-to-video', 'Image-to-video', 'Animer des images', 'Seedance 2.0'],
      ['product-ads', 'Pubs produit', 'Clips et references prets pour ads', 'Veo 3.1'],
      ['prompt-control', 'Controle du prompt', 'Forte adherence', 'Kling 3 Pro'],
      ['longest-duration', 'Duree la plus longue', 'Clips plus longs et limites de sortie', 'LTX 2.3 Fast'],
      ['best-value', 'Meilleure valeur', 'Iteration moins chere', 'LTX 2.3 Fast'],
    ],
    es: [
      ['cinematic-video', 'Video cinematografico', 'Movimiento y escenas cine', 'Kling 3 Pro'],
      ['native-audio', 'Audio nativo & lip sync', 'Dialogo, ambiente y voz', 'Seedance 2.0'],
      ['fast-drafts', 'Borradores rapidos', 'Iteraciones rapidas', 'Seedance 2.0 Fast'],
      ['image-to-video', 'Imagen a video', 'Anima imagenes', 'Seedance 2.0'],
      ['product-ads', 'Anuncios de producto', 'Clips y referencias listos para ads', 'Veo 3.1'],
      ['prompt-control', 'Control del prompt', 'Alta adherencia', 'Kling 3 Pro'],
      ['longest-duration', 'Mayor duracion', 'Clips mas largos y limites de salida', 'LTX 2.3 Fast'],
      ['best-value', 'Mejor valor', 'Iteracion de menor costo', 'LTX 2.3 Fast'],
    ],
  });
  const hrefs: LocalizedLinkHref[] = [
    '/ai-video-engines/best-for/cinematic-realism',
    '/ai-video-engines/best-for/lipsync-dialogue',
    '/ai-video-engines/best-for/fast-drafts',
    '/ai-video-engines/best-for/image-to-video',
    '/ai-video-engines/best-for/ads',
    '/ai-video-engines/best-for/multi-shot-video',
    '#models-grid',
    '/ai-video-engines/best-for/fast-drafts',
  ];
  const icons = [Film, Mic2, Bolt, ImageIcon, Camera, SlidersHorizontal, Clock3, Gauge];
  return copy.map(([id, title, subtitle, best], index) => ({
    id,
    title,
    subtitle,
    best,
    href: hrefs[index],
    icon: icons[index] ?? Camera,
  }));
}

function buildPricingLimits(locale: AppLocale): ModelsCatalogPricingLimitItem[] {
  const copy = textByLocale(locale, {
    en: [
      ['Pricing', 'Compare per-second video pricing and per-image still pricing before rendering.'],
      ['Duration', 'Check max video length before choosing a model for drafts or production clips.'],
      ['Output quality', 'Compare 720p, 1080p, 4K, audio, input modes, and model-specific limits.'],
    ],
    fr: [
      ['Prix', 'Comparez les prix video a la seconde et image par image avant le rendu.'],
      ['Duree', 'Verifiez la duree video maximale avant les drafts ou clips de production.'],
      ['Qualite de sortie', 'Comparez 720p, 1080p, 4K, audio, modes d entree et limites par modele.'],
    ],
    es: [
      ['Precio', 'Compara precios de video por segundo e imagen por imagen antes de renderizar.'],
      ['Duracion', 'Revisa la duracion maxima antes de elegir un modelo para drafts o produccion.'],
      ['Calidad de salida', 'Compara 720p, 1080p, 4K, audio, modos de entrada y limites por modelo.'],
    ],
  });
  const icons = [BadgeDollarSign, Clock3, Trophy];
  return copy.map(([title, body], index) => ({ title, body, icon: icons[index] ?? Sparkles }));
}

function buildDecisionFaqItems(locale: AppLocale): Array<{ question: string; answer: string }> {
  return textByLocale(locale, {
    en: [
      {
        question: 'Which AI video model should I start with?',
        answer:
          'Start with Seedance 2.0 for native audio and realistic motion, Kling 3 Pro for cinematic control, Veo 3.1 for high-quality prompt adherence, and LTX 2.3 Fast for fast drafts and lower-cost iterations.',
      },
      {
        question: 'Which models support native audio or lip sync?',
        answer:
          'Seedance, Kling, Veo, Sora, LTX, Wan, and other models may support audio or lip sync depending on the exact version. Check each model card for Audio, Lip sync, T2V, I2V, V2V, and First/Last support.',
      },
      {
        question: 'How is AI video pricing calculated?',
        answer:
          'Most video models are priced per second of generated output. Image models are usually priced per image or by output size. Open each model page for exact pricing and limits.',
      },
      {
        question: 'What is the maximum duration for AI video models?',
        answer:
          'Max duration varies by model. Some models are limited to 8-15 seconds, while others support longer clips. Use the duration filter or compare cards to find the right model.',
      },
      {
        question: 'Where can I find prompt examples?',
        answer:
          'Use the examples pages for model-specific prompts and outputs, including LTX, Kling, Seedance, Veo, Wan, Sora, and Pika examples.',
      },
      {
        question: 'What is the difference between video models and image models?',
        answer:
          'Video models generate motion clips from text, images, video references or first/last frames. Image models generate still images, edits, product visuals, and references that can be used before animation.',
      },
    ],
    fr: [
      {
        question: 'Par quel modele video IA commencer ?',
        answer:
          'Commencez avec Seedance 2.0 pour l audio natif et le mouvement realiste, Kling 3 Pro pour le controle cinematographique, Veo 3.1 pour l adherence au prompt, et LTX 2.3 Fast pour les drafts rapides et moins chers.',
      },
      {
        question: 'Quels modeles supportent l audio natif ou le lip sync ?',
        answer:
          'Seedance, Kling, Veo, Sora, LTX et d autres modeles peuvent supporter audio ou lip sync selon la version exacte. Verifiez Audio, Lip sync, T2V, I2V, V2V et First/Last sur chaque carte.',
      },
      {
        question: 'Comment le prix video IA est-il calcule ?',
        answer:
          'La plupart des modeles video sont factures a la seconde generee. Les modeles image sont plutot factures par image ou taille de sortie. Ouvrez chaque page modele pour le prix exact.',
      },
      {
        question: 'Quelle est la duree maximale des modeles video IA ?',
        answer:
          'La duree maximale varie selon le modele. Certains sont limites a 8-15 secondes, tandis que d autres supportent des clips plus longs. Utilisez le filtre duree ou les comparaisons.',
      },
      {
        question: 'Ou trouver des exemples de prompts ?',
        answer:
          'Utilisez les pages exemples pour voir des prompts et sorties par modele, dont LTX, Kling, Seedance, Veo, Wan et Sora.',
      },
      {
        question: 'Quelle difference entre modeles video et modeles image ?',
        answer:
          'Les modeles video generent des clips depuis texte, images, references video ou premieres/dernieres images. Les modeles image generent des visuels fixes, editions et references avant animation.',
      },
    ],
    es: [
      {
        question: 'Con que modelo de video IA deberia empezar?',
        answer:
          'Empieza con Seedance 2.0 para audio nativo y movimiento realista, Kling 3 Pro para control cinematografico, Veo 3.1 para alta adherencia al prompt y LTX 2.3 Fast para borradores rapidos de menor costo.',
      },
      {
        question: 'Que modelos soportan audio nativo o lip sync?',
        answer:
          'Seedance, Kling, Veo, Sora, LTX y otros modelos pueden soportar audio o lip sync segun la version exacta. Revisa Audio, Lip sync, T2V, I2V, V2V y First/Last en cada tarjeta.',
      },
      {
        question: 'Como se calcula el precio de video IA?',
        answer:
          'La mayoria de modelos de video se cobran por segundo generado. Los modelos de imagen suelen cobrarse por imagen o tamano de salida. Abre cada pagina de modelo para precio y limites exactos.',
      },
      {
        question: 'Cual es la duracion maxima de los modelos de video IA?',
        answer:
          'La duracion maxima varia por modelo. Algunos modelos estan limitados a 8-15 segundos, mientras otros admiten clips mas largos. Usa el filtro de duracion o las comparaciones.',
      },
      {
        question: 'Donde encuentro ejemplos de prompts?',
        answer:
          'Usa las paginas de ejemplos para prompts y resultados por modelo, incluidos LTX, Kling, Seedance, Veo, Wan y Sora.',
      },
      {
        question: 'Cual es la diferencia entre modelos de video e imagen?',
        answer:
          'Los modelos de video generan clips desde texto, imagenes, referencias de video o primeros/ultimos frames. Los modelos de imagen generan imagenes fijas, ediciones, visuales de producto y referencias antes de animar.',
      },
    ],
  });
}

export function buildModelsCatalogDecisionData({
  activeLocale,
  cards,
}: {
  activeLocale: AppLocale;
  cards: ModelGalleryCard[];
}): ModelsCatalogDecisionData {
  const byId = cardMap(cards);
  const topPickCopy = buildTopPickCopy(activeLocale);
  const topPickIcons = [Mic2, SlidersHorizontal, Bolt, Gauge] as const;

  return {
    badges: buildBadges(activeLocale),
    topPicks: TOP_PICK_IDS.flatMap((id, index): ModelsCatalogTopPick[] => {
      const card = byId.get(id);
      if (!card) return [];
      return [{
        id,
        label: card.label,
        reason: topPickCopy[id].reason,
        detail: topPickCopy[id].detail,
        score: card.overallScore ?? null,
        icon: topPickIcons[index] ?? Trophy,
        href: card.href,
      }];
    }),
    useCases: buildUseCases(activeLocale),
    recommendedCards: pickCards(cards, RECOMMENDED_IDS),
    popularComparisons: [
      { label: 'Seedance 2.0 vs Kling 3 Pro', href: buildModelCompareHref('seedance-2-0', 'kling-3-pro') },
      {
        label: 'Seedance 2.0 vs Seedance 2.0 Fast',
        href: { pathname: '/ai-video-engines/[slug]', params: { slug: 'seedance-2-0-vs-seedance-2-0-fast' } },
      },
      { label: 'Kling 3 Pro vs Veo 3.1', href: buildModelCompareHref('kling-3-pro', 'veo-3-1') },
      { label: 'Happy Horse 1.1 vs Seedance 2.0', href: buildModelCompareHref('happy-horse-1-1', 'seedance-2-0') },
      { label: 'Happy Horse 1.1 vs Veo 3.1', href: buildModelCompareHref('happy-horse-1-1', 'veo-3-1') },
      { label: 'Veo 3.1 Fast vs Veo 3.1 Lite', href: buildModelCompareHref('veo-3-1-fast', 'veo-3-1-lite') },
    ],
    pricingLimits: buildPricingLimits(activeLocale),
    faqItems: buildDecisionFaqItems(activeLocale),
  };
}
