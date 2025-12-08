import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { buildMetadataUrls, SITE_BASE_URL, type LocaleSlugMap } from '@/lib/metadataUrls';

const DEFAULT_OG_IMAGE = '/og/price-before.png';
const DEFAULT_OG_WIDTH = 1200;
const DEFAULT_OG_HEIGHT = 630;
const SITE_NAME = 'MaxVideoAI';
const TWITTER_HANDLE = '@MaxVideoAI';

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
  englishPath,
  availableLocales,
  canonicalOverride,
  keywords,
  robots,
  other,
  openGraph: openGraphOverrides,
  twitter: twitterOverrides,
}: BuildSeoMetadataOptions): Metadata {
  const metadataUrls = buildMetadataUrls(locale, slugMap, { englishPath, availableLocales });
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
    title,
    description,
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
  if (!mergedOpenGraph.images || mergedOpenGraph.images.length === 0) {
    mergedOpenGraph.images = defaultImageEntry;
  }

  const baseTwitter: NonNullable<Metadata['twitter']> = {
    card: 'summary_large_image',
    title,
    description,
    images: [imageUrl],
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
  };
  const mergedTwitter = {
    ...baseTwitter,
    ...twitterOverrides,
  };
  if (!mergedTwitter.images || mergedTwitter.images.length === 0) {
    mergedTwitter.images = baseTwitter.images;
  }

  const meta: Metadata = {
    title,
    description,
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
