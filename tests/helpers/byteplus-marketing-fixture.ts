import { createHash } from 'node:crypto';

export const ownerId = '11111111-1111-4111-8111-111111111111';
export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const evidenceFile = (value: unknown) => {
  const utf8 = JSON.stringify(value) + '\n';
  return { utf8, sha256: digest(utf8) };
};
export function byteplusFixture(mode = 't2v') {
  const taskId = 'cgt-20261116000000-fixture';
  const original = Buffer.from('fixture-original');
  const request: Record<string, any> = {
    model: 'dreamina-seedance-2-5-flash-261115',
    content: [{ type: 'text', text: 'A cup on a table.' }],
    resolution: '720p', ratio: '16:9', duration: 8, generate_audio: true,
    watermark: false, output_format: 'mp4',
  };
  if (mode === 'i2v') request.content.push({ type: 'image_url', role: 'first_frame', image_url: { url: 'https://media.example.com/start.png' } });
  if (mode === 'ref2v') request.content.push({ type: 'audio_url', role: 'reference_audio', audio_url: { url: 'https://media.example.com/ref.wav' } });
  if (mode === 'v2v' || mode === 'extend') {
    request.content.push({ type: 'video_url', role: 'reference_video', video_url: { url: 'https://media.example.com/input.mp4' } });
    request.omni_reference_task_type = mode === 'v2v' ? 'edit' : 'extend';
    request.ratio = 'adaptive';
    if (mode === 'v2v') request.duration = -1;
  }
  const requestFile = evidenceFile(request);
  const raw = { id: taskId, model: request.model, status: 'succeeded',
    content: { video_url: 'https://ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com/output.mp4' },
    created_at: 1794787200, updated_at: 1794787260, seed: 123, resolution: '720p', ratio: '16:9', duration: 8, generate_audio: true };
  const journalUtf8 = [
    { at: '2026-11-16T00:00:00.000Z', event: 'submission_started', requestSha256: requestFile.sha256 },
    { at: '2026-11-16T00:00:01.000Z', event: 'provider_response', status: 200, body: JSON.stringify({ id: taskId }) },
    { at: '2026-11-16T00:01:00.000Z', event: 'provider_response', status: 200, body: JSON.stringify(raw) },
  ].map(value => JSON.stringify(value)).join('\n') + '\n';
  return {
    schemaVersion: 'maxvideoai-byteplus-marketing/v1', ownerUserId: ownerId,
    engineId: 'seedance-2-5-flash', mode, providerTaskId: taskId,
    videoAssetId: 'ma_video', videoSha256: digest(original),
    poster: { sha256: digest('poster'), sizeBytes: 6, mime: 'image/webp' },
    references: request.content.slice(1).map((item: any, index: number) => ({ contentIndex: index + 1,
      assetId: 'ma_ref_' + index, sha256: digest('reference'), sizeBytes: 9,
      mime: item.type === 'image_url' ? 'image/png' : item.type === 'video_url' ? 'video/mp4' : 'audio/wav' })),
    evidence: { request: requestFile, journal: { utf8: journalUtf8, sha256: digest(journalUtf8) },
      receipt: evidenceFile({ engineId: 'seedance-2-5-flash', modelId: request.model, provider: 'byteplus_modelark',
        intendedAccountId: ownerId, nativeAppJobId: null, phase: 'completed', requestSha256: requestFile.sha256,
        startedAt: '2026-11-16T00:00:00.000Z', updatedAt: '2026-11-16T00:01:00.000Z',
        task: { providerJobId: taskId, status: 'completed', rawStatus: 'succeeded', videoUrl: raw.content.video_url, raw },
        output: { sha256: digest(original), bytes: original.length } }) },
  };
}
