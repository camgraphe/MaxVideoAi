import type { ReactNode } from 'react';

type CalloutProps = {
  tone?: 'success' | 'warn' | 'info';
  children: ReactNode;
};

const TONE_CLASSNAMES: Record<NonNullable<CalloutProps['tone']>, string> = {
  success: 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]',
  warn: 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]',
  info: 'border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]',
};

export function Callout({ tone = 'info', children }: CalloutProps) {
  const classes = TONE_CLASSNAMES[tone] ?? TONE_CLASSNAMES.info;
  return <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${classes}`}>{children}</div>;
}
