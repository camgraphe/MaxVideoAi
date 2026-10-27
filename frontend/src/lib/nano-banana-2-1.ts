/** Native Vertex facts checked 2026-10-25; commercial budget approval is separate. */
export const NANO21_ENGINE_ID = 'nano-banana-2-1';
export const NANO21_MODEL_ID = 'gemini-nano-banana-2.1';
export const NANO21_BUDGET_POLICY_VERSION = 'nano21-fixed-image-prices-2026-10-27-v1';
// Product output cap, not a verified total provider-cost bound.
export const NANO21_DEFAULT_MAX_OUTPUT_TOKENS = 32768;
export const NANO21_ASPECT_RATIOS: import('@/types/engines').AspectRatio[] = ['1:1', '3:2', '2:3', '3:4', '1:4', '4:1', '4:3', '4:5', '5:4', '1:8', '8:1', '9:16', '16:9', '21:9'];
export type Nano21ThinkingLevel = 'MINIMAL' | 'MEDIUM' | 'HIGH';
export type Nano21Settings = {
  imageSize: '1K' | '2K' | '4K';
  thinkingLevel: Nano21ThinkingLevel;
  maxOutputTokens: number;
  enableWebSearch: boolean;
  enableImageSearch: boolean;
  systemInstruction?: string;
};

export function normalizeNano21Settings(input: {
  prompt?: string; resolution?: string | null; imageSize?: string | null; thinkingLevel?: string | null;
  maxOutputTokens?: number; enableWebSearch?: boolean; enableImageSearch?: boolean; systemInstruction?: string;
}): Nano21Settings {
  if (input.prompt !== undefined && (typeof input.prompt !== 'string' || input.prompt.trim().length > 12000)) throw new Error('Nano Banana 2.1 prompt exceeds the product input budget.');
  if (input.systemInstruction !== undefined && (typeof input.systemInstruction !== 'string' || input.systemInstruction.length > 4096)) throw new Error('Nano Banana 2.1 system instruction exceeds the product input budget.');
  const imageSize = (input.imageSize ?? input.resolution ?? '1K').toUpperCase();
  if (!['1K', '2K', '4K'].includes(imageSize)) throw new Error('Unsupported Nano Banana 2.1 image size.');
  const thinkingLevel = (input.thinkingLevel ?? 'MEDIUM').toUpperCase();
  if (!['MINIMAL', 'MEDIUM', 'HIGH'].includes(thinkingLevel)) throw new Error('Unsupported Nano Banana 2.1 thinking level.');
  const maxOutputTokens = input.maxOutputTokens ?? NANO21_DEFAULT_MAX_OUTPUT_TOKENS;
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 32768) {
    throw new Error('Nano Banana 2.1 maxOutputTokens must be an integer from 1 to 32768.');
  }
  for (const value of [input.enableWebSearch, input.enableImageSearch]) {
    if (value !== undefined && typeof value !== 'boolean') throw new Error('Nano Banana 2.1 search controls must be booleans.');
  }
  if (input.systemInstruction !== undefined && typeof input.systemInstruction !== 'string') throw new Error('Invalid system instruction.');
  return { imageSize: imageSize as Nano21Settings['imageSize'], thinkingLevel: thinkingLevel as Nano21ThinkingLevel,
    maxOutputTokens, enableWebSearch: input.enableWebSearch === true, enableImageSearch: input.enableImageSearch === true,
    ...(input.systemInstruction?.trim() ? { systemInstruction: input.systemInstruction.trim() } : {}) };
}

export function assertNano21Scenario(input: { mode?: string; referenceImageCount?: number; outputCount?: number;
  aspectRatio?: string | null; enableWebSearch?: boolean; enableImageSearch?: boolean }): void {
  const count = input.referenceImageCount ?? 0;
  if (!Number.isSafeInteger(count) || count < 0 || count > 14
    || (input.mode === 't2i' && count !== 0) || (input.mode === 'i2i' && count < 1)
    || !['t2i', 'i2i'].includes(input.mode ?? '')) throw new Error('Invalid Nano Banana 2.1 mode or reference count.');
  if ((input.outputCount ?? 1) !== 1) throw new Error('Nano Banana 2.1 currently supports one quoted provider request.');
  if (input.aspectRatio && !NANO21_ASPECT_RATIOS.some(ratio => ratio === input.aspectRatio)) throw new Error('Unsupported Nano Banana 2.1 aspect ratio.');
  // Supported native options share the approved fixed image price. Supplier
  // text, thinking and tool usage remain separate costs borne by the business.
}

export function assertNano21UnsupportedFields(input: Record<string, unknown>): void {
  for (const key of ['imageSize', 'seed', 'temperature', 'topP', 'topK', 'logprobs', 'thinkingBudget', 'maskUrl', 'outputFormat',
    'quality', 'background', 'style', 'limitGenerations', 'conversation', 'contents', 'tools']) {
    if (input[key] !== undefined && input[key] !== null && input[key] !== false && input[key] !== '') {
      throw new Error(`Unsupported Nano Banana 2.1 field: ${key}.`);
    }
  }
}
