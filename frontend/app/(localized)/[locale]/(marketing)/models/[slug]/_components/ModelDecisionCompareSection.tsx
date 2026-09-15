import { ArrowRight, CheckCircle2, Zap } from 'lucide-react';

import type { FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { UIIcon } from '@/components/ui/UIIcon';

import {
  CANONICAL_ONLY_COMPARE_SLUGS,
  COMPARE_EXCLUDED_SLUGS,
} from '../_lib/model-page-links';
import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_MUTED, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
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
  if (locale === 'fr') return 'Deux versions, des besoins différents.';
  if (locale === 'es') return 'Dos versiones para necesidades distintas.';
  return 'Two versions for different needs.';
}

function getCompareIntro(locale: AppLocale) {
  if (locale === 'fr') {
    return 'Comparez les prix, les formats et les possibilités de chaque modèle avant de choisir.';
  }
  if (locale === 'es') {
    return 'Compara precios, formatos y funciones de cada modelo antes de elegir.';
  }
  return 'Compare prices, formats, and capabilities before choosing your model.';
}

function getCardTitle({
  heroTitle,
  label,
  modelSlug,
}: {
  heroTitle: string;
  label: string;
  modelSlug?: string | null;
}) {
  return modelSlug === 'seedream' ? label : `${heroTitle} vs ${label}`;
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
        href: null,
      }));

  return (
    <section id={compareAnchorId} className={`model-compare-guide ${SECTION_SCROLL_MARGIN} space-y-9 py-6`}>
      {focusVsConfig ? (
        <div className="space-y-5 text-center">
          <div>
            <h2 className="text-3xl font-semibold leading-tight text-text-primary">{focusVsConfig.title}</h2>
            <p className="mt-2 text-base text-text-secondary">{getFocusSubtitle(locale)}</p>
            <Link
              href={localizeModelsPath(focusVsConfig.ctaSlug)}
              prefetch={false}
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-500 dark:text-blue-300"
            >
              <span>{focusVsConfig.ctaLabel}</span>
              <UIIcon icon={ArrowRight} size={15} className={MODEL_PAGE_ICON_MUTED} />
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {[
              {
                title: focusVsConfig.leftTitle,
                items: focusVsConfig.leftItems,
                icon: Zap,
                border: 'border-slate-200/90 dark:border-white/12',
                bg: 'bg-white/80 dark:bg-white/[0.045]',
              },
              {
                title: focusVsConfig.rightTitle,
                items: focusVsConfig.rightItems,
                icon: Zap,
                border: 'border-slate-200/90 dark:border-white/12',
                bg: 'bg-white/80 dark:bg-white/[0.045]',
              },
            ].map((card) => (
              <article
                key={card.title}
                className={`rounded-xl border ${card.border} ${card.bg} p-6 text-left shadow-[0_20px_58px_-42px_rgba(15,23,42,0.35)]`}
              >
                <div className="flex gap-5">
                  <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${MODEL_PAGE_ICON_WRAP}`}>
                    <UIIcon icon={card.icon} size={25} className={MODEL_PAGE_ICON} />
                  </span>
                  <div>
                    <h3 className="!text-left text-lg font-semibold text-text-primary">{card.title}</h3>
                    <ul className="mt-3 space-y-2.5 text-sm leading-6 text-text-secondary">
                      {card.items.map((item) => (
                        <li key={item} className="flex gap-2">
                          <UIIcon icon={CheckCircle2} size={15} className={`mt-0.5 shrink-0 ${MODEL_PAGE_ICON_MUTED}`} />
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
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold leading-tight text-text-primary">{compareCopy.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{getCompareIntro(locale)}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {compareCards
              .filter((entry) => Boolean(entry.modelSlug))
              .map((entry) => {
                const label = entry.title ?? '';
                const compareSlug = [engineSlug, entry.modelSlug].sort().join('-vs-');
                const canCompare = !COMPARE_EXCLUDED_SLUGS.has(engineSlug) &&
                  !COMPARE_EXCLUDED_SLUGS.has(entry.modelSlug ?? '') && isPublishedComparisonSlug(compareSlug);
                const compareHref = entry.href && !entry.href.includes('-vs-')
                  ? entry.href
                  : canCompare
                  ? CANONICAL_ONLY_COMPARE_SLUGS.has(compareSlug)
                    ? localizeComparePath(compareSlug)
                    : localizeComparePath(compareSlug, engineSlug)
                  : localizeModelsPath(entry.modelSlug ?? '');
                const ctaLabel = canCompare ? entry.ctaLabel ?? compareCopy.ctaCompare(label) : compareCopy.ctaExplore(label);
                const description = locale === 'en' ? entry.description || compareCopy.cardDescription(label) : compareCopy.cardDescription(label);
                const cardTitle = canCompare ? getCardTitle({ heroTitle, label, modelSlug: entry.modelSlug }) : label;
                return (
                  <article
                    key={entry.modelSlug}
                    className="model-compare-card border-t border-hairline py-5"
                  >
                    <div className="flex gap-4">
                      <EngineIcon engine={{ id: entry.modelSlug ?? '', label, brandId: entry.brand ?? undefined }} size={36} framed={false} />
                      <div>
                        <h3 className="!text-left text-base font-semibold text-text-primary">
                          {cardTitle}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-secondary">{description}</p>
                        <Link
                          href={compareHref}
                          prefetch={false}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-500 dark:text-blue-300"
                        >
                          <span>{ctaLabel}</span>
                          <UIIcon icon={ArrowRight} size={14} className={MODEL_PAGE_ICON_MUTED} />
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
