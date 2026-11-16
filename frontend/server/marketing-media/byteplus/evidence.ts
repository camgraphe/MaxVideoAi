import sharp from 'sharp';
import { openPublicHttpsResponse, headerValue } from '@/server/public-media-transport';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { probeExternalImportVideo } from '@/server/external-fal-import/probe';
import { decodeImageUpload } from '@/server/uploads/store-image-upload';
import { marketingSourceFingerprint } from '../snapshot';
import { byteDigest, type parseBytePlusMarketingImport } from './contract';
import type { BytePlusImportAsset } from './assets';
import type { BytePlusImportMeasurements } from './plan';

/** Fixed origin, exact GET route, no redirect or submission capability. */
export async function recoverBytePlusMarketingTask(taskId: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  if (!/^cgt-[a-zA-Z0-9_-]{1,160}$/.test(taskId)) throw new Error('BYTEPLUS_IMPORT_TASK_ID');
  if (!apiKey.trim()) throw new Error('BYTEPLUS_IMPORT_API_KEY_REQUIRED');
  const url = `https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/${taskId}`;
  const response = await fetcher(url, { method: 'GET', redirect: 'error',
    signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${apiKey}` } });
  if (response.status !== 200 || !response.body || (response.url && response.url !== url)) {
    await response.body?.cancel();
    throw new Error('BYTEPLUS_IMPORT_RECOVERY_FAILED');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error('BYTEPLUS_IMPORT_RECOVERY_TOO_LARGE');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel(); }
}

type Dependencies = {
  apiKey: string; fetcher?: typeof fetch; open?: typeof openPublicHttpsResponse;
  readUrl?: typeof createOwnedMediaReadUrl; probe?: typeof probeExternalImportVideo;
};

/** GET-only evidence check. Owned originals are verified before a marketing copy can be prepared. */
export async function verifyBytePlusMarketingMedia(
  parsed: ReturnType<typeof parseBytePlusMarketingImport>, assets: BytePlusImportAsset[], dependencies: Dependencies,
): Promise<BytePlusImportMeasurements> {
  const { input, request, receipt, result } = parsed;
  const live = await recoverBytePlusMarketingTask(input.providerTaskId, dependencies.apiKey, dependencies.fetcher);
  if (marketingSourceFingerprint(live) !== marketingSourceFingerprint(result)) throw new Error('BYTEPLUS_IMPORT_RESULT_CHANGED');
  const open = dependencies.open ?? openPublicHttpsResponse;
  const readUrl = dependencies.readUrl ?? createOwnedMediaReadUrl;
  const probe = dependencies.probe ?? probeExternalImportVideo;
  const signal = AbortSignal.timeout(180_000);
  let total = 0;
  const read = async (url: string, expected: { sha256: string; sizeBytes: number; mime: string }, owned: boolean) => {
    const grant = owned ? await readUrl({ url, userId: input.ownerUserId }) : url;
    const response = await open(grant, undefined, { redirect: 'error', signal, timeoutMs: 60_000 });
    const chunks: Buffer[] = []; let size = 0;
    const failure = (detail: string) => new Error(`BYTEPLUS_IMPORT_MEDIA_BYTES_${owned ? 'OWNED' : 'PROVIDER'}_${detail}`);
    try {
      const mime = (headerValue(response.headers, 'content-type') ?? '').split(';')[0].trim().toLowerCase();
      const length = headerValue(response.headers, 'content-length');
      if (response.statusCode !== 200) throw failure(`HTTP_${response.statusCode}`);
      if (mime !== expected.mime) throw failure('MIME');
      if (length !== null && Number(length) !== expected.sizeBytes) throw failure('LENGTH');
      for await (const chunk of response.body) {
        signal.throwIfAborted(); size += chunk.byteLength; total += chunk.byteLength;
        if (size > expected.sizeBytes || total > 1024 * 1024 ** 2) throw failure('LIMIT');
        chunks.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(chunks);
      if (size !== expected.sizeBytes || byteDigest(bytes) !== expected.sha256) throw failure('DIGEST');
      return bytes;
    } finally { response.cancel?.(); }
  };
  const asset = (id: string) => assets.find(item => item.public_id === id)!;
  const original = asset(input.videoAssetId);
  const videoFile = { url: original.url, sha256: input.videoSha256, sizeBytes: receipt.output.bytes,
    mime: request.output_format === 'mov' ? 'video/quicktime' : 'video/mp4' };
  if (Number(original.size_bytes) !== videoFile.sizeBytes || original.mime_type !== videoFile.mime)
    throw new Error('BYTEPLUS_IMPORT_ASSET_FACTS');
  await read(result.content.video_url, videoFile, false);
  const videoBytes = await read(original.url, videoFile, true);
  const video = await probe(videoBytes, { url: original.url, sha256: videoFile.sha256, sizeBytes: videoFile.sizeBytes });
  const files = [videoFile];
  const verifyImage = async (bytes: Buffer) => {
    const image = sharp(bytes, { limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) throw new Error('BYTEPLUS_IMPORT_IMAGE');
    await image.raw().toBuffer();
  };
  const posterUrl = input.poster.assetId ? asset(input.poster.assetId).url : original.thumb_url!;
  if (posterUrl === original.url) throw new Error('BYTEPLUS_IMPORT_MEDIA_ROLES');
  const posterBytes = await read(posterUrl, input.poster, true);
  await verifyImage(posterBytes);
  if (input.poster.source) {
    const source = input.poster.source;
    const bytes = Buffer.from(source.data, 'base64');
    if (bytes.toString('base64') !== source.data || bytes.length !== source.sizeBytes || byteDigest(bytes) !== source.sha256)
      throw new Error('BYTEPLUS_IMPORT_POSTER_SOURCE_BYTES');
    const normalized = await decodeImageUpload({ bytes, fileName: 'poster', declaredMime: source.mime });
    if (normalized.mimeType !== input.poster.mime || !normalized.bytes.equals(posterBytes))
      throw new Error('BYTEPLUS_IMPORT_POSTER_SOURCE_NORMALIZATION');
  }
  files.push({ url: posterUrl, sha256: input.poster.sha256, sizeBytes: input.poster.sizeBytes, mime: input.poster.mime });
  if (input.preview) {
    const preview = { ...input.preview, url: asset(input.preview.assetId).url };
    if ([original.url, posterUrl].includes(preview.url)) throw new Error('BYTEPLUS_IMPORT_MEDIA_ROLES');
    const facts = await probe(await read(preview.url, preview, true), preview);
    if (facts.hasAudio || facts.mediaFacts.durationSec > Math.min(6, video.mediaFacts.durationSec + 0.1))
      throw new Error('BYTEPLUS_IMPORT_PREVIEW');
    files.push(preview);
  }
  for (const ref of input.references) {
    const item = request.content[ref.contentIndex];
    const providerUrl = item.type === 'image_url' ? item.image_url.url : item.type === 'video_url' ? item.video_url.url
      : item.type === 'audio_url' ? item.audio_url.url : '';
    const owned = asset(ref.assetId);
    if (Number(owned.size_bytes) !== ref.sizeBytes || owned.mime_type !== ref.mime) throw new Error('BYTEPLUS_IMPORT_ASSET_FACTS');
    await read(providerUrl, ref, providerUrl === owned.url);
    const bytes = await read(owned.url, ref, true);
    if (ref.mime.startsWith('image/')) await verifyImage(bytes);
    if (ref.mime.startsWith('video/')) await probe(bytes, { ...ref, url: owned.url });
    const declared = { url: owned.url, sha256: ref.sha256, sizeBytes: ref.sizeBytes, mime: ref.mime };
    const previous = files.find(file => file.url === declared.url);
    if (previous && marketingSourceFingerprint(previous) !== marketingSourceFingerprint(declared)) throw new Error('BYTEPLUS_IMPORT_MEDIA_ROLES');
    if (!previous) files.push(declared);
  }
  if (files.reduce((sum, file) => sum + file.sizeBytes, 0) > 512 * 1024 ** 2) throw new Error('BYTEPLUS_IMPORT_MEDIA_BYTES');
  return { files, video };
}
