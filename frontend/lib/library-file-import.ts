import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { uploadVideoFile } from '@/lib/client-video-upload';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { resolveMediaSourceRef } from '@/lib/media-identity';
import { invalidateLibraryMedia } from '@/hooks/useLibraryCacheRevision';

/** A confirmed upload is never repeated if only canonical lookup/visibility failed. */
export class LibraryImportCompletionError extends Error {
  constructor(
    public readonly asset: AssetBrowserAsset,
    public readonly finish: (signal: AbortSignal) => Promise<AssetBrowserAsset>,
    cause: unknown,
  ) {
    super('IMPORT_SAVED_FINISH_FAILED', { cause });
  }
}
export async function importLibraryFile(
  file: File,
  { userId, signal }: { userId: string; signal: AbortSignal },
): Promise<AssetBrowserAsset> {
  signal.throwIfAborted();
  const kind = file.type.startsWith('video/')
    ? 'video'
    : file.type.startsWith('audio/')
      ? 'audio'
      : 'image';
  const request = (input: RequestInfo | URL, init?: RequestInit) =>
    ownedAuthFetch(input, userId, { ...init, signal });
  let asset: AssetBrowserAsset;
  if (kind === 'video') {
    asset = {
      ...(await uploadVideoFile(file, {
        request,
        abortRequest: (input, init) =>
          ownedAuthFetch(input, userId, {
            ...init,
            signal: AbortSignal.timeout(10000),
          }),
      })),
      kind,
    };
  } else {
    const prepared =
      kind === 'image'
        ? await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 })
        : file;
    signal.throwIfAborted();
    const data = new FormData();
    data.append('file', prepared, prepared.name);
    const response = await request(`/api/uploads/${kind}`, {
      method: 'POST',
      body: data,
    });
    const payload = await response.json().catch(() => null);
    if (
      !response.ok ||
      !payload?.ok ||
      !payload.asset?.url ||
      !payload.asset?.id
    )
      throw Object.assign(new Error(payload?.error ?? 'UPLOAD_FAILED'), {
        status: response.status,
        code: payload?.error,
      });
    asset = { ...payload.asset, kind };
  }
  // A server-confirmed original stays durable even if this initiating UI retired.
  invalidateLibraryMedia(userId);
  const finish = (currentSignal: AbortSignal) =>
    finishLibraryImport(asset, userId, currentSignal);
  try {
    return await finish(signal);
  } catch (error) {
    throw new LibraryImportCompletionError(asset, finish, error);
  }
}

export async function finishLibraryImport(
  initial: AssetBrowserAsset,
  userId: string,
  currentSignal: AbortSignal,
): Promise<AssetBrowserAsset> {
  let asset = initial;
  const kind = asset.kind;
  currentSignal.throwIfAborted();
  let ref = resolveMediaSourceRef(asset, kind);
  if (!ref) {
    const response = await ownedAuthFetch(
      `/api/media-library/assets?kind=${kind}&originUrl=${encodeURIComponent(asset.url)}`,
      userId,
      { signal: currentSignal },
    );
    const payload = await response.json();
    const canonical = payload.assets?.find(
      (item: AssetBrowserAsset) =>
        item.url === asset.url && resolveMediaSourceRef(item, kind),
    );
    if (!response.ok || !payload.ok || !canonical)
      throw Error('CANONICAL_IMPORT_UNAVAILABLE');
    asset = { ...asset, ...canonical, kind };
    ref = resolveMediaSourceRef(asset, kind);
  }
  if (!ref) throw Error('CANONICAL_IMPORT_UNAVAILABLE');
  // Explicit import restores same-content Trash. Background upsert never does.
  const response = await ownedAuthFetch(
    '/api/media-library/organization',
    userId,
    {
      signal: currentSignal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'restore', references: [ref] }),
    },
  );
  const outcome = await response.json();
  if (
    !response.ok ||
    !outcome.ok ||
    outcome.succeededCount !== 1 ||
    outcome.failedCount
  )
    throw Error('IMPORT_RESTORE_FAILED');
  invalidateLibraryMedia(userId);
  return { ...asset, ref };
}
