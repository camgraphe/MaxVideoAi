import { adjacentNonnegativeDouble } from './pricing-number-boundaries';

/** Match the existing IEEE input+output validator, including its representable end point. */
export function maximumWan3TariffSourceDuration(output: number): number {
  if (!Number.isInteger(output) || output < 2 || output > 30) throw new Error('Unsupported Wan output duration.');
  if (output <= 15) return 15;
  let lower = 0;
  let upper = 15;
  while (adjacentNonnegativeDouble(lower, 'next') < upper) {
    const middle = lower + (upper - lower) / 2;
    if (middle === lower || middle === upper) break;
    if (output + middle <= 30) lower = middle;
    else upper = middle;
  }
  return lower;
}
