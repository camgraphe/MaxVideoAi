import clsx from 'clsx';
import type { ReactNode } from 'react';

export type PlaylistStatusTone = 'neutral' | 'ok' | 'warn';

export function StatusPill({
  tone,
  children,
}: {
  tone: PlaylistStatusTone;
  children: ReactNode;
}) {
  const classes =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : tone === 'warn'
        ? 'border-warning-border/60 bg-warning-bg/20 text-warning'
        : 'border-border bg-bg text-text-secondary';

  return <span className={clsx('inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold', classes)}>{children}</span>;
}
