import type { Metadata } from 'next';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveDictionary } from '@/lib/i18n/server';
import {
  buildCanonicalCompareSlug,
  getHubEngines,
  getPopularComparisons,
  getRankedComparisonPairs,
  getSuggestedOpponents,
  getUseCaseBuckets,
} from '@/lib/compare-hub/data';
import { CompareNowWidget } from './CompareNowWidget.client';
import { UseCaseExplorer } from './UseCaseExplorer.client';
import { EnginesCatalog, type EngineCatalogCard } from './EnginesCatalog.client';
import { ComparisonsDirectory } from './ComparisonsDirectory.client';

const COMPARE_SLUG_MAP = buildSlugMap('compare');

type HubFaqEntry = {
  question: string;
  answer: string;
};

type HubCopy = {
  hero: {
    title: string;
    intro: string;
    compareNow: {
      left: string;
      right: string;
      compare: string;
      searchPlaceholder: string;
      noResults: string;
      strengthsLabel: string;
      strengthsFallback: string;
    };
  };
  sections: {
    popularTitle: string;
    popularIntro: string;
    useCasesTitle: string;
    useCasesIntro: string;
    enginesTitle: string;
    enginesIntro: string;
    enginesToggle: string;
    enginesToggleHintClosed: string;
    enginesToggleHintOpen: string;
    allComparisonsTitle: string;
    allComparisonsIntro: string;
    faqTitle: string;
    complianceLabel: string;
    quickStartLabel: string;
    useCasesFallback: string;
  };
  tagLabels: Record<string, string>;
  useCaseLabels: Record<string, string>;
  popularCompareLabel: string;
  catalogLabels: Parameters<typeof EnginesCatalog>[0]['labels'];
  listLabels: Parameters<typeof ComparisonsDirectory>[0]['labels'];
  faq: HubFaqEntry[];
};

