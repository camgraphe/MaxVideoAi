import type { LibraryMediaReference, LibraryOrganizationState } from './media-library-organization';
import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { resolveMediaSourceRef } from './media-identity';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
export type LibraryPickerCandidate = { reference: LibraryMediaReference; originalUrl: string };
export type LibraryPickerValidation = {
  reference: LibraryMediaReference;
  key?: string;
  sourceRevision?: string;
  state?: LibraryOrganizationState;
  error?: string;
};
export function libraryPickerCandidate(asset: AssetBrowserAsset): LibraryPickerCandidate {
  const reference: LibraryMediaReference = asset.libraryRef ??
    resolveMediaSourceRef(asset, asset.kind) ?? { type: 'legacy', assetId: asset.id, kind: asset.kind };
  return {
    reference: { ...reference, ...(asset.sourceRevision ? { sourceRevision: asset.sourceRevision } : {}) },
    originalUrl: asset.url,
  };
}
export async function validateLibraryPickerSelection(
  owner: string,
  assets: AssetBrowserAsset[],
  sourceProof?: 'audio-generated-video' | 'generated-video',
): Promise<Pick<LibraryPickerValidation, 'state' | 'error'>[]> {
  const candidates: LibraryPickerCandidate[] = [];
  for (const asset of assets) {
    if (!asset.libraryRef && !resolveMediaSourceRef(asset, asset.kind) && asset.jobId) {
      const response = await ownedAuthFetch(
        `/api/media-library/recent-outputs?kind=${asset.kind}&jobId=${encodeURIComponent(asset.jobId)}&limit=100`,
        owner,
        { cache: 'no-store' },
      );
      const page = await response.json();
      const matches = page.outputs?.filter(
        (output: { jobId: string; url: string; status: string }) =>
          output.jobId === asset.jobId && output.url === asset.url && output.status === 'ready',
      );
      if ((sourceProof === 'audio-generated-video' || sourceProof === 'generated-video') && asset.kind === 'video' && assets.length === 1 &&
          response.ok && page.ok && page.hasMore === false && Array.isArray(page.outputs) && page.outputs.length === 0) {
        // Only this qualified job facade has a historical proof path. Persisted outputs never fall back.
        const proof = await ownedAuthFetch('/api/media-library/selection/validate-job-video', owner, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
          body: JSON.stringify({ jobId: asset.jobId, originalUrl: asset.url }),
        });
        const result = await proof.json();
        if (!proof.ok || !result.ok) throw Error(result.error ?? 'SOURCE_UNAVAILABLE');
        return [{}];
      }
      if (!response.ok || !page.ok || page.hasMore || matches?.length !== 1) throw Error('SOURCE_UNAVAILABLE');
      candidates.push({
        reference: { type: 'job-output', jobId: asset.jobId, outputId: matches[0].id, kind: asset.kind },
        originalUrl: asset.url,
      });
    } else candidates.push(libraryPickerCandidate(asset));
  }
  const response = await ownedAuthFetch('/api/media-library/selection/validate', owner, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidates }),
    cache: 'no-store',
  });
  const body = await response.json();
  if (!response.ok || !body.ok || !Array.isArray(body.results) || body.results.length !== assets.length)
    throw Error('SELECTION_VALIDATION_FAILED');
  return body.results;
}
