import { ArrowRight, CheckCircle2, ChevronRight, Clock3, Film, Layers3, Mic2, PlayCircle, Sparkles, WalletCards } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { UIIcon } from '@/components/ui/UIIcon';
import { BackLink } from '@/components/video/BackLink';

import type { ModelDecisionData, ModelDecisionFeature } from '../_lib/model-page-decision-data';
import type { FeaturedMedia } from '../_lib/model-page-media';
import { MediaPreview } from './MediaPreview';

const FEATURE_ICON_MAP: Record<ModelDecisionFeature['tone'], typeof Mic2> = {
  audio: Mic2,
  continuity: Layers3,
  reference: Sparkles,
  quality: Film,
  duration: Clock3,
  price: WalletCards,
};

type ModelDecisionHeroSectionProps = {
  decision: ModelDecisionData;
  modelsPathname: string;
  backLabel: string;
  localizeModelsPath: (targetSlug?: string) => string;
  resolvedBreadcrumb: { models: string };
  breadcrumbModelLabel: string;
  heroMedia: FeaturedMedia;
  locale: AppLocale;
  audioBadgeLabel: string;
  mediaAltContext: string;
};

export function ModelDecisionHeroSection({
  decision,
  modelsPathname,
  backLabel,
  localizeModelsPath,
  resolvedBreadcrumb,
  breadcrumbModelLabel,
  heroMedia,
  locale,
  audioBadgeLabel,
  mediaAltContext,
}: ModelDecisionHeroSectionProps) {
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <BackLink href={modelsPathname} label={backLabel} className="font-semibold text-brand hover:text-brandHover" />
        <span aria-hidden className="text-text-muted">
          /
        </span>
        <Link href={localizeModelsPath()} className="font-semibold text-text-secondary hover:text-text-primary">
          {resolvedBreadcrumb.models}
        </Link>
        <span aria-hidden className="text-text-muted">
          /
        </span>
        <span className="font-semibold text-text-muted">{breadcrumbModelLabel}</span>
      </nav>

      <section className="rounded-[28px] border border-hairline bg-surface p-5 shadow-card sm:p-7 lg:p-8">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)] lg:items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                {decision.hero.eyebrow}
              </p>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-text-primary sm:text-5xl">
                  {decision.hero.title}
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-text-secondary">{decision.hero.subtitle}</p>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">{decision.hero.paragraph}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={decision.hero.primaryCta.href}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-input bg-[#08172d] px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-[#102647] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <UIIcon icon={PlayCircle} size={18} />
                <span>{decision.hero.primaryCta.label}</span>
              </Link>
              <Link
                href={decision.hero.secondaryCta.href}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-input border border-hairline bg-white px-5 py-3 text-sm font-semibold text-text-primary shadow-card transition hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:bg-white/[0.045] dark:text-white"
              >
                <span>{decision.hero.secondaryCta.label}</span>
                <UIIcon icon={ArrowRight} size={16} />
              </Link>
            </div>

            {decision.hero.quickLinks.length ? (
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {decision.hero.quickLinks.map((link) => (
                  <Link
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    className="inline-flex items-center gap-1 font-semibold text-brand transition hover:text-brandHover"
                  >
                    <span>{link.label}</span>
                    <UIIcon icon={ChevronRight} size={14} />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[26px] border border-hairline bg-surface-2 p-3 shadow-card">
            <MediaPreview
              media={heroMedia}
              label={decision.media.caption}
              locale={locale}
              audioBadgeLabel={audioBadgeLabel}
              renderLinkLabel={decision.media.renderLabel}
              promptLabel={decision.media.description}
              hidePrompt
              metaLines={decision.media.badges.map((badge, index) => ({
                label: index === 0 ? decision.media.caption : '',
                value: badge,
              }))}
              altContext={mediaAltContext || decision.media.altContext}
              autoPlayDelayMs={250}
              waitForLcp
              showPlayButton={false}
              priority
              fetchPriority="high"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {decision.features.map((feature) => {
            const Icon = FEATURE_ICON_MAP[feature.tone];
            return (
              <div key={feature.title} className="rounded-2xl border border-hairline bg-surface-2 p-4">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-brand">
                  <UIIcon icon={Icon} size={18} strokeWidth={1.9} />
                </div>
                <h2 className="text-sm font-semibold text-text-primary">{feature.title}</h2>
                <p className="mt-1 text-xs leading-5 text-text-secondary">{feature.body}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
