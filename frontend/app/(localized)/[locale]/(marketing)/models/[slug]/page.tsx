import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import Image from 'next/image';
import Head from 'next/head';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import { listFalEngines, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import { locales, localePathnames, localeRegions, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveLocalesForEnglishPath } from '@/lib/seo/alternateLocales';
import { getEngineLocalized, type EngineLocalizedContent } from '@/lib/models/i18n';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { normalizeEngineId } from '@/lib/engine-alias';
import { formatResolutionLabel } from '@/lib/resolution-labels';
import type { EngineCaps } from '@/types/engines';
import { type ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { listPlaylistVideos, getVideosByIds, type GalleryVideo } from '@/server/videos';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { computePricingSnapshot } from '@/lib/pricing';
import { applyEnginePricingOverride } from '@/lib/pricing-definition';
import { listEnginePricingOverrides } from '@/server/engine-settings';
import { serializeJsonLd } from '../model-jsonld';
import { ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextLink } from '@/components/ui/TextLink';
import { UIIcon } from '@/components/ui/UIIcon';
import { BackLink } from '@/components/video/BackLink';
import { SoraPromptingTabs } from '@/components/marketing/SoraPromptingTabs.client';
import { ResponsiveDetails } from '@/components/ui/ResponsiveDetails.client';
import { SpecDetailsGrid, type SpecDetailsSection } from '@/components/marketing/SpecDetailsGrid.client';
import { getExamplesHref } from '@/lib/examples-links';
import {
  Box,
  ArrowLeftRight,
  Camera,
  Check,
  Clapperboard,
  Clock,
  Crop,
  Film,
  Gamepad2,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Megaphone,
  Monitor,
  Mic,
  Music,
  PenTool,
  Repeat,
  Repeat2,
  Scissors,
  Smartphone,
  Sparkles,
  Type,
  User,
  Users,
  Wind,
  Coins,
  Volume2,
  Wand2,
  Zap,
} from 'lucide-react';

type PageParams = {
  params: {
    locale: AppLocale;
    slug: string;
  };
};

function buildCanonicalComparePath({
  compareBase,
  pairSlug,
  orderSlug,
}: {
  compareBase: string;
  pairSlug: string;
  orderSlug?: string;
}): string {
  const sanitizedBase = compareBase.replace(/^\/+|\/+$/g, '');
  const normalizedPair = pairSlug ? pairSlug.replace(/^\/+/, '') : '';
  if (!normalizedPair) {
    return `/${sanitizedBase}`.replace(/\/{2,}/g, '/');
  }
  const parts = normalizedPair
    .split('-vs-')
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  let canonicalPair = normalizedPair;
  let orderParam = '';
  if (parts.length === 2) {
    const sorted = [...parts].sort();
    canonicalPair = `${sorted[0]}-vs-${sorted[1]}`;
    if (orderSlug && sorted.includes(orderSlug) && orderSlug !== sorted[0]) {
      orderParam = `?order=${encodeURIComponent(orderSlug)}`;
    }
  } else if (orderSlug) {
    orderParam = `?order=${encodeURIComponent(orderSlug)}`;
  }
  return `/${sanitizedBase}/${canonicalPair}${orderParam}`.replace(/\/{2,}/g, '/');
}

const LOCALE_PREFIX_PATTERN = /^\/(fr|es)(?=\/)/i;
const NON_LOCALIZED_PREFIXES = [
  '/app',
  '/dashboard',
  '/jobs',
  '/billing',
  '/settings',
  '/generate',
  '/login',
  '/auth',
  '/video',
];

function stripLocalePrefix(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_PATTERN, '');
}

function resolveExamplesHrefFromRaw(rawHref?: string | null): LocalizedLinkHref | null {
  if (!rawHref) return null;
  let pathname = rawHref;
  let search = '';
  try {
    const url = new URL(rawHref, SITE);
    pathname = url.pathname || rawHref;
    search = url.search || '';
  } catch {
    const [pathPart, queryPart] = rawHref.split('?');
    pathname = pathPart || rawHref;
    search = queryPart ? `?${queryPart}` : '';
  }
  const normalizedPath = stripLocalePrefix(pathname);
  if (!normalizedPath.startsWith('/examples')) {
    return null;
  }
  const segments = normalizedPath.split('/').filter(Boolean);
  const modelSlug = segments[1];
  const params = new URLSearchParams(search);
  const engineSlug = params.get('engine');
  const candidate = modelSlug || engineSlug;
  return candidate ? getExamplesHref(candidate) : { pathname: '/examples' };
}

function resolveNonLocalizedHref(rawHref?: string | null): string | null {
  if (!rawHref) return null;
  let pathname = rawHref;
  let search = '';
  let hash = '';
  try {
    const url = new URL(rawHref, SITE);
    pathname = url.pathname || rawHref;
    search = url.search || '';
    hash = url.hash || '';
  } catch {
    const [pathPart, hashPart] = rawHref.split('#');
    const [pathOnly, queryPart] = pathPart.split('?');
    pathname = pathOnly || rawHref;
    search = queryPart ? `?${queryPart}` : '';
    hash = hashPart ? `#${hashPart}` : '';
  }
  const normalizedPath = stripLocalePrefix(pathname);
  if (!NON_LOCALIZED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return null;
  }
  return `${normalizedPath}${search}${hash}`;
}

export const dynamicParams = false;
export const revalidate = 300;

const PREFERRED_MEDIA: Record<string, { hero: string | null; demo: string | null }> = {
  'sora-2': {
    hero: 'job_74677d4f-9f28-4e47-b230-64accef8e239',
    demo: 'job_7fbd6334-8535-438a-98a2-880205744b6b',
  },
  'sora-2-pro': {
    hero: 'job_4d97a93f-1582-4a50-bff1-72894c302164',
    demo: null,
  },
  'veo-3-1': {
    hero: 'job_a3e088db-b1e2-430f-83b3-2efce518c282',
    demo: 'job_8547a19e-ebad-4376-8889-1d88355c0f52',
  },
  'veo-3-1-fast': {
    hero: 'job_4db2339c-000a-4b81-a68c-9314dd7940b2',
    demo: 'job_e34e8979-9056-4564-bbfd-27e8d886fa26',
  },
  'pika-text-to-video': {
    hero: 'job_2c958e35-92e7-4c0f-8828-ec49476c8c4e',
    demo: 'job_f5992c71-a197-482f-8d0f-028f261ed27b',
  },
  'wan-2-5': {
    hero: 'job_4b882003-b595-4d4e-b62c-1ae22f002bcf',
    demo: 'job_f77a31c6-1549-471a-8fb1-1eb44c523390',
  },
  'kling-2-5-turbo': {
    hero: null,
    demo: 'job_b8db408a-7b09-4268-ad10-48e9cb8fc4a7',
  },
};

type FocusVsCopy = { title: string; items: string[] };
type FocusVsLocalizedCopy = Record<AppLocale, FocusVsCopy>;
type FocusVsPair = {
  slugA: string;
  slugB: string;
  nameA: string;
  nameB: string;
  copyA: FocusVsLocalizedCopy;
  copyB: FocusVsLocalizedCopy;
  onlyFor?: string[];
};

type FocusVsConfig = {
  title: string;
  ctaLabel: string;
  ctaSlug: string;
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
};

const FOCUS_VS_PAIRS: FocusVsPair[] = [
  {
    slugA: 'sora-2',
    slugB: 'sora-2-pro',
    nameA: 'Sora 2',
    nameB: 'Sora 2 Pro',
    copyA: {
      en: {
        title: 'Use Sora 2 when you want:',
        items: [
          'Fast idea → clip iteration',
          'Storyboards, concepts, UGC-style beats, short ads',
          'A quick first pass where 720p is enough',
        ],
      },
      fr: {
        title: 'Utilisez Sora 2 quand vous voulez :',
        items: [
          'Itération rapide d’idée → clip',
          'Storyboards, concepts, beats UGC, pubs courtes',
          'Un premier jet rapide où le 720p suffit',
        ],
      },
      es: {
        title: 'Usa Sora 2 cuando quieras:',
        items: [
          'Iteración rápida de idea → clip',
          'Storyboards, conceptos, beats estilo UGC, anuncios cortos',
          'Un primer borrador rápido cuando 720p es suficiente',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Sora 2 Pro when you need:',
        items: [
          'Higher resolution output',
          'More control for finals (including audio control in the UI)',
          'Cleaner final takes after you’ve validated the idea',
        ],
      },
      fr: {
        title: 'Utilisez Sora 2 Pro quand vous avez besoin :',
        items: [
          'Sortie en plus haute résolution',
          'Plus de contrôle pour les finals (y compris le contrôle audio dans l’UI)',
          'Plans finaux plus propres après validation de l’idée',
        ],
      },
      es: {
        title: 'Usa Sora 2 Pro cuando necesites:',
        items: [
          'Salida de mayor resolución',
          'Más control para finales (incluye control de audio en la UI)',
          'Tomas finales más limpias tras validar la idea',
        ],
      },
    },
  },
  {
    slugA: 'veo-3-1-fast',
    slugB: 'veo-3-1',
    nameA: 'Veo 3.1 Fast',
    nameB: 'Veo 3.1',
    copyA: {
      en: {
        title: 'Use Veo 3.1 Fast when you want:',
        items: [
          'Rapid concept testing and volume drafts',
          'Cheaper A/B ad variants and social loops',
          'Quick iteration before upgrading winners',
        ],
      },
      fr: {
        title: 'Utilisez Veo 3.1 Fast quand vous voulez :',
        items: [
          'Tests de concepts rapides et drafts en volume',
          'Variantes A/B moins chères et boucles social',
          'Itération rapide avant de passer les meilleurs en version supérieure',
        ],
      },
      es: {
        title: 'Usa Veo 3.1 Fast cuando quieras:',
        items: [
          'Pruebas rápidas de concepto y borradores en volumen',
          'Variantes A/B más baratas y loops sociales',
          'Iteración rápida antes de pasar a los ganadores',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Veo 3.1 when you need:',
        items: [
          'Higher-fidelity frames and polish',
          'Sound in the same pass when you want it',
          'More reliable follow-through on prompts',
        ],
      },
      fr: {
        title: 'Utilisez Veo 3.1 quand vous avez besoin :',
        items: [
          'Fidélité d’image plus élevée et finition',
          'Son dans le même rendu quand vous en avez besoin',
          'Suivi des prompts plus fiable',
        ],
      },
      es: {
        title: 'Usa Veo 3.1 cuando necesites:',
        items: [
          'Mayor fidelidad y pulido',
          'Sonido en la misma pasada cuando lo necesitas',
          'Seguimiento de prompts más fiable',
        ],
      },
    },
  },
  {
    slugA: 'wan-2-5',
    slugB: 'wan-2-6',
    nameA: 'Wan 2.5',
    nameB: 'Wan 2.6',
    copyA: {
      en: {
        title: 'Use Wan 2.5 when you want:',
        items: [
          'Native audio in the same render',
          'Simple short beats at lower cost',
          'Quick ideation with sound-led timing',
        ],
      },
      fr: {
        title: 'Utilisez Wan 2.5 quand vous voulez :',
        items: [
          'Audio natif dans le même rendu',
          'Beats courts simples à moindre coût',
          'Idéation rapide avec timing guidé par le son',
        ],
      },
      es: {
        title: 'Usa Wan 2.5 cuando quieras:',
        items: [
          'Audio nativo en el mismo render',
          'Beats cortos simples a menor coste',
          'Ideación rápida con timing guiado por el audio',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Wan 2.6 when you need:',
        items: [
          'Reference-to-video consistency',
          'Timestamped multi-shot sequences',
          'More aspect-ratio control and structure',
        ],
      },
      fr: {
        title: 'Utilisez Wan 2.6 quand vous avez besoin :',
        items: [
          'Cohérence en reference-to-video',
          'Séquences multi-shots horodatées',
          'Plus de contrôle de format et de structure',
        ],
      },
      es: {
        title: 'Usa Wan 2.6 cuando necesites:',
        items: [
          'Consistencia en reference-to-video',
          'Secuencias multi-shot con timestamps',
          'Más control de formato y estructura',
        ],
      },
    },
  },
  {
    slugA: 'kling-2-5-turbo',
    slugB: 'kling-2-6-pro',
    nameA: 'Kling 2.5 Turbo',
    nameB: 'Kling 2.6 Pro',
    copyA: {
      en: {
        title: 'Use Kling 2.5 Turbo when you want:',
        items: [
          'Fast silent clips with strong motion',
          'Budget B-roll loops for edits',
          'Quick look-dev and drafts',
        ],
      },
      fr: {
        title: 'Utilisez Kling 2.5 Turbo quand vous voulez :',
        items: [
          'Clips silencieux rapides avec forte motion',
          'Boucles B-roll budget pour le montage',
          'Look-dev rapide et drafts',
        ],
      },
      es: {
        title: 'Usa Kling 2.5 Turbo cuando quieras:',
        items: [
          'Clips silenciosos rápidos con motion fuerte',
          'Loops B-roll económicos para edición',
          'Look-dev rápido y borradores',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Kling 2.6 Pro when you need:',
        items: [
          'Native audio with dialogue and SFX',
          'Polished ad/story beats',
          'Stronger continuity on camera direction',
        ],
      },
      fr: {
        title: 'Utilisez Kling 2.6 Pro quand vous avez besoin :',
        items: [
          'Audio natif avec dialogue et SFX',
          'Beats pub/story plus polis',
          'Continuité plus forte sur la direction caméra',
        ],
      },
      es: {
        title: 'Usa Kling 2.6 Pro cuando necesites:',
        items: [
          'Audio nativo con diálogo y SFX',
          'Beats publicitarios/story más pulidos',
          'Continuidad más fuerte en la dirección de cámara',
        ],
      },
    },
  },
  {
    slugA: 'kling-2-6-pro',
    slugB: 'kling-3-pro',
    nameA: 'Kling 2.6 Pro',
    nameB: 'Kling 3 Pro',
    copyA: {
      en: {
        title: 'Use Kling 2.6 Pro when you want:',
        items: [
          'Native audio with dialogue and SFX',
          'Short cinematic beats without extra setup',
          'Solid results for 5–10s clips',
        ],
      },
      fr: {
        title: 'Utilisez Kling 2.6 Pro quand vous voulez :',
        items: [
          'Audio natif avec dialogue et SFX',
          'Beats ciné courts sans setup complexe',
          'Résultats solides sur 5–10s',
        ],
      },
      es: {
        title: 'Usa Kling 2.6 Pro cuando quieras:',
        items: [
          'Audio nativo con diálogo y SFX',
          'Beats cinemáticos cortos sin setup extra',
          'Resultados sólidos en clips de 5–10s',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Kling 3 Pro when you need:',
        items: [
          'Multi-prompt sequencing across scenes',
          'Element references for stronger continuity',
          'Voice IDs and shot-type control up to 15s',
        ],
      },
      fr: {
        title: 'Utilisez Kling 3 Pro quand vous avez besoin :',
        items: [
          'Séquençage multi-prompts par scène',
          'Éléments de référence pour plus de continuité',
          'Voice IDs et shot-type jusqu’à 15s',
        ],
      },
      es: {
        title: 'Usa Kling 3 Pro cuando necesites:',
        items: [
          'Secuencias multi-prompt por escena',
          'Referencias de elementos para mayor continuidad',
          'Voice IDs y control de shot type hasta 15s',
        ],
      },
    },
  },
  {
    slugA: 'ltx-2-fast',
    slugB: 'ltx-2',
    nameA: 'LTX-2 Fast',
    nameB: 'LTX-2 Pro',
    copyA: {
      en: {
        title: 'Use LTX-2 Fast when you want:',
        items: [
          'High-volume drafts and iteration speed',
          'Quick concept testing and pacing checks',
          'Rough cuts before finals',
        ],
      },
      fr: {
        title: 'Utilisez LTX-2 Fast quand vous voulez :',
        items: [
          'Brouillons en volume et vitesse d’itération',
          'Tests de concepts rapides et vérification du pacing',
          'Rough cuts avant les finals',
        ],
      },
      es: {
        title: 'Usa LTX-2 Fast cuando quieras:',
        items: [
          'Borradores en volumen y velocidad de iteración',
          'Pruebas rápidas de concepto y pacing',
          'Rough cuts antes de finales',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use LTX-2 Pro when you need:',
        items: [
          'Polished client-ready deliverables',
          'Higher resolution and smoother motion',
          'Audio-visual sync for finals',
        ],
      },
      fr: {
        title: 'Utilisez LTX-2 Pro quand vous avez besoin :',
        items: [
          'Livrables clients plus soignés',
          'Résolution plus élevée et mouvement plus fluide',
          'Sync audio-visuelle pour les finals',
        ],
      },
      es: {
        title: 'Usa LTX-2 Pro cuando necesites:',
        items: [
          'Entregables más pulidos para cliente',
          'Más resolución y motion más suave',
          'Sincronía audio-visual para finales',
        ],
      },
    },
  },
  {
    slugA: 'nano-banana',
    slugB: 'nano-banana-pro',
    nameA: 'Nano Banana',
    nameB: 'Nano Banana Pro',
    copyA: {
      en: {
        title: 'Use Nano Banana when you want:',
        items: [
          'Fast drafts and quick edits',
          'Rapid concepting and exploration',
          'Lightweight layout tests',
        ],
      },
      fr: {
        title: 'Utilisez Nano Banana quand vous voulez :',
        items: [
          'Drafts rapides et edits rapides',
          'Concepting rapide et exploration',
          'Tests de mise en page légers',
        ],
      },
      es: {
        title: 'Usa Nano Banana cuando quieras:',
        items: [
          'Borradores rápidos y ediciones rápidas',
          'Concepting rápido y exploración',
          'Pruebas de layout ligeras',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Nano Banana Pro when you need:',
        items: [
          'Clean typography and layouts',
          'Consistent product families',
          'High-res finals for campaigns',
        ],
      },
      fr: {
        title: 'Utilisez Nano Banana Pro quand vous avez besoin :',
        items: [
          'Typo et layouts propres',
          'Familles produit cohérentes',
          'Finals haute résolution pour campagnes',
        ],
      },
      es: {
        title: 'Usa Nano Banana Pro cuando necesites:',
        items: [
          'Tipografía y layouts limpios',
          'Familias de producto consistentes',
          'Finales en alta resolución para campañas',
        ],
      },
    },
  },
  {
    slugA: 'veo-3-1-first-last',
    slugB: 'veo-3-1',
    nameA: 'Veo 3.1 First/Last',
    nameB: 'Veo 3.1',
    copyA: {
      en: {
        title: 'Use Veo 3.1 First/Last when you want:',
        items: [
          'Two-frame control for start/end locked shots',
          'Smooth transitions between keyframes',
          'Continuity on layout and identity',
        ],
      },
      fr: {
        title: 'Utilisez Veo 3.1 First/Last quand vous voulez :',
        items: [
          'Contrôle à deux frames pour plans start/end verrouillés',
          'Transitions fluides entre keyframes',
          'Continuité sur layout et identité',
        ],
      },
      es: {
        title: 'Usa Veo 3.1 First/Last cuando quieras:',
        items: [
          'Control de dos fotogramas para planos start/end bloqueados',
          'Transiciones suaves entre keyframes',
          'Continuidad en layout e identidad',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Veo 3.1 when you need:',
        items: [
          'General-purpose cinematic clips',
          'More flexible shot variation',
          'Broader use cases beyond transitions',
        ],
      },
      fr: {
        title: 'Utilisez Veo 3.1 quand vous avez besoin :',
        items: [
          'Clips cinématographiques généralistes',
          'Variation de plans plus flexible',
          'Cas d’usage plus larges au-delà des transitions',
        ],
      },
      es: {
        title: 'Usa Veo 3.1 cuando necesites:',
        items: [
          'Clips cinematográficos de propósito general',
          'Variación de planos más flexible',
          'Casos de uso más amplios más allá de transiciones',
        ],
      },
    },
  },
  {
    slugA: 'pika-text-to-video',
    slugB: 'kling-2-5-turbo',
    nameA: 'Pika 2.2',
    nameB: 'Kling 2.5 Turbo',
    onlyFor: ['pika-text-to-video'],
    copyA: {
      en: {
        title: 'Use Pika 2.2 when you want:',
        items: [
          'Stylized, social-first motion',
          'Fast loops and playful variants',
          'Edit-friendly silent clips',
        ],
      },
      fr: {
        title: 'Utilisez Pika 2.2 quand vous voulez :',
        items: [
          'Motion stylisé, social-first',
          'Boucles rapides et variantes ludiques',
          'Clips silencieux faciles à monter',
        ],
      },
      es: {
        title: 'Usa Pika 2.2 cuando quieras:',
        items: [
          'Motion estilizado y social-first',
          'Loops rápidos y variantes lúdicas',
          'Clips silenciosos fáciles de editar',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Kling 2.5 Turbo when you need:',
        items: [
          'More cinematic motion and physics',
          'Camera-forward action beats',
          'Cleaner realism for product shots',
        ],
      },
      fr: {
        title: 'Utilisez Kling 2.5 Turbo quand vous avez besoin :',
        items: [
          'Motion et physique plus cinématiques',
          'Beats d’action camera-forward',
          'Réalisme plus propre pour produits',
        ],
      },
      es: {
        title: 'Usa Kling 2.5 Turbo cuando necesites:',
        items: [
          'Motion y física más cinematográficas',
          'Beats de acción camera-forward',
          'Realismo más limpio para productos',
        ],
      },
    },
  },
  {
    slugA: 'minimax-hailuo-02-text',
    slugB: 'ltx-2-fast',
    nameA: 'Hailuo 02',
    nameB: 'LTX-2 Fast',
    onlyFor: ['minimax-hailuo-02-text'],
    copyA: {
      en: {
        title: 'Use Hailuo 02 when you want:',
        items: [
          'Physics-heavy motion drafts',
          'Fast visual iteration on a budget',
          'Quick storyboard animatics',
        ],
      },
      fr: {
        title: 'Utilisez Hailuo 02 quand vous voulez :',
        items: [
          'Drafts motion axés physique',
          'Itération visuelle rapide à petit budget',
          'Animatics storyboard rapides',
        ],
      },
      es: {
        title: 'Usa Hailuo 02 cuando quieras:',
        items: [
          'Borradores de motion con física',
          'Iteración visual rápida con bajo presupuesto',
          'Animatics de storyboard rápidos',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use LTX-2 Fast when you need:',
        items: [
          'More room per clip for pacing',
          'Drafts that stay closer to camera intent',
          'An easy upgrade path to Pro',
        ],
      },
      fr: {
        title: 'Utilisez LTX-2 Fast quand vous avez besoin :',
        items: [
          'Plus de durée par clip pour le pacing',
          'Drafts plus proches de l’intention caméra',
          'Chemin simple vers Pro',
        ],
      },
      es: {
        title: 'Usa LTX-2 Fast cuando necesites:',
        items: [
          'Más duración por clip para el pacing',
          'Borradores más cercanos a la intención de cámara',
          'Camino fácil hacia Pro',
        ],
      },
    },
  },
];

function resolveFocusVsConfig(currentSlug: string, locale: AppLocale): FocusVsConfig | null {
  const entry = FOCUS_VS_PAIRS.find((pair) => {
    if (pair.onlyFor && !pair.onlyFor.includes(currentSlug)) {
      return false;
    }
    return pair.slugA === currentSlug || pair.slugB === currentSlug;
  });
  if (!entry) return null;
  const isA = entry.slugA === currentSlug;
  const currentName = isA ? entry.nameA : entry.nameB;
  const otherName = isA ? entry.nameB : entry.nameA;
  const currentCopy = (isA ? entry.copyA : entry.copyB)[locale] ?? (isA ? entry.copyA : entry.copyB).en;
  const otherCopy = (isA ? entry.copyB : entry.copyA)[locale] ?? (isA ? entry.copyB : entry.copyA).en;
  const ctaSlug = isA ? entry.slugB : entry.slugA;
  const ctaLabel = (() => {
    if (locale === 'fr') return `Voir les détails ${otherName} →`;
    if (locale === 'es') return `Ver detalles de ${otherName} →`;
    return `View ${otherName} details →`;
  })();
  return {
    title: `${currentName} vs ${otherName}`,
    ctaLabel,
    ctaSlug,
    leftTitle: currentCopy.title,
    leftItems: currentCopy.items,
    rightTitle: otherCopy.title,
    rightItems: otherCopy.items,
  };
}

type SpecSection = SpecDetailsSection;
type LocalizedFaqEntry = { question: string; answer: string };
type QuickStartBlock = { title: string; subtitle?: string | null; steps: string[] };
type HeroSpecIconKey = 'resolution' | 'duration' | 'textToVideo' | 'imageToVideo' | 'aspectRatio' | 'audio';
type HeroSpecChip = { label: string; icon?: HeroSpecIconKey | null };
type BestUseCaseIconKey =
  | 'ads'
  | 'ugc'
  | 'product'
  | 'storyboard'
  | 'type'
  | 'cinematic'
  | 'camera'
  | 'layers'
  | 'zap'
  | 'audio'
  | 'sparkles'
  | 'smartphone'
  | 'wand2'
  | 'arrowLeftRight'
  | 'layout'
  | 'pen'
  | 'repeat'
  | 'gamepad2'
  | 'image'
  | 'users'
  | 'repeat2'
  | 'volume2'
  | 'music'
  | 'mic'
  | 'scissors'
  | 'wind'
  | 'coins';
type BestUseCaseItem = { title: string; icon: BestUseCaseIconKey; chips?: string[] };
type RelatedItem = {
  brand: string;
  title: string;
  description: string;
  modelSlug?: string | null;
  ctaLabel?: string | null;
  href?: string | null;
};
type EngineKeySpecsEntry = {
  modelSlug?: string;
  engineId?: string;
  keySpecs?: Record<string, unknown>;
  sources?: string[];
};
type EngineKeySpecsFile = {
  version?: string;
  last_updated?: string;
  specs?: EngineKeySpecsEntry[];
};
type KeySpecKey =
  | 'pricePerImage'
  | 'pricePerSecond'
  | 'releaseDate'
  | 'textToImage'
  | 'imageToImage'
  | 'textToVideo'
  | 'imageToVideo'
  | 'videoToVideo'
  | 'firstLastFrame'
  | 'referenceImageStyle'
  | 'referenceVideo'
  | 'maxResolution'
  | 'maxDuration'
  | 'aspectRatios'
  | 'fpsOptions'
  | 'outputFormats'
  | 'audioOutput'
  | 'nativeAudioGeneration'
  | 'lipSync'
  | 'cameraMotionControls'
  | 'watermark';
type KeySpecRow = { id: string; key: KeySpecKey; label: string; value: string; valueLines?: string[] };
type KeySpecValues = Record<KeySpecKey, string>;

type PromptingTabId = 'quick' | 'structured' | 'pro' | 'storyboard';

type PromptingTab = {
  id: PromptingTabId;
  label: string;
  title: string;
  description?: string;
  copy: string;
};

type SoraCopy = {
  heroEyebrow: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroSupportLine: string | null;
  heroBadge: string | null;
  heroSpecChips: HeroSpecChip[];
  heroTrustLine: string | null;
  heroDesc1: string | null;
  heroDesc2: string | null;
  primaryCta: string | null;
  primaryCtaHref: string | null;
  secondaryCta: string | null;
  secondaryCtaHref: string | null;
  whyTitle: string | null;
  heroHighlights: string[];
  bestUseCasesTitle: string | null;
  bestUseCaseItems: BestUseCaseItem[];
  bestUseCases: string[];
  whatTitle: string | null;
  whatIntro1: string | null;
  whatIntro2: string | null;
  whatFlowTitle: string | null;
  whatFlowSteps: string[];
  quickStartTitle: string | null;
  quickStartBlocks: QuickStartBlock[];
  howToLatamTitle: string | null;
  howToLatamSteps: string[];
  specTitle: string | null;
  specNote: string | null;
  specSections: SpecSection[];
  specValueProp: string | null;
  quickPricingTitle: string | null;
  quickPricingItems: string[];
  hideQuickPricing: boolean;
  showPricePerSecondInSpecs: boolean;
  hidePricingSection: boolean;
  microCta: string | null;
  galleryTitle: string | null;
  galleryIntro: string | null;
  gallerySceneCta: string | null;
  galleryAllCta: string | null;
  recreateLabel: string | null;
  promptingTitle?: string | null;
  promptingIntro?: string | null;
  promptingTip?: string | null;
  promptingGuideLabel?: string | null;
  promptingGuideUrl?: string | null;
  promptingTabs: PromptingTab[];
  imageTitle: string | null;
  imageIntro: string | null;
  imageFlow: string[];
  imageWhy: string[];
  multishotTitle: string | null;
  multishotIntro1: string | null;
  multishotIntro2: string | null;
  multishotTips: string[];
  demoTitle: string | null;
  demoPromptLabel: string | null;
  demoPrompt: string[];
  demoNotes: string[];
  tipsTitle: string | null;
  tipsIntro: string | null;
  strengths: string[];
  boundaries: string[];
  troubleshootingTitle: string | null;
  troubleshootingItems: string[];
  tipsFooter: string | null;
  safetyTitle: string | null;
  safetyRules: string[];
  safetyInterpretation: string[];
  safetyNote: string | null;
  comparisonTitle: string | null;
  comparisonPoints: string[];
  comparisonCta: string | null;
  relatedCtaSora2: string | null;
  relatedCtaSora2Pro: string | null;
  relatedTitle: string | null;
  relatedSubtitle: string | null;
  relatedItems: RelatedItem[];
  finalPara1: string | null;
  finalPara2: string | null;
  finalButton: string | null;
  faqTitle: string | null;
  faqs: LocalizedFaqEntry[];
  promptingGlobalPrinciples: string[];
  promptingEngineWhy: string[];
  promptingTabNotes: {
    quick?: string;
    structured?: string;
    pro?: string;
    storyboard?: string;
  };
};

export function generateStaticParams() {
  const engines = listFalEngines();
  return locales.flatMap((locale) => engines.map((entry) => ({ locale, slug: entry.modelSlug })));
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';
const PROVIDER_INFO_MAP: Record<string, { name: string; url: string }> = {
  openai: { name: 'OpenAI', url: 'https://openai.com' },
  'google-veo': { name: 'Google DeepMind', url: 'https://deepmind.google/technologies/veo/' },
  pika: { name: 'Pika Labs', url: 'https://pika.art' },
  minimax: { name: 'MiniMax', url: 'https://www.minimaxi.com' },
  kling: { name: 'Kling by Kuaishou', url: 'https://www.kuaishou.com/en' },
  wan: { name: 'Wan AI', url: 'https://www.wan-ai.com' },
  lightricks: { name: 'Lightricks', url: 'https://www.lightricks.com' },
};
const AVAILABILITY_SCHEMA_MAP: Record<string, string> = {
  available: 'https://schema.org/InStock',
  limited: 'https://schema.org/LimitedAvailability',
  waitlist: 'https://schema.org/PreOrder',
  paused: 'https://schema.org/Discontinued',
};
const HERO_SPEC_ICON_MAP = {
  resolution: Monitor,
  duration: Clock,
  textToVideo: Type,
  imageToVideo: ImageIcon,
  aspectRatio: Crop,
  audio: Volume2,
} as const;
const BEST_USE_CASE_ICON_MAP = {
  ads: Megaphone,
  ugc: User,
  product: Box,
  storyboard: Clapperboard,
  type: Type,
  cinematic: Film,
  camera: Camera,
  layers: Layers,
  zap: Zap,
  audio: Volume2,
  sparkles: Sparkles,
  smartphone: Smartphone,
  wand2: Wand2,
  arrowLeftRight: ArrowLeftRight,
  layout: LayoutTemplate,
  pen: PenTool,
  repeat: Repeat,
  gamepad2: Gamepad2,
  image: ImageIcon,
  users: Users,
  repeat2: Repeat2,
  volume2: Volume2,
  music: Music,
  mic: Mic,
  scissors: Scissors,
  wind: Wind,
  coins: Coins,
} as const;
const FULL_BLEED_SECTION =
  "relative isolate before:absolute before:inset-y-0 before:left-1/2 before:right-1/2 before:-ml-[50vw] before:-mr-[50vw] before:content-[''] before:-z-[2] after:absolute after:inset-y-0 after:left-1/2 after:right-1/2 after:-ml-[50vw] after:-mr-[50vw] after:content-[''] after:-z-[1]";
const SECTION_BG_A =
  'before:bg-surface-2/70 dark:before:bg-surface-2/30 before:border-t before:border-hairline/80 dark:before:border-transparent before:shadow-[inset_0_16px_24px_-18px_rgba(15,23,42,0.12)] dark:before:shadow-[inset_0_16px_24px_-18px_rgba(0,0,0,0.30)] after:opacity-0 dark:after:opacity-100 dark:after:bg-[radial-gradient(900px_680px_at_5%_-10%,_rgba(91,124,250,0.06),_transparent_70%),_radial-gradient(720px_520px_at_95%_0%,_rgba(34,197,94,0.05),_transparent_70%),_radial-gradient(900px_700px_at_55%_85%,_rgba(236,72,153,0.05),_transparent_75%),_radial-gradient(720px_520px_at_40%_35%,_rgba(250,204,21,0.045),_transparent_75%),_radial-gradient(800px_600px_at_85%_60%,_rgba(59,130,246,0.045),_transparent_75%)] dark:after:mix-blend-screen';
const SECTION_BG_B =
  'before:bg-surface-3/70 dark:before:bg-surface-3/30 before:border-t before:border-hairline/80 dark:before:border-transparent before:shadow-[inset_0_16px_24px_-18px_rgba(15,23,42,0.12)] dark:before:shadow-[inset_0_16px_24px_-18px_rgba(0,0,0,0.30)] after:opacity-0 dark:after:opacity-100 dark:after:bg-[radial-gradient(900px_680px_at_5%_-10%,_rgba(91,124,250,0.06),_transparent_70%),_radial-gradient(720px_520px_at_95%_0%,_rgba(34,197,94,0.05),_transparent_70%),_radial-gradient(900px_700px_at_55%_85%,_rgba(236,72,153,0.05),_transparent_75%),_radial-gradient(720px_520px_at_40%_35%,_rgba(250,204,21,0.045),_transparent_75%),_radial-gradient(800px_600px_at_85%_60%,_rgba(59,130,246,0.045),_transparent_75%)] dark:after:mix-blend-screen';
const HERO_BG =
  'before:bg-surface-2/70 dark:before:bg-surface-2/30 after:opacity-0 dark:after:opacity-100 dark:after:bg-[radial-gradient(900px_680px_at_5%_-10%,_rgba(91,124,250,0.06),_transparent_70%),_radial-gradient(720px_520px_at_95%_0%,_rgba(34,197,94,0.05),_transparent_70%),_radial-gradient(900px_700px_at_55%_85%,_rgba(236,72,153,0.05),_transparent_75%),_radial-gradient(720px_520px_at_40%_35%,_rgba(250,204,21,0.045),_transparent_75%),_radial-gradient(800px_600px_at_85%_60%,_rgba(59,130,246,0.045),_transparent_75%)] dark:after:mix-blend-screen';
const SECTION_PAD = 'px-6 py-9 sm:px-8 sm:py-12';
const SECTION_SCROLL_MARGIN = 'scroll-mt-[calc(var(--header-height)+64px)]';
const FULL_BLEED_CONTENT = 'relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-[100vw]';
const GENERIC_TRUST_LINE = 'Pay-as-you-go · Price shown before you generate';
const BEST_USE_CASE_ICON_KEYS: BestUseCaseIconKey[] = [
  'ads',
  'ugc',
  'product',
  'storyboard',
  'type',
  'cinematic',
  'camera',
  'layers',
  'zap',
  'audio',
  'sparkles',
  'smartphone',
  'wand2',
  'arrowLeftRight',
  'layout',
  'pen',
  'repeat',
  'gamepad2',
  'image',
  'users',
  'repeat2',
  'volume2',
  'music',
  'mic',
  'scissors',
  'wind',
  'coins',
];
const BEST_USE_CASE_ICON_RULES: Array<{ icon: BestUseCaseIconKey; test: RegExp }> = [
  { icon: 'ads', test: /\b(ad|ads|advert|advertising|marketing|campaign|promo|commercial)s?\b/i },
  { icon: 'ugc', test: /\bugc\b|user[-\s]?generated|creator|influencer|lifestyle|social\b/i },
  { icon: 'product', test: /\bproduct|e-?commerce|shop|retail|catalog|packaging|brand\b/i },
  { icon: 'storyboard', test: /\bstoryboard|concept|previs|animatic|pitch|shot list|story\b/i },
  { icon: 'type', test: /\btypography|type|poster|copy|text\b/i },
  { icon: 'layers', test: /\bcontinuity|multi[-\s]?beat|multi[-\s]?scene|sequenc|chain\b/i },
  { icon: 'cinematic', test: /\bcinematic|film|director|lens|camera\b/i },
  { icon: 'camera', test: /\bimage-to-video|image to video|remaster|reference still|lighting\b/i },
  { icon: 'zap', test: /\bfast|rapid|quick|draft|iterate|iteration\b/i },
  { icon: 'audio', test: /\baudio|sound|music|voice|sfx\b/i },
  { icon: 'sparkles', test: /\bhero|premium|polished|showcase|sparkle|sparkles\b/i },
  { icon: 'smartphone', test: /\bsocial|mobile|phone|vertical|reel|tiktok|shorts\b/i },
  { icon: 'wand2', test: /\bstyle|stylize|variation|variants|explore|exploration|look\b/i },
  { icon: 'arrowLeftRight', test: /\bbefore\/after|before and after|transform|transition\b/i },
  { icon: 'layout', test: /\bui|layout|interface|screen|wireframe\b/i },
  { icon: 'pen', test: /\bsketch|draw|draft|illustration\b/i },
  { icon: 'repeat', test: /\bloop|repeat|seamless\b/i },
  { icon: 'gamepad2', test: /\bgaming|game|fandom|pop\b/i },
  { icon: 'image', test: /\bkeyframe|still|image\b/i },
  { icon: 'users', test: /\bsubject consistency|reference video|characters|people\b/i },
  { icon: 'repeat2', test: /\bmatch cut|transition|bridge\b/i },
  { icon: 'volume2', test: /\bsound bed|audio url|soundtrack\b/i },
  { icon: 'music', test: /\bmusic|track|beat|score\b/i },
  { icon: 'mic', test: /\bvoiceover|voice over|dialogue|vo\b/i },
  { icon: 'scissors', test: /\bcutdown|edit|trim|cut\b/i },
  { icon: 'wind', test: /\bwind|cloth|particles|physics|inertia\b/i },
  { icon: 'coins', test: /\bbudget|cheap|low cost|volume\b/i },
];
const DEFAULT_CHIPS_BY_ICON: Record<BestUseCaseIconKey, string[]> = {
  ads: ['Fast iteration', 'Audio'],
  ugc: ['Vertical', 'Natural motion'],
  product: ['Clean detail', 'Lighting'],
  storyboard: ['Shot list', '4–12s'],
  type: ['Typography', 'Readable'],
  cinematic: ['Camera control', 'Motion'],
  camera: ['Lighting continuity', 'High-res'],
  layers: ['Continuity', 'Multi-beat'],
  zap: ['Fast iteration', 'Low latency'],
  audio: ['Sound cues', 'Rhythm'],
  sparkles: ['Hero shot', 'Polished'],
  smartphone: ['Vertical', 'Variants'],
  wand2: ['Style', 'Variants'],
  arrowLeftRight: ['Before/after', 'Transitions'],
  layout: ['UI', 'Layout'],
  pen: ['Sketch', 'Reveal'],
  repeat: ['Loops', 'Motion'],
  gamepad2: ['Gaming', 'Pop'],
  image: ['Keyframe', 'Transition'],
  users: ['Consistency', 'Reference'],
  repeat2: ['Transitions', 'Match cuts'],
  volume2: ['Sound bed', 'Audio'],
  music: ['Timing', 'Beats'],
  mic: ['Voice', 'Dialogue'],
  scissors: ['Cutdowns', 'Edits'],
  wind: ['Physics', 'Motion'],
  coins: ['Budget', 'Variants'],
};

const SECTION_LABELS: Record<
  AppLocale,
  {
    specs: string;
    examples: string;
    prompting: string;
    tips: string;
    compare: string;
    safety: string;
    faq: string;
  }
> = {
  en: {
    specs: 'Specs',
    examples: 'Examples',
    prompting: 'Prompting',
    tips: 'Tips',
    compare: 'Compare',
    safety: 'Safety',
    faq: 'FAQ',
  },
  fr: {
    specs: 'Spécifications',
    examples: 'Exemples',
    prompting: 'Prompts',
    tips: 'Conseils',
    compare: 'Comparer',
    safety: 'Sécurité',
    faq: 'FAQ',
  },
  es: {
    specs: 'Especificaciones',
    examples: 'Ejemplos',
    prompting: 'Prompts',
    tips: 'Consejos',
    compare: 'Comparar',
    safety: 'Seguridad',
    faq: 'FAQ',
  },
};

const SPEC_TITLE_BASE: Record<AppLocale, string> = {
  en: 'Real Specs',
  fr: 'Spécifications réelles',
  es: 'Especificaciones reales',
};

const SPECS_DECISION_NOTES: Record<AppLocale, string> = {
  en: 'The limits that shape your renders.',
  fr: 'Les limites qui structurent vos rendus.',
  es: 'Los límites que definen tus renders.',
};

const SPEC_STATUS_LABELS: Record<AppLocale, { supported: string; notSupported: string; pending: string }> = {
  en: { supported: 'Supported', notSupported: 'Not supported', pending: 'Data pending' },
  fr: { supported: 'Pris en charge', notSupported: 'Non pris en charge', pending: 'Données en attente' },
  es: { supported: 'Compatible', notSupported: 'No compatible', pending: 'Datos pendientes' },
};

const AUTO_SPEC_LABELS: Record<
  AppLocale,
  {
    inputsTitle: string;
    audioTitle: string;
    textToVideo: string;
    imageToVideo: string;
    videoToVideo: string;
    referenceImageStyle: string;
    referenceVideo: string;
    audioOutput: string;
    nativeAudio: string;
    lipSync: string;
  }
> = {
  en: {
    inputsTitle: 'Inputs & file types',
    audioTitle: 'Audio',
    textToVideo: 'Text → Video',
    imageToVideo: 'Image → Video',
    videoToVideo: 'Video → Video',
    referenceImageStyle: 'Reference image / style',
    referenceVideo: 'Reference video',
    audioOutput: 'Audio output',
    nativeAudio: 'Native audio',
    lipSync: 'Lip sync',
  },
  fr: {
    inputsTitle: 'Entrées & types de fichiers',
    audioTitle: 'Audio',
    textToVideo: 'Texte → Vidéo',
    imageToVideo: 'Image → Vidéo',
    videoToVideo: 'Vidéo → Vidéo',
    referenceImageStyle: 'Image de référence / style',
    referenceVideo: 'Vidéo de référence',
    audioOutput: 'Sortie audio',
    nativeAudio: 'Audio natif',
    lipSync: 'Synchronisation labiale',
  },
  es: {
    inputsTitle: 'Entradas y tipos de archivo',
    audioTitle: 'Audio',
    textToVideo: 'Texto → Video',
    imageToVideo: 'Imagen → Video',
    videoToVideo: 'Video → Video',
    referenceImageStyle: 'Imagen de referencia / estilo',
    referenceVideo: 'Video de referencia',
    audioOutput: 'Salida de audio',
    nativeAudio: 'Audio nativo',
    lipSync: 'Sincronización labial',
  },
};

const COMPARE_COPY_BY_LOCALE: Record<
  AppLocale,
  {
    title: (model: string) => string;
    introPrefix: (model: string) => string;
    introStrong: string;
    introSuffix: string;
    subline: string;
    ctaCompare: (model: string, other: string) => string;
    ctaExplore: (other: string) => string;
    cardDescription: (model: string, other: string) => string;
  }
> = {
  en: {
    title: (model) => `Compare ${model} vs other AI video models`,
    introPrefix: (model) =>
      `Not sure if ${model} is the best fit for your shot? These side-by-side comparisons break down the tradeoffs — `,
    introStrong: 'price per second, resolution, audio, speed, and motion style',
    introSuffix: ' — so you can pick the right engine fast.',
    subline: 'Each page includes real outputs and practical best-use cases.',
    ctaCompare: (model, other) => `Compare ${model} vs ${other} →`,
    ctaExplore: (other) => `Explore ${other} →`,
    cardDescription: (model, other) =>
      `Compare ${model} vs ${other} on price, resolution, audio, speed, and motion style.`,
  },
  fr: {
    title: (model) => `Comparer ${model} aux autres modèles vidéo IA`,
    introPrefix: (model) =>
      `Vous ne savez pas si ${model} est le meilleur choix pour votre plan ? Ces comparatifs côte à côte détaillent les compromis — `,
    introStrong: 'prix par seconde, résolution, audio, vitesse et style de mouvement',
    introSuffix: ' — pour choisir rapidement le bon moteur.',
    subline: 'Chaque page inclut des rendus réels et des cas d’usage concrets.',
    ctaCompare: (model, other) => `Comparer ${model} vs ${other} →`,
    ctaExplore: (other) => `Voir ${other} →`,
    cardDescription: (model, other) =>
      `Comparez ${model} vs ${other} sur le prix, la résolution, l’audio, la vitesse et le style de mouvement.`,
  },
  es: {
    title: (model) => `Comparar ${model} con otros modelos de video IA`,
    introPrefix: (model) =>
      `¿No estás seguro de si ${model} es la mejor opción para tu toma? Estas comparativas lado a lado muestran los compromisos — `,
    introStrong: 'precio por segundo, resolución, audio, velocidad y estilo de movimiento',
    introSuffix: ' — para elegir el motor adecuado rápidamente.',
    subline: 'Cada página incluye renders reales y casos de uso prácticos.',
    ctaCompare: (model, other) => `Comparar ${model} vs ${other} →`,
    ctaExplore: (other) => `Ver ${other} →`,
    cardDescription: (model, other) =>
      `Compara ${model} vs ${other} en precio, resolución, audio, velocidad y estilo de movimiento.`,
  },
};

const SPEC_ROW_LABEL_OVERRIDES: Record<
  AppLocale,
  { video: Partial<Record<KeySpecKey, string>>; image: Partial<Record<KeySpecKey, string>> }
> = {
  en: { video: {}, image: {} },
  fr: {
    video: {
      pricePerSecond: 'Prix / seconde',
      textToVideo: 'Texte→Vidéo',
      imageToVideo: 'Image→Vidéo',
      videoToVideo: 'Vidéo→Vidéo',
      firstLastFrame: 'Première / dernière image',
      referenceImageStyle: 'Image de référence / style',
      referenceVideo: 'Vidéo de référence',
      maxResolution: 'Résolution max',
      maxDuration: 'Durée max',
      aspectRatios: 'Formats',
      fpsOptions: 'Options FPS',
      outputFormats: 'Format de sortie',
      audioOutput: 'Sortie audio',
      nativeAudioGeneration: 'Audio natif',
      lipSync: 'Synchronisation labiale',
      cameraMotionControls: 'Contrôle caméra / mouvement',
      watermark: 'Filigrane',
      releaseDate: 'Date de sortie',
    },
    image: {
      pricePerImage: 'Prix / image',
      textToImage: 'Texte→Image',
      imageToImage: 'Image→Image',
      maxResolution: 'Options de résolution',
      aspectRatios: 'Formats',
      outputFormats: 'Format de sortie',
      releaseDate: 'Date de sortie',
    },
  },
  es: {
    video: {
      pricePerSecond: 'Precio / segundo',
      textToVideo: 'Texto→Video',
      imageToVideo: 'Imagen→Video',
      videoToVideo: 'Video→Video',
      firstLastFrame: 'Primer/último fotograma',
      referenceImageStyle: 'Imagen de referencia / estilo',
      referenceVideo: 'Video de referencia',
      maxResolution: 'Resolución máx.',
      maxDuration: 'Duración máx.',
      aspectRatios: 'Formatos',
      fpsOptions: 'Opciones de FPS',
      outputFormats: 'Formato de salida',
      audioOutput: 'Salida de audio',
      nativeAudioGeneration: 'Audio nativo',
      lipSync: 'Sincronización labial',
      cameraMotionControls: 'Control de cámara / movimiento',
      watermark: 'Marca de agua',
      releaseDate: 'Fecha de lanzamiento',
    },
    image: {
      pricePerImage: 'Precio / imagen',
      textToImage: 'Texto→Imagen',
      imageToImage: 'Imagen→Imagen',
      maxResolution: 'Opciones de resolución',
      aspectRatios: 'Formatos',
      outputFormats: 'Formato de salida',
      releaseDate: 'Fecha de lanzamiento',
    },
  },
};

const PRICE_AUDIO_LABELS: Record<AppLocale, { on: string; off: string }> = {
  en: { on: 'Audio on', off: 'Audio off' },
  fr: { on: 'Audio activé', off: 'Audio coupé' },
  es: { on: 'Audio activado', off: 'Audio desactivado' },
};

const TIPS_CARD_LABELS: Record<
  AppLocale,
  { strengths: string; boundaries: string }
> = {
  en: { strengths: 'What works best', boundaries: 'Hard limits to keep in mind' },
  fr: { strengths: 'Ce qui marche le mieux', boundaries: 'Limites à garder en tête' },
  es: { strengths: 'Lo que funciona mejor', boundaries: 'Límites a tener en cuenta' },
};
const VIDEO_SPEC_ROW_DEFS: Array<{ key: KeySpecKey; label: string }> = [
  { key: 'pricePerSecond', label: 'Price / second' },
  { key: 'textToVideo', label: 'Text-to-Video' },
  { key: 'imageToVideo', label: 'Image-to-Video' },
  { key: 'videoToVideo', label: 'Video-to-Video' },
  { key: 'firstLastFrame', label: 'First/Last frame' },
  { key: 'referenceImageStyle', label: 'Reference image / style reference' },
  { key: 'referenceVideo', label: 'Reference video' },
  { key: 'maxResolution', label: 'Max resolution' },
  { key: 'maxDuration', label: 'Max duration' },
  { key: 'aspectRatios', label: 'Aspect ratios' },
  { key: 'fpsOptions', label: 'FPS options' },
  { key: 'outputFormats', label: 'Output format' },
  { key: 'audioOutput', label: 'Audio output' },
  { key: 'nativeAudioGeneration', label: 'Native audio generation' },
  { key: 'lipSync', label: 'Lip sync' },
  { key: 'cameraMotionControls', label: 'Camera / motion controls' },
  { key: 'watermark', label: 'Watermark' },
  { key: 'releaseDate', label: 'Release date' },
];

const IMAGE_SPEC_ROW_DEFS: Array<{ key: KeySpecKey; label: string }> = [
  { key: 'pricePerImage', label: 'Price / image' },
  { key: 'textToImage', label: 'Text-to-Image' },
  { key: 'imageToImage', label: 'Image-to-Image' },
  { key: 'maxResolution', label: 'Resolution options' },
  { key: 'aspectRatios', label: 'Aspect ratios' },
  { key: 'outputFormats', label: 'Output format' },
  { key: 'releaseDate', label: 'Release date' },
];

function resolveProviderInfo(engine: FalEngineEntry) {
  const fallback = PARTNER_BRAND_MAP.get(engine.brandId);
  const override = PROVIDER_INFO_MAP[engine.brandId];
  return {
    name: override?.name ?? fallback?.label ?? engine.brandId,
    url: override?.url ?? fallback?.availabilityLink ?? SITE,
  };
}

function buildOfferSchema(canonical: string, engine: FalEngineEntry) {
  return {
    '@type': 'Offer',
    url: canonical,
    priceCurrency: 'USD',
    price: '0',
    availability: AVAILABILITY_SCHEMA_MAP[engine.availability] ?? AVAILABILITY_SCHEMA_MAP.limited,
    description: 'Pay-as-you-go pricing (varies by provider and duration).',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: 0,
      priceCurrency: 'USD',
      referenceQuantity: {
        '@type': 'QuantitativeValue',
        value: 1,
        unitCode: 'SEC',
      },
    },
  };
}

function buildProductSchema({
  engine,
  canonical,
  description,
  heroTitle,
  heroPosterAbsolute,
}: {
  engine: FalEngineEntry;
  canonical: string;
  description: string;
  heroTitle: string;
  heroPosterAbsolute: string | null;
}) {
  const provider = resolveProviderInfo(engine);
  const offer = buildOfferSchema(canonical, engine);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: heroTitle,
    description,
    category: 'AI Video Generator',
    url: canonical,
    image: heroPosterAbsolute ? [heroPosterAbsolute] : undefined,
    brand: {
      '@type': 'Brand',
      name: provider.name,
      url: provider.url,
    },
    manufacturer: {
      '@type': 'Organization',
      name: provider.name,
      url: provider.url,
    },
    offers: offer,
  };
}

function buildSoftwareSchema({
  engine,
  canonical,
  description,
  heroTitle,
}: {
  engine: FalEngineEntry;
  canonical: string;
  description: string;
  heroTitle: string;
}) {
  const provider = resolveProviderInfo(engine);
  const offer = buildOfferSchema(canonical, engine);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: heroTitle,
    description,
    applicationCategory: 'VideoGenerationApplication',
    operatingSystem: 'Web',
    url: canonical,
    provider: {
      '@type': 'Organization',
      name: provider.name,
      url: provider.url,
    },
    offers: offer,
  };
}
const MODELS_BASE_PATH_MAP = buildSlugMap('models');
const COMPARE_BASE_PATH_MAP = buildSlugMap('compare');
const COMPARE_EXCLUDED_SLUGS = new Set(['nano-banana', 'nano-banana-pro']);

function buildDetailSlugMap(slug: string) {
  return locales.reduce<Record<AppLocale, string>>((acc, locale) => {
    const base = MODELS_BASE_PATH_MAP[locale] ?? 'models';
    acc[locale] = `${base}/${slug}`;
    return acc;
  }, {} as Record<AppLocale, string>);
}

const PRICING_SECTION_TITLES = {
  en: 'Pricing',
  fr: 'Tarifs',
  es: 'Precios',
} as const;

const PRICING_SECTION_MATCH = new Set(['pricing', 'tarifs', 'precios']);
const PRICING_EXTRA_MARKERS = ['exemples rapides', 'quick examples', 'ejemplos rápidos'];

function formatPerSecond(locale: AppLocale, currency: string, amount: number) {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCurrency(locale: AppLocale, currency: string, amount: number) {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPricingLine(locale: AppLocale, amountLabel: string, resolution: string, engineId: string) {
  const spacer = locale === 'en' ? 'at' : 'en';
  return `${amountLabel}/s ${spacer} ${formatResolutionLabel(engineId, resolution)}`;
}

function selectPricingResolutions(resolutions: string[]): string[] {
  const preferred = ['720p', '1080p', '4k', '1440p', '768p', '512p'];
  const byKey = new Map(resolutions.map((value) => [value.toLowerCase(), value]));
  const ordered: string[] = [];
  preferred.forEach((key) => {
    const match = byKey.get(key);
    if (match) ordered.push(match);
  });
  resolutions.forEach((value) => {
    if (!ordered.includes(value)) ordered.push(value);
  });
  return ordered.slice(0, 3);
}

function formatPerSecondLabel(locale: AppLocale, currency: string, perSecond: number): string {
  return `${formatPerSecond(locale, currency, perSecond)}/s`;
}

function resolvePricingResolutions(engineCaps: EngineCaps): string[] {
  const resolutions = (engineCaps.resolutions ?? []).filter((value) => value && value !== 'auto');
  if (resolutions.length) return Array.from(new Set(resolutions));
  const fallback = resolveDefaultResolution(engineCaps);
  return fallback ? [fallback] : [];
}

async function computePerSecondValue(
  engineCaps: EngineCaps,
  locale: AppLocale,
  resolution: string,
  addons?: Record<string, boolean>
): Promise<{ label: string; perSecond: number } | null> {
  const durationSec = selectQuickDurations(engineCaps)[0] ?? 5;
  try {
    const snapshot = await computePricingSnapshot({
      engine: engineCaps,
      durationSec,
      resolution,
      membershipTier: 'member',
      ...(addons ? { addons } : {}),
    });
    const seconds = typeof snapshot.base.seconds === 'number' ? snapshot.base.seconds : durationSec;
    if (!seconds) return null;
    const perSecond = snapshot.totalCents / seconds / 100;
    const currency = snapshot.currency ?? 'USD';
    return { label: formatPerSecondLabel(locale, currency, perSecond), perSecond };
  } catch {
    return null;
  }
}

async function buildPricePerSecondRows(engineCaps: EngineCaps, locale: AppLocale): Promise<KeySpecRow[]> {
  const resolutions = resolvePricingResolutions(engineCaps);
  if (!resolutions.length) return [];

  const hasAudioOff = Boolean(engineCaps.pricingDetails?.addons?.audio_off);
  const rowLabel = resolveSpecRowLabel(locale, 'pricePerSecond', false);
  const audioLabels = resolveAudioPricingLabels(locale);
  const rows: KeySpecRow[] = [];
  const displayOn = new Map<string, string>();
  const displayOff = new Map<string, string>();

  for (const resolution of resolutions) {
    const onValue = await computePerSecondValue(engineCaps, locale, resolution);
    if (onValue) {
      displayOn.set(resolution, onValue.label);
    }
    if (hasAudioOff) {
      const offValue = await computePerSecondValue(engineCaps, locale, resolution, { audio_off: true });
      if (offValue) {
        displayOff.set(resolution, offValue.label);
      }
    }
  }

  if (!displayOn.size) return [];

  const onValues = Array.from(displayOn.values());
  const onSame = new Set(onValues).size === 1;
  const offValues = Array.from(displayOff.values());
  const offSame = offValues.length ? new Set(offValues).size === 1 : false;

  if (hasAudioOff && displayOff.size === displayOn.size) {
    const audioDiffers = Array.from(displayOn.entries()).some(([resolution, value]) => displayOff.get(resolution) !== value);
    if (audioDiffers && onSame && offSame) {
      const onLabel = onValues[0];
      const offLabel = offValues[0];
      rows.push({
        id: 'pricePerSecond',
        key: 'pricePerSecond',
        label: rowLabel,
        value: `${audioLabels.on} ${onLabel} · ${audioLabels.off} ${offLabel}`,
      });
      return rows;
    }

    if (audioDiffers) {
      const lines = resolutions
        .map((resolution) => {
          const onLabel = displayOn.get(resolution);
          const offLabel = displayOff.get(resolution);
          if (!onLabel || !offLabel) return null;
          const displayResolution = formatResolutionLabel(engineCaps.id, resolution);
          return `${displayResolution}: ${audioLabels.on} ${onLabel} · ${audioLabels.off} ${offLabel}`;
        })
        .filter((line): line is string => Boolean(line));
      if (lines.length) {
        rows.push({
          id: 'pricePerSecond',
          key: 'pricePerSecond',
          label: rowLabel,
          value: lines[0],
          valueLines: lines,
        });
        return rows;
      }
    }
  }

  if (onSame) {
    rows.push({
      id: 'pricePerSecond',
      key: 'pricePerSecond',
      label: rowLabel,
      value: onValues[0],
    });
    return rows;
  }

  const lines = resolutions
    .map((resolution) => {
      const label = displayOn.get(resolution);
      const displayResolution = formatResolutionLabel(engineCaps.id, resolution);
      return label ? `${displayResolution} ${label}` : null;
    })
    .filter((line): line is string => Boolean(line));

  if (lines.length) {
    rows.push({
      id: 'pricePerSecond',
      key: 'pricePerSecond',
      label: rowLabel,
      value: lines[0],
      valueLines: lines,
    });
  }

  return rows;
}

function parseDurationValue(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.round(numeric);
  }
  return null;
}

function selectQuickDurations(engine: EngineCaps): number[] {
  const durationField = engine.inputSchema?.optional?.find((field) =>
    field.id === 'duration_seconds' || field.id === 'duration'
  );
  const values = new Set<number>();

  if (Array.isArray(durationField?.values)) {
    durationField.values.forEach((value) => {
      const parsed = parseDurationValue(value);
      if (parsed) values.add(parsed);
    });
  }

  if (!values.size) {
    const minRaw = typeof durationField?.min === 'number' ? durationField.min : 1;
    const maxRaw = typeof durationField?.max === 'number' ? durationField.max : engine.maxDurationSec ?? minRaw;
    const min = Math.max(1, Math.round(minRaw));
    const max = Math.max(min, Math.round(maxRaw));
    const mid = Math.round((min + max) / 2);
    values.add(min);
    values.add(mid);
    values.add(max);
  }

  const sorted = Array.from(values).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length <= 3) return sorted;

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = sorted[Math.floor(sorted.length / 2)];
  return Array.from(new Set([min, mid, max]));
}

function resolveDefaultResolution(engine: EngineCaps): string | null {
  const resolutionField = engine.inputSchema?.optional?.find((field) => field.id === 'resolution');
  const defaultValue = typeof resolutionField?.default === 'string' ? resolutionField.default : null;
  const allowedValues = Array.isArray(resolutionField?.values) ? resolutionField.values : [];
  if (defaultValue && (!allowedValues.length || allowedValues.includes(defaultValue))) {
    return defaultValue;
  }
  const fallback = (engine.resolutions ?? []).find((value) => value && value !== 'auto');
  return fallback ?? null;
}

async function buildPricingItems(engine: EngineCaps, locale: AppLocale): Promise<string[]> {
  const hasVideoMode = engine.modes?.some((mode) => ['t2v', 'i2v', 'r2v'].includes(mode));
  if (!hasVideoMode) return [];
  const resolutions = (engine.resolutions ?? []).filter((value) => value && value !== 'auto');
  if (!resolutions.length) return [];

  const targetResolutions = selectPricingResolutions(resolutions);
  const requestedDuration = 5;
  const items: string[] = [];

  for (const resolution of targetResolutions) {
    try {
      const snapshot = await computePricingSnapshot({
        engine,
        durationSec: requestedDuration,
        resolution,
        membershipTier: 'member',
      });
      const seconds = typeof snapshot.base.seconds === 'number' ? snapshot.base.seconds : requestedDuration;
      const perSecond = seconds > 0 ? snapshot.totalCents / seconds / 100 : snapshot.totalCents / 100;
      const amountLabel = formatPerSecond(locale, snapshot.currency ?? 'USD', perSecond);
      items.push(formatPricingLine(locale, amountLabel, resolution, engine.id));
    } catch {
      // ignore pricing failures for marketing surface
    }
  }

  return items;
}

async function buildPricePerSecondLabel(engine: EngineCaps, locale: AppLocale): Promise<string | null> {
  const resolution = resolveDefaultResolution(engine);
  if (!resolution) return null;
  const durationOptions = selectQuickDurations(engine);
  const durationSec = durationOptions[0] ?? 5;
  try {
    const snapshot = await computePricingSnapshot({
      engine,
      durationSec,
      resolution,
      membershipTier: 'member',
    });
    const seconds = typeof snapshot.base.seconds === 'number' ? snapshot.base.seconds : durationSec;
    if (!seconds) return null;
    const perSecond = snapshot.totalCents / seconds / 100;
    return `${formatPerSecond(locale, snapshot.currency ?? 'USD', perSecond)}/s`;
  } catch {
    return null;
  }
}

async function buildPricePerImageLabel(engine: EngineCaps, locale: AppLocale): Promise<string | null> {
  const resolution = resolveDefaultResolution(engine);
  if (!resolution) return null;
  try {
    const snapshot = await computePricingSnapshot({
      engine,
      durationSec: 1,
      resolution,
      membershipTier: 'member',
    });
    const currency = snapshot.currency ?? engine.pricingDetails?.currency ?? engine.pricing?.currency ?? 'USD';
    return `${formatCurrency(locale, currency, snapshot.totalCents / 100)}/image`;
  } catch {
    return null;
  }
}

async function buildPricePerImageRows(engineCaps: EngineCaps, locale: AppLocale): Promise<KeySpecRow[]> {
  const resolutions = resolvePricingResolutions(engineCaps);
  if (!resolutions.length) return [];

  const rowLabel = resolveSpecRowLabel(locale, 'pricePerImage', true);
  const results = new Map<string, { label: string; cents: number }>();
  for (const resolution of resolutions) {
    try {
      const snapshot = await computePricingSnapshot({
        engine: engineCaps,
        durationSec: 1,
        resolution,
        membershipTier: 'member',
      });
      const currency = snapshot.currency ?? engineCaps.pricingDetails?.currency ?? engineCaps.pricing?.currency ?? 'USD';
      const amount = formatCurrency(locale, currency, snapshot.totalCents / 100);
      results.set(resolution, { label: `${amount}/image`, cents: snapshot.totalCents });
    } catch {
      // ignore pricing failures for marketing surface
    }
  }

  if (!results.size) return [];
  const values = Array.from(results.values()).map((entry) => entry.label);
  const same = new Set(values).size === 1;
  if (same) {
    return [
      {
        id: 'pricePerImage',
        key: 'pricePerImage',
        label: rowLabel,
        value: values[0],
      },
    ];
  }

  const lines = resolutions
    .map((resolution) => {
      const entry = results.get(resolution);
      if (!entry) return null;
      const displayResolution = formatResolutionLabel(engineCaps.id, resolution);
      return `${displayResolution} ${entry.label}`;
    })
    .filter((line): line is string => Boolean(line));

  if (!lines.length) return [];
  return [
    {
      id: 'pricePerImage',
      key: 'pricePerImage',
      label: rowLabel,
      value: lines[0],
      valueLines: lines,
    },
  ];
}

async function buildQuickPricingItems(engine: EngineCaps, locale: AppLocale): Promise<string[]> {
  const durations = selectQuickDurations(engine);
  const resolution = resolveDefaultResolution(engine);
  if (!durations.length || !resolution) return [];
  const items: string[] = [];

  for (const durationSec of durations) {
    try {
      const snapshot = await computePricingSnapshot({
        engine,
        durationSec,
        resolution,
        membershipTier: 'member',
      });
      const amountLabel = formatCurrency(locale, snapshot.currency ?? 'USD', snapshot.totalCents / 100);
      items.push(`${durationSec}s: ${amountLabel}`);
    } catch {
      // ignore pricing failures for marketing surface
    }
  }

  return items;
}

function extractPricingExtras(items: string[]): string[] {
  const index = items.findIndex((item) => {
    const normalized = item.trim().toLowerCase();
    return PRICING_EXTRA_MARKERS.some((marker) => normalized.startsWith(marker));
  });
  if (index < 0) return [];
  return items.slice(index);
}

function applyPricingSection(sections: SpecSection[], locale: AppLocale, pricingItems: string[]): SpecSection[] {
  if (!pricingItems.length) return sections;
  const title = PRICING_SECTION_TITLES[locale] ?? PRICING_SECTION_TITLES.en;
  const index = sections.findIndex((section) =>
    PRICING_SECTION_MATCH.has(section.title.trim().toLowerCase())
  );
  if (index < 0) {
    return [...sections, { title, items: pricingItems }];
  }
  const next = [...sections];
  const extras = extractPricingExtras(next[index].items);
  next[index] = { ...next[index], items: extras.length ? [...pricingItems, ...extras] : pricingItems };
  return next;
}

async function loadEngineKeySpecs(): Promise<Map<string, EngineKeySpecsEntry>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-key-specs.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-key-specs.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineKeySpecsFile;
      const map = new Map<string, EngineKeySpecsEntry>();
      (data.specs ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key) {
          map.set(key, entry);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

function resolveKeySpecValue(
  specs: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  if (!specs || !(key in specs)) return fallback;
  const value = (specs as Record<string, unknown>)[key];
  if (Array.isArray(value)) {
    return value.length ? value.join(' / ') : fallback;
  }
  if (value == null) return fallback;
  const normalized = String(value).trim();
  if (/^(yes|true)$/i.test(normalized)) return 'Supported';
  if (/^(no|false)$/i.test(normalized)) return 'Not supported';
  return normalized;
}

function resolveStatus(value?: boolean | null) {
  if (value === true) return 'Supported';
  if (value === false) return 'Not supported';
  return 'Data pending';
}

function resolveModeSupported(engineCaps: EngineCaps | undefined, mode: string) {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  return modes.includes(mode) ? 'Supported' : 'Not supported';
}

function formatMaxResolution(engineCaps: EngineCaps | undefined) {
  const resolutions = engineCaps?.resolutions ?? [];
  if (!resolutions.length) return 'Data pending';
  if (resolutions.some((value) => /4k/i.test(String(value)))) return '4K';
  if (resolutions.some((value) => /2k/i.test(String(value)))) return '2K';
  const numeric = resolutions
    .map((value) => {
      const raw = String(value).toLowerCase();
      if (raw.includes('square_hd') || raw.includes('portrait_hd') || raw.includes('landscape_hd')) {
        return 720;
      }
      const matchK = raw.match(/(\d+)\s*k/);
      if (matchK) return Number(matchK[1]) * 1000;
      const matchP = raw.match(/(\d+)\s*p/);
      return matchP ? Number(matchP[1]) : null;
    })
    .filter((value): value is number => value != null);
  if (!numeric.length) return resolutions.join(' / ');
  const max = Math.max(...numeric);
  return `${max}p`;
}

function formatDuration(engineCaps: EngineCaps | undefined) {
  const max = engineCaps?.maxDurationSec;
  return typeof max === 'number' ? `${max}s max` : 'Data pending';
}

function formatAspectRatios(engineCaps: EngineCaps | undefined) {
  const ratios = engineCaps?.aspectRatios ?? [];
  return ratios.length ? ratios.join(' / ') : 'Data pending';
}

function formatFps(engineCaps: EngineCaps | undefined) {
  const fps = engineCaps?.fps ?? [];
  return fps.length ? fps.join(' / ') : 'Data pending';
}

function formatImageResolutions(engineCaps: EngineCaps | undefined) {
  const resolutions = engineCaps?.resolutions ?? [];
  return resolutions.length ? resolutions.join(' / ') : 'Data pending';
}

function formatOutputFormats(engineCaps: EngineCaps | undefined) {
  const formats = engineCaps?.inputSchema?.constraints?.supportedFormats ?? [];
  return formats.length ? formats.join(' / ') : 'Data pending';
}

function getPricePerSecondCents(engineCaps: EngineCaps | undefined): number | null {
  const perSecond = engineCaps?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ? Object.values(perSecond.byResolution) : [];
  const cents = perSecond?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return cents;
  }
  const base = engineCaps?.pricing?.base;
  if (typeof base === 'number') {
    return Math.round(base * 100);
  }
  return null;
}

function getPricePerImageCents(engineCaps: EngineCaps | undefined): number | null {
  const flat = engineCaps?.pricingDetails?.flatCents;
  const byResolution = flat?.byResolution ? Object.values(flat.byResolution) : [];
  const cents = flat?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return cents;
  }
  const base = engineCaps?.pricing?.base;
  if (typeof base === 'number') {
    return Math.round(base * 100);
  }
  return null;
}

function formatPricePerSecond(engineCaps: EngineCaps | undefined): string {
  const cents = getPricePerSecondCents(engineCaps);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/s`;
  }
  return 'Data pending';
}

function formatPricePerImage(engineCaps: EngineCaps | undefined): string {
  const cents = getPricePerImageCents(engineCaps);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/image`;
  }
  return 'Data pending';
}

function buildSpecValues(
  entry: FalEngineEntry,
  specs: Record<string, unknown> | undefined,
  pricingOverrides?: { pricePerSecond?: string | null; pricePerImage?: string | null }
): KeySpecValues {
  const engineCaps = entry.engine;
  const isImage = entry.type === 'image' || engineCaps.modes?.some((mode) => mode.endsWith('i'));
  return {
    pricePerImage: resolveKeySpecValue(
      specs,
      'pricePerImage',
      pricingOverrides?.pricePerImage ?? formatPricePerImage(engineCaps)
    ),
    pricePerSecond: resolveKeySpecValue(
      specs,
      'pricePerSecond',
      pricingOverrides?.pricePerSecond ?? formatPricePerSecond(engineCaps)
    ),
    releaseDate: resolveKeySpecValue(specs, 'releaseDate', 'Data pending'),
    textToImage: resolveKeySpecValue(specs, 'textToImage', resolveModeSupported(engineCaps, 't2i')),
    imageToImage: resolveKeySpecValue(specs, 'imageToImage', resolveModeSupported(engineCaps, 'i2i')),
    textToVideo: resolveKeySpecValue(specs, 'textToVideo', resolveModeSupported(engineCaps, 't2v')),
    imageToVideo: resolveKeySpecValue(specs, 'imageToVideo', resolveModeSupported(engineCaps, 'i2v')),
    videoToVideo: resolveKeySpecValue(specs, 'videoToVideo', resolveModeSupported(engineCaps, 'v2v')),
    firstLastFrame: resolveKeySpecValue(specs, 'firstLastFrame', resolveStatus(engineCaps?.keyframes)),
    referenceImageStyle: resolveKeySpecValue(specs, 'referenceImageStyle', resolveModeSupported(engineCaps, 'r2v')),
    referenceVideo: resolveKeySpecValue(specs, 'referenceVideo', 'Data pending'),
    maxResolution: resolveKeySpecValue(
      specs,
      'maxResolution',
      isImage ? formatImageResolutions(engineCaps) : formatMaxResolution(engineCaps)
    ),
    maxDuration: resolveKeySpecValue(specs, 'maxDuration', formatDuration(engineCaps)),
    aspectRatios: resolveKeySpecValue(specs, 'aspectRatios', formatAspectRatios(engineCaps)),
    fpsOptions: resolveKeySpecValue(specs, 'fpsOptions', formatFps(engineCaps)),
    outputFormats: resolveKeySpecValue(specs, 'outputFormats', formatOutputFormats(engineCaps)),
    audioOutput: resolveKeySpecValue(specs, 'audioOutput', resolveStatus(engineCaps?.audio)),
    nativeAudioGeneration: resolveKeySpecValue(specs, 'nativeAudioGeneration', resolveStatus(engineCaps?.audio)),
    lipSync: resolveKeySpecValue(specs, 'lipSync', 'Data pending'),
    cameraMotionControls: resolveKeySpecValue(
      specs,
      'cameraMotionControls',
      resolveStatus(engineCaps?.motionControls)
    ),
    watermark: resolveKeySpecValue(specs, 'watermark', 'No (MaxVideoAI)'),
  };
}

function isPending(value: string) {
  return value.trim().toLowerCase() === 'data pending';
}

function isUnsupported(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === 'not supported' || normalized === 'unsupported';
}

function isSupported(value: string) {
  return value.trim().toLowerCase() === 'supported';
}

function resolveSpecStatusLabels(locale: AppLocale) {
  return SPEC_STATUS_LABELS[locale] ?? SPEC_STATUS_LABELS.en;
}

function localizeSpecStatus(value: string, locale: AppLocale) {
  const labels = resolveSpecStatusLabels(locale);
  if (isSupported(value)) return labels.supported;
  if (isUnsupported(value)) return labels.notSupported;
  if (isPending(value)) return labels.pending;
  return value;
}

function normalizeMaxResolution(value: string) {
  if (value.includes('/') || value.includes(',')) return value;
  const matchP = value.match(/(\d{3,4}p)/i);
  if (matchP) return matchP[1];
  const matchK = value.match(/(\d+)\s?k/i);
  if (matchK) return `${matchK[1]}K`;
  return value;
}

function buildAutoHeroSpecChips(values: KeySpecValues | null): HeroSpecChip[] {
  if (!values) return [];
  const chips: HeroSpecChip[] = [];
  const add = (label: string | null, icon: HeroSpecIconKey | null) => {
    if (!label) return;
    chips.push({ label, icon });
  };

  const resolution = values.maxResolution && !isPending(values.maxResolution)
    ? normalizeMaxResolution(values.maxResolution)
    : null;
  const duration = values.maxDuration && !isPending(values.maxDuration) ? values.maxDuration.replace(' max', '') : null;
  const aspect = values.aspectRatios && !isPending(values.aspectRatios) ? values.aspectRatios : null;

  if (isSupported(values.textToImage)) add('Text→Image', 'textToVideo');
  if (isSupported(values.imageToImage)) add('Image→Image', 'imageToVideo');
  if (isSupported(values.textToVideo)) add('Text→Video', 'textToVideo');
  if (isSupported(values.imageToVideo)) add('Image→Video', 'imageToVideo');
  if (resolution) add(resolution, 'resolution');
  if (duration) add(duration, 'duration');
  if (aspect) add(aspect, 'aspectRatio');
  if (isSupported(values.audioOutput) || isSupported(values.nativeAudioGeneration)) add('Audio', 'audio');

  return chips.slice(0, 6);
}

function normalizeHeroTitle(rawTitle: string, providerName: string | null): string {
  const trimmed = rawTitle.trim();
  const splitMatch = trimmed.split(/\s[–—-]\s/);
  const base = splitMatch[0] ?? trimmed;
  const cleanProvider = providerName?.trim();
  if (cleanProvider && base.toLowerCase().startsWith(cleanProvider.toLowerCase() + ' ')) {
    return base.slice(cleanProvider.length + 1).trim();
  }
  if (base.toLowerCase().startsWith('openai ')) {
    return base.slice('openai '.length).trim();
  }
  return base.trim();
}

function buildEyebrow(providerName: string | null): string | null {
  if (!providerName) return null;
  const normalized = providerName
    .replace(/by\s+.+$/i, '')
    .replace(/\s+DeepMind$/i, '')
    .trim();
  return normalized ? `${normalized} model` : null;
}

function joinUseCaseList(items: string[], maxItems = 3): string | null {
  const cleaned = items.map((item) => item.replace(/\.$/, '').trim()).filter(Boolean);
  if (!cleaned.length) return null;
  const slice = cleaned.slice(0, maxItems);
  if (slice.length === 1) return slice[0];
  if (slice.length === 2) return `${slice[0]} and ${slice[1]}`;
  return `${slice.slice(0, -1).join(', ')}, and ${slice[slice.length - 1]}`;
}

function buildSupportLine(items: string[]): string | null {
  const list = joinUseCaseList(items);
  if (!list) return null;
  return `Best for ${list}.`;
}

function normalizeHeroSubtitle(text: string, locale: AppLocale): string {
  if (!text) return text;
  if (locale !== 'en') return text;
  let output = text;
  output = output.replace(/\b(in|inside|via|on)\s+MaxVideoAI\b/gi, '');
  output = output.replace(/\bMaxVideoAI\b/gi, '');
  let aiCount = 0;
  output = output.replace(/\bAI\b/gi, (match) => {
    aiCount += 1;
    return aiCount === 1 ? match : '';
  });
  output = output.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
  return output;
}

function stripMaxVideoAI(text: string): string {
  let output = text;
  output = output.replace(/\b(as\s+available|available)\s+in\s+MaxVideoAI(?:\s+today)?\b/gi, '');
  output = output.replace(/\b(in|inside|on|via)\s+MaxVideoAI(?:\s+today)?\b/gi, '');
  output = output.replace(/\bMaxVideoAI\b/gi, '');
  output = output.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1');
  output = output.replace(/^[\s–—-]+/, '').replace(/[\s–—-]+$/, '');
  return output.trim();
}

function buildDefaultSpecTitle(providerName: string | null, heroTitle: string, locale: AppLocale): string {
  const base = SPEC_TITLE_BASE[locale] ?? SPEC_TITLE_BASE.en;
  const parts = [providerName, heroTitle].filter(Boolean);
  if (!parts.length) return base;
  return `${base} — ${parts.join(' ')}`;
}

function normalizeSpecTitle(
  _rawTitle: string | null,
  providerName: string | null,
  heroTitle: string,
  locale: AppLocale
): string {
  const cleanedProvider = providerName ? stripMaxVideoAI(providerName) : null;
  const cleanedTitle = stripMaxVideoAI(heroTitle);
  return buildDefaultSpecTitle(cleanedProvider, cleanedTitle, locale);
}

function normalizeSpecNote(_rawNote: string | null, locale: AppLocale): string | null {
  return SPECS_DECISION_NOTES[locale] ?? SPECS_DECISION_NOTES.en;
}

function resolveSectionLabels(locale: AppLocale) {
  return SECTION_LABELS[locale] ?? SECTION_LABELS.en;
}

function resolveSpecRowLabel(locale: AppLocale, key: KeySpecKey, isImageEngine: boolean): string {
  const overrides =
    (SPEC_ROW_LABEL_OVERRIDES[locale] ?? SPEC_ROW_LABEL_OVERRIDES.en)[isImageEngine ? 'image' : 'video'];
  const override = overrides[key];
  if (override) return override;
  const base = isImageEngine ? IMAGE_SPEC_ROW_DEFS : VIDEO_SPEC_ROW_DEFS;
  return base.find((row) => row.key === key)?.label ?? key;
}

function resolveSpecRowDefs(locale: AppLocale, isImageEngine: boolean) {
  const base = isImageEngine ? IMAGE_SPEC_ROW_DEFS : VIDEO_SPEC_ROW_DEFS;
  return base.map((row) => ({
    ...row,
    label: resolveSpecRowLabel(locale, row.key, isImageEngine),
  }));
}

function resolveAudioPricingLabels(locale: AppLocale) {
  return PRICE_AUDIO_LABELS[locale] ?? PRICE_AUDIO_LABELS.en;
}

function resolveCompareCopy(locale: AppLocale, heroTitle: string) {
  const copy = COMPARE_COPY_BY_LOCALE[locale] ?? COMPARE_COPY_BY_LOCALE.en;
  return {
    title: copy.title(heroTitle),
    introPrefix: copy.introPrefix(heroTitle),
    introStrong: copy.introStrong,
    introSuffix: copy.introSuffix,
    subline: copy.subline,
    ctaCompare: (other: string) => copy.ctaCompare(heroTitle, other),
    ctaExplore: (other: string) => copy.ctaExplore(other),
    cardDescription: (other: string) => copy.cardDescription(heroTitle, other),
  };
}

function inferBestUseCaseIcon(title: string): BestUseCaseIconKey {
  const normalized = title.toLowerCase();
  for (const rule of BEST_USE_CASE_ICON_RULES) {
    if (rule.test.test(normalized)) return rule.icon;
  }
  return 'cinematic';
}

function normalizeChips(rawChips: unknown, icon: BestUseCaseIconKey, locale?: AppLocale): string[] {
  const chips =
    Array.isArray(rawChips)
      ? rawChips.map((chip) => (typeof chip === 'string' ? chip.trim() : '')).filter(Boolean)
      : [];
  if (chips.length) return chips.slice(0, 2);
  if (locale === 'en') return DEFAULT_CHIPS_BY_ICON[icon].slice(0, 2);
  return [];
}

function normalizeBestUseCaseItems(value: unknown, locale?: AppLocale): BestUseCaseItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        const title = entry.trim();
        if (!title) return null;
        const icon = inferBestUseCaseIcon(title);
        return {
          title,
          icon,
          chips: normalizeChips(null, icon, locale),
        };
      }
      if (!entry || typeof entry !== 'object') return null;
      const obj = entry as Record<string, unknown>;
      const title =
        typeof obj.title === 'string'
          ? obj.title.trim()
          : typeof obj.label === 'string'
            ? obj.label.trim()
            : '';
      if (!title) return null;
      const rawIcon = typeof obj.icon === 'string' ? obj.icon.trim() : '';
      const icon =
        (rawIcon && BEST_USE_CASE_ICON_KEYS.includes(rawIcon as BestUseCaseIconKey)
          ? rawIcon
          : inferBestUseCaseIcon(title)) as BestUseCaseIconKey;
      const chips = normalizeChips(obj.chips, icon, locale);
      return {
        title,
        icon,
        chips,
      };
    })
    .filter((item): item is BestUseCaseItem => Boolean(item));
}

function normalizeSecondaryCta(label: string | null): string | null {
  if (!label) return null;
  return label.replace(/\(1080p\)/gi, '(higher resolution)').replace(/\b1080p\b/gi, 'higher resolution').trim();
}

function buildAutoSpecSections(values: KeySpecValues | null, locale: AppLocale): SpecSection[] {
  if (!values) return [];
  const labels = AUTO_SPEC_LABELS[locale] ?? AUTO_SPEC_LABELS.en;
  const inputs: string[] = [];
  const audio: string[] = [];

  inputs.push(`${labels.textToVideo}: ${localizeSpecStatus(values.textToVideo, locale)}`);
  inputs.push(`${labels.imageToVideo}: ${localizeSpecStatus(values.imageToVideo, locale)}`);
  inputs.push(`${labels.videoToVideo}: ${localizeSpecStatus(values.videoToVideo, locale)}`);
  inputs.push(`${labels.referenceImageStyle}: ${localizeSpecStatus(values.referenceImageStyle, locale)}`);
  inputs.push(`${labels.referenceVideo}: ${localizeSpecStatus(values.referenceVideo, locale)}`);

  audio.push(`${labels.audioOutput}: ${localizeSpecStatus(values.audioOutput, locale)}`);
  audio.push(`${labels.nativeAudio}: ${localizeSpecStatus(values.nativeAudioGeneration, locale)}`);
  audio.push(`${labels.lipSync}: ${localizeSpecStatus(values.lipSync, locale)}`);

  return [
    { title: labels.inputsTitle, items: inputs },
    { title: labels.audioTitle, items: audio },
  ];
}

const DEFAULT_VIDEO_TROUBLESHOOTING = [
  'Feels random / inconsistent → simplify to: subject + action + camera + lighting. Re-run 2–3 takes.',
  'Motion looks weird → reduce movement: one camera move, slower action, fewer props.',
  'Subject drifts off-brand → start from a reference image and lock palette + lighting.',
  'Text looks wrong → avoid readable signage, tiny UI, micro labels. Keep text off-screen.',
  'Dialogue drifts → keep lines short and punchy; avoid long monologues.',
];

const DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE: Record<AppLocale, string[]> = {
  en: DEFAULT_VIDEO_TROUBLESHOOTING,
  fr: [
    'Résultat aléatoire / incohérent → simplifiez : sujet + action + caméra + lumière. Relancez 2–3 variantes.',
    'Mouvement étrange → réduisez le mouvement : un seul move caméra, action plus lente, moins d’accessoires.',
    'Le sujet dérive de la marque → partez d’une image de référence et verrouillez palette + lumière.',
    'Texte incorrect → évitez la signalétique lisible, les micro‑labels, les petits UI. Gardez le texte hors champ.',
    'Dialogue instable → gardez les répliques courtes et percutantes; évitez les longs monologues.',
  ],
  es: [
    'Se siente aleatorio / inconsistente → simplifica: sujeto + acción + cámara + iluminación. Repite 2–3 tomas.',
    'El movimiento se ve raro → reduce el movimiento: un solo movimiento de cámara, acción más lenta, menos props.',
    'El sujeto se sale de la marca → empieza con una imagen de referencia y fija paleta + iluminación.',
    'El texto sale mal → evita señalética legible, UI pequeño, micro‑labels. Mantén el texto fuera de plano.',
    'El diálogo deriva → mantén líneas cortas y directas; evita monólogos largos.',
  ],
};

const DEFAULT_VIDEO_SAFETY = [
  'Don’t generate real people or public figures (celebrities, politicians, etc.).',
  'No minors, sexual content, hateful content, or graphic violence.',
  'Don’t use someone’s likeness without consent.',
  'Some prompts and reference images may be blocked — generic characters and scenes are fine.',
];

const DEFAULT_GENERIC_SAFETY = DEFAULT_VIDEO_SAFETY;

function pickCompareEngines(allEngines: FalEngineEntry[], currentSlug: string, limit = 3): FalEngineEntry[] {
  const filtered = allEngines.filter((entry) => {
    if (entry.modelSlug === currentSlug) return false;
    const modes = entry.engine?.modes ?? [];
    const hasVideoMode = modes.some((mode) => mode.endsWith('v'));
    return hasVideoMode;
  });

  const selected: FalEngineEntry[] = [];
  const usedFamilies = new Set<string>();

  for (const entry of filtered) {
    const familyKey = entry.family ?? entry.brandId ?? entry.provider ?? entry.modelSlug;
    if (usedFamilies.has(familyKey)) continue;
    selected.push(entry);
    usedFamilies.add(familyKey);
    if (selected.length >= limit) return selected;
  }

  for (const entry of filtered) {
    if (selected.includes(entry)) continue;
    selected.push(entry);
    if (selected.length >= limit) break;
  }

  return selected;
}

function buildVideoBoundaries(values: KeySpecValues | null): string[] {
  if (!values) {
    return [
      'Output is short-form. For longer edits, stitch multiple clips.',
      'Resolution is capped on this tier.',
      'No video input here — start from text or a single reference image.',
      'No fixed seeds — iteration = re-run + refine.',
    ];
  }
  const items: string[] = [];
  const duration = values.maxDuration && !isPending(values.maxDuration) ? values.maxDuration : null;
  const resolution = values.maxResolution && !isPending(values.maxResolution) ? normalizeMaxResolution(values.maxResolution) : null;
  if (duration) {
    items.push(`Output is short-form (${duration}). For longer edits, stitch multiple clips.`);
  }
  if (resolution) {
    items.push(`Resolution tops out at ${resolution} for this tier.`);
  }
  if (isUnsupported(values.videoToVideo)) {
    items.push('No video input here — start from text or a single reference image.');
  }
  if (isUnsupported(values.imageToVideo)) {
    items.push('Image-to-video is not supported on this tier.');
  }
  if (isUnsupported(values.audioOutput)) {
    items.push('No native audio in this tier.');
  }
  if (!items.length) {
    items.push('No fixed seeds — iteration = re-run + refine.');
  } else if (!items.some((item) => item.toLowerCase().includes('seed'))) {
    items.push('No fixed seeds — iteration = re-run + refine.');
  }
  return items;
}

type DetailCopy = {
  backLabel: string;
  examplesLinkLabel: string;
  pricingLinkLabel: string;
  overviewTitle: string;
  overview: {
    brand: string;
    engineId: string;
    slug: string;
    logoPolicy: string;
    platformPrice: string;
  };
  logoPolicies: {
    logoAllowed: string;
    textOnly: string;
  };
  promptsTitle: string;
  faqTitle: string;
  buttons: {
    pricing: string;
    launch: string;
  };
  breadcrumb: {
    home: string;
    models: string;
  };
};

const DEFAULT_DETAIL_COPY: DetailCopy = {
  backLabel: '← Back to models',
  examplesLinkLabel: 'See examples',
  pricingLinkLabel: 'Compare pricing',
  overviewTitle: 'Overview',
  overview: {
    brand: 'Brand',
    engineId: 'Engine ID',
    slug: 'Slug',
    logoPolicy: 'Logo policy',
    platformPrice: 'Live pricing updates inside the Generate workspace.',
  },
  logoPolicies: {
    logoAllowed: 'Logo usage permitted',
    textOnly: 'Text-only (wordmark)',
  },
  promptsTitle: 'Prompt ideas',
  faqTitle: 'FAQ',
  buttons: {
    pricing: 'Open Generate',
    launch: 'Launch workspace',
  },
  breadcrumb: {
    home: 'Home',
    models: 'Models',
  },
};

const MODEL_OG_IMAGE_MAP: Record<string, string> = {
  'sora-2':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'sora-2-pro':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'veo-3-1': '/hero/veo3.jpg',
  'veo-3-1-fast': '/hero/veo3.jpg',
  'pika-text-to-video': '/hero/pika-22.jpg',
  'minimax-hailuo-02-text': '/hero/minimax-video01.jpg',
};

function toAbsoluteUrl(url?: string | null): string {
  if (!url) return `${SITE}/og/price-before.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

function buildSoraCopy(localized: EngineLocalizedContent, slug: string, locale: AppLocale): SoraCopy {
  const custom = (localized.custom ?? {}) as Record<string, unknown>;
  const getValue = (key: string): unknown => {
    const customValue = custom[key];
    if (customValue !== undefined) return customValue;
    return (localized as Record<string, unknown>)[key];
  };
  const getString = (key: string): string | null => {
    const value = getValue(key);
    return typeof value === 'string' && value.trim().length ? value : null;
  };
  const getBoolean = (key: string): boolean => getValue(key) === true;
  const getStringArray = (key: string): string[] => {
    const value = getValue(key);
    if (Array.isArray(value)) {
      return value.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean);
    }
    return [];
  };
  const getFaqs = (): LocalizedFaqEntry[] => {
    const value = custom['faqs'];
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const obj = entry as Record<string, unknown>;
        const question = typeof obj.q === 'string' ? obj.q : typeof obj.question === 'string' ? obj.question : null;
        const answer = typeof obj.a === 'string' ? obj.a : typeof obj.answer === 'string' ? obj.answer : null;
        if (!question || !answer) return null;
        return { question, answer };
      })
      .filter((faq): faq is LocalizedFaqEntry => Boolean(faq));
  };
  const getSpecSections = (): SpecSection[] => {
    const value = custom['specSections'];
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const obj = entry as Record<string, unknown>;
        const title = typeof obj.title === 'string' ? obj.title : null;
        const intro = typeof obj.intro === 'string' ? obj.intro : null;
        const itemsRaw = obj.items;
        const items = Array.isArray(itemsRaw)
          ? itemsRaw.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
          : [];
        if (!title || !items.length) return null;
        return { title, items, intro };
      })
      .filter((section): section is SpecSection => Boolean(section));
  };
  const getPromptingTabNotes = (): SoraCopy['promptingTabNotes'] => {
    const value = custom['promptingTabNotes'];
    if (!value || typeof value !== 'object') return {};
    const obj = value as Record<string, unknown>;
    const pick = (key: string) => (typeof obj[key] === 'string' ? obj[key] : undefined);
    return {
      quick: pick('quick'),
      structured: pick('structured'),
      pro: pick('pro'),
      storyboard: pick('storyboard'),
    };
  };
  const getPromptingTabs = (): PromptingTab[] => {
    const value = custom['promptingTabs'];
    if (!Array.isArray(value)) return [];
    return value.reduce<PromptingTab[]>((tabs, entry) => {
      if (!entry || typeof entry !== 'object') return tabs;
      const obj = entry as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id : null;
      const label = typeof obj.label === 'string' ? obj.label : null;
      const title = typeof obj.title === 'string' ? obj.title : null;
      const copy = typeof obj.copy === 'string' ? obj.copy : null;
      if (!id || !label || !title || !copy) return tabs;
      tabs.push({
        id: id as PromptingTabId,
        label,
        title,
        description: typeof obj.description === 'string' ? obj.description : undefined,
        copy,
      });
      return tabs;
    }, []);
  };
  const getQuickStartBlocks = (): QuickStartBlock[] => {
    const value = custom['quickStartBlocks'];
    if (!Array.isArray(value)) return [];
    return value.reduce<QuickStartBlock[]>((blocks, entry) => {
      if (!entry || typeof entry !== 'object') return blocks;
      const obj = entry as Record<string, unknown>;
      const title = typeof obj.title === 'string' ? obj.title : null;
      const subtitle = typeof obj.subtitle === 'string' ? obj.subtitle : null;
      const stepsRaw = obj.steps;
      const steps = Array.isArray(stepsRaw)
        ? stepsRaw.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
        : [];
      if (!title || !steps.length) return blocks;
      blocks.push({ title, subtitle, steps });
      return blocks;
    }, []);
  };
  const getHeroSpecChips = (): HeroSpecChip[] => {
    const value = custom['heroSpecChips'];
    if (!Array.isArray(value)) return [];
    return value.reduce<HeroSpecChip[]>((chips, entry) => {
      if (!entry || typeof entry !== 'object') return chips;
      const obj = entry as Record<string, unknown>;
      const label = typeof obj.label === 'string' ? obj.label.trim() : '';
      if (!label) return chips;
      const rawIcon = typeof obj.icon === 'string' ? obj.icon.trim() : '';
      const icon = (rawIcon in HERO_SPEC_ICON_MAP ? rawIcon : null) as HeroSpecIconKey | null;
      chips.push({ label, icon });
      return chips;
    }, []);
  };
  const getRelatedItems = (): RelatedItem[] => {
    const value = custom['relatedItems'];
    if (!Array.isArray(value)) return [];
    return value.reduce<RelatedItem[]>((items, entry) => {
      if (!entry || typeof entry !== 'object') return items;
      const obj = entry as Record<string, unknown>;
      const brand = typeof obj.brand === 'string' ? obj.brand.trim() : '';
      const title = typeof obj.title === 'string' ? obj.title.trim() : '';
      const description = typeof obj.description === 'string' ? obj.description.trim() : '';
      if (!brand || !title || !description) return items;
      const modelSlug = typeof obj.modelSlug === 'string' ? obj.modelSlug.trim() : null;
      const ctaLabel = typeof obj.ctaLabel === 'string' ? obj.ctaLabel.trim() : null;
      const href = typeof obj.href === 'string' ? obj.href.trim() : null;
      items.push({ brand, title, description, modelSlug, ctaLabel, href });
      return items;
    }, []);
  };
  const getBestUseCaseItems = (): BestUseCaseItem[] => {
    const value = custom['bestUseCases'];
    const normalized = normalizeBestUseCaseItems(value, locale);
    if (normalized.length) return normalized;
    return normalizeBestUseCaseItems(localized.bestUseCases?.items ?? [], locale);
  };

  const fallbackSpecSections = (): SpecSection[] => {
    if (!localized.technicalOverview || !localized.technicalOverview.length) return [];
    const items = localized.technicalOverview
      .map((entry) => {
        if (!entry?.body) return entry?.label ?? null;
        if (entry.label) return `${entry.label}: ${entry.body}`;
        return entry.body;
      })
      .filter((item): item is string => Boolean(item && item.trim().length));
    if (!items.length) return [];
    return [
      {
        title: localized.technicalOverviewTitle ?? 'Specs',
        items,
      },
    ];
  };

  const bestUseCasesTitle = localized.bestUseCases?.title ?? getString('bestUseCasesTitle') ?? 'Best use cases';
  const bestUseCaseItems = getBestUseCaseItems();
  const bestUseCases = bestUseCaseItems.map((item) => item.title);
  const heroHighlights = getStringArray('heroHighlights').length
    ? getStringArray('heroHighlights')
    : bestUseCases.slice(0, 4);
  const specSections = (() => {
    const sections = getSpecSections();
    if (sections.length) return sections;
    return fallbackSpecSections();
  })();
  const specTitle = getString('specTitle') ?? localized.technicalOverviewTitle ?? 'Specs';
  const specNote = getString('specNote') ?? localized.pricingNotes ?? null;
  const promptingGlobalPrinciples = getStringArray('promptingGlobalPrinciples');
  const promptingEngineWhy = getStringArray('promptingEngineWhy');
  const promptingTabNotes = getPromptingTabNotes();
  const promptingTabs = getPromptingTabs();
  const promptingTitle = getString('promptingTitle');
  const promptingIntro = getString('promptingIntro');
  const promptingTip = getString('promptingTip');
  const promptingGuideLabel = getString('promptingGuideLabel');
  const promptingGuideUrl = getString('promptingGuideUrl');
  const tipsIntro = getString('tipsIntro');

  return {
    heroEyebrow: getString('heroEyebrow'),
    heroTitle: localized.hero?.title ?? getString('heroTitle'),
    heroSubtitle: localized.hero?.intro ?? getString('heroSubtitle'),
    heroSupportLine: getString('heroSupportLine'),
    heroBadge: localized.hero?.badge ?? getString('heroBadge'),
    heroSpecChips: getHeroSpecChips(),
    heroTrustLine: getString('heroTrustLine'),
    heroDesc1: getString('heroDesc1'),
    heroDesc2: getString('heroDesc2'),
    primaryCta: localized.hero?.ctaPrimary?.label ?? getString('primaryCta'),
    primaryCtaHref: localized.hero?.ctaPrimary?.href ?? `/app?engine=${slug}`,
    secondaryCta:
      (localized.hero?.secondaryLinks?.[0]?.label as string | undefined) ??
      getString('secondaryCta') ??
      localized.compareLink?.label ??
      null,
    secondaryCtaHref:
      (localized.hero?.secondaryLinks?.[0]?.href as string | undefined) ??
      localized.compareLink?.href ??
      (slug === 'sora-2' ? '/models/sora-2-pro' : '/models/sora-2'),
    whyTitle: getString('whyTitle'),
    heroHighlights,
    bestUseCasesTitle,
    bestUseCaseItems,
    bestUseCases,
    whatTitle: getString('whatTitle'),
    whatIntro1: getString('whatIntro1'),
    whatIntro2: getString('whatIntro2'),
    whatFlowTitle: getString('whatFlowTitle'),
    whatFlowSteps: getStringArray('whatFlowSteps'),
    quickStartTitle: getString('quickStartTitle'),
    quickStartBlocks: getQuickStartBlocks(),
    howToLatamTitle: getString('howToLatamTitle'),
    howToLatamSteps: getStringArray('howToLatamSteps'),
    specTitle,
    specNote,
    specSections,
    specValueProp: getString('specValueProp'),
    quickPricingTitle: getString('quickPricingTitle'),
    quickPricingItems: getStringArray('quickPricingItems'),
    hideQuickPricing: getBoolean('hideQuickPricing'),
    showPricePerSecondInSpecs: getBoolean('showPricePerSecondInSpecs'),
    hidePricingSection: getBoolean('hidePricingSection'),
    microCta: getString('microCta'),
    galleryTitle: getString('galleryTitle'),
    galleryIntro: getString('galleryIntro'),
    gallerySceneCta: getString('gallerySceneCta'),
    galleryAllCta: getString('galleryAllCta'),
    recreateLabel: getString('recreateLabel'),
    promptingTitle,
    promptingIntro,
    promptingTip,
    promptingGuideLabel,
    promptingGuideUrl,
    promptingTabs,
    imageTitle: getString('imageTitle'),
    imageIntro: getString('imageIntro'),
    imageFlow: getStringArray('imageFlow'),
    imageWhy: getStringArray('imageWhy'),
    multishotTitle: getString('multishotTitle'),
    multishotIntro1: getString('multishotIntro1'),
    multishotIntro2: getString('multishotIntro2'),
    multishotTips: getStringArray('multishotTips'),
    demoTitle: getString('demoTitle'),
    demoPromptLabel: getString('demoPromptLabel'),
    demoPrompt: getStringArray('demoPrompt'),
    demoNotes: getStringArray('demoNotes'),
    tipsTitle: getString('tipsTitle'),
    tipsIntro,
    strengths: getStringArray('strengths').length
      ? getStringArray('strengths')
      : localized.tips?.items ?? [],
    boundaries: getStringArray('boundaries'),
    troubleshootingTitle: getString('troubleshootingTitle'),
    troubleshootingItems: getStringArray('troubleshootingItems'),
    tipsFooter: getString('tipsFooter'),
    safetyTitle: getString('safetyTitle'),
    safetyRules: getStringArray('safetyRules'),
    safetyInterpretation: getStringArray('safetyInterpretation'),
    safetyNote: getString('safetyNote'),
    comparisonTitle: getString('comparisonTitle'),
    comparisonPoints: getStringArray('comparisonPoints'),
    comparisonCta: getString('comparisonCta'),
    relatedCtaSora2: getString('relatedCtaSora2'),
    relatedCtaSora2Pro: getString('relatedCtaSora2Pro'),
    relatedTitle: getString('relatedTitle'),
    relatedSubtitle: getString('relatedSubtitle'),
    relatedItems: getRelatedItems(),
    finalPara1: getString('finalPara1'),
    finalPara2: getString('finalPara2'),
    finalButton: getString('finalButton'),
    faqTitle: getString('faqTitle'),
    faqs: getFaqs(),
    promptingTitle,
    promptingIntro,
    promptingTip,
    promptingGuideLabel,
    promptingGuideUrl,
    promptingGlobalPrinciples,
    promptingEngineWhy,
    promptingTabNotes,
  };
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug, locale } = params;
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    return {
      title: 'Model not found - MaxVideo AI',
      robots: { index: false, follow: false },
    };
  }

  const localized = await getEngineLocalized(slug, locale);
  const detailSlugMap = buildDetailSlugMap(slug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${slug}`));
  const fallbackTitle = engine.seo.title ?? `${engine.marketingName} — MaxVideo AI`;
  const title = localized.seo.title ?? fallbackTitle;
  const description =
    localized.seo.description ??
    engine.seo.description ??
    'Explore availability, prompts, pricing, and render policies for this model on MaxVideoAI.';
  const ogImagePath = localized.seo.image ?? MODEL_OG_IMAGE_MAP[slug] ?? engine.media?.imagePath ?? '/og/price-before.png';
  return buildSeoMetadata({
    locale,
    title,
    description,
    slugMap: detailSlugMap,
    englishPath: `/models/${slug}`,
    availableLocales: publishableLocales,
    image: ogImagePath,
    imageAlt: title,
    ogType: 'article',
    robots: {
      index: true,
      follow: true,
    },
  });
}

type FeaturedMedia = {
  id: string | null;
  prompt: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  durationSec?: number | null;
  hasAudio?: boolean;
  href?: string | null;
  label?: string | null;
  aspectRatio?: string | null;
};

function formatPriceLabel(priceCents: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof priceCents !== 'number' || Number.isNaN(priceCents)) {
    return null;
  }
  const normalizedCurrency = typeof currency === 'string' && currency.length ? currency.toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(priceCents / 100);
  } catch {
    return `${normalizedCurrency} ${(priceCents / 100).toFixed(2)}`;
  }
}

