import Link from 'next/link';
import clsx from 'clsx';
import type { ReactNode } from 'react';

type AdminShortcutItem = {
  label: string;
  href: string;
  active?: boolean;
  meta?: ReactNode;
};

type AdminShortcutRailProps = {
  items: AdminShortcutItem[];
  className?: string;
};

export function AdminShortcutRail({ items, className }: AdminShortcutRailProps) {
  return (
    <div className={clsx('flex flex-wrap gap-2', className)}>
      {items.map((item) => (
        <Link
          key={`${item.label}-${item.href}`}
          href={item.href}
          className={clsx(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
            item.active
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-border bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary'
          )}
        >
          <span>{item.label}</span>
          {item.meta ? (
            <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-text-primary">{item.meta}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
