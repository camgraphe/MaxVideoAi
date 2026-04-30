import type { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import Script from 'next/script';
import { getContentEntries, type ContentEntry } from '@/lib/content/markdown';
import { resolveDictionary } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';

const BLOG_SLUG_MAP = buildSlugMap('blog');
const BLOG_META = {
  en: {
    title: 'Blog — MaxVideoAI',
    description:
      'Reference-first workflows, tool guides, model notes, and production learnings from teams building images and video with MaxVideoAI.',
  },
  fr: {
    title: 'Blog MaxVideoAI (FR)',
    description:
      'Workflows orientés référence, guides d’outils, notes sur les modèles et retours de production d’équipes qui créent images et vidéos avec MaxVideoAI.',
  },
  es: {
    title: 'Blog MaxVideoAI (ES)',
    description:
      'Workflows basados en referencias, guías de herramientas, notas sobre modelos y aprendizajes de producción de equipos que crean imágenes y video con MaxVideoAI.',
  },
} satisfies Record<AppLocale, { title: string; description: string }>;

export const revalidate = 600;

function getCanonicalBlogSlug(post: Pick<ContentEntry, 'slug' | 'canonicalSlug' | 'lang'>) {
  return post.canonicalSlug ?? (post.lang === 'en' ? post.slug : post.slug);
}

async function getBlogPosts(locale: AppLocale) {
  const localized = await getContentEntries(`content/${locale}/blog`);
  if (locale === 'en') {
    return localized;
  }

  const english = await getContentEntries('content/en/blog');
  const merged = new Map<string, ContentEntry>();

  english.forEach((post) => {
    merged.set(getCanonicalBlogSlug(post), post);
  });

  localized.forEach((post) => {
    merged.set(getCanonicalBlogSlug(post), post);
  });

  return Array.from(merged.values()).sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''));
}

function getBlogLinkProps(locale: AppLocale, post: Pick<ContentEntry, 'slug' | 'canonicalSlug' | 'lang'>) {
  const canonicalSlug = getCanonicalBlogSlug(post);
  const localizedSlug = locale === 'en' || post.lang === locale ? post.slug : null;

  return localizedSlug
    ? {
        href: { pathname: '/blog/[slug]' as const, params: { slug: localizedSlug } },
      }
    : {
        href: { pathname: '/blog/[slug]' as const, params: { slug: canonicalSlug } },
        locale: 'en' as const,
        hrefLang: 'en',
      };
}

function normalizeImageSrc(src?: string | null) {
  const trimmed = typeof src === 'string' ? src.trim() : '';
  if (!trimmed) {
    return '/og/price-before.png';
  }
  if (trimmed.startsWith('http')) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

const localeDateMap: Record<AppLocale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
};

const DEFAULT_BLOG_FAQ = {
  title: 'Blog FAQ',
  items: [
    {
      question: 'How often do new posts ship?',
      answer:
        'We publish every week (and sometimes twice a week) as engines shift. Subscribe in the workspace to get a digest when new coverage lands.',
    },
    {
      question: 'Can I suggest a topic or request coverage?',
      answer:
        'Yes—send topics to press@maxvideo.ai and include reference renders if you can. We prioritize stories that help production teams stay current.',
    },
    {
      question: 'Where can I find release notes?',
      answer:
        'Feature-level updates live in the product changelog, and API updates post inside the developer docs. The blog covers higher-level workflows.',
    },
  ],
  footnote:
    'Need more detail? Email press@maxvideo.ai with your request and we’ll route it to the right producer.',
};

const PRESS_EMAIL = 'press@maxvideo.ai';

function renderPressEmail(text?: string) {
  if (typeof text !== 'string' || !text.includes(PRESS_EMAIL)) {
    return text;
  }
  const parts = text.split(PRESS_EMAIL);
  return parts.map((part, index) => (
    <span key={`press-email-${index}`}>
      {part}
      {index < parts.length - 1 ? (
        <ObfuscatedEmailLink
          user="press"
          domain="maxvideo.ai"
          label="press@maxvideo.ai"
          placeholder="press [at] maxvideo.ai"
        />
      ) : null}
    </span>
  ));
}

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale;
  const metaCopy = BLOG_META[locale];

  return buildSeoMetadata({
    locale,
    title: metaCopy.title,
    description: metaCopy.description,
    hreflangGroup: 'blog',
    slugMap: BLOG_SLUG_MAP,
    imageAlt: 'Blog overview.',
  });
}

