import type {
  CharacterReferenceSelection,
  GeneratedImage,
} from '@/types/image-generation';

export function normalizeProviderImageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://fal.media/files/${trimmed.replace(/^\.?\/+/, '')}`;
}

export function sanitizeCharacterReferences(value: unknown): CharacterReferenceSelection[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<CharacterReferenceSelection[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const jobId = typeof record.jobId === 'string' ? record.jobId.trim() : '';
    const imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
    if (!id || !jobId || !/^https?:\/\//i.test(imageUrl)) return acc;

    acc.push({
      id,
      jobId,
      imageUrl,
      thumbUrl:
        typeof record.thumbUrl === 'string' && /^https?:\/\//i.test(record.thumbUrl.trim())
          ? record.thumbUrl.trim()
          : null,
      prompt: typeof record.prompt === 'string' && record.prompt.trim().length ? record.prompt.trim() : null,
      createdAt: typeof record.createdAt === 'string' && record.createdAt.trim().length ? record.createdAt.trim() : null,
      engineLabel:
        typeof record.engineLabel === 'string' && record.engineLabel.trim().length ? record.engineLabel.trim() : null,
      outputMode:
        record.outputMode === 'portrait-reference' || record.outputMode === 'character-sheet'
          ? record.outputMode
          : null,
      action:
        record.action === 'generate' || record.action === 'full-body-fix' || record.action === 'lighting-variant'
          ? record.action
          : null,
    });
    return acc;
  }, []);
}

export function buildCharacterReferencePrompt(prompt: string, characterReferences: CharacterReferenceSelection[]): string {
  if (!characterReferences.length) return prompt;

  const instruction =
    characterReferences.length === 1
      ? 'Use the selected character reference as the primary identity anchor. Preserve face, hairstyle, body proportions, and distinctive character cues unless the prompt explicitly requests a change.'
      : 'Treat the selected character references as distinct character identities. Preserve each separately, match cast order to selection order, and do not merge identities. If the user prompt implies fewer characters than selected, prioritize them in selection order.';

  return `${prompt}\n\nCharacter reference instructions:\n${instruction}`;
}

export function extractImages(payload: unknown): GeneratedImage[] {
  const roots: unknown[] = [];
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    roots.push(record);
    if (record.output && typeof record.output === 'object') roots.push(record.output);
    if (record.response && typeof record.response === 'object') roots.push(record.response);
    if (record.data && typeof record.data === 'object') roots.push(record.data);
  }

  for (const root of roots) {
    if (!root || typeof root !== 'object') continue;
    const imagesCandidate = (root as { images?: unknown }).images;
    if (!Array.isArray(imagesCandidate)) continue;

    const mapped = imagesCandidate.reduce<GeneratedImage[]>((acc, entry) => {
      if (!entry || typeof entry !== 'object') return acc;
      const record = entry as Record<string, unknown>;
      const urlRaw = typeof record.url === 'string' ? record.url : null;
      if (!urlRaw) return acc;

      acc.push({
        url: normalizeProviderImageUrl(urlRaw),
        width: typeof record.width === 'number' ? record.width : null,
        height: typeof record.height === 'number' ? record.height : null,
        mimeType:
          typeof record.content_type === 'string'
            ? record.content_type
            : typeof record.mimetype === 'string'
              ? record.mimetype
              : null,
      });
      return acc;
    }, []);

    if (mapped.length) {
      return mapped;
    }
  }

  return [];
}

export function parseRequestId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.request_id === 'string') return record.request_id;
  if (typeof record.id === 'string') return record.id;
  if (record.response && typeof record.response === 'object') {
    const responseRecord = record.response as Record<string, unknown>;
    if (typeof responseRecord.request_id === 'string') return responseRecord.request_id;
    if (typeof responseRecord.id === 'string') return responseRecord.id;
  }
  if (record.output && typeof record.output === 'object') {
    const outputRecord = record.output as Record<string, unknown>;
    if (typeof outputRecord.request_id === 'string') return outputRecord.request_id;
    if (typeof outputRecord.id === 'string') return outputRecord.id;
  }
  return undefined;
}
