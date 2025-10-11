import type { DurationSteps, RoundingRule } from './types';

export function clampDuration(value: number, steps: DurationSteps): number {
  const bounded = Math.min(Math.max(value, steps.min), steps.max);
  if (steps.step <= 0) return bounded;
  const remainder = (bounded - steps.min) % steps.step;
  if (remainder === 0) return bounded;
  const lower = bounded - remainder;
  const upper = lower + steps.step;
  return Math.abs(bounded - lower) <= Math.abs(upper - bounded) ? lower : Math.min(upper, steps.max);
}

export function applyRounding(valueCents: number, rule?: RoundingRule): number {
  if (!rule || rule.incrementCents <= 0) {
    return Math.round(valueCents);
  }

  const increment = rule.incrementCents;
  const quotient = valueCents / increment;

  switch (rule.mode) {
    case 'up':
      return Math.ceil(quotient) * increment;
    case 'down':
      return Math.floor(quotient) * increment;
    case 'nearest':
    default:
      return Math.round(quotient) * increment;
  }
}

export function toMemberTier(value: string | undefined): 'member' | 'plus' | 'pro' {
  const normalised = (value ?? 'member').toLowerCase();
  if (normalised === 'plus' || normalised === 'pro') return normalised;
  return 'member';
}
