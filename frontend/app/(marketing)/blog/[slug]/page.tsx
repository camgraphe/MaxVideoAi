import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getContentEntries, getEntryBySlug } from '@/lib/content/markdown';

interface Params {
  slug: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  const posts = await getContentEntries('content/blog');
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const post = await getEntryBySlug('content/blog', params.slug);
  if (!post) {
    return {
      title: 'Post not found — MaxVideo AI',
    };
  }
  const canonical = `https://maxvideoai.com/blog/${post.slug}`;
  return {
    title: `${post.title} — MaxVideo AI`,
    description: post.description,
    keywords: post.keywords,
    openGraph: {
      title: `${post.title} — MaxVideo AI`,
      description: post.description,
      images: [
        {
          url: post.image ?? '/og/price-before.png',
          width: 1200,
          height: 630,
          alt: post.title,
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

export default async function BlogPostPage({ params }: { params: Params }) {
  const post = await getEntryBySlug('content/blog', params.slug);
  if (!post) {
    notFound();
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
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
      '@id': `https://maxvideoai.com/blog/${post.slug}`,
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <article className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
            {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 className="text-3xl font-semibold text-text-primary">{post.title}</h1>
          <p className="text-base text-text-secondary">{post.description}</p>
        </header>
        <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
      <Script id={`article-${post.slug}-jsonld`} type="application/ld+json">
        {JSON.stringify(articleSchema)}
      </Script>
    </div>
  );
}
