import { ENV } from '@/lib/env';
import type { Mode } from '@/types/engines';
import { SEEDANCE_2_5_ENGINE_ID } from './byteplus-modelark-constants';
import { BytePlusModelArkError } from './byteplus-modelark-error';

export type BytePlusTransport = 'modelark' | 'las';

/** Current new-work policy; accepted jobs recover from their recorded transport. */
export function resolveBytePlusTransport(
  engineId: string | null | undefined,
  mode: Mode | string | null | undefined,
): BytePlusTransport {
  if (engineId?.trim() !== SEEDANCE_2_5_ENGINE_ID || mode?.trim().toLowerCase() !== 'v2v') return 'modelark';
  const selected = (ENV.SEEDANCE_2_5_EDIT_TRANSPORT ?? 'las').trim().toLowerCase();
  if (selected === 'modelark' || selected === 'las') return selected;
  throw new BytePlusModelArkError('The Edit transport is not supported.', { code: 'BYTEPLUS_EDIT_TRANSPORT_UNSUPPORTED' });
}
