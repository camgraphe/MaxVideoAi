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
import { localePathnames } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getTranslations } from 'next-intl/server';

const WORKFLOWS_SLUG_MAP = buildSlugMap('workflows');
const MODELS_BASE_SLUG_MAP = buildSlugMap('models');

export const revalidate = 60 * 10;

function buildModelPath(locale: AppLocale, slug: string) {
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const base = MODELS_BASE_SLUG_MAP[locale] ?? MODELS_BASE_SLUG_MAP.en ?? 'models';
  return `${prefix}/${base}/${slug}`.replace(/\/{2,}/g, '/');
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'workflows.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'workflows',
    slugMap: WORKFLOWS_SLUG_MAP,
    imageAlt: 'Workflows — MaxVideo AI',
    robots: {
      index: true,
      follow: true,
    },
  });
}

export default async function WorkflowsPage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const activeLocale = locale;
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
            href: '/examples?engine=veo',
            cta: 'Browse examples →',
          },
        ];
  const modelRoster = content.modelRoster ?? {
    title: 'Model roster',
    description: 'Choose the model that matches your workflow stage. Availability badges stay in sync with the global roster.',
  };

  return (
    <div className="container-page max-w-5xl section">
      <header className="stack-gap-sm">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
        <p className="sm:max-w-[62ch] text-sm text-text-muted">{content.hero.subtitle}</p>
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
            <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-4">
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
          {useCaseCards.map((card) => {
            const cardCta = (card as { cta?: string })?.cta;
            return (
            <a
              key={card.title}
              href={card.href ?? '#'}
              className="rounded-2xl border border-hairline bg-white p-5 shadow-card transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="text-base font-semibold text-text-primary">{card.title}</div>
              <p className="mt-1 text-sm text-text-secondary">{card.description}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
                {(card.bullets ?? []).map((bullet) => (
                  <li key={bullet}>• {bullet}</li>
                ))}
              </ul>
              <div className="mt-3 text-sm font-semibold text-brand underline underline-offset-2">
                {cardCta ?? 'Browse examples →'}
              </div>
            </a>
            );
          })}
        </div>
      </section>
      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{modelRoster.title ?? 'Model roster'}</h2>
        <p className="mt-2 text-sm text-text-secondary">{modelRoster.description ?? ''}</p>
        <div className="mt-4 grid grid-gap-sm sm:grid-cols-2">
          {models.map((model) => {
            const brand = PARTNER_BRAND_MAP.get(model.brandId);
            const availabilityLabel = availabilityLabels[model.availability] ?? model.availability;
            const modelHref = buildModelPath(activeLocale, model.modelSlug);
            const showAvailabilityBadge = model.availability !== 'limited';
            return (
              <Link
                key={model.modelSlug}
                href={modelHref}
                className="rounded-card border border-hairline bg-bg p-4 transition hover:border-text-muted hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{model.marketingName}</h3>
                    <p className="text-xs uppercase tracking-micro text-text-muted">{model.versionLabel}</p>
                  </div>
                  {showAvailabilityBadge ? (
                    <span
                      className={clsx(
                        'rounded-pill border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary',
                        AVAILABILITY_BADGE_CLASS[model.availability]
                      )}
                    >
                      {availabilityLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {brand ? `${brand.label}` : model.brandId} · <span className="text-brand">view details</span>
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
