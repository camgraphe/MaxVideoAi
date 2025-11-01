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
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
        className
      )}
    >
      {live ? 'Live' : 'Coming soon'}
    </span>
  );
}

