export const KLING_MULTI_PROMPT_SCENE_MAX_CHARS = 512;

export function isKlingMultiPromptEngine(engineId: string): boolean {
  return engineId.startsWith('kling-3') || engineId.startsWith('kling-o3');
}
