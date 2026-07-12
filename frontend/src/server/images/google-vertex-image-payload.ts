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
    imageConfig?: { aspectRatio?: string; imageSize?: string };
  };
  tools?: Array<{ googleSearch: Record<string, never> }>;
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

export function buildGoogleVertexImagePayload(params: {
  prompt: string;
  referenceImages?: GoogleVertexReferenceImage[];
  aspectRatio?: string | null;
  imageSize?: string | null;
  enableWebSearch?: boolean;
}): GoogleVertexImagePayload {
  const prompt = params.prompt.trim();
  if (!prompt) throw new Error('Prompt is required for Google Vertex image generation.');
  const parts: VertexPart[] = [{ text: prompt }];
  for (const image of params.referenceImages ?? []) {
    if (image.fileUri) parts.push({ fileData: { mimeType: image.mimeType, fileUri: image.fileUri } });
    else parts.push({ inlineData: { mimeType: image.mimeType, data: image.data ?? '' } });
  }
  const aspectRatio = params.aspectRatio && params.aspectRatio !== 'auto' ? params.aspectRatio : undefined;
  const imageSize = normalizeImageSize(params.imageSize);
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(aspectRatio || imageSize ? { imageConfig: { ...(aspectRatio ? { aspectRatio } : {}), ...(imageSize ? { imageSize } : {}) } } : {}),
    },
    ...(params.enableWebSearch ? { tools: [{ googleSearch: {} }] } : {}),
  };
}
