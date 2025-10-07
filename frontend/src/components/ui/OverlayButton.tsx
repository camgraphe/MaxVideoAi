import clsx from 'clsx';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type OverlayButtonSize = 'md' | 'sm';

export interface OverlayButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label?: string;
  size?: OverlayButtonSize;
  showLabel?: boolean;
}

export const OverlayButton = forwardRef<HTMLButtonElement, OverlayButtonProps>(
  ({ className, icon, label, children, size = 'md', showLabel = true, ...props }, ref) => {
    const sizeClass = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-[13px]';

    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center gap-2 rounded-[10px] border border-border bg-white/70 text-text-secondary shadow-card backdrop-blur-md transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          sizeClass,
          className
        )}
        {...props}
      >
        {icon}
        {label && (
          <span className={clsx(showLabel ? 'font-medium' : 'sr-only')}>{label}</span>
        )}
        {children}
      </button>
    );
  }
);

OverlayButton.displayName = 'OverlayButton';
