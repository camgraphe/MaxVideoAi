import { getBytePlusSeedanceModeResolutions } from '@/lib/byteplus-mode-capabilities';
import { getBytePlusSeedanceAllowedModes } from '@/server/video-providers/byteplus-modelark-profile-policy';
import type { CanonicalGenerationRequest } from './generation-types';
import type { AgentPublicGenerationEngine } from './public-engine-policy';

/** Native workflow uses ModelArk even when ordinary v2v's LAS transport is unavailable. */
export function seedanceWorkflowCandidate(request: Pick<CanonicalGenerationRequest,'engineId'|'seedanceWorkflow'>,
  candidate: AgentPublicGenerationEngine): AgentPublicGenerationEngine {
  if (request.engineId !== 'seedance-2-5' || !request.seedanceWorkflow) return candidate;
  const nativeModes = candidate.seedanceWorkflowModes ?? (candidate.publicModes.some(mode =>
    ['t2v','i2v','ref2v','extend'].includes(mode)) ? candidate.engine.modes : []);
  const allowed = getBytePlusSeedanceAllowedModes('seedance-2-5');
  const publicModes = (['t2v','i2v','ref2v','v2v','extend'] as const)
    .filter(mode => allowed.includes(mode) && nativeModes.includes(mode) && candidate.engine.modes.includes(mode) && candidate.modeCaps[mode]);
  const modeCaps = { ...candidate.modeCaps };
  for (const mode of publicModes) {
    modeCaps[mode] = { ...modeCaps[mode]!, resolution: getBytePlusSeedanceModeResolutions(
      candidate.engine.id, mode, candidate.engine.resolutions, 'modelark') };
  }
  return { ...candidate, publicModes, modeCaps };
}
