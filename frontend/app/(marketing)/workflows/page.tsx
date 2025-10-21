import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { resolveDictionary } from '@/lib/i18n/server';
import { listAvailableModels } from '@/lib/model-roster';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

export const metadata: Metadata = {
  title: 'Workflows — MaxVideo AI',
  description: 'Express templates and full workflows for team production, approvals, and delivery.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Workflows — MaxVideo AI',
    description: 'Choose Express for rapid runs or Workflows for brand governance and hand-offs.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Workflows overview.',
      },
    ],
  },
  alternates: {
    canonical: 'https://maxvideoai.com/workflows',
    languages: {
      en: 'https://maxvideoai.com/workflows',
      fr: 'https://maxvideoai.com/workflows?lang=fr',
    },
  },
};

export default function WorkflowsPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.workflows;
  const models = listAvailableModels(true);
  const availabilityLabels = dictionary.models.availabilityLabels;

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
          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
            {content.workflows.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
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
