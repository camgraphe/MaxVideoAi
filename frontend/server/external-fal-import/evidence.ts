import { createHash } from 'node:crypto';
import { canonicalImportJson, importDigest, type ExternalFalImport } from './contract';
import type { ImportAsset, ImportEvidence } from '../external-fal-import';
import { probeExternalImportVideo } from './probe';
import { verifyExternalReferenceCopies } from './reference-copies';
import { createOwnedMediaReadUrl } from '../owned-media-read-access';

const MAX_MEDIA_BYTES = 80 * 1024 * 1024;
export function verifyImportJournal(input: ExternalFalImport, journal: Buffer) {
  if (createHash('sha256').update(journal).digest('hex') !== input.evidenceSha256) throw new Error('IMPORT_JOURNAL_HASH_MISMATCH');
  const entries = journal.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  const submissions = entries.filter(entry => entry.event === 'submission_started');
  const acknowledgements = entries.filter(entry => entry.event === 'accepted');
  if (submissions.length !== 1 || acknowledgements.length !== 1 || submissions[0].endpoint !== input.endpoint
    || canonicalImportJson(submissions[0].input) !== canonicalImportJson(input.providerInput)
    || acknowledgements[0].requestId !== input.providerRequestId) throw new Error('IMPORT_JOURNAL_REQUEST_MISMATCH');
  const recovered = entries.filter(entry => entry.event === 'recovered' && entry.status === 'COMPLETED');
  if (!recovered.length || recovered.some(entry => entry.requestId !== input.providerRequestId
    || (entry.result?.requestId && entry.result.requestId !== input.providerRequestId)
    || !entry.result?.data || typeof entry.result.data !== 'object' || Array.isArray(entry.result.data))) {
    throw new Error('IMPORT_JOURNAL_RESULT_MISMATCH');
  }
  const dataSha256 = importDigest(recovered[0].result.data);
  if (recovered.some(entry => importDigest(entry.result.data) !== dataSha256)) throw new Error('IMPORT_JOURNAL_RESULT_MISMATCH');
  return dataSha256;
}

function recoveryUrls(input: ExternalFalImport) {
  // Queue recovery uses owner/app, not the endpoint's text/image/keyframe subpath.
  const result = `https://queue.fal.run/${input.endpoint.split('/').slice(0, 2).join('/')}/requests/${input.providerRequestId}`;
  return { result, status: result + '/status?logs=0' };
}
export type ExternalFalRecoveryResponse = { requestUrl: string; method: 'GET'; status: number;
  responseUrl: string; requestIdHeader: string | null; rawBodySha256: string };
