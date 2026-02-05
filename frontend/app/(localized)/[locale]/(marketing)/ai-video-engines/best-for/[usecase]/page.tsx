import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { locales } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getEntryBySlug } from '@/lib/content/markdown';
import engineCatalog from '@/config/engine-catalog.json';
import compareConfig from '@/config/compare-config.json';

interface Params {
  locale?: AppLocale;
  usecase: string;
}

interface BestForEntry {
  slug: string;
  title: string;
  tier: number;
  topPicks?: string[];
}

type EngineCatalogEntry = {
  engineId?: string;
  modelSlug: string;
  marketingName: string;
  provider?: string;
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

async function getBestForEntry(locale: AppLocale, slug: string) {
  const localized = await getEntryBySlug(`content/${locale}/best-for`, slug);
  if (localized) return localized;
  return getEntryBySlug('content/en/best-for', slug);
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
  const content = await getBestForEntry(locale, params.usecase);
  const availableLocales = await resolveAvailableLocales(params.usecase);
  const title = content?.title ?? entry?.title ?? 'Best for - MaxVideoAI';
  const description =
    content?.description ??
    (entry ? `Editorial guide to pick the best AI video engines for ${entry.title.toLowerCase()}.` : undefined) ??
    'Editorial guide to pick the best AI video engines by use case.';
  return buildSeoMetadata({
    locale,
    title: `${title} - MaxVideoAI`,
    description,
    englishPath: `/ai-video-engines/best-for/${params.usecase}`,
    availableLocales,
  });
}

export default async function BestForDetailPage({ params }: { params: Params }) {
  const entry = getEntry(params.usecase);
  if (!entry) {
    notFound();
  }
  const locale = params.locale ?? 'en';
  const scores = await loadEngineScores();
  const topPicks = resolveTopPicks(entry, scores);
  return (
    <div className="container-page max-w-4xl section">
      <div className="stack-gap-lg">
        <header className="stack-gap-sm">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Best for</p>
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{entry.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">
            Editorial guidance for picking the best AI video engines by use case.
          </p>
        </header>

        <section className="grid grid-gap sm:grid-cols-2">
          {topPicks.map((slug) => {
            const engine = ENGINE_BY_SLUG.get(slug);
            return (
              <article key={slug} className="rounded-card border border-hairline bg-surface p-5 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Top pick</p>
                <h2 className="mt-2 text-lg font-semibold text-text-primary">
                  {engine?.marketingName ?? slug}
                </h2>
                {engine?.provider ? <p className="text-sm text-text-secondary">{engine.provider}</p> : null}
                <Link
                  href={{ pathname: '/models/[slug]', params: { slug } }}
                  className="mt-3 inline-flex text-sm font-semibold text-brand hover:text-brandHover"
                >
                  View model -&gt;
                </Link>
              </article>
            );
          })}
        </section>

        <BestForContent locale={locale} slug={entry.slug} />

        <div className="text-sm text-text-muted">
          <Link
            href={{ pathname: '/ai-video-engines/best-for' }}
            className="font-semibold text-brand hover:text-brandHover"
          >
            Back to Best-for hub
          </Link>
        </div>
      </div>
    </div>
  );
}

async function BestForContent({ locale, slug }: { locale: AppLocale; slug: string }) {
  const content = await getBestForEntry(locale, slug);
  if (!content) {
    return (
      <div className="rounded-card border border-hairline bg-surface p-6 text-sm text-text-secondary shadow-card">
        Content coming soon.
      </div>
    );
  }

  return (
    <article className="rounded-card border border-hairline bg-surface p-6 shadow-card">
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
