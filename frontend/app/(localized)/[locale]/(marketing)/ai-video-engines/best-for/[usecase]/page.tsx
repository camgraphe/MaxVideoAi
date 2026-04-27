import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ArrowUp, Check, ChevronRight, PlayCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { defaultLocale, locales } from '@/i18n/locales';
import { getLocalizedUrl } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveLocalizedFallbackSeo } from '@/lib/seo/localizedFallback';
import { getContentEntries, getEntryBySlug, type ContentEntry } from '@/lib/content/markdown';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { EXAMPLES_HERO_SELECTION_LIMIT, pickFirstPlayableVideo } from '@/lib/examples/heroVideo';
import { listExampleFamilyPage } from '@/server/videos';
import engineCatalog from '@/config/engine-catalog.json';
import compareConfig from '@/config/compare-config.json';

interface Params {
  locale?: AppLocale;
  usecase: string;
}

interface BestForEntry {
  slug: string;
  title: string;
  description?: string;
  tier: number;
  topPicks?: string[];
  relatedComparisons?: string[];
}

type RelatedGuideEntry = BestForEntry & {
  displayTitle: string;
};

type EngineCatalogEntry = {
  engineId?: string;
  modelSlug: string;
  marketingName: string;
  provider?: string;
  brandId?: string;
  family?: string;
  bestFor?: string;
};

type EngineScore = {
  engineId?: string;
  modelSlug?: string;
  fidelity?: number;
  motion?: number;
  anatomy?: number;
  textRendering?: number;
  consistency?: number;
  lipsyncQuality?: number;
  sequencingQuality?: number;
};

type EngineScoresFile = {
  version?: string;
  last_updated?: string;
  scores?: EngineScore[];
};

const BEST_FOR_PAGES = compareConfig.bestForPages as BestForEntry[];
const ENGINE_CATALOG = engineCatalog as EngineCatalogEntry[];
const ENGINE_BY_SLUG = new Map(ENGINE_CATALOG.map((entry) => [entry.modelSlug, entry]));

const DETAIL_COPY: Record<
  AppLocale,
  {
    eyebrow: string;
    shortlist: string;
    shortlistDescription: string;
    ranked: string;
    rank: string;
    topPick: string;
    provider: string;
    fit: string;
    evidence: string;
    topReason: string;
    shortlistReason: string;
    viewModel: string;
    viewExamples: string;
    compareWith: string;
    compareShortlistCta: string;
    examplesCta: string;
    alsoAvailable: string;
    chooseTitle: string;
    examplesTitle: string;
    examplesDescription: string;
    whyTitle: string;
    mistakesTitle: string;
    fullAnalysis: string;
    relatedGuides: string;
    allGuides: string;
    score: string;
    overall: string;
    criteriaNote: string;
    compareShortlist: string;
    compareDescription: string;
    contentComing: string;
    backToHub: string;
    backToTop: string;
    criteria: string;
    quickLinks: string;
    tier: string;
    browseAllExamples: string;
  }
> = {
  en: {
    eyebrow: 'Best for',
    shortlist: 'Recommended shortlist',
    shortlistDescription: 'Model cards use the same visual language as the model pages, with the strongest engines shown first.',
    ranked: 'Ranked picks',
    rank: 'Rank',
    topPick: 'Top pick',
    provider: 'Provider',
    fit: 'Best fit',
    evidence: 'Why it fits',
    topReason: 'Primary recommendation for this search intent, based on the criteria above.',
    shortlistReason: 'Strong shortlist option when this criterion matters for the final video.',
    viewModel: 'View model',
    viewExamples: 'View examples',
    compareWith: 'Compare vs',
    compareShortlistCta: 'Compare the shortlist',
    examplesCta: 'View cinematic examples',
    alsoAvailable: 'Also available',
    chooseTitle: 'When should you choose each engine?',
    examplesTitle: 'Examples to review first',
    examplesDescription: 'Preview real output direction before making a decision.',
    whyTitle: 'Why these models rank here',
    mistakesTitle: 'Avoid these mistakes',
    fullAnalysis: 'Read the full analysis',
    relatedGuides: 'Related best-for guides',
    allGuides: 'View all guides',
    score: 'Score',
    overall: 'Best overall',
    criteriaNote: 'Scores combine quality, control, consistency, and cost efficiency.',
    compareShortlist: 'Compare the shortlist',
    compareDescription: 'Useful side-by-side pages for validating tradeoffs before picking a model.',
    contentComing: 'Content coming soon.',
    backToHub: 'Back to Best-for hub',
    backToTop: 'Back to top',
    criteria: 'Decision criteria',
    quickLinks: 'Quick links',
    tier: 'Tier',
    browseAllExamples: 'Browse all examples',
  },
  fr: {
    eyebrow: 'Meilleur pour',
    shortlist: 'Shortlist recommandée',
    shortlistDescription: 'Les cards reprennent le style des pages modèles, avec les moteurs les plus adaptés en premier.',
    ranked: 'Sélection classée',
    rank: 'Rang',
    topPick: 'Premier choix',
    provider: 'Fournisseur',
    fit: 'Meilleur usage',
    evidence: 'Pourquoi ça matche',
    topReason: 'Recommandation principale pour cette intention de recherche, d’après les critères ci-dessus.',
    shortlistReason: 'Option forte de la shortlist quand ce critère compte dans la vidéo finale.',
    viewModel: 'Voir le modèle',
    viewExamples: 'Voir les exemples',
    compareWith: 'Comparer avec',
    compareShortlistCta: 'Comparer la shortlist',
    examplesCta: 'Voir les exemples cinéma',
    alsoAvailable: 'Aussi disponible',
    chooseTitle: 'Quand choisir chaque moteur ?',
    examplesTitle: 'Exemples à vérifier d’abord',
    examplesDescription: 'Prévisualisez le rendu avant de choisir un moteur.',
    whyTitle: 'Pourquoi ces modèles sont classés ici',
    mistakesTitle: 'Erreurs à éviter',
    fullAnalysis: 'Lire l’analyse complète',
    relatedGuides: 'Guides Best-for liés',
    allGuides: 'Voir tous les guides',
    score: 'Score',
    overall: 'Meilleur choix',
    criteriaNote: 'Les scores combinent qualité, contrôle, cohérence et efficacité coût.',
    compareShortlist: 'Comparer la shortlist',
    compareDescription: 'Des pages côte à côte utiles pour valider les compromis avant de choisir un modèle.',
    contentComing: 'Contenu bientôt disponible.',
    backToHub: 'Retour au hub Best-for',
    backToTop: 'Retour en haut',
    criteria: 'Critères de décision',
    quickLinks: 'Liens rapides',
    tier: 'Niveau',
    browseAllExamples: 'Voir tous les exemples',
  },
  es: {
    eyebrow: 'Mejor para',
    shortlist: 'Shortlist recomendada',
    shortlistDescription: 'Las cards reutilizan el lenguaje visual de las páginas de modelos, con los motores más adecuados primero.',
    ranked: 'Selección ordenada',
    rank: 'Puesto',
    topPick: 'Primera opción',
    provider: 'Proveedor',
    fit: 'Mejor uso',
    evidence: 'Por qué encaja',
    topReason: 'Recomendación principal para esta intención de búsqueda, según los criterios anteriores.',
    shortlistReason: 'Opción fuerte de la shortlist cuando este criterio pesa en el video final.',
    viewModel: 'Ver modelo',
    viewExamples: 'Ver ejemplos',
    compareWith: 'Comparar con',
    compareShortlistCta: 'Comparar la shortlist',
    examplesCta: 'Ver ejemplos cinematográficos',
    alsoAvailable: 'También disponible',
    chooseTitle: '¿Cuándo elegir cada motor?',
    examplesTitle: 'Ejemplos para revisar primero',
    examplesDescription: 'Previsualiza la dirección del resultado antes de elegir un motor.',
    whyTitle: 'Por qué estos modelos están aquí',
    mistakesTitle: 'Evita estos errores',
    fullAnalysis: 'Leer el análisis completo',
    relatedGuides: 'Guías Best-for relacionadas',
    allGuides: 'Ver todas las guías',
    score: 'Puntuación',
    overall: 'Mejor opción',
    criteriaNote: 'Las puntuaciones combinan calidad, control, consistencia y eficiencia de costo.',
    compareShortlist: 'Comparar la shortlist',
    compareDescription: 'Páginas lado a lado útiles para validar compromisos antes de elegir modelo.',
    contentComing: 'Contenido próximamente.',
    backToHub: 'Volver al hub Best-for',
    backToTop: 'Volver arriba',
    criteria: 'Criterios de decisión',
    quickLinks: 'Enlaces rápidos',
    tier: 'Nivel',
    browseAllExamples: 'Ver todos los ejemplos',
  },
};

