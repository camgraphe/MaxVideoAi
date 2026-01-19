import clsx from 'clsx';

type FlagPillProps = {
  live: boolean;
  className?: string;
};

export function FlagPill({ live, className }: FlagPillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        live
          ? 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]'
          : 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]',
        className
      )}
    >
      {live ? 'Live' : 'Coming soon'}
    </span>
  );
}
