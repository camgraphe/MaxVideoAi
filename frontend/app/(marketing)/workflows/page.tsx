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
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-sm text-text-muted">
          Compare rapid exploration with Express and structured team hand-off with Workflows. The live “Price before you generate” chip is available today.
        </p>
        {!(FEATURES.delivery.drive && FEATURES.delivery.onedrive && FEATURES.delivery.s3) ? (
          <p className="text-xs text-text-muted">
            Additional delivery integrations are rolling out gradually.
          </p>
        ) : null}
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
        <h2 id="express-vs-workflows" className="scroll-mt-28 sr-only">
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
              <li className="flex flex-wrap items-center gap-2">
                <span>• Price before you generate</span>
                <FlagPill live />
                <span className="sr-only">Live</span>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span>• Delivery: Google Drive, OneDrive, Dropbox</span>
                <FlagPill live={FEATURES.delivery.drive && FEATURES.delivery.onedrive && FEATURES.delivery.dropbox} />
                <span className="sr-only">
                  {FEATURES.delivery.drive && FEATURES.delivery.onedrive && FEATURES.delivery.dropbox ? 'Live' : 'Coming soon'}
                </span>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span>• Nano Banana image</span>
                <FlagPill live={FEATURES.marketing.nanoBananaImage} />
                <span className="sr-only">{FEATURES.marketing.nanoBananaImage ? 'Live' : 'Coming soon'}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
      <section aria-labelledby="pick-a-workflow" className="mt-10">
        <h2 id="pick-a-workflow" className="text-lg font-semibold text-text-primary">Pick a workflow</h2>
        <p className="mb-4 text-sm text-text-secondary">Start from a common use case. You can swap engines later.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <a
            href="/examples?tag=ads"
            className="rounded-2xl border border-hairline bg-white p-5 shadow-card transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="text-base font-semibold text-text-primary">Ads creative</div>
            <p className="mt-1 text-sm text-text-secondary">
              6–12s cuts, product hero shots, end-cards. Great with Veo 3.1.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
              <li>• 16:9 / 9:16 variants</li>
              <li>• Logo lockups &amp; simple supers</li>
              <li>• Optional voice-over</li>
            </ul>
            <div className="mt-3 text-sm font-semibold text-accent underline underline-offset-2">Browse examples →</div>
          </a>
          <a
            href="/examples?tag=product-broll"
            className="rounded-2xl border border-hairline bg-white p-5 shadow-card transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="text-base font-semibold text-text-primary">Product B-roll</div>
            <p className="mt-1 text-sm text-text-secondary">
              Stylised loops and clean macro moves. Fast with Pika 2.2.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
              <li>• 5–8s loops</li>
              <li>• 1:1 / 4:5 storefront</li>
              <li>• Image-to-video remixes</li>
            </ul>
            <div className="mt-3 text-sm font-semibold text-accent underline underline-offset-2">Browse examples →</div>
          </a>
          <a
            href="/examples?tag=music-video"
            className="rounded-2xl border border-hairline bg-white p-5 shadow-card transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="text-base font-semibold text-text-primary">Music video / Narrative</div>
            <p className="mt-1 text-sm text-text-secondary">
              Cinematic motion, synced audio. Strong with Sora 2.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
              <li>• 8–12s shots</li>
              <li>• 1080p delivery</li>
              <li>• Native audio on</li>
            </ul>
            <div className="mt-3 text-sm font-semibold text-accent underline underline-offset-2">Browse examples →</div>
          </a>
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
