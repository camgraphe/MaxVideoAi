import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { getContentEntries } from '@/lib/content/markdown';
import { resolveDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Blog — MaxVideo AI',
  description: 'News on new engines, case studies, prompt guides, and price-before best practices.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Blog — MaxVideo AI',
    description: 'Stay current on MaxVideo AI engines, workflows, and customer stories.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Blog overview.',
      },
    ],
  },
  alternates: {
    canonical: 'https://maxvideoai.com/blog',
    languages: {
      en: 'https://maxvideoai.com/blog',
      fr: 'https://maxvideoai.com/blog?lang=fr',
    },
  },
};

export default async function BlogIndexPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.blog;
  const posts = await getContentEntries('content/blog');
  const canonical = 'https://maxvideoai.com/blog';

  const articleListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: posts.map((post, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${canonical}/${post.slug}`,
      name: post.title,
      description: post.description,
    })),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>

      {posts.length === 0 ? (
        <p className="mt-12 text-sm text-text-muted">{content.empty}</p>
      ) : (
        <section className="mt-12 space-y-6">
          {posts.map((post) => (
            <article key={post.slug} className="rounded-card border border-hairline bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <span className="text-xs text-text-muted">{post.keywords?.[0]}</span>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-text-primary">
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h2>
              <p className="mt-2 text-sm text-text-secondary">{post.description}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 inline-flex text-sm font-semibold text-accent hover:text-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {dictionary.blog.cta ?? 'Read more'}
              </Link>
            </article>
          ))}
        </section>
      )}

      {posts.length > 0 ? (
        <Script id="blog-list-jsonld" type="application/ld+json">
          {JSON.stringify(articleListSchema)}
        </Script>
      ) : null}
    </div>
  );
}
