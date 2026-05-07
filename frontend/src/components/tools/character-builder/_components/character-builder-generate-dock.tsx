'use client';

import clsx from 'clsx';
import { Loader2, Sparkles, WandSparkles } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { HAIR_COLOR_OPTIONS } from '@/lib/character-builder';
import type {
  CharacterBuilderReferenceImage,
  CharacterBuilderState,
  CharacterBuilderTraits,
} from '@/types/character-builder';
import {
  findChoiceLabel,
  findChoiceSwatch,
  formatUsd,
  hasCustomHairSettings,
} from '../_lib/character-builder-helpers';
import type { CharacterCopy } from '../_lib/character-builder-copy';

export function CharacterBuilderStickyDock({
  hairSummary,
  outfitSummary,
  traits,
  qualityMode,
  formatMode,
  genderOptions,
  ageOptions,
  realismOptions,
  qualityOptions,
  formatOptions,
  estimatedImageCostUsd,
  onQualityChange,
  onFormatChange,
  onGenerateOne,
  onGenerateFour,
  loadingGenerateOne,
  loadingGenerateFour,
  copy,
  compact = false,
}: {
  identityReference: CharacterBuilderReferenceImage | null;
  hairSummary: string;
  outfitSummary: string;
  traits: CharacterBuilderTraits;
  outputMode: CharacterBuilderState['outputMode'];
  qualityMode: CharacterBuilderState['qualityMode'];
  formatMode: CharacterBuilderState['formatMode'];
  genderOptions: Array<{ id: string; label: string }>;
  ageOptions: Array<{ id: string; label: string }>;
  realismOptions: Array<{ id: string; label: string }>;
  outputOptions: Array<{ id: string; label: string }>;
  qualityOptions: Array<{ id: string; label: string }>;
  formatOptions: Array<{ id: string; label: string }>;
  estimatedImageCostUsd: number | null;
  onQualityChange: (value: CharacterBuilderState['qualityMode']) => void;
  onFormatChange: (value: CharacterBuilderState['formatMode']) => void;
  onGenerateOne: () => void;
  onGenerateFour: () => void;
  loadingGenerateOne: boolean;
  loadingGenerateFour: boolean;
  copy: CharacterCopy;
  compact?: boolean;
}) {
  const hairSwatch =
    !hasCustomHairSettings(traits) || Boolean(traits.customHairDescription?.trim())
      ? null
      : findChoiceSwatch(HAIR_COLOR_OPTIONS, traits.hairColor.value);
  const genderLabel = findChoiceLabel(genderOptions, traits.genderPresentation.value) ?? copy.open;
  const ageLabel = findChoiceLabel(ageOptions, traits.ageRange.value) ?? copy.open;
  const realismLabel = findChoiceLabel(realismOptions, traits.realismStyle) ?? copy.summary.photoreal;
  const chips = [
    { label: copy.summary.identity, value: `${genderLabel} · ${ageLabel}` },
    { label: copy.summary.hair, value: hairSummary === copy.notSet ? copy.open : hairSummary, swatch: hairSwatch },
    { label: copy.summary.outfit, value: outfitSummary === copy.notSet ? copy.open : outfitSummary },
    { label: copy.summary.style, value: realismLabel },
  ];

  const renderInlineSegment = (
    label: string,
    options: Array<{ id: string; label: string }>,
    value: string,
    onChange: (value: string) => void
  ) => (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <div className="inline-flex flex-wrap rounded-full border border-border/80 bg-bg/55 p-1">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={clsx(
                'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-micro transition',
                active
                  ? 'bg-brand text-on-brand shadow-[0_10px_24px_rgba(58,123,213,0.18)]'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={clsx(compact ? 'space-y-3' : 'space-y-4')}>
      <div className="rounded-[22px] border border-border/80 bg-bg/45 p-2.5 sm:p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {chips.map((chip, index) => (
            <div
              key={chip.label}
              className={clsx(
                'min-w-0 rounded-[18px] px-3 py-2',
                index > 0 && 'xl:border-l xl:border-border/70'
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{chip.label}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-text-primary">
                {'swatch' in chip && chip.swatch ? (
                  <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: chip.swatch }} />
                ) : null}
                <span className="truncate">{chip.value}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        className={clsx(
          compact
            ? 'space-y-3'
            : 'flex items-end justify-between gap-6'
        )}
      >
        <div className={clsx(compact ? 'space-y-3' : 'flex flex-wrap items-end gap-6')}>
          {renderInlineSegment(
            copy.generatePanel.quality,
            qualityOptions,
            qualityMode,
            (value) => onQualityChange(value as CharacterBuilderState['qualityMode'])
          )}
          {renderInlineSegment(
            copy.generatePanel.format,
            formatOptions,
            formatMode,
            (value) => onFormatChange(value as CharacterBuilderState['formatMode'])
          )}
        </div>

        <div
          className={clsx(
            compact
              ? 'space-y-3'
              : 'ml-auto flex shrink-0 items-center gap-4'
          )}
        >
          <div className={clsx(compact ? 'flex items-baseline justify-between' : 'text-right')}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              {copy.generatePanel.pricePerImage.replace('{price}', '').trim()}
            </p>
            <p className={clsx('font-semibold text-text-primary', compact ? 'text-lg' : 'mt-1 text-xl')}>
              {formatUsd(estimatedImageCostUsd)}
            </p>
          </div>
          <div className={clsx('flex items-center gap-2', compact ? 'justify-stretch' : '')}>
            <Button onClick={onGenerateOne} className={clsx('gap-2', compact ? 'flex-1' : 'min-w-[220px] px-5')}>
              {loadingGenerateOne ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {copy.generatePanel.generateReference}
            </Button>
            <Button
              variant="outline"
              onClick={onGenerateFour}
              className={clsx('gap-2', compact ? 'px-3' : 'min-w-[76px] px-4')}
            >
              {loadingGenerateFour ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              4x
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
