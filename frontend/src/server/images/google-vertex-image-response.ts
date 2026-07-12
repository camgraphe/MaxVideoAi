export type GoogleVertexInlineImage = { data: Buffer; mimeType: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function extractGoogleVertexImages(payload: unknown): GoogleVertexInlineImage[] {
  const root = asRecord(payload);
  const candidates = Array.isArray(root?.candidates) ? root.candidates : [];
  return candidates.flatMap((candidate) => {
    const content = asRecord(asRecord(candidate)?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    return parts.flatMap((part) => {
      const inline = asRecord(asRecord(part)?.inlineData);
      if (!inline) return [];
      const data = typeof inline.data === 'string' ? inline.data : null;
      if (!data) return [];
      const decoded = Buffer.from(data, 'base64');
      return decoded.length ? [{ data: decoded, mimeType: typeof inline.mimeType === 'string' ? inline.mimeType : 'image/png' }] : [];
    });
  });
}

export function parseGoogleVertexResponseId(payload: unknown): string | null {
  const root = asRecord(payload);
  return typeof root?.responseId === 'string' ? root.responseId : null;
}
