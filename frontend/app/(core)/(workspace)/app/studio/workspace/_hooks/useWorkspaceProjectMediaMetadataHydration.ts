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

function loadImagePreviewMetadata(asset: WorkspaceAssetRecord, sourceUrl: string): Promise<WorkspaceAssetRecord> {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');
    const cleanup = (): void => {
      image.onload = null;
      image.onerror = null;
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

function loadVideoMetadata(asset: WorkspaceAssetRecord, sourceUrl: string): Promise<WorkspaceAssetRecord> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const cleanup = (): void => {
      video.onloadedmetadata = null;
      video.onerror = null;
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
  source: WorkspaceProjectAssetMetadataSource
): Promise<WorkspaceAssetRecord> {
  if (source.kind === 'image-preview') return loadImagePreviewMetadata(asset, source.url);
  return loadVideoMetadata(asset, source.url);
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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const candidates = projectAssets
      .map((asset) => ({
        asset,
        source: workspaceProjectAssetMetadataSource(asset, timelineItems),
      }))
      .filter(({ asset, source }) => workspaceProjectMediaNeedsMetadata(asset) && Boolean(source));
    if (!candidates.length) return;

    let cancelled = false;
    candidates.forEach(({ asset, source }) => {
      if (!source) return;
      const assetKey = `${asset.id}:${source.kind}:${source.url}`;
      if (attemptedAssetKeysRef.current.has(assetKey)) return;
      attemptedAssetKeysRef.current.add(assetKey);

      void loadMediaMetadata(asset, source)
        .then((hydratedAsset) => {
          if (cancelled || hydratedAsset === asset) return;
          setProjectAssets((current) =>
            current.map((candidate) => candidate.id === hydratedAsset.id ? hydratedAsset : candidate)
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
          // Some remote media blocks metadata probing; unknown metadata remains unknown.
        });
    });

    return () => {
      cancelled = true;
    };
  }, [projectAssets, setProjectAssets, setSequences, setTimelineItems, timelineItems, timelineItemsRef]);
}
