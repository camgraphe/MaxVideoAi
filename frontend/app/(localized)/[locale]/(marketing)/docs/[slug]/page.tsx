import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getContentEntries, getEntryBySlug } from '@/lib/content/markdown';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
import { defaultLocale, localePathnames, locales, localeRegions, type AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveLocalizedFallbackSeo } from '@/lib/seo/localizedFallback';

interface Params {
  locale?: AppLocale;
  slug: string;
}

const DOCS_FALLBACK_ROOT = 'content/docs';
const DOCS_SLUG_MAP = buildSlugMap('docs');

function toIsoDate(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toAbsoluteUrl(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${SITE_BASE_URL}${normalized}`;
}

async function getDocsEntriesForLocale(locale: AppLocale) {
  if (locale === defaultLocale) {
    return getContentEntries(DOCS_FALLBACK_ROOT);
  }

  const [localized, english] = await Promise.all([
    getContentEntries(`content/${locale}/docs`),
    getContentEntries(DOCS_FALLBACK_ROOT),
  ]);
  const bySlug = new Map(localized.map((entry) => [entry.slug, entry]));
  english.forEach((entry) => {
    if (!bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, entry);
    }
  });
  return Array.from(bySlug.values());
}

async function getLocalizedDocEntry(locale: AppLocale, slug: string) {
  if (locale === defaultLocale) {
    return getEntryBySlug(DOCS_FALLBACK_ROOT, slug);
  }
  return getEntryBySlug(`content/${locale}/docs`, slug);
}

async function getDocEntryWithFallback(locale: AppLocale, slug: string) {
  const localized = await getLocalizedDocEntry(locale, slug);
  if (localized) {
    return { entry: localized, hasLocalizedVersion: true };
  }

  const fallback = await getEntryBySlug(DOCS_FALLBACK_ROOT, slug);
  return {
    entry: fallback,
    hasLocalizedVersion: locale === defaultLocale,
  };
}

async function resolveDocLocales(slug: string): Promise<AppLocale[]> {
  const available: AppLocale[] = [];
  for (const locale of locales) {
    const localized = await getEntryBySlug(`content/${locale}/docs`, slug);
    if (localized) {
      available.push(locale);
      continue;
    }
    if (locale === 'en') {
      const fallback = await getEntryBySlug(DOCS_FALLBACK_ROOT, slug);
      if (fallback) {
        available.push(locale);
      }
    }
  }
  return available.length > 0 ? available : (['en'] as AppLocale[]);
}

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];
  for (const locale of locales) {
    const docs = await getDocsEntriesForLocale(locale);
    docs.forEach((entry) => params.push({ locale, slug: entry.slug }));
  }
  return params;
}

export const dynamicParams = false;

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale ?? 'en';
  const { entry: doc, hasLocalizedVersion } = await getDocEntryWithFallback(locale, params.slug);
  if (!doc) {
    const { dictionary, fallback } = await resolveDictionary({ locale });
    return {
      title: dictionary.docs.meta.notFoundTitle || fallback.docs.meta.notFoundTitle,
    };
  }
  const seo = resolveLocalizedFallbackSeo({
    locale,
    hasLocalizedVersion,
    englishPath: `/docs/${doc.slug}`,
    availableLocales: await resolveDocLocales(doc.slug),
  });
  return buildSeoMetadata({
    locale,
    title: `${doc.title} — MaxVideo AI Docs`,
    description: doc.description,
    image: doc.image ?? '/og/price-before.png',
    imageAlt: doc.title,
    ogType: 'article',
    englishPath: `/docs/${doc.slug}`,
    availableLocales: seo.availableLocales,
    canonicalOverride: seo.canonicalOverride,
    robots: seo.robots,
    keywords: doc.keywords,
  });
}

export default async function DocPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const locale = params.locale ?? 'en';
  const { entry: doc, hasLocalizedVersion } = await getDocEntryWithFallback(locale, params.slug);
  if (!doc) {
    notFound();
  }
  const docs = await getDocsEntriesForLocale(locale);
  const currentIndex = docs.findIndex((entry) => entry.slug === doc.slug);
  const neighborDocs = [
    currentIndex > 0 ? docs[currentIndex - 1] : null,
    currentIndex >= 0 && currentIndex < docs.length - 1 ? docs[currentIndex + 1] : null,
  ].filter((entry): entry is (typeof docs)[number] => Boolean(entry));
  const relatedDocs = [
    ...neighborDocs,
    ...docs.filter((entry) => entry.slug !== doc.slug && !neighborDocs.some((neighbor) => neighbor.slug === entry.slug)),
  ].slice(0, 3);
  const dateLocale = localeRegions[locale] ?? 'en-US';
  const overviewLabel =
    locale === 'fr' ? 'Vue d’ensemble Docs' : locale === 'es' ? 'Resumen de Docs' : 'Docs overview';
  const availableLocales = await resolveDocLocales(doc.slug);
  const seo = resolveLocalizedFallbackSeo({
    locale,
    hasLocalizedVersion,
    englishPath: `/docs/${doc.slug}`,
    availableLocales,
  });
  const metadataUrls = buildMetadataUrls(locale, DOCS_SLUG_MAP, {
    englishPath: `/docs/${doc.slug}`,
    availableLocales: seo.availableLocales,
  });
  const docsIndexUrl = buildMetadataUrls(locale, DOCS_SLUG_MAP, { englishPath: '/docs' }).canonical;
  const canonicalUrl = seo.canonicalOverride ?? metadataUrls.canonical;
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;
  const publishedIso = toIsoDate(doc.date) ?? doc.date;
  const modifiedIso = toIsoDate(doc.updatedAt ?? doc.date) ?? publishedIso;
  const docJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: doc.title,
    description: doc.description,
    url: canonicalUrl,
    datePublished: publishedIso,
    dateModified: modifiedIso,
    inLanguage: localeRegions[locale],
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    isPartOf: {
      '@type': 'CollectionPage',
      '@id': docsIndexUrl,
      name: overviewLabel,
    },
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      url: SITE_BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_BASE_URL}/favicon-512.png`,
      },
    },
    ...(doc.image ? { image: toAbsoluteUrl(doc.image) } : {}),
    ...(doc.keywords?.length ? { keywords: doc.keywords } : {}),
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: locale === 'fr' ? 'Accueil' : locale === 'es' ? 'Inicio' : 'Home',
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: overviewLabel,
        item: docsIndexUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: doc.title,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <div className="container-page max-w-3xl section">
      <article className="stack-gap-lg">
        <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
          <Link href="/docs" className="underline underline-offset-2 hover:text-text-primary">
            {overviewLabel}
          </Link>
        </nav>
        <header className="stack-gap-sm">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
            {new Date(doc.date).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{doc.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{doc.description}</p>
        </header>
        <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: doc.content }} />
        {relatedDocs.length ? (
          <p className="text-sm text-text-muted">
            <Link href="/docs" className="underline underline-offset-2 hover:text-text-primary">
              {overviewLabel}
            </Link>
            {' · '}
            {relatedDocs.map((entry, index) => (
              <span key={entry.slug}>
                <Link
                  href={{ pathname: '/docs/[slug]', params: { slug: entry.slug } }}
                  className="underline underline-offset-2 hover:text-text-primary"
                >
                  {entry.title}
                </Link>
                {index < relatedDocs.length - 1 ? ' · ' : null}
              </span>
            ))}
          </p>
        ) : null}
      </article>
      <Script id={`docs-breadcrumb-${locale}-${doc.slug}-jsonld`} type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </Script>
      <Script id={`docs-article-${locale}-${doc.slug}-jsonld`} type="application/ld+json">
        {JSON.stringify(docJsonLd)}
      </Script>
      {doc.structuredData?.map((json, index) => (
        <Script
          key={`docs-jsonld-${doc.slug}-${index}`}
          id={`docs-jsonld-${doc.slug}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
    </div>
  );
}
