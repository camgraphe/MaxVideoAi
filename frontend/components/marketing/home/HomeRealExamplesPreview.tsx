import Image from 'next/image';
import { Clock, ImageIcon, Type, Video } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import type { HomeExampleCard, ProviderItem, SectionCopy } from '@/components/marketing/home/home-redesign-types';

export function RealExamplesPreview({
  copy,
  examples,
  providers,
}: {
  copy: SectionCopy & { viewPrompt?: string };
  examples: HomeExampleCard[];
  providers?: ProviderItem[];
}) {
  return (
    <section className="dark-section-neon border-b border-hairline bg-surface py-14 sm:py-16">
      <div className="container-page max-w-[1200px]">
        <div className="mx-auto max-w-[880px] text-center">
          <p className="text-xs font-semibold uppercase tracking-micro text-brand">{copy.eyebrow ?? 'AI video examples'}</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-text-primary sm:text-4xl">{copy.title}</h2>
          <p className="mx-auto mt-3 max-w-[780px] text-base leading-7 text-text-secondary">{copy.subtitle}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <ButtonLink
              href={{ pathname: '/examples' }}
              linkComponent={Link}
              size="md"
              data-analytics-event="example_category_click"
              data-analytics-cta-name="all_examples"
              data-analytics-cta-location="examples_preview_header"
              data-analytics-target-family="examples"
            >
              {copy.cta ?? 'Browse all examples'}
              <span aria-hidden="true">→</span>
            </ButtonLink>
            <ButtonLink
              href={{ pathname: '/models' }}
              linkComponent={Link}
              variant="outline"
              size="md"
              data-analytics-event="model_card_click"
              data-analytics-cta-name="all_models"
              data-analytics-cta-location="examples_preview_header"
              data-analytics-target-family="models"
            >
              {copy.modelsCta ?? 'View all model specs'}
              <span aria-hidden="true">→</span>
            </ButtonLink>
            <Link
              href={{ pathname: '/ai-video-engines' }}
              className="inline-flex min-h-10 items-center gap-2 rounded-input px-2 text-sm font-semibold text-brand transition hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-analytics-event="comparison_card_click"
              data-analytics-cta-name="compare_engines"
              data-analytics-cta-location="examples_preview_header"
              data-analytics-target-family="compare"
            >
              {copy.compareLink ?? 'Compare engines'}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className="dark-neon-panel mt-7 overflow-hidden rounded-[20px] border border-hairline bg-bg shadow-sm dark:border-white/[0.08]">
          <div className="divide-y divide-hairline dark:divide-white/[0.07]">
            {examples.map((example) => (
              <HomeExamplePreviewRow key={example.id} example={example} />
            ))}
          </div>
        </div>

        {providers?.length ? <HomeExampleProviders copy={copy} providers={providers} /> : null}
      </div>
    </section>
  );
}

