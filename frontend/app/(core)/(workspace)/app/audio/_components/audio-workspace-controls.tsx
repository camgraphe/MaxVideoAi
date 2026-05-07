'use client';

import { Check, type LucideIcon } from 'lucide-react';

import { SelectMenu } from '@/components/ui/SelectMenu';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AudioPackId } from '@/lib/audio-generation';
import { AUDIO_MODE_META } from '../_lib/audio-workspace-helpers';

export function AudioModePicker({
  value,
  options,
  onChange,
}: {
  value: AudioPackId;
  options: Array<{ id: AudioPackId; label: string; description: string }>;
  onChange: (pack: AudioPackId) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
      {options.map((mode) => (
        <AudioModeCard
          key={mode.id}
          mode={mode}
          active={value === mode.id}
          onClick={() => onChange(mode.id)}
        />
      ))}
    </div>
  );
}

function AudioModeCard({
  mode,
  active,
  onClick,
}: {
  mode: { id: AudioPackId; label: string; description: string };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = AUDIO_MODE_META[mode.id].icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'group relative min-h-[86px] overflow-hidden rounded-[10px] border px-3.5 py-3 text-left transition duration-200',
        active
          ? 'border-brand bg-brand-soft shadow-[0_14px_34px_rgba(46,99,216,0.12)] ring-1 ring-brand/25'
          : 'border-hairline bg-surface hover:border-brand/45 hover:bg-surface-hover hover:shadow-card',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] transition',
            active
              ? 'bg-brand text-on-brand shadow-[0_10px_28px_rgba(46,99,216,0.22)]'
              : 'bg-brand-soft text-brand group-hover:bg-brand-soft-hover',
          ].join(' ')}
        >
          <UIIcon icon={Icon} size={21} strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">{mode.label}</span>
          <span className="mt-1 block text-xs leading-5 text-text-secondary">{mode.description}</span>
        </span>
        <span
          className={[
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition',
            active
              ? 'border-brand bg-brand text-on-brand'
              : 'border-hairline bg-surface text-transparent group-hover:border-brand/45',
          ].join(' ')}
          aria-hidden
        >
          {active ? <Check className="h-3.5 w-3.5" /> : null}
        </span>
      </div>
    </button>
  );
}

function AudioInlineSelectLabel({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <UIIcon icon={icon} size={15} strokeWidth={1.8} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function AudioSelectControl({
  label,
  value,
  options,
  icon,
  onChange,
}: {
  label: string;
  value: string | number | boolean;
  options: Array<{ value: string | number | boolean; label: string; disabled?: boolean }>;
  icon: LucideIcon;
  onChange: (next: string | number | boolean) => void;
}) {
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-sm font-semibold text-text-primary">{label}</span>
      <SelectMenu
        options={options.map((option) => ({
          ...option,
          label: <AudioInlineSelectLabel icon={icon} label={option.label} />,
        }))}
        value={value}
        onChange={(next) => onChange(String(next))}
        className="min-w-0"
        buttonClassName="min-h-0 h-10 rounded-full border-border bg-surface px-3 py-0 text-[12px] font-medium shadow-none dark:border-white/10 dark:bg-surface dark:text-white/92 dark:hover:border-white/16 dark:hover:bg-surface-hover"
        menuClassName="min-w-[180px]"
        menuPlacement="top"
      />
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[10px] border border-hairline bg-surface px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      <span className="relative mt-1 inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-border transition peer-checked:bg-brand" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
