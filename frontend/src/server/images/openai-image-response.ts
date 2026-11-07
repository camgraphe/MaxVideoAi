const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
export type OpenAIInlineImage = { data: Buffer; mimeType: string; index: number };

function rasterMime(data: Buffer): string | null {
  if (data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
export function extractOpenAIImages(payload: unknown, outputFormat: string, expectedCount: number): { images: OpenAIInlineImage[]; complete: boolean } {
  const root = record(payload);
  if (!root || (root.output_format !== undefined && root.output_format !== outputFormat) || !Array.isArray(root.data)) return { images: [], complete: false };
  const images: OpenAIInlineImage[] = [];
  // A malformed response cannot expand the provider's ten-image envelope.
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 1 || expectedCount > 10) return {images, complete: false};
  for (const [index, item] of root.data.slice(0, expectedCount).entries()) {
    const encoded = record(item)?.b64_json;
    if (typeof encoded !== 'string' || encoded.length > 70_000_000 || encoded.length % 4 || /[^A-Za-z0-9+/=]/u.test(encoded)) continue;
    const data = Buffer.from(encoded, 'base64');
    if (data.toString('base64') !== encoded) continue;
    const mimeType = rasterMime(data);
    if (data.length && mimeType === `image/${outputFormat}`) images.push({ data, mimeType, index });
  }
  return { images, complete: root.data.length === expectedCount && images.length === expectedCount };
}

export function parseOpenAIImageUsage(payload: unknown) {
  const usage = record(record(payload)?.usage), input = record(usage?.input_tokens_details);
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  if (!usage || !input || !valid(usage.input_tokens) || !valid(input.text_tokens) || !valid(input.image_tokens) || !valid(usage.output_tokens) || !valid(usage.total_tokens)
    || input.text_tokens + input.image_tokens !== usage.input_tokens || usage.total_tokens !== usage.input_tokens + usage.output_tokens) return null;
  // List-rate ceiling; cached tokens can reduce the invoice. No guessed cache split.
  return { inputTextTokens: input.text_tokens, inputImageTokens: input.image_tokens, outputTokens: usage.output_tokens, totalTokens: usage.total_tokens,
    listEstimateUsd: Number(((input.text_tokens * 5 + input.image_tokens * 8 + usage.output_tokens * 30) / 1_000_000).toFixed(10)),
    invoiceCostUsd: null, source: 'openai-images-usage', ratesCheckedAt: '2026-11-05', cachedDiscountIncluded: false };
}
