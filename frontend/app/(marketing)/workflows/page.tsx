import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { resolveDictionary } from '@/lib/i18n/server';
import { listAvailableModels } from '@/lib/model-roster';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';

export async function generateMetadata(): Promise<Metadata> {
  const url = `${SITE}/workflows`;
  const title = 'Workflows — Presets and repeatable shots';
  const description =
    'Ready-to-run workflows for ads, product B-roll, music videos, and more. Clone presets, price before you generate, and iterate fast.';
  const ogImage = `${SITE}/og/price-before.png`;

  return {
    title: `${title} — MaxVideo AI`,
    description,
    alternates: {
      canonical: url,
      languages: {
        en: url,
        fr: `${url}?lang=fr`,
      },
    },
    openGraph: {
      type: 'website',
      url,
      siteName: 'MaxVideo AI',
      title: `${title} — MaxVideo AI`,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: 'Workflows — MaxVideo AI',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — MaxVideo AI`,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function WorkflowsPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.workflows;
  const models = listAvailableModels(true);
  const availabilityLabels = dictionary.models.availabilityLabels;
  const workflowFeatureGroups = [
    {
      key: 'brandKits',
      title: 'Brand kits',
      description: 'Palettes, fonts, legal copy, saved styles.',
      live: FEATURES.workflows.brandKits,
    },
    {
      key: 'approvals',
      title: 'Approvals',
      description: 'Assign reviewers, comment on renders, lock versions.',
      live: FEATURES.workflows.approvals,
    },
    {
      key: 'budgetControls',
      title: 'Budget controls',
      description: 'Multi-approver spend limits and daily summaries.',
      live: FEATURES.workflows.budgetControls,
    },
  ] as const;
  const deliveryExports = [
    { name: 'Final Cut Pro XML (FCPXML)', live: FEATURES.workflows.deliveryExports.fcxpxml },
    { name: 'After Effects JSON', live: FEATURES.workflows.deliveryExports.aejson },
  ] as const;
  const deliveryIntegrations = [
    { name: 'Google Drive', live: FEATURES.delivery.drive },
    { name: 'OneDrive', live: FEATURES.delivery.onedrive },
    { name: 'Amazon S3', live: FEATURES.delivery.s3 },
    { name: 'Dropbox', live: FEATURES.delivery.dropbox },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <article className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">{content.express.badge}</span>
          <h2 className="mt-4 text-xl font-semibold text-text-primary">{content.express.title}</h2>
          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
            {content.express.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">{content.workflows.badge}</span>
          <h2 className="mt-4 text-xl font-semibold text-text-primary">{content.workflows.title}</h2>
          <div className="mt-4 space-y-5 text-sm text-text-secondary">
            {workflowFeatureGroups.map((feature) => (
              <div key={feature.key}>
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <span>{feature.title}</span>
                  <FlagPill live={feature.live} />
                  {!feature.live ? <span className="text-xs text-text-muted">(coming soon)</span> : null}
                </div>
                <p className="mt-1 text-sm text-text-secondary">{feature.description}</p>
              </div>
            ))}
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <span>Delivery exports</span>
                <FlagPill
                  live={
                    FEATURES.workflows.deliveryExports.fcxpxml || FEATURES.workflows.deliveryExports.aejson
                  }
                />
                {!(FEATURES.workflows.deliveryExports.fcxpxml || FEATURES.workflows.deliveryExports.aejson) ? (
                  <span className="text-xs text-text-muted">(coming soon)</span>
                ) : null}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {deliveryExports.map((item) => (
                  <li key={item.name} className="flex items-center gap-2">
                    <span>{item.name}</span>
                    <FlagPill live={item.live} />
                    {!item.live ? <span className="text-xs text-text-muted">(coming soon)</span> : null}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <span>Delivery integrations</span>
              </div>
              <ul className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {deliveryIntegrations.map((integration) => (
                  <li key={integration.name} className="flex items-center gap-2">
                    <span>{integration.name}</span>
                    <FlagPill live={integration.live} />
                    {!integration.live ? <span className="text-xs text-text-muted">(coming soon)</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </section>
      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary">Model roster</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Choose the model that matches your workflow stage. Availability badges stay in sync with the global roster.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {models.map((model) => {
            const brand = PARTNER_BRAND_MAP.get(model.brandId);
            const availabilityLabel = availabilityLabels[model.availability] ?? model.availability;
            return (
              <article key={model.modelSlug} className="rounded-card border border-hairline bg-bg p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{model.marketingName}</h3>
                    <p className="text-xs uppercase tracking-micro text-text-muted">{model.versionLabel}</p>
                  </div>
                  <span
                    className={clsx(
                      'rounded-pill border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary',
                      AVAILABILITY_BADGE_CLASS[model.availability]
                    )}
                  >
                    {availabilityLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {brand ? `${brand.label}` : model.brandId} · <Link href={`/models/${model.modelSlug}`} className="text-accent hover:text-accentSoft">view details</Link>
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
