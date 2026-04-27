import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { CSSProperties } from 'react';
import { ArrowUp, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { defaultLocale, locales } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveLocalizedFallbackSeo } from '@/lib/seo/localizedFallback';
import { getEntryBySlug } from '@/lib/content/markdown';
import { EngineIcon } from '@/components/ui/EngineIcon';
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

type EngineCatalogEntry = {
  engineId?: string;
  modelSlug: string;
  marketingName: string;
  provider?: string;
  brandId?: string;
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
    compareShortlist: string;
    compareDescription: string;
    contentComing: string;
    backToHub: string;
    backToTop: string;
    criteria: string;
    quickLinks: string;
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
    compareShortlist: 'Compare the shortlist',
    compareDescription: 'Useful side-by-side pages for validating tradeoffs before picking a model.',
    contentComing: 'Content coming soon.',
    backToHub: 'Back to Best-for hub',
    backToTop: 'Back to top',
    criteria: 'Decision criteria',
    quickLinks: 'Quick links',
  },
  fr: {
    eyebrow: 'Meilleur pour',
    shortlist: 'Shortlist recommandée',
    shortlistDescription: 'Les cards reprennent le style des pages modèles, avec les moteurs les plus adaptés en premier.',
    ranked: 'Sélection classée',
    rank: 'Rang',
    topPick: 'Top pick',
    provider: 'Fournisseur',
    fit: 'Meilleur usage',
    evidence: 'Pourquoi ça matche',
    topReason: 'Recommandation principale pour cette intention de recherche, d’après les critères ci-dessus.',
    shortlistReason: 'Option forte de la shortlist quand ce critère compte dans la vidéo finale.',
    viewModel: 'Voir le modèle',
    compareShortlist: 'Comparer la shortlist',
    compareDescription: 'Des pages côte à côte utiles pour valider les compromis avant de choisir un modèle.',
    contentComing: 'Contenu bientôt disponible.',
    backToHub: 'Retour au hub Best-for',
    backToTop: 'Retour en haut',
    criteria: 'Critères de décision',
    quickLinks: 'Liens rapides',
  },
  es: {
    eyebrow: 'Mejor para',
    shortlist: 'Shortlist recomendada',
    shortlistDescription: 'Las cards reutilizan el lenguaje visual de las páginas de modelos, con los motores más adecuados primero.',
    ranked: 'Selección ordenada',
    rank: 'Puesto',
    topPick: 'Top pick',
    provider: 'Proveedor',
    fit: 'Mejor uso',
    evidence: 'Por qué encaja',
    topReason: 'Recomendación principal para esta intención de búsqueda, según los criterios anteriores.',
    shortlistReason: 'Opción fuerte de la shortlist cuando este criterio pesa en el video final.',
    viewModel: 'Ver modelo',
    compareShortlist: 'Comparar la shortlist',
    compareDescription: 'Páginas lado a lado útiles para validar compromisos antes de elegir modelo.',
    contentComing: 'Contenido próximamente.',
    backToHub: 'Volver al hub Best-for',
    backToTop: 'Volver arriba',
    criteria: 'Criterios de decisión',
    quickLinks: 'Enlaces rápidos',
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
  const available: AppLocale[] = [];
  for (const locale of locales) {
    const localized = await getEntryBySlug(`content/${locale}/best-for`, slug);
    if (localized) {
      available.push(locale);
      continue;
    }
    if (locale === 'en') {
      const fallback = await getEntryBySlug('content/en/best-for', slug);
      if (fallback) {
        available.push(locale);
      }
    }
  }
  return available.length ? available : (['en'] as AppLocale[]);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  if (!BEST_FOR_PAGES.length) {
    notFound();
  }
  const locale = params.locale ?? 'en';
  const entry = getEntry(params.usecase);
  const localizedContent = await getLocalizedBestForEntry(locale, params.usecase);
  const content = localizedContent ?? (await getEntryBySlug('content/en/best-for', params.usecase));
  const title = content?.title ?? entry?.title ?? 'Best for - MaxVideoAI';
  const description =
    content?.description ??
    (entry ? `Editorial guide to pick the best AI video engines for ${entry.title.toLowerCase()}.` : undefined) ??
    'Editorial guide to pick the best AI video engines by use case.';
  const seo = resolveLocalizedFallbackSeo({
    locale,
    hasLocalizedVersion: locale === defaultLocale || Boolean(localizedContent),
    englishPath: `/ai-video-engines/best-for/${params.usecase}`,
    availableLocales: await resolveAvailableLocales(params.usecase),
  });
  return buildSeoMetadata({
    locale,
    title: `${title} - MaxVideoAI`,
    description,
    englishPath: `/ai-video-engines/best-for/${params.usecase}`,
    availableLocales: seo.availableLocales,
    canonicalOverride: seo.canonicalOverride,
    robots: seo.robots,
  });
}

