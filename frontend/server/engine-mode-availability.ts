import type { EngineCaps, EngineModeAvailability, Mode } from '@/types/engines';
import {
  resolveAgentGenerationModeExecutability,
  type AgentGenerationExecutabilityEnvironment,
} from '@/server/agent-runtime/model-executability';
import { getBytePlusSeedanceModeResolutions } from '@/lib/byteplus-mode-capabilities';
import { resolveBytePlusTransport } from '@/server/video-providers/byteplus-modelark-transport';

/** Runtime readiness supplements the authored capabilities; it never changes identity. */
export function resolveSeedance25ModeAvailability(
  engine: EngineCaps,
  mode: Mode,
  environment?: AgentGenerationExecutabilityEnvironment,
): EngineModeAvailability | null {
  if (engine.id !== 'seedance-2-5') return null;
  if (!engine.modes.includes(mode)) return { available: false, reason: 'profile_invalid' };
  const decision = resolveAgentGenerationModeExecutability(engine, mode, environment);
  let inheritsSourceVideo = false;
  try { inheritsSourceVideo = mode === 'v2v' && resolveBytePlusTransport(engine.id, mode) === 'modelark'; } catch { /* invalid selection remains closed */ }
  return { available: decision.executable, reason: decision.reason,
    ...(inheritsSourceVideo ? { inheritsSourceVideo: true } : {}) };
}

export function projectSeedance25ModeAvailability(engine: EngineCaps, environment?: AgentGenerationExecutabilityEnvironment): EngineCaps {
  if (engine.id !== 'seedance-2-5') return engine;
  return {
    ...engine,
    modeAvailability: Object.fromEntries(engine.modes.map((mode) => [mode, resolveSeedance25ModeAvailability(engine, mode, environment)])),
    modeCaps: engine.modeCaps ? Object.fromEntries(Object.entries(engine.modeCaps).map(([mode, caps]) => [mode, caps ? {
      ...caps,
      ...(caps.resolution ? { resolution: [...getBytePlusSeedanceModeResolutions(engine.id, mode, caps.resolution)] } : {}),
    } : caps])) : undefined,
  };
}
