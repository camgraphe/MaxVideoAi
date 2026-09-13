'use client';

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  applyWorkspaceProjectAssetMetadataToTimelineItems,
  workspaceProjectMediaNeedsMetadata,
  workspaceProjectAssetMetadataSource,
  workspaceAssetWithMeasuredMetadata,
  type WorkspaceProjectAssetMetadataSource,
} from '../_lib/workspace-project-media-metadata';
import type {
  WorkspaceAssetRecord,
  WorkspaceTimelineItem,
} from '../_lib/workspace-types';
import type { WorkspaceSequenceRecord } from '../_state/workspace-state';

type UseWorkspaceProjectMediaMetadataHydrationParams = {
  projectAssets: WorkspaceAssetRecord[];
  setProjectAssets: Dispatch<SetStateAction<WorkspaceAssetRecord[]>>;
  setSequences: Dispatch<SetStateAction<WorkspaceSequenceRecord[]>>;
  setTimelineItems: Dispatch<SetStateAction<WorkspaceTimelineItem[]>>;
  timelineItems: WorkspaceTimelineItem[];
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
};

function loadImagePreviewMetadata(asset: WorkspaceAssetRecord, sourceUrl: string, signal: AbortSignal): Promise<WorkspaceAssetRecord> {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');
    const abort = () => { cleanup(); image.removeAttribute('src'); reject(new Error('Metadata cancelled')); };
    const timer = setTimeout(abort, 8000);
    signal.addEventListener('abort', abort, { once: true });
    const cleanup = (): void => {
      image.onload = null;
      image.onerror = null;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    image.onload = () => {
      const hydratedAsset = workspaceAssetWithMeasuredMetadata(asset, {
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
      cleanup();
      resolve(hydratedAsset);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('Could not load image preview metadata'));
    };
    image.src = sourceUrl;
  });
}

function loadVideoMetadata(asset: WorkspaceAssetRecord, sourceUrl: string, signal: AbortSignal): Promise<WorkspaceAssetRecord> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const abort = () => { cleanup(); reject(new Error('Metadata cancelled')); };
    const timer = setTimeout(abort, 8000);
    signal.addEventListener('abort', abort, { once: true });
    const cleanup = (): void => {
      video.onloadedmetadata = null;
      video.onerror = null;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      video.removeAttribute('src');
      video.load();
    };
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const hydratedAsset = workspaceAssetWithMeasuredMetadata(asset, {
        durationSec: video.duration,
        height: video.videoHeight,
        width: video.videoWidth,
      });
      cleanup();
      resolve(hydratedAsset);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Could not load video metadata'));
    };
    video.src = sourceUrl;
    video.load();
  });
}

function loadMediaMetadata(
  asset: WorkspaceAssetRecord,
  source: WorkspaceProjectAssetMetadataSource,
  signal: AbortSignal
): Promise<WorkspaceAssetRecord> {
  if (source.kind === 'image-preview') return loadImagePreviewMetadata(asset, source.url, signal);
  return loadVideoMetadata(asset, source.url, signal);
}

export function useWorkspaceProjectMediaMetadataHydration({
  projectAssets,
  setProjectAssets,
  setSequences,
  setTimelineItems,
  timelineItems,
  timelineItemsRef,
}: UseWorkspaceProjectMediaMetadataHydrationParams): void {
  const attemptedAssetKeysRef = useRef(new Set<string>());
  const currentAssets = useRef(projectAssets);
  currentAssets.current = projectAssets;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const attemptedKeys = attemptedAssetKeysRef.current;
    const candidates = projectAssets
      .map((asset) => ({
        asset,
        source: workspaceProjectAssetMetadataSource(asset, timelineItems),
      }))
      .filter(({ asset, source }) => workspaceProjectMediaNeedsMetadata(asset) && Boolean(source));
    if (!candidates.length) return;

    let cancelled = false;
    const controller = new AbortController();
    const activeKeys = new Set<string>();
    const pending = candidates.filter(({ asset, source }) => source && !attemptedKeys.has(`${asset.id}:${source.kind}:${source.url}`));
    const runNext = async (): Promise<void> => {
      const candidate = pending.shift();
      if (!candidate || cancelled) return;
      const { asset, source } = candidate;
      if (!source) return;
      const assetKey = `${asset.id}:${source.kind}:${source.url}`;
      if (attemptedKeys.has(assetKey)) return;
      attemptedKeys.add(assetKey);
      activeKeys.add(assetKey);

      await loadMediaMetadata(asset, source, controller.signal)
        .then((hydratedAsset) => {
          activeKeys.delete(assetKey);
          if (cancelled || hydratedAsset === asset) return;
          if (!currentAssets.current.some((candidate) => candidate.id === asset.id && candidate.url === asset.url)) return;
          setProjectAssets((current) =>
            current.map((candidate) => candidate.id === hydratedAsset.id && candidate.url === asset.url ? { ...candidate, durationSec: hydratedAsset.durationSec, dimensions: hydratedAsset.dimensions, width: hydratedAsset.width, height: hydratedAsset.height } : candidate)
          );
          setTimelineItems((current) => {
            const nextItems = applyWorkspaceProjectAssetMetadataToTimelineItems(current, hydratedAsset);
            timelineItemsRef.current = nextItems;
            return nextItems;
          });
          setSequences((current) =>
            current.map((sequence) => {
              const nextItems = applyWorkspaceProjectAssetMetadataToTimelineItems(sequence.timelineItems, hydratedAsset);
              return nextItems === sequence.timelineItems ? sequence : { ...sequence, timelineItems: nextItems };
            })
          );
        })
        .catch(() => {
          activeKeys.delete(assetKey);
          // Some remote media blocks metadata probing; unknown metadata remains unknown.
        });
      if (!cancelled) await runNext();
    };
    void runNext();
    void runNext();

    return () => {
      cancelled = true;
      controller.abort();
      for (const key of activeKeys) attemptedKeys.delete(key);
    };
  }, [projectAssets, setProjectAssets, setSequences, setTimelineItems, timelineItems, timelineItemsRef]);
}
