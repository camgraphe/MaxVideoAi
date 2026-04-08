import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export type AdminMetricItem = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'info';
  icon?: LucideIcon;
};

type AdminMetricGridProps = {
  items: AdminMetricItem[];
  columnsClassName?: string;
  density?: 'default' | 'compact';
  className?: string;
};

export function AdminMetricGrid({
  items,
  columnsClassName = 'sm:grid-cols-2 xl:grid-cols-4',
  density = 'default',
  className,
}: AdminMetricGridProps) {
  return (
    <div className={clsx('grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline', columnsClassName, className)}>
      {items.map((item) => (
        <AdminMetricCell key={item.label} item={item} density={density} />
      ))}
    </div>
  );
}

function AdminMetricCell({ item, density }: { item: AdminMetricItem; density: 'default' | 'compact' }) {
  const toneClass =
    item.tone === 'success'
      ? 'text-success'
      : item.tone === 'warning'
        ? 'text-warning'
        : item.tone === 'info'
          ? 'text-info'
          : 'text-text-primary';

  const Icon = item.icon;

  return (
    <div className={clsx('bg-surface', density === 'compact' ? 'px-4 py-3' : 'px-4 py-4')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{item.label}</p>
          <p className={clsx('mt-2 font-semibold', toneClass, density === 'compact' ? 'text-2xl' : 'text-3xl')}>{item.value}</p>
          {item.helper ? <p className="mt-1 text-xs leading-5 text-text-secondary">{item.helper}</p> : null}
        </div>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-text-muted" /> : null}
      </div>
    </div>
  );
}
