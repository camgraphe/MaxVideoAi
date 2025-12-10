import type { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import Script from 'next/script';
import clsx from 'clsx';
import { getContentEntries } from '@/lib/content/markdown';
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
      'The MaxVideoAI blog covers Sora, Veo and Pika updates, prompt guides, pricing changes, and workflow tactics from real production teams using AI video engines.',
  },
  fr: {
    title: 'Blog MaxVideoAI (FR)',
    description:
      'Le blog MaxVideoAI suit l’actu Sora, Veo et Pika, partage des guides de prompts, des ajustements tarifaires et tactiques workflow d’équipes de production IA.',
  },
  es: {
    title: 'Blog MaxVideoAI (ES)',
    description:
      'El blog de MaxVideoAI cubre Sora, Veo y Pika con guías de prompts, avisos de precios y tácticas de flujo usadas por equipos que operan motores de video IA.',
  },
} satisfies Record<AppLocale, { title: string; description: string }>;

async function getBlogPosts(locale: AppLocale) {
  const localized = await getContentEntries(`content/${locale}/blog`);
  if (localized.length > 0 || locale === 'en') {
    return localized;
  }
  return getContentEntries('content/en/blog');
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

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const metaCopy = BLOG_META[locale];

  return buildSeoMetadata({
    locale,
    title: metaCopy.title,
    description: metaCopy.description,
    slugMap: BLOG_SLUG_MAP,
    imageAlt: 'Blog overview.',
  });
}

export default async function BlogIndexPage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale;
  const posts = await getBlogPosts(locale);
  const { dictionary } = await resolveDictionary();
  const content = dictionary.blog;
  const faq = content.faq ?? DEFAULT_BLOG_FAQ;
  const metadataUrls = buildMetadataUrls(locale, BLOG_SLUG_MAP);
  const baseReadMore = content.cta ?? 'Read more';
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
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="mt-4 text-base text-text-secondary">{content.empty}</p>
      </main>
    );
  }

  const [featured, ...rest] = posts;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="rounded-[32px] border border-hairline bg-white/80 p-8 shadow-card backdrop-blur sm:p-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-micro text-accent">
              {content.hero.eyebrow ?? 'The Studio Journal'}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
              {content.hero.title}
            </h1>
            <p className="text-base text-text-secondary sm:text-lg">{content.hero.subtitle}</p>
          </div>
          <Link
            href={{ pathname: '/models/[slug]', params: { slug: 'sora-2' } }}
            className="inline-flex items-center gap-2 self-start rounded-pill border border-hairline bg-accent px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {content.hero.ctaLabel ?? 'Latest Sora coverage →'}
          </Link>
        </div>
      </header>

      <section className="mt-10 space-y-6 rounded-[28px] border border-hairline bg-white/90 p-8 text-sm text-text-secondary shadow-card sm:p-10">
        <p>{content.intro?.lead}</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {(content.intro?.cards ?? []).map((card) => (
            <div key={card.title}>
              <h2 className="text-sm font-semibold uppercase tracking-micro text-text-primary">{card.title}</h2>
              <p className="mt-2">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        <article className="group relative overflow-hidden rounded-[28px] border border-hairline bg-white/90 shadow-card transition hover:-translate-y-1 hover:shadow-float">
          <div className="relative h-64 w-full overflow-hidden sm:h-80">
            <Image
              src={normalizeImageSrc(featured.image)}
              alt={featured.title}
              fill
              priority
              fetchPriority="high"
              sizes="(min-width: 1280px) 720px, (min-width: 1024px) 600px, 100vw"
              className="object-cover object-center transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0" />
          </div>
          <div className="space-y-4 px-6 pb-8 pt-6 sm:px-10">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-micro text-accent">
              <span className="rounded-pill bg-accent/10 px-3 py-1 font-semibold text-accent">
                {new Date(featured.date).toLocaleDateString(localeDateMap[locale], {
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
                <Link href={{ pathname: '/blog/[slug]', params: { slug: featured.slug } }} className="transition hover:text-accent">
                  {featured.title}
                </Link>
              </h2>
              <p className="text-base text-text-secondary sm:text-lg">{featured.description}</p>
            </div>
            <Link
              href={{ pathname: '/blog/[slug]', params: { slug: featured.slug } }}
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {formatReadMoreLabel(featured.title)}
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
                  src={normalizeImageSrc(post.image)}
                  alt={post.title ?? 'MaxVideoAI blog cover'}
                  fill
                  loading="lazy"
                  decoding="async"
                  sizes="160px"
                  className="object-cover object-center transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-micro text-text-muted">
                  <span>
                    {new Date(post.date).toLocaleDateString(localeDateMap[locale], {
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
                  <Link href={{ pathname: '/blog/[slug]', params: { slug: post.slug } }}>{post.title}</Link>
                </h3>
                <p className="text-sm text-text-secondary">{post.description}</p>
                <Link
                  href={{ pathname: '/blog/[slug]', params: { slug: post.slug } }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  {formatReadMoreLabel(post.title ?? post.slug)}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-[28px] border border-hairline bg-white/90 p-8 shadow-card sm:p-10">
        <h2 className="text-lg font-semibold text-text-primary">{faq.title}</h2>
        <dl className="mt-6 space-y-5 text-sm text-text-secondary">
          {faq.items.map((item) => (
            <div key={item.question}>
              <dt className="font-semibold text-text-primary">{item.question}</dt>
              <dd className="mt-2">{renderPressEmail(item.answer)}</dd>
            </div>
          ))}
        </dl>
        {faq.footnote ? <p className="mt-4 text-xs text-text-muted">{renderPressEmail(faq.footnote)}</p> : null}
      </section>

      <Script id="blog-list-jsonld" type="application/ld+json">
        {JSON.stringify(articleListSchema)}
      </Script>
    </main>
  );
}
