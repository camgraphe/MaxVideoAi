'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import useSWR from 'swr';
import {
  Check,
  Download,
  Images,
  Loader2,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { authFetch } from '@/lib/authFetch';
import { HAIR_COLOR_OPTIONS } from '@/lib/character-builder';
import type {
  CharacterBuilderResult,
  CharacterBuilderState,
  CharacterBuilderTraits,
  CharacterBuilderReferenceImage,
} from '@/types/character-builder';
import {
  findChoiceLabel,
  findChoiceSwatch,
  formatUsd,
  hasCustomHairSettings,
} from '../_lib/character-builder-helpers';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type {
  CharacterLibraryAsset,
  CharacterLibraryAssetsResponse,
  ChoiceOption,
  ToggleItem,
} from '../_lib/character-builder-types';

export const GENDER_CARD_META: Record<string, { glyph: string; background: string; accent: string }> = {
  woman: {
    glyph: 'W',
    background: 'linear-gradient(135deg, rgba(255,233,241,1), rgba(255,255,255,0.94))',
    accent: '#f472b6',
  },
  man: {
    glyph: 'M',
    background: 'linear-gradient(135deg, rgba(224,242,254,1), rgba(255,255,255,0.94))',
    accent: '#38bdf8',
  },
  androgynous: {
    glyph: 'A',
    background: 'linear-gradient(135deg, rgba(233,244,255,1), rgba(255,255,255,0.94))',
    accent: '#6366f1',
  },
  custom: {
    glyph: '+',
    background: 'linear-gradient(135deg, rgba(241,245,249,1), rgba(255,255,255,0.94))',
    accent: '#64748b',
  },
};

export const REALISM_CARD_META: Record<string, { background: string; accent: string }> = {
  photoreal: {
    background: 'linear-gradient(135deg, rgba(226,232,240,1), rgba(255,255,255,0.96))',
    accent: '#0f172a',
  },
  cinematic: {
    background: 'linear-gradient(135deg, rgba(254,242,242,1), rgba(255,255,255,0.96))',
    accent: '#b91c1c',
  },
  stylized: {
    background: 'linear-gradient(135deg, rgba(243,232,255,1), rgba(255,255,255,0.96))',
    accent: '#7c3aed',
  },
  animated: {
    background: 'linear-gradient(135deg, rgba(224,242,254,1), rgba(255,255,255,0.96))',
    accent: '#0284c7',
  },
};

const CHARACTER_SHEET_PREVIEW_URL =
  'https://media.maxvideoai.com/marketing/marketing/effc3c18-125d-4460-9adc-75216ac599cb.png';
const PORTRAIT_REFERENCE_PREVIEW_URL =
  'https://media.maxvideoai.com/marketing/marketing/cf56ca3b-ee2f-4daa-b328-e88b43efc390.png';

export function VisualChoiceCard({
  selected,
  onClick,
  title,
  subtitle,
  media,
  backgroundMedia,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  media?: ReactNode;
  backgroundMedia?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group isolate relative overflow-hidden rounded-[24px] border p-4 text-left transition',
        selected
          ? 'z-10 border-brand bg-brand/5 shadow-card'
          : 'border-border bg-surface hover:border-border-hover hover:bg-surface-hover hover:shadow-card',
        className
      )}
    >
      {backgroundMedia ? <div className="absolute inset-0">{backgroundMedia}</div> : null}
      {backgroundMedia ? (
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[rgba(0,0,0,0.82)] via-[rgba(0,0,0,0.42)] to-transparent" />
      ) : null}
      {selected ? (
        <span className="absolute right-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-on-brand shadow-[0_8px_18px_rgba(58,123,213,0.28)]">
          <Check className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {media ? <div className="relative z-10 mb-4">{media}</div> : null}
      <div
        className={clsx(
          backgroundMedia
            ? 'absolute inset-x-0 bottom-0 z-10 space-y-1 px-6 py-4'
            : 'relative z-10 space-y-1'
        )}
      >
        <p className={clsx('text-sm font-semibold', backgroundMedia ? 'text-white' : 'text-text-primary')}>
          {title}
        </p>
        {subtitle ? (
          <p className={clsx('text-xs', backgroundMedia ? 'text-white' : 'text-text-secondary')}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </button>
  );
}

export function IconChoiceCard({
  selected,
  title,
  glyph,
  background,
  accent,
  onClick,
}: {
  selected: boolean;
  title: string;
  glyph: string;
  background: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <VisualChoiceCard
      selected={selected}
      onClick={onClick}
      title={title}
      media={
        <div
          className="flex h-14 items-center justify-between rounded-[18px] border border-border/80 bg-surface-2/80 px-3.5"
          style={{ background }}
        >
          <div
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
          >
            {glyph}
          </div>
          <div className="flex items-end gap-1">
            <span className="h-5 w-5 rounded-full bg-surface shadow-sm" />
            <span className="h-7 w-7 rounded-[14px] bg-surface/80 shadow-sm" />
          </div>
        </div>
      }
      className="min-h-[120px] w-full max-w-[172px]"
    />
  );
}

export function StyleChoiceCard({
  selected,
  title,
  background,
  accent,
  onClick,
}: {
  selected: boolean;
  title: string;
  background: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <VisualChoiceCard
      selected={selected}
      onClick={onClick}
      title={title}
      media={
        <div
          className="relative h-[72px] overflow-hidden rounded-[18px] border border-border/80 bg-surface-2/80"
          style={{ background }}
        >
          <div
            className="absolute left-3 top-3 h-8 w-8 rounded-full"
            style={{ backgroundColor: `${accent}22` }}
          />
          <div
            className="absolute bottom-3 left-4 h-8 w-10 rounded-[16px]"
            style={{ backgroundColor: `${accent}cc` }}
          />
          <div className="absolute right-3 top-3 space-y-1">
            <div className="h-2 w-9 rounded-full bg-surface/85" />
            <div className="h-2 w-7 rounded-full bg-surface/65" />
          </div>
        </div>
      }
      className="min-h-[120px] w-full max-w-[172px]"
    />
  );
}

export function OutputPreviewCard({
  selected,
  title,
  subtitle,
  mode,
  onClick,
  compact = false,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  mode: CharacterBuilderState['outputMode'];
  onClick: () => void;
  compact?: boolean;
}) {
  return (
      <VisualChoiceCard
        selected={selected}
        onClick={onClick}
        title={title}
        subtitle={subtitle}
        backgroundMedia={
          mode === 'character-sheet' ? (
            <img
              src={CHARACTER_SHEET_PREVIEW_URL}
              alt={title}
              className="h-full w-full object-cover object-top"
              loading="lazy"
            />
          ) : mode === 'portrait-reference' ? (
            <img
              src={PORTRAIT_REFERENCE_PREVIEW_URL}
              alt={title}
              className="h-full w-full object-cover object-center"
              loading="lazy"
            />
          ) : undefined
        }
        className={clsx(
          compact ? 'min-w-0' : undefined,
          mode === 'character-sheet' || mode === 'portrait-reference'
            ? compact
              ? 'flex h-[150px] flex-col justify-end bg-black/5'
              : 'flex h-[260px] flex-col justify-end bg-black/5 md:h-[320px]'
            : undefined
        )}
      />
    );
}

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

export function HairEditorPanel({
  open,
  onClose,
  sourceMode,
  traits,
  onChange,
  hairColorOptions,
  hairLengthOptions,
  hairstyleOptions,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  sourceMode: CharacterBuilderState['sourceMode'];
  traits: CharacterBuilderTraits;
  onChange: (key: 'hairColor' | 'hairLength' | 'hairstyle', value: string | 'auto') => void;
  hairColorOptions: ChoiceOption[];
  hairLengthOptions: ChoiceOption[];
  hairstyleOptions: ChoiceOption[];
  copy: CharacterCopy;
}) {
  if (!open) return null;

  const autoEnabled = sourceMode === 'reference-image';
  const autoButton = (key: 'hairColor' | 'hairLength' | 'hairstyle') =>
    autoEnabled ? (
      <button
        type="button"
        onClick={() => onChange(key, 'auto')}
        className={clsx(
          'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
          traits[key].value === 'auto'
            ? 'border-brand bg-brand text-on-brand'
            : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
        )}
      >
        {copy.auto}
      </button>
    ) : null;

  const panel = (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{copy.hairEditor.title}</p>
          <p className="text-[11px] text-text-secondary">{copy.hairEditor.body}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {copy.done}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.hairEditor.color}</p>
        <div className="flex flex-wrap gap-2">
          {autoButton('hairColor')}
          {hairColorOptions.map((option) => {
            const selected = traits.hairColor.value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange('hairColor', selected ? '' : option.id)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  selected
                    ? 'border-brand bg-brand/10 text-text-primary'
                    : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                )}
              >
                {option.swatch ? (
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/10"
                    style={{ backgroundColor: option.swatch }}
                  />
                ) : null}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.hairEditor.length}</p>
        <div className="flex flex-wrap gap-2">
          {autoButton('hairLength')}
          {hairLengthOptions.map((option) => {
            const selected = traits.hairLength.value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange('hairLength', selected ? '' : option.id)}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
                  selected
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.hairEditor.style}</p>
        <div className="flex flex-wrap gap-2">
          {autoButton('hairstyle')}
          {hairstyleOptions.map((option) => {
            const selected = traits.hairstyle.value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange('hairstyle', selected ? '' : option.id)}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
                  selected
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onClose} aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border border-border bg-surface-glass-95 p-5 shadow-[0_-24px_48px_rgba(15,23,42,0.18)] lg:absolute lg:inset-x-0 lg:bottom-auto lg:top-[calc(100%+12px)] lg:z-30 lg:rounded-[24px] lg:border lg:p-5 lg:shadow-[0_24px_48px_rgba(15,23,42,0.12)]">
        {panel}
      </div>
    </>
  );
}

export function SegmentedControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string; description?: string }>;
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-text-primary">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={clsx(
                'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
                active
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
              )}
              title={option.description}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CompactSelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  autoEnabled = false,
  autoLabel,
}: {
  label: string;
  value: string | null;
  options: ChoiceOption[];
  onChange: (value: string | 'auto') => void;
  placeholder: string;
  autoEnabled?: boolean;
  autoLabel: string;
}) {
  const selectOptions = [
    { value: '', label: placeholder },
    ...(autoEnabled ? [{ value: 'auto', label: autoLabel }] : []),
    ...options.map((option) => ({ value: option.id, label: option.label })),
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-text-primary">{label}</label>
      <SelectMenu
        options={selectOptions}
        value={value ?? ''}
        onChange={(next) => onChange(String(next) as string | 'auto')}
        buttonClassName="min-h-[40px]"
      />
    </div>
  );
}

