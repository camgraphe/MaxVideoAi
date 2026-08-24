import { ENV } from '@/lib/env';
import { isBytePlusModelArkEnabled } from '@/server/video-providers/byteplus-modelark';
import type { EngineCaps } from '@/types/engines';

import { BytePlusSeedreamError } from './byteplus-seedream-error';

export type BytePlusSeedreamReadiness = Readonly<{
  executable: boolean;
  reason: 'available' | 'provider_disabled' | 'provider_credentials_missing' | 'model_unsupported';
}>;

type BytePlusSeedreamEnvironment = Readonly<{
  bytePlusEnabled: boolean;
  bytePlusApiKey: string | undefined;
}>;

export function isBytePlusSeedreamEngine(engine: EngineCaps): boolean {
  return ['seedream', 'seedream-5-0-pro'].includes(engine.id);
}

export function resolveBytePlusSeedreamReadiness(
  engine: EngineCaps,
  env: BytePlusSeedreamEnvironment,
): BytePlusSeedreamReadiness {
  if (!isBytePlusSeedreamEngine(engine)) {
    return { executable: false, reason: 'model_unsupported' };
  }
  if (!env.bytePlusEnabled) return { executable: false, reason: 'provider_disabled' };
  if (!env.bytePlusApiKey?.trim()) {
    return { executable: false, reason: 'provider_credentials_missing' };
  }
  return { executable: true, reason: 'available' };
}

export function assertBytePlusSeedreamExecutable(engine: EngineCaps): void {
  const readiness = resolveBytePlusSeedreamReadiness(engine, {
    bytePlusEnabled: isBytePlusModelArkEnabled(),
    bytePlusApiKey: ENV.BYTEPLUS_ARK_API_KEY,
  });
  if (readiness.executable) return;

  if (readiness.reason === 'provider_credentials_missing') {
    throw new BytePlusSeedreamError('BytePlus Seedream API key is not configured.', {
      code: 'BYTEPLUS_SEEDREAM_API_KEY_MISSING',
      status: 503,
    });
  }
  throw new BytePlusSeedreamError('BytePlus Seedream is not currently available.', {
    code:
      readiness.reason === 'model_unsupported'
        ? 'BYTEPLUS_SEEDREAM_MODEL_UNSUPPORTED'
        : 'BYTEPLUS_SEEDREAM_PROVIDER_DISABLED',
    status: readiness.reason === 'model_unsupported' ? 400 : 503,
  });
}
