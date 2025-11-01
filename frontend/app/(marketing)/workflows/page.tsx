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
  const workflowHighlights = [
    {
      label: 'Price-before-you-generate chip',
      live: FEATURES.workflows.priceChip,
    },
    {
      label: 'Nano Banana engine image export',
      live: FEATURES.workflows.nanoBananaImage,
    },
    {
      label: 'Delivery: Google Drive, OneDrive, Dropbox',
      live: FEATURES.delivery.drive && FEATURES.delivery.onedrive && FEATURES.delivery.dropbox,
    },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-4">
        <figure className="overflow-hidden rounded-2xl border border-hairline">
          <img
            src="/og/price-before.png"
            alt="MaxVideoAI workspace with composer, live price chip and gallery rail"
            className="h-auto w-full"
            loading="lazy"
            decoding="async"
          />
        </figure>
        <p className="mt-2 text-xs text-text-muted">
          Composer, live price chip, and gallery rail come together in the workflows workspace.
        </p>
      </section>

      <section aria-labelledby="express-vs-workflows" className="mt-6">
        <h2 id="express-vs-workflows" className="sr-only">
          Express vs Workflows
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-hairline bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-sm">
                ⚡
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Express</h3>
                <p className="text-sm text-text-secondary">Spin up publish-ready clips in minutes.</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
              <li>• Template library with prompt scaffolds and guardrails</li>
              <li>• Caption burn-in and optional voice-over generation</li>
              <li>• Auto ratio exports for 16:9, 1:1, 9:16, 4:5</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-hairline bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-sm">
                🧩
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Workflows</h3>
                <p className="text-sm text-text-secondary">Full hand-off for brand and post teams.</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
              {workflowHighlights.map((item) => (
                <li key={item.label} className="flex flex-wrap items-center gap-2">
                  <span>• {item.label}</span>
                  <FlagPill live={item.live} />
                  <span className="sr-only">{item.live ? 'Live' : 'Coming soon'}</span>
                  {!item.live ? <span className="text-xs text-text-muted">(coming soon)</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
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
