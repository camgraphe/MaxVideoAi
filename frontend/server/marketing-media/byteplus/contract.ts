import { createHash } from 'node:crypto';
import { z } from 'zod';
import { BYTEPLUS_MARKETING_SCHEMA, marketingSourceFingerprint } from '../snapshot';

export { BYTEPLUS_MARKETING_SCHEMA } from '../snapshot';
export const byteDigest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const assetId = z.string().regex(/^ma_[a-zA-Z0-9_-]{1,128}$/);
const file = z.object({ utf8: z.string().min(1).max(512 * 1024), sha256: hash }).strict();
const descriptor = z.object({ sha256: hash, sizeBytes: z.number().int().positive().max(256 * 1024 ** 2),
  mime: z.string().regex(/^(image\/(png|jpeg|webp)|video\/(mp4|quicktime|webm)|audio\/(mpeg|wav|x-wav|mp4|ogg))$/) }).strict();
const inputSchema = z.object({
  schemaVersion: z.literal(BYTEPLUS_MARKETING_SCHEMA), ownerUserId: z.string().uuid(),
  engineId: z.literal('seedance-2-5-flash'), mode: z.enum(['t2v', 'i2v', 'ref2v', 'v2v', 'extend']),
  providerTaskId: z.string().regex(/^cgt-[a-zA-Z0-9_-]{1,160}$/), videoAssetId: assetId, videoSha256: hash,
  poster: descriptor.extend({ assetId: assetId.optional(), source: z.object({
    encoding: z.literal('base64'), data: z.string().min(4).max(1024 * 1024), sha256: hash,
    sizeBytes: z.number().int().positive().max(768 * 1024), mime: z.enum(['image/png','image/jpeg','image/webp']),
    transform: z.literal('canonical-image-upload-v1'),
  }).strict().optional() }).strict(),
  preview: descriptor.extend({ assetId }).strict().optional(),
  references: z.array(descriptor.extend({ contentIndex: z.number().int().min(1).max(20), assetId }).strict()).max(20),
  evidence: z.object({ request: file, receipt: file, journal: file }).strict(),
}).strict();
const httpsUrl = z.string().max(8192).url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.port;
});
const requestSchema = z.object({
  model: z.literal('dreamina-seedance-2-5-flash-261115'),
  content: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text: z.string().min(1).max(20000) }).strict(),
    z.object({ type: z.literal('image_url'), image_url: z.object({ url: httpsUrl }).strict(), role: z.enum(['first_frame', 'last_frame', 'reference_image']) }).strict(),
    z.object({ type: z.literal('video_url'), video_url: z.object({ url: httpsUrl }).strict(), role: z.literal('reference_video') }).strict(),
    z.object({ type: z.literal('audio_url'), audio_url: z.object({ url: httpsUrl }).strict(), role: z.literal('reference_audio') }).strict(),
  ])).min(1).max(21),
  resolution: z.enum(['480p', '720p']), ratio: z.enum(['adaptive', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']).optional(),
  duration: z.union([z.literal(-1), z.number().int().min(4).max(30)]), generate_audio: z.boolean(),
  watermark: z.literal(false), output_format: z.enum(['mp4', 'mov']).optional(),
  camera_fixed: z.boolean().optional(), seed: z.number().int().min(-1).max(4294967295).optional(),
  omni_reference_task_type: z.enum(['reference', 'edit', 'extend']).optional(),
}).strict();
const resultSchema = z.object({ id: z.string(), model: z.string(), status: z.literal('succeeded'),
  content: z.object({ video_url: httpsUrl }).passthrough(), seed: z.number().optional(),
}).passthrough();
const receiptSchema = z.object({ engineId: z.string(), modelId: z.string(), provider: z.literal('byteplus_modelark'),
  intendedAccountId: z.string().uuid(), nativeAppJobId: z.null(), phase: z.literal('completed'),
  startedAt: z.string().datetime(), updatedAt: z.string().datetime(), requestSha256: hash,
  task: z.object({ providerJobId: z.string(), status: z.literal('completed'), rawStatus: z.literal('succeeded'),
    videoUrl: httpsUrl, raw: resultSchema }).passthrough(),
  output: z.object({ sha256: hash, bytes: z.number().int().positive().max(256 * 1024 ** 2) }).passthrough(),
}).passthrough();
export type BytePlusMarketingInput = z.infer<typeof inputSchema>;
export type BytePlusMarketingRequest = z.infer<typeof requestSchema>;

