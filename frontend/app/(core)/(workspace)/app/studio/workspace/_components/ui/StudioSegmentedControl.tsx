'use client';

import type { ReactNode } from 'react';

type StudioSegmentedControlOption<TValue extends string> = {
  disabled?: boolean;
  label: ReactNode;
  value: TValue;
};

type StudioSegmentedControlProps<TValue extends string> = {
  activeButtonClassName?: string;
  buttonClassName?: string;
  className?: string;
  label: string;
  onChange: (value: TValue) => void;
  options: Array<StudioSegmentedControlOption<TValue>>;
  value: TValue;
};

export function StudioSegmentedControl<TValue extends string>({
  activeButtonClassName,
  buttonClassName,
  className,
  label,
  onChange,
  options,
  value,
}: StudioSegmentedControlProps<TValue>) {
  return (
    <div className={className} role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`${buttonClassName ?? ''} ${active ? activeButtonClassName ?? '' : ''}`}
            aria-pressed={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
