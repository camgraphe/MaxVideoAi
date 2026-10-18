import { Check, Minus } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { localizeSpecDetailValue } from '../_lib/compare-page-spec-values';
import { compareCapabilityStatus } from '../_lib/compare-page-score-utils';

export function renderSpecValue(value: string, locale: AppLocale,
  labels: { pending: string; supported: string; notSupported: string }) {
  const status = compareCapabilityStatus(value);
  return <span className={`compare-capability compare-capability--${status}`}>
    {status === 'yes' ? <Check size={14} aria-hidden="true" /> : status === 'no' ? <Minus size={14} aria-hidden="true" /> : null}
    <span>{localizeSpecDetailValue(value, locale, labels)}</span>
  </span>;
}
