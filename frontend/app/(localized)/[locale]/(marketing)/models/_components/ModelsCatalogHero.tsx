import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AppLocale } from '@/i18n/locales';
import { MODELS_HERO_IMAGE_URL } from '../_lib/models-catalog-utils';
import type { ModelsCatalogDecisionBadge, ModelsCatalogTopPick } from '../_lib/models-catalog-decision-data';
import { ModelsCatalogTopPicksPanel } from './ModelsCatalogTopPicksPanel';

type ModelsCatalogHeroProps = {
  activeLocale: AppLocale;
  badges: ModelsCatalogDecisionBadge[];
  eyebrow: string;
  heroAccentParts: {
    emphasis: string;
    prefix: string;
  };
  heroSubhead: string;
  heroTitleParts: {
    accent: string;
    lead: string;
  };
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  scopeTabs: Array<{
    active: boolean;
    href: string;
    id: string;
    label: string;
  }>;
  topPicks: ModelsCatalogTopPick[];
  topPicksTitle: string;
  topPicksViewAllLabel: string;
};

export function ModelsCatalogHero({
  activeLocale,
  badges,
  eyebrow,
  heroAccentParts,
  heroSubhead,
  heroTitleParts,
  primaryCtaLabel,
  secondaryCtaLabel,
  scopeTabs,
  topPicks,
  topPicksTitle,
  topPicksViewAllLabel,
}: ModelsCatalogHeroProps) {
  return (
    <section className="relative isolate overflow-hidden border-b border-hairline bg-bg">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Image
          src={MODELS_HERO_IMAGE_URL}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-45 mix-blend-multiply dark:opacity-25 dark:mix-blend-screen dark:invert"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--bg)_0%,rgba(255,255,255,0.88)_48%,rgba(255,255,255,0.18)_100%)] dark:bg-[linear-gradient(90deg,var(--bg)_0%,rgba(7,11,18,0.82)_48%,rgba(7,11,18,0.22)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent_0%,var(--bg)_100%)]" />
      </div>
      <div className="container-page relative z-10 max-w-[1248px] py-10 sm:py-12 lg:min-h-[430px] lg:py-10">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_352px] lg:items-start xl:grid-cols-[minmax(0,1fr)_370px]">
          <div className="min-w-0">
            <header className="min-w-0 max-w-[720px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{eyebrow}</p>
              <h1 className="mt-4 text-balance text-[40px] font-semibold leading-[1.04] tracking-normal text-text-primary sm:text-[54px] lg:text-[58px] xl:text-[60px]">
                {heroTitleParts.lead}
                {heroTitleParts.accent ? (
                  <>
                    <br />
                    <span>
                      {heroAccentParts.prefix}
                      {heroAccentParts.emphasis}
                    </span>
                  </>
                ) : null}
              </h1>
              <p className="mt-5 max-w-[62ch] text-base font-medium leading-relaxed text-text-secondary sm:text-lg">
                {heroSubhead}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#models-grid"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-text-primary px-5 text-sm font-semibold text-bg shadow-[0_14px_28px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:opacity-90"
                >
                  {primaryCtaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <Link
                  href="/ai-video-engines"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-hairline bg-surface/88 px-5 text-sm font-semibold text-text-primary shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-text-muted"
                >
                  {secondaryCtaLabel}
                </Link>
              </div>
            </header>

            <div className="mt-7 flex flex-wrap gap-3">
              {badges.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/86 px-3 py-2 text-xs font-semibold text-text-secondary shadow-sm backdrop-blur"
                >
                  <UIIcon icon={badge.icon} size={14} />
                  {badge.label}
                </span>
              ))}
            </div>

            <nav
              aria-label={activeLocale === 'fr' ? 'Vues du catalogue modeles' : activeLocale === 'es' ? 'Vistas del catalogo de modelos' : 'Model catalog views'}
              className="mt-6 flex flex-wrap gap-2"
            >
              {scopeTabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-micro shadow-sm transition ${
                    tab.active
                      ? 'border-text-primary bg-text-primary text-bg'
                      : 'border-hairline bg-surface/88 text-text-secondary backdrop-blur hover:border-text-muted hover:text-text-primary'
                  }`}
                  aria-current={tab.active ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>

          {topPicks.length ? (
            <ModelsCatalogTopPicksPanel title={topPicksTitle} viewAllLabel={topPicksViewAllLabel} items={topPicks} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
