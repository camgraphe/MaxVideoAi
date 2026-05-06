import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';
import { TextLink } from '@/components/ui/TextLink';
import {
  CANONICAL_ONLY_COMPARE_SLUGS,
  COMPARE_EXCLUDED_SLUGS,
} from '../_lib/model-page-links';
import {
  FULL_BLEED_SECTION,
  SECTION_BG_B,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  type RelatedItem,
} from '../_lib/model-page-specs';

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

type ModelCompareSectionProps = {
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

export function ModelCompareSection({
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
}: ModelCompareSectionProps) {
  return hasCompareSection ? (
          <section
            id={compareAnchorId}
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap-lg`}
          >
            {focusVsConfig ? (
              <>
                <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  {focusVsConfig.title}
                </h2>
                <TextLink
                  href={localizeModelsPath(focusVsConfig.ctaSlug)}
                  className="mx-auto text-sm font-semibold text-brand hover:text-brandHover"
                  linkComponent={Link}
                >
                  {focusVsConfig.ctaLabel}
                </TextLink>
                <div className="grid grid-gap-sm lg:grid-cols-2">
                  <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                    <h3 className="text-base font-semibold text-text-primary">{focusVsConfig.leftTitle}</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                      {focusVsConfig.leftItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                    <h3 className="text-base font-semibold text-text-primary">{focusVsConfig.rightTitle}</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                      {focusVsConfig.rightItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            ) : null}
            {hasCompareGrid ? (
              <div className={focusVsConfig ? 'mt-10 stack-gap sm:mt-12' : 'stack-gap'}>
                <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  {compareCopy.title}
                </h2>
                <p className="text-center text-base leading-relaxed text-text-secondary">
                  {compareCopy.introPrefix}
                  <strong>{compareCopy.introStrong}</strong>
                  {compareCopy.introSuffix}
                </p>
                <p className="text-center text-sm text-text-secondary">{compareCopy.subline}</p>
                <div className="grid grid-gap-sm md:grid-cols-3">
                  {(() => {
                    const hasRelatedItems = relatedItems.length > 0;
                    const compareCards = hasRelatedItems
                      ? relatedItems
                      : compareEngines.map((entry) => ({
                        brand: entry.brandId,
                        title: entry.marketingName ?? entry.engine.label,
                        modelSlug: entry.modelSlug,
                        description: entry.seo?.description ?? '',
                      }));
                    return compareCards;
                  })()
                    .filter((entry) => Boolean(entry.modelSlug))
                    .map((entry) => {
                      const label = entry.title ?? '';
                      const canCompare =
                        !COMPARE_EXCLUDED_SLUGS.has(engineSlug) && !COMPARE_EXCLUDED_SLUGS.has(entry.modelSlug ?? '');
                      const compareSlug = [engineSlug, entry.modelSlug].sort().join('-vs-');
                      const compareHref = canCompare
                        ? CANONICAL_ONLY_COMPARE_SLUGS.has(compareSlug)
                          ? localizeComparePath(compareSlug)
                          : localizeComparePath(compareSlug, engineSlug)
                        : localizeModelsPath(entry.modelSlug ?? '');
                      const ctaLabel = canCompare ? compareCopy.ctaCompare(label) : compareCopy.ctaExplore(label);
                      const description =
                        relatedItems.length > 0
                          ? entry.description || compareCopy.cardDescription(label)
                          : locale === 'en'
                            ? entry.description || compareCopy.cardDescription(label)
                            : compareCopy.cardDescription(label);
                      return (
                        <article
                          key={entry.modelSlug}
                          className="rounded-2xl border border-hairline bg-surface/90 p-4 shadow-card transition hover:-translate-y-1 hover:border-text-muted"
                        >
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-text-primary">
                              {heroTitle} vs {label}
                            </h3>
                          </div>
                          <p className="mt-2 text-sm text-text-secondary line-clamp-2">{description}</p>
                          <TextLink href={compareHref} className="mt-4 gap-1 text-sm" linkComponent={Link}>
                            {ctaLabel}
                          </TextLink>
                        </article>
                      );
                    })}
                </div>
              </div>
            ) : null}
          </section>
  ) : null;
}
