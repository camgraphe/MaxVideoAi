import type { Metadata } from 'next';
import type { ContentEntry } from '@/lib/content/markdown';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames, localeRegions, locales } from '@/i18n/locales';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import {
  BLOG_SLUG_MAP,
  BLOG_TITLE_OVERRIDES,
  toIsoDate,
} from './blog-post-data';

export type BlogPostLocalization = {
  availableLocales: AppLocale[];
  blogListUrl: string;
  canonicalSlug: string;
  canonicalUrl: string;
  hasLocalizedVersion: boolean;
  homeUrl: string;
  localizedSlugs: Partial<Record<AppLocale, string>>;
  localePrefix: string;
  slugMap: Partial<Record<AppLocale, string>>;
};

export function buildBlogPostLocalization({
  canonicalSlug,
  locale,
  localizedSlugs,
}: {
  canonicalSlug: string;
  locale: AppLocale;
  localizedSlugs: Partial<Record<AppLocale, string>>;
}): BlogPostLocalization {
  const normalizedLocalizedSlugs = { ...localizedSlugs };
  if (!normalizedLocalizedSlugs.en) {
    normalizedLocalizedSlugs.en = canonicalSlug;
  }

  const publishableLocales = new Set<AppLocale>(['en']);
  locales.forEach((code) => {
    if (code !== 'en' && normalizedLocalizedSlugs[code]) {
      publishableLocales.add(code);
    }
  });

  const slugMap: Partial<Record<AppLocale, string>> = {};
  const ensureSlugFor = (target: AppLocale) => {
    const slugValue = normalizedLocalizedSlugs[target] ?? canonicalSlug;
    slugMap[target] = `blog/${slugValue}`;
  };
  publishableLocales.forEach(ensureSlugFor);

  const hasLocalizedVersion = locale === 'en' || Boolean(normalizedLocalizedSlugs[locale]);
  if (hasLocalizedVersion) {
    ensureSlugFor(locale);
  }

  const availableLocales = Array.from(publishableLocales);
  const metadataUrls = buildMetadataUrls(locale, slugMap, {
    englishPath: `/blog/${canonicalSlug}`,
    availableLocales,
  });
  const canonicalUrl = !hasLocalizedVersion ? `${SITE_BASE_URL}/blog/${canonicalSlug}` : metadataUrls.canonical;
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';

  return {
    availableLocales,
    blogListUrl: buildMetadataUrls(locale, BLOG_SLUG_MAP, { englishPath: '/blog' }).canonical,
    canonicalSlug,
    canonicalUrl,
    hasLocalizedVersion,
    homeUrl: `${SITE_BASE_URL}${localePrefix || ''}`,
    localizedSlugs: normalizedLocalizedSlugs,
    localePrefix,
    slugMap,
  };
}

export function buildBlogPostMetadata({
  locale,
  localization,
  post,
}: {
  locale: AppLocale;
  localization: BlogPostLocalization;
  post: ContentEntry;
}): Metadata {
  const lastModified = toIsoDate(post.updatedAt ?? post.date);
  const published = toIsoDate(post.date);
  const overrideTitle =
    BLOG_TITLE_OVERRIDES[localization.canonicalSlug]?.[locale] ??
    BLOG_TITLE_OVERRIDES[localization.canonicalSlug]?.en ??
    null;
  const pageTitle = overrideTitle ?? `${post.title} — MaxVideo AI`;

  return buildSeoMetadata({
    locale,
    title: pageTitle,
    description: post.description,
    slugMap: localization.slugMap,
    englishPath: `/blog/${localization.canonicalSlug}`,
    availableLocales: localization.availableLocales,
    canonicalOverride: !localization.hasLocalizedVersion ? localization.canonicalUrl : undefined,
    image: post.image ?? '/og/price-before.png',
    imageAlt: post.title,
    ogType: 'article',
    robots: !localization.hasLocalizedVersion ? { index: false, follow: true } : undefined,
    openGraph: {
      ...(published ? { publishedTime: published } : {}),
      ...(lastModified ? { modifiedTime: lastModified, updatedTime: lastModified } : {}),
    },
    other: lastModified ? { 'last-modified': lastModified } : undefined,
  });
}

export function buildBlogPostJsonLd({
  locale,
  localization,
  modifiedIso,
  post,
  publishedIso,
}: {
  locale: AppLocale;
  localization: BlogPostLocalization;
  modifiedIso: string;
  post: ContentEntry;
  publishedIso: string;
}) {
  const breadcrumbLabels = getBreadcrumbLabels(locale);
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: breadcrumbLabels.home,
        item: localization.homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: breadcrumbLabels.blog,
        item: localization.blogListUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: localization.canonicalUrl,
      },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: publishedIso,
    dateModified: modifiedIso,
    inLanguage: localeRegions[locale],
    image: post.image ?? '/og/price-before.png',
    author: {
      '@type': 'Organization',
      name: 'MaxVideo AI',
    },
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideo AI',
      logo: {
        '@type': 'ImageObject',
        url: '/og/price-before.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': localization.canonicalUrl,
    },
  };

  return {
    articleSchema,
    breadcrumbJsonLd,
  };
}
