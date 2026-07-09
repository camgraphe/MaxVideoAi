export type GoogleGeminiReferenceImage = {
  data: string;
  mimeType: string;
};

export type GoogleGeminiImagePayload = {
  model: string;
  input: Array<{ type: 'text'; text: string } | { type: 'image'; mime_type: string; data: string }>;
  response_format?: {
    type: 'image';
    mime_type?: string;
    aspect_ratio?: string;
    image_size?: string;
  };
  tools?: Array<{ type: 'google_search'; search_types?: Array<'web_search' | 'image_search'> }>;
  generation_config?: {
    thinking_level?: 'minimal' | 'high';
  };
};

function normalizeMimeType(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'png' || normalized === 'image/png') return 'image/png';
  if (normalized === 'webp' || normalized === 'image/webp') return 'image/webp';
  if (normalized === 'jpg' || normalized === 'jpeg' || normalized === 'image/jpg' || normalized === 'image/jpeg') {
    return 'image/jpeg';
  }
  return null;
}

export function normalizeGoogleGeminiImageSize(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized || normalized === 'auto') return null;
  if (normalized === '0.5k') return '0.5K';
  if (normalized === '1k') return '1K';
  if (normalized === '2k') return '2K';
  if (normalized === '4k') return '4K';
  if (normalized === '512px') return '512px';
  return value?.trim() || null;
}

export function buildGoogleGeminiImagePayload(params: {
  modelId: string;
  prompt: string;
  referenceImages?: GoogleGeminiReferenceImage[];
  aspectRatio?: string | null;
  imageSize?: string | null;
  outputFormat?: string | null;
  enableWebSearch?: boolean;
  thinkingLevel?: string | null;
}): GoogleGeminiImagePayload {
  const model = params.modelId.trim();
  const prompt = params.prompt.trim();
  if (!model) throw new Error('Google Gemini image model id is not configured.');
  if (!prompt) throw new Error('Prompt is required for Google Gemini image generation.');

  const input: GoogleGeminiImagePayload['input'] = [{ type: 'text', text: prompt }];
  for (const image of params.referenceImages ?? []) {
    input.push({
      type: 'image',
      mime_type: image.mimeType,
      data: image.data,
    });
  }

  const responseFormat: GoogleGeminiImagePayload['response_format'] = { type: 'image' };
  const mimeType = normalizeMimeType(params.outputFormat);
  if (mimeType) responseFormat.mime_type = mimeType;
  if (params.aspectRatio && params.aspectRatio !== 'auto') responseFormat.aspect_ratio = params.aspectRatio;
  const imageSize = normalizeGoogleGeminiImageSize(params.imageSize);
  if (imageSize) responseFormat.image_size = imageSize;

  const payload: GoogleGeminiImagePayload = {
    model,
    input,
    response_format: responseFormat,
  };

  if (params.enableWebSearch) {
    payload.tools =
      model === 'gemini-3.1-flash-image'
        ? [{ type: 'google_search', search_types: ['web_search', 'image_search'] }]
        : [{ type: 'google_search' }];
  }
  if (params.thinkingLevel === 'minimal' || params.thinkingLevel === 'high') {
    payload.generation_config = { thinking_level: params.thinkingLevel };
  }

  return payload;
}
