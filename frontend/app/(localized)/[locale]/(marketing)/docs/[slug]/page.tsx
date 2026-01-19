import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContentEntries, getEntryBySlug } from '@/lib/content/markdown';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';

interface Params {
  locale?: AppLocale;
  slug: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  const docs = await getContentEntries('content/docs');
  return docs.map((entry) => ({ slug: entry.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const doc = await getEntryBySlug('content/docs', params.slug);
  if (!doc) {
    return {
      title: 'Doc not found — MaxVideo AI',
    };
  }
  const locale = params.locale ?? 'en';
  return buildSeoMetadata({
    locale,
    title: `${doc.title} — MaxVideo AI Docs`,
    description: doc.description,
    image: doc.image ?? '/og/price-before.png',
    imageAlt: doc.title,
    ogType: 'article',
    englishPath: `/docs/${doc.slug}`,
    availableLocales: ['en'] as AppLocale[],
    keywords: doc.keywords,
  });
}

export default async function DocPage({ params }: { params: Params }) {
  const doc = await getEntryBySlug('content/docs', params.slug);
  if (!doc) {
    notFound();
  }

  return (
    <div className="container-page max-w-3xl px-4 py-16 lg:py-20 sm:px-6 lg:px-8">
      <article className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
            {new Date(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{doc.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{doc.description}</p>
        </header>
        <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: doc.content }} />
      </article>
    </div>
  );
}
