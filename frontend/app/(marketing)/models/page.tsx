import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';
import { resolveDictionary } from '@/lib/i18n/server';
import { getModelRoster } from '@/lib/model-roster';
import type { ModelRosterEntry, ModelAvailability } from '@/lib/model-roster';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

export const metadata: Metadata = {
  title: 'Models — MaxVideo AI',
  description: 'See the always-current lineup of AI video engines that MaxVideo AI routes across every project.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Models — MaxVideo AI',
    description: 'Always-current AI video engines with transparent pricing and independence from providers.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Model lineup overview with Price-Before chip.',
      },
    ],
  },
  alternates: {
    canonical: 'https://maxvideoai.com/models',
    languages: {
      en: 'https://maxvideoai.com/models',
      fr: 'https://maxvideoai.com/models?lang=fr',
    },
  },
};

export default function ModelsPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.models;
  const roster = getModelRoster();
  const availabilityLabels = content.availabilityLabels;
  const availabilityOrder: Record<ModelAvailability, number> = {
    available: 0,
    limited: 1,
    waitlist: 2,
    paused: 3,
  };
  const models = roster
    .slice()
    .sort((a: ModelRosterEntry, b: ModelRosterEntry) => {
      if (availabilityOrder[a.availability] !== availabilityOrder[b.availability]) {
        return availabilityOrder[a.availability] - availabilityOrder[b.availability];
      }
      if (a.brandId === b.brandId) {
        return a.marketingName.localeCompare(b.marketingName);
      }
      return a.brandId.localeCompare(b.brandId);
    });

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-12 grid gap-6">
        {models.map((model) => {
          const meta = content.meta?.[model.modelSlug];
          const brand = PARTNER_BRAND_MAP.get(model.brandId);
          const displayName = meta?.displayName ?? model.marketingName;
          const versionLabel = meta?.versionLabel ?? model.versionLabel;
          const description = meta?.description ?? '';
          const priceBefore = meta?.priceBefore ?? '';
          const availabilityLabel = availabilityLabels[model.availability] ?? model.availability;
          return (
            <article key={model.modelSlug} className="rounded-card border border-hairline bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {brand && model.logoPolicy === 'logoAllowed' ? (
                    <span className="flex items-center">
                      <Image src={brand.assets.light.svg} alt={`${displayName} logo`} width={120} height={32} className="h-8 w-auto dark:hidden" />
                      <Image src={brand.assets.dark.svg} alt={`${displayName} logo`} width={120} height={32} className="hidden h-8 w-auto dark:inline-flex" />
                    </span>
                  ) : null}
                  <div>
                    <Link href={`/models/${model.modelSlug}`} className="text-xl font-semibold text-text-primary hover:text-accent">
                      {displayName}
                    </Link>
                    <p className="text-xs uppercase tracking-micro text-text-muted">{versionLabel}</p>
                  </div>
                </div>
                <span
                  className={clsx(
                    'rounded-pill border px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary',
                    AVAILABILITY_BADGE_CLASS[model.availability]
                  )}
                >
                  {availabilityLabel}
                </span>
              </div>
              {description ? <p className="mt-3 text-sm text-text-secondary">{description}</p> : null}
              {priceBefore ? <p className="mt-2 text-xs text-text-muted">{priceBefore}</p> : null}
              <div className="mt-4">
                <Link href={`/models/${model.modelSlug}`} className="text-sm font-semibold text-accent hover:text-accentSoft">
                  View details
                </Link>
              </div>
            </article>
          );
        })}
      </section>
      <aside className="mt-12 rounded-card border border-dashed border-hairline bg-white p-6 text-sm text-text-muted">
        {content.note}
      </aside>
    </div>
  );
}
