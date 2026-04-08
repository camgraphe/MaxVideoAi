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
    <section className={clsx('overflow-hidden rounded-[20px] border border-border bg-surface shadow-card', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </header>
      <div className={clsx('px-5 py-5', contentClassName)}>{children}</div>
    </section>
  );
}
