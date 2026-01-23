import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContentEntries, getEntryBySlug } from '@/lib/content/markdown';
import { locales, localeRegions, type AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';

interface Params {
  locale?: AppLocale;
  slug: string;
}

const DOCS_FALLBACK_ROOT = 'content/docs';

async function getDocsEntriesForLocale(locale: AppLocale) {
  const localizedRoot = `content/${locale}/docs`;
  const localized = await getContentEntries(localizedRoot);
  if (localized.length > 0) {
    return localized;
  }
  return getContentEntries(DOCS_FALLBACK_ROOT);
}

async function getDocEntryForLocale(locale: AppLocale, slug: string) {
  const localizedRoot = `content/${locale}/docs`;
  const localized = await getEntryBySlug(localizedRoot, slug);
  if (localized) {
    return localized;
  }
  return getEntryBySlug(DOCS_FALLBACK_ROOT, slug);
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
  const doc = await getDocEntryForLocale(locale, params.slug);
  if (!doc) {
    return {
      title: 'Doc not found — MaxVideo AI',
    };
  }
  const availableLocales = await resolveDocLocales(doc.slug);
  return buildSeoMetadata({
    locale,
    title: `${doc.title} — MaxVideo AI Docs`,
    description: doc.description,
    image: doc.image ?? '/og/price-before.png',
    imageAlt: doc.title,
    ogType: 'article',
    englishPath: `/docs/${doc.slug}`,
    availableLocales,
    keywords: doc.keywords,
  });
}

export default async function DocPage({ params }: { params: Params }) {
  const locale = params.locale ?? 'en';
  const doc = await getDocEntryForLocale(locale, params.slug);
  if (!doc) {
    notFound();
  }
  const dateLocale = localeRegions[locale] ?? 'en-US';

  return (
    <div className="container-page max-w-3xl section">
      <article className="stack-gap-lg">
        <header className="stack-gap-sm">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
            {new Date(doc.date).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{doc.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{doc.description}</p>
        </header>
        <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: doc.content }} />
      </article>
    </div>
  );
}
