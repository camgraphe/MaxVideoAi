import type { AppLocale } from '@/i18n/locales';
import { localizeSpecDetailValue } from '../_lib/compare-page-helpers';

export function renderSpecValue(
  value: string,
  locale: AppLocale,
  labels: { pending: string; supported: string; notSupported: string }
) {
  const normalized = value.toLowerCase();
  const localizedValue = localizeSpecDetailValue(value, locale, labels);
  if (
    normalized === labels.supported.toLowerCase() ||
    normalized === 'supported' ||
    normalized.startsWith('supported ') ||
    normalized.startsWith('supported (')
  ) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 p-1">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white" aria-hidden>
          ✓
        </span>
      </span>
    );
  }
  if (
    normalized === labels.notSupported.toLowerCase() ||
    normalized === 'not supported' ||
    normalized.startsWith('not supported ') ||
    normalized.startsWith('not supported (')
  ) {
    return (
      <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 p-1">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white" aria-hidden>
          ✕
        </span>
      </span>
    );
  }
  if (normalized === 'data pending') {
    return <span>{labels.pending}</span>;
  }
  return <span>{localizedValue}</span>;
}
