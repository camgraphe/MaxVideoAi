import type { EngineCaps } from '@/types/engines';

const PRIVATE_RUNTIME_ENGINES: Readonly<Record<string, EngineCaps>> = {};

export function isPrivateRuntimeEngineId(engineId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRIVATE_RUNTIME_ENGINES, engineId);
}

export function getPrivateRuntimeEngineById(engineId: string): EngineCaps | undefined {
  return PRIVATE_RUNTIME_ENGINES[engineId];
}