function formatPromptExcerpt(prompt: string, maxWords = 22): string {
  const words = prompt.trim().split(/\s+/);
  if (words.length <= maxWords) return prompt.trim();
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function toGalleryCard(
  video: GalleryVideo,
  brandId?: string,
  fallbackLabel?: string,
  iconId?: string,
  engineSlug = 'sora-2',
  fromPath?: string
): ExampleGalleryVideo {
  const promptExcerpt = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
  const videoHrefBase = `/video/${encodeURIComponent(video.id)}`;
  const videoHref = fromPath ? `${videoHrefBase}?from=${encodeURIComponent(fromPath)}` : videoHrefBase;
  return {
    id: video.id,
    href: videoHref,
    engineLabel: video.engineLabel || fallbackLabel || 'Sora 2',
    engineIconId: iconId ?? 'sora-2',
    engineBrandId: brandId,
    priceLabel: formatPriceLabel(video.finalPriceCents ?? null, video.currency ?? null),
    prompt: promptExcerpt,
    promptFull: video.prompt,
    aspectRatio: video.aspectRatio ?? null,
    durationSec: video.durationSec,
    hasAudio: video.hasAudio,
    optimizedPosterUrl: buildOptimizedPosterUrl(video.thumbUrl),
    rawPosterUrl: video.thumbUrl ?? null,
    videoUrl: video.videoUrl ?? null,
    recreateHref: `/app?engine=${encodeURIComponent(engineSlug)}&from=${encodeURIComponent(video.id)}`,
  };
}

function toFeaturedMedia(entry?: ExampleGalleryVideo | null, preferFullPrompt = false): FeaturedMedia | null {
  if (!entry) return null;
  const prompt = preferFullPrompt && entry.promptFull ? entry.promptFull : entry.prompt;
  return {
    id: entry.id,
    prompt,
    videoUrl: entry.videoUrl ?? null,
    posterUrl: entry.optimizedPosterUrl ?? entry.rawPosterUrl ?? null,
    durationSec: entry.durationSec,
    hasAudio: entry.hasAudio,
    href: entry.href,
    label: entry.engineLabel,
    aspectRatio: entry.aspectRatio,
  };
}

function isLandscape(aspect: string | null | undefined): boolean {
  if (!aspect) return true;
  const [w, h] = aspect.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return true;
  return w / h >= 1;
}

function pickHeroMedia(cards: ExampleGalleryVideo[], preferredId: string | null, fallback: FeaturedMedia): FeaturedMedia {
  const preferred = preferredId ? cards.find((card) => card.id === preferredId) : null;
  if (preferred) {
    return toFeaturedMedia(preferred) ?? fallback;
  }
  const playable = cards.find((card) => Boolean(card.videoUrl)) ?? cards[0];
  return toFeaturedMedia(playable) ?? fallback;
}

function pickDemoMedia(
  cards: ExampleGalleryVideo[],
  heroId: string | null,
  preferredId: string | null,
  fallback: FeaturedMedia | null
): FeaturedMedia | null {
  const preferred =
    preferredId && preferredId !== heroId
      ? cards.find((card) => card.id === preferredId && Boolean(card.videoUrl))
      : null;
  if (preferred) {
    const resolved = toFeaturedMedia(preferred, true);
    if (resolved) return resolved;
  }
  const candidate =
    cards.find((card) => card.id !== heroId && Boolean(card.videoUrl) && isLandscape(card.aspectRatio)) ??
    cards.find((card) => card.id !== heroId);
  const resolved = toFeaturedMedia(candidate, true);
  if (resolved) return resolved;
  if (fallback && (!heroId || fallback.id !== heroId)) {
    return fallback;
  }
  return null;
}

async function renderSoraModelPage({
  engine,
  detailCopy,
  localizedContent,
  locale,
}: {
  engine: FalEngineEntry;
  detailCopy: DetailCopy;
  localizedContent: EngineLocalizedContent;
  locale: AppLocale;
}) {
  const detailSlugMap = buildDetailSlugMap(engine.modelSlug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${engine.modelSlug}`));
  const metadataUrls = buildMetadataUrls(locale, detailSlugMap, {
    englishPath: `/models/${engine.modelSlug}`,
    availableLocales: publishableLocales,
  });
  const canonicalRaw = metadataUrls.canonical;
  const canonicalUrl = canonicalRaw.replace(/\/+$/, '') || canonicalRaw;
  const localizedCanonicalUrl = canonicalUrl;
  const copy = buildSoraCopy(localizedContent, engine.modelSlug, locale);
  const engineModes = engine.engine.modes ?? [];
  const hasVideoMode = engineModes.some((mode) => mode.endsWith('v'));
  const hasImageMode = engineModes.some((mode) => mode.endsWith('i'));
  const isVideoEngine = hasVideoMode;
  const isImageEngine = hasImageMode && !hasVideoMode;
  const enginePricingOverrides = await listEnginePricingOverrides();
  const pricingEngine = applyEnginePricingOverride(
    engine.engine,
    enginePricingOverrides[engine.engine.id]
  );
  const pricingItems = await buildPricingItems(pricingEngine, locale);
  const computedQuickPricingItems = await buildQuickPricingItems(pricingEngine, locale);
  const quickPricingItems = computedQuickPricingItems.length ? computedQuickPricingItems : copy.quickPricingItems;
  const backPath = (() => {
    try {
      const url = new URL(canonicalUrl);
      return url.pathname || `/models/${engine.modelSlug}`;
    } catch {
      return `/models/${engine.modelSlug}`;
    }
  })();
  let examples: GalleryVideo[] = [];
  try {
    examples = await listPlaylistVideos(`examples-${engine.modelSlug}`, 200);
  } catch (error) {
    console.warn('[models/sora-2] failed to load examples', error);
  }
  const normalizedSlug = normalizeEngineId(engine.modelSlug) ?? engine.modelSlug;
  const allowedEngineIds = new Set([
    normalizedSlug,
    engine.modelSlug,
    engine.id,
    ...(engine.modelSlug === 'sora-2-pro' ? ['sora-2', 'sora2'] : []),
    ...(engine.modelSlug === 'sora-2' ? ['sora-2', 'sora2'] : []),
  ].map((id) => (id ? id.toString().trim().toLowerCase() : '')).filter(Boolean));
  const soraExamples = examples.filter((video) => {
    const normalized = normalizeEngineId(video.engineId)?.trim().toLowerCase();
    return normalized ? allowedEngineIds.has(normalized) : false;
  });
  const validatedMap = await getVideosByIds(soraExamples.map((video) => video.id));
  let galleryVideos = soraExamples
    .filter((video) => validatedMap.has(video.id))
    .map((video) =>
      toGalleryCard(
        video,
        engine.brandId,
        localizedContent.marketingName ?? engine.marketingName,
        engine.modelSlug,
        engine.modelSlug,
        backPath
      )
    );

  const preferredIds = PREFERRED_MEDIA[engine.modelSlug] ?? { hero: null, demo: null };
  const preferredList = [preferredIds.hero, preferredIds.demo].filter((id): id is string => Boolean(id));
  const missingPreferred = preferredList.filter((id) => !galleryVideos.some((video) => video.id === id));
  if (missingPreferred.length) {
    const preferredMap = await getVideosByIds(missingPreferred);
    for (const id of preferredList) {
      if (!preferredMap.has(id) || galleryVideos.some((video) => video.id === id)) continue;
      const video = preferredMap.get(id)!;
      galleryVideos = [
        ...galleryVideos,
        toGalleryCard(
          video,
          engine.brandId,
          localizedContent.marketingName ?? engine.marketingName,
          engine.modelSlug,
          engine.modelSlug,
          backPath
        ),
      ];
    }
  }
  if (engine.modelSlug === 'kling-2-5-turbo') {
    const isSixteenNine = (aspect?: string | null) => {
      const normalized = (aspect ?? '').trim();
      return normalized === '16:9' || normalized.startsWith('16:9');
    };
    galleryVideos = [...galleryVideos].sort((a, b) => {
      const aScore = (isSixteenNine(a.aspectRatio) ? 0 : 2) + (a.videoUrl ? 0 : 1);
      const bScore = (isSixteenNine(b.aspectRatio) ? 0 : 2) + (b.videoUrl ? 0 : 1);
      return aScore - bScore;
    });
  }

  const fallbackMedia: FeaturedMedia = {
    id: `${engine.modelSlug}-hero-fallback`,
    prompt:
      engine.type === 'image'
        ? `${localizedContent.marketingName ?? engine.marketingName} demo still from MaxVideoAI`
        : `${localizedContent.marketingName ?? engine.marketingName} demo clip from MaxVideoAI`,
    videoUrl: engine.type === 'image' ? null : engine.media?.videoUrl ?? engine.demoUrl ?? null,
    posterUrl: buildOptimizedPosterUrl(engine.media?.imagePath) ?? engine.media?.imagePath ?? null,
    durationSec: null,
    hasAudio: engine.type === 'image' ? false : true,
    href: null,
    label: localizedContent.marketingName ?? engine.marketingName ?? 'Sora',
  };

  let heroMedia = pickHeroMedia(galleryVideos, preferredIds.hero, fallbackMedia);
  if (engine.modelSlug === 'kling-2-5-turbo') {
    const heroCandidate =
      galleryVideos.find((video) => video.aspectRatio === '16:9' && Boolean(video.videoUrl)) ??
      galleryVideos.find((video) => video.aspectRatio === '16:9');
    if (heroCandidate) {
      heroMedia = toFeaturedMedia(heroCandidate) ?? heroMedia;
    }
  }
  const demoMedia = pickDemoMedia(galleryVideos, heroMedia?.id ?? null, preferredIds.demo, fallbackMedia);
  if (engine.modelSlug === 'minimax-hailuo-02-text' && demoMedia) {
    demoMedia.prompt =
      'A cinematic 10-second shot in 16:9. At night, the camera flies smoothly through a modern city full of soft neon lights and warm windows, then glides towards a single bright window high on a building. Without cutting, the camera passes through the glass into a cozy creator studio with a large desk and an ultra-wide monitor glowing in the dark. The room is lit by the screen and a warm desk lamp. The camera continues to push in until the monitor fills most of the frame. On the screen there is a clean AI video workspace UI (generic, no real logos) showing four small video previews playing at the same time: one realistic city street shot, one colourful animation, one product hero shot and one abstract motion-graphics scene. The overall style is cinematic, with smooth camera motion, gentle depth of field and rich contrast.';
  }
  const galleryCtaHref = heroMedia?.id
    ? `${isImageEngine ? '/app/image' : '/app'}?engine=${engine.modelSlug}&from=${encodeURIComponent(heroMedia.id)}`
    : `${isImageEngine ? '/app/image' : '/app'}?engine=${engine.modelSlug}`;
  const compareEngines = pickCompareEngines(listFalEngines(), engine.modelSlug);
  const faqEntries = localizedContent.faqs.length ? localizedContent.faqs : copy.faqs;
  const showPriceInSpecs = true;
  const keySpecsMap = await loadEngineKeySpecs();
  const keySpecsEntry =
    keySpecsMap.get(engine.modelSlug) ?? keySpecsMap.get(engine.id) ?? null;
  const pricePerSecondLabel = await buildPricePerSecondLabel(pricingEngine, locale);
  const pricePerImageLabel = await buildPricePerImageLabel(pricingEngine, locale);
  const keySpecValues = buildSpecValues(engine, keySpecsEntry?.keySpecs, {
    pricePerSecond: pricePerSecondLabel,
    pricePerImage: pricePerImageLabel,
  });
  const priceRows = showPriceInSpecs
    ? isImageEngine
      ? await buildPricePerImageRows(pricingEngine, locale)
      : await buildPricePerSecondRows(pricingEngine, locale)
    : [];
  const rowDefs = resolveSpecRowDefs(locale, isImageEngine);
  const pricePerSecondRowLabel = resolveSpecRowLabel(locale, 'pricePerSecond', false);
  const pricePerImageRowLabel = resolveSpecRowLabel(locale, 'pricePerImage', true);
  const keySpecDefs = rowDefs.filter((row) => row.key !== (isImageEngine ? 'pricePerImage' : 'pricePerSecond'));
  const keySpecRows: KeySpecRow[] = keySpecValues
    ? [
        ...(priceRows.length
          ? priceRows
          : isImageEngine
            ? keySpecValues.pricePerImage && !isUnsupported(keySpecValues.pricePerImage)
              ? [
                  {
                    id: 'pricePerImage',
                    key: 'pricePerImage',
                    label: pricePerImageRowLabel,
                    value: keySpecValues.pricePerImage,
                  },
                ]
              : []
            : keySpecValues.pricePerSecond && !isUnsupported(keySpecValues.pricePerSecond)
            ? [
                {
                  id: 'pricePerSecond',
                  key: 'pricePerSecond',
                  label: pricePerSecondRowLabel,
                  value: keySpecValues.pricePerSecond,
                },
              ]
            : []),
        ...keySpecDefs
          .map(({ key, label }) => ({
            id: key,
            key,
            label,
            value:
              key === 'maxResolution' && !isImageEngine
                ? normalizeMaxResolution(keySpecValues[key])
                : keySpecValues[key],
          }))
          .filter((row) => !isPending(row.value) && !isUnsupported(row.value)),
      ]
    : [];

  return (
    <Sora2PageLayout
      backLabel={detailCopy.backLabel}
      examplesLinkLabel={detailCopy.examplesLinkLabel}
      pricingLinkLabel={detailCopy.pricingLinkLabel}
      localizedContent={localizedContent}
      copy={copy}
      engine={engine}
      isVideoEngine={isVideoEngine}
      isImageEngine={isImageEngine}
      heroMedia={heroMedia}
      demoMedia={demoMedia}
      galleryVideos={galleryVideos}
      galleryCtaHref={galleryCtaHref}
      compareEngines={compareEngines}
      faqEntries={faqEntries}
      keySpecRows={keySpecRows}
      keySpecValues={keySpecValues}
      pricePerSecondLabel={pricePerSecondLabel}
      engineSlug={engine.modelSlug}
      locale={locale}
      canonicalUrl={canonicalUrl}
      localizedCanonicalUrl={localizedCanonicalUrl}
      breadcrumb={detailCopy.breadcrumb}
      pricingItems={pricingItems}
      quickPricingItems={quickPricingItems}
    />
  );
}

function Sora2PageLayout({
  engine,
  backLabel,
  examplesLinkLabel,
  pricingLinkLabel,
  localizedContent,
  copy,
  isVideoEngine,
  isImageEngine,
  heroMedia,
  demoMedia,
  galleryVideos,
  galleryCtaHref,
  compareEngines,
  faqEntries,
  keySpecRows,
  keySpecValues,
  pricePerSecondLabel,
  engineSlug,
  locale,
  canonicalUrl,
  localizedCanonicalUrl,
  breadcrumb,
  pricingItems,
  quickPricingItems,
}: {
  engine: FalEngineEntry;
  backLabel: string;
  examplesLinkLabel: string;
  pricingLinkLabel: string;
  localizedContent: EngineLocalizedContent;
  copy: SoraCopy;
  isVideoEngine: boolean;
  isImageEngine: boolean;
  heroMedia: FeaturedMedia;
  demoMedia: FeaturedMedia | null;
  galleryVideos: ExampleGalleryVideo[];
  galleryCtaHref: string;
  compareEngines: FalEngineEntry[];
  faqEntries: LocalizedFaqEntry[];
  keySpecRows: KeySpecRow[];
  keySpecValues: KeySpecValues | null;
  pricePerSecondLabel: string | null;
  engineSlug: string;
  locale: AppLocale;
  canonicalUrl: string;
  localizedCanonicalUrl: string;
  breadcrumb: DetailCopy['breadcrumb'];
  pricingItems: string[];
  quickPricingItems: string[];
}) {
  const inLanguage = localeRegions[locale] ?? 'en-US';
  const resolvedBreadcrumb = breadcrumb ?? DEFAULT_DETAIL_COPY.breadcrumb;
  const canonical = canonicalUrl.replace(/\/+$/, '') || canonicalUrl;
  const localizedCanonical = localizedCanonicalUrl.replace(/\/+$/, '') || localizedCanonicalUrl;
  const localePathPrefix = localePathnames[locale] ? `/${localePathnames[locale].replace(/^\/+/, '')}` : '';
  const homePathname = localePathPrefix || '/';
  const localizedHomeUrl = homePathname === '/' ? `${SITE}/` : `${SITE}${homePathname}`;
  const localizedModelsSlug = (MODELS_BASE_PATH_MAP[locale] ?? 'models').replace(/^\/+/, '');
  const modelsPathname =
    homePathname === '/'
      ? `/${localizedModelsSlug}`
      : `${homePathname.replace(/\/+$/, '')}/${localizedModelsSlug}`.replace(/\/{2,}/g, '/');
  const localizedModelsUrl = `${SITE}${modelsPathname}`;
  const providerName = resolveProviderInfo(engine).name;
  const rawHeroTitle = copy.heroTitle ?? localizedContent.hero?.title ?? localizedContent.marketingName ?? 'Sora 2';
  const heroTitle = normalizeHeroTitle(rawHeroTitle, providerName);
  const rawHeroSubtitle = copy.heroSubtitle ?? localizedContent.hero?.intro ?? localizedContent.overview ?? '';
  const heroSubtitle = normalizeHeroSubtitle(rawHeroSubtitle, locale);
  const heroBadge = copy.heroBadge ?? localizedContent.hero?.badge ?? null;
  const heroDesc1 = copy.heroDesc1 ?? localizedContent.overview ?? localizedContent.seo.description ?? null;
  const heroDesc2 = copy.heroDesc2;
  const heroSpecChips = copy.heroSpecChips.length ? copy.heroSpecChips : buildAutoHeroSpecChips(keySpecValues);
  const heroTrustLine = locale === 'en' ? GENERIC_TRUST_LINE : copy.heroTrustLine;
  const specTitle = normalizeSpecTitle(copy.specTitle, providerName, heroTitle, locale);
  const specNote = normalizeSpecNote(copy.specNote, locale);
  const showHeroDescriptions = heroSpecChips.length === 0;
  const heroPrice = isImageEngine
    ? keySpecValues?.pricePerImage ?? formatPricePerImage(engine)
    : keySpecValues?.pricePerSecond ?? pricePerSecondLabel ?? formatPricePerSecond(engine);
  const heroDuration =
    typeof heroMedia.durationSec === 'number'
      ? `${heroMedia.durationSec}s`
      : keySpecValues?.maxDuration ?? 'Data pending';
  const heroFormat = heroMedia.aspectRatio ?? keySpecValues?.aspectRatios ?? 'Data pending';
  const heroMetaLines = [
    { label: 'Price', value: heroPrice },
    { label: 'Duration', value: heroDuration },
    { label: 'Format', value: heroFormat },
  ].filter((line) => Boolean(line.value));
  const isEsLocale = locale === 'es';
  const modelsBase = (MODELS_BASE_PATH_MAP[locale] ?? 'models').replace(/^\/+|\/+$/g, '');
  const localizeModelsPath = (targetSlug?: string) => {
    const slugPart = targetSlug ? `/${targetSlug.replace(/^\/+/, '')}` : '';
    return `/${modelsBase}${slugPart}`.replace(/\/{2,}/g, '/');
  };
  const compareBase = (COMPARE_BASE_PATH_MAP[locale] ?? 'ai-video-engines').replace(/^\/+|\/+$/g, '');
  const localizeComparePath = (pairSlug: string, orderSlug?: string) => {
    return buildCanonicalComparePath({ compareBase, pairSlug, orderSlug });
  };
  const galleryEngineSlug = engineSlug;
  const examplesLinkHref = getExamplesHref(galleryEngineSlug) ?? { pathname: '/examples' };
  const pricingLinkHref = { pathname: '/pricing' };
  const primaryCta = copy.primaryCta ?? localizedContent.hero?.ctaPrimary?.label ?? 'Start generating';
  const primaryCtaHref = copy.primaryCtaHref ?? localizedContent.hero?.ctaPrimary?.href ?? '/app?engine=sora-2';
  const secondaryCta = normalizeSecondaryCta(copy.secondaryCta);
  const secondaryCtaHref = copy.secondaryCtaHref ?? '/models/sora-2-pro';
  const normalizeCtaHref = (href?: string | null): LocalizedLinkHref | null => {
    if (!href) return null;
    const examplesHref = resolveExamplesHrefFromRaw(href);
    if (examplesHref) return examplesHref;
    const nonLocalizedHref = resolveNonLocalizedHref(href);
    if (nonLocalizedHref) return nonLocalizedHref;
    if (href.startsWith('/models')) {
      return localizeModelsPath(href.replace(/^\/models\/?/, ''));
    }
    return href;
  };
  const normalizedPrimaryCtaHref = normalizeCtaHref(primaryCtaHref) ?? primaryCtaHref;
  const localizedSecondaryCtaHref = normalizeCtaHref(secondaryCtaHref);
  const heroPosterPreload = heroMedia.posterUrl ? buildOptimizedPosterUrl(heroMedia.posterUrl) ?? heroMedia.posterUrl : null;

  const heroHighlights = copy.heroHighlights;
  const bestUseCaseItems = copy.bestUseCaseItems.length
    ? copy.bestUseCaseItems
    : normalizeBestUseCaseItems(localizedContent.bestUseCases?.items ?? [], locale);
  const bestUseCases = bestUseCaseItems.map((item) => item.title);
  const heroEyebrow = copy.heroEyebrow ?? buildEyebrow(providerName);
  const heroSupportLine = copy.heroSupportLine ?? buildSupportLine(bestUseCases);
  const breadcrumbModelLabel = localizedContent.marketingName ?? engine.marketingName ?? heroTitle;
  const howToLatamTitle = copy.howToLatamTitle;
  const howToLatamSteps = copy.howToLatamSteps;
  const specSections = copy.specSections.length
    ? copy.specSections
    : isVideoEngine
      ? buildAutoSpecSections(keySpecValues, locale)
      : copy.specSections;
  const specSectionsToShow = isImageEngine ? specSections : specSections.slice(0, 2);
  const quickPricingTitle = copy.quickPricingTitle;
  const strengths = copy.strengths;
  const boundaries = copy.boundaries.length ? copy.boundaries : isVideoEngine ? buildVideoBoundaries(keySpecValues) : [];
  const troubleshootingTitle = isVideoEngine
    ? locale === 'fr'
      ? 'Problèmes fréquents → solutions rapides'
      : locale === 'es'
        ? 'Problemas comunes → soluciones rápidas'
        : 'Common problems → fast fixes'
    : null;
  const troubleshootingItems =
    copy.troubleshootingItems.length
      ? copy.troubleshootingItems
      : isVideoEngine
        ? (DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE[locale] ?? DEFAULT_VIDEO_TROUBLESHOOTING)
        : [];
  const tipsCardLabels = TIPS_CARD_LABELS[locale] ?? TIPS_CARD_LABELS.en;
  const safetyRules = copy.safetyRules.length ? copy.safetyRules : DEFAULT_GENERIC_SAFETY;
  const safetyInterpretation = copy.safetyInterpretation;
  const relatedItems = copy.relatedItems;
  const isSoraPrompting = engine.modelSlug === 'sora-2' || engine.modelSlug === 'sora-2-pro';
  const useDemoMediaPrompt = Boolean(demoMedia?.prompt?.trim());
  const focusVsConfig = resolveFocusVsConfig(engine.modelSlug, locale);
  const faqList = faqEntries.map((entry) => ({
    question: entry.question,
    answer: entry.answer,
  }));
  const faqTitle = copy.faqTitle ?? 'FAQ';
  const faqJsonLdEntries = faqList.slice(0, 6);
  const sectionLabels = resolveSectionLabels(locale);
  const compareCopy = resolveCompareCopy(locale, heroTitle);
  const statusLabels = resolveSpecStatusLabels(locale);
  const pageDescription = heroDesc1 ?? heroSubtitle ?? localizedContent.seo.description ?? heroTitle;
  const heroPosterAbsolute = toAbsoluteUrl(heroMedia.posterUrl ?? localizedContent.seo.image ?? null);
  const heroVideoAbsolute = heroMedia.videoUrl ? toAbsoluteUrl(heroMedia.videoUrl) : null;
  const durationIso = heroMedia.durationSec ? `PT${Math.round(heroMedia.durationSec)}S` : undefined;
  const hasKeySpecRows = keySpecRows.length > 0;
  const hasSpecs = specSections.length > 0 || hasKeySpecRows;
  const hideExamplesSection = ['veo-3-1-first-last', 'nano-banana', 'nano-banana-pro'].includes(engine.modelSlug);
  const hasExamples = galleryVideos.length > 0 && !hideExamplesSection;
  const hasTextSection = true;
  const hasTipsSection =
    strengths.length > 0 || boundaries.length > 0 || troubleshootingItems.length > 0 || Boolean(copy.tipsTitle || copy.tipsIntro);
  const hasSafetySection = safetyRules.length > 0 || safetyInterpretation.length > 0 || Boolean(copy.safetyTitle);
  const hasFaqSection = faqList.length > 0;
  const hasCompareGrid = !isImageEngine && (relatedItems.length > 0 || compareEngines.length > 0);
  const hasCompareSection = Boolean(focusVsConfig) || hasCompareGrid;
  const textAnchorId = isImageEngine ? 'text-to-image' : 'text-to-video';
  const imageAnchorId = isImageEngine ? 'image-to-image' : 'image-to-video';
  const compareAnchorId = 'compare';
  const tocItems = [
    { id: 'specs', label: sectionLabels.specs, visible: hasSpecs },
    { id: textAnchorId, label: sectionLabels.examples, visible: hasExamples },
    { id: imageAnchorId, label: sectionLabels.prompting, visible: hasTextSection },
    { id: 'tips', label: sectionLabels.tips, visible: hasTipsSection },
    {
      id: compareAnchorId,
      label: sectionLabels.compare,
      visible: hasCompareSection,
    },
    { id: 'safety', label: sectionLabels.safety, visible: hasSafetySection },
    { id: 'faq', label: sectionLabels.faq, visible: hasFaqSection },
  ].filter((item) => item.visible);
  const productSchema = buildProductSchema({
    engine,
    canonical,
    description: pageDescription,
    heroTitle,
    heroPosterAbsolute,
  });
  const softwareSchema = buildSoftwareSchema({ engine, canonical, description: pageDescription, heroTitle });
  const schemaPayloads = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: heroTitle,
      description: pageDescription,
      url: canonical,
      inLanguage,
    },
    productSchema,
    softwareSchema,
    heroVideoAbsolute
      ? {
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: heroTitle,
          description: heroMedia.prompt ?? pageDescription,
          thumbnailUrl: heroPosterAbsolute ? [heroPosterAbsolute] : undefined,
          contentUrl: heroVideoAbsolute,
          uploadDate: new Date().toISOString(),
          duration: durationIso,
          inLanguage,
        }
      : null,
    {
      '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: resolvedBreadcrumb.home,
            item: localizedHomeUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: resolvedBreadcrumb.models,
            item: localizedModelsUrl,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: heroTitle,
            item: localizedCanonical,
          },
        ],
      },
  ].filter(Boolean) as object[];

  return (
    <>
      <Head>
        {heroPosterPreload ? <link rel="preload" as="image" href={heroPosterPreload} fetchPriority="high" /> : null}
        {schemaPayloads.map((schema, index) => (
          <script
            key={`schema-${index}`}
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
          />
        ))}
      </Head>
      <main className="container-page model-page max-w-6xl pb-0 pt-5 sm:pt-7">
        <div className="stack-gap-lg gap-0">
          <div className="stack-gap-xs">
            <nav className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <BackLink
                href={modelsPathname}
                label={backLabel}
                className="font-semibold text-brand hover:text-brandHover"
              />
              <span aria-hidden className="text-text-muted">
                /
              </span>
              <Link href={localizeModelsPath()} className="font-semibold text-text-secondary hover:text-text-primary">
                {resolvedBreadcrumb.models}
              </Link>
              <span aria-hidden className="text-text-muted">
                /
              </span>
              <span className="font-semibold text-text-muted">{breadcrumbModelLabel}</span>
            </nav>

            <section className={`${FULL_BLEED_SECTION} ${HERO_BG} stack-gap rounded-3xl bg-surface/80 p-6 sm:p-8`}>
              <div className="stack-gap-lg">
            <div className="stack-gap-sm text-center">
              {heroEyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                  {heroEyebrow}
                </p>
              ) : null}
              <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">
                {heroTitle}
              </h1>
              {heroSubtitle ? (
                <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
                  {heroSubtitle}
                </p>
              ) : null}
              {heroSupportLine ? (
                <p className="text-sm font-medium text-text-secondary">
                  {heroSupportLine}
                </p>
              ) : null}
              {heroSpecChips.length ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {heroSpecChips.map((chip, index) => {
                    const Icon = chip.icon ? HERO_SPEC_ICON_MAP[chip.icon] : null;
                    return (
                      <Chip
                        key={`${chip.label}-${index}`}
                        variant="outline"
                        className="!border-accent-alt/40 !bg-accent-alt px-3 py-1 text-[11px] font-semibold normal-case tracking-normal !text-on-accent-alt shadow-card"
                      >
                        {Icon ? <UIIcon icon={Icon} size={14} className="text-on-accent-alt" /> : null}
                        <span>{chip.label}</span>
                      </Chip>
                    );
                  })}
                </div>
              ) : heroBadge ? (
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary shadow-card">
                  {heroBadge.split('·').map((chunk, index, arr) => (
                    <span key={`${chunk}-${index}`} className="flex items-center gap-2">
                      <span>{chunk.trim()}</span>
                      {index < arr.length - 1 ? <span aria-hidden>·</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}
              {showHeroDescriptions && heroDesc1 ? (
                <p className="text-base leading-relaxed text-text-secondary">{heroDesc1}</p>
              ) : null}
              {showHeroDescriptions && heroDesc2 ? (
                <p className="text-base leading-relaxed text-text-secondary">{heroDesc2}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <ButtonLink
                href={normalizedPrimaryCtaHref}
                size="lg"
                className="shadow-card"
                linkComponent={Link}
              >
                {primaryCta}
              </ButtonLink>
              {secondaryCta && localizedSecondaryCtaHref ? (
                <ButtonLink
                  href={localizedSecondaryCtaHref}
                  variant="outline"
                  size="lg"
                  linkComponent={Link}
                >
                  {secondaryCta}
                </ButtonLink>
              ) : null}
            </div>
            {!heroSpecChips.length ? (
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link href={pricingLinkHref} className="font-semibold text-brand hover:text-brandHover">
                  {pricingLinkLabel}
                </Link>
              </div>
            ) : null}
            {heroTrustLine ? (
              <p className="text-center text-xs font-semibold text-text-muted">{heroTrustLine}</p>
            ) : null}
            {isEsLocale && howToLatamTitle && howToLatamSteps.length ? (
              <section className="rounded-2xl border border-hairline bg-surface/70 p-5 shadow-card">
                <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{howToLatamTitle}</h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
                  {howToLatamSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <div className="flex justify-center">
                <div className="w-full max-w-5xl">
                  <MediaPreview
                    media={heroMedia}
                    label={heroTitle}
                    hideLabel
                    hidePrompt
                    metaLines={heroMetaLines}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {bestUseCaseItems.length || bestUseCases.length ? (
                  <div className="space-y-1.5 rounded-2xl border border-hairline bg-surface/80 p-3 shadow-card">
                    {copy.bestUseCasesTitle ? (
                      <p className="text-xs font-semibold text-text-primary">{copy.bestUseCasesTitle}</p>
                    ) : null}
                    {bestUseCaseItems.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {bestUseCaseItems.map((item, index) => {
                          const Icon = item.icon ? BEST_USE_CASE_ICON_MAP[item.icon] : null;
                          return (
                            <Chip
                              key={`${item.title}-${index}`}
                              variant="outline"
                              className="px-2.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-text-secondary"
                            >
                              {Icon ? <UIIcon icon={Icon} size={14} className="text-text-muted" /> : null}
                              <span>{item.title}</span>
                            </Chip>
                          );
                        })}
                      </div>
                    ) : (
                      <ul className="grid gap-1 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-1">
                        {bestUseCases.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                {copy.whyTitle || heroHighlights.length ? (
                  <div className="stack-gap-sm rounded-2xl border border-hairline bg-bg px-3 py-2.5">
                    {copy.whyTitle ? <p className="text-xs font-semibold text-text-primary">{copy.whyTitle}</p> : null}
                    {heroHighlights.length ? (
                      <ul className="grid gap-1.5 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-1">
                        {heroHighlights.map((item) => {
                          const [title, detail] = item.split('||');
                          const trimmedTitle = title?.trim();
                          const trimmedDetail = detail?.trim();
                          return (
                            <li key={item} className="flex items-start gap-2">
                              <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-text-muted" aria-hidden />
                              {trimmedDetail ? (
                                <span>
                                  <strong className="font-semibold">{trimmedTitle}</strong>
                                  {trimmedDetail ? ` (${trimmedDetail})` : null}
                                </span>
                              ) : (
                                <span>{item}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
              </div>
            </section>
          </div>

        {tocItems.length ? (
          <nav
            className={`${FULL_BLEED_SECTION} sticky top-[calc(var(--header-height)-8px)] z-30 border-b border-hairline bg-surface before:bg-surface`}
            aria-label="Model page sections"
          >
            <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
              <div className="flex flex-wrap justify-center gap-2 py-2">
                {tocItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="inline-flex items-center rounded-full border border-hairline bg-surface/90 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </nav>
        ) : null}

        {hasSpecs ? (
          <section
            id="specs"
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            {specTitle ? (
              <h2 className="mt-2 text-center text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                {specTitle}
              </h2>
            ) : null}
            {specNote ? (
              <blockquote className="rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-center text-sm text-text-secondary">
                {specNote}
              </blockquote>
            ) : null}
            {keySpecRows.length ? (
              <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-3 gap-y-1.5 border-t border-hairline/70 pt-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {keySpecRows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`flex items-start gap-2 border-hairline/70 py-1.5 pr-1 ${
                      index < keySpecRows.length - 1 ? 'border-b' : ''
                    }`}
                  >
                    <span className="mt-[3px] inline-flex h-1.5 w-1.5 rounded-full bg-text-muted/60" aria-hidden />
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">
                        {row.label}
                      </span>
                      <span className="text-[13px] font-semibold leading-snug text-text-primary">
                        {row.valueLines?.length ? (
                          <span className="flex flex-col gap-1">
                            {row.valueLines.map((line) => (
                              <span key={line}>{localizeSpecStatus(line, locale)}</span>
                            ))}
                          </span>
                        ) : isSupported(row.value) ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <UIIcon icon={Check} size={14} className="text-emerald-600" />
                            <span className="sr-only">{statusLabels.supported}</span>
                          </span>
                        ) : (
                          localizeSpecStatus(row.value, locale)
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {specSectionsToShow.length ? (
              isImageEngine ? (
                <div className="grid grid-gap-sm sm:grid-cols-2">
                  {specSectionsToShow.map((section) => (
                    <article
                      key={section.title}
                      className="space-y-2 rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
                    >
                      <h3 className="text-lg font-semibold text-text-primary">{section.title}</h3>
                      {section.intro ? (
                        <p className="text-sm text-text-secondary">{section.intro}</p>
                      ) : null}
                      <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <SpecDetailsGrid sections={specSectionsToShow} />
              )
            ) : null}
          </section>
        ) : null}

        {isImageEngine && copy.microCta ? (
          <div className="flex justify-center">
            <Link
              href={normalizedPrimaryCtaHref}
              className="text-sm font-semibold text-brand transition hover:text-brandHover"
            >
              {copy.microCta}
            </Link>
          </div>
        ) : null}


        {!hideExamplesSection ? (
          <section
            id={textAnchorId}
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN}`}
          >
            <div className={`${FULL_BLEED_CONTENT} px-6 sm:px-8`}>
              {copy.galleryTitle ? (
                <h2 className="mt-0 text-center text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  {copy.galleryTitle}
                </h2>
              ) : null}
              {galleryVideos.length ? (
                <>
                  {copy.galleryIntro ? (
                    <p className="mt-2 text-center text-base leading-relaxed text-text-secondary">{copy.galleryIntro}</p>
                  ) : null}
                  <div className="mt-4 stack-gap">
                    <div className="overflow-x-auto pb-2">
                      <div className="flex min-w-full gap-4">
                        {galleryVideos.slice(0, 6).map((video) => (
                          <article
                            key={video.id}
                            className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card"
                          >
                            <Link href={video.href} className="group relative block aspect-video bg-placeholder">
                              {video.optimizedPosterUrl || video.rawPosterUrl ? (
                                <Image
                                  src={video.optimizedPosterUrl ?? video.rawPosterUrl ?? ''}
                                  alt={
                                    video.prompt
                                      ? `MaxVideoAI ${video.engineLabel} example – ${video.prompt}`
                                      : `MaxVideoAI ${video.engineLabel} example`
                                  }
                                  fill
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                  sizes="320px"
                                  quality={70}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-skeleton text-xs font-semibold text-text-muted">
                                  No preview
                                </div>
                              )}
                            </Link>
                            <div className="space-y-1 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                                {video.engineLabel} · {video.durationSec}s
                              </p>
                              {video.recreateHref && copy.recreateLabel ? (
                                <TextLink href={video.recreateHref} className="text-[11px]" linkComponent={Link}>
                                  {copy.recreateLabel}
                                </TextLink>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                  {copy.galleryAllCta ? (
                    <p className="mt-4 text-center text-base leading-relaxed text-text-secondary">
                      <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                        {copy.galleryAllCta}
                      </Link>
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-surface/60 px-4 py-4 text-sm text-text-secondary">
                  {copy.galleryIntro ?? 'Sora 2 examples will appear here soon.'}{' '}
                  {copy.galleryAllCta ? (
                    <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                      {copy.galleryAllCta}
                    </Link>
                  ) : null}
                </div>
              )}
              {copy.gallerySceneCta ? (
                <div className="mt-6">
                  <ButtonLink
                    href={galleryCtaHref}
                    size="lg"
                    className="shadow-card"
                    linkComponent={Link}
                  >
                    {copy.gallerySceneCta}
                  </ButtonLink>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section
          id={imageAnchorId}
          className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
        >
          {isVideoEngine ? (
            <div className="stack-gap-lg">
                <SoraPromptingTabs
                  title={copy.promptingTitle ?? undefined}
                  intro={copy.promptingIntro ?? undefined}
                  tip={copy.promptingTip ?? undefined}
                  guideLabel={copy.promptingGuideLabel ?? undefined}
                  guideUrl={copy.promptingGuideUrl ?? undefined}
                  mode="video"
                  tabs={copy.promptingTabs.length ? copy.promptingTabs : undefined}
                  globalPrinciples={copy.promptingGlobalPrinciples}
                  engineWhy={copy.promptingEngineWhy}
                  tabNotes={copy.promptingTabNotes}
                />
              {copy.demoTitle || copy.demoPrompt.length ? (
                <div className="stack-gap-lg">
                  {copy.demoTitle ? (
                    <h2 className="mt-2 text-center text-2xl font-semibold text-text-primary sm:mt-0 sm:text-3xl">
                      {copy.demoTitle}
                    </h2>
                  ) : null}
                  <div className="mx-auto w-full max-w-5xl">
                    {demoMedia ? (
                      <MediaPreview
                        media={demoMedia}
                        label={copy.demoTitle ?? 'Sora 2 demo'}
                        hideLabel
                        promptLabel={useDemoMediaPrompt ? undefined : copy.demoPromptLabel ?? undefined}
                        promptLines={useDemoMediaPrompt ? [] : copy.demoPrompt}
                      />
                    ) : (
                      <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline bg-bg text-sm text-text-secondary">
                        {copy.galleryIntro ?? 'Demo clip coming soon.'}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="stack-gap-lg">
              <SoraPromptingTabs
                title={copy.promptingTitle ?? undefined}
                intro={copy.promptingIntro ?? undefined}
                tip={copy.promptingTip ?? undefined}
                guideLabel={copy.promptingGuideLabel ?? undefined}
                guideUrl={copy.promptingGuideUrl ?? undefined}
                mode="image"
                tabs={copy.promptingTabs.length ? copy.promptingTabs : undefined}
                globalPrinciples={copy.promptingGlobalPrinciples}
                engineWhy={copy.promptingEngineWhy}
                tabNotes={copy.promptingTabNotes}
              />
            </div>
          )}
        </section>


        {hasTipsSection ? (
          <section id="tips" className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap-lg`}>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
              {copy.tipsTitle ?? 'Tips & Limitations'}
            </h2>
            {copy.tipsIntro ? (
              <p className="text-center text-base leading-relaxed text-text-secondary">{copy.tipsIntro}</p>
            ) : null}
            {(() => {
              const tipsCardCount =
                (strengths.length ? 1 : 0) +
                (troubleshootingItems.length ? 1 : 0) +
                (boundaries.length ? 1 : 0);
              const gridClass =
                tipsCardCount === 1
                  ? 'mx-auto grid w-full max-w-3xl grid-gap-sm'
                  : tipsCardCount === 2
                  ? 'mx-auto grid w-full max-w-4xl grid-gap-sm lg:grid-cols-2'
                  : 'mx-auto grid w-full max-w-5xl grid-gap-sm lg:grid-cols-3';
              return (
                <div className={gridClass}>
              {strengths.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <h3 className="text-base font-semibold text-text-primary">{tipsCardLabels.strengths}</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {troubleshootingItems.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <h3 className="text-base font-semibold text-text-primary">
                    {troubleshootingTitle ?? 'Common problems → fast fixes'}
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {troubleshootingItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {boundaries.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <h3 className="text-base font-semibold text-text-primary">{tipsCardLabels.boundaries}</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {boundaries.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
                </div>
              );
            })()}
          </section>
        ) : null}

        {hasCompareSection ? (
          <section
            id={compareAnchorId}
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap-lg`}
          >
            {focusVsConfig ? (
              <>
                <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  {focusVsConfig.title}
                </h2>
                <TextLink
                  href={localizeModelsPath(focusVsConfig.ctaSlug)}
                  className="mx-auto text-sm font-semibold text-brand hover:text-brandHover"
                  linkComponent={Link}
                >
                  {focusVsConfig.ctaLabel}
                </TextLink>
                <div className="grid grid-gap-sm lg:grid-cols-2">
                  <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                    <h3 className="text-base font-semibold text-text-primary">{focusVsConfig.leftTitle}</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                      {focusVsConfig.leftItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                    <h3 className="text-base font-semibold text-text-primary">{focusVsConfig.rightTitle}</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                      {focusVsConfig.rightItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            ) : null}
            {hasCompareGrid ? (
              <div className={focusVsConfig ? 'mt-10 stack-gap sm:mt-12' : 'stack-gap'}>
                <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  {compareCopy.title}
                </h2>
                <p className="text-center text-base leading-relaxed text-text-secondary">
                  {compareCopy.introPrefix}
                  <strong>{compareCopy.introStrong}</strong>
                  {compareCopy.introSuffix}
                </p>
                <p className="text-center text-sm text-text-secondary">{compareCopy.subline}</p>
                <div className="grid grid-gap-sm md:grid-cols-3">
                  {(() => {
                    const hasRelatedItems = relatedItems.length > 0;
                    const compareCards = hasRelatedItems
                      ? relatedItems
                      : compareEngines.map((entry) => ({
                        brand: entry.brandId,
                        title: entry.marketingName ?? entry.engine.label,
                        modelSlug: entry.modelSlug,
                        description: entry.seo?.description ?? '',
                      }));
                    return compareCards;
                  })()
                    .filter((entry) => Boolean(entry.modelSlug))
                    .map((entry) => {
                      const label = entry.title ?? '';
                      const canCompare =
                        !COMPARE_EXCLUDED_SLUGS.has(engineSlug) && !COMPARE_EXCLUDED_SLUGS.has(entry.modelSlug ?? '');
                      const compareSlug = [engineSlug, entry.modelSlug].sort().join('-vs-');
                      const compareHref = canCompare
                        ? localizeComparePath(compareSlug, engineSlug)
                        : localizeModelsPath(entry.modelSlug ?? '');
                      const ctaLabel = canCompare ? compareCopy.ctaCompare(label) : compareCopy.ctaExplore(label);
                      const description =
                        relatedItems.length > 0
                          ? entry.description || compareCopy.cardDescription(label)
                          : locale === 'en'
                            ? entry.description || compareCopy.cardDescription(label)
                            : compareCopy.cardDescription(label);
                      return (
                        <article
                          key={entry.modelSlug}
                          className="rounded-2xl border border-hairline bg-surface/90 p-4 shadow-card transition hover:-translate-y-1 hover:border-text-muted"
                        >
                          {entry.brand ? (
                            <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                              {entry.brand}
                            </p>
                          ) : null}
                          <h3 className="mt-2 text-lg font-semibold text-text-primary">
                            {heroTitle} vs {label}
                          </h3>
                          <p className="mt-2 text-sm text-text-secondary line-clamp-2">{description}</p>
                          <TextLink href={compareHref} className="mt-4 gap-1 text-sm" linkComponent={Link}>
                            {ctaLabel}
                          </TextLink>
                        </article>
                      );
                    })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {copy.safetyTitle || safetyRules.length || safetyInterpretation.length ? (
          <section
            id="safety"
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
              {copy.safetyTitle ?? 'Safety & people / likeness'}
            </h2>
            <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
              {safetyRules.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {safetyRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              ) : null}
              {safetyInterpretation.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {safetyInterpretation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            {copy.safetyNote ? <p className="text-sm text-text-secondary">{copy.safetyNote}</p> : null}
          </section>
        ) : null}


        {faqList.length ? (
          <section
            id="faq"
            className={`${FULL_BLEED_SECTION} ${isSoraPrompting ? SECTION_BG_A : SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            {faqTitle ? (
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{faqTitle}</h2>
            ) : null}
            <div className="stack-gap-sm">
              {faqList.map((entry) => (
                <ResponsiveDetails
                  openOnDesktop
                  key={entry.question}
                  className="rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
                  summaryClassName="cursor-pointer text-sm font-semibold text-text-primary"
                  summary={entry.question}
                >
                  <p className="mt-2 text-sm text-text-secondary">{entry.answer}</p>
                </ResponsiveDetails>
              ))}
            </div>
          </section>
        ) : null}
        <FAQSchema questions={faqJsonLdEntries} />
        </div>
      </main>
    </>
  );
}

function MediaPreview({
  media,
  label,
  promptLabel,
  promptLines = [],
  hideLabel = false,
  hidePrompt = false,
  metaLines = [],
}: {
  media: FeaturedMedia;
  label: string;
  promptLabel?: string;
  promptLines?: string[];
  hideLabel?: boolean;
  hidePrompt?: boolean;
  metaLines?: Array<{ label: string; value: string }>;
}) {
  const posterSrc = media.posterUrl ?? null;
  const aspect = media.aspectRatio ?? '16:9';
  const [w, h] = aspect.split(':').map(Number);
  const isValidAspect = Number.isFinite(w) && Number.isFinite(h) && h > 0 && w > 0;
  const paddingBottom = isValidAspect ? `${(h / w) * 100}%` : '56.25%';
  const isVertical = isValidAspect ? w < h : false;
  const normalizedPromptLabel = promptLabel?.trim() ?? '';
  const displayPromptLabel = /^prompt\b/i.test(normalizedPromptLabel) ? 'Prompt' : normalizedPromptLabel;
  const figureClassName = [
    'group relative overflow-hidden rounded-[22px] border border-hairline bg-surface shadow-card',
    isVertical ? 'mx-auto max-w-sm' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <figure className={figureClassName}>
      <div className="relative w-full overflow-hidden rounded-t-[22px] bg-placeholder">
        <div className="relative w-full" style={{ paddingBottom }}>
          <div className="absolute inset-0">
            {media.videoUrl ? (
              <video
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={posterSrc ?? undefined}
              >
                <source src={media.videoUrl} type="video/mp4" />
              </video>
            ) : posterSrc ? (
              <Image
                src={posterSrc}
                alt={media.prompt ? `Sora 2 preview – ${media.prompt}` : label}
                fill
                className="h-full w-full object-cover"
                sizes="(max-width: 768px) 100vw, 720px"
                quality={80}
                loading="eager"
                fetchPriority="high"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-surface-2 text-sm font-semibold text-text-muted">
                Sora 2 preview
              </div>
            )}
            {media.hasAudio ? (
              <span className="absolute left-3 top-3 rounded-full bg-surface-on-media-dark-70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-on-inverse">
                Audio on
              </span>
            ) : null}
            {media.durationSec ? (
              <span className="absolute right-3 top-3 rounded-full bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-primary shadow-card">
                {media.durationSec}s
              </span>
            ) : null}
          </div>
      </div>
    </div>
      <figcaption className="space-y-1 px-4 py-3">
        {!hideLabel ? <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p> : null}
        {metaLines.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-text-secondary">
            {metaLines.map((line) => (
              <li key={line.label} className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">
                  {line.label}
                </span>
                <span>{line.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {!hidePrompt &&
        displayPromptLabel &&
        displayPromptLabel.toLowerCase() !== label.trim().toLowerCase() &&
        !/demo/i.test(displayPromptLabel) ? (
          <p className="text-xs font-semibold text-text-secondary">{displayPromptLabel}</p>
        ) : null}
        {!hidePrompt && promptLines.length ? (
          <div className="space-y-2 text-sm text-text-primary">
            {promptLines.map((line) => (
              <p key={line} className="leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {!hidePrompt && promptLines.length === 0 && media.prompt ? (
          <p className="text-sm font-semibold leading-snug text-text-primary">{media.prompt}</p>
        ) : null}
        {media.href ? (
          <TextLink href={media.href} className="gap-1 text-xs" linkComponent={Link}>
            View render →
          </TextLink>
        ) : null}
      </figcaption>
    </figure>
  );
}

export default async function ModelDetailPage({ params }: PageParams) {
  const { slug, locale: routeLocale } = params;
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    notFound();
  }

  if (
    slug === 'sora-2' ||
    slug === 'sora-2-pro' ||
    slug === 'veo-3-1' ||
    slug === 'veo-3-1-fast' ||
    slug === 'veo-3-1-first-last' ||
    slug === 'pika-text-to-video' ||
    slug === 'wan-2-5' ||
    slug === 'wan-2-6' ||
    slug === 'kling-2-5-turbo' ||
    slug === 'minimax-hailuo-02-text' ||
    slug === 'ltx-2' ||
    slug === 'ltx-2-fast' ||
    slug === 'kling-2-6-pro' ||
    slug === 'kling-3-pro' ||
    slug === 'nano-banana' ||
    slug === 'nano-banana-pro'
  ) {
    const activeLocale = routeLocale ?? 'en';
    const { dictionary } = await resolveDictionary();
    const detailCopy: DetailCopy = {
      ...DEFAULT_DETAIL_COPY,
      ...(dictionary.models.detail ?? {}),
      breadcrumb: { ...DEFAULT_DETAIL_COPY.breadcrumb, ...(dictionary.models.detail?.breadcrumb ?? {}) },
    };
    const localizedContent = await getEngineLocalized(slug, activeLocale);
    return await renderSoraModelPage({
      engine,
      detailCopy,
      localizedContent,
      locale: activeLocale,
    });
  }

  const { dictionary } = await resolveDictionary();
  const activeLocale = routeLocale ?? 'en';
  if (process.env.NODE_ENV === 'development') {
    console.info('[models/page] locale debug', { slug, routeLocale, activeLocale });
  }
  const modelsBase = (MODELS_BASE_PATH_MAP[activeLocale as AppLocale] ?? 'models').replace(/^\/+|\/+$/g, '');
  const localizeModelsPath = (targetSlug?: string) => {
    const slugPart = targetSlug ? `/${targetSlug.replace(/^\/+/, '')}` : '';
    return `/${modelsBase}${slugPart}`.replace(/\/{2,}/g, '/');
  };
  const compareBase = (COMPARE_BASE_PATH_MAP[activeLocale as AppLocale] ?? 'ai-video-engines').replace(
    /^\/+|\/+$/g,
    ''
  );
  const localizeComparePath = (pairSlug: string, orderSlug?: string) => {
    return buildCanonicalComparePath({ compareBase, pairSlug, orderSlug });
  };
  const normalizeHeroCtaHref = (href?: string | null): LocalizedLinkHref | null => {
    if (!href) return null;
    const examplesHref = resolveExamplesHrefFromRaw(href);
    if (examplesHref) return examplesHref;
    const nonLocalizedHref = resolveNonLocalizedHref(href);
    if (nonLocalizedHref) return nonLocalizedHref;
    if (href.startsWith('/models')) {
      return localizeModelsPath(href.replace(/^\/models\/?/, ''));
    }
    return href;
  };
  const localizedContent = await getEngineLocalized(slug, activeLocale);
  const detailSlugMap = buildDetailSlugMap(slug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${slug}`));
  const metadataUrls = buildMetadataUrls(activeLocale, detailSlugMap, {
    englishPath: `/models/${slug}`,
    availableLocales: publishableLocales,
  });
  const allEngines = listFalEngines();
  const rankEngine = (entry: FalEngineEntry) => (entry.family === engine.family ? 0 : 1);
  type RelatedCopyContent = { title?: string; subtitle?: string; cta?: string };
  const relatedContent = (dictionary.models as typeof dictionary.models & { related?: RelatedCopyContent }).related ?? {};
  const relatedEngines = allEngines
    .filter((entry) => entry.modelSlug !== slug)
    .sort((a, b) => {
      const familyDiff = rankEngine(a) - rankEngine(b);
      if (familyDiff !== 0) {
        return familyDiff;
      }
      return (a.marketingName ?? a.engine.label).localeCompare(b.marketingName ?? b.engine.label);
    })
    .slice(0, 3);
  const relatedCopy = {
    title: relatedContent.title ?? 'Explore other engines',
    subtitle:
      relatedContent.subtitle ?? 'Compare price tiers, latency, and prompt presets across the rest of the catalog.',
    cta: relatedContent.cta ?? 'View model →',
  };

  const detailCopy: DetailCopy = {
    ...DEFAULT_DETAIL_COPY,
    ...(dictionary.models.detail ?? {}),
    overview: {
      ...DEFAULT_DETAIL_COPY.overview,
      ...(dictionary.models.detail?.overview ?? {}),
    },
    logoPolicies: {
      ...DEFAULT_DETAIL_COPY.logoPolicies,
      ...(dictionary.models.detail?.logoPolicies ?? {}),
    },
    buttons: {
      ...DEFAULT_DETAIL_COPY.buttons,
      ...(dictionary.models.detail?.buttons ?? {}),
    },
    breadcrumb: {
      ...DEFAULT_DETAIL_COPY.breadcrumb,
      ...(dictionary.models.detail?.breadcrumb ?? {}),
    },
  };

  if (engine.modelSlug === 'nano-banana' || engine.modelSlug === 'nano-banana-pro') {
    detailCopy.overviewTitle = 'Overview';
  }
  const marketingName = localizedContent.marketingName ?? engine.marketingName;
  const versionLabel = localizedContent.versionLabel ?? engine.versionLabel;
  const seoDescription = localizedContent.seo.description ?? engine.seo.description ?? null;
  const overviewSummary = localizedContent.overview ?? seoDescription;
  const heroContent = localizedContent.hero;
  const introText = heroContent?.intro ?? overviewSummary;
  const bestUseCases = localizedContent.bestUseCases;
  const bestUseCaseItems = normalizeBestUseCaseItems(bestUseCases?.items ?? [], activeLocale);
  const technicalOverview = localizedContent.technicalOverview ?? [];
  const technicalOverviewTitle = localizedContent.technicalOverviewTitle ?? 'Technical overview';
  const promptStructure = localizedContent.promptStructure;
  const tips = localizedContent.tips;
  const compareLink = localizedContent.compareLink;
  const compareLinkHref =
    compareLink?.href ? normalizeHeroCtaHref(compareLink.href) ?? compareLink.href : null;
  const heroPrimaryCta = heroContent?.ctaPrimary;
  const heroPrimaryHref = heroPrimaryCta?.href ? normalizeHeroCtaHref(heroPrimaryCta.href) ?? heroPrimaryCta.href : null;
  const secondaryCtas = heroContent?.secondaryLinks ?? [];
  const normalizedSecondaryCtas = secondaryCtas.map((cta) => ({
    ...cta,
    href: cta?.href ? normalizeHeroCtaHref(cta.href) ?? cta.href : cta?.href,
  }));
  const brand = PARTNER_BRAND_MAP.get(engine.brandId);
  const promptEntries =
    localizedContent.prompts.length > 0
      ? localizedContent.prompts
      : engine.prompts.map(({ title, prompt, notes }) => ({ title, prompt, notes }));
  const faqEntries =
    localizedContent.faqs.length > 0
      ? localizedContent.faqs
      : (engine.faqs ?? []).map(({ question, answer }) => ({ question, answer }));
  const pricingNotes = localizedContent.pricingNotes ?? null;
  const localizedCanonicalRaw = metadataUrls.canonical;
  const localizedCanonicalUrl = localizedCanonicalRaw.replace(/\/+$/, '') || localizedCanonicalRaw;
  const canonicalUrl = localizedCanonicalUrl;
  const breadcrumbTitleBase = localizedContent.seo.title ?? marketingName ?? slug;
  const breadcrumbTitle = breadcrumbTitleBase.replace(/ —.*$/, '');
  const inLanguage = localeRegions[activeLocale] ?? 'en-US';
  const localePathPrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale].replace(/^\/+/, '')}` : '';
  const homePathname = localePathPrefix || '/';
  const localizedHomeUrl = homePathname === '/' ? `${SITE}/` : `${SITE}${homePathname}`;
  const localizedModelsSlug = (MODELS_BASE_PATH_MAP[activeLocale] ?? 'models').replace(/^\/+/, '');
  const modelsPathname =
    homePathname === '/'
      ? `/${localizedModelsSlug}`
      : `${homePathname.replace(/\/+$/, '')}/${localizedModelsSlug}`.replace(/\/{2,}/g, '/');
  const localizedModelsUrl = `${SITE}${modelsPathname}`;
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: detailCopy.breadcrumb.home,
        item: localizedHomeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: detailCopy.breadcrumb.models,
        item: localizedModelsUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: breadcrumbTitle,
        item: localizedCanonicalUrl,
      },
    ],
  };
  const platformPriceInfo = detailCopy.overview.platformPrice
    ? {
        label: detailCopy.overview.platformPrice,
        href: '/generate',
      }
    : null;
  const examplesLinkHref = getExamplesHref(engine.modelSlug ?? slug) ?? { pathname: '/examples' };
  const pricingLinkHref = { pathname: '/pricing' };

  const heroPosterSrc = localizedContent.seo.image ?? engine.media?.imagePath ?? null;
  const heroPosterPreload = heroPosterSrc ? buildOptimizedPosterUrl(heroPosterSrc) ?? heroPosterSrc : null;
  const heroPosterAbsolute = toAbsoluteUrl(heroPosterSrc);
  const heroTitle = heroContent?.title ?? marketingName ?? slug;
  const pageDescription = introText ?? seoDescription ?? heroTitle;
  const productSchema = buildProductSchema({
    engine,
    canonical: canonicalUrl,
    description: pageDescription ?? breadcrumbTitle,
    heroTitle,
    heroPosterAbsolute,
  });
  const softwareSchema = buildSoftwareSchema({
    engine,
    canonical: canonicalUrl,
    description: pageDescription ?? breadcrumbTitle,
    heroTitle,
  });
  const schemaPayloads = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: heroTitle,
      description: pageDescription ?? breadcrumbTitle,
      url: canonicalUrl,
      inLanguage,
    },
    productSchema,
    softwareSchema,
    breadcrumbLd,
  ].filter(Boolean) as object[];
  const hasSpecs = true;
  const hasTextSection = Boolean(promptStructure) || promptEntries.length > 0;
  const hasTipsSection = Boolean(tips?.items && tips.items.length);
  const hasFaqSection = faqEntries.length > 0;
  const faqJsonLdEntries = faqEntries.slice(0, 6);
  const tocItems = [
    { id: 'specs', label: 'Specs', visible: hasSpecs },
    { id: 'text-to-video', label: 'Text to Video', visible: hasTextSection },
    { id: 'tips', label: 'Tips', visible: hasTipsSection },
    { id: 'faq', label: 'FAQ', visible: hasFaqSection },
  ].filter((item) => item.visible);
  const textAnchorId = 'text-to-video';
  const attachTextIdToPromptStructure = Boolean(promptStructure);
  const launchHref = engine.type === 'image' ? '/app/image' : '/app';

  return (
    <>
      <Head>
        {heroPosterPreload ? <link rel="preload" as="image" href={heroPosterPreload} fetchPriority="high" /> : null}
        {schemaPayloads.map((schema, index) => (
          <script
            key={`schema-${index}`}
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
          />
        ))}
      </Head>
      <div className="container-page max-w-4xl section">
        <div className="stack-gap-lg">
          <div className="stack-gap-sm">
            <Link href={localizeModelsPath()} className="text-sm font-semibold text-brand hover:text-brandHover">
              {detailCopy.backLabel}
            </Link>
            <header className="stack-gap-sm">
              <div className="flex flex-wrap items-center gap-4">
                {brand && engine.logoPolicy === 'logoAllowed' ? (
                  <span className="flex items-center">
                    <Image src={brand.assets.light.svg} alt={`${marketingName} logo`} width={140} height={32} className="h-9 w-auto dark:hidden" />
                    <Image src={brand.assets.dark.svg} alt={`${marketingName} logo`} width={140} height={32} className="hidden h-9 w-auto dark:inline-flex" />
                  </span>
                ) : null}
                <div>
                  <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                    {heroContent?.title ?? marketingName}
                  </h2>
                  {versionLabel ? (
                    <p className="text-sm uppercase tracking-micro text-text-muted">{versionLabel}</p>
                  ) : null}
                </div>
              </div>
              {introText ? <p className="text-sm text-text-secondary">{introText}</p> : null}
            </header>
          </div>

          <div className="stack-gap-sm">
            {(heroPrimaryCta?.label || secondaryCtas.length) ? (
              <div className="flex flex-wrap gap-4">
                {heroPrimaryCta?.label && heroPrimaryHref ? (
                  <ButtonLink
                    href={heroPrimaryHref}
                    size="lg"
                    className="shadow-card"
                    linkComponent={Link}
                  >
                    {heroPrimaryCta.label}
                  </ButtonLink>
                ) : null}
                {normalizedSecondaryCtas
                  .filter(
                    (cta): cta is { label: string; href: LocalizedLinkHref } =>
                      Boolean(cta.label && cta.href)
                  )
                  .map((cta) => {
                    const hrefKey = typeof cta.href === 'string' ? cta.href : cta.href.pathname ?? '';
                    return (
                      <ButtonLink
                        key={`${hrefKey}-${cta.label}`}
                        href={cta.href}
                        variant="outline"
                        size="lg"
                        linkComponent={Link}
                      >
                        {cta.label}
                      </ButtonLink>
                    );
                  })}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                {detailCopy.examplesLinkLabel}
              </Link>
              <Link href={pricingLinkHref} className="font-semibold text-brand hover:text-brandHover">
                {detailCopy.pricingLinkLabel}
              </Link>
            </div>
          </div>

      {tocItems.length ? (
        <nav
          className="rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
          aria-label="Model page navigation"
        >
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Jump to section</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-sm font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      {bestUseCaseItems.length ? (
        <section className="space-y-1.5 rounded-2xl border border-hairline bg-surface/80 p-3 shadow-card">
          <h2 className="text-xs font-semibold text-text-primary">{bestUseCases?.title ?? 'Best use cases'}</h2>
          <div className="flex flex-wrap gap-1.5">
            {bestUseCaseItems.map((item, index) => {
              const Icon = item.icon ? BEST_USE_CASE_ICON_MAP[item.icon] : null;
              return (
                <Chip
                  key={`${item.title}-${index}`}
                  variant="outline"
                  className="px-2.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-text-secondary"
                >
                  {Icon ? <UIIcon icon={Icon} size={14} className="text-text-muted" /> : null}
                  <span>{item.title}</span>
                </Chip>
              );
            })}
          </div>
        </section>
      ) : null}

      {technicalOverview.length ? (
        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{technicalOverviewTitle}</h2>
          <div className="mt-4 grid grid-gap-sm text-sm text-text-secondary sm:grid-cols-2">
            {technicalOverview.map((entry, index) => (
              <article key={`${entry.label ?? index}-${entry.body}`} className="space-y-1">
                {entry.label ? <strong className="block text-text-primary">{entry.label}</strong> : null}
                {entry.body ? <p>{entry.body}</p> : null}
                {entry.link?.href && entry.link?.label ? (
                  <a
                    href={entry.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-brand hover:text-brandHover"
                  >
                    {entry.link.label}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {promptStructure ? (
        <section
          id={attachTextIdToPromptStructure ? textAnchorId : undefined}
          className="rounded-card border border-hairline bg-surface p-6 shadow-card"
        >
          <h2 className="text-lg font-semibold text-text-primary">{promptStructure.title ?? 'Prompt structure'}</h2>
          {promptStructure.quote ? (
            <blockquote className="mt-3 border-l-2 border-hairline pl-3 text-sm text-text-secondary italic">
              {promptStructure.quote}
            </blockquote>
          ) : null}
          {promptStructure.description ? (
            <p className="mt-3 text-sm text-text-secondary">{promptStructure.description}</p>
          ) : null}
          {promptStructure.steps && promptStructure.steps.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
              {promptStructure.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {tips?.items && tips.items.length ? (
        <section id="tips" className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{tips.title ?? 'Tips & tricks'}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            {tips.items.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {compareLink?.href && compareLink.label ? (
        <p className="text-sm text-text-secondary">
          {compareLink.before ?? ''}
          <Link href={compareLinkHref ?? compareLink.href} className="font-semibold text-brand hover:text-brandHover">
            {compareLink.label}
          </Link>
          {compareLink.after ?? ''}
        </p>
      ) : null}

      <section id="specs" className="stack-gap">
        <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.overviewTitle}</h2>
          <dl className="mt-4 grid grid-gap-sm text-sm text-text-secondary sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.brand}</dt>
              <dd>{brand ? brand.label : engine.brandId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.engineId}</dt>
              <dd>{engine.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.slug}</dt>
              <dd>{localizeModelsPath(engine.modelSlug)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.logoPolicy}</dt>
              <dd>{detailCopy.logoPolicies[engine.logoPolicy as keyof DetailCopy['logoPolicies']] ?? detailCopy.logoPolicies.textOnly}</dd>
            </div>
            {platformPriceInfo ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.platformPrice}</dt>
                <dd>
                  <Link
                    href={platformPriceInfo.href}
                    prefetch={false}
                    className="text-sm font-semibold text-brand hover:text-brandHover"
                  >
                    {platformPriceInfo.label}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
          {pricingNotes ? <p className="mt-3 text-xs text-text-muted">{pricingNotes}</p> : null}
        </div>
      </section>

      {promptEntries.length > 0 && (
        <section
          id={!attachTextIdToPromptStructure ? textAnchorId : undefined}
          className="stack-gap"
        >
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.promptsTitle}</h2>
          <div className="grid grid-gap-sm sm:grid-cols-2">
            {promptEntries.map((entry) => (
              <article key={entry.title} className="rounded-card border border-hairline bg-surface p-4 text-sm text-text-secondary shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{entry.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{entry.prompt}</p>
                {entry.notes ? <p className="mt-2 text-xs text-text-muted">{entry.notes}</p> : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {faqEntries.length > 0 && (
        <section id="faq" className="stack-gap">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.faqTitle}</h2>
          <div className="stack-gap-sm text-sm text-text-secondary">
            {faqEntries.map(({ question, answer }) => (
              <article key={question} className="rounded-card border border-hairline bg-surface p-4 shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{question}</h3>
                <p className="mt-1 text-sm text-text-secondary">{answer}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      <FAQSchema questions={faqJsonLdEntries} />

      {relatedEngines.length ? (
        <section className="stack-gap">
          <div className="stack-gap-sm">
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{relatedCopy.title}</h2>
            <p className="text-sm text-text-secondary">{relatedCopy.subtitle}</p>
          </div>
          <div className="grid grid-gap-sm md:grid-cols-3">
            {relatedEngines.map((candidate) => {
              const label = candidate.marketingName ?? candidate.engine.label;
              const ctaLabel = (() => {
                if (slug === 'ltx-2') {
                  if (candidate.modelSlug === 'ltx-2-fast') return 'Compare LTX-2 Pro vs Fast';
                  if (candidate.modelSlug === 'sora-2') return 'Explore Sora 2';
                  if (candidate.modelSlug === 'sora-2-pro') return 'Explore Sora 2 Pro';
                }
                return `Try ${label}`;
              })();
              const compareDisabled =
                COMPARE_EXCLUDED_SLUGS.has(slug) || COMPARE_EXCLUDED_SLUGS.has(candidate.modelSlug);
              const compareSlug = [slug, candidate.modelSlug].sort().join('-vs-');
              const compareHref = compareDisabled
                ? localizeModelsPath(candidate.modelSlug)
                : localizeComparePath(compareSlug, slug);
              const linkLabel = compareDisabled ? relatedCopy.cta : ctaLabel;
              return (
                <article key={candidate.modelSlug} className="rounded-2xl border border-hairline bg-surface/90 p-5 shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{candidate.brandId}</p>
                  <h3 className="mt-2 text-lg font-semibold text-text-primary">{label}</h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    {candidate.seo?.description ?? 'Latency, pricing, and prompt guides are documented on the detail page.'}
                  </p>
                  <TextLink
                    href={compareHref}
                    className="mt-4 gap-1 text-sm"
                    linkComponent={Link}
                  >
                    {linkLabel} <span aria-hidden>→</span>
                  </TextLink>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <ButtonLink
          href="/app"
          prefetch={false}
          variant="outline"
          linkComponent={Link}
        >
          {detailCopy.buttons.pricing}
        </ButtonLink>
        <ButtonLink
          href={launchHref}
          prefetch={false}
          className="shadow-card"
          linkComponent={Link}
        >
          {detailCopy.buttons.launch}
        </ButtonLink>
      </div>

        </div>
    </div>
  </>
);
}
