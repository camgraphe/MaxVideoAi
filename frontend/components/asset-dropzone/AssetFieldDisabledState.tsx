import clsx from 'clsx';
import type { AssetDisabledPresentation } from './asset-dropzone-types';

type AssetFieldDisabledStateProps = {
  disabled: boolean;
  presentation: AssetDisabledPresentation;
  reason: string | null;
};

export function isSourceVideoDisabledReason(reason?: string | null) {
  return Boolean(reason?.toLowerCase().includes('source video'));
}

export function AssetFieldDisabledBadge({ disabled, presentation, reason }: AssetFieldDisabledStateProps) {
  if (!disabled || !reason || presentation === 'auth-lock') return null;
  const label = isSourceVideoDisabledReason(reason) ? 'Source video active' : 'Unavailable';
  return (
    <span className="shrink-0 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning dark:border-[#f6c667]/30 dark:bg-[#f6c667]/10 dark:text-[#f6c667]">
      {label}
    </span>
  );
}

export function AssetFieldDisabledNotice({ disabled, presentation, reason }: AssetFieldDisabledStateProps) {
  if (!disabled || !reason || isSourceVideoDisabledReason(reason)) return null;
  return (
    <div
      role="note"
      className={clsx(
        'rounded-input border px-3 py-2 text-left text-[11px] font-medium leading-4',
        presentation !== 'auth-lock'
          ? 'border-warning-border bg-warning-bg text-warning dark:border-[#f6c667]/25 dark:bg-[#f6c667]/[0.06] dark:text-white/76'
          : 'border-border bg-surface-2 text-text-secondary'
      )}
    >
      {reason}
    </div>
  );
}
