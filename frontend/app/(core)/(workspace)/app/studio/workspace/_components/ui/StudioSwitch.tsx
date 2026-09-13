'use client';

import type { ReactNode } from 'react';

type StudioSwitchProps = {
  checked: boolean;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
};

export function StudioSwitch({
  checked,
  children,
  className,
  disabled,
  label,
  onCheckedChange,
}: StudioSwitchProps) {
  return (
    <button
      type="button"
      className={className}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    >
      {children}
    </button>
  );
}
