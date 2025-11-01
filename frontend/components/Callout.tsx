import type { ReactNode } from 'react';

type CalloutProps = {
  tone?: 'success' | 'warn' | 'info';
  children: ReactNode;
};

const TONE_CLASSNAMES: Record<NonNullable<CalloutProps['tone']>, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

export function Callout({ tone = 'info', children }: CalloutProps) {
  const classes = TONE_CLASSNAMES[tone] ?? TONE_CLASSNAMES.info;
  return <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${classes}`}>{children}</div>;
}

