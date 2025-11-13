import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import { listFalEngines, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { locales, localePathnames } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { resolveLocalesForEnglishPath } from '@/lib/seo/alternateLocales';
import { getEngineLocalized } from '@/lib/models/i18n';
import { serializeJsonLd } from '../model-jsonld';

type PageParams = {
  params: {
    locale: AppLocale;
    slug: string;
  };
};

export const dynamicParams = false;

export function generateStaticParams() {
  const engines = listFalEngines();
  return locales.flatMap((locale) => engines.map((entry) => ({ locale, slug: entry.modelSlug })));
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';
const MODELS_BASE_PATH_MAP = buildSlugMap('models');

function buildDetailSlugMap(slug: string) {
  return locales.reduce<Record<AppLocale, string>>((acc, locale) => {
    const base = MODELS_BASE_PATH_MAP[locale] ?? 'models';
    acc[locale] = `${base}/${slug}`;
    return acc;
  }, {} as Record<AppLocale, string>);
}

type DetailCopy = {
  backLabel: string;
  overviewTitle: string;
  overview: {
    brand: string;
    engineId: string;
    slug: string;
    logoPolicy: string;
    platformPrice: string;
  };
  logoPolicies: {
    logoAllowed: string;
    textOnly: string;
  };
  promptsTitle: string;
  faqTitle: string;
  buttons: {
    pricing: string;
    launch: string;
  };
  breadcrumb: {
    home: string;
    models: string;
  };
};

const DEFAULT_DETAIL_COPY: DetailCopy = {
  backLabel: '← Back to models',
  overviewTitle: 'Overview',
  overview: {
    brand: 'Brand',
    engineId: 'Engine ID',
    slug: 'Slug',
    logoPolicy: 'Logo policy',
    platformPrice: 'Live pricing updates inside the Generate workspace.',
  },
  logoPolicies: {
    logoAllowed: 'Logo usage permitted',
    textOnly: 'Text-only (wordmark)',
  },
  promptsTitle: 'Prompt ideas',
  faqTitle: 'FAQ',
  buttons: {
    pricing: 'Open Generate',
    launch: 'Launch workspace',
  },
  breadcrumb: {
    home: 'Home',
    models: 'Models',
  },
};

const MODEL_OG_IMAGE_MAP: Record<string, string> = {
  'sora-2':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'sora-2-pro':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'veo-3-1': '/hero/veo3.jpg',
  'veo-3-fast': '/hero/veo3.jpg',
  'veo-3-1-fast': '/hero/veo3.jpg',
  'pika-text-to-video': '/hero/pika-22.jpg',
  'pika-image-to-video': '/hero/pika-22.jpg',
  'minimax-hailuo-02-text': '/hero/minimax-video01.jpg',
  'minimax-hailuo-02-image': '/hero/minimax-video01.jpg',
};

function toAbsoluteUrl(url?: string | null): string {
  if (!url) return `${SITE}/og/price-before.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug, locale } = params;
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    return {
      title: 'Model not found - MaxVideo AI',
      robots: { index: false, follow: false },
    };
  }

  const localized = await getEngineLocalized(slug, locale);
  const detailSlugMap = buildDetailSlugMap(slug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${slug}`));
  const metadataUrls = buildMetadataUrls(locale, detailSlugMap, { availableLocales: publishableLocales });
  const fallbackTitle = engine.seo.title ?? `${engine.marketingName} — MaxVideo AI`;
  const title = localized.seo.title ?? fallbackTitle;
  const description =
    localized.seo.description ??
    engine.seo.description ??
    'Explore availability, prompts, pricing, and render policies for this model on MaxVideoAI.';
  const ogImagePath = localized.seo.image ?? MODEL_OG_IMAGE_MAP[slug] ?? engine.media?.imagePath ?? '/og/price-before.png';
  const ogImage = toAbsoluteUrl(ogImagePath);

  return {
    title,
    description,
    alternates: {
      canonical: metadataUrls.canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      type: 'article',
      url: metadataUrls.canonical,
      siteName: 'MaxVideo AI',
      title,
      description,
      locale: metadataUrls.ogLocale,
      alternateLocale: metadataUrls.alternateOg,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function ModelDetailPage({ params }: PageParams) {
  const { slug, locale: routeLocale } = params;
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    notFound();
  }
  const { dictionary } = await resolveDictionary();
  const activeLocale = routeLocale ?? 'en';
  if (process.env.NODE_ENV === 'development') {
    console.info('[models/page] locale debug', { slug, routeLocale, activeLocale });
  }
  const localizedContent = await getEngineLocalized(slug, activeLocale);
  const detailSlugMap = buildDetailSlugMap(slug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${slug}`));
  const metadataUrls = buildMetadataUrls(activeLocale, detailSlugMap, { availableLocales: publishableLocales });
  const allEngines = listFalEngines();
  const rankEngine = (entry: FalEngineEntry) => (entry.family === engine.family ? 0 : 1);
  type RelatedCopyContent = { title?: string; subtitle?: string; cta?: string };
  const relatedContent = (dictionary.models as typeof dictionary.models & { related?: RelatedCopyContent }).related ?? {};
  const relatedEngines = allEngines
    .filter((entry) => entry.modelSlug !== slug)
    .sort((a, b) => {
      const familyDiff = rankEngine(a) - rankEngine(b);
      if (familyDiff !== 0) {
        return familyDiff;
      }
      return (a.marketingName ?? a.engine.label).localeCompare(b.marketingName ?? b.engine.label);
    })
    .slice(0, 3);
  const relatedCopy = {
    title: relatedContent.title ?? 'Explore other engines',
    subtitle:
      relatedContent.subtitle ?? 'Compare price tiers, latency, and prompt presets across the rest of the catalog.',
    cta: relatedContent.cta ?? 'View model →',
  };

  const detailCopy: DetailCopy = {
    ...DEFAULT_DETAIL_COPY,
    ...(dictionary.models.detail ?? {}),
    overview: {
      ...DEFAULT_DETAIL_COPY.overview,
      ...(dictionary.models.detail?.overview ?? {}),
    },
    logoPolicies: {
      ...DEFAULT_DETAIL_COPY.logoPolicies,
      ...(dictionary.models.detail?.logoPolicies ?? {}),
    },
    buttons: {
      ...DEFAULT_DETAIL_COPY.buttons,
      ...(dictionary.models.detail?.buttons ?? {}),
    },
    breadcrumb: {
      ...DEFAULT_DETAIL_COPY.breadcrumb,
      ...(dictionary.models.detail?.breadcrumb ?? {}),
    },
  };

  const marketingName = localizedContent.marketingName ?? engine.marketingName;
  const versionLabel = localizedContent.versionLabel ?? engine.versionLabel;
  const seoDescription = localizedContent.seo.description ?? engine.seo.description ?? null;
  const overviewSummary = localizedContent.overview ?? seoDescription;
  const heroContent = localizedContent.hero;
  const introText = heroContent?.intro ?? overviewSummary;
  const bestUseCases = localizedContent.bestUseCases;
  const technicalOverview = localizedContent.technicalOverview ?? [];
  const technicalOverviewTitle = localizedContent.technicalOverviewTitle ?? 'Technical overview';
  const promptStructure = localizedContent.promptStructure;
  const tips = localizedContent.tips;
  const compareLink = localizedContent.compareLink;
  const heroPrimaryCta = heroContent?.ctaPrimary;
  const secondaryCtas = heroContent?.secondaryLinks ?? [];
  const brand = PARTNER_BRAND_MAP.get(engine.brandId);
  const showSoraSeo = engine.modelSlug.startsWith('sora-2');
  const promptEntries =
    localizedContent.prompts.length > 0
      ? localizedContent.prompts
      : engine.prompts.map(({ title, prompt, notes }) => ({ title, prompt, notes }));
  const faqEntries =
    localizedContent.faqs.length > 0
      ? localizedContent.faqs
      : (engine.faqs ?? []).map(({ question, answer }) => ({ question, answer }));
  const pricingNotes = localizedContent.pricingNotes ?? null;
  const canonicalUrl = metadataUrls.canonical;
  const breadcrumbTitleBase = localizedContent.seo.title ?? marketingName ?? slug;
  const breadcrumbTitle = breadcrumbTitleBase.replace(/ —.*$/, '');
  const localePathPrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale].replace(/^\/+/, '')}` : '';
  const homePathname = localePathPrefix || '/';
  const localizedHomeUrl = homePathname === '/' ? `${SITE}/` : `${SITE}${homePathname}`;
  const localizedModelsSlug = (MODELS_BASE_PATH_MAP[activeLocale] ?? 'models').replace(/^\/+/, '');
  const modelsPathname =
    homePathname === '/'
      ? `/${localizedModelsSlug}`
      : `${homePathname.replace(/\/+$/, '')}/${localizedModelsSlug}`.replace(/\/{2,}/g, '/');
  const localizedModelsUrl = `${SITE}${modelsPathname}`;
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: detailCopy.breadcrumb.home,
        item: localizedHomeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: detailCopy.breadcrumb.models,
        item: localizedModelsUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: breadcrumbTitle,
        item: canonicalUrl,
      },
    ],
  };
  const platformPriceInfo = detailCopy.overview.platformPrice
    ? {
        label: detailCopy.overview.platformPrice,
        href: '/generate',
      }
    : null;

  const soraSoftwareSchema = showSoraSeo
    ? {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'OpenAI Sora 2 via MaxVideo AI',
        applicationCategory: 'VideoGenerationApplication',
        operatingSystem: 'Web',
        provider: {
          '@type': 'Organization',
          name: 'MaxVideo AI',
          url: 'https://maxvideoai.com',
        },
        description: seoDescription ?? undefined,
        isAccessibleForFree: false,
      }
    : null;
  const schemaPayloads = [showSoraSeo && soraSoftwareSchema, breadcrumbLd].filter(Boolean) as object[];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      {schemaPayloads.map((schema, index) => (
        <script
          key={`schema-${index}`}
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
      <Link href="/models" className="text-sm font-semibold text-accent hover:text-accentSoft">
        {detailCopy.backLabel}
      </Link>
      <header className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          {brand && engine.logoPolicy === 'logoAllowed' ? (
            <span className="flex items-center">
              <Image src={brand.assets.light.svg} alt={`${marketingName} logo`} width={140} height={32} className="h-9 w-auto dark:hidden" />
              <Image src={brand.assets.dark.svg} alt={`${marketingName} logo`} width={140} height={32} className="hidden h-9 w-auto dark:inline-flex" />
            </span>
          ) : null}
          <div>
            <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">
              {heroContent?.title ?? marketingName}
            </h1>
            {versionLabel ? (
              <p className="text-sm uppercase tracking-micro text-text-muted">{versionLabel}</p>
            ) : null}
          </div>
          
        </div>
      {introText ? <p className="text-sm text-text-secondary">{introText}</p> : null}
      </header>

      {(heroPrimaryCta?.label || secondaryCtas.length) ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {heroPrimaryCta?.label && heroPrimaryCta.href ? (
            <Link
              href={heroPrimaryCta.href}
              className="inline-flex items-center rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
            >
              {heroPrimaryCta.label}
            </Link>
          ) : null}
          {secondaryCtas
            .filter((cta): cta is { label: string; href: string } => Boolean(cta.label && cta.href))
            .map((cta) => (
              <Link
                key={`${cta.href}-${cta.label}`}
                href={cta.href!}
                className="inline-flex items-center rounded-pill border border-hairline px-5 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent"
              >
                {cta.label}
              </Link>
            ))}
        </div>
      ) : null}

      {bestUseCases?.items && bestUseCases.items.length ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">
            {bestUseCases.title ?? 'Best use cases'}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            {bestUseCases.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {technicalOverview.length ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{technicalOverviewTitle}</h2>
          <div className="mt-4 grid gap-4 text-sm text-text-secondary sm:grid-cols-2">
            {technicalOverview.map((entry, index) => (
              <article key={`${entry.label ?? index}-${entry.body}`} className="space-y-1">
                {entry.label ? <strong className="block text-text-primary">{entry.label}</strong> : null}
                {entry.body ? <p>{entry.body}</p> : null}
                {entry.link?.href && entry.link?.label ? (
                  <a
                    href={entry.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-accent hover:text-accentSoft"
                  >
                    {entry.link.label}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {promptStructure ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{promptStructure.title ?? 'Prompt structure'}</h2>
          {promptStructure.quote ? (
            <blockquote className="mt-3 border-l-2 border-accent pl-3 text-sm text-text-secondary italic">
              {promptStructure.quote}
            </blockquote>
          ) : null}
          {promptStructure.description ? (
            <p className="mt-3 text-sm text-text-secondary">{promptStructure.description}</p>
          ) : null}
          {promptStructure.steps && promptStructure.steps.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
              {promptStructure.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {tips?.items && tips.items.length ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{tips.title ?? 'Tips & tricks'}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            {tips.items.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {compareLink?.href && compareLink.label ? (
        <p className="mt-6 text-sm text-text-secondary">
          {compareLink.before ?? ''}
          <Link href={compareLink.href} className="font-semibold text-accent hover:text-accentSoft">
            {compareLink.label}
          </Link>
          {compareLink.after ?? ''}
        </p>
      ) : null}

      <section className="mt-10 space-y-4">
        <div className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.overviewTitle}</h2>
          <dl className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.brand}</dt>
              <dd>{brand ? brand.label : engine.brandId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.engineId}</dt>
              <dd>{engine.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.slug}</dt>
              <dd>/models/{engine.modelSlug}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.logoPolicy}</dt>
              <dd>{detailCopy.logoPolicies[engine.logoPolicy as keyof DetailCopy['logoPolicies']] ?? detailCopy.logoPolicies.textOnly}</dd>
            </div>
            {platformPriceInfo ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.platformPrice}</dt>
                <dd>
                  <Link href={platformPriceInfo.href} className="text-sm font-semibold text-accent hover:text-accentSoft">
                    {platformPriceInfo.label}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
          {pricingNotes ? <p className="mt-3 text-xs text-text-muted">{pricingNotes}</p> : null}
        </div>
      </section>

      {promptEntries.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.promptsTitle}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {promptEntries.map((entry) => (
              <article key={entry.title} className="rounded-card border border-hairline bg-white p-4 text-sm text-text-secondary shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{entry.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{entry.prompt}</p>
                {entry.notes ? <p className="mt-2 text-xs text-text-muted">{entry.notes}</p> : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {faqEntries.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.faqTitle}</h2>
          <div className="space-y-3 text-sm text-text-secondary">
            {faqEntries.map(({ question, answer }) => (
              <article key={question} className="rounded-card border border-hairline bg-white p-4 shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{question}</h3>
                <p className="mt-1 text-sm text-text-secondary">{answer}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {relatedEngines.length ? (
        <section className="mt-12">
          <div className="mb-6 space-y-2">
            <h2 className="text-xl font-semibold text-text-primary">{relatedCopy.title}</h2>
            <p className="text-sm text-text-secondary">{relatedCopy.subtitle}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedEngines.map((candidate) => {
              const label = candidate.marketingName ?? candidate.engine.label;
              return (
                <article key={candidate.modelSlug} className="rounded-2xl border border-hairline bg-white/90 p-5 shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{candidate.brandId}</p>
                  <h3 className="mt-2 text-lg font-semibold text-text-primary">{label}</h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    {candidate.seo?.description ?? 'Latency, pricing, and prompt guides are documented on the detail page.'}
                  </p>
                  <Link
                    href={{ pathname: '/models/[slug]', params: { slug: candidate.modelSlug } }}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-accentSoft"
                  >
                    {relatedCopy.cta} <span aria-hidden>→</span>
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <footer className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/generate"
          className="inline-flex items-center rounded-pill border border-hairline px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent"
        >
          {detailCopy.buttons.pricing}
        </Link>
        <Link
          href="/app"
          className="inline-flex items-center rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
        >
          {detailCopy.buttons.launch}
        </Link>
      </footer>
    </div>
  );
}
