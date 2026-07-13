import type { DurationSteps } from './types';

export function clampDuration(value: number, steps: DurationSteps): number {
  const bounded = Math.min(Math.max(value, steps.min), steps.max);
  if (steps.step <= 0) return bounded;
  const remainder = (bounded - steps.min) % steps.step;
  if (remainder === 0) return bounded;
  const lower = bounded - remainder;
  const upper = lower + steps.step;
  return Math.abs(bounded - lower) <= Math.abs(upper - bounded) ? lower : Math.min(upper, steps.max);
}
