import { MINIMAX_H3_MAX_ENGINE } from '@/src/config/fal-engines/minimax-h3-max';
import { KLING_3_TURBO_PRO_ENGINE } from '@/src/config/fal-engines/kling-3-turbo-pro';
import { KLING_3_TURBO_STANDARD_ENGINE } from '@/src/config/fal-engines/kling-3-turbo-standard';
import type { EngineCaps } from '@/types/engines';

const PRIVATE_RUNTIME_ENGINES: Readonly<Record<string, EngineCaps>> = {
  [KLING_3_TURBO_STANDARD_ENGINE.id]: KLING_3_TURBO_STANDARD_ENGINE,
  [KLING_3_TURBO_PRO_ENGINE.id]: KLING_3_TURBO_PRO_ENGINE,
  [MINIMAX_H3_MAX_ENGINE.id]: MINIMAX_H3_MAX_ENGINE,
};

export function isPrivateRuntimeEngineId(engineId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRIVATE_RUNTIME_ENGINES, engineId);
}

export function getPrivateRuntimeEngineById(engineId: string): EngineCaps | undefined {
  return PRIVATE_RUNTIME_ENGINES[engineId];
}
