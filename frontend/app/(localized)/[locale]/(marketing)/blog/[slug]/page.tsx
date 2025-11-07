import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getContentEntries, getEntryBySlug } from '@/lib/content/markdown';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames, localeRegions, locales } from '@/i18n/locales';
import { SITE_BASE_URL } from '@/lib/metadataUrls';

interface Params {
  locale: AppLocale;
  slug: string;
}

const localeDateMap: Record<AppLocale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
};

async function getPost(locale: AppLocale, slug: string) {
  return getEntryBySlug(`content/${locale}/blog`, slug);
}

async function findLocalizedSlugs(canonicalSlug: string) {
  const mapping: Partial<Record<AppLocale, string>> = {};
  await Promise.all(
    locales.map(async (locale) => {
      const entries = await getContentEntries(`content/${locale}/blog`);
      const match = entries.find(
        (entry) => (entry.canonicalSlug ?? (entry.lang === 'en' ? entry.slug : null)) === canonicalSlug
      );
      if (match) {
        mapping[locale] = match.slug;
      }
    })
  );
  return mapping;
}

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];
  for (const locale of locales) {
    const entries = await getContentEntries(`content/${locale}/blog`);
    entries.forEach((entry) => {
      params.push({ locale, slug: entry.slug });
    });
  }
  return params;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const post = await getPost(params.locale, params.slug);
  if (!post) {
    return { title: 'Post not found — MaxVideo AI' };
  }
  const canonicalSlug = post.canonicalSlug ?? (post.lang === 'en' ? post.slug : undefined) ?? post.slug;
  const localizedSlugs = await findLocalizedSlugs(canonicalSlug);
  if (!localizedSlugs.en) {
    localizedSlugs.en = canonicalSlug;
  }

  const buildLocalizedUrl = (target: AppLocale) => {
    const slug = localizedSlugs[target] ?? canonicalSlug;
    const prefix = localePathnames[target] ? `/${localePathnames[target]}` : '';
    return `${SITE_BASE_URL}${prefix}/blog/${slug}`;
  };

  const languages: Record<string, string> = {
    en: buildLocalizedUrl('en'),
    fr: buildLocalizedUrl('fr'),
    es: buildLocalizedUrl('es'),
    'x-default': buildLocalizedUrl('en'),
  };
  const canonicalUrl = languages[params.locale] ?? languages.en;

  const ogLocale = localeRegions[params.locale].replace('-', '_');

  return {
    title: `${post.title} — MaxVideo AI`,
    description: post.description,
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
    openGraph: {
      title: `${post.title} — MaxVideo AI`,
      description: post.description,
      url: languages[params.locale] ?? languages.en,
      locale: ogLocale,
      siteName: 'MaxVideoAI',
      images: [
        {
          url: post.image ?? '/og/price-before.png',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} — MaxVideo AI`,
      description: post.description,
      images: [post.image ?? '/og/price-before.png'],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { locale, slug } = params;
  const post = await getPost(locale, slug);
  if (!post) {
    notFound();
  }

  const dateFormatter = new Intl.DateTimeFormat(localeDateMap[locale], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedDate = dateFormatter.format(new Date(post.date));
  const canonicalSlug = post.canonicalSlug ?? (post.lang === 'en' ? post.slug : undefined) ?? post.slug;
  const localizedSlugs = await findLocalizedSlugs(canonicalSlug);
  if (!localizedSlugs.en) {
    localizedSlugs.en = canonicalSlug;
  }
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const canonicalUrl = `${SITE_BASE_URL}${prefix}/blog/${localizedSlugs[locale] ?? canonicalSlug}`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
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
      '@id': canonicalUrl,
    },
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <Link
        href="/blog"
        className="inline-flex items-center text-sm font-semibold text-accent transition hover:text-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        ← Back to blog
      </Link>

      <article className="mt-6 overflow-hidden rounded-[28px] border border-hairline bg-white/90 shadow-card backdrop-blur">
        <header className="relative border-b border-hairline bg-gradient-to-br from-white to-bg/60">
          {post.image ? (
            <div className="relative h-64 w-full overflow-hidden bg-bg sm:h-80">
              <Image
                src={post.image}
                alt={post.title}
                fill
                priority
                sizes="(min-width: 1024px) 960px, 100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 via-60% to-white/10" />
            </div>
          ) : (
            <div className="h-24 w-full bg-gradient-to-r from-accent/5 via-accent/10 to-accent/5 sm:h-28" />
          )}
          <div className="relative z-10 space-y-6 px-6 pb-10 pt-8 sm:px-10">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-micro text-text-muted">
              <span className="rounded-pill border border-hairline bg-white/80 px-3 py-1 font-semibold text-text-secondary shadow-sm">
                {formattedDate}
              </span>
              <div className="flex flex-wrap gap-2">
                {post.keywords?.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-pill bg-accent/10 px-3 py-1 font-semibold text-accent"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            <div className="max-w-3xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">{post.title}</h1>
              <p className="text-base text-text-secondary sm:text-lg">{post.description}</p>
            </div>
          </div>
        </header>

        <div className="blog-prose px-6 py-10 sm:px-10" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>

      <Script
        id={`article-${locale}-${post.slug}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {post.structuredData?.map((json, index) => (
        <Script
          key={`faq-jsonld-${post.slug}-${index}`}
          id={`faq-jsonld-${post.slug}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
    </div>
  );
}
