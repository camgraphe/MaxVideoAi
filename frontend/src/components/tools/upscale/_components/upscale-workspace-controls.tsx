import type { ReactNode } from 'react';

export function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{children}</span>;
}

export function SegmentButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-input border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'border-brand bg-brand text-on-brand shadow-card'
          : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}
