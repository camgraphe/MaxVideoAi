import Image from 'next/image';
import {
  BadgeCheck,
  BadgeDollarSign,
  BarChart3,
  Box,
  CircleDollarSign,
  ClipboardList,
  RefreshCcw,
  Scale,
  Video,
} from 'lucide-react';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import {
  COMPARISON_CARD_MEDIA,
  REFERENCE_WORKFLOW_VISUALS,
  TOOLBOX_VISUALS,
  TOOL_ICONS,
} from '@/components/marketing/home/home-redesign-visuals';
import type {
  ComparisonCard,
  FaqItem,
  ProviderItem,
  SectionCopy,
  ToolCard,
  TrustCard,
  WorkflowStep,
} from '@/components/marketing/home/home-redesign-types';

function isWorkspaceHref(href: LocalizedLinkHref): boolean {
  const pathname = typeof href === 'string' ? href : 'pathname' in href && typeof href.pathname === 'string' ? href.pathname : '';
  return pathname === '/app' || pathname.startsWith('/app?') || pathname.startsWith('/app/');
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-micro text-brand">{eyebrow}</p>
      ) : null}
      <h2 className="mt-3 text-3xl font-semibold text-text-primary sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-text-secondary">{subtitle}</p>
    </div>
  );
}

function ComparisonScorecard({ copy }: { copy: SectionCopy }) {
  return (
    <div
      className="relative flex min-h-[190px] items-center justify-center overflow-visible rounded-[32px] bg-[radial-gradient(circle_at_50%_44%,rgba(59,130,246,0.12),transparent_62%)] sm:min-h-[260px] lg:min-h-[360px]"
      role="img"
      aria-label={`${copy.scorecardTitle ?? 'Scorecard'}: ${copy.scorecardLeftLabel ?? 'Seedance 1.5 Pro'} compared with ${copy.scorecardRightLabel ?? 'Seedance 2.0'}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.72),transparent)] dark:bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.08),transparent)]" />
      <Image
        src="/assets/marketing/comparison-scorecard-transparent.webp"
        alt=""
        aria-hidden="true"
        width={1280}
        height={853}
        sizes="(max-width: 1023px) 92vw, 700px"
        className="relative z-10 h-auto max-h-[210px] w-full max-w-[640px] object-contain drop-shadow-[0_28px_70px_rgba(15,23,42,0.13)] sm:max-h-[300px] lg:max-h-[390px] lg:max-w-[720px]"
        loading="lazy"
      />
    </div>
  );
}

export function ComparisonPreview({ copy, comparisons }: { copy: SectionCopy; comparisons: ComparisonCard[] }) {
  const featureCards =
    copy.featureCards && copy.featureCards.length > 0
      ? copy.featureCards
      : [
          { title: '11 comparison criteria', body: 'Quality, motion, audio, cost and more' },
          { title: 'Real outputs', body: 'See examples from each model' },
          { title: 'Live pricing', body: 'Know the cost before you generate' },
          { title: 'Updated often', body: 'Benchmarks refresh as models evolve' },
        ];

  return (
    <section className="dark-section-neon relative overflow-hidden border-b border-hairline bg-bg section">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(15,23,42,0.05),transparent_26%),linear-gradient(90deg,transparent,rgba(148,163,184,0.09),transparent)] dark:bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.030),transparent_32%)]" />
      <div className="container-page max-w-[1280px] stack-gap-lg">
        <div className="relative grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            {copy.eyebrow ? (
              <span className="inline-flex items-center gap-2 rounded-pill border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-micro text-brand shadow-sm">
                <UIIcon icon={Scale} size={15} strokeWidth={1.9} />
                {copy.eyebrow}
              </span>
            ) : null}
            <h2 className="mt-5 max-w-[620px] text-4xl font-semibold leading-[1.04] text-text-primary sm:text-5xl">
              {copy.title}
            </h2>
            <p className="mt-5 max-w-[560px] text-base leading-7 text-text-secondary">{copy.subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink
                href={{ pathname: '/ai-video-engines' }}
                linkComponent={Link}
                size="lg"
                data-analytics-event="comparison_card_click"
                data-analytics-cta-name="all_comparisons"
                data-analytics-cta-location="comparison_intro"
                data-analytics-target-family="compare"
              >
                {copy.primaryCta ?? 'Explore all comparisons'}
                <span aria-hidden="true">→</span>
              </ButtonLink>
              <ButtonLink
                href={{ pathname: '/models' }}
                linkComponent={Link}
                variant="outline"
                size="lg"
                data-analytics-event="model_card_click"
                data-analytics-cta-name="all_models"
                data-analytics-cta-location="comparison_intro"
                data-analytics-target-family="models"
              >
                {copy.secondaryCta ?? 'View all models'}
              </ButtonLink>
            </div>
          </div>
          <ComparisonScorecard copy={copy} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {comparisons.map((comparison) => (
            <Link
              key={comparison.id}
              href={comparison.href}
              className="dark-neon-panel group flex h-full flex-col rounded-[20px] border border-hairline bg-surface p-2 shadow-card transition hover:-translate-y-0.5 hover:border-text-muted/40 hover:shadow-float sm:p-2.5"
              data-analytics-event="comparison_card_click"
              data-analytics-cta-name={comparison.id}
              data-analytics-cta-location="comparison_preview"
              data-analytics-target-family="compare"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[124px_minmax(0,1fr)] sm:items-stretch sm:gap-3 lg:grid-cols-[132px_minmax(0,1fr)]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-surface-3 sm:h-[124px] sm:aspect-auto lg:h-[132px]">
                  {comparison.media && comparison.media.length >= 2 ? (
                    <div className="absolute inset-0 grid grid-cols-2 gap-px bg-black/20">
                      {comparison.media.slice(0, 2).map((media) => (
                        <div key={`${comparison.id}-${media.imageSrc}`} className="relative min-w-0 overflow-hidden">
                          <Image
                            src={media.imageSrc}
                            alt={media.imageAlt}
                            fill
                            sizes="(max-width: 639px) 25vw, (max-width: 1023px) 110px, 66px"
                            className="object-cover transition duration-500 group-hover:scale-[1.05]"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Image
                      src={comparison.imageSrc ?? COMPARISON_CARD_MEDIA[comparison.id]?.imageSrc ?? '/hero/showcase-seedance-2-0.webp'}
                      alt={comparison.imageAlt ?? COMPARISON_CARD_MEDIA[comparison.id]?.imageAlt ?? `${comparison.title} AI video comparison preview.`}
                      fill
                      sizes="(max-width: 639px) 50vw, (max-width: 1023px) 220px, 132px"
                      className="object-cover transition duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="overflow-hidden text-sm font-semibold leading-[1.18] text-text-primary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:text-[17px]">{comparison.title}</h3>
                    <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-bg text-brand sm:inline-flex">
                      <UIIcon icon={Scale} size={16} strokeWidth={1.9} />
                    </span>
                  </div>
                  <p className="mt-1 overflow-hidden text-xs leading-5 text-text-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:mt-1.5 sm:text-sm">{comparison.body}</p>
                  <div className="mt-2 flex min-w-0 flex-nowrap gap-1 overflow-hidden">
                    {comparison.badges.slice(0, 3).map((badge) => (
                      <span key={badge} className="min-w-0 truncate rounded-pill border border-hairline bg-bg px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-text-primary last:hidden sm:last:inline-block sm:px-2 sm:text-[11px] sm:leading-5">
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="dark-neon-panel grid gap-3 rounded-[20px] border border-hairline bg-surface/85 p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature, index) => {
            const icons = [BarChart3, Video, CircleDollarSign, RefreshCcw] as const;
            return (
              <div key={feature.title} className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-hairline bg-bg text-text-primary">
                  <UIIcon icon={icons[index] ?? BarChart3} size={18} strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text-primary">{feature.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-text-secondary">{feature.body}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ReferenceWorkflow({ copy, steps }: { copy: SectionCopy; steps: WorkflowStep[] }) {
  return (
    <section className="dark-section-neon border-b border-hairline bg-surface section">
      <div className="container-page max-w-[1200px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Link
              key={step.title}
              href={step.href}
              prefetch={isWorkspaceHref(step.href) ? false : undefined}
              className="dark-neon-panel group relative flex min-h-[178px] flex-col overflow-hidden rounded-card border border-hairline bg-bg p-3 shadow-card transition hover:-translate-y-0.5 hover:border-text-muted/40 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:bg-surface-glass-80 dark:hover:bg-surface-glass-70 sm:min-h-[218px] sm:p-5"
              data-analytics-event="tool_card_click"
              data-analytics-cta-name={step.toolLabel}
              data-analytics-cta-location="reference_workflow"
              data-analytics-tool-name={step.toolLabel}
              data-analytics-tool-surface="public"
            >
              <Image
                src={REFERENCE_WORKFLOW_VISUALS[index] ?? REFERENCE_WORKFLOW_VISUALS[0]}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 639px) 50vw, (max-width: 1023px) 50vw, 300px"
                className="object-cover transition duration-500 group-hover:scale-[1.04] dark:opacity-[0.28] dark:brightness-[0.72] dark:saturate-[1.18]"
                loading="lazy"
              />
              <span className="absolute inset-0 bg-gradient-to-b from-white/92 via-white/78 to-white/55 dark:bg-[linear-gradient(180deg,rgba(3,7,18,0.96)_0%,rgba(4,8,22,0.93)_52%,rgba(3,7,18,0.88)_100%)]" />
              <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/60 to-transparent dark:from-[rgba(8,16,31,0.76)] dark:via-[rgba(8,16,31,0.24)]" />
              <span className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-card border border-hairline bg-white/78 text-xs font-semibold text-text-primary shadow-sm backdrop-blur dark:border-white/12 dark:bg-white/[0.08] sm:h-9 sm:w-9 sm:text-sm">
                {index + 1}
              </span>
              <div className="relative z-10 mt-5 flex flex-1 flex-col sm:mt-6">
                <h3 className="min-h-[40px] text-sm font-semibold leading-5 text-text-primary sm:min-h-[48px] sm:text-lg sm:leading-6">{step.title}</h3>
                <p className="mt-1.5 overflow-hidden text-xs leading-5 text-text-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:mt-2 sm:text-sm sm:leading-6 sm:[-webkit-line-clamp:3]">{step.body}</p>
                <p className="mt-auto pt-3 text-xs font-semibold text-text-primary group-hover:text-brand sm:pt-5 sm:text-sm">
                  {step.toolLabel}
                  <span aria-hidden="true" className="ml-2 transition group-hover:translate-x-1">→</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AiVideoToolbox({ copy, tools }: { copy: SectionCopy; tools: ToolCard[] }) {
  return (
    <section className="dark-section-neon relative overflow-hidden border-b border-hairline bg-bg section">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(15,23,42,0.055),transparent_34%),linear-gradient(180deg,transparent,rgba(148,163,184,0.08))] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.030),transparent_38%)]" />
      <div className="container-page relative max-w-[1200px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              prefetch={isWorkspaceHref(tool.href) ? false : undefined}
              className="dark-neon-panel group relative min-h-[158px] overflow-hidden rounded-card border border-hairline bg-surface p-3 pb-11 shadow-card transition hover:-translate-y-0.5 hover:border-text-muted/40 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:min-h-[188px] sm:p-4 sm:pb-12"
              data-analytics-event="tool_card_click"
              data-analytics-cta-name={tool.id}
              data-analytics-cta-location="toolbox"
              data-analytics-tool-name={tool.id}
              data-analytics-tool-surface="public"
            >
              <Image
                src={TOOLBOX_VISUALS[tool.id] ?? '/hero/showcase-seedance-2-0.webp'}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 767px) 50vw, (max-width: 1199px) 25vw, 280px"
                className="object-cover saturate-[1.06] contrast-[1.06] transition duration-500 group-hover:scale-[1.04]"
                loading="lazy"
              />
              <span className="absolute inset-0 bg-[linear-gradient(112deg,rgba(3,7,18,0.66)_0%,rgba(3,7,18,0.48)_42%,rgba(3,7,18,0.22)_72%,rgba(3,7,18,0.10)_100%)]" />
              <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/58 via-black/18 to-transparent" />
              <span className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-[11px] border border-white/25 bg-white/15 text-white shadow-sm backdrop-blur dark:bg-white/10 sm:h-9 sm:w-9">
                <UIIcon icon={TOOL_ICONS[tool.icon]} size={18} strokeWidth={1.9} />
              </span>
              <h3 className="relative z-10 mt-4 pr-6 text-sm font-semibold leading-5 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.48)] sm:text-base">{tool.title}</h3>
              <p className="relative z-10 mt-1.5 pr-6 text-xs leading-5 text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.42)] sm:hidden">{tool.shortBody ?? tool.body}</p>
              <p className="relative z-10 mt-2 hidden pr-7 text-sm leading-6 text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.42)] sm:block">{tool.body}</p>
              <span className="absolute bottom-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-sm backdrop-blur transition group-hover:translate-x-0.5 group-hover:bg-white/20">
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink
            href="/app"
            prefetch={false}
            linkComponent={Link}
            size="lg"
            data-analytics-event="tool_card_click"
            data-analytics-cta-name="open_workspace"
            data-analytics-cta-location="toolbox_cta"
            data-analytics-target-family="workspace"
          >
            {copy.primaryCta ?? 'Open workspace'}
          </ButtonLink>
          <ButtonLink
            href={{ pathname: '/tools' }}
            linkComponent={Link}
            variant="outline"
            size="lg"
            data-analytics-event="tool_card_click"
            data-analytics-cta-name="browse_tools"
            data-analytics-cta-location="toolbox_cta"
            data-analytics-target-family="tools"
          >
            {copy.secondaryCta ?? 'Browse all tools'}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function TransparentPricingBlock({ copy, cards }: { copy: SectionCopy; cards: TrustCard[] }) {
  const icons = [BadgeDollarSign, CircleDollarSign, RefreshCcw, ClipboardList] as const;
  const footerLinks = [
    { href: { pathname: '/models' } as const, label: copy.modelsLink ?? 'Models' },
    { href: { pathname: '/examples' } as const, label: copy.examplesLink ?? 'Examples' },
    { href: { pathname: '/ai-video-engines' } as const, label: copy.compareLink ?? 'Compare engines' },
  ];

  return (
    <section className="dark-section-neon border-b border-hairline bg-surface section">
      <div className="container-page max-w-[1280px]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.86fr)_1px_minmax(0,1.14fr)] lg:items-center lg:gap-12">
          <div className="max-w-[520px]">
            <h2 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl lg:text-5xl lg:leading-[1.08]">
              {copy.title}
            </h2>
            {copy.subtitle ? (
              <p className="mt-5 max-w-[480px] text-base leading-8 text-text-secondary sm:text-lg">{copy.subtitle}</p>
            ) : null}
            <ButtonLink
              href={{ pathname: '/pricing' }}
              linkComponent={Link}
              size="lg"
              className="mt-7"
              data-analytics-event="pricing_cta_click"
              data-analytics-cta-name="view_pricing"
              data-analytics-cta-location="transparent_pricing"
              data-analytics-target-family="pricing"
            >
              {copy.cta ?? 'View pricing'}
            </ButtonLink>
          </div>
          <span aria-hidden="true" className="hidden h-full min-h-[240px] w-px bg-hairline lg:block" />
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:gap-x-12 lg:gap-y-12">
            {cards.map((card, index) => (
              <article key={card.title} className="grid grid-cols-[44px_minmax(0,1fr)] gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-brand/20 bg-brand/10 text-brand shadow-sm">
                  <UIIcon icon={icons[index] ?? CircleDollarSign} size={21} strokeWidth={1.9} />
                </span>
                <span>
                  <h3 className="text-base font-semibold leading-6 text-text-primary sm:text-lg">{card.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-secondary sm:text-[15px]">{card.body}</p>
                </span>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-5 border-t border-hairline pt-5 md:flex-row md:items-center md:justify-between">
          <p className="flex max-w-[720px] items-start gap-3 text-sm leading-7 text-text-secondary">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-brand">
              <UIIcon icon={BadgeCheck} size={17} strokeWidth={1.9} />
            </span>
            <span>
              {copy.supportingText ??
                'MaxVideoAI is a pay-as-you-go multi-engine AI video generator for Seedance, Kling, Veo, LTX, Wan, Pika, Sora and more.'}
            </span>
          </p>
          <nav aria-label="Pricing section links" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-brand">
            {footerLinks.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex items-center gap-2 transition hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <span>{item.label}</span>
                <span aria-hidden="true">→</span>
                {index < footerLinks.length - 1 ? <span aria-hidden="true" className="ml-3 h-4 w-px bg-hairline" /> : null}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}

export function ProviderEngineStrip({ copy, providers }: { copy: SectionCopy; providers: ProviderItem[] }) {
  return (
    <section className="dark-section-neon border-b border-hairline bg-bg section-compact">
      <div className="container-page max-w-[1200px] stack-gap">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((item) => {
            const content = (
              <>
                <p className="text-sm font-semibold text-text-primary">{item.provider}</p>
                <p className="mt-1 text-sm text-text-secondary">{item.model}</p>
              </>
            );

            return item.href ? (
              <Link
                key={`${item.provider}-${item.model}`}
                href={item.href}
                className="dark-neon-panel rounded-card border border-hairline bg-surface p-4 shadow-card transition hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {content}
              </Link>
            ) : (
              <div key={`${item.provider}-${item.model}`} className="dark-neon-panel rounded-card border border-hairline bg-surface p-4 shadow-card">
                {content}
              </div>
            );
          })}
        </div>
        <div className="flex justify-center">
          <ButtonLink href={{ pathname: '/models' }} linkComponent={Link} variant="outline" size="lg">
            {copy.cta ?? 'View all models'}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function HomeFaq({ copy, items }: { copy: SectionCopy; items: FaqItem[] }) {
  return (
    <section className="dark-section-neon bg-bg section">
      <div className="container-page max-w-[900px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="space-y-3">
          {items.map((item) => (
            <details key={item.question} className="dark-neon-panel group rounded-card border border-hairline bg-surface p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-text-primary">
                <span>{item.question}</span>
                <UIIcon icon={Box} size={18} className="text-text-muted transition group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
