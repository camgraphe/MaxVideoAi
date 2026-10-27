import { NANO21_MODEL_ID, NANO21_ASPECT_RATIOS, normalizeNano21Settings, type Nano21ThinkingLevel } from '@/lib/nano-banana-2-1';

export type GoogleVertexReferenceImage =
  | { data: string; mimeType: string; fileUri?: never }
  | { fileUri: string; mimeType: string; data?: never };

type VertexPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  fileData?: { mimeType: string; fileUri: string };
};

export type GoogleVertexImagePayload = {
  contents: Array<{ role: 'user'; parts: VertexPart[] }>;
  generationConfig: {
    responseModalities: ['TEXT', 'IMAGE'];
    candidateCount?: 1;
    maxOutputTokens?: number;
    thinkingConfig?: { thinkingLevel: Nano21ThinkingLevel };
    imageConfig?: { aspectRatio?: string; imageSize?: string };
  };
  systemInstruction?: { parts: Array<{ text: string }> };
  tools?: Array<{ googleSearch: { searchTypes?: { webSearch?: Record<string, never>; imageSearch?: Record<string, never> } } }>;
};

function normalizeImageSize(value: string | null | undefined): string | undefined {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'auto') return undefined;
  if (normalized === '0.5k') return '0.5K';
  if (normalized === '1k') return '1K';
  if (normalized === '2k') return '2K';
  if (normalized === '4k') return '4K';
  return value?.trim() || undefined;
}

function normalizeThinkingLevel(value: string | null | undefined): 'MINIMAL' | 'HIGH' | undefined {
  if (value == null) return undefined;
  if (value === 'minimal') return 'MINIMAL';
  if (value === 'high') return 'HIGH';
  throw new Error('Unsupported thinking level for Google Vertex image generation.');
}

export function buildGoogleVertexImagePayload(params: {
  modelId?: string;
  thinkingLevel?: string | null;
  maxOutputTokens?: number;
  enableImageSearch?: boolean;
  systemInstruction?: string;
  prompt: string;
  referenceImages?: GoogleVertexReferenceImage[];
  aspectRatio?: string | null;
  imageSize?: string | null;
  enableWebSearch?: boolean;
}): GoogleVertexImagePayload {
  const nano21 = params.modelId === NANO21_MODEL_ID ? normalizeNano21Settings(params) : null;
  if (nano21) {
    if ((params.referenceImages?.length ?? 0) > 14) throw new Error('Nano Banana 2.1 accepts at most 14 references.');
    if (params.aspectRatio && !NANO21_ASPECT_RATIOS.some(ratio => ratio === params.aspectRatio)) throw new Error('Unsupported Nano Banana 2.1 aspect ratio.');
  }
  const prompt = params.prompt.trim();
  if (!prompt) throw new Error('Prompt is required for Google Vertex image generation.');
  const parts: VertexPart[] = [{ text: prompt }];
  for (const image of params.referenceImages ?? []) {
    if (image.fileUri) parts.push({ fileData: { mimeType: image.mimeType, fileUri: image.fileUri } });
    else parts.push({ inlineData: { mimeType: image.mimeType, data: image.data ?? '' } });
  }
  const aspectRatio = nano21 ? params.aspectRatio ?? '1:1' : params.aspectRatio && params.aspectRatio !== 'auto' ? params.aspectRatio : undefined;
  const imageSize = nano21?.imageSize ?? normalizeImageSize(params.imageSize);
  const thinkingLevel = nano21 ? undefined : normalizeThinkingLevel(params.thinkingLevel);
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(nano21 ? { candidateCount: 1 as const, maxOutputTokens: nano21.maxOutputTokens,
        thinkingConfig: { thinkingLevel: nano21.thinkingLevel } } : {}),
      ...(aspectRatio || imageSize ? { imageConfig: { ...(aspectRatio ? { aspectRatio } : {}), ...(imageSize ? { imageSize } : {}) } } : {}),
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
    },
    ...(nano21?.systemInstruction ? { systemInstruction: { parts: [{ text: nano21.systemInstruction }] } } : {}),
    ...(nano21 ? nano21.enableWebSearch || nano21.enableImageSearch ? { tools: [{ googleSearch: { searchTypes: {
      ...(nano21.enableWebSearch ? { webSearch: {} } : {}), ...(nano21.enableImageSearch ? { imageSearch: {} } : {}),
    } } }] } : {} : params.enableWebSearch ? { tools: [{ googleSearch: {} }] } : {}),
  };
}
