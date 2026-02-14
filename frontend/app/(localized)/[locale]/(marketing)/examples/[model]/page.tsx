import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { MARKETING_EXAMPLE_SLUGS } from '@/config/navigation';
import { localePathnames, locales, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { listExamples } from '@/server/videos';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { getExampleModelLanding } from '@/lib/examples/modelLanding';
import ExamplesPage, { resolveEngineLabel } from '../page';

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || SITE_BASE_URL;
const EXAMPLE_MODEL_SLUG_SET = new Set(MARKETING_EXAMPLE_SLUGS.map((slug) => slug.toLowerCase()));
const DEFAULT_SORT = 'playlist';
const GALLERY_SLUG_MAP = buildSlugMap('gallery');

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 60;
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) => MARKETING_EXAMPLE_SLUGS.map((model) => ({ locale, model })));
}

function normalizeExampleSlug(value: string): string {
  return value.trim().toLowerCase();
}

function toAbsoluteUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

function buildExamplesHref(
  locale: AppLocale,
  slug: string,
  searchParams?: Record<string, string | string[] | undefined>
): string {
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const segment = GALLERY_SLUG_MAP[locale] ?? GALLERY_SLUG_MAP.en ?? 'examples';
  const basePath = `${prefix}/${segment}/${slug}`.replace(/\/{2,}/g, '/');
  if (!searchParams) return basePath;
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string' && entry.length) params.append(key, entry);
      });
      return;
    }
    if (typeof value === 'string' && value.length) {
      params.set(key, value);
    }
  });
  const suffix = params.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

function shouldNoindex(searchParams: Record<string, string | string[] | undefined>): boolean {
  const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const hasNonDefaultSort =
    typeof sortParam === 'string' && sortParam.trim().length > 0 && sortParam !== DEFAULT_SORT;
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const pageValue = typeof pageParam === 'string' ? Number.parseInt(pageParam, 10) : NaN;
  const hasPage = Number.isFinite(pageValue) && pageValue > 1;
  return hasNonDefaultSort || hasPage;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: AppLocale; model: string };
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const normalized = normalizeExampleSlug(params.model);
  if (!EXAMPLE_MODEL_SLUG_SET.has(normalized)) {
    notFound();
  }
  const canonical = resolveExampleCanonicalSlug(normalized) ?? normalized;
  const modelLanding = getExampleModelLanding(params.locale, canonical);
  const engineLabel = resolveEngineLabel(normalized);
  const title = modelLanding?.metaTitle ?? (engineLabel ? `${engineLabel} AI Video Examples | MaxVideoAI` : 'AI Video Examples | MaxVideoAI');
  const description =
    modelLanding?.metaDescription ??
    (engineLabel
      ? `Explore ${engineLabel} examples with prompts, settings, and per-clip pricing on MaxVideoAI.`
      : 'Explore AI video examples with prompts, settings, and per-clip pricing on MaxVideoAI.');
  const latest = await listExamples('date-desc', 20);
  const firstWithThumb = latest.find((video) => Boolean(video.thumbUrl));
  const ogImage = toAbsoluteUrl(firstWithThumb?.thumbUrl) ?? `${SITE}/og/price-before.png`;
  const noindex = shouldNoindex(searchParams ?? {});

  return buildSeoMetadata({
    locale: params.locale,
    title,
    description,
    englishPath: `/examples/${canonical}`,
    image: ogImage,
    imageAlt: 'MaxVideo AI — Examples gallery preview',
    robots: {
      index: !noindex,
      follow: true,
    },
  });
}

export default async function ExamplesModelPage({
  params,
  searchParams,
}: {
  params: { locale: AppLocale; model: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const normalized = normalizeExampleSlug(params.model);
  if (!EXAMPLE_MODEL_SLUG_SET.has(normalized)) {
    notFound();
  }
  const canonical = resolveExampleCanonicalSlug(normalized);
  if (!canonical) {
    notFound();
  }
  if (canonical !== normalized) {
    permanentRedirect(buildExamplesHref(params.locale, canonical, searchParams));
  }

  const mergedSearchParams = { ...(searchParams ?? {}), engine: normalized };
  return <ExamplesPage searchParams={mergedSearchParams} engineFromPath={normalized} />;
}