const USECASE_CRITERIA: Record<string, Record<AppLocale, string[]>> = {
  'image-to-video': {
    en: ['Image fidelity after motion', 'Camera control from a still', 'Clean product and subject preservation'],
    fr: ['Fidélité de l’image après mouvement', 'Contrôle caméra depuis une image fixe', 'Préservation propre du produit ou sujet'],
    es: ['Fidelidad de imagen tras el movimiento', 'Control de cámara desde una imagen fija', 'Preservación limpia del producto o sujeto'],
  },
  'cinematic-realism': {
    en: ['Camera language and lighting', 'Natural motion physics', 'High-end visual polish'],
    fr: ['Langage caméra et lumière', 'Physique du mouvement naturelle', 'Rendu visuel premium'],
    es: ['Lenguaje de cámara e iluminación', 'Física de movimiento natural', 'Pulido visual premium'],
  },
  'character-reference': {
    en: ['Stable identity', 'Wardrobe and prop retention', 'Reference-aware shot control'],
    fr: ['Identité stable', 'Tenue et accessoires conservés', 'Contrôle des plans par référence'],
    es: ['Identidad estable', 'Vestuario y accesorios consistentes', 'Control de planos con referencia'],
  },
  'reference-to-video': {
    en: ['Strong visual reference following', 'Flexible image or clip guidance', 'Good result with approved assets'],
    fr: ['Respect fort des références visuelles', 'Guidage flexible par image ou clip', 'Bon rendu depuis assets validés'],
    es: ['Seguimiento fuerte de referencias visuales', 'Guía flexible por imagen o clip', 'Buen resultado con assets aprobados'],
  },
  'multi-shot-video': {
    en: ['Several shots from one prompt', 'Sequence continuity', 'Edited-feeling final output'],
    fr: ['Plusieurs plans depuis un prompt', 'Continuité de séquence', 'Résultat final déjà monté'],
    es: ['Varios planos desde un prompt', 'Continuidad de secuencia', 'Resultado final con sensación de montaje'],
  },
  '4k-video': {
    en: ['Native or practical high resolution', 'Detail retention', 'Delivery-ready upscale path'],
    fr: ['Haute résolution native ou exploitable', 'Conservation du détail', 'Chemin clair vers une livraison finale'],
    es: ['Alta resolución nativa o práctica', 'Retención de detalle', 'Ruta clara hacia entrega final'],
  },
  ads: {
    en: ['Product clarity', 'Campaign-grade polish', 'Variation-friendly output'],
    fr: ['Clarté produit', 'Finition niveau campagne', 'Sorties faciles à décliner'],
    es: ['Claridad de producto', 'Acabado de campaña', 'Salida fácil de versionar'],
  },
  'ugc-ads': {
    en: ['Creator-style realism', 'Dialogue and social proof', 'Fast hook testing'],
    fr: ['Réalisme style créateur', 'Dialogue et preuve sociale', 'Tests rapides de hooks'],
    es: ['Realismo estilo creador', 'Diálogo y prueba social', 'Pruebas rápidas de hooks'],
  },
  'product-videos': {
    en: ['Packshot stability', 'Material and texture quality', 'Clean ecommerce motion'],
    fr: ['Stabilité packshot', 'Qualité matière et texture', 'Mouvement ecommerce propre'],
    es: ['Estabilidad de packshot', 'Calidad de materiales y textura', 'Movimiento ecommerce limpio'],
  },
  'lipsync-dialogue': {
    en: ['Mouth timing', 'Voice and native audio options', 'Face consistency'],
    fr: ['Timing bouche', 'Options voix et audio natif', 'Cohérence du visage'],
    es: ['Sincronía de boca', 'Opciones de voz y audio nativo', 'Consistencia facial'],
  },
  'fast-drafts': {
    en: ['Iteration speed', 'Low-cost variants', 'Enough control for review'],
    fr: ['Vitesse d’itération', 'Variantes à coût réduit', 'Contrôle suffisant pour valider'],
    es: ['Velocidad de iteración', 'Variantes de bajo costo', 'Control suficiente para revisar'],
  },
  'stylized-anime': {
    en: ['Stylized motion', 'Illustration coherence', 'Non-photoreal flexibility'],
    fr: ['Mouvement stylisé', 'Cohérence d’illustration', 'Flexibilité non photoréaliste'],
    es: ['Movimiento estilizado', 'Coherencia de ilustración', 'Flexibilidad no fotorrealista'],
  },
};

const USECASE_CHIPS: Record<string, Record<AppLocale, string[]>> = {
  'image-to-video': {
    en: ['Image fidelity', 'Motion control', 'Subject lock', 'Reference frames', 'Cost control'],
    fr: ['Fidélité image', 'Contrôle du mouvement', 'Sujet verrouillé', 'Frames de référence', 'Contrôle du coût'],
    es: ['Fidelidad de imagen', 'Control de movimiento', 'Sujeto estable', 'Frames de referencia', 'Control de costo'],
  },
  'cinematic-realism': {
    en: ['Camera language', 'Lighting', 'Motion physics', 'Visual polish', 'Cost control'],
    fr: ['Langage caméra', 'Lumière', 'Physique du mouvement', 'Rendu visuel', 'Contrôle du coût'],
    es: ['Lenguaje de cámara', 'Iluminación', 'Física del movimiento', 'Pulido visual', 'Control de costo'],
  },
  'character-reference': {
    en: ['Identity lock', 'Wardrobe', 'Props', 'Shot continuity', 'Input limits'],
    fr: ['Identité verrouillée', 'Tenue', 'Accessoires', 'Continuité des plans', 'Limites d’entrée'],
    es: ['Identidad estable', 'Vestuario', 'Props', 'Continuidad de planos', 'Límites de entrada'],
  },
  'reference-to-video': {
    en: ['References', 'Style frames', 'Audio cues', 'Product consistency', 'Output control'],
    fr: ['Références', 'Style frames', 'Repères audio', 'Cohérence produit', 'Contrôle du rendu'],
    es: ['Referencias', 'Style frames', 'Señales de audio', 'Consistencia de producto', 'Control de salida'],
  },
  'multi-shot-video': {
    en: ['Shot order', 'Continuity', 'Scene labels', 'Prompt structure', 'Final edit'],
    fr: ['Ordre des plans', 'Continuité', 'Labels de scène', 'Structure du prompt', 'Montage final'],
    es: ['Orden de planos', 'Continuidad', 'Etiquetas de escena', 'Estructura del prompt', 'Edición final'],
  },
  '4k-video': {
    en: ['Native 4K', 'Detail retention', 'Upscale path', 'Final delivery', 'Cost control'],
    fr: ['4K native', 'Détails conservés', 'Chemin upscale', 'Livraison finale', 'Contrôle du coût'],
    es: ['4K nativo', 'Retención de detalle', 'Ruta de upscale', 'Entrega final', 'Control de costo'],
  },
  ads: {
    en: ['Product clarity', 'Offer framing', 'Visual polish', 'Variant testing', 'Review speed'],
    fr: ['Clarté produit', 'Angle offre', 'Rendu propre', 'Tests de variantes', 'Vitesse de review'],
    es: ['Claridad de producto', 'Marco de oferta', 'Pulido visual', 'Pruebas de variantes', 'Velocidad de revisión'],
  },
  'ugc-ads': {
    en: ['Creator realism', 'Dialogue', 'Face consistency', 'Hook testing', 'Social proof'],
    fr: ['Réalisme créateur', 'Dialogue', 'Cohérence visage', 'Tests de hooks', 'Preuve sociale'],
    es: ['Realismo de creador', 'Diálogo', 'Consistencia facial', 'Pruebas de hooks', 'Prueba social'],
  },
  'product-videos': {
    en: ['Packshot stability', 'Textures', 'Clean reveals', 'Ecommerce motion', 'Brand fit'],
    fr: ['Stabilité packshot', 'Textures', 'Reveals propres', 'Mouvement ecommerce', 'Fit marque'],
    es: ['Estabilidad de packshot', 'Texturas', 'Reveals limpios', 'Movimiento ecommerce', 'Encaje de marca'],
  },
  'lipsync-dialogue': {
    en: ['Mouth timing', 'Voice sync', 'Face consistency', 'Audio options', 'Short dialogue'],
    fr: ['Timing bouche', 'Sync voix', 'Cohérence visage', 'Options audio', 'Dialogue court'],
    es: ['Timing de boca', 'Sync de voz', 'Consistencia facial', 'Opciones de audio', 'Diálogo corto'],
  },
  'fast-drafts': {
    en: ['Speed', 'Low cost', 'Rough timing', 'Variant testing', 'Review loop'],
    fr: ['Vitesse', 'Coût bas', 'Timing brouillon', 'Tests de variantes', 'Boucle de review'],
    es: ['Velocidad', 'Bajo costo', 'Timing preliminar', 'Pruebas de variantes', 'Ciclo de revisión'],
  },
  'stylized-anime': {
    en: ['Line quality', 'Style consistency', 'Color blocks', 'Stylized motion', 'Creative tests'],
    fr: ['Qualité du trait', 'Cohérence de style', 'Aplats de couleur', 'Mouvement stylisé', 'Tests créatifs'],
    es: ['Calidad de línea', 'Consistencia de estilo', 'Bloques de color', 'Movimiento estilizado', 'Pruebas creativas'],
  },
};

