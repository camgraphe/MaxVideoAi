'use client';

import clsx from 'clsx';
import { Button } from '@/components/ui/Button';

/** Exclusive boolean choices; keep their selected style separate from outline buttons. */
export function SettingsBooleanChoice({ label, value, onChange, onLabel = 'On', offLabel = 'Off' }: {
  label: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {[true, false].map(option => {
        const selected = option === value;
        return (
          <Button key={String(option)} type="button" size="sm" variant={selected ? 'primary' : 'outline'}
            aria-pressed={selected} onClick={() => onChange?.(option)}
            className={clsx('min-w-[64px] px-3 text-[13px]', selected && 'border border-transparent bg-brand')}>
            <svg aria-hidden="true" className={clsx('h-3.5 w-3.5 shrink-0', !selected && 'invisible')}
              viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m4 10 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {option ? onLabel : offLabel}
          </Button>
        );
      })}
    </div>
  );
}