export default async function BestForDetailPage({ params }: { params: Params }) {
  const entry = getEntry(params.usecase);
  if (!entry) {
    notFound();
  }
  const locale = params.locale ?? 'en';
  const content = await getBestForEntry(locale, entry.slug);
  const scores = await loadEngineScores();
  const topPicks = resolveTopPicks(entry, scores);
  const copy = DETAIL_COPY[locale] ?? DETAIL_COPY.en;
  const criteria = getUsecaseCriteria(locale, entry.slug);
  return (
    <div id="top" className="container-page max-w-7xl section">
      <div className="stack-gap-lg">
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div className="stack-gap-sm">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.eyebrow}</p>
            <h1 className="max-w-4xl text-3xl font-semibold text-text-primary sm:text-5xl">
              {content?.title ?? entry.title}
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-text-secondary">
              {content?.description ?? entry.description ?? 'Editorial guidance for picking the best AI video engines by use case.'}
            </p>
          </div>
          <BestForHeroPanel entry={entry} topPicks={topPicks} criteria={criteria} copy={copy} />
        </header>

        <section className="stack-gap-sm" aria-labelledby="best-for-shortlist">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.ranked}</p>
              <h2 id="best-for-shortlist" className="mt-2 text-2xl font-semibold text-text-primary">
                {copy.shortlist}
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-text-secondary">{copy.shortlistDescription}</p>
          </div>
          <div className="grid grid-gap sm:grid-cols-2 xl:grid-cols-4">
          {topPicks.map((slug) => {
            const engine = ENGINE_BY_SLUG.get(slug);
            const fitScore = getFitScore(entry.slug, scores.get(slug) ?? (engine?.engineId ? scores.get(engine.engineId) : undefined));
            return (
              <BestForModelCard
                key={slug}
                slug={slug}
                engine={engine}
                rank={topPicks.indexOf(slug) + 1}
                fitScore={fitScore}
                criterion={criteria[topPicks.indexOf(slug) % criteria.length]}
                copy={copy}
              />
            );
          })}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <BestForContent locale={locale} slug={entry.slug} contentComing={copy.contentComing} />
          <aside className="stack-gap-sm lg:sticky lg:top-24">
            <section className="rounded-[16px] border border-hairline bg-surface bg-[image:linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.92))] p-5 shadow-card dark:bg-[image:linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))]">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.criteria}</p>
              <div className="mt-4 space-y-3">
                {criteria.map((criterion, index) => (
                  <div key={criterion} className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-brand/20 bg-brand/10 text-xs font-semibold text-brand">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-text-secondary">{criterion}</p>
                  </div>
                ))}
              </div>
            </section>

            {entry.relatedComparisons?.length ? (
              <section className="rounded-[16px] border border-hairline bg-surface p-5 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.compareShortlist}</p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{copy.compareDescription}</p>
                <div className="mt-4 space-y-2">
                  {entry.relatedComparisons.map((slug) => (
                    <Link
                      key={slug}
                      href={{ pathname: '/ai-video-engines/[slug]', params: { slug } }}
                      className="group flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface-2 px-3 py-3 text-sm font-semibold text-text-primary transition hover:border-brand/40 hover:text-brandHover"
                    >
                      <span>{buildComparisonLabel(slug)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[16px] border border-hairline bg-surface p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.quickLinks}</p>
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

function BestForHeroPanel({
  entry,
  topPicks,
  criteria,
  copy,
}: {
  entry: BestForEntry;
  topPicks: string[];
  criteria: string[];
  copy: (typeof DETAIL_COPY)[AppLocale];
}) {
  return (
    <div className="relative isolate overflow-hidden rounded-[20px] border border-hairline bg-surface bg-[image:radial-gradient(circle_at_18%_18%,rgba(99,102,241,0.18),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.86))] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:bg-[image:radial-gradient(circle_at_18%_18%,rgba(129,140,248,0.18),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))]">
      <span className="pointer-events-none absolute inset-px rounded-[19px] border border-white/70 dark:border-white/[0.05]" aria-hidden />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.ranked}</p>
          <span className="rounded-full border border-hairline bg-surface/80 px-3 py-1 text-xs font-semibold text-text-secondary">
            Tier {entry.tier}
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {topPicks.slice(0, 3).map((slug, index) => {
            const engine = ENGINE_BY_SLUG.get(slug);
            return (
              <div
                key={slug}
                className="flex items-center gap-3 rounded-[14px] border border-hairline bg-surface/82 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.045)] backdrop-blur"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-text-primary text-xs font-semibold text-surface">
                  {index + 1}
                </span>
                <EngineIcon
                  engine={{ id: slug, label: engine?.marketingName ?? slug, brandId: engine?.brandId }}
                  size={44}
                  rounded="xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">{engine?.marketingName ?? slug}</p>
                  <p className="text-xs leading-snug text-text-secondary">{criteria[index % criteria.length]}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {criteria.map((criterion, index) => (
            <div key={criterion} className="min-h-[88px] rounded-[14px] border border-hairline bg-surface/74 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">0{index + 1}</p>
              <p className="mt-2 text-xs leading-snug text-text-secondary">{criterion}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BestForModelCard({
  slug,
  engine,
  rank,
  fitScore,
  criterion,
  copy,
}: {
  slug: string;
  engine?: EngineCatalogEntry;
  rank: number;
  fitScore?: number;
  criterion: string;
  copy: (typeof DETAIL_COPY)[AppLocale];
}) {
  const accent = getEngineAccent(slug);
  const style = buildBestForCardStyle(accent);
  const scoreLabel = typeof fitScore === 'number' && fitScore > 0 ? fitScore.toFixed(1) : null;

  return (
    <article
      className="group relative isolate flex min-h-[23rem] flex-col overflow-hidden rounded-[16px] border border-hairline bg-surface bg-[image:var(--best-card-surface)] p-5 text-text-primary shadow-[0_18px_44px_rgba(15,23,42,0.055),0_4px_12px_rgba(15,23,42,0.025)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--best-card-border-hover)] hover:shadow-[0_24px_52px_rgba(15,23,42,0.085),0_8px_20px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[image:var(--best-card-surface-dark)] dark:text-white dark:hover:border-[color:var(--best-card-border-hover-dark)]"
      style={style}
    >
      <span className="pointer-events-none absolute inset-px rounded-[15px] border border-white/75 opacity-80 dark:border-white/[0.04]" aria-hidden />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full border border-[color:var(--best-chip-border)] bg-[color:var(--best-chip-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--best-chip-text)] dark:border-[color:var(--best-chip-border-dark)] dark:bg-[color:var(--best-chip-bg-dark)] dark:text-[color:var(--best-chip-text-dark)]">
            {rank === 1 ? copy.topPick : `${copy.rank} ${rank}`}
          </span>
          {scoreLabel ? (
            <div className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full border border-hairline bg-surface shadow-sm">
              <span className="text-lg font-semibold tabular-nums text-text-primary">{scoreLabel}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <EngineIcon
            engine={{ id: slug, label: engine?.marketingName ?? slug, brandId: engine?.brandId }}
            size={54}
            rounded="xl"
          />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-text-primary">{engine?.marketingName ?? slug}</h3>
            <p className="mt-1 text-sm text-text-secondary">{engine?.provider ?? copy.provider}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 rounded-[14px] border border-[color:var(--best-panel-border)] bg-[image:var(--best-panel-bg)] p-4 dark:border-[color:var(--best-panel-border-dark)] dark:bg-[image:var(--best-panel-bg-dark)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{copy.fit}</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-text-primary">{criterion}</p>
          </div>
          <div className="h-px bg-[color:var(--best-divider)] dark:bg-[color:var(--best-divider-dark)]" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{copy.evidence}</p>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              {rank === 1 ? copy.topReason : copy.shortlistReason}
            </p>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <Link
            href={{ pathname: '/models/[slug]', params: { slug } }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brandHover"
          >
            {copy.viewModel}
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

async function BestForContent({ locale, slug, contentComing }: { locale: AppLocale; slug: string; contentComing: string }) {
  const content = await getBestForEntry(locale, slug);
  if (!content) {
    return (
      <div className="rounded-card border border-hairline bg-surface p-6 text-sm text-text-secondary shadow-card">
        {contentComing}
      </div>
    );
  }

  return (
    <article className="rounded-[16px] border border-hairline bg-surface p-6 shadow-card sm:p-8">
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

function getFitScore(slug: string, score?: EngineScore) {
  if (!score) return undefined;
  const weights = USECASE_WEIGHTS[slug] ?? {};
  const value = scoreEngineForUsecase(score, weights);
  return value > 0 ? value : undefined;
}

function getUsecaseCriteria(locale: AppLocale, slug: string) {
  return USECASE_CRITERIA[slug]?.[locale] ?? USECASE_CRITERIA[slug]?.en ?? USECASE_CRITERIA['image-to-video'].en;
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

function buildBestForCardStyle(accent: string): CSSProperties {
  return {
    '--best-card-surface': `linear-gradient(180deg, color-mix(in srgb, ${accent} 1%, #ffffff 99%) 0%, color-mix(in srgb, ${accent} 2%, #fbfdff 98%) 100%)`,
    '--best-card-surface-dark': `linear-gradient(180deg, color-mix(in srgb, ${accent} 5%, var(--surface) 95%) 0%, var(--surface-3) 100%)`,
    '--best-card-border-hover': `color-mix(in srgb, ${accent} 14%, #dbe4ee 86%)`,
    '--best-card-border-hover-dark': `color-mix(in srgb, ${accent} 22%, #334155 78%)`,
    '--best-chip-bg': `color-mix(in srgb, ${accent} 3%, white 97%)`,
    '--best-chip-bg-dark': `color-mix(in srgb, ${accent} 8%, #0f172a 92%)`,
    '--best-chip-border': `color-mix(in srgb, ${accent} 24%, #d8dfeb 76%)`,
    '--best-chip-border-dark': `color-mix(in srgb, ${accent} 16%, #334155 84%)`,
    '--best-chip-text': `color-mix(in srgb, ${accent} 36%, #1f2937 64%)`,
    '--best-chip-text-dark': `color-mix(in srgb, ${accent} 18%, #f8fafc 82%)`,
    '--best-panel-bg': `linear-gradient(180deg, color-mix(in srgb, ${accent} 1%, #ffffff 99%) 0%, color-mix(in srgb, ${accent} 2%, #f8fafc 98%) 100%)`,
    '--best-panel-bg-dark': 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)',
    '--best-panel-border': `color-mix(in srgb, ${accent} 9%, #dbe4ee 91%)`,
    '--best-panel-border-dark': `color-mix(in srgb, ${accent} 15%, #334155 85%)`,
    '--best-divider': `color-mix(in srgb, ${accent} 8%, #d7dee8 92%)`,
    '--best-divider-dark': `color-mix(in srgb, ${accent} 16%, #334155 84%)`,
  } as CSSProperties;
}
