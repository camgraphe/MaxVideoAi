import clsx from 'clsx';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

export type ChipVariant = 'outline' | 'accent' | 'ghost';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, variant = 'outline', children, ...props }, ref) => {
    const variantClass = {
      outline:
        'border-hairline bg-white/80 text-text-secondary shadow-[0_0_0_1px_rgba(255,255,255,0.6)] backdrop-blur-sm',
      accent: 'border-transparent bg-accent text-white shadow-card',
      ghost: 'border-transparent bg-white/65 text-text-secondary backdrop-blur-sm'
    }[variant];

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium uppercase tracking-micro',
          variantClass,
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Chip.displayName = 'Chip';
