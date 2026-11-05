import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import { readStoryboardOutputRef, storyboardImageRef, storyboardReferenceJobId } from '../_lib/workspace-storyboard-reference-identity';
import { useWorkspaceAssetLifetime } from './useWorkspaceAssetLifetime';
import { useWorkspaceUploadOperation } from './useWorkspaceUploadOperation';

type Assets = Record<string, (ReferenceAsset | null)[]>;

/** Recover old Storyboard handoffs without treating URLs or local card IDs as authority. */
export function useWorkspaceStoryboardReferences(accountScope: string | null | undefined, inputAssets: Assets, setInputAssets: Dispatch<SetStateAction<Assets>>) {
  const valid = useWorkspaceAssetLifetime(accountScope);
  const begin = useWorkspaceUploadOperation(accountScope, valid);
  useEffect(() => {
    let retired = false;
    const pending: Array<() => void> = [];
    for (const [fieldId, entries] of Object.entries(inputAssets)) entries.forEach((asset, slot) => {
      if (!asset || asset.status !== 'ready' || asset.identityResolutionFailed) return;
      const jobId = storyboardReferenceJobId(asset);
      if (!jobId || !valid() || storyboardImageRef(asset.ref, jobId)) return;
      const operation = begin();
      let timer: ReturnType<typeof setTimeout>;
      let cancel: () => void;
      const timeout = new Promise<never>((_, reject) => {
        cancel = () => { operation.cancel(); reject(new Error('Storyboard reference lookup stopped.')); };
        timer = setTimeout(cancel, 15_000);
      });
      pending.push(cancel!);
      const read = async () => {
        const response = await operation.request(`/api/media-library/recent-outputs?kind=image&limit=2&jobId=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
        return response.ok ? readStoryboardOutputRef(await response.json(), jobId) : undefined;
      };
      void Promise.race([read(), timeout]).catch(() => undefined).then(ref => {
        if (retired || !valid()) return;
        setInputAssets(previous => {
          // The result belongs to the exact initiating slot and asset, including across A→B→A.
          if (previous[fieldId]?.[slot] !== asset) return previous;
          const next = [...previous[fieldId]];
          next[slot] = { ...asset, ref, identityResolutionFailed: !ref };
          return { ...previous, [fieldId]: next };
        });
      }).finally(() => { clearTimeout(timer); operation.finish(); });
    });
    return () => { retired = true; pending.forEach(cancel => cancel()); };
  }, [begin, inputAssets, setInputAssets, valid]);
}
