import { useCallback, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ReferenceAsset } from '../_lib/workspace-assets';

export type WorkspaceInputAssetState = Record<
  string,
  (ReferenceAsset | null)[]
>;
export type CommitInputAssetMutation = <
  T extends { state: WorkspaceInputAssetState },
>(
  mutation: (previous: WorkspaceInputAssetState) => T
) => T;

export function useWorkspaceAssetState() {
  const [inputAssets, setReactInputAssets] =
    useState<WorkspaceInputAssetState>({});
  const inputAssetsRef = useRef<WorkspaceInputAssetState>({});

  const setInputAssets = useCallback<
    Dispatch<SetStateAction<WorkspaceInputAssetState>>
  >((action) => {
    const previous = inputAssetsRef.current;
    const next =
      typeof action === 'function'
        ? (action as (value: WorkspaceInputAssetState) => WorkspaceInputAssetState)(previous)
        : action;
    if (next === previous) return;
    inputAssetsRef.current = next;
    setReactInputAssets(next);
  }, []);

  const commitInputAssetMutation = useCallback<CommitInputAssetMutation>(
    (mutation) => {
      const result = mutation(inputAssetsRef.current);
      if (result.state !== inputAssetsRef.current) {
        inputAssetsRef.current = result.state;
        setReactInputAssets(result.state);
      }
      return result;
    },
    []
  );

  return {
    inputAssets,
    inputAssetsRef,
    setInputAssets,
    commitInputAssetMutation,
  };
}
