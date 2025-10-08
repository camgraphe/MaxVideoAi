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

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
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
