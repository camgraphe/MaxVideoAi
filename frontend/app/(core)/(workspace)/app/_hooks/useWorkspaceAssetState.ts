import { useCallback, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useWorkspaceAssetLifetime } from './useWorkspaceAssetLifetime';
import type { ReferenceAsset } from '../_lib/workspace-assets';

export type WorkspaceInputAssetState = Record<string, (ReferenceAsset | null)[]>;
export type CommitInputAssetMutation = <T extends { state: WorkspaceInputAssetState }>(
  mutation: (previous: WorkspaceInputAssetState) => T,
) => T;

export function useWorkspaceAssetState(accountScope: string | null = 'legacy') {
  const valid = useWorkspaceAssetLifetime(accountScope);
  const scopeRef = useRef(accountScope);
  const [, setReactInputAssets] = useState<WorkspaceInputAssetState>({});
  const inputAssetsRef = useRef<WorkspaceInputAssetState>({});

  if (scopeRef.current !== accountScope) {
    scopeRef.current = accountScope;
    inputAssetsRef.current = {};
    setReactInputAssets({});
  }
  const setInputAssets = useCallback<Dispatch<SetStateAction<WorkspaceInputAssetState>>>(
    (action) => {
      if (!valid()) return;
      const previous = inputAssetsRef.current;
      const next =
        typeof action === 'function'
          ? (action as (value: WorkspaceInputAssetState) => WorkspaceInputAssetState)(previous)
          : action;
      if (next === previous) return;
      inputAssetsRef.current = next;
      setReactInputAssets(next);
    },
    [valid],
  );

  const commitInputAssetMutation = useCallback<CommitInputAssetMutation>(
    (mutation) => {
      const result = mutation(valid() ? inputAssetsRef.current : {});
      if (!valid()) return result;
      if (result.state !== inputAssetsRef.current) {
        inputAssetsRef.current = result.state;
        setReactInputAssets(result.state);
      }
      return result;
    },
    [valid],
  );

  return {
    inputAssets:
      scopeRef.current === accountScope && accountScope !== null ? inputAssetsRef.current : {},
    inputAssetsRef,
    setInputAssets,
    commitInputAssetMutation,
  };
}
