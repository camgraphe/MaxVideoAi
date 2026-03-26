import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getContentEntries, getEntryBySlug } from '@/lib/content/markdown';
import { defaultLocale, locales, localeRegions, type AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveLocalizedFallbackSeo } from '@/lib/seo/localizedFallback';

interface Params {
  locale?: AppLocale;
  slug: string;
}

const DOCS_FALLBACK_ROOT = 'content/docs';

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

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
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

export default async function DocPage({ params }: { params: Params }) {
  const locale = params.locale ?? 'en';
  const { entry: doc } = await getDocEntryWithFallback(locale, params.slug);
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
    </div>
  );
}
