import { useCallback, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useWorkspaceAssetLifetime } from './useWorkspaceAssetLifetime';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import { parkedCreateReferenceKey, type WorkspaceParkedCreateReference } from '../_lib/workspace-create-continuity';
import { activeDraftReferenceSlotKey } from '../_lib/workspace-active-draft';

export type WorkspaceInputAssetState = Record<string, (ReferenceAsset | null)[]>;
export type CommitInputAssetMutation = <T extends { state: WorkspaceInputAssetState }>(
  mutation: (previous: WorkspaceInputAssetState) => T,
  removedSlot?: { fieldId: string; index: number },
) => T;

export function useWorkspaceAssetState(accountScope: string | null = 'legacy') {
  const valid = useWorkspaceAssetLifetime(accountScope);
  const scopeRef = useRef(accountScope);
  const [, setReactInputAssets] = useState<WorkspaceInputAssetState>({});
  const [parkedCreateReferences, setParked] = useState<WorkspaceParkedCreateReference[]>([]);
  const inputAssetsRef = useRef<WorkspaceInputAssetState>({});
  const inputAssetMutationRevision = useRef(0);
  const removedReferenceKeys = useRef(new Set<string>());

  const scopeChanged = scopeRef.current !== accountScope;
  if (scopeChanged) {
    scopeRef.current = accountScope;
    inputAssetsRef.current = {};
    setReactInputAssets({});
    setParked([]);
    removedReferenceKeys.current.clear();
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
    (mutation, removedSlot) => {
      const result = mutation(valid() ? inputAssetsRef.current : {});
      if (!valid()) return result;
      if (result.state !== inputAssetsRef.current) {
        if (removedSlot) {
          const { fieldId, index } = removedSlot;
          const removed = inputAssetsRef.current[fieldId]?.[index];
          if (removed?.status === 'ready') removedReferenceKeys.current.add(activeDraftReferenceSlotKey(fieldId, index, removed.id));
        }
        inputAssetMutationRevision.current += 1;
        inputAssetsRef.current = result.state;
        setReactInputAssets(result.state);
      }
      return result;
    },
    [valid],
  );

  const setParkedCreateReferences = useCallback((references?: WorkspaceParkedCreateReference[]) => {
    if (valid()) setParked(previous => references?.length ? references : previous.length ? [] : previous);
  }, [valid]);
  const removeParkedCreateReference = useCallback((reference: WorkspaceParkedCreateReference) => {
    if (!valid()) return;
    const key = parkedCreateReferenceKey(reference);
    removedReferenceKeys.current.add(key);
    setParked(previous => previous.filter(item => parkedCreateReferenceKey(item) !== key));
  }, [valid]);

  return {
    parkedCreateReferences: scopeChanged ? [] : parkedCreateReferences,
    removedReferenceKeys,
    setParkedCreateReferences,
    removeParkedCreateReference,
    inputAssets:
      scopeRef.current === accountScope && accountScope !== null ? inputAssetsRef.current : {},
    inputAssetsRef,
    inputAssetMutationRevision: inputAssetMutationRevision.current,
    setInputAssets,
    commitInputAssetMutation,
  };
}