const DECISION_CRITERIA_FILLERS: Record<AppLocale, string[]> = {
  en: ['Cost efficiency and speed', 'Reliability and consistency'],
  fr: ['Efficacité coût et vitesse', 'Fiabilité et cohérence'],
  es: ['Eficiencia de costo y velocidad', 'Fiabilidad y consistencia'],
};

const USECASE_MISTAKE_FALLBACKS: Record<AppLocale, string[]> = {
  en: [
    'Choosing a model without matching the use case.',
    'Ignoring references, style frames, or input limits.',
    'Overcomplicating the first-pass prompt.',
    'Skipping draft passes and going straight to premium.',
    'Not checking cost before generation.',
  ],
  fr: [
    'Choisir un modèle sans matcher le cas d’usage.',
    'Ignorer les références, style frames ou limites d’input.',
    'Complexifier le prompt dès la première passe.',
    'Sauter les drafts et aller directement sur du premium.',
    'Ne pas vérifier le coût avant génération.',
  ],
  es: [
    'Elegir un modelo sin ajustar el caso de uso.',
    'Ignorar referencias, style frames o límites de entrada.',
    'Complicar demasiado el primer prompt.',
    'Saltar los borradores e ir directo a premium.',
    'No revisar el costo antes de generar.',
  ],
};

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];
  locales.forEach((locale) => {
    BEST_FOR_PAGES.forEach((entry) => {
      params.push({ locale, usecase: entry.slug });
    });
  });
  return params;
}

function getEntry(slug: string): BestForEntry | undefined {
  return BEST_FOR_PAGES.find((entry) => entry.slug === slug);
}

function buildComparisonLabel(slug: string) {
  const [leftSlug, rightSlug] = slug.split('-vs-');
  const left = leftSlug ? ENGINE_BY_SLUG.get(leftSlug)?.marketingName ?? leftSlug : slug;
  const right = rightSlug ? ENGINE_BY_SLUG.get(rightSlug)?.marketingName ?? rightSlug : '';
  return right ? `${left} vs ${right}` : slug;
}

async function getBestForEntry(locale: AppLocale, slug: string) {
  const localizedRoot = locale === defaultLocale ? 'content/en/best-for' : `content/${locale}/best-for`;
  const localized = await getEntryBySlug(localizedRoot, slug);
  if (localized) return localized;
  return getEntryBySlug('content/en/best-for', slug);
}

async function getLocalizedBestForEntry(locale: AppLocale, slug: string) {
  const localizedRoot = locale === defaultLocale ? 'content/en/best-for' : `content/${locale}/best-for`;
  return getEntryBySlug(localizedRoot, slug);
}

async function resolveAvailableLocales(slug: string): Promise<AppLocale[]> {
  const available = await Promise.all(
    locales.map(async (locale) => {
      const localized = await getEntryBySlug(`content/${locale}/best-for`, slug);
      if (localized) {
        return locale;
      }
      if (locale === 'en') {
        const fallback = await getEntryBySlug('content/en/best-for', slug);
        if (fallback) {
          return locale;
        }
      }
      return null;
    })
  );
  const filtered = available.filter((locale): locale is AppLocale => Boolean(locale));
  return filtered.length ? filtered : (['en'] as AppLocale[]);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  if (!BEST_FOR_PAGES.length) {
    notFound();
  }
  const locale = params.locale ?? 'en';
  const entry = getEntry(params.usecase);
  const localizedContent = await getLocalizedBestForEntry(locale, params.usecase);
  const content = localizedContent ?? (await getEntryBySlug('content/en/best-for', params.usecase));
  const title = getBestForDisplayTitle(locale, entry, content?.title);
  const description = entry
    ? buildBestForMetaDescription(locale, entry, content?.description)
    : 'Editorial guide to pick the best AI video engines by use case.';
  const seo = resolveLocalizedFallbackSeo({
    locale,
    hasLocalizedVersion: locale === defaultLocale || Boolean(localizedContent),
    englishPath: `/ai-video-engines/best-for/${params.usecase}`,
    availableLocales: await resolveAvailableLocales(params.usecase),
  });
  return buildSeoMetadata({
    locale,
    title,
    description,
    englishPath: `/ai-video-engines/best-for/${params.usecase}`,
    availableLocales: seo.availableLocales,
    canonicalOverride: seo.canonicalOverride,
    robots: seo.robots,
    keywords: entry ? buildBestForKeywords(locale, entry, title) : undefined,
  });
}

