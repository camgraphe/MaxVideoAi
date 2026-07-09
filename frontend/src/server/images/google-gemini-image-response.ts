export type GoogleGeminiInlineImage = {
  data: Buffer;
  mimeType: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function decodeImage(record: Record<string, unknown>): GoogleGeminiInlineImage | null {
  const data = typeof record.data === 'string' && record.data.trim().length ? record.data.trim() : null;
  if (!data) return null;
  const mimeType =
    typeof record.mime_type === 'string' && record.mime_type.trim().length
      ? record.mime_type.trim()
      : typeof record.mimeType === 'string' && record.mimeType.trim().length
        ? record.mimeType.trim()
        : 'image/png';
  return {
    data: Buffer.from(data, 'base64'),
    mimeType,
  };
}

function extractFromBlocks(value: unknown): GoogleGeminiInlineImage[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<GoogleGeminiInlineImage[]>((acc, block) => {
    const record = asRecord(block);
    if (!record || record.type !== 'image') return acc;
    const image = decodeImage(record);
    if (image && image.data.length) acc.push(image);
    return acc;
  }, []);
}

export function extractGoogleGeminiImages(payload: unknown): GoogleGeminiInlineImage[] {
  const root = asRecord(payload);
  if (!root) return [];

  const directImage = asRecord(root.output_image);
  if (directImage) {
    const image = decodeImage(directImage);
    if (image && image.data.length) return [image];
  }

  const steps = Array.isArray(root.steps) ? root.steps : [];
  const modelOutputImages = steps.flatMap((step) => {
    const record = asRecord(step);
    if (!record || record.type !== 'model_output') return [];
    return extractFromBlocks(record.content);
  });
  if (modelOutputImages.length) return modelOutputImages;

  return extractFromBlocks(root.output).concat(extractFromBlocks(root.outputs));
}

export function parseGoogleGeminiRequestId(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;
  for (const key of ['id', 'name']) {
    const value = root[key];
    if (typeof value === 'string' && value.trim().length) return value.trim();
  }
  return null;
}