function HomeExamplePreviewRow({ example }: { example: HomeExampleCard }) {
  const modeIcon = example.mode.toLowerCase().startsWith('text') ? Type : example.mode.toLowerCase().startsWith('video') ? Video : ImageIcon;
  const showExamplesCta = example.examplesCtaVisible !== false;
  const modelHref = example.modelHref ?? example.href;

  return (
    <article className="grid grid-cols-[112px_1fr] gap-3 px-3 py-3 lg:grid-cols-[132px_220px_165px_72px_82px_170px] lg:items-center lg:gap-3 lg:px-5">
      <Link
        href={showExamplesCta ? example.href : modelHref}
        className="group relative row-span-4 h-[106px] overflow-hidden rounded-[10px] bg-surface-3 lg:row-span-1 lg:h-[72px] lg:w-[132px]"
        data-analytics-event={showExamplesCta ? 'example_category_click' : 'model_card_click'}
        data-analytics-cta-name={example.id}
        data-analytics-cta-location="examples_preview"
        data-analytics-target-family={showExamplesCta ? 'examples' : 'models'}
      >
        <span className="sr-only">{showExamplesCta ? example.ctaLabel : example.modelCtaLabel ?? 'Specs & pricing'}</span>
        <Image
          src={example.imageSrc}
          alt={example.imageAlt}
          fill
          sizes="(max-width: 1023px) 112px, 132px"
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
          loading="lazy"
        />
      </Link>

      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-5 text-text-primary">{example.engine}</h3>
        <p className="mt-1 text-sm leading-5 text-text-secondary">{example.useCase}</p>
      </div>

      <div className="flex min-w-0 items-center gap-2 text-sm text-text-secondary">
        <UIIcon icon={modeIcon} size={16} strokeWidth={1.9} />
        <span className="truncate">{example.mode}</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-text-secondary">
        {example.duration ? (
          <>
            <UIIcon icon={Clock} size={16} strokeWidth={1.9} />
            <span>{example.duration}</span>
          </>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </div>

      <div>
        {example.price && /[$€£]|\d/.test(example.price) ? (
          <span className="inline-flex rounded-pill border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-text-primary dark:border-white/[0.08] dark:bg-white/[0.035]">
            {example.price}
          </span>
        ) : (
          <span className="text-sm text-text-muted">—</span>
        )}
      </div>

      <div className="col-span-2 grid grid-cols-2 gap-2 border-t border-hairline pt-3 dark:border-white/[0.07] lg:col-span-1 lg:col-start-auto lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        {showExamplesCta ? (
          <Link
            href={example.href}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-input border border-hairline bg-surface px-2 text-center text-xs font-semibold text-brand hover:text-brandHover sm:text-sm lg:min-h-0 lg:justify-start lg:border-0 lg:bg-transparent lg:px-0 lg:text-left"
            data-analytics-event="example_category_click"
            data-analytics-cta-name={example.id}
            data-analytics-cta-location="examples_preview_cta"
            data-analytics-target-family="examples"
          >
            {example.ctaLabel}
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="hidden text-sm text-text-muted lg:inline">—</span>
        )}

        <Link
          href={modelHref}
          aria-label={example.engine === 'Seedance 2.0' ? 'View Seedance 2.0 specs, limits and pricing' : `View ${example.engine} specs, limits and pricing`}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-input border border-hairline bg-surface px-2 text-center text-xs font-semibold text-text-secondary hover:text-text-primary sm:text-sm lg:min-h-0 lg:justify-start lg:border-0 lg:bg-transparent lg:px-0 lg:text-left"
          data-analytics-event="model_card_click"
          data-analytics-cta-name={example.id}
          data-analytics-cta-location="examples_preview_model"
          data-analytics-target-family="models"
        >
          {example.modelCtaLabel ?? 'Specs & pricing'}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

function HomeExampleProviders({ copy, providers }: { copy: SectionCopy; providers: ProviderItem[] }) {
  return (
    <div className="dark-neon-panel mt-3 flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-white/70 px-4 py-3 text-sm shadow-sm dark:border-white/[0.08] dark:bg-surface-glass-70">
      <span className="font-semibold text-text-primary">{copy.providerLabel ?? 'Supported engines'}</span>
      {providers.map((item) =>
        item.href ? (
          <Link
            key={`${item.provider}-${item.model}`}
            href={item.href}
            className="rounded-pill border border-hairline bg-surface px-3 py-1 font-medium text-text-secondary transition hover:border-text-muted hover:text-text-primary dark:border-white/[0.08] dark:bg-white/[0.035] dark:hover:border-white/[0.16]"
          >
            {item.model}
          </Link>
        ) : (
          <span
            key={`${item.provider}-${item.model}`}
            className="rounded-pill border border-hairline bg-surface px-3 py-1 font-medium text-text-secondary dark:border-white/[0.08] dark:bg-white/[0.035]"
          >
            {item.model}
          </span>
        )
      )}
      <Link href={{ pathname: '/models' }} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brandHover">
        {copy.modelsCta ?? 'View all model specs'} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
