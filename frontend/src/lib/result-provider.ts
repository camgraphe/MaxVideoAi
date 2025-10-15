import type { ResultProviderMode } from '@/types/providers';

export type { ResultProviderMode } from '@/types/providers';

export function getResultProviderMode(): ResultProviderMode {
  return 'FAL';
}

export function shouldUseFalApis(): boolean {
  return true;
}
