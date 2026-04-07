import type { ReactNode } from 'react';
import clsx from 'clsx';

type AdminDataTableProps = {
  children: ReactNode;
  className?: string;
  tableClassName?: string;
  tone?: 'default' | 'muted';
};

export function AdminDataTable({
  children,
  className,
  tableClassName,
  tone = 'default',
}: AdminDataTableProps) {
  return (
    <div
      className={clsx(
        'overflow-x-auto rounded-2xl border border-hairline',
        tone === 'muted' ? 'overflow-hidden bg-bg/40' : 'bg-transparent',
        className
      )}
    >
      <table className={clsx('min-w-full text-left text-sm', tableClassName)}>{children}</table>
    </div>
  );
}