export default async function BestForDetailPage({ params }: { params: Params }) {
  const entry = getEntry(params.usecase);
  if (!entry) {
    notFound();
  }
  const locale = params.locale ?? 'en';
  const [content, scores, relatedGuides] = await Promise.all([
    getBestForEntry(locale, entry.slug),
    loadEngineScores(),
    resolveRelatedBestForGuides(locale, entry.slug),
  ]);
  const topPicks = resolveTopPicks(entry, scores);
  const copy = DETAIL_COPY[locale] ?? DETAIL_COPY.en;
  const criteria = getUsecaseCriteria(locale, entry.slug);
  const rankedPicks = topPicks.map((slug, index) =>
    buildRankedPick({
      usecaseSlug: entry.slug,
      modelSlug: slug,
      rank: index + 1,
      scores,
      criteria,
      copy,
      locale,
    })
  );
  const examplePicks = await resolveExamplePreviewPicks(rankedPicks);
  const heroTitle = getBestForDisplayTitle(locale, entry, content?.title);
  const heroDescription = buildBestForHeroDescription(locale, entry, content?.description);
  const chips = getUsecaseChips(locale, entry.slug, criteria);
  const alsoAvailable = getAlsoAvailableModels(entry.slug, topPicks);
  const canonicalUrl = getLocalizedUrl(locale, `/ai-video-engines/best-for/${entry.slug}`);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(locale, entry, heroTitle, canonicalUrl);
  const itemListJsonLd = buildBestForItemListJsonLd(rankedPicks, canonicalUrl);
  const webPageJsonLd = buildBestForWebPageJsonLd(heroTitle, heroDescription, canonicalUrl);

  return (
    <div id="top" className="container-page max-w-7xl section pt-8 sm:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageJsonLd) }} />

      <div className="space-y-12">
        <header className="space-y-8">
          <nav className="flex items-center gap-2 text-xs font-medium text-text-muted" aria-label="Breadcrumb">
            <Link href={{ pathname: '/ai-video-engines/best-for' }} className="transition hover:text-brand">
              {copy.eyebrow}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="text-text-secondary">{entry.slug.replace(/-/g, ' ')}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_456px] lg:items-start">
            <div className="max-w-4xl pt-2">
              <p className="text-xs font-semibold uppercase tracking-micro text-brand">{copy.eyebrow}</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-normal text-text-primary sm:text-5xl">
                {heroTitle}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-text-secondary">{heroDescription}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {chips.slice(0, 5).map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-sm"
                  >
                    <Check className="h-3.5 w-3.5 text-brand" aria-hidden />
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#compare-shortlist"
                  className="inline-flex items-center justify-center rounded-card bg-text-primary px-5 py-3 text-sm font-semibold text-surface shadow-card transition hover:-translate-y-0.5 hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  {copy.compareShortlistCta}
                </a>
                <a
                  href="#examples"
                  className="inline-flex items-center justify-center gap-2 rounded-card border border-hairline bg-surface px-5 py-3 text-sm font-semibold text-text-primary shadow-sm transition hover:-translate-y-0.5 hover:border-brand/35 hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  {copy.examplesCta}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>

            <TopPicksPanel
              entry={entry}
              picks={rankedPicks.slice(0, 3)}
              relatedComparisons={entry.relatedComparisons ?? []}
              locale={locale}
              copy={copy}
            />
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <main className="space-y-10">
            <section id="compare-shortlist" className="space-y-4" aria-labelledby="best-for-shortlist">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <h2 id="best-for-shortlist" className="text-2xl font-semibold text-text-primary">
                    {copy.shortlist}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{copy.shortlistDescription}</p>
                </div>
                <p className="max-w-md text-xs leading-relaxed text-text-muted">{copy.criteriaNote}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {rankedPicks.map((pick) => (
                  <RankedShortlistCard key={pick.slug} pick={pick} relatedComparisons={entry.relatedComparisons ?? []} copy={copy} />
                ))}
              </div>
              {alsoAvailable.length ? <AlsoAvailableRow models={alsoAvailable} copy={copy} /> : null}
            </section>

            <ChooseEngineStrip picks={rankedPicks} copy={copy} />
            <ExamplesPreview picks={examplePicks} copy={copy} />

            <section className="grid gap-3 lg:grid-cols-2">
              <EditorialReasonCard entry={entry} picks={rankedPicks} locale={locale} copy={copy} />
              <MistakesCard locale={locale} usecaseSlug={entry.slug} criteria={criteria} copy={copy} />
            </section>

            <BestForContent content={content} contentComing={copy.contentComing} />
          </main>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <CriteriaCard criteria={criteria} locale={locale} copy={copy} />
            <CompareCard comparisons={entry.relatedComparisons ?? []} copy={copy} />
            <RelatedGuidesCard guides={relatedGuides} copy={copy} />
            <QuickLinksCard copy={copy} />
          </aside>
        </div>
      </div>
      <a
        href="#top"
        className="fixed bottom-5 right-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/95 text-text-primary shadow-card backdrop-blur transition hover:border-brand/40 hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        aria-label={copy.backToTop}
      >
        <ArrowUp className="h-4 w-4" aria-hidden />
      </a>
    </div>
  );
}

type RankedPick = {
  slug: string;
  engine?: EngineCatalogEntry;
  rank: number;
  criterion: string;
  score?: number;
  accent: string;
  reason: string;
  bullets: string[];
};

type ExamplePreviewPick = RankedPick & {
  examplesSlug: string;
  heroThumbUrl?: string | null;
};

