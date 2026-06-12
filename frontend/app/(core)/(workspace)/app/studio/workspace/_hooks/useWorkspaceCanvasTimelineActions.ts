import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  buildWorkspaceTimelineItemsForAsset,
  buildWorkspaceTimelineItemsForOutput,
  insertWorkspaceTimelineItems,
} from '../_lib/workspace-timeline-editing';
import {
  retargetWorkspaceTimelineItemsForTrack,
  timelineTrackHasClipAt,
  workspaceTimelineItemsCompatibleWithTrack,
} from '../_lib/workspace-timeline-drops';
import {
  isWorkspaceTimelineVideoTrack,
  localizeWorkspaceTimelineTrackNoticeLabel,
} from '../_lib/workspace-timeline-tracks';
import type {
  WorkspaceGraphNode,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
} from '../_lib/workspace-types';
import {
  isPlayableAudioUrl,
  isPlayableImageUrl,
  isPlayableVideoUrl,
  playableOutputTimelineUrl,
} from '../_state/workspace-normalizers';
import type { WorkspaceEditorSurface } from '../_state/workspace-state';
import type { StudioCopy } from '../../_lib/studio-copy';
import { localizeWorkspaceNodeTitle } from '../_lib/workspace-generated-copy';

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

type WorkspaceTimelineNodeDropRejection = 'incompatible' | 'locked-track' | 'occupied-clip';

