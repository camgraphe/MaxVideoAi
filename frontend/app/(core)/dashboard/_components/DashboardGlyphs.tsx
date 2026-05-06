import clsx from 'clsx';

export function SectionGlyph({ tone = 'brand' }: { tone?: 'brand' | 'success' | 'warning' }) {
  return (
    <span
      className={clsx(
        'flex h-6 w-6 shrink-0 items-center justify-center',
        tone === 'brand' && 'text-brand',
        tone === 'success' && 'text-success',
        tone === 'warning' && 'text-warning'
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path
          d="M5.5 5.5v13"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.28"
        />
        <path
          d="M10 7h8.5M10 12h6.5M10 17h8.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function MetricDot({ tone = 'brand' }: { tone?: 'brand' | 'accent' | 'success' | 'muted' }) {
  return (
    <span
      className={clsx(
        'h-1.5 w-1.5 shrink-0 rounded-full',
        tone === 'brand' && 'bg-brand',
        tone === 'accent' && 'bg-accent',
        tone === 'success' && 'bg-success',
        tone === 'muted' && 'bg-text-muted'
      )}
      aria-hidden
    />
  );
}

