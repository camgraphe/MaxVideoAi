import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { buildMetadataUrls, SITE_BASE_URL, type LocaleSlugMap } from '@/lib/metadataUrls';
import { getHreflangEnglishPath, type HreflangGroupKey } from '@/lib/seo/hreflang';
import { buildMetaDescription, buildMetaTitle } from '@/lib/seo/meta';

const DEFAULT_OG_IMAGE = '/og/price-before.png';
const DEFAULT_OG_WIDTH = 1200;
const DEFAULT_OG_HEIGHT = 630;
const SITE_NAME = 'MaxVideoAI';
const TWITTER_HANDLE = '@MaxVideoAI';
const BRAND_REGEX = /maxvideo\s*ai/i;

function normalizeTitleInput(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function buildSeoTitle(input: string): string {
  const normalized = normalizeTitleInput(input);
  if (!normalized) return SITE_NAME;
  if (BRAND_REGEX.test(normalized)) {
    return normalized;
  }
  return `${normalized} — ${SITE_NAME}`;
}

type OpenGraphMetadata = NonNullable<Metadata['openGraph']> & { type?: string };
type OgType = string;

type BuildSeoMetadataOptions = {
  locale: AppLocale;
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  ogType?: OgType;
  slugMap?: LocaleSlugMap;
  hreflangGroup?: HreflangGroupKey;
  englishPath?: string;
  availableLocales?: AppLocale[];
  canonicalOverride?: string;
  keywords?: Metadata['keywords'];
  robots?: Metadata['robots'];
  other?: Metadata['other'];
  openGraph?: Partial<Metadata['openGraph']>;
  twitter?: Partial<Metadata['twitter']>;
};

function resolveImageUrl(image?: string) {
  const candidate = typeof image === 'string' && image.trim().length ? image.trim() : DEFAULT_OG_IMAGE;
  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    return candidate;
  }
  if (candidate.startsWith('//')) {
    return `https:${candidate}`;
  }
  const normalized = candidate.startsWith('/') ? candidate : `/${candidate}`;
  return `${SITE_BASE_URL}${normalized}`;
}

export function buildSeoMetadata({
  locale,
  title,
  description,
  image,
  imageAlt,
  ogType = 'website',
  slugMap,
  hreflangGroup,
  englishPath,
  availableLocales,
  canonicalOverride,
  keywords,
  robots,
  other,
  openGraph: openGraphOverrides,
  twitter: twitterOverrides,
}: BuildSeoMetadataOptions): Metadata {
  const safeTitle = buildMetaTitle(buildSeoTitle(title));
  const safeDescription = buildMetaDescription(description);
  const resolvedEnglishPath = englishPath ?? (hreflangGroup ? getHreflangEnglishPath(hreflangGroup) : undefined);
  const metadataUrls = buildMetadataUrls(locale, slugMap, {
    englishPath: resolvedEnglishPath,
    availableLocales,
  });
  const canonical = canonicalOverride ?? metadataUrls.canonical;
  const imageUrl = resolveImageUrl(image);
  const defaultImageEntry = [
    {
      url: imageUrl,
      width: DEFAULT_OG_WIDTH,
      height: DEFAULT_OG_HEIGHT,
      alt: imageAlt ?? title,
    },
  ];

  const baseOpenGraph: OpenGraphMetadata = {
    title: safeTitle,
    description: safeDescription,
    url: canonical,
    siteName: SITE_NAME,
    locale: metadataUrls.ogLocale,
    alternateLocale: metadataUrls.alternateOg,
    type: ogType,
    images: defaultImageEntry,
  };
  const mergedOpenGraph = {
    ...baseOpenGraph,
    ...openGraphOverrides,
  };
  const mergedImages = mergedOpenGraph.images;
  const normalizedImages = Array.isArray(mergedImages) ? mergedImages : mergedImages ? [mergedImages] : [];
  mergedOpenGraph.images = normalizedImages.length ? normalizedImages : defaultImageEntry;

  const baseTwitter: NonNullable<Metadata['twitter']> = {
    card: 'summary_large_image',
    title: safeTitle,
    description: safeDescription,
    images: [imageUrl],
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
  };
  const mergedTwitter = {
    ...baseTwitter,
    ...twitterOverrides,
  };
  const mergedTwitterImages = mergedTwitter.images;
  const normalizedTwitterImages = Array.isArray(mergedTwitterImages)
    ? mergedTwitterImages
    : mergedTwitterImages
      ? [mergedTwitterImages]
      : [];
  mergedTwitter.images = normalizedTwitterImages.length ? normalizedTwitterImages : baseTwitter.images;

  const meta: Metadata = {
    title: { absolute: safeTitle },
    description: safeDescription,
    alternates: {
      canonical,
      languages: metadataUrls.languages,
    },
    openGraph: mergedOpenGraph,
    twitter: mergedTwitter,
  };

  if (keywords) {
    meta.keywords = keywords;
  }
  if (robots) {
    meta.robots = robots;
  }
  if (other) {
    meta.other = { ...meta.other, ...other };
  }

  return meta;
}
