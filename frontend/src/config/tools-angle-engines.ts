import type { AngleToolEngineDefinition, AngleToolEngineId } from '@/types/tools-angle';

export const ANGLE_TOOL_ENGINES: readonly AngleToolEngineDefinition[] = [
  {
    id: 'flux-multiple-angles',
    label: 'FLUX Multiple Angles',
    description: 'FLUX LoRA multi-angle engine with horizontal/vertical/zoom controls.',
    falModelId: 'fal-ai/flux-2-lora-gallery/multiple-angles',
    inputStyle: 'multiple-angles',
    estimatedCostUsdPerMp: 0.021,
    supportsMultiOutput: true,
  },
  {
    id: 'qwen-multiple-angles',
    label: 'Qwen Multiple Angles',
    description: 'Qwen image edit multiple-angle engine tuned for angle consistency.',
    falModelId: 'fal-ai/qwen-image-edit-2511-multiple-angles',
    inputStyle: 'multiple-angles',
    estimatedCostUsdPerMp: 0.035,
    supportsMultiOutput: true,
  },
] as const;

const ANGLE_TOOL_ENGINE_MAP = new Map(ANGLE_TOOL_ENGINES.map((engine) => [engine.id, engine]));

export const DEFAULT_ANGLE_TOOL_ENGINE_ID: AngleToolEngineId = 'flux-multiple-angles';

export function listAngleToolEngines(): readonly AngleToolEngineDefinition[] {
  return ANGLE_TOOL_ENGINES;
}

export function getAngleToolEngine(engineId?: string | null): AngleToolEngineDefinition {
  if (!engineId) {
    return ANGLE_TOOL_ENGINE_MAP.get(DEFAULT_ANGLE_TOOL_ENGINE_ID)!;
  }
  return ANGLE_TOOL_ENGINE_MAP.get(engineId as AngleToolEngineId) ?? ANGLE_TOOL_ENGINE_MAP.get(DEFAULT_ANGLE_TOOL_ENGINE_ID)!;
}
