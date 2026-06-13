import type { ImageGenerationMode } from '@/types/image-generation';
import {
  LUMA_UNI_ASPECT_RATIOS,
  LUMA_UNI_MANGA_ASPECT_RATIOS,
  LUMA_UNI_MODEL_BY_ENGINE,
  LUMA_UNI_OUTPUT_FORMATS,
  LUMA_UNI_STYLES,
  isLumaAgentsImageEngineId,
  type LumaAgentsImageEngineId,
} from '@/lib/luma-agents';
import { LumaAgentsImageError } from './luma-agents-error';

export type LumaAgentsImagePayload = {
  model: 'uni-1' | 'uni-1-max';
  type: 'image' | 'image_edit';
  prompt: string;
  aspect_ratio?: string;
  style?: 'auto' | 'manga';
  output_format?: 'png' | 'jpeg';
  web_search?: boolean;
  source?: { url: string };
  image_ref?: Array<{ url: string }>;
};

const DIRECT_ASPECT_RATIOS = new Set<string>(LUMA_UNI_ASPECT_RATIOS);
const MANGA_ASPECT_RATIOS = new Set<string>(LUMA_UNI_MANGA_ASPECT_RATIOS);
const OUTPUT_FORMATS = new Set<string>(LUMA_UNI_OUTPUT_FORMATS);
const STYLES = new Set<string>(LUMA_UNI_STYLES);

const LUMA_T2I_REFERENCE_LIMIT = 9;
const LUMA_EDIT_EXTRA_REFERENCE_LIMIT = 8;

function invalidRequest(message: string, code: string, body?: unknown): never {
  throw new LumaAgentsImageError(message, {
    code,
    errorClass: 'invalid_request',
    body: body ?? { message },
  });
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeUrl(value: unknown, field: string): string {
  const url = cleanString(value);
  if (!url || !/^https?:\/\//i.test(url)) {
    invalidRequest(`${field} must be an absolute URL.`, 'LUMA_AGENTS_IMAGE_INVALID_URL', { field, url: value });
  }
  return url;
}

function normalizeOptionalUrlList(values: string[] | null | undefined): string[] {
  return (values ?? []).map((value, index) => normalizeUrl(value, `referenceImageUrls[${index}]`));
}

function normalizeOutputFormat(value: string | null | undefined): 'png' | 'jpeg' | undefined {
  const outputFormat = cleanString(value)?.toLowerCase();
  if (!outputFormat) return undefined;
  if (OUTPUT_FORMATS.has(outputFormat)) return outputFormat as 'png' | 'jpeg';
  invalidRequest('Luma Uni image output format must be png or jpeg.', 'LUMA_AGENTS_IMAGE_OUTPUT_FORMAT_UNSUPPORTED', {
    outputFormat: value,
  });
}

function normalizeStyle(value: string | null | undefined): 'auto' | 'manga' | undefined {
  const style = cleanString(value)?.toLowerCase();
  if (!style) return undefined;
  if (STYLES.has(style)) return style as 'auto' | 'manga';
  invalidRequest('Luma Uni image style must be auto or manga.', 'LUMA_AGENTS_IMAGE_STYLE_UNSUPPORTED', {
    style: value,
  });
}

function normalizeAspectRatio(value: string | null | undefined): string | undefined {
  const aspectRatio = cleanString(value);
  if (!aspectRatio) return undefined;
  if (DIRECT_ASPECT_RATIOS.has(aspectRatio)) return aspectRatio;
  invalidRequest('Luma Uni text-to-image aspect ratio is not supported.', 'LUMA_AGENTS_IMAGE_ASPECT_UNSUPPORTED', {
    aspectRatio: value,
  });
}

function normalizeEngineId(value: string): LumaAgentsImageEngineId {
  if (isLumaAgentsImageEngineId(value)) return value;
  invalidRequest('Unsupported Luma Agents image engine.', 'LUMA_AGENTS_IMAGE_ENGINE_UNSUPPORTED', { engineId: value });
}

export function buildLumaAgentsImagePayload(params: {
  engineId: string;
  mode: ImageGenerationMode;
  prompt: string;
  aspectRatio: string | null | undefined;
  style?: string | null;
  outputFormat?: string | null;
  webSearch?: boolean;
  sourceImageUrl?: string | null;
  referenceImageUrls?: string[] | null;
}): LumaAgentsImagePayload {
  const engineId = normalizeEngineId(params.engineId);
  const prompt = cleanString(params.prompt);
  if (!prompt) {
    invalidRequest('Prompt is required for Luma Agents image generation.', 'LUMA_AGENTS_IMAGE_PROMPT_REQUIRED');
  }
  const style = normalizeStyle(params.style);
  const outputFormat = normalizeOutputFormat(params.outputFormat);
  const referenceImageUrls = normalizeOptionalUrlList(params.referenceImageUrls);

  if (params.mode === 't2i') {
    if (referenceImageUrls.length > LUMA_T2I_REFERENCE_LIMIT) {
      invalidRequest(
        'Luma Uni text-to-image supports up to 9 reference images.',
        'LUMA_AGENTS_IMAGE_TOO_MANY_REFERENCES',
        { referenceImageCount: referenceImageUrls.length, max: LUMA_T2I_REFERENCE_LIMIT }
      );
    }
    const aspectRatio = normalizeAspectRatio(params.aspectRatio);
    if (style === 'manga' && (!aspectRatio || !MANGA_ASPECT_RATIOS.has(aspectRatio))) {
      invalidRequest(
        'Luma Uni manga style is only supported with portrait text-to-image aspect ratios.',
        'LUMA_AGENTS_IMAGE_MANGA_ASPECT_UNSUPPORTED',
        { aspectRatio: params.aspectRatio, allowed: LUMA_UNI_MANGA_ASPECT_RATIOS }
      );
    }
    return {
      model: LUMA_UNI_MODEL_BY_ENGINE[engineId],
      type: 'image',
      prompt,
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      ...(style ? { style } : {}),
      ...(outputFormat ? { output_format: outputFormat } : {}),
      ...(params.webSearch === true ? { web_search: true } : {}),
      ...(referenceImageUrls.length ? { image_ref: referenceImageUrls.map((url) => ({ url })) } : {}),
    };
  }

  if (params.mode === 'i2i') {
    if (referenceImageUrls.length > LUMA_EDIT_EXTRA_REFERENCE_LIMIT) {
      invalidRequest(
        'Luma Uni image edit supports up to 8 extra reference images.',
        'LUMA_AGENTS_IMAGE_TOO_MANY_REFERENCES',
        { referenceImageCount: referenceImageUrls.length, max: LUMA_EDIT_EXTRA_REFERENCE_LIMIT }
      );
    }
    const sourceUrl = cleanString(params.sourceImageUrl);
    if (!sourceUrl) {
      invalidRequest('Luma Uni image edit requires a source image.', 'LUMA_AGENTS_IMAGE_SOURCE_REQUIRED');
    }
    return {
      model: LUMA_UNI_MODEL_BY_ENGINE[engineId],
      type: 'image_edit',
      prompt,
      ...(style ? { style } : {}),
      ...(outputFormat ? { output_format: outputFormat } : {}),
      source: { url: normalizeUrl(sourceUrl, 'sourceImageUrl') },
      ...(referenceImageUrls.length ? { image_ref: referenceImageUrls.map((url) => ({ url })) } : {}),
    };
  }

  invalidRequest('Unsupported Luma Agents image mode.', 'LUMA_AGENTS_IMAGE_MODE_UNSUPPORTED', { mode: params.mode });
}
