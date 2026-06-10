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
  workspaceTimelineTrackLabel,
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
        setNotice('Select a generated output or media block before sending it to the timeline.');
        return;
      }

      if (output && (
        !playableOutputTimelineUrl(output) ||
        output.status === 'placeholder' ||
        output.status === 'processing' ||
        output.status === 'failed'
      )) {
        setNotice('This output is not ready for the timeline yet.');
        return;
      }

      if (asset) {
        const assetUrl = asset.url ?? asset.thumbUrl ?? null;
        const canSendAsset =
          (asset.kind === 'video' && isPlayableVideoUrl(asset.url)) ||
          (asset.kind === 'audio' && isPlayableAudioUrl(asset.url)) ||
          ((asset.kind === 'image' || asset.kind === 'logo') && isPlayableImageUrl(assetUrl));
        if (!canSendAsset) {
          setNotice('Select a playable media file before sending this block to the timeline.');
          return;
        }
      }

      const timelineSeed = Date.now().toString(36);
      const nextItems = output
        ? buildWorkspaceTimelineItemsForOutput({
            outputNodeId: nodeId,
            title: mediaNode.data.title,
            output,
            startSec: playheadSec,
            idSeed: timelineSeed,
          })
        : asset
          ? buildWorkspaceTimelineItemsForAsset({
              assetNodeId: nodeId,
              title: mediaNode.data.title,
              asset,
              startSec: playheadSec,
              idSeed: timelineSeed,
            })
          : [];
      const nextTimelineItemId = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? nextItems[0]?.id ?? null;
      if (!nextItems.length || !nextTimelineItemId) {
        setNotice('This block cannot be placed on the timeline yet.');
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
        setNotice(isBlockedClipInsert ? 'Drop on an edit point or enable Insert into clip to splice inside an existing clip.' : 'This block could not be inserted on the timeline.');
        return;
      }
      commitTimelineItems(() => nextTimelineItems);
      setSelectedTimelineItemId(nextTimelineItemId);
      setSelectedTimelineItemIds([nextTimelineItemId]);
      setPlayheadSec(insertedItem.startSec);
      setIsTimelinePlaying(false);
      setNotice(`${mediaNode.data.title} inserted at the playhead on the ${targetTrack} track.`);
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
      timelineInsertIntoClipEnabled,
      timelineItemsRef,
    ]
  );

  const handleDropNodeToTimeline = useCallback(
    (nodeId: string, startSec: number, targetTrack: WorkspaceTimelineTrack) => {
      setActiveEditorSurface('timeline');
      if (lockedTimelineTracks.includes(targetTrack)) {
        setNotice(`Unlock ${workspaceTimelineTrackLabel(targetTrack)} before dropping media on it.`);
        return;
      }
      const mediaNode = nodes.find((node) => node.id === nodeId);
      if (!mediaNode) return;
      const output = mediaNode.data.output;
      const asset = mediaNode.data.asset;
      if (!output && !asset) {
        setNotice('Only ready media blocks can be dropped on the timeline.');
        return;
      }
      if (output && !playableOutputTimelineUrl(output)) {
        setNotice('This generated output is not ready for timeline drop yet.');
        return;
      }

      const timelineSeed = Date.now().toString(36);
      const draftItems = output
        ? buildWorkspaceTimelineItemsForOutput({
            outputNodeId: nodeId,
            title: mediaNode.data.title,
            output,
            startSec,
            idSeed: timelineSeed,
          })
        : asset
          ? buildWorkspaceTimelineItemsForAsset({
              assetNodeId: nodeId,
              title: mediaNode.data.title,
              asset,
              startSec,
              idSeed: timelineSeed,
            })
          : [];
      if (!draftItems.length) {
        setNotice('This block cannot be placed on the timeline yet.');
        return;
      }
      if (!workspaceTimelineItemsCompatibleWithTrack(draftItems, targetTrack)) {
        setNotice(`${mediaNode.data.title} is not compatible with the ${targetTrack} track.`);
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
        setNotice(isBlockedClipInsert ? 'Drop on an edit point or enable Insert into clip to splice inside an existing clip.' : 'This block could not be inserted on the timeline.');
        return;
      }

      commitTimelineItems(() => nextTimelineItems);
      setSelectedTimelineItemId(nextTimelineItemId);
      setSelectedTimelineItemIds([nextTimelineItemId]);
      setPlayheadSec(insertedItem.startSec);
      setIsTimelinePlaying(false);
      setNotice(`${mediaNode.data.title} dropped on ${targetTrack} at ${insertedItem.startSec.toFixed(2)}s.`);
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
          ? 'Unlock the track before dropping media on it.'
          : reason === 'occupied-clip'
          ? 'Drop on an edit point or enable Insert into clip to splice inside an existing clip.'
          : 'This block is not compatible with that timeline track.'
      );
    },
    [setActiveEditorSurface, setIsTimelinePlaying, setNotice]
  );

  return {
    handleDropNodeToTimeline,
    handleInvalidNodeDropToTimeline,
    handleSendOutputToTimeline,
  };
}
