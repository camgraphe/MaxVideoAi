import Link from 'next/link';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type AdminWatchlistCardProps = {
  title: string;
  description?: ReactNode;
  value?: ReactNode;
  badge?: ReactNode;
  icon?: LucideIcon;
  href?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function AdminWatchlistCard({
  title,
  description,
  value,
  badge,
  icon: Icon,
  href,
  footer,
  children,
  className,
}: AdminWatchlistCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={clsx('min-w-0', Icon && 'flex items-start gap-3')}>
          {Icon ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-text-primary">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
            {value ? <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p> : null}
            {description ? <div className="mt-1 text-sm leading-6 text-text-secondary">{description}</div> : null}
          </div>
        </div>
        {badge ? (
          <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full border border-border bg-surface px-2 py-1 text-xs font-semibold text-text-primary">
            {badge}
          </span>
        ) : null}
      </div>

      {children ? <div className="mt-4">{children}</div> : null}

      {footer ? (
        <div className={clsx('mt-4 text-sm font-medium text-text-primary', href && 'transition group-hover:text-brand')}>{footer}</div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={clsx(
          'group block rounded-2xl border border-border bg-bg/60 p-4 transition hover:border-border-hover hover:bg-bg',
          className
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={clsx('rounded-2xl border border-hairline bg-bg/40 p-4', className)}>{content}</div>;
}
