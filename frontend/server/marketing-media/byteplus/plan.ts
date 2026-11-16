import type { GeneratedVideoFacts } from '@/lib/generated-video-media-facts';
import { prepareMarketingSnapshot, marketingSourceFingerprint } from '../snapshot';
import type { PreparedMarketingImport } from '../import-copy';
import { BYTEPLUS_MARKETING_SCHEMA, bytePlusMarketingVideoId, type parseBytePlusMarketingImport } from './contract';
import type { BytePlusImportAsset } from './assets';

export type BytePlusImportMeasurements = {
  files: { url: string; sha256: string; sizeBytes: number; mime: string }[];
  video: { width: number; height: number; hasAudio: boolean; mediaFacts: GeneratedVideoFacts };
};
export function prepareBytePlusMarketingCopy(
  parsed: ReturnType<typeof parseBytePlusMarketingImport>, assets: BytePlusImportAsset[], measurements: BytePlusImportMeasurements,
): PreparedMarketingImport {
  const { input, request, receipt, result } = parsed;
  const asset = (id: string) => assets.find(item => item.public_id === id)!;
  const original = asset(input.videoAssetId);
  const prompt = request.content[0].type === 'text' ? request.content[0].text : '';
  const inputs = input.references.map(ref => {
    const item = request.content[ref.contentIndex];
    const role = 'role' in item ? item.role : '';
    const kind = ref.mime.split('/')[0];
    const slotId = role === 'first_frame' ? 'image_url' : role === 'last_frame' ? 'end_image_url'
      : role === 'reference_image' ? 'image_urls' : role === 'reference_audio' ? 'audio_urls'
      : ['v2v','extend'].includes(input.mode) && !input.references.slice(0, ref.contentIndex - 1).some(prior => prior.mime.startsWith('video/'))
        ? 'video_url' : 'video_urls';
    return { slotId, kind, url: asset(ref.assetId).url, type: ref.mime, size: ref.sizeBytes };
  });
  const recipe = { schemaVersion: 1, surface: 'video', engineId: input.engineId, engineLabel: 'Seedance 2.5 Flash',
    inputMode: input.mode, prompt,
    core: { durationSec: request.duration === -1 ? null : request.duration,
      durationOption: request.duration === -1 ? 'auto' : String(request.duration),
      resolution: request.resolution, aspectRatio: request.ratio === 'adaptive' ? 'auto' : request.ratio ?? 'auto',
      audio: request.generate_audio, iterationCount: 1 },
    advanced: { ...(request.seed !== undefined ? { seed: request.seed } : {}), extraInputValues: {
      ...(request.output_format ? { output_format: request.output_format } : {}),
      ...(request.camera_fixed !== undefined ? { camera_fixed: request.camera_fixed } : {}),
    } },
    refs: { inputs },
  };
  const source = { job: {
    job_id: bytePlusMarketingVideoId(input.providerTaskId), user_id: input.ownerUserId,
    engine_id: input.engineId, engine_label: 'Seedance 2.5 Flash', status: 'completed', surface: 'video',
    prompt, settings_snapshot: recipe, created_at: receipt.updatedAt,
    duration_sec: Math.max(1, Math.round(measurements.video.mediaFacts.durationSec)), aspect_ratio: request.ratio ?? 'auto',
    has_audio: measurements.video.hasAudio, visibility: 'private', indexable: false, featured: false, featured_order: 0,
    video_url: original.url, thumb_url: input.poster.assetId ? asset(input.poster.assetId).url : original.thumb_url,
    ...(input.preview ? { preview_video_url: asset(input.preview.assetId).url } : {}),
  }, output: { width: measurements.video.width, height: measurements.video.height } };
  const plan = prepareMarketingSnapshot(source, { requireConsistentMediaKinds: true });
  const files = plan.media.map(media => {
    const expected = measurements.files.find(file => file.url === media.sourceUrl);
    if (!expected || !expected.mime.startsWith(media.kind + '/')) throw new Error('BYTEPLUS_IMPORT_FILE_CLOSURE');
    return { media, expected };
  });
  const sourceRecord = { ...source, schemaVersion: BYTEPLUS_MARKETING_SCHEMA, provider: 'byteplus_modelark',
    ownerUserId: input.ownerUserId, providerTaskId: input.providerTaskId,
    billing: 'external-no-maxvideoai-charge', manifest: input, assets, measurements,
    providerResultSha256: marketingSourceFingerprint(result) };
  return { plan, sourceRecord, files, fingerprint: marketingSourceFingerprint(sourceRecord) };
}
