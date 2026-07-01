import type { GeneratePayload } from '@/lib/fal';

export type GoogleVertexOmniMediaInput =
  | {
      type: 'image';
      uri: string;
      role?: 'source' | 'reference';
    }
  | {
      type: 'video';
      uri: string;
      role?: 'source';
    };

function cleanUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

export function buildOmniSourceImageInput(falPayload: GeneratePayload): GoogleVertexOmniMediaInput | null {
  const uri = cleanUrl(falPayload.imageUrl);
  return uri ? { type: 'image', uri, role: 'source' } : null;
}

export function buildOmniReferenceImageInputs(falPayload: GeneratePayload): GoogleVertexOmniMediaInput[] {
  return (falPayload.referenceImages ?? [])
    .map(cleanUrl)
    .filter((uri): uri is string => Boolean(uri))
    .map((uri) => ({ type: 'image', uri, role: 'reference' }));
}

export function buildOmniSourceVideoInput(falPayload: GeneratePayload): GoogleVertexOmniMediaInput | null {
  const uri = cleanUrl(falPayload.videoUrl);
  return uri ? { type: 'video', uri, role: 'source' } : null;
}
