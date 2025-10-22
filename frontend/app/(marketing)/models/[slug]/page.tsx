import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import FaqJsonLd from '@/components/FaqJsonLd';
import { listFalEngines, getFalEngineBySlug, type FalEnginePricingHint } from '@/config/falEngines';

type PageParams = {
  params: {
    slug: string;
  };
};

function formatPricingHint(hint: FalEnginePricingHint): string {
  const amount = (hint.amountCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: hint.currency,
    minimumFractionDigits: 2,
  });
  if (hint.label) {
    return `${amount} ${hint.label}`;
  }
  const descriptors: string[] = [];
  if (typeof hint.durationSeconds === 'number') {
    descriptors.push(`${hint.durationSeconds}s`);
  }
  if (hint.resolution) {
    descriptors.push(hint.resolution);
  }
  return descriptors.length ? `${amount} (${descriptors.join(' / ')})` : amount;
}

export function generateStaticParams() {
  return listFalEngines().map((entry) => ({ slug: entry.modelSlug }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = params;
  const engine = getFalEngineBySlug(slug);
  const { dictionary } = resolveDictionary();
  if (!engine) {
    return {
      title: 'Model not found - MaxVideo AI',
    };
  }

  const title = engine.seo.title;
  const description = engine.seo.description ?? dictionary.models.hero.subtitle;

  return {
    title,
    description,
    alternates: {
      canonical: `https://maxvideoai.com${engine.seo.canonicalPath}`,
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

  const availabilityLabel = dictionary.models.availabilityLabels[engine.availability] ?? engine.availability;
  const brand = PARTNER_BRAND_MAP.get(engine.brandId);
  const showSoraSeo = engine.modelSlug === 'sora-2';
  const faqEntries = engine.faqs ?? [];
  const faqJsonLd = faqEntries.map(({ question, answer }) => ({ q: question, a: answer }));
  const pricingHint = engine.pricingHint ? formatPricingHint(engine.pricingHint) : null;

  const soraFaqSchema = showSoraSeo
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How does pricing work with FAL credits or my OpenAI API key?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'MaxVideo AI routes Sora 2 runs through FAL by default at $0.10 per second in 720p. Drop your own OpenAI API key in the app to bill usage directly through OpenAI-the interface keeps showing the rate as guidance and adds a "Billed by OpenAI" badge so finance teams stay aligned.',
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
        offers: [
          {
            '@type': 'Offer',
            description: 'Base HD 720p renders billed via FAL credits when no OpenAI API key is provided.',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              priceCurrency: 'USD',
              price: 0.1,
              unitCode: 'SEC',
            },
          },
          {
            '@type': 'Offer',
            description: 'Pro tier - 720p with OpenAI API key or FAL passthrough.',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              priceCurrency: 'USD',
              price: 0.3,
              unitCode: 'SEC',
            },
          },
          {
            '@type': 'Offer',
            description: 'Pro tier - 1080p with OpenAI API key support.',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              priceCurrency: 'USD',
              price: 0.5,
              unitCode: 'SEC',
            },
          },
        ],
        provider: {
          '@type': 'Organization',
          name: 'MaxVideo AI',
          url: 'https://maxvideoai.com',
        },
        description: engine.seo.description,
        isAccessibleForFree: false,
      }
    : null;

  const soraEndpoints = showSoraSeo
    ? [
        {
          title: 'Text -> Video (Base)',
          endpoint: 'fal-ai/sora-2/text-to-video',
          price: '$0.10/s / 720p / Audio on by default',
        },
        {
          title: 'Image -> Video (Base)',
          endpoint: 'fal-ai/sora-2/image-to-video',
          price: '$0.10/s / Auto resolution defaults with reference frame upload',
        },
        {
          title: 'Text -> Video (Pro)',
          endpoint: 'fal-ai/sora-2/text-to-video/pro',
          price: '$0.30/s / 720p / $0.50/s / 1080p',
        },
        {
          title: 'Image -> Video (Pro)',
          endpoint: 'fal-ai/sora-2/image-to-video/pro',
          price: '$0.30/s / 720p / $0.50/s / 1080p',
        },
      ]
    : [];

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
              AVAILABILITY_BADGE_CLASS[engine.availability]
            )}
          >
            {availabilityLabel}
          </span>
        </div>
      {engine.seo.description ? <p className="text-sm text-text-secondary">{engine.seo.description}</p> : null}
      </header>

      {showSoraSeo && soraEndpoints.length > 0 && (
        <section className="mt-8 space-y-4">
          <div className="rounded-card border border-accent/40 bg-accent/5 p-6 shadow-card">
            <h2 className="text-lg font-semibold text-text-primary">Sora 2 pricing & routing</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Base runs bill via FAL credits when you leave the OpenAI API key blank. Add your own key inside the workspace to move billing to OpenAI-our UI keeps
              showing the indicative rate and surfaces a "Billed by OpenAI" badge for finance.
            </p>
            <ul className="mt-4 space-y-3 text-sm text-text-secondary">
              {soraEndpoints.map((item) => (
                <li key={item.endpoint} className="rounded-input border border-border bg-white/80 p-3">
                  <p className="font-semibold text-text-primary">{item.title}</p>
                  <p className="text-[13px] text-text-muted">Endpoint: {item.endpoint}</p>
                  <p className="text-[13px] text-text-muted">{item.price}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

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
          </dl>
        </div>
        {pricingHint ? (
          <div className="rounded-card border border-dashed border-hairline bg-white p-6 text-sm text-text-muted shadow-card">
            {pricingHint}
          </div>
        ) : null}
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
