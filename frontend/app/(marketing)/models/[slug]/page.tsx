import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import FaqJsonLd from '@/components/FaqJsonLd';
import { listFalEngines, getFalEngineBySlug } from '@/config/falEngines';
import { CURRENCY_LOCALE } from '@/lib/intl';

type PageParams = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return listFalEngines().map((entry) => ({ slug: entry.modelSlug }));
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';

const MODEL_META: Record<
  string,
  {
    title: string;
    description: string;
    og: string;
  }
> = {
  'sora-2': {
    title: 'Sora 2 — cinematic text-to-video',
    description: 'Cinematic, photoreal motion with audio. See presets, limits, and pricing.',
    og: '/hero/sora2.jpg',
  },
  'sora-2-pro': {
    title: 'Sora 2 Pro — studio-grade Sora presets',
    description: 'Studio-grade Sora workflows and constraints. Presets, tips, and costs.',
    og: '/hero/sora2.jpg',
  },
  'veo-3-1': {
    title: 'Veo 3.1 — ads & b-roll workhorse',
    description: 'Great for ads and b-roll. Longer clips, audio support, reliable motion.',
    og: '/hero/veo3.jpg',
  },
  'veo-3-fast': {
    title: 'Veo 3 Fast — quick iterations',
    description: 'Faster Veo iterations for explorations and bridges. Specs & pricing.',
    og: '/hero/veo3.jpg',
  },
  'veo-3-1-fast': {
    title: 'Veo 3.1 Fast — frame-to-frame bridges',
    description: 'Bridge first-to-last frames with Veo 3.1 Fast. Presets and best practices.',
    og: '/hero/veo3.jpg',
  },
  'pika-text-to-video': {
    title: 'Pika 2.2 — text-to-video',
    description: 'Fast prompts, multiple aspect ratios, and audio support. Cheap explorations.',
    og: '/hero/pika-22.jpg',
  },
  'pika-image-to-video': {
    title: 'Pika 2.2 — image-to-video',
    description: 'Animate images with stylized motion. Tips, limits, and costs.',
    og: '/hero/pika-22.jpg',
  },
  'minimax-hailuo-02-text': {
    title: 'MiniMax Hailuo 02 — text-to-video',
    description: 'Stylised motion at low cost. Presets and pricing.',
    og: '/hero/minimax-video01.jpg',
  },
  'minimax-hailuo-02-image': {
    title: 'MiniMax Hailuo 02 — image-to-video',
    description: 'Image-to-video loops and stylised motion. Presets and tips.',
    og: '/hero/minimax-video01.jpg',
  },
};

