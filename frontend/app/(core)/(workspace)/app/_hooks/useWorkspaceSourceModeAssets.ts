import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EngineCaps, Mode } from '@/types/engines';
import { getVideoWorkflowSourceField, isVideoSourceWorkflow } from '@/lib/video-source-workflow';
import { fieldAcceptsMode, getWorkspaceMediaFields } from '../_lib/workspace-multimodal-workflow';
import { revokeAssetPreview } from '../_lib/workspace-assets';
import type { WorkspaceInputAssetState } from './useWorkspaceAssetState';

/** A source clip is parked locally when leaving Modify/Extend, never sent as a Create reference. */
export function useWorkspaceSourceModeAssets({ engine, mode, scope, assets, setAssets }: {
  engine: EngineCaps | null; mode: Mode | undefined; scope: string;
  assets: WorkspaceInputAssetState; setAssets?: Dispatch<SetStateAction<WorkspaceInputAssetState>>;
}) {
  const { snapshots: parked } = useMemo(() => ({ scope, engineId: engine?.id, snapshots: new Map<Mode, WorkspaceInputAssetState>() }), [scope, engine?.id]);
  const active = useRef(assets);
  active.current = assets;
  useEffect(() => () => {
    const activeUrls = new Set(Object.values(active.current).flat().map(asset => asset?.previewUrl));
    for (const snapshot of parked.values()) for (const asset of Object.values(snapshot).flat()) {
      if (asset && !activeUrls.has(asset.previewUrl)) revokeAssetPreview(asset);
    }
    parked.clear();
  }, [parked]);
  return useCallback((target: Mode | null): WorkspaceInputAssetState => {
    if (!engine || !setAssets) return assets;
    const fields = getWorkspaceMediaFields(engine);
    if (target === null && (isVideoSourceWorkflow(mode) || mode === 'retake')) {
      const sourceId = getVideoWorkflowSourceField(engine.inputSchema, mode)?.id;
      const remaining: WorkspaceInputAssetState = {};
      const removed: WorkspaceInputAssetState = {};
      const createModes: Mode[] = ['t2v', 'i2v', 'ref2v', 'a2v', 'r2v'];
      for (const [id, entries] of Object.entries(assets)) {
        const canCreate = id !== sourceId && fields.some(field => field.id === id && createModes.some(candidate =>
          engine.modes.includes(candidate) && fieldAcceptsMode(field, candidate)));
        if (canCreate) remaining[id] = entries;
        else {
          removed[id] = entries.filter(asset => asset?.status === 'ready').map(asset => asset ? { ...asset, excerptEditing: false } : null);
          for (const asset of entries) if (asset && asset.status !== 'ready') revokeAssetPreview(asset);
        }
      }
      parked.set(mode, removed);
      setAssets(remaining);
      return remaining;
    }
    if (target && parked.has(target)) {
      const restored = { ...assets };
      for (const [id, entries] of Object.entries(parked.get(target)!)) {
        if (!restored[id]?.some(Boolean) && fields.some(field => field.id === id && fieldAcceptsMode(field, target))) restored[id] = entries;
      }
      parked.delete(target);
      setAssets(restored);
      return restored;
    }
    return assets;
  }, [engine, mode, assets, setAssets, parked]);
}
