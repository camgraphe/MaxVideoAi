import { executeReservedAudioRun } from '@/server/audio/generate-audio';
import { enqueueAudioDispatch } from '@/server/audio/dispatch-repository';
import { getMcpAudioExecutionMode, isMcpExtendedAudioEnabled } from './audio-capabilities';
import type { ConfirmAudioGenerationDependencies } from './confirm-audio-generation';

/** Transport choice only: canonical reservation, pricing, provider execution and refunds remain shared. */
export function createMcpAudioExecutionDependencies(
  env: NodeJS.ProcessEnv = process.env,
): Pick<ConfirmAudioGenerationDependencies, 'executeRun' | 'enqueueRun'> {
  return {
    executeRun: executeReservedAudioRun,
    ...(isMcpExtendedAudioEnabled(env) && getMcpAudioExecutionMode(env) === 'worker'
      ? { enqueueRun: enqueueAudioDispatch }
      : {}),
  };
}
