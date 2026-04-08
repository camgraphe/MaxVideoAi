import type { ReactNode } from 'react';
import clsx from 'clsx';

type AdminDataTableProps = {
  children: ReactNode;
  className?: string;
  tableClassName?: string;
  viewportClassName?: string;
  tone?: 'default' | 'muted';
};

export function AdminDataTable({
  children,
  className,
  tableClassName,
  viewportClassName,
  tone = 'default',
}: AdminDataTableProps) {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded-2xl border border-hairline',
        tone === 'muted' ? 'bg-bg/40' : 'bg-transparent',
        className
      )}
    >
      <div className={clsx('overflow-x-auto', viewportClassName)}>
        <table className={clsx('min-w-full text-left text-sm', tableClassName)}>{children}</table>
      </div>
    </div>
  );
}
