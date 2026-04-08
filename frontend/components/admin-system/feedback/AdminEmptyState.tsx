import type { ReactNode } from 'react';
import clsx from 'clsx';

type AdminEmptyStateProps = {
  children: ReactNode;
  className?: string;
};

export function AdminEmptyState({ children, className }: AdminEmptyStateProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-dashed border-surface-on-media-25 bg-bg/70 px-4 py-5 text-sm leading-6 text-text-secondary',
        className
      )}
    >
      {children}
    </div>
  );
}
