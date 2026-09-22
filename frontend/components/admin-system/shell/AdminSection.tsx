import type { ReactNode } from 'react';
import clsx from 'clsx';

type AdminSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function AdminSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: AdminSectionProps) {
  return (
    <section className={clsx('min-w-0 bg-surface', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </header>
      <div className={clsx('py-3', contentClassName)}>{children}</div>
    </section>
  );
}
