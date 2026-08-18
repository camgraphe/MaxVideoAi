export const KLING_MULTI_PROMPT_SCENE_MAX_CHARS = 512;
export const KLING_PROVIDER_PROMPT_MAX_CHARS = 2500;

export function isKlingMultiPromptEngine(engineId: string): boolean {
  return engineId.startsWith('kling-3') || engineId.startsWith('kling-o3');
}

export function isKlingOmniEngine(engineId: string): boolean {
  return engineId.startsWith('kling-o3');
}

export function normalizeKlingOmniPromptReferences(value: string): string {
  return value
    .replace(/(^|[^\w])@(Image|image)_?(\d+)\b/g, (_match, prefix: string, _kind: string, index: string) => {
      return `${prefix}<<<image_${index}>>>`;
    })
    .replace(/(^|[^\w])@(Video|video)_?(\d+)\b/g, (_match, prefix: string, _kind: string, index: string) => {
      return `${prefix}<<<video_${index}>>>`;
    })
    .replace(/(^|[^\w])@(Element|element)_?(\d+)\b/g, (_match, prefix: string, _kind: string, index: string) => {
      return `${prefix}<<<element_${index}>>>`;
    });
}
