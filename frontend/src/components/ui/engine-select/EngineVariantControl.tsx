'use client';

import clsx from 'clsx';
import type { EngineCaps } from '@/types/engines';
import { SelectMenu } from '@/components/ui/SelectMenu';
import type { EngineSelectControlPresentation } from './engine-select-types';

type Props = {
  bar: boolean;
  compact: boolean;
  disabledEngineReasons?: Record<string, string>;
  getLabel: (engine: EngineCaps) => string;
  label: string;
  onChange: (engineId: string) => void;
  presentation: EngineSelectControlPresentation;
  selectedEngineId: string;
  variants: EngineCaps[];
};

export function EngineVariantControl(props: Props) {
  const { bar, compact, disabledEngineReasons, getLabel, label, onChange, presentation, selectedEngineId, variants } = props;
  if (variants.length <= 1) return null;

  if (presentation === 'workspace') {
    return (
      <div className="w-[112px] shrink-0 space-y-1 sm:w-[136px]">
        <span className="text-[10px] uppercase tracking-micro text-text-muted">{label}</span>
        <SelectMenu
          options={variants.map((entry) => ({
            value: entry.id,
            label: getLabel(entry),
            disabled: Boolean(disabledEngineReasons?.[entry.id]),
          }))}
          value={selectedEngineId}
          onChange={(value) => onChange(String(value))}
          className="min-w-0"
          buttonClassName="min-h-0 h-[42px] rounded-input border-border bg-surface px-3 py-0 text-[11px] font-semibold uppercase tracking-micro shadow-sm"
        />
      </div>
    );
  }

  return (
    <div className={clsx(bar ? (compact ? 'space-y-0.5' : 'space-y-1') : 'space-y-2')}>
      <span className={clsx('uppercase tracking-micro text-text-muted', bar ? 'text-[10px]' : 'text-[11px]')}>
        {label}
      </span>
      <div className={clsx('flex flex-wrap', compact ? 'gap-1.5' : 'gap-2')}>
        {variants.map((entry) => {
          const active = entry.id === selectedEngineId;
          const disabledReason = disabledEngineReasons?.[entry.id];
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => !disabledReason && onChange(entry.id)}
              disabled={Boolean(disabledReason)}
              title={disabledReason}
              className={clsx(
                'rounded-pill border px-3 py-1 font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                bar ? 'text-[10px]' : 'text-[12px]',
                active
                  ? 'border-brand bg-brand text-on-brand'
                  : disabledReason
                    ? 'cursor-not-allowed border-border bg-surface text-text-muted/60 opacity-70'
                    : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-2'
              )}
            >
              {getLabel(entry)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
