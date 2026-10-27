import { z } from 'zod';
import { getKlingV4ConstraintViolation, KLING_V4_ENDPOINTS } from '@/lib/kling-v4';

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const assetId = z.string().regex(/^ma_[a-f0-9]{32}$/);
const url = z.string().url().refine(value => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.hash;
});
const durableUrl = url.refine(value => { const parsed = new URL(value); return parsed.hostname === 'media.maxvideoai.com' && !parsed.search; });
const element = z.object({ frontal_image_url: url.nullish(), reference_image_urls: z.array(url).nullish(),
  video_url: url.nullish(), voice_id: z.string().nullish() }).strict();
const input = z.object({ prompt: z.string().nullish(), multi_prompt: z.array(z.object({ prompt: z.string(), duration: z.number().optional() }).strict()).nullish(),
  duration: z.number().int().nullable().optional(), resolution: z.enum(['720p', '1080p']).optional(), aspect_ratio: z.string().optional(),
  start_image_url: url.nullish(), end_image_url: url.nullish(), image_urls: z.array(url).nullish(), video_urls: z.array(url).nullish(),
  video_url: url.optional(), elements: z.array(element).nullish() }).strict();
const mediaRole = z.object({ url: durableUrl, sha256: sha }).strict();
const schema = z.object({ schemaVersion: z.literal(1), ownerUserId: z.string().uuid(), engineId: z.literal('kling-v4'),
  mode: z.enum(['t2v', 'i2v', 'ref2v', 'v2v']), endpoint: z.string(), providerRequestId: z.string().uuid(), providerInput: input,
  videoAssetId: assetId, videoSha256: sha, evidenceSha256: sha,
  media: z.object({ poster: mediaRole, preview: mediaRole }).strict(),
  references: z.array(z.object({ providerUrl: url, assetId, sha256: sha, kind: z.enum(['image', 'video']), slotId: z.string(),
    storedRepresentation: z.object({ transform: z.literal('canonical-png-normalization-v1'), sha256: sha }).strict().optional(),
  }).strict()).max(50),
}).strict();
export type KlingV4ExternalFalImport = z.infer<typeof schema>;

/** Normalize documented defaults for validation/reuse only; never rewrite the accepted journal. */
function effectiveProviderInput(input: KlingV4ExternalFalImport): KlingV4ExternalFalImport['providerInput'] {
  const nullable = new Set({
    t2v: ['prompt', 'multi_prompt'], i2v: ['prompt', 'multi_prompt', 'end_image_url'],
    ref2v: ['prompt', 'multi_prompt', 'start_image_url', 'image_urls', 'video_urls', 'elements'],
    v2v: ['duration', 'image_urls', 'elements'],
  }[input.mode]);
  const provider = Object.fromEntries(Object.entries(input.providerInput).filter(([key, value]) => value !== null || !nullable.has(key))) as KlingV4ExternalFalImport['providerInput'];
  return { ...provider,
    ...(provider.duration === undefined && input.mode !== 'v2v' ? { duration: 5 } : {}),
    ...(provider.multi_prompt ? { multi_prompt: provider.multi_prompt.map(shot => ({ ...shot, duration: shot.duration ?? 5 })) } : {}),
    ...(input.mode === 'ref2v' && provider.elements ? { elements: provider.elements.map(subject =>
      Object.fromEntries(Object.entries(subject).filter(([, value]) => value !== null))) } : {}),
  };
}

/** Traversal order is explicit, including every view of every authored subject. */
export function klingV4ReferenceSlots(provider: KlingV4ExternalFalImport['providerInput']) {
  const refs: { slotId: string; kind: 'image' | 'video'; providerUrl: string }[] = [];
  const add = (slotId: string, kind: 'image' | 'video', providerUrl?: string | null) => { if (providerUrl) refs.push({ slotId, kind, providerUrl }); };
  add('start_image_url', 'image', provider.start_image_url); add('end_image_url', 'image', provider.end_image_url);
  add('video_url', 'video', provider.video_url);
  provider.image_urls?.forEach((value, index) => add(`image_urls.${index}`, 'image', value));
  provider.video_urls?.forEach((value, index) => add(`video_urls.${index}`, 'video', value));
  provider.elements?.forEach((value, index) => {
    add(`elements.${index}.frontal_image_url`, 'image', value.frontal_image_url);
    value.reference_image_urls?.forEach((image, view) => add(`elements.${index}.reference_image_urls.${view}`, 'image', image));
    add(`elements.${index}.video_url`, 'video', value.video_url);
  });
  return refs;
}

