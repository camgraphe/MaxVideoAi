import { ArrowRight, CheckCircle2, CircleDot, Sparkles, Zap } from 'lucide-react';

import type { FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';

import {
  CANONICAL_ONLY_COMPARE_SLUGS,
  COMPARE_EXCLUDED_SLUGS,
} from '../_lib/model-page-links';
import { SECTION_SCROLL_MARGIN, type RelatedItem } from '../_lib/model-page-specs';

type FocusVsConfig = {
  title: string;
  ctaLabel: string;
  ctaSlug: string;
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
};

type CompareCopy = {
  title: string;
  introPrefix: string;
  introStrong: string;
  introSuffix: string;
  subline: string;
  ctaCompare: (label: string) => string;
  ctaExplore: (label: string) => string;
  cardDescription: (label: string) => string;
};

type ModelDecisionCompareSectionProps = {
  hasCompareSection: boolean;
  compareAnchorId: string;
  focusVsConfig: FocusVsConfig | null;
  localizeModelsPath: (targetSlug?: string) => string;
  hasCompareGrid: boolean;
  compareCopy: CompareCopy;
  relatedItems: RelatedItem[];
  compareEngines: FalEngineEntry[];
  engineSlug: string;
  localizeComparePath: (pairSlug: string, orderSlug?: string) => LocalizedLinkHref;
  locale: AppLocale;
  heroTitle: string;
};

function getFocusSubtitle(locale: AppLocale) {
  if (locale === 'fr') return 'Deux routes, une famille. Choisissez selon votre etape.';
  if (locale === 'es') return 'Dos rutas, una familia. Elige segun tu etapa.';
  return 'Two routes, one series. Pick the right one for your stage.';
}

function getCompareIntro(locale: AppLocale) {
  if (locale === 'fr') {
    return 'Ces comparaisons clarifient les arbitrages de prix, resolution, audio, vitesse et style motion pour choisir vite le bon moteur.';
  }
  if (locale === 'es') {
    return 'Estas comparaciones explican precio, resolucion, audio, velocidad y estilo de motion para elegir rapido el motor correcto.';
  }
  return 'These side-by-side comparisons break down price, resolution, audio, speed, and motion style so you can pick the right engine fast.';
}

function getCardIcon(index: number) {
  return [Sparkles, Zap, CircleDot, CheckCircle2][index % 4] ?? Sparkles;
}

export function ModelDecisionCompareSection({
  hasCompareSection,
  compareAnchorId,
  focusVsConfig,
  localizeModelsPath,
  hasCompareGrid,
  compareCopy,
  relatedItems,
  compareEngines,
  engineSlug,
  localizeComparePath,
  locale,
  heroTitle,
}: ModelDecisionCompareSectionProps) {
  if (!hasCompareSection) return null;

  const compareCards = relatedItems.length
    ? relatedItems
    : compareEngines.map((entry) => ({
        brand: entry.brandId,
        title: entry.marketingName ?? entry.engine.label,
        modelSlug: entry.modelSlug,
        description: entry.seo?.description ?? '',
        ctaLabel: null,
      }));

  return (
    <section id={compareAnchorId} className={`${SECTION_SCROLL_MARGIN} space-y-9 py-6`}>
      {focusVsConfig ? (
        <div className="space-y-5 text-center">
          <div>
            <h2 className="text-3xl font-semibold leading-tight text-text-primary">{focusVsConfig.title}</h2>
            <p className="mt-2 text-base text-text-secondary">{getFocusSubtitle(locale)}</p>
            <Link
              href={localizeModelsPath(focusVsConfig.ctaSlug)}
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-500 dark:text-blue-300"
            >
              <span>{focusVsConfig.ctaLabel}</span>
              <UIIcon icon={ArrowRight} size={15} />
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {[
              {
                title: focusVsConfig.leftTitle,
                items: focusVsConfig.leftItems,
                icon: Zap,
                border: 'border-emerald-300/80 dark:border-emerald-400/30',
                bg: 'bg-emerald-50/45 dark:bg-emerald-500/8',
                iconTone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300',
                check: 'text-emerald-600 dark:text-emerald-300',
              },
              {
                title: focusVsConfig.rightTitle,
                items: focusVsConfig.rightItems,
                icon: Zap,
                border: 'border-violet-300/80 dark:border-violet-400/30',
                bg: 'bg-violet-50/45 dark:bg-violet-500/8',
                iconTone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/12 dark:text-violet-300',
                check: 'text-violet-600 dark:text-violet-300',
              },
            ].map((card) => (
              <article
                key={card.title}
                className={`rounded-xl border ${card.border} ${card.bg} p-6 text-left shadow-[0_20px_58px_-42px_rgba(15,23,42,0.35)]`}
              >
                <div className="flex gap-5">
                  <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${card.iconTone}`}>
                    <UIIcon icon={card.icon} size={25} />
                  </span>
                  <div>
                    <h3 className="!text-left text-lg font-semibold text-text-primary">{card.title}</h3>
                    <ul className="mt-3 space-y-2.5 text-sm leading-6 text-text-secondary">
                      {card.items.map((item) => (
                        <li key={item} className="flex gap-2">
                          <UIIcon icon={CheckCircle2} size={15} className={`mt-0.5 shrink-0 ${card.check}`} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {hasCompareGrid ? (
        <div className="space-y-5">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold leading-tight text-text-primary">{compareCopy.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{getCompareIntro(locale)}</p>
            <p className="mt-1 text-sm text-text-secondary">{compareCopy.subline}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {compareCards
              .filter((entry) => Boolean(entry.modelSlug))
              .map((entry, index) => {
                const label = entry.title ?? '';
                const canCompare =
                  !COMPARE_EXCLUDED_SLUGS.has(engineSlug) && !COMPARE_EXCLUDED_SLUGS.has(entry.modelSlug ?? '');
                const compareSlug = [engineSlug, entry.modelSlug].sort().join('-vs-');
                const compareHref = canCompare
                  ? CANONICAL_ONLY_COMPARE_SLUGS.has(compareSlug)
                    ? localizeComparePath(compareSlug)
                    : localizeComparePath(compareSlug, engineSlug)
                  : localizeModelsPath(entry.modelSlug ?? '');
                const ctaLabel = entry.ctaLabel ?? (canCompare ? compareCopy.ctaCompare(label) : compareCopy.ctaExplore(label));
                const description = entry.description || compareCopy.cardDescription(label);
                const Icon = getCardIcon(index);
                return (
                  <article
                    key={entry.modelSlug}
                    className="rounded-xl border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.34)] transition hover:-translate-y-0.5 hover:border-blue-200 dark:border-white/10 dark:bg-slate-950/72"
                  >
                    <div className="flex gap-4">
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300">
                        <UIIcon icon={Icon} size={22} />
                      </span>
                      <div>
                        <h3 className="!text-left text-base font-semibold text-text-primary">
                          {heroTitle} vs {label}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-secondary">{description}</p>
                        <Link
                          href={compareHref}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-500 dark:text-blue-300"
                        >
                          <span>{ctaLabel}</span>
                          <UIIcon icon={ArrowRight} size={14} />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
