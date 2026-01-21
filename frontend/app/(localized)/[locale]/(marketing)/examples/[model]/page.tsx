import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MARKETING_EXAMPLE_SLUGS } from '@/config/navigation';
import { locales, type AppLocale } from '@/i18n/locales';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { listExamples } from '@/server/videos';
import ExamplesPage, { resolveEngineLabel } from '../page';

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || SITE_BASE_URL;
const EXAMPLE_MODEL_SLUG_SET = new Set(MARKETING_EXAMPLE_SLUGS.map((slug) => slug.toLowerCase()));
const DEFAULT_SORT = 'playlist';

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

  const t = await getTranslations({ locale: params.locale, namespace: 'gallery.meta' });
  const engineLabel = resolveEngineLabel(normalized);
  const title = engineLabel ? t('title_engine', { engineName: engineLabel }) : t('title');
  const description = engineLabel ? t('description_engine', { engineName: engineLabel }) : t('description');
  const latest = await listExamples('date-desc', 20);
  const firstWithThumb = latest.find((video) => Boolean(video.thumbUrl));
  const ogImage = toAbsoluteUrl(firstWithThumb?.thumbUrl) ?? `${SITE}/og/price-before.png`;
  const noindex = shouldNoindex(searchParams ?? {});

  return buildSeoMetadata({
    locale: params.locale,
    title,
    description,
    englishPath: `/examples/${normalized}`,
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

  const mergedSearchParams = { ...(searchParams ?? {}), engine: normalized };
  return <ExamplesPage searchParams={mergedSearchParams} engineFromPath={normalized} />;
}
