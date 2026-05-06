import type { AppLocale } from '@/i18n/locales';
import { SpecDetailsGrid } from '@/components/marketing/SpecDetailsGrid.client';
import { UIIcon } from '@/components/ui/UIIcon';
import { Check } from 'lucide-react';
import {
  FULL_BLEED_SECTION,
  SECTION_BG_B,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  isSupported,
  localizeSpecStatus,
  type KeySpecRow,
  type SpecSection,
} from '../_lib/model-page-specs';

type ModelSpecsSectionProps = {
  hasSpecs: boolean;
  specTitle: string | null;
  specNote: string | null;
  keySpecRows: KeySpecRow[];
  specSectionsToShow: SpecSection[];
  isImageEngine: boolean;
  locale: AppLocale;
  statusLabels: { supported: string };
};

export function ModelSpecsSection({
  hasSpecs,
  specTitle,
  specNote,
  keySpecRows,
  specSectionsToShow,
  isImageEngine,
  locale,
  statusLabels,
}: ModelSpecsSectionProps) {
  return hasSpecs ? (
          <section
            id="specs"
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            {specTitle ? (
              <h2 className="mt-2 text-center text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                {specTitle}
              </h2>
            ) : null}
            {specNote ? (
              <blockquote className="rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-center text-sm text-text-secondary">
                {specNote}
              </blockquote>
            ) : null}
            {keySpecRows.length ? (
              <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-3 gap-y-1.5 border-t border-hairline/70 pt-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {keySpecRows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`flex items-start gap-2 border-hairline/70 py-1.5 pr-1 ${
                      index < keySpecRows.length - 1 ? 'border-b' : ''
                    }`}
                  >
                    <span className="mt-[3px] inline-flex h-1.5 w-1.5 rounded-full bg-text-muted/60" aria-hidden />
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">
                        {row.label}
                      </span>
                      <span className="text-[13px] font-semibold leading-snug text-text-primary">
                        {row.valueLines?.length ? (
                          <span className="flex flex-col gap-1">
                            {row.valueLines.map((line) => (
                              <span key={line}>{localizeSpecStatus(line, locale)}</span>
                            ))}
                          </span>
                        ) : isSupported(row.value) ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <UIIcon icon={Check} size={14} className="text-emerald-600" />
                            <span className="sr-only">{statusLabels.supported}</span>
                          </span>
                        ) : (
                          localizeSpecStatus(row.value, locale)
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {specSectionsToShow.length ? (
              isImageEngine ? (
                <div className="grid grid-gap-sm sm:grid-cols-2">
                  {specSectionsToShow.map((section) => (
                    <article
                      key={section.title}
                      className="space-y-2 rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
                    >
                      <h3 className="text-lg font-semibold text-text-primary">{section.title}</h3>
                      {section.intro ? (
                        <p className="text-sm text-text-secondary">{section.intro}</p>
                      ) : null}
                      <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <SpecDetailsGrid sections={specSectionsToShow} />
              )
            ) : null}
          </section>
  ) : null;
}