function TopPicksPanel({
  entry,
  picks,
  relatedComparisons,
  locale,
  copy,
}: {
  entry: BestForEntry;
  picks: RankedPick[];
  relatedComparisons: string[];
  locale: AppLocale;
  copy: (typeof DETAIL_COPY)[AppLocale];
}) {
  return (
    <section className="rounded-[18px] border border-hairline bg-surface p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-text-primary">{getTopPicksTitle(locale, entry.slug)}</h2>
        <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-xs font-semibold text-text-secondary">
          {copy.tier} {entry.tier}
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-[14px] border border-hairline">
        {picks.map((pick) => (
          <div key={pick.slug} className="grid grid-cols-[32px_42px_minmax(0,1fr)_58px] items-center gap-3 border-b border-hairline bg-surface px-3 py-3 last:border-b-0">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-text-primary text-xs font-semibold text-surface">
              {pick.rank}
            </span>
            <EngineIcon
              engine={{ id: pick.slug, label: pick.engine?.marketingName ?? pick.slug, brandId: pick.engine?.brandId }}
              size={36}
              rounded="xl"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{pick.engine?.marketingName ?? pick.slug}</p>
              <p className="truncate text-xs font-semibold text-brand">{pick.rank === 1 ? copy.overall : pick.criterion}</p>
              <p className="truncate text-xs text-text-secondary">{pick.reason}</p>
            </div>
            <div className="rounded-[12px] bg-brand/10 px-2 py-2 text-center">
              <p className="text-lg font-semibold tabular-nums text-brand">{formatScore(pick.score)}</p>
              <p className="text-[10px] text-text-muted">{copy.score}</p>
            </div>
          </div>
        ))}
      </div>
      <Link
        href={{ pathname: '/ai-video-engines/[slug]', params: { slug: pickComparisonSlug(picks, relatedComparisons) } }}
        className="mt-4 inline-flex items-center gap-2 px-1 text-sm font-semibold text-brand transition hover:text-brandHover"
      >
        {copy.compareShortlistCta}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function RankedShortlistCard({
  pick,
  relatedComparisons,
  copy,
}: {
  pick: RankedPick;
  relatedComparisons: string[];
  copy: (typeof DETAIL_COPY)[AppLocale];
}) {
  const compareSlug = findComparisonForPick(pick.slug, relatedComparisons);
  return (
    <article className="group flex min-h-[20rem] flex-col rounded-[14px] border border-hairline bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          {pick.rank === 1 ? copy.topPick : `${copy.rank} ${pick.rank}`}
        </span>
        <span className="grid h-12 w-12 place-items-center rounded-full border border-hairline bg-surface-2 text-base font-semibold tabular-nums text-text-primary">
          {formatScore(pick.score)}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-text-primary text-[11px] font-semibold text-surface">
          {pick.rank}
        </span>
        <EngineIcon
          engine={{ id: pick.slug, label: pick.engine?.marketingName ?? pick.slug, brandId: pick.engine?.brandId }}
          size={38}
          rounded="xl"
        />
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight text-text-primary">{pick.engine?.marketingName ?? pick.slug}</h3>
          <p className="truncate text-xs text-text-secondary">{pick.engine?.provider ?? copy.provider}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-micro text-brand">{copy.fit}</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-text-primary">{pick.criterion}</p>
        <div className="mt-3 h-px bg-hairline" />
        <ul className="mt-3 space-y-2">
          {pick.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 pt-5 text-xs font-semibold">
        <Link href={{ pathname: '/models/[slug]', params: { slug: pick.slug } }} className="text-brand transition hover:text-brandHover">
          {copy.viewModel} →
        </Link>
        <Link
          href={{ pathname: '/examples/[model]', params: { model: getExamplesSlug(pick) } }}
          className="text-brand transition hover:text-brandHover"
        >
          {copy.viewExamples} →
        </Link>
        {compareSlug ? (
          <Link href={{ pathname: '/ai-video-engines/[slug]', params: { slug: compareSlug } }} className="text-brand transition hover:text-brandHover">
            {copy.compareWith} →
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function AlsoAvailableRow({ models, copy }: { models: EngineCatalogEntry[]; copy: (typeof DETAIL_COPY)[AppLocale] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-hairline bg-surface-2 px-4 py-3">
      <p className="mr-1 text-xs font-semibold text-text-primary">{copy.alsoAvailable}:</p>
      {models.map((engine) => (
        <Link
          key={engine.modelSlug}
          href={{ pathname: '/models/[slug]', params: { slug: engine.modelSlug } }}
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:border-brand/30 hover:text-brand"
        >
          {engine.marketingName}
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      ))}
    </div>
  );
}

function ChooseEngineStrip({ picks, copy }: { picks: RankedPick[]; copy: (typeof DETAIL_COPY)[AppLocale] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-text-primary">{copy.chooseTitle}</h2>
      <div className="grid overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-sm md:grid-cols-2 xl:grid-cols-4">
        {picks.map((pick) => (
          <article key={pick.slug} className="border-b border-hairline p-4 last:border-b-0 md:border-r md:last:border-r-0 xl:border-b-0">
            <div className="flex items-center gap-3">
              <EngineIcon
                engine={{ id: pick.slug, label: pick.engine?.marketingName ?? pick.slug, brandId: pick.engine?.brandId }}
                size={36}
                rounded="xl"
              />
              <h3 className="font-semibold text-text-primary">{pick.engine?.marketingName ?? pick.slug}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">{pick.reason}</p>
            <p className="mt-4 inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              {pick.rank === 1 ? copy.overall : pick.criterion}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExamplesPreview({ picks, copy }: { picks: ExamplePreviewPick[]; copy: (typeof DETAIL_COPY)[AppLocale] }) {
  return (
    <section id="examples" className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">{copy.examplesTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.examplesDescription}</p>
        </div>
        <Link href={{ pathname: '/examples' }} className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brandHover">
          {copy.browseAllExamples}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {picks.map((pick) => (
          <Link
            key={pick.slug}
            href={{ pathname: '/examples/[model]', params: { model: pick.examplesSlug } }}
            className="group relative min-h-[116px] overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-sm"
          >
            <Image
              src={pick.heroThumbUrl ?? '/assets/placeholders/preview-16x9.png'}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1280px) 230px, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/42 to-black/8" aria-hidden />
            <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/92 via-black/68 to-transparent" aria-hidden />
            <span className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-text-primary shadow-sm">
              <PlayCircle className="h-5 w-5" aria-hidden />
            </span>
            <span className="absolute bottom-3 left-3 right-3 z-10 rounded-[10px] bg-black/42 px-3 py-2 shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-[2px]">
              <span className="block text-sm font-semibold leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
                {pick.engine?.marketingName ?? pick.slug}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
                {pick.criterion}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EditorialReasonCard({
  entry,
  picks,
  locale,
  copy,
}: {
  entry: BestForEntry;
  picks: RankedPick[];
  locale: AppLocale;
  copy: (typeof DETAIL_COPY)[AppLocale];
}) {
  return (
    <section className="rounded-[14px] border border-hairline bg-surface p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-text-primary">{copy.whyTitle}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-text-secondary">
        {picks.slice(0, 4).map((pick) => (
          <p key={pick.slug}>
            <strong className="font-semibold text-text-primary">{pick.engine?.marketingName ?? pick.slug}</strong>{' '}
            {buildReasonSentence(locale, entry.slug, pick)}
          </p>
        ))}
      </div>
      <a href="#full-analysis" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brandHover">
        {copy.fullAnalysis}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </a>
    </section>
  );
}

function MistakesCard({
  locale,
  usecaseSlug,
  criteria,
  copy,
}: {
  locale: AppLocale;
  usecaseSlug: string;
  criteria: string[];
  copy: (typeof DETAIL_COPY)[AppLocale];
}) {
  const mistakes = buildUsecaseMistakes(locale, usecaseSlug, criteria);
  return (
    <section className="rounded-[14px] border border-hairline bg-surface p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-text-primary">{copy.mistakesTitle}</h2>
      <ul className="mt-4 space-y-3">
        {mistakes.map((mistake) => (
          <li key={mistake} className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-text-primary/5 text-text-primary">
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>{mistake}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function buildUsecaseMistakes(locale: AppLocale, usecaseSlug: string, criteria: string[]) {
  const label = getUsecaseLabel(locale, usecaseSlug);
  const primary = criteria[0] ?? USECASE_MISTAKE_FALLBACKS[locale]?.[0] ?? USECASE_MISTAKE_FALLBACKS.en[0];
  const secondary = criteria[1] ?? USECASE_MISTAKE_FALLBACKS[locale]?.[1] ?? USECASE_MISTAKE_FALLBACKS.en[1];
  const tertiary = criteria[2] ?? USECASE_MISTAKE_FALLBACKS[locale]?.[2] ?? USECASE_MISTAKE_FALLBACKS.en[2];

  if (locale === 'fr') {
    return [
      `Choisir un moteur pour ${label} sans vérifier ${primary.toLowerCase()}.`,
      `Multiplier les références alors que ${secondary.toLowerCase()} doit rester prioritaire.`,
      `Passer directement au modèle premium avant d’avoir validé ${tertiary.toLowerCase()}.`,
      'Oublier de contrôler le coût avant de générer.',
      'Comparer seulement les fiches modèles sans ouvrir les exemples réels liés à ce cas d’usage.',
    ];
  }

  if (locale === 'es') {
    return [
      `Elegir un motor para ${label} sin comprobar ${primary.toLowerCase()}.`,
      `Añadir demasiadas referencias cuando ${secondary.toLowerCase()} debería ser la prioridad.`,
      `Pasar directo al modelo premium antes de validar ${tertiary.toLowerCase()}.`,
      'Olvidar revisar el coste antes de generar.',
      'Comparar solo fichas de modelos sin abrir ejemplos reales de este caso de uso.',
    ];
  }

  return [
    `Choosing an engine for ${label} without checking ${primary.toLowerCase()}.`,
    `Adding too many references when ${secondary.toLowerCase()} should stay primary.`,
    `Going straight to a premium model before validating ${tertiary.toLowerCase()}.`,
    'Forgetting to check the cost before generation.',
    'Comparing model pages only without opening real examples for this use case.',
  ];
}

function CriteriaCard({
  criteria,
  locale,
  copy,
}: {
  criteria: string[];
  locale: AppLocale;
  copy: (typeof DETAIL_COPY)[AppLocale];
}) {
  const filledCriteria = criteria.concat(DECISION_CRITERIA_FILLERS[locale] ?? DECISION_CRITERIA_FILLERS.en).slice(0, 5);
  return (
    <section className="rounded-[16px] border border-hairline bg-surface p-5 shadow-card">
      <p className="text-sm font-semibold text-text-primary">{copy.criteria}</p>
      <div className="mt-4 space-y-3">
        {filledCriteria.map((criterion, index) => (
          <div key={`${criterion}-${index}`} className="flex items-start gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/20 bg-brand/10 text-xs font-semibold text-brand">
              {index + 1}
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">{criterion}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompareCard({ comparisons, copy }: { comparisons: string[]; copy: (typeof DETAIL_COPY)[AppLocale] }) {
  if (!comparisons.length) return null;
  return (
    <section className="rounded-[16px] border border-hairline bg-surface p-5 shadow-card">
      <p className="text-sm font-semibold text-text-primary">{copy.compareShortlist}</p>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{copy.compareDescription}</p>
      <div className="mt-4 space-y-2">
        {comparisons.map((slug) => (
          <Link
            key={slug}
            href={{ pathname: '/ai-video-engines/[slug]', params: { slug } }}
            className="group flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface-2 px-3 py-3 text-sm font-semibold text-brand transition hover:border-brand/40 hover:text-brandHover"
          >
            <span>{buildComparisonLabel(slug)}</span>
            <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

function RelatedGuidesCard({ guides, copy }: { guides: RelatedGuideEntry[]; copy: (typeof DETAIL_COPY)[AppLocale] }) {
  return (
    <section className="rounded-[16px] border border-hairline bg-surface p-5 shadow-card">
      <p className="text-sm font-semibold text-text-primary">{copy.relatedGuides}</p>
      <div className="mt-4 space-y-3">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={{ pathname: '/ai-video-engines/best-for/[usecase]', params: { usecase: guide.slug } }}
            className="block text-sm font-semibold text-brand transition hover:text-brandHover"
          >
            {guide.displayTitle}
          </Link>
        ))}
      </div>
      <Link
        href={{ pathname: '/ai-video-engines/best-for' }}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brandHover"
      >
        {copy.allGuides}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function QuickLinksCard({ copy }: { copy: (typeof DETAIL_COPY)[AppLocale] }) {
  return (
    <section className="rounded-[16px] border border-hairline bg-surface p-5 shadow-card">
      <p className="text-sm font-semibold text-text-primary">{copy.quickLinks}</p>
      <div className="mt-4 grid gap-2">
        <Link
          href={{ pathname: '/ai-video-engines/best-for' }}
          className="rounded-card border border-hairline bg-surface-2 px-3 py-3 text-sm font-semibold text-brand transition hover:border-brand/40 hover:text-brandHover"
        >
          {copy.backToHub}
        </Link>
        <a
          href="#top"
          className="inline-flex items-center justify-center gap-2 rounded-card border border-hairline bg-surface-2 px-3 py-3 text-sm font-semibold text-text-primary transition hover:border-brand/40 hover:text-brandHover"
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
          {copy.backToTop}
        </a>
      </div>
    </section>
  );
}

function BestForContent({ content, contentComing }: { content: ContentEntry | null; contentComing: string }) {
  if (!content) {
    return (
      <div className="rounded-card border border-hairline bg-surface p-6 text-sm text-text-secondary shadow-card">
        {contentComing}
      </div>
    );
  }

  return (
    <article id="full-analysis" className="rounded-[16px] border border-hairline bg-surface p-6 shadow-card sm:p-8">
      <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: content.content }} />
    </article>
  );
}

async function loadEngineScores(): Promise<Map<string, EngineScore>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineScoresFile;
      const map = new Map<string, EngineScore>();
      (data.scores ?? []).forEach((entry) => {
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

const USECASE_WEIGHTS: Record<string, Partial<Record<keyof EngineScore, number>>> = {
  'ugc-ads': { motion: 0.3, fidelity: 0.25, consistency: 0.2, lipsyncQuality: 0.15, textRendering: 0.1 },
  'product-videos': { fidelity: 0.35, consistency: 0.25, anatomy: 0.2, motion: 0.1, textRendering: 0.1 },
  'lipsync-dialogue': { lipsyncQuality: 0.4, consistency: 0.2, fidelity: 0.2, motion: 0.1, anatomy: 0.1 },
  'cinematic-realism': { fidelity: 0.35, motion: 0.25, consistency: 0.2, anatomy: 0.1, textRendering: 0.1 },
  'fast-drafts': { motion: 0.3, consistency: 0.25, fidelity: 0.2, textRendering: 0.15, anatomy: 0.1 },
  'vertical-shorts': { motion: 0.3, consistency: 0.25, fidelity: 0.2, textRendering: 0.15, anatomy: 0.1 },
  'image-to-video': { consistency: 0.3, fidelity: 0.3, motion: 0.2, anatomy: 0.1, textRendering: 0.1 },
  'stylized-anime': { consistency: 0.3, motion: 0.25, fidelity: 0.2, textRendering: 0.15, anatomy: 0.1 },
  'character-reference': { consistency: 0.4, anatomy: 0.2, fidelity: 0.2, motion: 0.1, textRendering: 0.1 },
  'reference-to-video': { consistency: 0.35, fidelity: 0.3, motion: 0.2, anatomy: 0.1, textRendering: 0.05 },
  'multi-shot-video': { sequencingQuality: 0.35, consistency: 0.25, motion: 0.2, fidelity: 0.15, anatomy: 0.05 },
  '4k-video': { fidelity: 0.45, consistency: 0.25, motion: 0.15, anatomy: 0.1, textRendering: 0.05 },
  ads: { fidelity: 0.3, consistency: 0.25, textRendering: 0.2, motion: 0.15, anatomy: 0.1 },
};

function scoreEngineForUsecase(score: EngineScore, weights: Partial<Record<keyof EngineScore, number>>) {
  let total = 0;
  let weightSum = 0;
  Object.entries(weights).forEach(([key, weight]) => {
    const value = score[key as keyof EngineScore];
    if (typeof value === 'number' && typeof weight === 'number') {
      total += value * weight;
      weightSum += weight;
    }
  });
  if (weightSum === 0) return 0;
  return total / weightSum;
}

function resolveTopPicks(entry: BestForEntry, scores: Map<string, EngineScore>): string[] {
  if (entry.topPicks?.length) return entry.topPicks;
  const weights = USECASE_WEIGHTS[entry.slug] ?? {};
  const ranked = ENGINE_CATALOG.map((engine) => {
    const score = scores.get(engine.modelSlug) ?? (engine.engineId ? scores.get(engine.engineId) : null) ?? null;
    const value = score ? scoreEngineForUsecase(score, weights) : 0;
    return { slug: engine.modelSlug, value };
  })
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((entry) => entry.slug);
  return ranked.length ? ranked : ENGINE_CATALOG.slice(0, 3).map((engine) => engine.modelSlug);
}

function buildRankedPick({
  usecaseSlug,
  modelSlug,
  rank,
  scores,
  criteria,
  copy,
  locale,
}: {
  usecaseSlug: string;
  modelSlug: string;
  rank: number;
  scores: Map<string, EngineScore>;
  criteria: string[];
  copy: (typeof DETAIL_COPY)[AppLocale];
  locale: AppLocale;
}): RankedPick {
  const engine = ENGINE_BY_SLUG.get(modelSlug);
  const score = getFitScore(usecaseSlug, scores.get(modelSlug) ?? (engine?.engineId ? scores.get(engine.engineId) : undefined));
  const criterion = criteria[(rank - 1) % criteria.length] ?? criteria[0] ?? copy.fit;
  const fallbackScore = Math.max(6.8, 8.6 - rank * 0.22);
  return {
    slug: modelSlug,
    engine,
    rank,
    criterion,
    score: score ?? fallbackScore,
    accent: getEngineAccent(modelSlug),
    reason: buildPickReason(locale, usecaseSlug, criterion, rank),
    bullets: buildPickBullets(locale, criteria, rank),
  };
}

async function resolveExamplePreviewPicks(picks: RankedPick[]): Promise<ExamplePreviewPick[]> {
  const examplesSlugs = Array.from(new Set(picks.map((pick) => getExamplesSlug(pick))));
  const heroThumbEntries = await Promise.all(
    examplesSlugs.map(async (examplesSlug) => {
      try {
        const result = await listExampleFamilyPage(examplesSlug, {
          sort: 'playlist',
          limit: EXAMPLES_HERO_SELECTION_LIMIT,
          offset: 0,
        });
        const heroVideo = pickFirstPlayableVideo(result.items);
        return [examplesSlug, heroVideo?.thumbUrl ?? null] as const;
      } catch {
        return [examplesSlug, null] as const;
      }
    })
  );
  const heroThumbBySlug = new Map(heroThumbEntries);

  return picks.map((pick) => {
    const examplesSlug = getExamplesSlug(pick);
    return {
      ...pick,
      examplesSlug,
      heroThumbUrl: heroThumbBySlug.get(examplesSlug) ?? null,
    };
  });
}

function getBestForDisplayTitle(locale: AppLocale, entry?: BestForEntry, fallbackTitle?: string) {
  if (!entry) return fallbackTitle ?? 'Best AI video engines by use case';
  if (locale !== 'en') return fallbackTitle ?? entry.title;
  const intentLabels: Record<string, string> = {
    'image-to-video': 'image-to-video',
    'cinematic-realism': 'cinematic realism',
    'character-reference': 'character reference',
    'reference-to-video': 'reference-to-video',
    'multi-shot-video': 'multi-shot video',
    '4k-video': '4K video',
    ads: 'ads',
    'ugc-ads': 'UGC videos',
    'product-videos': 'product videos',
    'lipsync-dialogue': 'lip sync and dialogue',
    'fast-drafts': 'fast drafts',
    'stylized-anime': 'anime and stylized video',
  };
  return `Best AI video engines for ${intentLabels[entry.slug] ?? entry.title.replace(/^Best\s+/i, '').toLowerCase()}`;
}

function buildBestForHeroDescription(locale: AppLocale, entry: BestForEntry, fallbackDescription?: string) {
  if (locale !== 'en') return fallbackDescription ?? entry.description ?? 'Editorial guidance for picking the best AI video engines by use case.';
  const names = (entry.topPicks ?? []).slice(0, 3).map((slug) => ENGINE_BY_SLUG.get(slug)?.marketingName ?? slug);
  if (!names.length) return fallbackDescription ?? entry.description ?? 'Compare AI video engines before spending credits.';
  return `Compare ${formatList(names)} for ${entry.title.replace(/^Best\s+/i, '').replace(/\s+AI generator$/i, '').toLowerCase()} before spending credits.`;
}

function buildBestForMetaDescription(locale: AppLocale, entry: BestForEntry, fallbackDescription?: string) {
  if (locale !== 'en') return fallbackDescription ?? entry.description ?? 'Compare the best AI video engines by use case.';
  const names = (entry.topPicks ?? []).slice(0, 3).map((slug) => ENGINE_BY_SLUG.get(slug)?.marketingName ?? slug);
  const engineText = names.length ? ` Compare ${formatList(names)}` : ' Compare leading AI video engines';
  return `${fallbackDescription ?? entry.description ?? entry.title}.${engineText} by quality, control, consistency, cost, and workflow fit.`;
}

function buildBestForKeywords(locale: AppLocale, entry: BestForEntry, localizedTitle: string) {
  const engines = (entry.topPicks ?? []).map((slug) => ENGINE_BY_SLUG.get(slug)?.marketingName ?? slug);
  const genericKeyword =
    locale === 'fr'
      ? `${entry.slug.replace(/-/g, ' ')} générateur vidéo IA`
      : locale === 'es'
        ? `${entry.slug.replace(/-/g, ' ')} generador de video con IA`
        : `${entry.slug.replace(/-/g, ' ')} AI video generator`;
  return Array.from(
    new Set([
      localizedTitle,
      genericKeyword,
      ...engines,
      ...getUsecaseChips(locale, entry.slug, []),
    ])
  );
}

function formatList(items: string[]) {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function formatScore(score?: number) {
  return typeof score === 'number' && Number.isFinite(score) ? score.toFixed(1) : '-';
}

function buildPickReason(locale: AppLocale, usecaseSlug: string, criterion: string, rank: number) {
  const prefixes: Record<AppLocale, string[]> = {
    en: ['Best balance of', 'Strong option for', 'Useful when you need'],
    fr: ['Meilleur équilibre pour', 'Option forte pour', 'Utile si vous cherchez'],
    es: ['Mejor equilibrio para', 'Opción fuerte para', 'Útil si necesitas'],
  };
  const suffixes: Record<string, Record<AppLocale, string>> = {
    'cinematic-realism': {
      en: 'cinematic camera direction',
      fr: 'une direction caméra cinématique',
      es: 'dirección de cámara cinematográfica',
    },
    'character-reference': {
      en: 'stable identity across shots',
      fr: 'une identité stable entre les plans',
      es: 'identidad estable entre planos',
    },
    'reference-to-video': {
      en: 'controlled reference workflows',
      fr: 'des workflows de référence contrôlés',
      es: 'workflows de referencia controlados',
    },
    'multi-shot-video': {
      en: 'planned sequences',
      fr: 'des séquences planifiées',
      es: 'secuencias planificadas',
    },
    '4k-video': {
      en: 'final delivery detail',
      fr: 'le niveau de détail final',
      es: 'detalle para entrega final',
    },
    ads: {
      en: 'campaign-ready output',
      fr: 'un rendu prêt pour campagne',
      es: 'salidas listas para campaña',
    },
    'ugc-ads': {
      en: 'creator-style social clips',
      fr: 'des clips sociaux style créateur',
      es: 'clips sociales estilo creador',
    },
    'product-videos': {
      en: 'clean product storytelling',
      fr: 'un storytelling produit propre',
      es: 'storytelling de producto limpio',
    },
    'lipsync-dialogue': {
      en: 'speaking character control',
      fr: 'le contrôle de personnages parlants',
      es: 'control de personajes con diálogo',
    },
    'fast-drafts': {
      en: 'fast iteration loops',
      fr: 'des boucles d’itération rapides',
      es: 'ciclos rápidos de iteración',
    },
    'stylized-anime': {
      en: 'stylized motion',
      fr: 'du mouvement stylisé',
      es: 'movimiento estilizado',
    },
    'image-to-video': {
      en: 'motion from approved images',
      fr: 'l’animation depuis images validées',
      es: 'movimiento desde imágenes aprobadas',
    },
  };
  const prefix = prefixes[locale]?.[Math.min(rank - 1, 2)] ?? prefixes.en[Math.min(rank - 1, 2)];
  const suffix = suffixes[usecaseSlug]?.[locale] ?? suffixes[usecaseSlug]?.en ?? (locale === 'fr' ? 'ce cas d’usage' : locale === 'es' ? 'este caso de uso' : 'this use case');
  const connector = locale === 'en' ? 'for' : locale === 'es' ? 'en' : 'sur';
  return `${prefix} ${criterion.toLowerCase()} ${connector} ${suffix}.`;
}

function buildPickBullets(locale: AppLocale, criteria: string[], rank: number) {
  const primary = criteria[(rank - 1) % criteria.length] ?? criteria[0] ?? 'Use-case fit';
  const secondary = criteria[rank % criteria.length] ?? criteria[1] ?? 'Reliable output';
  const tertiary = criteria[(rank + 1) % criteria.length] ?? criteria[2] ?? 'Efficient review loop';
  const labels: Record<AppLocale, [string, string, string]> = {
    en: ['Strong', 'Good', 'Practical'],
    fr: ['Fort sur', 'Bon sur', 'Pratique pour'],
    es: ['Fuerte en', 'Bueno en', 'Práctico para'],
  };
  const [first, second, third] = labels[locale] ?? labels.en;
  return [`${first} ${primary.toLowerCase()}`, `${second} ${secondary.toLowerCase()}`, `${third} ${tertiary.toLowerCase()}`];
}

function pickComparisonSlug(picks: RankedPick[], relatedComparisons: string[]) {
  return relatedComparisons[0] ?? (picks.length >= 2 ? `${picks[0].slug}-vs-${picks[1].slug}` : 'seedance-2-0-vs-veo-3-1');
}

function findComparisonForPick(slug: string, relatedComparisons: string[]) {
  return relatedComparisons.find((comparison) => comparison.split('-vs-').includes(slug)) ?? relatedComparisons[0];
}

function getExamplesSlug(pick: RankedPick) {
  return pick.engine?.family ?? pick.slug;
}

function getTopPicksTitle(locale: AppLocale, slug: string) {
  const labels: Record<string, Record<AppLocale, string>> = {
    'cinematic-realism': {
      en: 'Top picks for cinematic shots',
      fr: 'Meilleurs choix pour plans cinéma',
      es: 'Mejores opciones para planos cinematográficos',
    },
    'character-reference': {
      en: 'Top picks for character reference',
      fr: 'Meilleurs choix pour character reference',
      es: 'Mejores opciones para character reference',
    },
    'reference-to-video': {
      en: 'Top picks for reference-to-video',
      fr: 'Meilleurs choix pour reference-to-video',
      es: 'Mejores opciones para reference-to-video',
    },
    'multi-shot-video': {
      en: 'Top picks for multi-shot video',
      fr: 'Meilleurs choix pour multi-shot',
      es: 'Mejores opciones para multi-shot',
    },
    '4k-video': {
      en: 'Top picks for 4K delivery',
      fr: 'Meilleurs choix pour livraison 4K',
      es: 'Mejores opciones para entrega 4K',
    },
    ads: {
      en: 'Top picks for ads',
      fr: 'Meilleurs choix pour publicités',
      es: 'Mejores opciones para anuncios',
    },
    'ugc-ads': {
      en: 'Top picks for UGC videos',
      fr: 'Meilleurs choix pour vidéos UGC',
      es: 'Mejores opciones para videos UGC',
    },
    'product-videos': {
      en: 'Top picks for product videos',
      fr: 'Meilleurs choix pour vidéos produit',
      es: 'Mejores opciones para videos de producto',
    },
    'lipsync-dialogue': {
      en: 'Top picks for dialogue',
      fr: 'Meilleurs choix pour dialogue',
      es: 'Mejores opciones para diálogo',
    },
    'fast-drafts': {
      en: 'Top picks for fast drafts',
      fr: 'Meilleurs choix pour drafts rapides',
      es: 'Mejores opciones para borradores rápidos',
    },
    'stylized-anime': {
      en: 'Top picks for stylized video',
      fr: 'Meilleurs choix pour vidéo stylisée',
      es: 'Mejores opciones para video estilizado',
    },
    'image-to-video': {
      en: 'Top picks for image-to-video',
      fr: 'Meilleurs choix image-to-video',
      es: 'Mejores opciones image-to-video',
    },
  };
  return labels[slug]?.[locale] ?? labels[slug]?.en ?? (locale === 'fr' ? 'Meilleurs choix' : locale === 'es' ? 'Mejores opciones' : 'Top picks');
}

function getRelatedBestForGuides(slug: string) {
  const relatedBySlug: Record<string, string[]> = {
    'cinematic-realism': ['fast-drafts', 'multi-shot-video', 'product-videos', 'character-reference', '4k-video'],
    'image-to-video': ['reference-to-video', 'product-videos', 'character-reference', 'ads'],
    'character-reference': ['reference-to-video', 'ugc-ads', 'multi-shot-video', 'product-videos'],
    'reference-to-video': ['image-to-video', 'character-reference', 'product-videos', 'ads'],
    'multi-shot-video': ['cinematic-realism', 'character-reference', 'ads', 'fast-drafts'],
    '4k-video': ['cinematic-realism', 'product-videos', 'ads', 'fast-drafts'],
    ads: ['ugc-ads', 'product-videos', 'cinematic-realism', 'reference-to-video'],
    'ugc-ads': ['ads', 'lipsync-dialogue', 'character-reference', 'fast-drafts'],
    'product-videos': ['ads', 'image-to-video', 'reference-to-video', '4k-video'],
    'lipsync-dialogue': ['ugc-ads', 'character-reference', 'cinematic-realism', 'fast-drafts'],
    'fast-drafts': ['cinematic-realism', 'ads', 'multi-shot-video', '4k-video'],
    'stylized-anime': ['fast-drafts', 'image-to-video', 'multi-shot-video', 'character-reference'],
  };
  const targets = relatedBySlug[slug] ?? BEST_FOR_PAGES.filter((entry) => entry.slug !== slug).slice(0, 4).map((entry) => entry.slug);
  return targets.map((target) => getEntry(target)).filter((entry): entry is BestForEntry => Boolean(entry)).slice(0, 5);
}

async function resolveRelatedBestForGuides(locale: AppLocale, slug: string): Promise<RelatedGuideEntry[]> {
  const guides = getRelatedBestForGuides(slug);
  const localizedRoot = locale === defaultLocale ? 'content/en/best-for' : `content/${locale}/best-for`;
  const [localizedEntries, englishEntries] = await Promise.all([
    getContentEntries(localizedRoot),
    locale === defaultLocale ? Promise.resolve([]) : getContentEntries('content/en/best-for'),
  ]);
  const localizedBySlug = new Map(localizedEntries.map((entry) => [entry.slug, entry]));
  const englishBySlug = new Map(englishEntries.map((entry) => [entry.slug, entry]));

  return guides.map((guide) => {
    const content = localizedBySlug.get(guide.slug) ?? englishBySlug.get(guide.slug);
    return {
      ...guide,
      displayTitle: content?.title ?? guide.title,
    };
  });
}

function getAlsoAvailableModels(slug: string, topPicks: string[]) {
  const preferred: Record<string, string[]> = {
    'cinematic-realism': ['ltx-2-3-fast', 'wan-2-6', 'pika-text-to-video'],
    'image-to-video': ['sora-2-pro', 'veo-3-1-fast', 'pika-text-to-video'],
    'character-reference': ['seedance-2-0', 'sora-2-pro', 'veo-3-1'],
    'reference-to-video': ['sora-2-pro', 'veo-3-1-fast', 'wan-2-6'],
    'multi-shot-video': ['ltx-2-3-pro', 'wan-2-6', 'pika-text-to-video'],
    '4k-video': ['kling-3-pro', 'veo-3-1', 'sora-2-pro'],
    ads: ['veo-3-1-fast', 'sora-2-pro', 'pika-text-to-video'],
    'ugc-ads': ['ltx-2-3-pro', 'veo-3-1-fast', 'pika-text-to-video'],
    'product-videos': ['kling-3-4k', 'veo-3-1-fast', 'pika-text-to-video'],
    'lipsync-dialogue': ['ltx-2-3-pro', 'sora-2', 'pika-text-to-video'],
    'fast-drafts': ['pika-text-to-video', 'minimax-hailuo-02-text', 'wan-2-6'],
    'stylized-anime': ['seedance-2-0', 'wan-2-6', 'ltx-2-3-fast'],
  };
  return (preferred[slug] ?? [])
    .filter((modelSlug) => !topPicks.includes(modelSlug))
    .map((modelSlug) => ENGINE_BY_SLUG.get(modelSlug))
    .filter((engine): engine is EngineCatalogEntry => Boolean(engine))
    .slice(0, 3);
}

function buildReasonSentence(locale: AppLocale, usecaseSlug: string, pick: RankedPick) {
  const usecaseLabel = getUsecaseLabel(locale, usecaseSlug);
  if (locale === 'fr') {
    return `est classé ici car il donne aux utilisateurs MaxVideoAI une route pratique vers ${pick.criterion.toLowerCase()}, tout en gardant le workflow adapté à ${usecaseLabel}.`;
  }
  if (locale === 'es') {
    return `está aquí porque da a los usuarios de MaxVideoAI una ruta práctica hacia ${pick.criterion.toLowerCase()}, manteniendo el workflow adecuado para ${usecaseLabel}.`;
  }
  return `ranks here because it gives MaxVideoAI users a practical route to ${pick.criterion.toLowerCase()} while keeping the workflow suitable for ${usecaseLabel}.`;
}

function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function buildBreadcrumbJsonLd(locale: AppLocale, entry: BestForEntry, title: string, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Best for',
        item: getLocalizedUrl(locale, '/ai-video-engines/best-for'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: title || entry.title,
        item: canonicalUrl,
      },
    ],
  };
}

function buildBestForItemListJsonLd(picks: RankedPick[], canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Ranked AI video engines for ${canonicalUrl.split('/').pop()?.replace(/-/g, ' ') ?? 'this use case'}`,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: picks.map((pick) => ({
      '@type': 'ListItem',
      position: pick.rank,
      name: pick.engine?.marketingName ?? pick.slug,
      url: getLocalizedUrl(defaultLocale, `/models/${pick.slug}`),
    })),
  };
}

function buildBestForWebPageJsonLd(title: string, description: string, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url: canonicalUrl,
    description,
  };
}

function getFitScore(slug: string, score?: EngineScore) {
  if (!score) return undefined;
  const weights = USECASE_WEIGHTS[slug] ?? {};
  const value = scoreEngineForUsecase(score, weights);
  return value > 0 ? value : undefined;
}

function getUsecaseCriteria(locale: AppLocale, slug: string) {
  return USECASE_CRITERIA[slug]?.[locale] ?? USECASE_CRITERIA[slug]?.en ?? USECASE_CRITERIA['image-to-video'].en;
}

function getUsecaseChips(locale: AppLocale, slug: string, fallback: string[]) {
  return USECASE_CHIPS[slug]?.[locale] ?? USECASE_CHIPS[slug]?.en ?? fallback;
}

function getUsecaseLabel(locale: AppLocale, slug: string) {
  const labels: Record<string, Record<AppLocale, string>> = {
    'cinematic-realism': { en: 'cinematic realism', fr: 'un rendu cinématique', es: 'realismo cinematográfico' },
    'character-reference': { en: 'character reference', fr: 'la character reference', es: 'character reference' },
    'reference-to-video': { en: 'reference-to-video', fr: 'le reference-to-video', es: 'reference-to-video' },
    'multi-shot-video': { en: 'multi-shot video', fr: 'la vidéo multi-shot', es: 'video multi-shot' },
    '4k-video': { en: '4K video', fr: 'la vidéo 4K', es: 'video 4K' },
    ads: { en: 'ads', fr: 'les publicités', es: 'anuncios' },
    'ugc-ads': { en: 'UGC videos', fr: 'les vidéos UGC', es: 'videos UGC' },
    'product-videos': { en: 'product videos', fr: 'les vidéos produit', es: 'videos de producto' },
    'lipsync-dialogue': { en: 'lip sync and dialogue', fr: 'le lip sync et le dialogue', es: 'lip sync y diálogo' },
    'fast-drafts': { en: 'fast drafts', fr: 'les drafts rapides', es: 'borradores rápidos' },
    'stylized-anime': { en: 'anime and stylized video', fr: 'la vidéo anime et stylisée', es: 'anime y video estilizado' },
    'image-to-video': { en: 'image-to-video', fr: 'l’image-to-video', es: 'image-to-video' },
  };
  return labels[slug]?.[locale] ?? labels[slug]?.en ?? slug.replace(/-/g, ' ');
}

function getEngineAccent(slug: string) {
  if (slug.includes('kling')) return '#7c3aed';
  if (slug.includes('seedance')) return '#0ea5e9';
  if (slug.includes('veo')) return '#22c55e';
  if (slug.includes('sora')) return '#111827';
  if (slug.includes('ltx')) return '#f59e0b';
  if (slug.includes('pika')) return '#ec4899';
  if (slug.includes('minimax')) return '#f97316';
  if (slug.includes('wan')) return '#6366f1';
  return '#6366f1';
}
