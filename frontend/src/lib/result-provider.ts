import { ENV } from '@/lib/env';
import type { ResultProviderMode } from '@/types/providers';

export type { ResultProviderMode } from '@/types/providers';

function normalize(mode?: string | null): ResultProviderMode | null {
  if (!mode) return null;
  const upper = mode.toUpperCase();
  if (upper === 'TEST' || upper === 'FAL' || upper === 'HYBRID') {
    return upper;
  }
  return null;
}

export function getResultProviderMode(): ResultProviderMode {
  const normalized = normalize(ENV.RESULT_PROVIDER);
  if (normalized) {
    return normalized;
  }
  return ENV.FAL_API_KEY ? 'FAL' : 'TEST';
}

export function shouldUseFalApis(): boolean {
  const mode = getResultProviderMode();
  return (mode === 'FAL' || mode === 'HYBRID') && Boolean(ENV.FAL_API_KEY);
}
