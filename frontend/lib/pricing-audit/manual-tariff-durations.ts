import type { FalEngineEntry } from '@/config/falEngines';
import type { PricingContext } from '@/lib/pricing-context';
import type { EngineModeDurationCaps, Mode } from '@/types/engines';

export function numericTariffDuration(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number(value.replace(/s$/i, ''));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

type DurationValue = Pick<PricingContext, 'durationSec' | 'durationOption'>;

/** Enumerates reviewed billing timing classes; source-continuous owners keep a separate coverage gate. */
export function manualTariffDurations(entry: FalEngineEntry, mode: Mode, duration: EngineModeDurationCaps | undefined): {
  values: DurationValue[]; incomplete: boolean;
} {
  const max = entry.engine.maxDurationSec;
  if (duration && 'options' in duration) {
    const numeric = [...new Set(duration.options.map(numericTariffDuration).filter((v): v is number => v !== null))];
    const values: DurationValue[] = numeric.map(durationSec => ({ durationSec }));
    const auto = duration.options.includes('auto');
    const reviewedAuto = ['flux-3', 'flux-3-draft', 'ltx-2-5-fast', 'ltx-2-5-pro', 'seedance-2-0', 'seedance-2-0-fast'].includes(entry.id);
    if (auto && reviewedAuto && Number.isInteger(max) && max <= 60) {
      const min = entry.id.startsWith('seedance') ? Math.min(...numeric) : 1;
      for (let durationSec = min; durationSec <= max; durationSec++) {
        if (!numeric.includes(durationSec)) values.push({ durationSec, durationOption: 'auto' });
      }
    }
    return { values, incomplete: duration.options.some(value => numericTariffDuration(value) === null
      && !(value === 'auto' && reviewedAuto)) };
  }
  const lower = duration && 'min' in duration ? duration.min :
    ['happy-horse-1-0', 'ltx-2-3'].includes(entry.id) && ['v2v', 'a2v'].includes(mode) ? 1 :
    mode === 'reframe' && ['luma-ray-3-2', 'lumaRay2', 'lumaRay2_flash'].includes(entry.id) ? 1 : null;
  const upper = mode === 'reframe' ? entry.engine.inputLimits?.videoMaxDurationSec ?? max : max;
  if (lower !== null && Number.isInteger(lower) && Number.isInteger(upper) && upper >= lower && upper - lower <= 60) {
    return { values: Array.from({ length: upper - lower + 1 }, (_, index) => ({ durationSec: lower + index })), incomplete: false };
  }
  // These owners bill verified audio seconds, not an independently requested output duration.
  if (mode === 'a2v' && ['ltx-2-5-fast', 'ltx-2-5-pro'].includes(entry.id)) return { values: [{ durationSec: 9 }], incomplete: false };
  const selected = numericTariffDuration(entry.pricingHint?.durationSeconds ?? max);
  return { values: selected ? [{ durationSec: selected }] : [], incomplete: true };
}
