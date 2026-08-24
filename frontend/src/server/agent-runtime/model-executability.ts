import {
  isBytePlusModelArkEnabled,
  isBytePlusSeedanceAdminOnly,
  isBytePlusSeedanceSubmissionEnabled,
  resolveBytePlusSeedanceRouteProfile,
} from '@/server/video-providers/byteplus-modelark';
import type { EngineCaps } from '@/types/engines';

export function isAgentGenerationEngineExecutable(engine: EngineCaps): boolean {
  try {
    const bytePlusProfile = resolveBytePlusSeedanceRouteProfile(
      engine.id,
      engine.providerMeta?.provider,
    );
    if (!bytePlusProfile) return true;
    return isBytePlusModelArkEnabled()
      && isBytePlusSeedanceSubmissionEnabled(engine.id)
      && !isBytePlusSeedanceAdminOnly(engine.id);
  } catch {
    return false;
  }
}
