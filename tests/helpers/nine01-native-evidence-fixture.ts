import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

export const fixtureSha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable((value as Record<string, unknown>)[key])])) : value;
const canonical = (value: unknown) => JSON.stringify(stable(value));
export const NINE_SCENES = ['K4-JANITOR-US', 'K4-CONCERT', 'K4-NEXT-ONE', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09'];
export const SOURCE_TIME = Date.parse('2026-10-26T02:00:00Z');
export const RECOVERY_TIME = Date.parse('2026-10-28T12:00:00Z');
export const SOURCE_TARGET = { bucket: 'test-private-bucket', region: 'eu-west-3' };

export function signedFixtureUrl(key: string, at = SOURCE_TIME, ttl = 86400) {
  const date = new Date(at).toISOString().replace(/[-:]/g, '').replace('.000', '');
  const query = new URLSearchParams({ 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `ABCDEFGHIJKLMNOPQRST/${date.slice(0, 8)}/${SOURCE_TARGET.region}/s3/aws4_request`,
    'X-Amz-Date': date, 'X-Amz-Expires': String(ttl), 'X-Amz-Signature': 'a'.repeat(64),
    'X-Amz-SignedHeaders': 'host', 'x-amz-checksum-mode': 'ENABLED', 'x-id': 'GetObject' });
  return `https://${SOURCE_TARGET.bucket}.s3.${SOURCE_TARGET.region}.amazonaws.com/${key}?${query}`;
}

/** Anonymized native shapes, real private files and real media; no production identifiers or network. */
export async function nine01Fixture(options: { optional?: boolean; submittedAtMs?: number } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'nine01-native-'));
  const files: Record<string, { path: string; sha256: string }> = {};
  const write = async (name: string, data: unknown) => {
    const bytes = Buffer.from(JSON.stringify(data));
    const filename = path.join(dir, `${name}.json`);
    await writeFile(filename, bytes, { mode: 0o600 });
    files[name] = { path: filename, sha256: fixtureSha(bytes) };
    return filename;
  };
  const owner = '11111111-1111-4111-8111-111111111111';
  const requestId = options.optional ? '33333333-3333-4333-8333-333333333333' : '22222222-2222-4222-8222-222222222222';
  const dependencyScene = options.optional ? 'K4-JANITOR-US-OPTION-01' : NINE_SCENES[0];
  const stagingScenes = options.optional ? [...NINE_SCENES, dependencyScene] : NINE_SCENES;
  const endpoint = 'kling/v4/reference-to-video';
  const resultUrl = `https://queue.fal.run/kling/v4/requests/${requestId}`;
  const statusUrl = resultUrl + '/status';
  const original = await readFile('tests/fixtures/studio-media/pattern-a.mp4');
  const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#123456' } }).png().toBuffer();
  const poster = await sharp(image).webp().toBuffer();
  const preview = execFileSync('ffmpeg', ['-v', 'error', '-i', 'tests/fixtures/studio-media/pattern-a.mp4', '-t', '2', '-an',
    '-c:v', 'copy', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov', 'pipe:1']);
  const imagePath = path.join(dir, 'image.png');
  await writeFile(imagePath, image, { mode: 0o600 });
  const nativeImagePath = await write('nativeImage', { candidates: [] });
  const referenceIds = Array.from({ length: 14 }, (_, i) => `REF${String(i + 1).padStart(2, '0')}`);
  const dependencies = [[0, 1], [2, 3], [4, 5], [6], [7], [8, 9], [10], [11], [12, 13]];
  const references = referenceIds.map(id => ({ id, role: 'character',
    key: `editorial/drafts/launch-media/nine-01/${'a'.repeat(32)}/${id}-${fixtureSha(image)}.png`,
    sourcePath: imagePath, sha256: fixtureSha(image), size: image.length, mime: 'image/png', width: 32, height: 32,
    disposition: 'create', provenance: { provider: 'vertex', model: 'gemini-nano-banana-2.1',
      nativeResponsePath: nativeImagePath, nativeResponseSha256: files.nativeImage.sha256, promptSha256: 'b'.repeat(64) } }));
  const targetFingerprintSha256 = fixtureSha(JSON.stringify([SOURCE_TARGET.bucket, SOURCE_TARGET.region]));
  const manifest = { schemaVersion: 1, batchId: 'nine-01', ownerId: owner, ownerToken: 'a'.repeat(32), targetFingerprintSha256,
    references, dependencies: stagingScenes.map((sceneId, i) => ({ sceneId, referenceIds: dependencies[i] ? dependencies[i].map(n => referenceIds[n]) : referenceIds.slice(0, 2) })) };
  const manifestPath = await write('stagingManifest', manifest);
  const manifestSha256 = fixtureSha(JSON.stringify(manifest));
  const grants = references.slice(0, 2).map(ref => ({ referenceId: ref.id, method: 'GET', key: ref.key,
    url: signedFixtureUrl(ref.key), issuedAt: new Date(SOURCE_TIME).toISOString(), expiresAt: new Date(SOURCE_TIME + 86400000).toISOString() }));
  const state = { schemaVersion: 1, manifestSha256, objects: Object.fromEntries(referenceIds.map(id => [id, { status: 'created' }])),
    jobs: Object.fromEntries(stagingScenes.map(sceneId => [sceneId, { status: 'succeeded', review: 'pending', requestId,
      grants: sceneId === dependencyScene ? grants.map(({ referenceId, url, issuedAt, expiresAt }) =>
        ({ referenceId, urlSha256: fixtureSha(url), issuedAt, expiresAt })) : [] }])) };
  const statePath = await write('stagingState', state);
  const registration = { account: 'Camgraph', ownerId: owner, ownerToken: manifest.ownerToken, batchId: 'nine-01',
    targetFingerprintSha256, manifestSha256, referenceCount: 14, dependencyCount: stagingScenes.length };
  await write('stagingRegistry', { schemaVersion: 1, registration, manifestPath, statePath });
  const operationId = options.optional ? 'NINE-01-FAL-OPTION-01' : 'NINE-01-FAL-01-BASE', sceneId = dependencyScene;
  const body = { prompt: 'An original action scene.', duration: 20, resolution: '720p', aspect_ratio: '16:9', image_urls: grants.map(g => g.url) };
  const requestPath = await write('request', body);
  const atUtc = new Date(options.submittedAtMs ?? SOURCE_TIME + 1000).toISOString();
  const started = { operationId, kind: 'fal', state: 'submission_started', atUtc, requestBodySha256: files.request.sha256,
    endpointSha256: fixtureSha('https://queue.fal.run/' + endpoint), authorizationSha256: 'c'.repeat(64), fullConditionalProvisionUsd: '3.14' };
  await write('submissionStarted', started);
  const response = { status: 'IN_QUEUE', request_id: requestId, response_url: resultUrl, status_url: statusUrl,
    cancel_url: resultUrl + '/cancel', logs: null, metrics: {}, queue_position: 0, user_queue_position: 0, user_queued_count: 1 };
  await write('acceptedResponse', response);
  const grantOutputPath = await write('grants', { sceneId, grants });
  await write('accepted', { operationId, sceneId, requestId, statusUrl, resultUrl, requestPath,
    requestBodySha256: files.request.sha256, grantOutputPath, acceptedAtUtc: atUtc, providerResponseSha256: files.acceptedResponse.sha256 });
  await write('status', { status: 'COMPLETED', request_id: requestId, response_url: resultUrl });
  const result = { video: { url: 'https://fal.media/nine01-original.mp4', content_type: 'video/mp4', file_name: 'native.mp4', file_size: original.length } };
  await write('result', result);
  await write('validation', { schemaVersion: 1, operationId, sceneId: NINE_SCENES[0],
    ...(options.optional ? { dependencyId: dependencyScene, attemptKind: 'optional' } : {}), providerRequestId: requestId,
    originalPath: path.join(dir, 'master.mp4'), measured: { sha256: fixtureSha(original), size: original.length, durationSeconds: 2, hasAudio: true },
    requestedSeconds: 20, requestBodySha256: files.request.sha256, nativeResultSha256: files.result.sha256,
    calculatedSupplierListUsd: 3.14, verifiedDebitedUsd: null, technicalDefects: [], artisticReview: 'pending' });
  const eventBodies = [
    { event: 'submission_started', operationId: 'NINE-01-NANO-01-BASE', kind: 'nano', state: 'submission_started', requestBodySha256: '0'.repeat(64) },
    { event: 'submission_started', ...started },
    { event: 'fal_submission_response_saved', operationId, httpStatus: 200, responseSha256: files.acceptedResponse.sha256, responseBytes: JSON.stringify(response).length },
    { event: 'fal_request_accepted', operationId, requestId, statusUrlSha256: fixtureSha(statusUrl), resultUrlSha256: fixtureSha(resultUrl), requestedSeconds: 20 },
    { event: 'fal_status_observed', operationId, nativeStatus: 'COMPLETED', httpStatus: 200 },
    { event: 'fal_result_validated', operationId, masterSha256: fixtureSha(original), durationSeconds: 2, hasAudio: true, technicalDefectCount: 0 },
  ];
  let previous: string | null = null;
  const events = eventBodies.map((entry, i) => {
    const entryBody = { ...entry, atUtc, sequence: i + 1, previousEventSha256: previous };
    const row = { ...entryBody, eventSha256: fixtureSha(canonical(entryBody)) };
    previous = row.eventSha256;
    return row;
  });
  const journalPath = path.join(dir, 'journal.jsonl'), journal = Buffer.from(events.map(row => JSON.stringify(row)).join('\n') + '\n');
  await writeFile(journalPath, journal, { mode: 0o600 });
  files.journal = { path: journalPath, sha256: fixtureSha(journal) };
  const { nativeImage: _unused, ...sourceFiles } = files;
  const bundle = { schemaVersion: 1, profile: 'nine01-native-v1', ownerUserId: owner, operationId, sceneId, files: sourceFiles };
  const bundleBytes = Buffer.from(JSON.stringify(bundle));
  const input = { schemaVersion: 1, evidenceProfile: 'nine01-native-v1', ownerUserId: owner, engineId: 'kling-v4', mode: 'ref2v',
    endpoint, providerRequestId: requestId, providerInput: body, videoAssetId: 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    videoSha256: fixtureSha(original), evidenceSha256: fixtureSha(bundleBytes),
    media: { poster: { url: 'https://media.maxvideoai.com/poster.webp', sha256: fixtureSha(poster) },
      preview: { url: 'https://media.maxvideoai.com/preview.mp4', sha256: fixtureSha(preview) } },
    references: grants.map((grant, i) => ({ providerUrl: grant.url, slotId: `image_urls.${i}`, kind: 'image',
      sha256: fixtureSha(image), assetId: `ma_${String(i + 1).padStart(32, '0')}` })) };
  const videoAsset = { id: 'video', public_id: input.videoAssetId, user_id: owner, kind: 'video',
    url: 'https://media.maxvideoai.com/original.mp4', thumb_url: input.media.poster.url, preview_url: input.media.preview.url,
    mime_type: 'video/mp4', width: 64, height: 36, size_bytes: original.length, source_job_id: null, source_output_id: null, status: 'ready', deleted_at: null };
  const referenceAssets = input.references.map((ref, i) => ({ ...videoAsset, id: 'reference-' + i, public_id: ref.assetId, kind: 'image',
    url: `https://media.maxvideoai.com/ref-${i}.png`, mime_type: 'image/png', width: 32, height: 32, size_bytes: image.length, preview_url: null }));
  const calls: string[] = [];
  const fetcher = (async (url: unknown, init?: RequestInit) => {
    if (init?.method !== 'GET' || init.redirect !== 'error') throw new Error('UNSAFE_TEST_READ');
    calls.push(String(url));
    return new Response(String(url).includes('.s3.') || String(url).includes('/ref-') ? image
      : String(url).endsWith('/poster.webp') ? poster : String(url).endsWith('/preview.mp4') ? preview : original);
  }) as typeof fetch;
  return { dir, owner, endpoint, body, requestId, result, original, image, poster, preview, grants, files, events, bundle, bundleBytes,
    input, assets: [videoAsset, ...referenceAssets], calls, fetcher,
    cleanup: () => rm(dir, { recursive: true, force: true }) };
}
