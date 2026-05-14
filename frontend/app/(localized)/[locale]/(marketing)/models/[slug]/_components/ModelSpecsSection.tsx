import type { AppLocale } from '@/i18n/locales';
import { SpecDetailsGrid } from '@/components/marketing/SpecDetailsGrid.client';
import { UIIcon } from '@/components/ui/UIIcon';
import {
  BadgeDollarSign,
  Box,
  Camera,
  Check,
  ChevronDown,
  Clock3,
  Crop,
  ExternalLink,
  FileVideo,
  Film,
  Gauge,
  Image as ImageIcon,
  Images,
  Monitor,
  ShieldCheck,
  Sparkles,
  Type,
  Video,
  Volume2,
  Waves,
} from 'lucide-react';
import {
  FULL_BLEED_SECTION,
  SECTION_BG_B,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  isSupported,
  localizeSpecStatus,
  type KeySpecKey,
  type KeySpecRow,
  type SpecSection,
} from '../_lib/model-page-specs';
import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_MUTED, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';

type ModelSpecsSectionProps = {
  hasSpecs: boolean;
  specTitle: string | null;
  specNote: string | null;
  keySpecRows: KeySpecRow[];
  specSectionsToShow: SpecSection[];
  isImageEngine: boolean;
  locale: AppLocale;
  statusLabels: { supported: string };
  variant?: 'default' | 'decision';
};

