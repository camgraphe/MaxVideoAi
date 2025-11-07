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

const BLOG_SLUG_MAP = buildSlugMap('blog');
const BLOG_META = {
  en: {
    title: 'Blog — MaxVideo AI',
    description: 'News on new engines, case studies, prompt guides, and price-before best practices.',
  },
  fr: {
    title: 'Blog — MaxVideoAI',
    description: 'Actualités moteurs, études de cas, guides de prompts et bonnes pratiques prix-avant.',
  },
  es: {
    title: 'Blog — MaxVideoAI',
    description: 'Novedades de motores, casos de uso, guías de prompts y mejores prácticas de precio previo.',
  },
} satisfies Record<AppLocale, { title: string; description: string }>;

async function getBlogPosts(locale: AppLocale) {
  const localized = await getContentEntries(`content/${locale}/blog`);
  if (localized.length > 0 || locale === 'en') {
    return localized;
  }
  return getContentEntries('content/en/blog');
}

const localeDateMap: Record<AppLocale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
};

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const metadataUrls = buildMetadataUrls(locale, BLOG_SLUG_MAP);
  const metaCopy = BLOG_META[locale];

  return {
    title: metaCopy.title,
    description: metaCopy.description,
    alternates: {
      canonical: metadataUrls.canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      title: metaCopy.title,
      description: metaCopy.description,
      url: metadataUrls.canonical,
      siteName: 'MaxVideoAI',
      locale: metadataUrls.ogLocale,
      alternateLocale: metadataUrls.alternateOg,
      images: [
        {
          url: '/og/price-before.png',
          width: 1200,
          height: 630,
          alt: 'Blog overview.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: metaCopy.title,
      description: metaCopy.description,
    },
  };
}

export default async function BlogIndexPage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale;
  const posts = await getBlogPosts(locale);
  const { dictionary } = await resolveDictionary();
  const content = dictionary.blog;
  const metadataUrls = buildMetadataUrls(locale, BLOG_SLUG_MAP);

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

      <section className="mt-10 space-y-6 rounded-[28px] border border-hairline bg-white/90 p-8 text-sm text-text-secondary shadow-card sm:p-10">
        <p>
          MaxVideoAI’s journal covers everything we learn while routing frontier video engines for real production
          teams. We document prompt patterns, pricing changes, latency shifts, and the workflows that keep agencies on
          schedule when models rotate. Every story is written from live usage—not a press release.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-micro text-text-primary">Model deep dives</h2>
            <p className="mt-2">
              Comparisons and capability notes for Sora 2, Veo 3, Pika 2.2, MiniMax Hailuo 02, and the engines queued
              next in our workspace.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-micro text-text-primary">Workflow tactics</h2>
            <p className="mt-2">
              Sequenced prompting, audio integration, and pricing guardrails that help teams ship branded stories
              without wasting credits.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-micro text-text-primary">Customer stories</h2>
            <p className="mt-2">
              How studios and marketers in Europe and North America deploy the same brief across multiple engines and
              keep review cycles moving.
            </p>
          </div>
        </div>
      </section>

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

      <section className="mt-16 rounded-[28px] border border-hairline bg-white/90 p-8 shadow-card sm:p-10">
        <h2 className="text-lg font-semibold text-text-primary">Blog FAQ</h2>
        <dl className="mt-6 space-y-5 text-sm text-text-secondary">
          <div>
            <dt className="font-semibold text-text-primary">How often do new posts ship?</dt>
            <dd className="mt-2">
              We publish every one to two weeks, aligned with notable engine releases or major workflow updates that hit
              production teams.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Can I suggest a topic or request coverage?</dt>
            <dd className="mt-2">
              Yes—send topics to <a className="font-semibold text-accent hover:text-accentSoft" href="mailto:press@maxvideo.ai">press@maxvideo.ai</a>{' '}
              and include the use case or engine you need documented.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Where can I find release notes?</dt>
            <dd className="mt-2">
              Feature-level updates live in the <Link className="font-semibold text-accent hover:text-accentSoft" href="/changelog">product changelog</Link>,
              while the blog focuses on guidance, comparisons, and field notes.
            </dd>
          </div>
        </dl>
      </section>

      <Script id="blog-list-jsonld" type="application/ld+json">
        {JSON.stringify(articleListSchema)}
      </Script>
    </div>
  );
}
