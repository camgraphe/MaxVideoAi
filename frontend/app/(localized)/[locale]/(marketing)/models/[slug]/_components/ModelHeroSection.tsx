import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { UIIcon } from '@/components/ui/UIIcon';
import { BackLink } from '@/components/video/BackLink';
import type { FeaturedMedia } from '../_lib/model-page-media';
import {
  BEST_USE_CASE_ICON_MAP,
  FULL_BLEED_SECTION,
  HERO_AUTOPLAY_DELAY_MS,
  HERO_BG,
  HERO_SPEC_ICON_MAP,
  type BestUseCaseItem,
  type HeroSpecChip,
} from '../_lib/model-page-specs';
import { MediaPreview } from './MediaPreview';

type ModelHeroSectionProps = {
  modelsPathname: string;
  backLabel: string;
  localizeModelsPath: (targetSlug?: string) => string;
  resolvedBreadcrumb: { models: string };
  breadcrumbModelLabel: string;
  heroEyebrow: string | null;
  heroTitle: string;
  heroSubtitle: string | null;
  heroSupportLine: string | null;
  heroSpecChips: HeroSpecChip[];
  heroBadge: string | null;
  heroLimitsLine: string | null;
  showHeroDescriptions: boolean;
  heroDesc1: string | null;
  heroDesc2: string | null;
  resolvedPrimaryCta: string | null;
  normalizedPrimaryCtaHref: LocalizedLinkHref;
  secondaryCta: string | null;
  localizedSecondaryCtaHref: LocalizedLinkHref | null;
  heroQuickLinks: Array<{ label: string; href: LocalizedLinkHref }>;
  pricingLinkHref: LocalizedLinkHref;
  pricingLinkLabel: string;
  heroTrustLine: string | null;
  isEsLocale: boolean;
  howToLatamTitle: string | null;
  howToLatamSteps: string[];
  heroMedia: FeaturedMedia;
  locale: AppLocale;
  audioBadgeLabel: string;
  heroMetaLines: Array<{ label: string; value: string }>;
  mediaAltContexts: { hero: string };
  bestUseCaseItems: BestUseCaseItem[];
  bestUseCases: string[];
  bestUseCasesTitle: string | null;
  whyTitle: string | null;
  heroHighlights: string[];
};

