import { normalizeExampleResolution } from '@/lib/example-recreation';
import type { EngineCaps, Mode } from '@/types/engines';
import { getModeCaps } from './workspace-engine-helpers';

/** Public labels are normalized; form values keep the provider's exact capability tokens. */
export function resolveExampleResolution(engine: EngineCaps, mode: Mode, value: string): string | null {
  const resolutions = getModeCaps(engine, mode)?.resolution;
  const options = resolutions?.length ? resolutions : engine.resolutions;
  const normalized = normalizeExampleResolution(value);
  return options.find(option => normalizeExampleResolution(option) === normalized) ?? null;
}