const HUB_COPY: Record<AppLocale, HubCopy> = {
  en: {
    hero: {
      title: 'Compare AI video engines',
      intro:
        'Pick any two engines and open a side-by-side comparison in one click. Use this hub to scan popular matchups, filter by key limits, and validate pricing before you render. It covers text-to-video, image-to-video, and video-to-video engines, then routes you to the right fit for your shot.',
      compareNow: {
        left: 'Engine A',
        right: 'Engine B',
        compare: 'Compare',
        searchPlaceholder: 'Search engine...',
        noResults: 'No results',
        strengthsLabel: 'Strengths',
        strengthsFallback: 'General purpose video',
      },
    },
    sections: {
      popularTitle: 'Popular comparisons',
      popularIntro: 'A balanced shortlist of frequently requested matchups across the main engine families.',
      useCasesTitle: 'Compare by use case',
      useCasesIntro: 'Pick a goal and open one of the recommended matchups.',
      enginesTitle: 'Pick an engine to compare',
      enginesIntro: 'Compare-focused specs only. Full model guidance stays on each model page.',
      enginesToggle: 'Show engine catalog ({count})',
      enginesToggleHintClosed: 'Click to expand',
      enginesToggleHintOpen: 'Click to collapse',
      allComparisonsTitle: 'All comparisons',
      allComparisonsIntro:
        'Browse strategic matchups first, then search the full canonical catalog. Need policy details? Read our compliance notes.',
      faqTitle: 'AI video engine comparison FAQ',
      complianceLabel: 'Read compliance details',
      quickStartLabel: 'Quick start',
      useCasesFallback: 'Interactive chips refine recommendations instantly. All links remain crawlable and available in plain HTML.',
    },
    tagLabels: {
      audio: 'Audio',
      cinematic: 'Cinematic',
      quality: 'Best quality',
      long: 'Long duration',
      ads: 'Ads',
      product: 'Product',
      value: 'Best value',
      general: 'General use',
      i2v: 'Image-to-video',
      social: 'Social',
      fast: 'Fast',
      storyboards: 'Storyboards',
    },
    useCaseLabels: {
      cinematic: 'Cinematic',
      ads: 'Ads',
      social: 'Social',
      product: 'Product',
      storyboards: 'Storyboards',
      audio: 'Audio',
      'no-audio': 'No audio',
      'best-value': 'Best value',
      'best-quality': 'Best quality',
      'text-to-video': 'Text-to-video',
      'image-to-video': 'Image-to-video',
      'video-to-video': 'Video-to-video',
    },
    popularCompareLabel: 'Compare',
    catalogLabels: {
      sortAll: 'All',
      filters: {
        mode: 'Mode',
        audio: 'Audio',
        duration: 'Duration',
        resolution: 'Resolution',
        status: 'Status',
        provider: 'Provider',
        clear: 'Clear filters',
      },
      options: {
        all: 'All',
        modeT2v: 'Text-to-video',
        modeI2v: 'Image-to-video',
        modeV2v: 'Video-to-video',
        audioOn: 'Audio',
        audioOff: 'No audio',
        durationShort: '< 8s',
        durationMedium: '8-11s',
        durationLong: '12s+',
        resolution720: '720p+',
        resolution1080: '1080p+',
        resolution4k: '4K',
        statusLive: 'Live',
        statusEarly: 'Early access',
      },
      specs: {
        modes: 'Modes',
        audio: 'Audio',
        status: 'Status',
        duration: 'Max duration',
        resolution: 'Max resolution',
        yes: 'Yes',
        no: 'No',
        unknown: 'Unknown',
        secondsSuffix: 's',
        statusLive: 'Live',
        statusEarly: 'Early access',
      },
      ctas: {
        model: 'Model page',
        compare: 'Compare vs',
      },
      empty: 'No engines match these filters.',
    },
    listLabels: {
      searchPlaceholder: 'Search comparisons...',
      loadMore: 'Load more',
      empty: 'No comparisons match this search.',
    },
    faq: [
      {
        question: 'How do I compare two AI video engines quickly?',
        answer:
          'Use the Compare Now widget at the top of the page, choose Engine A and Engine B, then click Compare to open the canonical matchup page. Use the same prompt (or simple text prompt) across both AI models to compare motion consistency and prompt fidelity before you generate.',
      },
      {
        question: 'Why do some comparisons show different strengths?',
        answer:
          'Each model trades off speed, prompt fidelity, motion realism, duration, and audio support differently. The best choice depends on the specific shot and deadline. These tradeoffs are why comparing the AI video model before you generate videos saves time and cost.',
      },
      {
        question: 'Can I compare text-to-video and image-to-video engines together?',
        answer:
          'Yes. The hub includes mixed-mode matchups so you can compare engines that prioritize text prompts, image inputs, or both. Yes - you can also include video-to-video engines when available.',
      },
      {
        question: 'How should I choose between two close engines?',
        answer:
          'Start with the use case chips, then validate with a direct side-by-side test. For tie-breaks, run the same simple text prompt (or reference image) and prioritize prompt fidelity, motion consistency, and turnaround speed for your delivery format.',
      },
    ],
  },
  fr: {
    hero: {
      title: 'Comparer les moteurs vidéo IA',
      intro:
        'Choisissez deux moteurs et ouvrez un comparatif côte à côte en un clic. Utilisez ce hub pour repérer les matchups utiles, filtrer sur les limites clés et valider le prix avant rendu. Il couvre texte-vers-vidéo, image-vers-vidéo et vidéo-vers-vidéo, puis vous oriente vers le moteur le plus adapté à votre plan.',
      compareNow: {
        left: 'Moteur A',
        right: 'Moteur B',
        compare: 'Comparer',
        searchPlaceholder: 'Rechercher un moteur...',
        noResults: 'Aucun résultat',
        strengthsLabel: 'Points forts',
        strengthsFallback: 'Usage général vidéo',
      },
    },
    sections: {
      popularTitle: 'Comparatifs populaires',
      popularIntro: 'Une sélection équilibrée des matchups les plus demandés entre familles de moteurs.',
      useCasesTitle: 'Comparer par cas d’usage',
      useCasesIntro: 'Choisissez un objectif, puis ouvrez un comparatif recommandé.',
      enginesTitle: 'Choisir un moteur à comparer',
      enginesIntro: 'Spécifications orientées comparaison uniquement. Le détail éditorial reste sur les pages modèles.',
      enginesToggle: 'Afficher le catalogue moteurs ({count})',
      enginesToggleHintClosed: 'Cliquer pour déplier',
      enginesToggleHintOpen: 'Cliquer pour replier',
      allComparisonsTitle: 'Tous les comparatifs',
      allComparisonsIntro:
        'Parcourez d’abord les comparatifs prioritaires, puis cherchez dans le catalogue canonique complet. Besoin de conformité? Consultez nos notes dédiées.',
      faqTitle: 'FAQ comparatif des moteurs vidéo IA',
      complianceLabel: 'Voir les notes de conformité',
      quickStartLabel: 'Accès rapide',
      useCasesFallback:
        'Les puces interactives affinent les recommandations instantanément. Tous les liens restent crawlables et présents en HTML standard.',
    },
    tagLabels: {
      audio: 'Audio',
      cinematic: 'Cinématique',
      quality: 'Qualité',
      long: 'Longue durée',
      ads: 'Publicité',
      product: 'Produit',
      value: 'Meilleur coût',
      general: 'Généraliste',
      i2v: 'Image-vers-vidéo',
      social: 'Social',
      fast: 'Rapide',
      storyboards: 'Storyboards',
    },
    useCaseLabels: {
      cinematic: 'Cinématique',
      ads: 'Publicité',
      social: 'Social',
      product: 'Produit',
      storyboards: 'Storyboards',
      audio: 'Audio',
      'no-audio': 'Sans audio',
      'best-value': 'Meilleur coût',
      'best-quality': 'Meilleure qualité',
      'text-to-video': 'Texte-vers-vidéo',
      'image-to-video': 'Image-vers-vidéo',
      'video-to-video': 'Vidéo-vers-vidéo',
    },
    popularCompareLabel: 'Comparer',
    catalogLabels: {
      sortAll: 'Tous',
      filters: {
        mode: 'Mode',
        audio: 'Audio',
        duration: 'Durée',
        resolution: 'Résolution',
        status: 'Statut',
        provider: 'Fournisseur',
        clear: 'Effacer les filtres',
      },
      options: {
        all: 'Tous',
        modeT2v: 'Texte-vers-vidéo',
        modeI2v: 'Image-vers-vidéo',
        modeV2v: 'Vidéo-vers-vidéo',
        audioOn: 'Audio',
        audioOff: 'Sans audio',
        durationShort: '< 8s',
        durationMedium: '8-11s',
        durationLong: '12s+',
        resolution720: '720p+',
        resolution1080: '1080p+',
        resolution4k: '4K',
        statusLive: 'Live',
        statusEarly: 'Accès anticipé',
      },
      specs: {
        modes: 'Modes',
        audio: 'Audio',
        status: 'Statut',
        duration: 'Durée max',
        resolution: 'Résolution max',
        yes: 'Oui',
        no: 'Non',
        unknown: 'Inconnu',
        secondsSuffix: 's',
        statusLive: 'Live',
        statusEarly: 'Accès anticipé',
      },
      ctas: {
        model: 'Page modèle',
        compare: 'Comparer vs',
      },
      empty: 'Aucun moteur ne correspond à ces filtres.',
    },
    listLabels: {
      searchPlaceholder: 'Rechercher un comparatif...',
      loadMore: 'Voir plus',
      empty: 'Aucun comparatif ne correspond à la recherche.',
    },
    faq: [
      {
        question: 'Comment comparer deux moteurs rapidement ?',
        answer:
          'Utilisez le module Comparer en haut de page, choisissez Moteur A et Moteur B, puis cliquez sur Comparer pour ouvrir la page canonique. Utilisez le même prompt (ou un prompt texte simple) sur les deux modèles IA pour comparer la régularité du mouvement et la fidélité au prompt avant de générer.',
      },
      {
        question: 'Pourquoi les points forts changent selon les comparatifs ?',
        answer:
          'Chaque modèle fait des compromis différents sur vitesse, fidélité au prompt, réalisme du mouvement, durée et audio. Ces compromis expliquent pourquoi comparer le modèle vidéo IA avant de générer des vidéos fait gagner du temps et du budget.',
      },
      {
        question: 'Peut-on comparer des moteurs texte-vers-vidéo et image-vers-vidéo ?',
        answer:
          'Oui. Le hub inclut des matchups mixtes pour comparer des moteurs orientés prompt texte, image, ou hybrides. Oui - vous pouvez aussi inclure les moteurs vidéo-vers-vidéo quand ils sont disponibles.',
      },
      {
        question: 'Comment trancher entre deux moteurs proches ?',
        answer:
          'Commencez par les puces de cas d’usage, puis validez avec un test côte à côte. En cas d’égalité, lancez le même prompt texte simple (ou la même image de référence) et priorisez la fidélité au prompt, la régularité du mouvement et la vitesse de livraison selon votre format.',
      },
    ],
  },
  es: {
    hero: {
      title: 'Comparar motores de video con IA',
      intro:
        'Elige dos motores y abre una comparativa lado a lado con un clic. Usa este hub para revisar matchups útiles, filtrar por límites clave y validar precios antes de generar. Cubre texto a video, imagen a video y video a video, y te guía al motor más adecuado para tu toma.',
      compareNow: {
        left: 'Motor A',
        right: 'Motor B',
        compare: 'Comparar',
        searchPlaceholder: 'Buscar motor...',
        noResults: 'Sin resultados',
        strengthsLabel: 'Fortalezas',
        strengthsFallback: 'Uso general de video',
      },
    },
    sections: {
      popularTitle: 'Comparativas populares',
      popularIntro: 'Selección balanceada de matchups solicitados entre las principales familias de motores.',
      useCasesTitle: 'Comparar por caso de uso',
      useCasesIntro: 'Elige un objetivo y abre una comparativa recomendada.',
      enginesTitle: 'Elegir motores para comparar',
      enginesIntro: 'Solo especificaciones útiles para comparar. El detalle completo queda en cada página de modelo.',
      enginesToggle: 'Mostrar catálogo de motores ({count})',
      enginesToggleHintClosed: 'Haz clic para desplegar',
      enginesToggleHintOpen: 'Haz clic para plegar',
      allComparisonsTitle: 'Todas las comparativas',
      allComparisonsIntro:
        'Primero verás comparativas estratégicas, luego podrás buscar en el catálogo canónico completo. ¿Necesitas cumplimiento? Revisa nuestras notas.',
      faqTitle: 'FAQ de comparativas de motores de video con IA',
      complianceLabel: 'Ver notas de cumplimiento',
      quickStartLabel: 'Acceso rápido',
      useCasesFallback:
        'Los chips interactivos ajustan recomendaciones al instante. Todos los enlaces siguen siendo rastreables y visibles en HTML estándar.',
    },
    tagLabels: {
      audio: 'Audio',
      cinematic: 'Cinemático',
      quality: 'Mejor calidad',
      long: 'Larga duración',
      ads: 'Ads',
      product: 'Producto',
      value: 'Mejor costo',
      general: 'General',
      i2v: 'Imagen a video',
      social: 'Social',
      fast: 'Rápido',
      storyboards: 'Storyboards',
    },
    useCaseLabels: {
      cinematic: 'Cinemático',
      ads: 'Ads',
      social: 'Social',
      product: 'Producto',
      storyboards: 'Storyboards',
      audio: 'Audio',
      'no-audio': 'Sin audio',
      'best-value': 'Mejor costo',
      'best-quality': 'Mejor calidad',
      'text-to-video': 'Texto a video',
      'image-to-video': 'Imagen a video',
      'video-to-video': 'Video a video',
    },
    popularCompareLabel: 'Comparar',
    catalogLabels: {
      sortAll: 'Todos',
      filters: {
        mode: 'Modo',
        audio: 'Audio',
        duration: 'Duración',
        resolution: 'Resolución',
        status: 'Estado',
        provider: 'Proveedor',
        clear: 'Limpiar filtros',
      },
      options: {
        all: 'Todos',
        modeT2v: 'Texto a video',
        modeI2v: 'Imagen a video',
        modeV2v: 'Video a video',
        audioOn: 'Audio',
        audioOff: 'Sin audio',
        durationShort: '< 8s',
        durationMedium: '8-11s',
        durationLong: '12s+',
        resolution720: '720p+',
        resolution1080: '1080p+',
        resolution4k: '4K',
        statusLive: 'Live',
        statusEarly: 'Acceso anticipado',
      },
      specs: {
        modes: 'Modos',
        audio: 'Audio',
        status: 'Estado',
        duration: 'Duración máx',
        resolution: 'Resolución máx',
        yes: 'Sí',
        no: 'No',
        unknown: 'Sin dato',
        secondsSuffix: 's',
        statusLive: 'Live',
        statusEarly: 'Acceso anticipado',
      },
      ctas: {
        model: 'Página del modelo',
        compare: 'Comparar vs',
      },
      empty: 'No hay motores para estos filtros.',
    },
    listLabels: {
      searchPlaceholder: 'Buscar comparativas...',
      loadMore: 'Ver más',
      empty: 'No hay comparativas para esta búsqueda.',
    },
    faq: [
      {
        question: '¿Cómo comparo dos motores rápidamente?',
        answer:
          'Usa el widget Comparar de la parte superior, elige Motor A y Motor B, y haz clic en Comparar para abrir la página canónica. Usa el mismo prompt (o un prompt de texto simple) en ambos modelos de IA para comparar consistencia de movimiento y fidelidad al prompt antes de generar.',
      },
      {
        question: '¿Por qué cambian las fortalezas entre comparativas?',
        answer:
          'Cada modelo equilibra distinto velocidad, fidelidad al prompt, realismo de movimiento, duración y audio. Estas compensaciones explican por qué comparar el modelo de video con IA antes de generar videos ahorra tiempo y costo.',
      },
      {
        question: '¿Se pueden comparar motores de texto a video e imagen a video?',
        answer:
          'Sí. El hub incluye matchups mixtos para comparar motores orientados a texto, imagen o ambos. Sí - también puedes incluir motores de video a video cuando estén disponibles.',
      },
      {
        question: '¿Cómo elegir entre dos motores muy parecidos?',
        answer:
          'Empieza con los chips de caso de uso y valida con una prueba lado a lado. Si hay empate, ejecuta el mismo prompt de texto simple (o la misma imagen de referencia) y prioriza fidelidad al prompt, consistencia de movimiento y velocidad de entrega para tu formato final.',
      },
    ],
  },
};