export function ModelHeroSection({
  modelsPathname,
  backLabel,
  localizeModelsPath,
  resolvedBreadcrumb,
  breadcrumbModelLabel,
  heroEyebrow,
  heroTitle,
  heroSubtitle,
  heroSupportLine,
  heroSpecChips,
  heroBadge,
  heroLimitsLine,
  showHeroDescriptions,
  heroDesc1,
  heroDesc2,
  resolvedPrimaryCta,
  normalizedPrimaryCtaHref,
  secondaryCta,
  localizedSecondaryCtaHref,
  heroQuickLinks,
  pricingLinkHref,
  pricingLinkLabel,
  heroTrustLine,
  isEsLocale,
  howToLatamTitle,
  howToLatamSteps,
  heroMedia,
  locale,
  audioBadgeLabel,
  heroMetaLines,
  mediaAltContexts,
  bestUseCaseItems,
  bestUseCases,
  bestUseCasesTitle,
  whyTitle,
  heroHighlights,
}: ModelHeroSectionProps) {
  return (
          <div className="stack-gap-xs">
            <nav className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <BackLink
                href={modelsPathname}
                label={backLabel}
                className="font-semibold text-brand hover:text-brandHover"
              />
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

            <section className={`${FULL_BLEED_SECTION} ${HERO_BG} stack-gap rounded-3xl bg-surface/80 p-6 sm:p-8`}>
              <div className="stack-gap-lg">
            <div className="stack-gap-sm text-center">
              {heroEyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                  {heroEyebrow}
                </p>
              ) : null}
              <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">
                {heroTitle}
              </h1>
              {heroSubtitle ? (
                <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
                  {heroSubtitle}
                </p>
              ) : null}
              {heroSupportLine ? (
                <p className="text-sm font-medium text-text-secondary">
                  {heroSupportLine}
                </p>
              ) : null}
              {heroSpecChips.length ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {heroSpecChips.map((chip, index) => {
                    const Icon = chip.icon ? HERO_SPEC_ICON_MAP[chip.icon] : null;
                    return (
                      <Chip
                        key={`${chip.label}-${index}`}
                        variant="outline"
                        className="!border-accent-alt/40 !bg-accent-alt px-3 py-1 text-[11px] font-semibold normal-case tracking-normal !text-on-accent-alt shadow-card"
                      >
                        {Icon ? <UIIcon icon={Icon} size={14} className="text-on-accent-alt" /> : null}
                        <span>{chip.label}</span>
                      </Chip>
                    );
                  })}
                </div>
              ) : heroBadge ? (
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary shadow-card">
                  {heroBadge.split('·').map((chunk, index, arr) => (
                    <span key={`${chunk}-${index}`} className="flex items-center gap-2">
                      <span>{chunk.trim()}</span>
                      {index < arr.length - 1 ? <span aria-hidden>·</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}
              {heroLimitsLine ? (
                <p className="mx-auto max-w-2xl text-xs font-medium leading-5 text-text-muted">
                  {heroLimitsLine}
                </p>
              ) : null}
              {showHeroDescriptions && heroDesc1 ? (
                <p className="text-base leading-relaxed text-text-secondary">{heroDesc1}</p>
              ) : null}
              {showHeroDescriptions && heroDesc2 ? (
                <p className="text-base leading-relaxed text-text-secondary">{heroDesc2}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {resolvedPrimaryCta ? (
                <ButtonLink
                  href={normalizedPrimaryCtaHref}
                  size="lg"
                  className="shadow-card"
                  linkComponent={Link}
                >
                  {resolvedPrimaryCta}
                </ButtonLink>
              ) : null}
              {secondaryCta && localizedSecondaryCtaHref ? (
                <ButtonLink
                  href={localizedSecondaryCtaHref}
                  variant="outline"
                  size="lg"
                  linkComponent={Link}
                >
                  {secondaryCta}
                </ButtonLink>
              ) : null}
            </div>
            {heroQuickLinks.length ? (
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
                {heroQuickLinks.map((item) => (
                  <Link key={`${item.label}-${String(item.href)}`} href={item.href} className="font-semibold text-brand hover:text-brandHover">
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
            {!heroSpecChips.length ? (
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link href={pricingLinkHref} className="font-semibold text-brand hover:text-brandHover">
                  {pricingLinkLabel}
                </Link>
              </div>
            ) : null}
            {heroTrustLine ? (
              <p className="text-center text-xs font-semibold text-text-muted">{heroTrustLine}</p>
            ) : null}
            {isEsLocale && howToLatamTitle && howToLatamSteps.length ? (
              <section className="rounded-2xl border border-hairline bg-surface/70 p-5 shadow-card">
                <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{howToLatamTitle}</h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
                  {howToLatamSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <div className="flex justify-center">
                <div className="w-full max-w-5xl">
                  <MediaPreview
                    media={heroMedia}
                    label={heroTitle}
                    locale={locale}
                    audioBadgeLabel={audioBadgeLabel}
                    hideLabel
                    hidePrompt
                    metaLines={heroMetaLines}
                    altContext={mediaAltContexts.hero}
                    autoPlayDelayMs={HERO_AUTOPLAY_DELAY_MS}
                    waitForLcp
                    showPlayButton={false}
                    priority
                    fetchPriority="high"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {bestUseCaseItems.length || bestUseCases.length ? (
                  <div className="space-y-1.5 rounded-2xl border border-hairline bg-surface/80 p-3 shadow-card">
                    {bestUseCasesTitle ? (
                      <p className="text-xs font-semibold text-text-primary">{bestUseCasesTitle}</p>
                    ) : null}
                    {bestUseCaseItems.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {bestUseCaseItems.map((item, index) => {
                          const Icon = item.icon ? BEST_USE_CASE_ICON_MAP[item.icon] : null;
                          const chip = (
                            <Chip
                              variant="outline"
                              className="px-2.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-text-secondary"
                            >
                              {Icon ? <UIIcon icon={Icon} size={14} className="text-text-muted" /> : null}
                              <span>{item.title}</span>
                            </Chip>
                          );
                          if (!item.href) {
                            return <span key={`${item.title}-${index}`}>{chip}</span>;
                          }
                          return (
                            <Link
                              key={`${item.title}-${index}`}
                              href={item.href}
                              className="inline-flex rounded-full transition hover:border-brand/35 hover:text-brandHover focus:outline-none focus:ring-2 focus:ring-brand/35"
                            >
                              {chip}
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <ul className="grid gap-1 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-1">
                        {bestUseCases.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                {whyTitle || heroHighlights.length ? (
                  <div className="stack-gap-sm rounded-2xl border border-hairline bg-bg px-3 py-2.5">
                    {whyTitle ? <p className="text-xs font-semibold text-text-primary">{whyTitle}</p> : null}
                    {heroHighlights.length ? (
                      <ul className="grid gap-1.5 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-1">
                        {heroHighlights.map((item) => {
                          const [title, detail] = item.split('||');
                          const trimmedTitle = title?.trim();
                          const trimmedDetail = detail?.trim();
                          return (
                            <li key={item} className="flex items-start gap-2">
                              <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-text-muted" aria-hidden />
                              {trimmedDetail ? (
                                <span>
                                  <strong className="font-semibold">{trimmedTitle}</strong>
                                  {trimmedDetail ? ` (${trimmedDetail})` : null}
                                </span>
                              ) : (
                                <span>{item}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
              </div>
            </section>
          </div>
  );
}
