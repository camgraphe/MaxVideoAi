import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import clsx from 'clsx';
import { resolveDictionary } from '@/lib/i18n/server';
import { listAvailableModels } from '@/lib/model-roster';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { getTranslations } from 'next-intl/server';

const WORKFLOWS_SLUG_MAP = buildSlugMap('workflows');

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'workflows.meta' });
  const metadataUrls = buildMetadataUrls(locale, WORKFLOWS_SLUG_MAP);

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: metadataUrls.canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      type: 'website',
      url: metadataUrls.canonical,
      siteName: 'MaxVideoAI',
      title: t('title'),
      description: t('description'),
      images: [
        {
          url: '/og/price-before.png',
          width: 1200,
          height: 630,
          alt: 'Workflows — MaxVideo AI',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function WorkflowsPage() {
  const { dictionary } = await resolveDictionary();
  const content = dictionary.workflows;
  const models = listAvailableModels(true);
  const availabilityLabels = dictionary.models.availabilityLabels;
  const expressFeatures =
    Array.isArray(content.express.features) && content.express.features.length
      ? content.express.features
      : [
          'Template library with prompt scaffolds and guardrails',
          'Caption burn-in and optional voice-over generation',
          'Auto ratio exports for 16:9, 1:1, 9:16, 4:5',
        ];
  const workflowsFeatures =
    Array.isArray(content.workflows.features) && content.workflows.features.length
      ? content.workflows.features
      : [
          'Price before you generate',
          'Delivery: Google Drive, OneDrive, Dropbox',
          'Nano Banana image hand-offs',
        ];
  const pickSection = content.pick ?? null;
  const useCaseCards =
    Array.isArray(pickSection?.cards) && pickSection.cards.length
      ? pickSection.cards
      : [
          {
            title: 'Ads creative',
            description: '6–12s cuts, product hero shots, end-cards. Great with Veo 3.1.',
            bullets: ['16:9 / 9:16 variants', 'Logo lockups & simple supers', 'Optional voice-over'],
            href: '/examples?tag=ads',
            cta: 'Browse examples →',
          },
        ];
  const modelRoster = content.modelRoster ?? {
    title: 'Model roster',
    description: 'Choose the model that matches your workflow stage. Availability badges stay in sync with the global roster.',
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-sm text-text-muted">{content.hero.subtitle}</p>
        {content.hero.notice ? (
          <p className="text-xs text-text-muted">{content.hero.notice}</p>
        ) : !(
            FEATURES.delivery.drive &&
            FEATURES.delivery.onedrive &&
            FEATURES.delivery.dropbox
          ) ? (
          <p className="text-xs text-text-muted">Additional delivery integrations are rolling out gradually.</p>
        ) : null}
      </header>
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
                <h3 className="text-base font-semibold text-text-primary">{content.express.badge}</h3>
                <p className="text-sm text-text-secondary">{content.express.title}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
              {expressFeatures.map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-hairline bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-sm">
                🧩
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">{content.workflows.badge}</h3>
                <p className="text-sm text-text-secondary">{content.workflows.title}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
              {workflowsFeatures.map((feature, index) => {
                const showPill =
                  index === 0 ||
                  feature.toLowerCase().includes('price before') ||
                  feature.toLowerCase().includes('delivery');
                const live =
                  index === 0
                    ? true
                    : feature.toLowerCase().includes('delivery')
                      ? FEATURES.delivery.drive && FEATURES.delivery.onedrive && FEATURES.delivery.dropbox
                      : FEATURES.marketing.nanoBananaImage;
                return (
                  <li key={feature} className="flex flex-wrap items-center gap-2">
                    <span>• {feature}</span>
                    {showPill ? (
                      <>
                        <FlagPill live={live} />
                        <span className="sr-only">{live ? 'Live' : 'Coming soon'}</span>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
      <section aria-labelledby="pick-a-workflow" className="mt-10">
        <h2 id="pick-a-workflow" className="text-lg font-semibold text-text-primary">
          {pickSection?.title ?? 'Pick a workflow'}
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          {pickSection?.subtitle ?? 'Start from a common use case. You can swap engines later.'}
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {useCaseCards.map((card) => (
            <a
              key={card.title}
              href={card.href ?? '#'}
              className="rounded-2xl border border-hairline bg-white p-5 shadow-card transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <div className="text-base font-semibold text-text-primary">{card.title}</div>
              <p className="mt-1 text-sm text-text-secondary">{card.description}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
                {(card.bullets ?? []).map((bullet) => (
                  <li key={bullet}>• {bullet}</li>
                ))}
              </ul>
              <div className="mt-3 text-sm font-semibold text-accent underline underline-offset-2">
                {card.cta ?? 'Browse examples →'}
              </div>
            </a>
          ))}
        </div>
      </section>
      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary">{modelRoster.title ?? 'Model roster'}</h2>
        <p className="mt-2 text-sm text-text-secondary">{modelRoster.description ?? ''}</p>
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
                  {brand ? `${brand.label}` : model.brandId} ·{' '}
                  <Link href={{ pathname: '/models/[slug]', params: { slug: model.modelSlug } }} className="text-accent hover:text-accentSoft">
                    view details
                  </Link>
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
