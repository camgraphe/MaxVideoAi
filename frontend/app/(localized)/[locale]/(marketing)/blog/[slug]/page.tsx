import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { TextLink } from '@/components/ui/TextLink';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Script from 'next/script';
import { getContentEntries, getEntryBySlug } from '@/lib/content/markdown';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames, localeRegions, locales } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';

interface Params {
  locale: AppLocale;
  slug: string;
}

export const dynamicParams = false;

const localeDateMap: Record<AppLocale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
};

const BLOG_TITLE_OVERRIDES: Partial<Record<string, Partial<Record<AppLocale, string>>>> = {
  'sora-2-sequenced-prompts': {
    en: 'Sora 2 sequenced prompts for AI video – MaxVideoAI blog',
    fr: 'Sora 2 prompts séquencés vidéo IA – Blog MaxVideoAI',
    es: 'Sora 2 prompts secuenciales para video IA – Blog MaxVideoAI',
  },
};
const BLOG_SLUG_MAP = buildSlugMap('blog');

function toIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

async function getPost(locale: AppLocale, slug: string) {
  const basePath = `content/${locale}/blog`;
  const direct = await getEntryBySlug(basePath, slug);
  if (direct) {
    return direct;
  }
  const entries = await getContentEntries(basePath);
  const canonicalMatch = entries.find((entry) => {
    if (entry.slug === slug) return true;
    if (entry.canonicalSlug && entry.canonicalSlug === slug) return true;
    if (!entry.canonicalSlug && entry.lang === 'en' && entry.slug === slug) return true;
    return false;
  });
  return canonicalMatch ?? null;
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
  const lastModified = toIsoDate(post.updatedAt ?? post.date);
  const published = toIsoDate(post.date);
  const canonicalSlug = post.canonicalSlug ?? (post.lang === 'en' ? post.slug : undefined) ?? post.slug;
  const localizedSlugs = await findLocalizedSlugs(canonicalSlug);
  if (!localizedSlugs.en) {
    localizedSlugs.en = canonicalSlug;
  }

  const publishableLocales = new Set<AppLocale>(['en']);
  locales.forEach((code) => {
    if (code !== 'en' && localizedSlugs[code]) {
      publishableLocales.add(code);
    }
  });
  const slugMap: Partial<Record<AppLocale, string>> = {};
  const ensureSlugFor = (target: AppLocale) => {
    const slugValue = localizedSlugs[target] ?? canonicalSlug;
    slugMap[target] = `blog/${slugValue}`;
  };
  publishableLocales.forEach(ensureSlugFor);
  ensureSlugFor(params.locale);

  const overrideTitle =
    BLOG_TITLE_OVERRIDES[canonicalSlug]?.[params.locale] ?? BLOG_TITLE_OVERRIDES[canonicalSlug]?.en ?? null;
  const defaultTitle = `${post.title} — MaxVideo AI`;
  const pageTitle = overrideTitle ?? defaultTitle;

  const metadata = buildSeoMetadata({
    locale: params.locale,
    title: pageTitle,
    description: post.description,
    slugMap,
    englishPath: `/blog/${canonicalSlug}`,
    availableLocales: Array.from(publishableLocales),
    image: post.image ?? '/og/price-before.png',
    imageAlt: post.title,
    ogType: 'article',
    openGraph: {
      ...(published ? { publishedTime: published } : {}),
      ...(lastModified ? { modifiedTime: lastModified, updatedTime: lastModified } : {}),
    },
    other: lastModified ? { 'last-modified': lastModified } : undefined,
  });

  return metadata;
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { locale, slug } = params;
  const post = await getPost(locale, slug);
  if (!post) {
    notFound();
  }
  if (post.slug !== slug) {
    const localizedPrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
    redirect(`${localizedPrefix}/blog/${post.slug}`);
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
  const publishableLocales = new Set<AppLocale>(['en']);
  locales.forEach((code) => {
    if (code !== 'en' && localizedSlugs[code]) {
      publishableLocales.add(code);
    }
  });
  const slugMap: Partial<Record<AppLocale, string>> = {};
  const ensureSlugFor = (target: AppLocale) => {
    const targetSlug = localizedSlugs[target] ?? canonicalSlug;
    slugMap[target] = `blog/${targetSlug}`;
  };
  publishableLocales.forEach(ensureSlugFor);
  ensureSlugFor(locale);
  const metadataUrls = buildMetadataUrls(locale, slugMap, {
    englishPath: `/blog/${canonicalSlug}`,
    availableLocales: Array.from(publishableLocales),
  });
  const canonicalUrl = metadataUrls.canonical;
  const breadcrumbLabels = getBreadcrumbLabels(locale);
  const blogListUrl = buildMetadataUrls(locale, BLOG_SLUG_MAP, { englishPath: '/blog' }).canonical;
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: breadcrumbLabels.home,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: breadcrumbLabels.blog,
        item: blogListUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: canonicalUrl,
      },
    ],
  };
  const publishedIso = toIsoDate(post.date) ?? post.date;
  const modifiedIso = toIsoDate(post.updatedAt ?? post.date) ?? publishedIso;
  const demotedContent = post.content.replace(/<\/?h1>/gi, (match) => match.replace(/h1/i, 'h2'));
  const relatedPool = (await getContentEntries(`content/${locale}/blog`)).filter((entry) => entry.slug !== post.slug);
  const relatedPosts = relatedPool
    .sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''))
    .slice(0, 3);

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
      '@id': canonicalUrl,
    },
  };

  return (
    <div className="container-page max-w-5xl section">
      <TextLink href="/blog" className="text-sm" linkComponent={Link}>
        ← Back to blog
      </TextLink>

      <article className="mt-6 overflow-hidden rounded-[28px] border border-hairline bg-white/90 shadow-card backdrop-blur">
        <header className="relative border-b border-hairline bg-gradient-to-br from-white to-bg/60">
          {post.image ? (
            <div className="relative h-64 w-full overflow-hidden bg-bg sm:h-80">
              <Image
                src={post.image}
                alt={post.title}
                fill
                priority
                fetchPriority="high"
                sizes="(min-width: 1024px) 960px, 100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 via-60% to-white/10" />
            </div>
          ) : (
            <div className="h-24 w-full bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2 sm:h-28" />
          )}
          <div className="relative z-10 stack-gap-lg px-6 pb-10 pt-8 sm:px-10">
            <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-micro text-text-muted">
              <span className="rounded-pill border border-hairline bg-white/80 px-3 py-1 font-semibold text-text-secondary shadow-sm">
                {formattedDate}
              </span>
              <div className="flex flex-wrap gap-2">
                {post.keywords?.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-pill bg-surface-2 px-3 py-1 font-semibold text-brand"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            <div className="max-w-3xl stack-gap-sm">
              <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-5xl">{post.title}</h1>
              <p className="text-base leading-relaxed text-text-secondary sm:text-lg">{post.description}</p>
            </div>
          </div>
        </header>

        <div className="blog-prose px-6 py-10 sm:px-10" dangerouslySetInnerHTML={{ __html: demotedContent }} />
      </article>

      {relatedPosts.length ? (
        <section className="mt-12 stack-gap">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">Related reading</h2>
            <p className="text-sm text-text-secondary">More launch notes and engine breakdowns curated for you.</p>
          </div>
          <div className="grid grid-gap-sm md:grid-cols-3">
            {relatedPosts.map((related) => (
              <article key={related.slug} className="rounded-2xl border border-hairline bg-white/90 p-5 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                  {new Date(related.date).toLocaleDateString(localeDateMap[locale], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <h3 className="mt-2 text-base font-semibold text-text-primary">{related.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{related.description}</p>
                <TextLink
                  href={{ pathname: '/blog/[slug]', params: { slug: related.slug } }}
                  className="mt-4 gap-1 text-sm"
                  linkComponent={Link}
                >
                  Read article <span aria-hidden>→</span>
                </TextLink>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <Script
        id={`breadcrumb-${locale}-${post.slug}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

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
