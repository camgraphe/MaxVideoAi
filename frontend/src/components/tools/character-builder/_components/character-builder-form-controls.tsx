'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { SelectMenu } from '@/components/ui/SelectMenu';
import type { CharacterBuilderState, CharacterBuilderTraits } from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { ChoiceOption, ToggleItem } from '../_lib/character-builder-types';

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
