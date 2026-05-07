import clsx from 'clsx';
import Image from 'next/image';
import type { Ref } from 'react';
import { Button } from '@/components/ui/Button';

type FieldGroupProps = {
  label: string;
  options: (string | number)[];
  value: string;
  onChange: (value: string) => void;
  focusRef?: Ref<HTMLDivElement>;
  disabled?: boolean;
  labelFor?: (option: string | number) => string;
  iconFor?: (option: string | number) => string | undefined;
};

export function FieldGroup({ label, options, value, onChange, focusRef, disabled = false, labelFor, iconFor }: FieldGroupProps) {
  return (
    <div
      className={clsx(
        'rounded-input border border-border bg-surface p-3 text-sm text-text-secondary',
        focusRef && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      ref={focusRef}
      tabIndex={focusRef ? -1 : undefined}
    >
      <span className="text-[12px] uppercase tracking-micro text-text-muted">{label}</span>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange(String(option))}
            className={clsx(
              'min-h-0 h-auto px-3 py-1.5 text-[13px]',
              disabled && 'cursor-not-allowed opacity-70',
              String(option) === value
                ? 'border-brand bg-brand text-on-brand'
                : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
            )}
          >
            {iconFor && iconFor(option) && (
              <Image src={iconFor(option)!} alt="" width={14} height={14} className="mr-2 inline-block h-3.5 w-3.5 align-[-2px]" />
            )}
            {labelFor ? labelFor(option) : String(option)}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function RangeWithInput({
  value,
  min = 0,
  max = 1,
  step = 0.05,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="range-input h-1 flex-1 appearance-none overflow-hidden rounded-full bg-hairline"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="w-20 rounded-input border border-border bg-surface px-2 py-1 text-right text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
