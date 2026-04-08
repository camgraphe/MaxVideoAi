import type { ReactNode } from 'react';
import clsx from 'clsx';

type AdminNoticeProps = {
  tone?: 'default' | 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
  className?: string;
};

export function AdminNotice({ tone = 'default', children, className }: AdminNoticeProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border px-4 py-3 text-sm',
        tone === 'warning' && 'border-warning-border bg-warning-bg text-warning',
        tone === 'error' && 'border-error-border bg-error-bg text-error',
        tone === 'success' && 'border-success-border bg-success-bg text-success',
        tone === 'info' && 'border-info-border bg-info-bg text-info',
        tone === 'default' && 'border-border bg-bg/60 text-text-secondary',
        className
      )}
    >
      {children}
    </div>
  );
}