function toAbsoluteUrl(url?: string | null): string {
  if (!url) return `${SITE}/og/price-before.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = params;
  const engine = getFalEngineBySlug(slug);
  const { dictionary } = resolveDictionary();
  if (!engine) {
    return {
      title: 'Model not found - MaxVideo AI',
      robots: { index: false, follow: false },
    };
  }

  const defaultMeta = {
    title: `${engine.marketingName} — MaxVideo AI`,
    description: engine.seo.description ?? dictionary.models.hero.subtitle,
    og: engine.media?.imagePath ?? '/og/price-before.png',
  };
  const resolvedMeta = MODEL_META[slug] ?? defaultMeta;
  const canonicalUrl = `${SITE}${engine.seo.canonicalPath}`;
  const ogImage = toAbsoluteUrl(resolvedMeta.og ?? defaultMeta.og);
  const title = `${resolvedMeta.title} — MaxVideo AI`;
  const description = resolvedMeta.description ?? defaultMeta.description;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      siteName: 'MaxVideo AI',
      title,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: resolvedMeta.title,
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

export default function ModelDetailPage({ params }: PageParams) {
  const { slug } = params;
  const engine = getFalEngineBySlug(slug);
  const { dictionary } = resolveDictionary();
  if (!engine) {
    notFound();
  }

  const availabilityLabels = dictionary.models.availabilityLabels;
  const availabilityKey = engine.availability as keyof typeof availabilityLabels;
  const availabilityLabel = availabilityLabels[availabilityKey] ?? engine.availability;
  const brand = PARTNER_BRAND_MAP.get(engine.brandId);
  const showSoraSeo = engine.modelSlug.startsWith('sora-2');
  const faqEntries = engine.faqs ?? [];
  const faqJsonLd = faqEntries.map(({ question, answer }) => ({ q: question, a: answer }));
  const pricingHint = engine.pricingHint;

  const platformPriceInfo = (() => {
    if (!pricingHint || typeof pricingHint.amountCents !== 'number') return null;
    const currency = pricingHint.currency ?? 'USD';
    const platformCents = Math.round(pricingHint.amountCents * 1.3);
    const priceFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency });
    const descriptorParts: string[] = [];
    if (pricingHint.label) descriptorParts.push(pricingHint.label);
    const durationLabel =
      typeof pricingHint.durationSeconds === 'number' && pricingHint.durationSeconds > 0
        ? `${pricingHint.durationSeconds}s`
        : null;
    if (durationLabel) descriptorParts.push(durationLabel);
    if (pricingHint.resolution) descriptorParts.push(pricingHint.resolution);
    const descriptor = descriptorParts.length ? descriptorParts.join(' · ') : null;
    return {
      amount: priceFormatter.format(platformCents / 100),
      descriptor,
    };
  })();

  const soraFaqSchema = showSoraSeo
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How does billing work with FAL credits or my OpenAI API key?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'MaxVideo AI routes Sora 2 runs through FAL by default. Drop your own OpenAI API key in the app to bill usage directly through OpenAI—the interface keeps showing an indicative rate and adds a "Billed by OpenAI" badge so finance teams stay aligned.',
            },
          },
        ],
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
        description: engine.seo.description,
        isAccessibleForFree: false,
      }
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      {showSoraSeo && soraFaqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(soraFaqSchema) }} />
      )}
      {showSoraSeo && soraSoftwareSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(soraSoftwareSchema) }} />
      )}
      <Link href="/models" className="text-sm font-semibold text-accent hover:text-accentSoft">
        {'<-'} {dictionary.models.hero.title}
      </Link>
      <header className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          {brand && engine.logoPolicy === 'logoAllowed' ? (
            <span className="flex items-center">
              <Image src={brand.assets.light.svg} alt={`${engine.marketingName} logo`} width={140} height={32} className="h-9 w-auto dark:hidden" />
              <Image src={brand.assets.dark.svg} alt={`${engine.marketingName} logo`} width={140} height={32} className="hidden h-9 w-auto dark:inline-flex" />
            </span>
          ) : null}
          <div>
            <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{engine.marketingName}</h1>
            <p className="text-sm uppercase tracking-micro text-text-muted">{engine.versionLabel}</p>
          </div>
          <span
            className={clsx(
              'rounded-pill border px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary',
              AVAILABILITY_BADGE_CLASS[availabilityKey]
            )}
          >
            {availabilityLabel}
          </span>
        </div>
      {engine.seo.description ? <p className="text-sm text-text-secondary">{engine.seo.description}</p> : null}
      </header>

      <section className="mt-10 space-y-4">
        <div className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">Overview</h2>
          <dl className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">Brand</dt>
              <dd>{brand ? brand.label : engine.brandId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">Engine ID</dt>
              <dd>{engine.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">Slug</dt>
              <dd>/models/{engine.modelSlug}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">Logo policy</dt>
              <dd>{engine.logoPolicy === 'logoAllowed' ? 'Logo usage permitted' : 'Text-only (wordmark)'}</dd>
            </div>
            {platformPriceInfo ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-micro text-text-muted">Platform price (incl. 30% fee)</dt>
                <dd>
                  {platformPriceInfo.amount}
                  {platformPriceInfo.descriptor ? <span className="text-xs text-text-muted"> · {platformPriceInfo.descriptor}</span> : null}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      {engine.prompts.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Prompt ideas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {engine.prompts.map((entry) => (
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
          <h2 className="text-lg font-semibold text-text-primary">FAQ</h2>
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

      <footer className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/pricing"
          className="inline-flex items-center rounded-pill border border-hairline px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent"
        >
          View pricing
        </Link>
        <Link
          href="/app"
          className="inline-flex items-center rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
        >
          Launch workspace
        </Link>
      </footer>
      {faqEntries.length > 0 ? <FaqJsonLd qa={faqJsonLd} /> : null}
    </div>
  );
}