export function parseKlingV4ExternalFalImport(value: unknown): KlingV4ExternalFalImport {
  const parsed = schema.parse(value);
  if (parsed.endpoint !== KLING_V4_ENDPOINTS[parsed.mode]) throw new Error('IMPORT_ENDPOINT_MODE_MISMATCH');
  const violation = getKlingV4ConstraintViolation(parsed.mode, effectiveProviderInput(parsed));
  if (violation) throw new Error('IMPORT_KLING_INPUT_INVALID:' + violation.message);
  // This importer has no authority to certify a raw provider voice ID as account-owned.
  if (parsed.providerInput.elements?.some(item => item.voice_id)) throw new Error('IMPORT_KLING_OWNED_VOICE_EVIDENCE_REQUIRED');
  const slots = klingV4ReferenceSlots(parsed.providerInput);
  if (JSON.stringify(slots) !== JSON.stringify(parsed.references.map(({ slotId, kind, providerUrl }) => ({ slotId, kind, providerUrl })))) {
    throw new Error('IMPORT_REFERENCE_MAPPING_MISMATCH');
  }
  if (parsed.references.some(ref => ref.kind !== 'image' && ref.storedRepresentation)) throw new Error('IMPORT_REFERENCE_TRANSFORM_KIND');
  if (parsed.media.poster.url === parsed.media.preview.url) throw new Error('IMPORT_MEDIA_ROLES_MUST_DIFFER');
  return parsed;
}

/** Reuse uses owned originals; the immutable externalImport keeps the historical provider URLs. */
export function klingV4ImportSettings(input: KlingV4ExternalFalImport, assets: { public_id: string; url: string; mime_type: string | null; size_bytes: number | string | null }[]) {
  const provider = effectiveProviderInput(input);
  const ref = (slotId: string) => {
    const mapping = input.references.find(item => item.slotId === slotId);
    return mapping ? assets.find(asset => asset.public_id === mapping.assetId)! : undefined;
  };
  const images = provider.image_urls?.map((_, index) => ref(`image_urls.${index}`)!.url);
  const videos = provider.video_urls?.map((_, index) => ref(`video_urls.${index}`)!.url);
  const durationSec = provider.duration ?? (input.mode === 'v2v' ? null : 5);
  return {
    prompt: provider.prompt ?? '', negativePrompt: null,
    core: { durationSec, durationOption: durationSec === null ? null : String(durationSec),
      resolution: provider.resolution ?? '1080p', aspectRatio: provider.aspect_ratio ?? (['t2v', 'ref2v'].includes(input.mode) ? '16:9' : null), audio: null, fps: null, iterationCount: 1, numFrames: null },
    advanced: { seed: null, multiPrompt: provider.multi_prompt ?? null, extraInputValues: null },
    refs: { imageUrl: ref('start_image_url')?.url ?? null, endImageUrl: ref('end_image_url')?.url ?? null,
      referenceImages: images ?? null, videoUrls: videos ?? (ref('video_url') ? [ref('video_url')!.url] : null),
      elements: provider.elements?.map((element, index) => ({
        ...(element.frontal_image_url ? { frontalImageUrl: ref(`elements.${index}.frontal_image_url`)!.url,
          frontalAssetId: ref(`elements.${index}.frontal_image_url`)!.public_id } : {}),
        ...(element.reference_image_urls ? { referenceImageUrls: element.reference_image_urls.map((_, view) => ref(`elements.${index}.reference_image_urls.${view}`)!.url),
          referenceAssetIds: element.reference_image_urls.map((_, view) => ref(`elements.${index}.reference_image_urls.${view}`)!.public_id) } : {}),
        ...(element.video_url ? { videoUrl: ref(`elements.${index}.video_url`)!.url, videoAssetId: ref(`elements.${index}.video_url`)!.public_id } : {}),
      })) ?? null,
      inputs: input.references.filter(item => !item.slotId.startsWith('elements.')).map(item => {
        const asset = assets.find(candidate => candidate.public_id === item.assetId)!;
        return { slotId: item.slotId === 'start_image_url' ? 'image_url' : item.slotId.replace(/\.\d+$/u, ''), kind: item.kind, url: asset.url, assetId: item.assetId,
          name: item.slotId, type: asset.mime_type ?? `${item.kind}/*`, size: Number(asset.size_bytes) };
      }),
    },
  };
}
