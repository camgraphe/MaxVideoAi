import clsx from 'clsx';

type AdminLoadingPanelProps = {
  className?: string;
  rows?: number;
  compact?: boolean;
};

export function AdminLoadingPanel({ className, rows = 3, compact = false }: AdminLoadingPanelProps) {
  return (
    <div className={clsx('rounded-2xl border border-hairline bg-bg/35 p-4', className)}>
      <div className={clsx('space-y-3', compact && 'space-y-2')}>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={clsx(
              'animate-pulse rounded-xl bg-surface-2',
              compact ? 'h-10' : index === 0 ? 'h-14' : 'h-12'
            )}
          />
        ))}
      </div>
    </div>
  );
}
