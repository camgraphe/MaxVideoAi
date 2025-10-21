import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContentEntries, getEntryBySlug } from '@/lib/content/markdown';

interface Params {
  slug: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  const docs = await getContentEntries('content/docs');
  return docs.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const doc = await getEntryBySlug('content/docs', params.slug);
  if (!doc) {
    return {
      title: 'Doc not found — MaxVideo AI',
    };
  }
  const canonical = `https://maxvideoai.com/docs/${doc.slug}`;
  return {
    title: `${doc.title} — MaxVideo AI Docs`,
    description: doc.description,
    keywords: doc.keywords,
    openGraph: {
      title: `${doc.title} — MaxVideo AI Docs`,
      description: doc.description,
      images: [
        {
          url: doc.image ?? '/og/price-before.png',
          width: 1200,
          height: 630,
          alt: doc.title,
        },
      ],
    },
    alternates: {
      canonical,
      languages: {
        en: canonical,
      },
    },
  };
}

export default async function DocPage({ params }: { params: Params }) {
  const doc = await getEntryBySlug('content/docs', params.slug);
  if (!doc) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <article className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
            {new Date(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 className="text-3xl font-semibold text-text-primary">{doc.title}</h1>
          <p className="text-base text-text-secondary">{doc.description}</p>
        </header>
        <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: doc.content }} />
      </article>
    </div>
  );
}
