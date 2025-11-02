import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import clsx from 'clsx';
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

  if (posts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="mt-4 text-base text-text-secondary">{content.empty}</p>
      </div>
    );
  }

  const [featured, ...rest] = posts;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="rounded-[32px] border border-hairline bg-white/80 p-8 shadow-card backdrop-blur sm:p-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-micro text-accent">The Studio Journal</p>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
              {content.hero.title}
            </h1>
            <p className="text-base text-text-secondary sm:text-lg">{content.hero.subtitle}</p>
          </div>
          <Link
            href="/models/sora-2"
            className="inline-flex items-center gap-2 self-start rounded-pill border border-hairline bg-accent px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Latest Sora coverage →
          </Link>
        </div>
      </header>

      <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        <article className="group relative overflow-hidden rounded-[28px] border border-hairline bg-white/90 shadow-card transition hover:-translate-y-1 hover:shadow-float">
          <div className="relative h-64 w-full overflow-hidden sm:h-80">
            <Image
              src={featured.image ?? '/og/price-before.png'}
              alt={featured.title}
              fill
              sizes="(min-width: 1280px) 720px, (min-width: 1024px) 600px, 100vw"
              className="object-cover object-center transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0" />
          </div>
          <div className="space-y-4 px-6 pb-8 pt-6 sm:px-10">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-micro text-accent">
              <span className="rounded-pill bg-accent/10 px-3 py-1 font-semibold text-accent">
                {new Date(featured.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <div className="flex flex-wrap gap-2 text-text-muted">
                {featured.keywords?.slice(0, 2).map((keyword) => (
                  <span key={keyword} className="rounded-pill bg-bg px-3 py-1 font-semibold">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                <Link href={`/blog/${featured.slug}`} className="transition hover:text-accent">
                  {featured.title}
                </Link>
              </h2>
              <p className="text-base text-text-secondary sm:text-lg">{featured.description}</p>
            </div>
            <Link
              href={`/blog/${featured.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {dictionary.blog.cta ?? 'Read more'}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </article>

        <div className="space-y-6">
          {rest.map((post) => (
            <article
              key={post.slug}
              className={clsx(
                'group flex flex-col gap-4 rounded-3xl border border-hairline bg-white/90 p-6 shadow-card transition hover:-translate-y-1 hover:shadow-float',
                'sm:flex-row sm:items-center sm:p-7'
              )}
            >
              <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-bg sm:h-28 sm:w-40">
                <Image
                  src={post.image ?? '/og/price-before.png'}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-cover object-center transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-micro text-text-muted">
                  <span>
                    {new Date(post.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  {post.keywords?.slice(0, 1).map((keyword) => (
                    <span key={keyword} className="rounded-pill bg-bg px-3 py-1 font-semibold text-accent">
                      {keyword}
                    </span>
                  ))}
                </div>
                <h3 className="text-xl font-semibold text-text-primary transition group-hover:text-accent">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <p className="text-sm text-text-secondary">{post.description}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  {dictionary.blog.cta ?? 'Read more'}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Script id="blog-list-jsonld" type="application/ld+json">
        {JSON.stringify(articleListSchema)}
      </Script>
    </div>
  );
}