/** Bind every SDK recovery request to this approved generation; never mutate provider headers. */
export function createExternalFalRecoveryFetch(input: ExternalFalImport, fetcher: typeof fetch = fetch,
  onResponse?: (value: ExternalFalRecoveryResponse) => void): typeof fetch {
  const urls = recoveryUrls(input);
  return async (request, init) => {
    const method = (init?.method ?? (request instanceof Request ? request.method : 'GET')).toUpperCase();
    const url = new URL(typeof request === 'string' || request instanceof URL ? request : request.url).toString();
    if (method !== 'GET' || (url !== urls.result && url !== urls.status)) throw new Error('IMPORT_PROVIDER_RECOVERY_ROUTE');
    const response = await fetcher(request, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
    if (response.url && response.url !== url) throw new Error('IMPORT_PROVIDER_RECOVERY_ROUTE');
    onResponse?.({ requestUrl: url, method: 'GET', status: response.status, responseUrl: response.url,
      requestIdHeader: response.headers.get('x-fal-request-id'),
      rawBodySha256: createHash('sha256').update(Buffer.from(await response.clone().arrayBuffer())).digest('hex') });
    return response;
  };
}
export type ExternalFalProviderEvidence = { endpoint: string; generationRequestId: string; status: unknown;
  statusUrl: string; resultUrl: string; resultRequestId: string | null; resultDataSha256: string;
  rawSdkResultSha256: string; providerResultSha256: string };
function providerMediaUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !(url.hostname === 'fal.media' || url.hostname.endsWith('.fal.media')) || url.username || url.password || url.hash) throw new Error('IMPORT_PROVIDER_MEDIA_HOST');
  return url.toString();
}
async function readBytes(url: string, fetcher: typeof fetch, maximum = MAX_MEDIA_BYTES): Promise<Buffer> {
  const response = await fetcher(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body || Number(response.headers.get('content-length') ?? 0) > maximum) throw new Error('IMPORT_MEDIA_READ_FAILED');
  const chunks: Buffer[] = []; let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error('IMPORT_MEDIA_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  if (!size) throw new Error('IMPORT_MEDIA_EMPTY');
  return Buffer.concat(chunks);
}
function assertDigest(bytes: Buffer, sha256: string, context: string) {
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('IMPORT_MEDIA_HASH_MISMATCH:' + context);
}
/** GET-only provider recovery plus byte-for-byte durable copies. Never submit, charge or upload. */
export async function verifyExternalFalEvidence(input: ExternalFalImport, assets: ImportAsset[], options: {
  journal: Buffer;
  provider: { status(endpoint: string, requestId: string): Promise<{ status: string; request_id?: string; response_url?: string | null }>;
    result(endpoint: string, requestId: string): Promise<unknown> };
  fetcher?: typeof fetch;
  readUrl?: typeof createOwnedMediaReadUrl;
  onProviderEvidence?: (value: ExternalFalProviderEvidence) => void;
}): Promise<ImportEvidence> {
  const recordedDataSha256 = verifyImportJournal(input, options.journal);
  const status = await options.provider.status(input.endpoint, input.providerRequestId);
  if (status.status !== 'COMPLETED') throw new Error('IMPORT_PROVIDER_NOT_COMPLETED');
  if (status.request_id !== input.providerRequestId) throw new Error('IMPORT_PROVIDER_STATUS_REQUEST_ID_MISMATCH');
  const urls = recoveryUrls(input);
  if (status.response_url != null && status.response_url !== urls.result) throw new Error('IMPORT_PROVIDER_RESPONSE_URL_MISMATCH');
  const result = await options.provider.result(input.endpoint, input.providerRequestId);
  const response = result as { requestId?: string; data?: { video?: { url?: string }; seed?: number } };
  // SDK 1.7.0 derives this value only from x-fal-request-id, or "" when absent.
  // The exact status identity and bound GET remain mandatory in that case.
  if (typeof response.requestId !== 'string' || (response.requestId !== '' && response.requestId !== input.providerRequestId)) {
    throw new Error('IMPORT_PROVIDER_REQUEST_ID_MISMATCH');
  }
  if (!response.data || importDigest(response.data) !== recordedDataSha256) throw new Error('IMPORT_PROVIDER_RESULT_DATA_MISMATCH');
  // Hash only canonical model output data: recovery headers may disappear between GETs.
  // Endpoint, accepted generation ID and original journal remain bound by the import plan.
  const providerResultSha256 = recordedDataSha256;
  options.onProviderEvidence?.({ endpoint: input.endpoint, generationRequestId: status.request_id, status,
    statusUrl: urls.status, resultUrl: urls.result, resultRequestId: response.requestId ?? null,
    resultDataSha256: recordedDataSha256, rawSdkResultSha256: importDigest(result), providerResultSha256 });
  const providerVideoUrl = providerMediaUrl(response.data?.video?.url ?? '');
  const fetcher = options.fetcher ?? fetch;
  const readUrl = options.readUrl ?? createOwnedMediaReadUrl;
  const video = assets.find(asset => asset.public_id === input.videoAssetId)!;
  const providerBytes = await readBytes(providerVideoUrl, fetcher);
  assertDigest(providerBytes, input.videoSha256, 'provider-video');
  const durableBytes = await readBytes(await readUrl({ url: video.url, userId: input.ownerUserId }), fetcher);
  assertDigest(durableBytes, input.videoSha256, 'durable-video');
  await readBytes(await readUrl({ url: video.thumb_url!, userId: input.ownerUserId }), fetcher, 8 * 1024 * 1024);
  const referenceProofs = [];
  for (const reference of input.references) {
    const asset = assets.find(candidate => candidate.public_id === reference.assetId)!;
    const original = await readBytes(providerMediaUrl(reference.providerUrl), fetcher, 20 * 1024 * 1024);
    const stored = await readBytes(await readUrl({ url: asset.url, userId: input.ownerUserId }), fetcher, 20 * 1024 * 1024);
    referenceProofs.push(await verifyExternalReferenceCopies(reference, original, stored));
  }
  const measured = await probeExternalImportVideo(durableBytes, { url: video.url, sha256: input.videoSha256, sizeBytes: durableBytes.length });
  return { referenceProofs, providerResultSha256, providerVideoUrl, verifiedAt: new Date().toISOString(),
    ...(Number.isSafeInteger(response.data?.seed) ? { resolvedSeed: response.data!.seed! } : {}),
    video: { sha256: input.videoSha256, sizeBytes: durableBytes.length, ...measured } };
}
