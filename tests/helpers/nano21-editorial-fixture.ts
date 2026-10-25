import { createHash } from 'node:crypto';

/** Synthetic test record only. These URLs are never published or fetched. */
export function nano21EditorialFixture() {
  const prompt = 'Synthetic fixture: a copper lamp on a blue desk, wide cinematic composition.';
  const sha = (value: string) => createHash('sha256').update(value).digest('hex');
  const image = { url: 'https://media.maxvideoai.com/editorial/synthetic-nano21-fixture.png',
    sha256: sha('synthetic-image-bytes'), width: 1024, height: 576, mimeType: 'image/png' as const };
  return { id: 'nano21-synthetic-fixture', status: 'accepted' as const, engineId: 'nano-banana-2-1' as const,
    modelId: 'gemini-nano-banana-2.1' as const, version: '2.1' as const, mode: 't2i' as const,
    promptLanguage: 'en' as const, prompt,
    settings: { resolution: '1k' as const, aspectRatio: '16:9' as const, thinkingLevel: 'medium' as const,
      candidateCount: 1 as const, numImages: 1 as const, maxOutputTokens: 4096 as const,
      enableWebSearch: false as const, enableImageSearch: false as const },
    references: [] as [], provenance: { kind: 'external_vertex' as const, location: 'global' as const,
      generatedAt: '2026-10-25T12:00:00Z', acceptedAt: '2026-10-25T13:00:00Z',
      promptSha256: sha(prompt), responseSha256: sha('synthetic-native-response') },
    media: { original: image, display: { ...image, sourceSha256: image.sha256 } }, placement: 'hero' as const };
}