type UseWorkspaceCanvasTimelineActionsParams = {
  commitTimelineItems: (updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => void;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  nodes: WorkspaceGraphNode[];
  playheadSec: number;
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setIsTimelinePlaying: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setPlayheadSec: Dispatch<SetStateAction<number>>;
  setSelectedTimelineItemId: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineItemIds: Dispatch<SetStateAction<string[]>>;
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes'];
  studioNotices: StudioCopy['notices'];
  timelineInsertIntoClipEnabled: boolean;
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
};

export function useWorkspaceCanvasTimelineActions({
  commitTimelineItems,
  lockedTimelineTracks,
  nodes,
  playheadSec,
  setActiveEditorSurface,
  setIsTimelinePlaying,
  setNotice,
  setPlayheadSec,
  setSelectedTimelineItemId,
  setSelectedTimelineItemIds,
  studioCanvasNodeCopy,
  studioNotices,
  timelineInsertIntoClipEnabled,
  timelineItemsRef,
}: UseWorkspaceCanvasTimelineActionsParams): {
  handleDropNodeToTimeline: (nodeId: string, startSec: number, targetTrack: WorkspaceTimelineTrack) => void;
  handleInvalidNodeDropToTimeline: (reason: WorkspaceTimelineNodeDropRejection) => void;
  handleSendOutputToTimeline: (nodeId: string) => void;
} {
  const handleSendOutputToTimeline = useCallback(
    (nodeId: string) => {
      const mediaNode = nodes.find((node) => node.id === nodeId);
      if (!mediaNode) return;

      const output = mediaNode.data.output;
      const asset = mediaNode.data.asset;
      if (!output && !asset) {
        setNotice(studioNotices.selectGeneratedOutputOrMedia);
        return;
      }

      if (output && (
        !playableOutputTimelineUrl(output) ||
        output.status === 'placeholder' ||
        output.status === 'processing' ||
        output.status === 'failed'
      )) {
        setNotice(studioNotices.outputNotReadyForTimeline);
        return;
      }

      if (asset) {
        const assetUrl = asset.url ?? asset.thumbUrl ?? null;
        const canSendAsset =
          (asset.kind === 'video' && isPlayableVideoUrl(asset.url)) ||
          (asset.kind === 'audio' && isPlayableAudioUrl(asset.url)) ||
          ((asset.kind === 'image' || asset.kind === 'logo') && isPlayableImageUrl(assetUrl));
        if (!canSendAsset) {
          setNotice(studioNotices.selectPlayableMediaForTimeline);
          return;
        }
      }

      const timelineSeed = Date.now().toString(36);
      const timelineGeneratedCopy = mediaNode.data.generatedCopy?.title
        ? { title: mediaNode.data.generatedCopy.title }
        : undefined;
      const nextItems = output
        ? buildWorkspaceTimelineItemsForOutput({
            outputNodeId: nodeId,
            title: mediaNode.data.title,
            generatedCopy: timelineGeneratedCopy,
            output,
            startSec: playheadSec,
            idSeed: timelineSeed,
          })
        : asset
          ? buildWorkspaceTimelineItemsForAsset({
              assetNodeId: nodeId,
              title: mediaNode.data.title,
              generatedCopy: timelineGeneratedCopy,
              asset,
              startSec: playheadSec,
              idSeed: timelineSeed,
            })
          : [];
      const nextTimelineItemId = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? nextItems[0]?.id ?? null;
      if (!nextItems.length || !nextTimelineItemId) {
        setNotice(studioNotices.blockCannotBePlacedOnTimeline);
        return;
      }
      const targetTrack = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.track ?? nextItems[0]?.track ?? 'timeline';
      const nextTimelineItems = insertWorkspaceTimelineItems({
        items: timelineItemsRef.current,
        newItems: nextItems,
        mode: 'insert',
        playheadSec,
        selectedItemId: null,
        idSeed: timelineSeed,
        allowInsertIntoClip: timelineInsertIntoClipEnabled,
      });
      const insertedItem = nextTimelineItems.find((item) => item.id === nextTimelineItemId) ?? null;
      if (!insertedItem) {
        const isBlockedClipInsert = !timelineInsertIntoClipEnabled && timelineTrackHasClipAt(timelineItemsRef.current, targetTrack, playheadSec);
        setNotice(isBlockedClipInsert ? studioNotices.timelineDropNeedsEditPoint : studioNotices.blockCouldNotBeInsertedOnTimeline);
        return;
      }
      commitTimelineItems(() => nextTimelineItems);
      setSelectedTimelineItemId(nextTimelineItemId);
      setSelectedTimelineItemIds([nextTimelineItemId]);
      setPlayheadSec(insertedItem.startSec);
      setIsTimelinePlaying(false);
      setNotice(formatNotice(studioNotices.nodeDroppedOnTimeline, {
        title: localizeWorkspaceNodeTitle(mediaNode, studioCanvasNodeCopy),
        track: localizeWorkspaceTimelineTrackNoticeLabel(targetTrack, studioCanvasNodeCopy),
        time: insertedItem.startSec.toFixed(2),
      }));
    },
    [
      commitTimelineItems,
      nodes,
      playheadSec,
      setIsTimelinePlaying,
      setNotice,
      setPlayheadSec,
      setSelectedTimelineItemId,
      setSelectedTimelineItemIds,
      studioCanvasNodeCopy,
      studioNotices,
      timelineInsertIntoClipEnabled,
      timelineItemsRef,
    ]
  );

  const handleDropNodeToTimeline = useCallback(
    (nodeId: string, startSec: number, targetTrack: WorkspaceTimelineTrack) => {
      setActiveEditorSurface('timeline');
      if (lockedTimelineTracks.includes(targetTrack)) {
        setNotice(formatNotice(studioNotices.unlockTrackBeforeDroppingMedia, {
          track: localizeWorkspaceTimelineTrackNoticeLabel(targetTrack, studioCanvasNodeCopy),
        }));
        return;
      }
      const mediaNode = nodes.find((node) => node.id === nodeId);
      if (!mediaNode) return;
      const output = mediaNode.data.output;
      const asset = mediaNode.data.asset;
      if (!output && !asset) {
        setNotice(studioNotices.selectGeneratedOutputOrMedia);
        return;
      }
      if (output && !playableOutputTimelineUrl(output)) {
        setNotice(studioNotices.outputNotReadyForTimeline);
        return;
      }

      const timelineSeed = Date.now().toString(36);
      const timelineGeneratedCopy = mediaNode.data.generatedCopy?.title
        ? { title: mediaNode.data.generatedCopy.title }
        : undefined;
      const draftItems = output
        ? buildWorkspaceTimelineItemsForOutput({
            outputNodeId: nodeId,
            title: mediaNode.data.title,
            generatedCopy: timelineGeneratedCopy,
            output,
            startSec,
            idSeed: timelineSeed,
          })
        : asset
          ? buildWorkspaceTimelineItemsForAsset({
              assetNodeId: nodeId,
              title: mediaNode.data.title,
              generatedCopy: timelineGeneratedCopy,
              asset,
              startSec,
              idSeed: timelineSeed,
            })
          : [];
      if (!draftItems.length) {
        setNotice(studioNotices.blockCannotBePlacedOnTimeline);
        return;
      }
      if (!workspaceTimelineItemsCompatibleWithTrack(draftItems, targetTrack)) {
        setNotice(studioNotices.blockNotCompatibleWithTimelineTrack);
        return;
      }

      const nextItems = retargetWorkspaceTimelineItemsForTrack(draftItems, targetTrack);
      const currentItems = timelineItemsRef.current;
      const nextTimelineItems = insertWorkspaceTimelineItems({
        items: currentItems,
        newItems: nextItems,
        mode: 'insert',
        playheadSec: startSec,
        selectedItemId: null,
        idSeed: timelineSeed,
        allowInsertIntoClip: timelineInsertIntoClipEnabled,
      });
      const nextTimelineItemId = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? nextItems[0]?.id ?? null;
      const insertedItem = nextTimelineItemId ? nextTimelineItems.find((item) => item.id === nextTimelineItemId) ?? null : null;
      if (!nextTimelineItemId || !insertedItem) {
        const isBlockedClipInsert = !timelineInsertIntoClipEnabled && timelineTrackHasClipAt(currentItems, targetTrack, startSec);
        setNotice(isBlockedClipInsert ? studioNotices.timelineDropNeedsEditPoint : studioNotices.blockCouldNotBeInsertedOnTimeline);
        return;
      }

      commitTimelineItems(() => nextTimelineItems);
      setSelectedTimelineItemId(nextTimelineItemId);
      setSelectedTimelineItemIds([nextTimelineItemId]);
      setPlayheadSec(insertedItem.startSec);
      setIsTimelinePlaying(false);
      setNotice(formatNotice(studioNotices.nodeDroppedOnTimeline, {
        title: localizeWorkspaceNodeTitle(mediaNode, studioCanvasNodeCopy),
        track: localizeWorkspaceTimelineTrackNoticeLabel(targetTrack, studioCanvasNodeCopy),
        time: insertedItem.startSec.toFixed(2),
      }));
    },
    [
      commitTimelineItems,
      lockedTimelineTracks,
      nodes,
      setActiveEditorSurface,
      setIsTimelinePlaying,
      setNotice,
      setPlayheadSec,
      setSelectedTimelineItemId,
      setSelectedTimelineItemIds,
      studioCanvasNodeCopy,
      studioNotices,
      timelineInsertIntoClipEnabled,
      timelineItemsRef,
    ]
  );

  const handleInvalidNodeDropToTimeline = useCallback(
    (reason: WorkspaceTimelineNodeDropRejection) => {
      setActiveEditorSurface('timeline');
      setIsTimelinePlaying(false);
      setNotice(
        reason === 'locked-track'
          ? studioNotices.unlockTrackBeforeDroppingMedia
          : reason === 'occupied-clip'
          ? studioNotices.timelineDropNeedsEditPoint
          : studioNotices.blockNotCompatibleWithTimelineTrack
      );
    },
    [
      setActiveEditorSurface,
      setIsTimelinePlaying,
      setNotice,
      studioNotices.blockNotCompatibleWithTimelineTrack,
      studioNotices.timelineDropNeedsEditPoint,
      studioNotices.unlockTrackBeforeDroppingMedia,
    ]
  );

  return {
    handleDropNodeToTimeline,
    handleInvalidNodeDropToTimeline,
    handleSendOutputToTimeline,
  };
}