function getCopy(locale: AppLocale): HubCopy {
  return HUB_COPY[locale] ?? HUB_COPY.en;
}

type EngineScoreRow = {
  modelSlug?: string;
  engineId?: string;
  fidelity?: number | null;
  motion?: number | null;
  consistency?: number | null;
};

function computeOverallFromScore(score?: EngineScoreRow | null) {
  if (!score) return null;
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

async function loadHubEngineScoreMap(): Promise<Map<string, number>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw) as { scores?: EngineScoreRow[] };
      const map = new Map<string, number>();
      (parsed.scores ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (!key) return;
        const overall = computeOverallFromScore(entry);
        if (overall != null) {
          map.set(key, overall);
        }
      });
      return map;
    } catch {
      // Try next candidate path.
    }
  }
  return new Map();
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'aiVideoEngines.meta' });

  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'compare',
    slugMap: COMPARE_SLUG_MAP,
    imageAlt: t('title'),
    ogType: 'website',
    keywords: ['AI video engines', 'AI video models', 'compare AI video generators', 'Sora vs Veo', 'MaxVideoAI'],
  });
}

export default async function AiVideoEnginesPage() {
  const { locale } = await resolveDictionary();
  const copy = getCopy(locale);
  const engines = getHubEngines();
  const scoreMap = await loadHubEngineScoreMap();

  const engineOptions = engines.map((engine) => ({ value: engine.modelSlug, label: engine.marketingName }));
  const popularComparisons = getPopularComparisons(engines).slice(0, 12);
  const useCaseBuckets = getUseCaseBuckets(engines).map((bucket) => ({
    id: bucket.id,
    label: copy.useCaseLabels[bucket.id] ?? bucket.id,
    pairs: bucket.pairs,
  }));

  const engineCards: EngineCatalogCard[] = engines.map((engine) => {
    const compareActions = getSuggestedOpponents(engine.modelSlug, engines, 3).map((opponent) => {
      return {
        slug: buildCanonicalCompareSlug(engine.modelSlug, opponent.modelSlug),
        label: opponent.marketingName,
      };
    });

    return {
      ...engine,
      compareActions,
    };
  });

  const allComparisonEntries = getRankedComparisonPairs(engines).map((pair) => ({
    slug: pair.slug,
    label: pair.label,
  }));
  const engineMetaBySlug = Object.fromEntries(
    engines.map((engine) => [
      engine.modelSlug,
      {
        overall: scoreMap.get(engine.modelSlug) ?? null,
        strengths: engine.bestFor ?? null,
      },
    ])
  );
  const defaultComparison = allComparisonEntries[0];
  const enginesToggleLabel = copy.sections.enginesToggle.replace('{count}', String(engineCards.length));

  const faqJsonLdEntries = copy.faq.slice(0, 5).map((entry) => ({
    question: entry.question,
    answer: entry.answer,
  }));

  return (
    <div className="container-page max-w-6xl section">
      <div className="stack-gap-lg">
        <section className="relative min-h-[56vh] overflow-hidden rounded-[30px] border border-hairline bg-surface shadow-card sm:min-h-[60vh]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(59,130,246,0.14)_0%,rgba(59,130,246,0.02)_45%,rgba(0,0,0,0)_70%)]" />
          <div className="relative z-10 flex h-full flex-col justify-center gap-6 p-5 sm:p-8 lg:p-10">
            <header className="stack-gap-sm text-center">
              <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{copy.hero.title}</h1>
              <p className="mx-auto max-w-4xl text-base leading-relaxed text-text-secondary">{copy.hero.intro}</p>
            </header>
            <CompareNowWidget
              options={engineOptions}
              defaultLeft="sora-2"
              defaultRight="veo-3-1"
              engineMetaBySlug={engineMetaBySlug}
              labels={copy.hero.compareNow}
              embedded
              className="rounded-2xl border border-hairline bg-surface/95 p-4 shadow-card sm:p-5"
            />
            {defaultComparison ? (
              <p className="text-center text-xs text-text-muted">
                {copy.sections.quickStartLabel}:{' '}
                <Link
                  href={{ pathname: '/ai-video-engines/[slug]', params: { slug: defaultComparison.slug } }}
                  className="font-semibold text-brand hover:text-brandHover"
                >
                  {defaultComparison.label}
                </Link>
                .
              </p>
            ) : null}
          </div>
        </section>

        <section className="stack-gap">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{copy.sections.popularTitle}</h2>
          <p className="text-sm text-text-secondary">{copy.sections.popularIntro}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {popularComparisons.map((comparison) => (
              <article key={comparison.slug} className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
                <h3 className="text-base font-semibold text-text-primary">
                  <Link
                    href={{ pathname: '/ai-video-engines/[slug]', params: { slug: comparison.slug } }}
                    prefetch={false}
                    className="hover:text-brandHover"
                  >
                    {comparison.label}
                  </Link>
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {comparison.tags.map((tag) => (
                    <span
                      key={`${comparison.slug}-${tag}`}
                      className="rounded-full border border-hairline bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-muted"
                    >
                      {copy.tagLabels[tag] ?? tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={{ pathname: '/ai-video-engines/[slug]', params: { slug: comparison.slug } }}
                  prefetch={false}
                  className="mt-3 inline-flex text-sm font-semibold text-brand hover:text-brandHover"
                >
                  {copy.popularCompareLabel}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="stack-gap">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{copy.sections.useCasesTitle}</h2>
          <p className="text-sm text-text-secondary">{copy.sections.useCasesIntro}</p>
          <p className="text-xs text-text-muted">{copy.sections.useCasesFallback}</p>
          <UseCaseExplorer buckets={useCaseBuckets} compareLabel={copy.popularCompareLabel} />
        </section>

        <section className="stack-gap">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{copy.sections.enginesTitle}</h2>
          <p className="text-sm text-text-secondary">{copy.sections.enginesIntro}</p>
          <details className="group rounded-2xl border border-hairline bg-surface p-4 shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-hairline bg-bg px-4 py-3 text-left transition hover:border-text-muted">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text-primary">{enginesToggleLabel}</span>
                <span className="block text-xs text-text-muted group-open:hidden">
                  {copy.sections.enginesToggleHintClosed}
                </span>
                <span className="hidden text-xs text-text-muted group-open:block">
                  {copy.sections.enginesToggleHintOpen}
                </span>
              </span>
              <span
                aria-hidden
                className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-text-secondary transition group-open:rotate-180"
              >
                ▼
              </span>
            </summary>
            <div className="mt-4">
              <EnginesCatalog cards={engineCards} labels={copy.catalogLabels} />
            </div>
          </details>
        </section>

        <section className="stack-gap">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{copy.sections.allComparisonsTitle}</h2>
          <p className="text-sm text-text-secondary">
            {copy.sections.allComparisonsIntro}{' '}
            <Link
              href={{ pathname: '/docs/[slug]', params: { slug: 'brand-safety' } }}
              className="font-semibold text-brand hover:text-brandHover"
            >
              {copy.sections.complianceLabel}
            </Link>
            .
          </p>
          <ComparisonsDirectory entries={allComparisonEntries} labels={copy.listLabels} />
        </section>

        <section className="stack-gap">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{copy.sections.faqTitle}</h2>
          <div className="stack-gap-sm text-base leading-relaxed text-text-secondary">
            {copy.faq.map((item) => (
              <article key={item.question} className="rounded-card border border-hairline bg-surface p-5 shadow-card">
                <h3 className="text-lg font-semibold text-text-primary">{item.question}</h3>
                <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <FAQSchema questions={faqJsonLdEntries} />
      </div>
    </div>
  );
}