const SPEC_ICON_META: Record<KeySpecKey, { icon: typeof Check; tone: string }> = {
  pricePerImage: { icon: BadgeDollarSign, tone: MODEL_PAGE_ICON_WRAP },
  pricePerSecond: { icon: BadgeDollarSign, tone: MODEL_PAGE_ICON_WRAP },
  releaseDate: { icon: Clock3, tone: MODEL_PAGE_ICON_WRAP },
  textToImage: { icon: Type, tone: MODEL_PAGE_ICON_WRAP },
  imageToImage: { icon: Images, tone: MODEL_PAGE_ICON_WRAP },
  textToVideo: { icon: Type, tone: MODEL_PAGE_ICON_WRAP },
  imageToVideo: { icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
  videoToVideo: { icon: Video, tone: MODEL_PAGE_ICON_WRAP },
  firstLastFrame: { icon: Images, tone: MODEL_PAGE_ICON_WRAP },
  referenceImageStyle: { icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
  referenceVideo: { icon: Film, tone: MODEL_PAGE_ICON_WRAP },
  maxResolution: { icon: Monitor, tone: MODEL_PAGE_ICON_WRAP },
  maxDuration: { icon: Clock3, tone: MODEL_PAGE_ICON_WRAP },
  aspectRatios: { icon: Crop, tone: MODEL_PAGE_ICON_WRAP },
  fpsOptions: { icon: Gauge, tone: MODEL_PAGE_ICON_WRAP },
  outputFormats: { icon: FileVideo, tone: MODEL_PAGE_ICON_WRAP },
  audioOutput: { icon: Waves, tone: MODEL_PAGE_ICON_WRAP },
  nativeAudioGeneration: { icon: Volume2, tone: MODEL_PAGE_ICON_WRAP },
  lipSync: { icon: Volume2, tone: MODEL_PAGE_ICON_WRAP },
  cameraMotionControls: { icon: Camera, tone: MODEL_PAGE_ICON_WRAP },
  watermark: { icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
};

function getFullSpecsLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Voir toutes les specs';
  if (locale === 'es') return 'Ver specs completas';
  return 'View full specs';
}

function getDetailsLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Détails';
  if (locale === 'es') return 'Detalles';
  return 'Details';
}

function getDecisionSpecFallbackNote(locale: AppLocale) {
  if (locale === 'fr') return 'Les limites qui structurent vos rendus.';
  if (locale === 'es') return 'Los límites que definen tus renders.';
  return 'The limits that shape your renders.';
}

function renderDecisionSpecValue(row: KeySpecRow, locale: AppLocale, supportedLabel: string) {
  if (row.valueLines?.length) {
    return (
      <span className="flex flex-col gap-0.5">
        {row.valueLines.map((line) => (
          <span key={line}>{localizeSpecStatus(line, locale)}</span>
        ))}
      </span>
    );
  }

  if (isSupported(row.value)) {
    return (
      <span className={`inline-flex items-center gap-1 ${MODEL_PAGE_ICON_MUTED}`}>
        <UIIcon icon={Check} size={15} className={MODEL_PAGE_ICON_MUTED} />
        <span className="sr-only">{supportedLabel}</span>
      </span>
    );
  }

  return localizeSpecStatus(row.value, locale);
}

function ModelDecisionSpecsPanel({
  specTitle,
  specNote,
  keySpecRows,
  specSectionsToShow,
  locale,
  statusLabels,
}: Omit<ModelSpecsSectionProps, 'hasSpecs' | 'isImageEngine' | 'variant'>) {
  const detailsLabel = getDetailsLabel(locale);

  return (
    <section id="specs" className={SECTION_SCROLL_MARGIN}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="!text-left text-[1.7rem] font-semibold leading-tight tracking-normal text-slate-950 dark:text-white">
              {specTitle ?? 'Specs'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {specNote ?? getDecisionSpecFallbackNote(locale)}
            </p>
          </div>
          <a
            href="#specs"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <span>{getFullSpecsLabel(locale)}</span>
            <UIIcon icon={ExternalLink} size={14} />
          </a>
        </div>

        {keySpecRows.length ? (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {keySpecRows.map((row) => {
              const meta = SPEC_ICON_META[row.key] ?? { icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP };
              return (
                <article
                  key={row.id}
                  className="min-h-[88px] rounded-xl border border-slate-200 bg-white/78 p-3 shadow-[0_12px_38px_-30px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/[0.045] sm:p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${meta.tone}`}>
                      <UIIcon icon={meta.icon} size={19} strokeWidth={1.85} className={MODEL_PAGE_ICON} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="!text-left text-[0.82rem] font-semibold leading-snug text-slate-950 dark:text-white">
                        {row.label}
                      </h3>
                      <div className="mt-1 text-[0.82rem] leading-5 text-slate-600 dark:text-slate-300">
                        {renderDecisionSpecValue(row, locale, statusLabels.supported)}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {specSectionsToShow.length ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {specSectionsToShow.slice(0, 2).map((section, index) => {
              const Icon = index === 0 ? Sparkles : Box;
              return (
                <article
                  key={section.title}
                  className="rounded-xl border border-slate-200 bg-white/78 p-4 shadow-[0_12px_38px_-30px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/[0.045]"
                >
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-3">
                        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${MODEL_PAGE_ICON_WRAP}`}>
                          <UIIcon icon={Icon} size={20} strokeWidth={1.85} className={MODEL_PAGE_ICON} />
                        </span>
                        <div>
                          <h3 className="!text-left text-base font-semibold leading-tight text-slate-950 dark:text-white">
                            {section.title}
                          </h3>
                          {section.intro ? (
                            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
                              {section.intro}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                        {detailsLabel}
                        <UIIcon icon={ChevronDown} size={14} className="transition group-open:rotate-180" />
                      </span>
                    </summary>
                    <ul className="mt-3 list-disc space-y-1.5 pl-[3.25rem] text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </details>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ModelSpecsSection({
  hasSpecs,
  specTitle,
  specNote,
  keySpecRows,
  specSectionsToShow,
  isImageEngine,
  locale,
  statusLabels,
  variant = 'default',
}: ModelSpecsSectionProps) {
  if (!hasSpecs) {
    return null;
  }

  if (variant === 'decision') {
    return (
      <ModelDecisionSpecsPanel
        specTitle={specTitle}
        specNote={specNote}
        keySpecRows={keySpecRows}
        specSectionsToShow={specSectionsToShow}
        locale={locale}
        statusLabels={statusLabels}
      />
    );
  }

  return (
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
                          <span className={`inline-flex items-center gap-1 ${MODEL_PAGE_ICON_MUTED}`}>
                            <UIIcon icon={Check} size={14} className={MODEL_PAGE_ICON_MUTED} />
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
  );
}