/** The original files remain private and byte-identical. This performs no I/O. */
export function parseBytePlusMarketingImport(value: unknown) {
  try {
    const input = inputSchema.parse(value);
    for (const file of Object.values(input.evidence)) if (byteDigest(file.utf8) !== file.sha256) throw new Error();
    const request = requestSchema.parse(JSON.parse(input.evidence.request.utf8));
    const receipt = receiptSchema.parse(JSON.parse(input.evidence.receipt.utf8));
    const result = receipt.task.raw;
    if (receipt.engineId !== input.engineId || receipt.modelId !== request.model || result.model !== request.model
      || receipt.intendedAccountId !== input.ownerUserId || receipt.requestSha256 !== input.evidence.request.sha256
      || receipt.task.providerJobId !== input.providerTaskId || result.id !== input.providerTaskId
      || receipt.task.videoUrl !== result.content.video_url || receipt.output.sha256 !== input.videoSha256) throw new Error();
    const events = input.evidence.journal.utf8.trim().split('\n').map(line => JSON.parse(line));
    const starts = events.filter(event => event.event === 'submission_started');
    const responses = events.filter(event => event.event === 'provider_response');
    if (starts.length !== 1 || starts[0].requestSha256 !== receipt.requestSha256
      || responses.some(event => event.status !== 200)) throw new Error();
    const bodies = responses.map(event => JSON.parse(event.body));
    if (bodies.some(body => body.id !== input.providerTaskId || body.error)) throw new Error();
    const accepted = bodies.filter(body => body.status === undefined);
    const completed = bodies.filter(body => body.status === 'succeeded');
    if (accepted.length !== 1 || !completed.length || bodies[0] !== accepted[0]
      || completed.some(body => marketingSourceFingerprint(body) !== marketingSourceFingerprint(result))) throw new Error();
    const times = events.map(event => Date.parse(event.at));
    if (events[0] !== starts[0] || times.some((time, index) => !Number.isFinite(time) || (index > 0 && time < times[index - 1]))
      || Math.abs(times[0] - Date.parse(receipt.startedAt)) > 1000
      || Date.parse(receipt.updatedAt) < times[times.length - 1]) throw new Error();
    const references = request.content.slice(1);
    if (request.content[0].type !== 'text' || references.some(item => item.type === 'text')
      || input.references.length !== references.length
      || input.references.some((ref, index) => ref.contentIndex !== index + 1
        || !ref.mime.startsWith(references[index].type.split('_')[0] + '/'))) throw new Error();
    const roles = references.map(item => 'role' in item ? item.role : '');
    const inferred = request.omni_reference_task_type === 'edit' ? 'v2v'
      : request.omni_reference_task_type === 'extend' ? 'extend'
      : roles.includes('first_frame') ? 'i2v' : roles.length ? 'ref2v' : 't2v';
    if (input.mode !== inferred || (inferred === 'i2v' && (roles[0] !== 'first_frame' || roles.length > 2
      || (roles.length === 2 && roles[1] !== 'last_frame')))
      || (inferred !== 'i2v' && roles.some(role => role === 'first_frame' || role === 'last_frame'))
      || (['v2v', 'extend'].includes(inferred) && (!roles.includes('reference_video') || request.ratio !== 'adaptive'))
      || (inferred === 'v2v' && request.duration !== -1)
      || roles.filter(role => role === 'reference_image').length > 10
      || roles.filter(role => role === 'reference_video').length > 5
      || roles.filter(role => role === 'reference_audio').length > 5
      || !input.poster.mime.startsWith('image/') || (input.preview && !input.preview.mime.startsWith('video/'))) throw new Error();
    return { input, request, receipt, result };
  } catch { throw new Error('BYTEPLUS_IMPORT_INVALID_EVIDENCE_OR_MANIFEST'); }
}

export const bytePlusMarketingVideoId = (taskId: string) => `mbp_${byteDigest('byteplus_modelark:' + taskId)}`;
