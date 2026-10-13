import type { Mode } from '@/types/engines';

/** LAS video editing has a narrower output contract than the ModelArk workflows. */
export function getBytePlusSeedanceModeResolutions<T extends string>(
  engineId: string,
  mode: Mode | string | null | undefined,
  resolutions: readonly T[],
): T[] {
  return engineId === 'seedance-2-5' && mode === 'v2v'
    ? resolutions.filter((resolution) => resolution === '480p' || resolution === '720p')
    : [...resolutions];
}