export default async function BlogIndexPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const locale = params.locale;
  const posts = await getBlogPosts(locale);
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.blog;
  const faq = content.faq ?? DEFAULT_BLOG_FAQ;
  const metadataUrls = buildMetadataUrls(locale, BLOG_SLUG_MAP, { englishPath: '/blog' });
  const baseReadMore = content.cta ?? 'Read more';
  const featuredCopy = content.featured ?? { eyebrow: 'Featured story', title: 'Start with the post that matters now' };
  const recentCopy = content.recent ?? {
    eyebrow: 'Recent posts',
    title: 'More workflow notes, engine updates, and practical guides',
  };
  const formatReadMoreLabel = (title: string) => `${baseReadMore} — ${title}`;

  const articleListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: posts.map((post, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${metadataUrls.canonical}/${post.slug}`,
      name: post.title,
      description: post.description,
    })),
  };

  if (posts.length === 0) {
    return (
      <main className="container-page max-w-3xl section text-center">
        <div className="stack-gap-sm">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{content.empty}</p>
        </div>
      </main>
    );
  }

  const [featured, ...rest] = posts;
  const featuredLinkProps = getBlogLinkProps(locale, featured);

  return (
    <main className="bg-bg">
      <div className="stack-gap-lg">
        <header className="relative min-h-[440px] overflow-hidden border-b border-hairline bg-bg">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[url('/assets/blog/blog-hero-reference.webp')] bg-cover bg-center opacity-55 dark:bg-[url('/assets/blog/blog-hero-reference-dark.webp')] dark:opacity-70"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.88)_34%,rgba(255,255,255,0.48)_62%,rgba(255,255,255,0.10)_100%)] dark:bg-[linear-gradient(90deg,rgba(3,7,18,0.30)_0%,rgba(3,7,18,0.18)_42%,rgba(3,7,18,0.05)_76%,rgba(3,7,18,0.00)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg to-transparent" />
          <div className="container-page relative flex min-h-[440px] max-w-6xl items-center py-14">
            <div className="max-w-[520px]">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-primary">
                {content.hero.eyebrow ?? 'The Studio Journal'}
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-tight text-text-primary sm:text-6xl">
                {content.hero.title}
              </h1>
              <p className="mt-6 max-w-[52ch] text-base leading-7 text-text-secondary sm:text-lg">
                {content.hero.subtitle}
              </p>
              <Link
                href="#articles"
                className="mt-7 inline-flex items-center gap-2 rounded-[7px] bg-text-primary px-5 py-3 text-sm font-semibold text-bg shadow-card transition hover:bg-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {recentCopy.eyebrow}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </header>

        {(content.intro?.cards?.length ?? 0) > 0 ? (
          <section className="container-page max-w-6xl">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(content.intro?.cards ?? []).map((card) => (
                <article
                  key={card.title}
                  className="rounded-[8px] border border-hairline bg-white p-5 text-sm text-text-secondary shadow-[0_18px_54px_rgba(33,49,78,0.06)] transition hover:-translate-y-1 hover:shadow-float dark:bg-white/[0.055]"
                >
                  <h2 className="text-base font-semibold text-text-primary">{card.title}</h2>
                  <p className="mt-2 leading-7">{card.body}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="container-page max-w-6xl stack-gap">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-micro text-brand">{featuredCopy.eyebrow}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                {featuredCopy.title}
              </h2>
            </div>
          </div>

          <article className="group overflow-hidden rounded-[8px] border border-hairline bg-white shadow-[0_18px_54px_rgba(33,49,78,0.06)] transition hover:-translate-y-1 hover:shadow-float dark:bg-white/[0.055]">
            <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-stretch">
              <div className="relative min-h-[280px] overflow-hidden bg-bg sm:min-h-[360px]">
                <Image
                  src={normalizeImageSrc(featured.image)}
                  alt={featured.title}
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(min-width: 1280px) 760px, (min-width: 1024px) 60vw, 100vw"
                  className="object-cover object-center transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
              </div>
              <div className="flex flex-col justify-between px-6 py-6 sm:px-8 sm:py-8">
                <div className="stack-gap">
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-micro">
                    <span className="rounded-pill bg-surface-2 px-3 py-1 font-semibold text-brand">
                      {new Date(featured.date).toLocaleDateString(localeDateMap[locale], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {featured.keywords?.slice(0, 2).map((keyword) => (
                      <span key={keyword} className="rounded-pill bg-bg px-3 py-1 font-semibold text-text-muted">
                        {keyword}
                      </span>
                    ))}
                  </div>
                  <div className="stack-gap-sm">
                    <h3 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                      <Link {...featuredLinkProps} className="transition hover:text-brandHover">
                        {featured.title}
                      </Link>
                    </h3>
                    <p className="text-base leading-relaxed text-text-secondary sm:text-lg">{featured.description}</p>
                  </div>
                </div>
                <Link
                  {...featuredLinkProps}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-link transition hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  {formatReadMoreLabel(featured.title)}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </article>
        </section>

        {rest.length > 0 ? (
          <section id="articles" className="container-page max-w-6xl scroll-mt-28 stack-gap">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-micro text-brand">{recentCopy.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                  {recentCopy.title}
                </h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((post) => {
                const postLinkProps = getBlogLinkProps(locale, post);
                return (
                  <article
                    key={`${getCanonicalBlogSlug(post)}-${locale}`}
                    className="group overflow-hidden rounded-[8px] border border-hairline bg-white shadow-[0_18px_54px_rgba(33,49,78,0.06)] transition hover:-translate-y-1 hover:shadow-float dark:bg-white/[0.055]"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-bg">
                      <Image
                        src={normalizeImageSrc(post.image)}
                        alt={post.title ?? 'MaxVideoAI blog cover'}
                        fill
                        loading="lazy"
                        decoding="async"
                        sizes="(min-width: 1280px) 360px, (min-width: 768px) 50vw, 100vw"
                        className="object-cover object-center transition duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div className="stack-gap-sm px-5 py-5">
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-micro text-text-muted">
                        <span>
                          {new Date(post.date).toLocaleDateString(localeDateMap[locale], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {post.keywords?.slice(0, 1).map((keyword) => (
                          <span key={keyword} className="rounded-pill bg-bg px-3 py-1 font-semibold text-brand">
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <h3 className="line-clamp-2 text-xl font-semibold text-text-primary transition group-hover:text-brand">
                        <Link {...postLinkProps}>{post.title}</Link>
                      </h3>
                      <p className="line-clamp-3 text-sm leading-7 text-text-secondary">{post.description}</p>
                      <Link
                        {...postLinkProps}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-link transition hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                      >
                        {baseReadMore}
                        <span aria-hidden>→</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="container-page max-w-6xl">
        <div className="rounded-[8px] border border-hairline bg-white p-8 shadow-[0_18px_54px_rgba(33,49,78,0.06)] dark:bg-white/[0.055] sm:p-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-micro text-brand">FAQ</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{faq.title}</h2>
          </div>
          <dl className="mt-6 grid gap-4 md:grid-cols-3">
            {faq.items.map((item) => (
              <div key={item.question} className="rounded-[22px] border border-hairline bg-surface-2/90 px-5 py-5 text-sm text-text-secondary backdrop-blur">
                <dt className="font-semibold text-text-primary">{item.question}</dt>
                <dd className="mt-3 leading-7">{renderPressEmail(item.answer)}</dd>
              </div>
            ))}
          </dl>
          {faq.footnote ? <p className="mt-5 text-xs text-text-muted">{renderPressEmail(faq.footnote)}</p> : null}
        </div>
        </section>
      </div>

      <Script id="blog-list-jsonld" type="application/ld+json">
        {JSON.stringify(articleListSchema)}
      </Script>
    </main>
  );
}
