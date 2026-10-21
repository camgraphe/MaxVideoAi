import { createHash } from 'node:crypto';
import { z } from 'zod';
import { buildFlux3MaxFalRequest, resolveFlux3MaxEndpoint } from '@/lib/flux-3-max';
import { EXTERNAL_FAL_IMPORT_ORIGIN } from '../app-job-origin';

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const assetId = z.string().regex(/^ma_[a-f0-9]{32}$/);
const url = z.string().url().refine(value => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.hash;
});
const inputSchema = z.object({
  prompt: z.string().min(1).max(20_000), duration: z.number().int().min(5).max(20),
  resolution: z.enum(['720p', '1080p']), aspect_ratio: z.string().min(1),
  generate_audio: z.boolean(), reasoning_level: z.enum(['low', 'high']), seed: z.number().int().safe().optional(),
  image_url: url.optional(), end_image_url: url.optional(),
  keyframes: z.array(z.object({ image_url: url, frame_index: z.number().int().nonnegative() }).strict()).min(1).max(10).optional(),
}).strict();
const schema = z.object({
  schemaVersion: z.literal(1), ownerUserId: z.string().uuid(), engineId: z.literal('flux-3-max'),
  mode: z.enum(['t2v', 'i2v', 'fl2v', 'ref2v']), endpoint: z.string(), providerRequestId: z.string().uuid(),
  providerInput: inputSchema, videoAssetId: assetId, videoSha256: sha, evidenceSha256: sha,
  references: z.array(z.object({ providerUrl: url, assetId, sha256: sha,
    storedRepresentation: z.object({ transform: z.literal('canonical-png-normalization-v1'), sha256: sha }).strict().optional(),
  }).strict()).max(10),
}).strict();
export type ExternalFalImport = z.infer<typeof schema>;

export function canonicalImportJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalImportJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonicalImportJson(v)).join(',') + '}';
  return JSON.stringify(value);
}
export function importDigest(value: unknown): string { return createHash('sha256').update(canonicalImportJson(value)).digest('hex'); }

export function parseExternalFalImport(value: unknown): ExternalFalImport {
  const parsed = schema.parse(value);
  const input = parsed.providerInput;
  if (parsed.endpoint !== resolveFlux3MaxEndpoint(parsed.mode)) throw new Error('IMPORT_ENDPOINT_MODE_MISMATCH');
  const expected = buildFlux3MaxFalRequest({ engineId: parsed.engineId, mode: parsed.mode, prompt: input.prompt,
    durationSec: input.duration, resolution: input.resolution, aspectRatio: input.aspect_ratio, audio: input.generate_audio,
    ...(input.seed === undefined ? {} : { seed: input.seed }), imageUrl: input.image_url, endImageUrl: input.end_image_url,
    referenceImages: input.keyframes?.map(frame => frame.image_url), extraInputValues: {
      reasoning_level: input.reasoning_level, ...(input.keyframes ? { keyframe_indexes: input.keyframes.map(frame => frame.frame_index).join(',') } : {}),
    } });
  if (canonicalImportJson(expected.requestBody) !== canonicalImportJson(input)) throw new Error('IMPORT_INPUT_NOT_CANONICAL');
  const referenceUrls = input.keyframes?.map(frame => frame.image_url) ?? [input.image_url, input.end_image_url].filter((value): value is string => Boolean(value));
  if (canonicalImportJson(referenceUrls) !== canonicalImportJson(parsed.references.map(ref => ref.providerUrl))) throw new Error('IMPORT_REFERENCE_MAPPING_MISMATCH');
  return parsed;
}

export function externalFalImportPlan(value: unknown) {
  const input = parseExternalFalImport(value);
  return { schemaVersion: 1, origin: EXTERNAL_FAL_IMPORT_ORIGIN, jobId: `job_external_fal_${importDigest({ provider: 'fal', requestId: input.providerRequestId }).slice(0, 40)}`,
    manifestSha256: importDigest(input), ownerUserId: input.ownerUserId, providerRequestId: input.providerRequestId,
    videoAssetId: input.videoAssetId, visibility: 'private', indexable: false, financialWrites: 0, timingSamples: 0 } as const;
}