export function MultiToggleGroup({
  label,
  description,
  items,
  values,
  onToggle,
}: {
  label: string;
  description?: string;
  items: ToggleItem[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {description ? <p className="mt-1 text-xs text-text-secondary">{description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const selected = values.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={clsx(
                'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
                selected
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SectionTitle({ eyebrow, title, body, children }: { eyebrow?: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{eyebrow}</p> : null}
        <h2 className={clsx('text-xl font-semibold text-text-primary', eyebrow ? 'mt-2' : '')}>{title}</h2>
        {body ? <p className="mt-2 max-w-2xl text-sm text-text-secondary">{body}</p> : null}
      </div>
      {children}
    </div>
  );
}

export type BuildLookSectionKey = 'identity' | 'hair' | 'outfit' | 'details' | 'style';

export function BuildLookCarouselCard({
  title,
  summary,
  active,
  accessory,
  onClick,
}: {
  title: string;
  summary: string;
  active: boolean;
  accessory?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'relative flex min-h-[82px] w-[220px] flex-col justify-between border-r border-border px-4 py-3 text-left transition-colors last:border-r-0 md:min-w-0 md:flex-1',
        active
          ? 'bg-[#e8f1ff] shadow-[inset_0_0_0_1px_rgba(58,123,213,0.24)]'
          : 'bg-surface hover:bg-surface-hover'
      )}
    >
      {active ? <span className="absolute inset-x-0 top-0 h-[3px] bg-brand" aria-hidden /> : null}
      <div className="flex items-start justify-between gap-3">
        <p className={clsx('text-sm font-semibold', active ? 'text-brand' : 'text-text-primary')}>{title}</p>
        {accessory ? <div className="shrink-0" onClick={(event) => event.stopPropagation()}>{accessory}</div> : null}
      </div>
      <p className={clsx('mt-2 line-clamp-2 text-xs', active ? 'text-brand/80' : 'text-text-secondary')}>
        {summary}
      </p>
    </button>
  );
}

export function ReferenceSlot({
  title,
  subtitle,
  image,
  onUpload,
  onOpenLibrary,
  onRemove,
  disabled = false,
  removeLabel,
  libraryLabel,
  optionalLabel,
}: {
  title: string;
  subtitle: string;
  image: CharacterBuilderReferenceImage | null;
  onUpload: () => void;
  onOpenLibrary: () => void;
  onRemove: () => void;
  disabled?: boolean;
  removeLabel: string;
  libraryLabel: string;
  optionalLabel?: string;
}) {
  return (
    <div
      className={clsx(
        'w-full rounded-card border border-dashed p-4 text-left transition',
        image
          ? 'border-border bg-surface'
          : 'border-border bg-bg/50 hover:border-border-hover hover:bg-surface-hover',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      {image ? (
        <div className="space-y-3">
          <button type="button" onClick={onUpload} disabled={disabled} className="block w-full text-left">
            <img src={image.url} alt={title} className="h-40 w-full rounded-input object-cover" />
            <div className="mt-3">
              <p className="text-sm font-semibold text-text-primary">{title}</p>
              <p className="mt-1 text-xs text-text-secondary">{image.name ?? subtitle}</p>
            </div>
          </button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onUpload}>
              <Upload className="h-4 w-4" />
              {title}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenLibrary}>
              <Images className="h-4 w-4" />
              {libraryLabel}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              {removeLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Upload className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-semibold text-text-primary">{title}</p>
              {optionalLabel ? (
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary">
                  {optionalLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={onUpload} disabled={disabled}>
              <Upload className="h-4 w-4" />
              {title}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenLibrary} disabled={disabled}>
              <Images className="h-4 w-4" />
              {libraryLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function isImageLibraryAsset(asset: CharacterLibraryAsset): boolean {
  if (typeof asset.mime === 'string' && asset.mime.toLowerCase().startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(asset.url);
}

export function CharacterReferenceLibraryModal({
  open,
  onClose,
  onSelect,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: CharacterLibraryAsset) => void;
  copy: CharacterCopy;
}) {
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated' | 'character' | 'angle'>('all');
  const swrKey = open
    ? activeSource === 'all'
      ? '/api/user-assets?limit=60'
      : `/api/user-assets?limit=60&source=${encodeURIComponent(activeSource)}`
    : null;
  const { data, error, isLoading } = useSWR<CharacterLibraryAssetsResponse>(swrKey, async (url: string) => {
    const response = await authFetch(url);
    const payload = (await response.json().catch(() => null)) as CharacterLibraryAssetsResponse | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(copy.library.error);
    }
    return payload ?? { ok: true, assets: [] };
  });

  const assets = (data?.assets ?? []).filter(isImageLibraryAsset);

  if (!open) return null;

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-modal border border-border bg-surface shadow-float">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{copy.library.choose}</h2>
            <p className="text-xs text-text-secondary">{copy.library.body}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="self-start rounded-full border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg sm:self-auto"
          >
            {copy.close}
          </Button>
        </div>
        <div className="border-b border-border px-4 py-3 sm:px-6">
          <div
            role="tablist"
            aria-label={copy.library.open}
            className="flex w-full overflow-hidden rounded-full border border-border bg-surface-glass-70 text-xs font-semibold text-text-secondary"
          >
            {([
              ['all', copy.library.tabs.all],
              ['upload', copy.library.tabs.upload],
              ['generated', copy.library.tabs.generated],
              ['character', copy.library.tabs.character],
              ['angle', copy.library.tabs.angle],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                role="tab"
                variant="ghost"
                size="sm"
                aria-selected={activeSource === value}
                onClick={() => setActiveSource(value)}
                className={clsx(
                  'flex-1 rounded-none px-4 py-2',
                  activeSource === value ? 'bg-brand text-on-brand hover:bg-brand' : 'text-text-secondary hover:bg-surface'
                )}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <div className="rounded-card border border-state-warning/40 bg-state-warning/10 px-4 py-6 text-sm text-state-warning">
              {error instanceof Error ? error.message : copy.library.error}
            </div>
          ) : isLoading && !assets.length ? (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`character-library-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
                  <div className="relative aspect-square overflow-hidden rounded-t-card bg-placeholder">
                    <div className="skeleton absolute inset-0" />
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <div className="h-3 w-24 rounded-full bg-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
              {copy.library.empty}
            </div>
          ) : (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelect(asset)}
                  className="overflow-hidden rounded-card border border-border bg-surface text-left transition hover:border-border-hover hover:shadow-card"
                >
                  <div className="relative aspect-square overflow-hidden bg-bg/50">
                    <img src={asset.url} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {asset.source ?? copy.library.tabs.all}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ResultCard({
  result,
  selected,
  title,
  subtitle,
  badge,
  onOpen,
  onSelect,
  onDownload,
  onSave,
  onDuplicateSettings,
  saving,
  copy,
}: {
  result: CharacterBuilderResult;
  selected: boolean;
  title: string;
  subtitle: string;
  badge?: string | null;
  onOpen: () => void;
  onSelect: () => void;
  onDownload: () => void;
  onSave: () => void;
  onDuplicateSettings: () => void;
  saving: boolean;
  copy: CharacterCopy;
}) {
  return (
    <Card
      className={clsx(
        'overflow-hidden border bg-surface p-0 transition',
        selected ? 'border-brand shadow-[0_0_0_1px_rgba(11,107,255,0.2)]' : 'border-border'
      )}
    >
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <img src={result.thumbUrl ?? result.url} alt={copy.resultCard.generatedAlt} className="h-44 w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-micro text-white/70">{subtitle}</p>
            <p className="mt-1 text-sm font-semibold text-white">{title}</p>
          </div>
        </button>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {selected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-900 shadow-sm">
              <Check className="h-3.5 w-3.5" />
              {copy.resultCard.selected}
            </span>
          ) : <span />}
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-brand/90 px-2 py-1 text-[11px] font-semibold text-on-brand shadow-sm">
              {badge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <Button variant={selected ? 'primary' : 'outline'} size="sm" onClick={onSelect} className="min-w-[92px]">
          {selected ? copy.resultCard.selected : copy.resultCard.select}
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDuplicateSettings}
            className="h-9 w-9 px-0"
            aria-label={copy.resultCard.duplicate}
            title={copy.resultCard.duplicate}
          >
            <WandSparkles className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="h-9 w-9 px-0"
            aria-label={copy.resultCard.save}
            title={copy.resultCard.save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            className="h-9 w-9 px-0"
            aria-label={copy.resultCard.download}
            title={copy.resultCard.download}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function PendingResultCard({
  title,
  subtitle,
  badge,
  copy,
}: {
  title: string;
  subtitle: string;
  badge?: string | null;
  copy: CharacterCopy;
}) {
  return (
    <Card className="overflow-hidden border border-border bg-surface/90 p-0">
      <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(11,107,255,0.14),_transparent_60%),linear-gradient(180deg,rgba(148,163,184,0.08),transparent)]">
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_40%,rgba(11,107,255,0.08)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-micro text-white/70">{subtitle}</p>
          <p className="mt-1 text-sm font-semibold text-white">{title}</p>
        </div>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-900 shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {copy.resultCard.pending}
          </span>
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-brand/90 px-2 py-1 text-[11px] font-semibold text-on-brand shadow-sm">
              {badge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="p-3">
        <p className="text-xs text-text-secondary">{copy.resultCard.pendingBody}</p>
      </div>
    </Card>
  );
}

export function EmptyResultsRail({ copy }: { copy: CharacterCopy }) {
  return (
    <Card className="border border-dashed border-border bg-bg/40 p-5">
      <p className="text-sm font-semibold text-text-primary">{copy.top.resultsTitle}</p>
      <p className="mt-2 text-sm text-text-secondary">{copy.resultCard.pendingBody}</p>
    </Card>
  );
}
