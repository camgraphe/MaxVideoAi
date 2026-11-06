import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { uploadAudioInChunks, shouldUseChunkedVideoUpload, uploadVideoFile } from '@/lib/client-video-upload';
import { LIVE_PRICING_POLICY_REVISION, PRICING_POLICY_HEADER } from '@/lib/membership-policy';
import type { RecastResolution, RecastFraming } from '@/lib/character-studio-recast-format';
import type { RecastTrack } from '../_components/useRecastTrack';

export type RecastImage = { name: string; url: string; file?: File; jobId?: string };
export type RecastSetup = {
  portrait: RecastImage;
  product: RecastImage | null;
  video: RecastTrack | null;
  audio: RecastTrack | null;
  direction: string;
  dialogue: string;
  seconds: number;
  resolution: RecastResolution;
  aspectRatio: RecastFraming;
};
type Price = { amountCents: number; currency: string; sourceSeconds: number; audioSeconds: number };
export type WalletRecastQuote = Price & {
  kind: 'wallet';
  quoteId: string;
  expiresAt: string;
  topupRequired: boolean;
};
export type RecastQuote = WalletRecastQuote | (Price & { kind: 'rehearsal'; revision: string });
export type UploadCache = WeakMap<File, Promise<string>>;

async function json(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true)
    throw new Error(
      response.status === 401
        ? 'AUTH_REQUIRED'
        : typeof data?.error?.code === 'string'
          ? data.error.code
          : typeof data?.error === 'string' ? data.error : 'PREPARATION_FAILED',
    );
  return data;
}

function ownedUpload(file: File, kind: 'image' | 'video' | 'audio', cache: UploadCache, signal: AbortSignal) {
  signal.throwIfAborted();
  const existing = cache.get(file);
  if (existing) return existing;
  const request: typeof authFetch = (input, init) => {
    // Multipart cleanup must still reach the upload service after cancellation.
    if (String(input).endsWith('/multipart/abort')) return authFetch(input, init);
    signal.throwIfAborted();
    return authFetch(input, { ...init, signal });
  };
  const task = (async () => {
    try {
      let id: unknown;
      if (kind === 'video') id = (await uploadVideoFile(file, { request, abortRequest: authFetch })).assetId;
      else if (kind === 'audio' && shouldUseChunkedVideoUpload(file))
        id = (await uploadAudioInChunks(file, request)).assetId;
      else {
        const body = new FormData();
        const blob = kind === 'image'
          ? await prepareImageFileForUpload(file, { maxBytes: 4 * 1024 * 1024 }).catch(() => { throw new Error('IMAGE_UPLOAD_INVALID'); })
          : file;
        body.append('file', blob, blob.name);
        const result = await json(await request('/api/uploads/' + kind, { method: 'POST', body }));
        id = result.asset?.assetId;
      }
      if (typeof id !== 'string' || !/^ma_[a-f0-9]{32}$/.test(id)) throw new Error('REFERENCE_INVALID');
      return id;
    } catch (error) {
      if (error instanceof Error && ['UNSUPPORTED_TYPE', 'EMPTY_FILE', 'FILE_TOO_LARGE'].includes(error.message))
        throw new Error(kind.toUpperCase() + '_UPLOAD_INVALID');
      throw error;
    }
  })();
  cache.set(file, task);
  const discard = () => { if (cache.get(file) === task) cache.delete(file); };
  signal.addEventListener('abort', discard, { once: true });
  void task.then(() => signal.removeEventListener('abort', discard), () => {
    signal.removeEventListener('abort', discard);
    discard();
  });
  return task;
}

export async function prepareRecastQuote(
  s: RecastSetup,
  cache: UploadCache,
  signal: AbortSignal,
): Promise<RecastQuote> {
  const mode = s.video ? 'v2v' : s.audio || s.product ? 'ref2v' : 'i2v';
  await json(
    await authFetch('/api/tools/character-studio/recast/prepare?mode=' + mode, { signal, cache: 'no-store' }),
  );
  signal.throwIfAborted();
  const uploadCancellation = new AbortController();
  const abortUploads = () => uploadCancellation.abort(signal.reason);
  signal.addEventListener('abort', abortUploads, { once: true });
  try {
    const track = async (value: RecastTrack | null, kind: 'audio' | 'video') => {
      if (!value) return undefined;
      if (!value.range) throw new Error('REFERENCE_REQUIRED');
      return { assetId: await ownedUpload(value.file, kind, cache, uploadCancellation.signal), range: value.range };
    };
    const [portrait, product, video, audio] = await Promise.all([
      s.portrait.file
        ? ownedUpload(s.portrait.file, 'image', cache, uploadCancellation.signal).then((assetId) => ({ assetId }))
        : { jobId: s.portrait.jobId, imageUrl: s.portrait.url },
      s.product?.file && ownedUpload(s.product.file, 'image', cache, uploadCancellation.signal),
      track(s.video, 'video'),
      track(s.audio, 'audio'),
    ]);
    signal.throwIfAborted();
    const quote = await json(
      await authFetch('/api/tools/character-studio/recast/prepare', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portrait,
          product,
          video,
          audio,
          direction: s.direction,
          dialogue: s.dialogue,
          seconds: s.seconds,
          resolution: s.resolution,
          aspectRatio: s.aspectRatio,
        }),
      }),
    );
    if (!Number.isSafeInteger(quote.amountCents) || quote.amountCents <= 0 || quote.currency !== 'USD' ||
        !Number.isFinite(quote.sourceSeconds) || !Number.isFinite(quote.audioSeconds)) throw new Error('INVALID_QUOTE');
    if (quote.kind === 'rehearsal' && typeof quote.revision === 'string') return quote;
    if (quote.kind === 'wallet' && typeof quote.quoteId === 'string' && Number.isFinite(Date.parse(quote.expiresAt)) &&
        typeof quote.topupRequired === 'boolean') return quote;
    throw new Error('INVALID_QUOTE');
  } catch (error) {
    // A failed sibling must not leave a cached upload tied to an abandoned attempt.
    uploadCancellation.abort();
    throw error;
  } finally {
    signal.removeEventListener('abort', abortUploads);
  }

}

export async function confirmRecastQuote(
  quote: WalletRecastQuote,
): Promise<{ jobId: string; status: string }> {
  return json(
    await authFetch('/api/tools/character-studio/recast/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [PRICING_POLICY_HEADER]: LIVE_PRICING_POLICY_REVISION },
      body: JSON.stringify({
        quoteId: quote.quoteId,
        confirmed: true,
        amountCents: quote.amountCents,
        currency: quote.currency,
      }),
    }),
  );
}
