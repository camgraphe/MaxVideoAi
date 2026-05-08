'use client';

import { ArrowRight } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { ModelGalleryCard, ModelsGalleryCopy } from './ModelsGallery';
import {
  formatTemplate,
  getCapabilityIcon,
  normalizeCtaLabel,
} from './models-gallery-utils';

export function ModelCard({
  card,
  ctaLabel,
  compareMode,
  compareLabel,
  compareTooltip,
  compareAria,
  strengthsLabel,
  statsLabels,
  capabilityTooltips,
  audioAvailableLabel,
  compareEnabled,
  selected,
  onToggle,
  onActivateCompare,
}: {
  card: ModelGalleryCard;
  ctaLabel: string;
  compareMode: boolean;
  compareLabel: string;
  compareTooltip: string;
  compareAria: string;
  strengthsLabel: string;
  statsLabels: Required<NonNullable<ModelsGalleryCopy['stats']>>;
  capabilityTooltips: Record<string, string>;
  audioAvailableLabel: string;
  compareEnabled: boolean;
  selected: boolean;
  onToggle: () => void;
  onActivateCompare: () => void;
}) {
  const router = useRouter();
  type RouterPushInput = Parameters<typeof router.push>[0];
  const accent = card.backgroundColor ?? '#6366f1';
  const normalizedCtaLabel = normalizeCtaLabel(ctaLabel);
  const ctaText = normalizedCtaLabel.replace(/\s*→\s*$/, '');
  const scoreValue = typeof card.overallScore === 'number' ? card.overallScore.toFixed(1) : null;
  const scoreSweep = `${Math.max(0, Math.min(360, (card.overallScore ?? 0) * 36))}deg`;
  const providerBadgeBg = `color-mix(in srgb, ${accent} 2%, white 98%)`;
  const providerBadgeBorder = `color-mix(in srgb, ${accent} 10%, #dbe4ee 90%)`;
  const providerBadgeText = `color-mix(in srgb, ${accent} 16%, #111827 84%)`;
  const providerBadgeBgDark = `color-mix(in srgb, ${accent} 10%, #0f172a 90%)`;
  const providerBadgeBorderDark = `color-mix(in srgb, ${accent} 18%, #334155 82%)`;
  const providerBadgeTextDark = `color-mix(in srgb, ${accent} 20%, #f8fafc 80%)`;
  const cardSurface = `linear-gradient(180deg, color-mix(in srgb, ${accent} 1%, #ffffff 99%) 0%, color-mix(in srgb, ${accent} 2%, #fbfdff 98%) 100%)`;
  const cardSurfaceDark = `linear-gradient(180deg, color-mix(in srgb, ${accent} 5%, var(--surface) 95%) 0%, var(--surface-3) 100%)`;
  const specPanelBg = `linear-gradient(180deg, color-mix(in srgb, ${accent} 1%, #ffffff 99%) 0%, color-mix(in srgb, ${accent} 2%, #f8fafc 98%) 100%)`;
  const specPanelBgDark = 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)';
  const specPanelBorder = `color-mix(in srgb, ${accent} 9%, #dbe4ee 91%)`;
  const specPanelBorderDark = `color-mix(in srgb, ${accent} 15%, #334155 85%)`;
  const specDivider = `color-mix(in srgb, ${accent} 8%, #d7dee8 92%)`;
  const specDividerDark = `color-mix(in srgb, ${accent} 16%, #334155 84%)`;
  const chipBg = `color-mix(in srgb, ${accent} 3%, white 97%)`;
  const chipBorder = `color-mix(in srgb, ${accent} 24%, #d8dfeb 76%)`;
  const chipText = `color-mix(in srgb, ${accent} 36%, #1f2937 64%)`;
  const chipBgDark = `color-mix(in srgb, ${accent} 8%, #0f172a 92%)`;
  const chipBorderDark = `color-mix(in srgb, ${accent} 15%, #334155 85%)`;
  const chipTextDark = `color-mix(in srgb, ${accent} 18%, #f8fafc 82%)`;
  const scoreRingBackground = scoreValue
    ? `conic-gradient(from 220deg, color-mix(in srgb, ${accent} 70%, white 30%) 0deg ${scoreSweep}, rgba(148,163,184,0.1) ${scoreSweep} 360deg)`
    : `linear-gradient(135deg, color-mix(in srgb, ${accent} 72%, white 28%), color-mix(in srgb, ${accent} 42%, white 58%))`;
  const scoreGlow = `0 0 0 8px color-mix(in srgb, ${accent} 10%, transparent), 0 18px 48px color-mix(in srgb, ${accent} 36%, transparent), 0 8px 18px rgba(15,23,42,0.06)`;
  const scoreHalo = `color-mix(in srgb, ${accent} 42%, transparent)`;
  const priceNoteBg = `color-mix(in srgb, ${accent} 8%, #f8fafc 92%)`;
  const priceNoteBorder = `color-mix(in srgb, ${accent} 14%, #d2dbe7 86%)`;
  const priceNoteBgDark = `color-mix(in srgb, ${accent} 8%, #111827 92%)`;
  const priceNoteBorderDark = `color-mix(in srgb, ${accent} 16%, #334155 84%)`;
  const compareLabelExceptions = new Set(['kling-2-5-turbo']);
  const hideCompare = card.label.length > 14 && !compareLabelExceptions.has(card.id);
  const secondarySpecValueClass =
    'mt-1 min-h-[1.65rem] tabular-nums font-semibold leading-tight tracking-normal text-text-primary dark:text-white';
  const priceValueClass =
    (card.stats?.priceFrom?.length ?? 0) > 7
      ? 'text-[11px] sm:text-[15px]'
      : (card.stats?.priceFrom?.length ?? 0) > 6
        ? 'text-[12px] sm:text-[16px]'
        : 'text-[12px] sm:text-[19px]';
  const maxResolutionValueClass =
    (card.stats?.maxResolution?.length ?? 0) >= 9
      ? 'text-[10px] sm:text-[12px]'
      : (card.stats?.maxResolution?.length ?? 0) > 7
        ? 'text-[11px] sm:text-[14px]'
        : 'text-[12px] sm:text-[18px]';
  const capabilityItems = [...(card.capabilities ?? [])];
  if (card.filterMeta?.lipSync && !capabilityItems.includes('Lip sync')) {
    capabilityItems.push('Lip sync');
  }
  if (card.audioAvailable && !capabilityItems.includes('Audio')) {
    capabilityItems.push('Audio');
  }
  const visibleCapabilities = capabilityItems.slice(0, 6);
  const handleCompareToggle = (event: React.MouseEvent | React.ChangeEvent) => {
    event.stopPropagation();
    if (card.compareDisabled) return;
    if (!compareMode) {
      onActivateCompare();
    }
    onToggle();
  };
  const handleClick = () => {
    if (compareMode) {
      onToggle();
      return;
    }
    router.push(card.href as RouterPushInput);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (compareMode) {
        onToggle();
        return;
      }
      router.push(card.href as RouterPushInput);
    }
  };
  return (
    <article
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative isolate flex min-h-[21rem] cursor-pointer flex-col overflow-hidden rounded-[8px] border border-hairline bg-surface bg-[image:var(--card-surface)] p-3.5 text-text-primary shadow-[0_18px_44px_rgba(15,23,42,0.055),0_4px_12px_rgba(15,23,42,0.025)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--card-border-hover)] hover:shadow-[0_24px_52px_rgba(15,23,42,0.085),0_8px_20px_rgba(15,23,42,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--card-focus-ring)] dark:border-white/10 dark:bg-[image:var(--card-surface-dark)] dark:text-white dark:hover:border-[color:var(--card-border-hover-dark)] dark:focus-visible:ring-[color:var(--card-focus-ring-dark)] sm:min-h-[24.5rem] sm:p-6 ${
        selected ? 'ring-2 ring-emerald-500/35 border-emerald-400/60' : ''
      }`}
      style={
        {
          '--card-surface': cardSurface,
          '--card-border-hover': providerBadgeBorder,
          '--card-focus-ring': providerBadgeBorder,
          '--card-surface-dark': cardSurfaceDark,
          '--card-border-hover-dark': providerBadgeBorderDark,
          '--card-focus-ring-dark': providerBadgeBorderDark,
          '--spec-panel-bg': specPanelBg,
          '--spec-panel-bg-dark': specPanelBgDark,
          '--spec-panel-border': specPanelBorder,
          '--spec-panel-border-dark': specPanelBorderDark,
          '--spec-divider': specDivider,
          '--spec-divider-dark': specDividerDark,
          '--provider-badge-bg': providerBadgeBg,
          '--provider-badge-bg-dark': providerBadgeBgDark,
          '--provider-badge-border': providerBadgeBorder,
          '--provider-badge-border-dark': providerBadgeBorderDark,
          '--provider-badge-text': providerBadgeText,
          '--provider-badge-text-dark': providerBadgeTextDark,
          '--chip-bg': chipBg,
          '--chip-bg-dark': chipBgDark,
          '--chip-border': chipBorder,
          '--chip-border-dark': chipBorderDark,
          '--chip-text': chipText,
          '--chip-text-dark': chipTextDark,
          '--price-note-bg': priceNoteBg,
          '--price-note-bg-dark': priceNoteBgDark,
          '--price-note-border': priceNoteBorder,
          '--price-note-border-dark': priceNoteBorderDark,
        } as React.CSSProperties
      }
      aria-label={`${normalizedCtaLabel} ${card.label}`}
    >
      <span className="pointer-events-none absolute inset-px rounded-[7px] border border-white/75 opacity-80 dark:border-white/[0.04]" aria-hidden />
      <div className="relative z-10 flex h-full flex-col">
        {scoreValue ? (
          <div className="absolute right-0 top-0">
            <div
              className="relative isolate grid h-[54px] w-[54px] place-items-center rounded-full p-[2px] sm:h-[74px] sm:w-[74px]"
              style={{ background: scoreRingBackground, boxShadow: scoreGlow }}
            >
              <span
                className="pointer-events-none absolute -inset-4 z-0 rounded-full opacity-80 blur-2xl dark:opacity-70"
                style={{ backgroundColor: scoreHalo }}
                aria-hidden
              />
              <span className="absolute inset-[2px] z-10 rounded-full border border-hairline bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-white/10 dark:bg-surface" />
              <div className="relative z-20 flex flex-col items-center justify-center leading-none">
                <div className="flex items-end gap-0.5">
                  <span className="tabular-nums text-[17px] font-semibold tracking-normal text-text-primary dark:text-white sm:text-[24px]">
                    {scoreValue}
                  </span>
                  <span className="mb-[2px] text-[6px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/58 sm:mb-[3px] sm:text-[8px] sm:tracking-[0.18em]">
                    /10
                  </span>
                </div>
                <span className="mt-0.5 text-[5px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-white/56 sm:mt-1 sm:text-[7px] sm:tracking-[0.26em]">
                  Score
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <div className="min-h-7 min-w-0 pr-14 sm:min-h-8 sm:pr-24">
          {card.provider ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[color:var(--provider-badge-border)] bg-[color:var(--provider-badge-bg)] px-2 py-1 text-[10px] font-semibold tracking-normal text-[color:var(--provider-badge-text)] shadow-[0_7px_18px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-sm dark:border-[color:var(--provider-badge-border-dark)] dark:bg-[color:var(--provider-badge-bg-dark)] dark:text-[color:var(--provider-badge-text-dark)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[11px]">
                <EngineIcon
                  engine={{ id: card.engineId ?? card.id, label: card.label, brandId: card.brandId ?? undefined }}
                  size={14}
                  framed={false}
                  rounded="full"
                  className="shrink-0"
                />
                <span className="truncate">{card.provider}</span>
              </span>
            </div>
          ) : null}
        </div>
        <h3 className="mt-3 line-clamp-2 pr-10 text-balance text-[18px] font-semibold leading-[1.08] tracking-normal text-text-primary dark:text-white sm:mt-4 sm:pr-20 sm:text-[24px]">
          {card.label}
        </h3>

        {card.strengths?.length ? (
          <p className="mt-4 flex items-center gap-1.5 text-[10px] leading-4 text-text-secondary dark:text-white/90 sm:mt-7 sm:gap-2 sm:text-[12px] sm:leading-5">
            <span
              className="h-2 w-2 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_18%,transparent),0_0_14px_currentColor] dark:border-slate-950 sm:h-2.5 sm:w-2.5"
              style={{ backgroundColor: accent, color: accent }}
              aria-hidden
            />
            <span className="min-w-0 truncate">
              <span className="font-semibold text-text-primary dark:text-white">{strengthsLabel}:</span>{' '}
              {card.strengths.join(' · ')}
            </span>
          </p>
        ) : null}

        {card.stats ? (
          <dl
            className="mt-4 grid grid-cols-3 overflow-hidden rounded-[8px] border border-[color:var(--spec-panel-border)] bg-[image:var(--spec-panel-bg)] text-text-secondary shadow-[0_8px_22px_rgba(15,23,42,0.035),inset_0_1px_0_rgba(255,255,255,0.94)] dark:border-[color:var(--spec-panel-border-dark)] dark:bg-[image:var(--spec-panel-bg-dark)] dark:text-white/84 dark:shadow-none sm:mt-5 sm:rounded-[12px]"
          >
            <div className="min-w-0 border-r border-r-[color:var(--spec-divider)] px-2 py-2.5 dark:border-r-[color:var(--spec-divider-dark)] sm:px-4 sm:py-3.5">
              <dt className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-white/60">
                {statsLabels.from}
              </dt>
              <dd className={`${secondarySpecValueClass} ${priceValueClass} whitespace-nowrap`}>
                {card.stats.priceFrom ?? '—'}
              </dd>
            </div>
            <div className="min-w-0 border-r border-r-[color:var(--spec-divider)] px-2 py-2.5 dark:border-r-[color:var(--spec-divider-dark)] sm:px-4 sm:py-3.5">
              <dt
                className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-white/60"
                aria-label={card.statsLabels?.duration ? statsLabels.typeLong : statsLabels.maxDurLong}
              >
                {card.statsLabels?.duration ? statsLabels.typeShort : statsLabels.maxDurShort}
              </dt>
              <dd className={`${secondarySpecValueClass} text-[12px] sm:text-[19px]`}>
                {card.stats.maxDuration ?? '—'}
              </dd>
            </div>
            <div className="min-w-0 px-2 py-2.5 sm:px-4 sm:py-3.5">
              <dt
                className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-white/60"
                aria-label={statsLabels.maxResLong}
              >
                {statsLabels.maxResShort}
              </dt>
              <dd className={`${secondarySpecValueClass} ${maxResolutionValueClass} whitespace-nowrap`}>
                {card.stats.maxResolution ?? '—'}
              </dd>
            </div>
          </dl>
        ) : null}

        {visibleCapabilities.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:mt-4 sm:gap-2.5">
            {visibleCapabilities.map((cap) => {
              const tooltip = cap === 'Audio' ? audioAvailableLabel : capabilityTooltips[cap] ?? cap;
              const CapabilityIcon = getCapabilityIcon(cap);
              return (
                <span
                  key={cap}
                  title={tooltip}
                  aria-label={tooltip}
                  className="inline-flex min-h-6 items-center gap-1 rounded-[7px] border border-[color:var(--chip-border)] bg-[color:var(--chip-bg)] px-1.5 py-[0.24rem] text-[9px] font-semibold tracking-normal text-[color:var(--chip-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_2px_rgba(15,23,42,0.025)] transition group-hover:border-[color:var(--card-border-hover)] dark:border-[color:var(--chip-border-dark)] dark:bg-[color:var(--chip-bg-dark)] dark:text-[color:var(--chip-text-dark)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:group-hover:border-[color:var(--card-border-hover-dark)] sm:min-h-7 sm:gap-1.5 sm:rounded-[8px] sm:px-2.5 sm:py-[0.34rem] sm:text-[10px]"
                >
                  <CapabilityIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2.2} aria-hidden />
                  {cap}
                </span>
              );
            })}
          </div>
        ) : null}

        <div className="mt-4 min-h-[4.3rem] sm:mt-6 sm:min-h-[5.35rem]">
          <p className="line-clamp-4 text-[11px] font-semibold leading-[1.45] text-text-secondary dark:text-white/[0.9] sm:text-[13px] sm:leading-[1.55]">
            {card.description}
          </p>
        </div>
        {card.priceNote ? (
          card.priceNoteHref ? (
            <Link
              href={card.priceNoteHref}
              prefetch={false}
              className="mt-3 inline-flex items-center rounded-full border border-[color:var(--price-note-border)] bg-[color:var(--price-note-bg)] px-3 py-1.5 text-[11px] font-medium tracking-[0.02em] text-slate-600 transition hover:text-slate-950 dark:border-[color:var(--price-note-border-dark)] dark:bg-[color:var(--price-note-bg-dark)] dark:text-white/82 dark:hover:text-white"
              onClick={(event) => event.stopPropagation()}
            >
              {card.priceNote}
            </Link>
          ) : (
            <span
              className="mt-3 inline-flex items-center rounded-full border border-[color:var(--price-note-border)] bg-[color:var(--price-note-bg)] px-3 py-1.5 text-[11px] font-medium tracking-[0.02em] text-slate-600 dark:border-[color:var(--price-note-border-dark)] dark:bg-[color:var(--price-note-bg-dark)] dark:text-white/82"
            >
              {card.priceNote}
            </span>
          )
        ) : null}
        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center gap-3">
            {compareEnabled && !card.compareDisabled ? (
              <label
                className={`inline-flex items-center gap-3 text-sm font-medium transition ${
                  selected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-white/84'
                }`}
                title={compareTooltip}
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={handleCompareToggle}
                  onClick={(event) => event.stopPropagation()}
                  className="peer sr-only"
                  aria-label={formatTemplate(compareAria, { engine: card.label })}
                />
                <span className="grid h-5 w-5 place-items-center rounded-[6px] border border-slate-300/90 bg-white text-[12px] text-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white dark:border-white/18 dark:bg-white/[0.02] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  ✓
                </span>
                {!hideCompare ? <span>{compareLabel}</span> : null}
              </label>
            ) : (
              <span className="text-sm text-slate-400 dark:text-white/35" />
            )}
            <Link
              href={card.href}
              prefetch={false}
              className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-full bg-text-primary px-4 py-2 text-[13px] font-semibold tracking-normal text-bg shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-text-secondary dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
              aria-label={`${ctaText} — ${card.label}`}
              onClick={(event) => event.stopPropagation()}
            >
              {ctaText}
              <span className="sr-only"> — {card.label}</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
