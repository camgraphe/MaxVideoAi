import { isPlayableAudioUrl, isPlayableImageUrl, isPlayableVideoUrl } from '../_state/workspace-normalizers';
import { buildWorkspaceTimelineItemsForAsset, insertWorkspaceTimelineItems } from './workspace-timeline-editing';
import {
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineTrackLabel,
} from './workspace-timeline-tracks';
import {
  projectAssetTimelineNodeId,
  retargetWorkspaceTimelineItemsForTrack,
  timelineTrackHasClipAt,
  workspaceTimelineItemsCompatibleWithTrack,
} from './workspace-timeline-drops';
import type { WorkspaceAssetRecord, WorkspaceTimelineItem, WorkspaceTimelineTrack } from './workspace-types';

type ResolveProjectAssetTimelineInsertSuccess = {
  items: WorkspaceTimelineItem[];
  notice: string;
  ok: true;
  playheadSec: number;
  selectedItemId: string;
};

type ResolveProjectAssetTimelineInsertFailure = {
  notice: string;
  ok: false;
};

export type ResolveProjectAssetTimelineInsertResult =
  | ResolveProjectAssetTimelineInsertSuccess
  | ResolveProjectAssetTimelineInsertFailure;

export function resolveProjectAssetTimelineInsert(params: {
  allowInsertIntoClip: boolean;
  assetId: string;
  currentItems: WorkspaceTimelineItem[];
  idSeed: string;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  projectAssets: WorkspaceAssetRecord[];
  startSec: number;
  targetTrack?: WorkspaceTimelineTrack;
}): ResolveProjectAssetTimelineInsertResult {
  const asset = params.projectAssets.find((candidate) => candidate.id === params.assetId);
  if (!asset) {
    return { ok: false, notice: 'Project media asset not found.' };
  }

  const assetUrl = asset.url ?? asset.thumbUrl ?? null;
  const canInsertAsset =
    (asset.kind === 'video' && isPlayableVideoUrl(asset.url)) ||
    (asset.kind === 'audio' && isPlayableAudioUrl(asset.url)) ||
    ((asset.kind === 'image' || asset.kind === 'logo') && isPlayableImageUrl(assetUrl));
  if (!canInsertAsset) {
    return { ok: false, notice: `${asset.filename} is not a playable timeline media asset.` };
  }
  if (params.targetTrack && params.lockedTimelineTracks.includes(params.targetTrack)) {
    return {
      ok: false,
      notice: `Unlock ${workspaceTimelineTrackLabel(params.targetTrack)} before dropping media on it.`,
    };
  }

  const draftItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: projectAssetTimelineNodeId(asset),
    title: asset.filename,
    asset,
    startSec: params.startSec,
    idSeed: params.idSeed,
  });
  if (!draftItems.length) {
    return { ok: false, notice: `${asset.filename} cannot be placed on the timeline.` };
  }
  if (params.targetTrack && !workspaceTimelineItemsCompatibleWithTrack(draftItems, params.targetTrack)) {
    return { ok: false, notice: `${asset.filename} is not compatible with the ${params.targetTrack} track.` };
  }

  const nextItems = params.targetTrack ? retargetWorkspaceTimelineItemsForTrack(draftItems, params.targetTrack) : draftItems;
  const selectedItemId = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? nextItems[0]?.id ?? null;
  const resolvedTargetTrack = params.targetTrack ?? nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.track ?? nextItems[0]?.track ?? null;
  if (!selectedItemId || !resolvedTargetTrack) {
    return { ok: false, notice: `${asset.filename} cannot be placed on the timeline.` };
  }
  if (nextItems.some((item) => params.lockedTimelineTracks.includes(item.track))) {
    return { ok: false, notice: 'Unlock the target track before inserting project media.' };
  }

  const nextTimelineItems = insertWorkspaceTimelineItems({
    items: params.currentItems,
    newItems: nextItems,
    mode: 'insert',
    playheadSec: params.startSec,
    selectedItemId: null,
    idSeed: params.idSeed,
    allowInsertIntoClip: params.allowInsertIntoClip,
  });
  const insertedItem = nextTimelineItems.find((item) => item.id === selectedItemId) ?? null;
  if (!insertedItem) {
    const isBlockedClipInsert =
      !params.allowInsertIntoClip && timelineTrackHasClipAt(params.currentItems, resolvedTargetTrack, params.startSec);
    return {
      ok: false,
      notice: isBlockedClipInsert
        ? 'Place the playhead on an edit point or enable Insert into clip.'
        : `${asset.filename} could not be inserted on the timeline.`,
    };
  }

  return {
    ok: true,
    items: nextTimelineItems,
    selectedItemId,
    playheadSec: insertedItem.startSec,
    notice: params.targetTrack
      ? `${asset.filename} dropped on ${resolvedTargetTrack} at ${insertedItem.startSec.toFixed(2)}s.`
      : `${asset.filename} inserted at the playhead on the ${resolvedTargetTrack} track.`,
  };
}
