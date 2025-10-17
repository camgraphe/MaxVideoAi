import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { getModelRoster, getModelBySlug } from '@/lib/model-roster';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

type PageParams = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return getModelRoster().map((entry) => ({ slug: entry.modelSlug }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = params;
  const rosterEntry = getModelBySlug(slug);
  const { dictionary } = resolveDictionary();
  const meta = dictionary.models.meta?.[slug];
  if (!rosterEntry || !meta) {
    return {
      title: 'Model not found — MaxVideo AI',
    };
  }

  const title = `${meta.displayName} — MaxVideo AI`;
  const description = meta.description ?? dictionary.models.hero.subtitle;

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.maxvideo.ai/models/${slug}`,
    },
  };
}

export default function ModelDetailPage({ params }: PageParams) {
  const { slug } = params;
  const rosterEntry = getModelBySlug(slug);
  const { dictionary } = resolveDictionary();
  if (!rosterEntry) {
    notFound();
  }

  const meta = dictionary.models.meta?.[slug];
  if (!meta) {
    notFound();
  }

  const availabilityLabel = dictionary.models.availabilityLabels[rosterEntry.availability] ?? rosterEntry.availability;
  const brand = PARTNER_BRAND_MAP.get(rosterEntry.brandId);
  const showSoraSeo = rosterEntry.modelSlug === 'sora-2';

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
                'MaxVideo AI routes Sora 2 runs through FAL by default at $0.10 per second in 720p. Drop your own OpenAI API key in the app to bill usage directly through OpenAI—the interface keeps showing the rate as guidance and adds a “Billed by OpenAI” badge so finance teams stay aligned.',
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
            description: 'Pro tier — 720p with OpenAI API key or FAL passthrough.',
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
            description: 'Pro tier — 1080p with OpenAI API key support.',
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
          url: 'https://www.maxvideo.ai',
        },
        description: meta.description,
        isAccessibleForFree: false,
      }
    : null;

  const soraEndpoints = showSoraSeo
    ? [
        {
          title: 'Text → Video (Base)',
          endpoint: 'fal-ai/sora-2/text-to-video',
          price: '$0.10/s · 720p · Audio on by default',
        },
        {
          title: 'Image → Video (Base)',
          endpoint: 'fal-ai/sora-2/image-to-video',
          price: '$0.10/s · Auto resolution defaults with reference frame upload',
        },
        {
          title: 'Text → Video (Pro)',
          endpoint: 'fal-ai/sora-2/text-to-video/pro',
          price: '$0.30/s · 720p · $0.50/s · 1080p',
        },
        {
          title: 'Image → Video (Pro)',
          endpoint: 'fal-ai/sora-2/image-to-video/pro',
          price: '$0.30/s · 720p · $0.50/s · 1080p',
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
        ← {dictionary.models.hero.title}
      </Link>
      <header className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          {brand && rosterEntry.logoPolicy === 'logoAllowed' ? (
            <span className="flex items-center">
              <Image src={brand.assets.light.svg} alt={`${meta.displayName} logo`} width={140} height={32} className="h-9 w-auto dark:hidden" />
              <Image src={brand.assets.dark.svg} alt={`${meta.displayName} logo`} width={140} height={32} className="hidden h-9 w-auto dark:inline-flex" />
            </span>
          ) : null}
          <div>
            <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{meta.displayName}</h1>
            <p className="text-sm uppercase tracking-micro text-text-muted">{meta.versionLabel ?? rosterEntry.versionLabel}</p>
          </div>
          <span
            className={clsx(
              'rounded-pill border px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary',
              AVAILABILITY_BADGE_CLASS[rosterEntry.availability]
            )}
          >
            {availabilityLabel}
          </span>
        </div>
      {meta.description ? <p className="text-sm text-text-secondary">{meta.description}</p> : null}
      </header>

      {showSoraSeo && soraEndpoints.length > 0 && (
        <section className="mt-8 space-y-4">
          <div className="rounded-card border border-accent/40 bg-accent/5 p-6 shadow-card">
            <h2 className="text-lg font-semibold text-text-primary">Sora 2 pricing & routing</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Base runs bill via FAL credits when you leave the OpenAI API key blank. Add your own key inside the workspace to move billing to OpenAI—our UI keeps
              showing the indicative rate and surfaces a “Billed by OpenAI” badge for finance.
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
              <dd>{brand ? brand.label : rosterEntry.brandId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">Engine ID</dt>
              <dd>{rosterEntry.engineId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">Slug</dt>
              <dd>/models/{rosterEntry.modelSlug}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">Logo policy</dt>
              <dd>{rosterEntry.logoPolicy === 'logoAllowed' ? 'Logo usage permitted' : 'Text-only (wordmark)'}</dd>
            </div>
          </dl>
        </div>
        {meta.priceBefore ? (
          <div className="rounded-card border border-dashed border-hairline bg-white p-6 text-sm text-text-muted shadow-card">
            {meta.priceBefore}
          </div>
        ) : null}
      </section>

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
    </div>
  );
}
