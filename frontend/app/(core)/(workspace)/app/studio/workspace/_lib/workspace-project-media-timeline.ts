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
import type { StudioCopy } from '../../_lib/studio-copy';

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

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

export function resolveProjectAssetTimelineInsert(params: {
  allowInsertIntoClip: boolean;
  assetId: string;
  currentItems: WorkspaceTimelineItem[];
  idSeed: string;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  notices: StudioCopy['notices'];
  projectAssets: WorkspaceAssetRecord[];
  startSec: number;
  targetTrack?: WorkspaceTimelineTrack;
}): ResolveProjectAssetTimelineInsertResult {
  const asset = params.projectAssets.find((candidate) => candidate.id === params.assetId);
  if (!asset) {
    return { ok: false, notice: params.notices.projectMediaAssetNotFound };
  }

  const assetUrl = asset.url ?? asset.thumbUrl ?? null;
  const canInsertAsset =
    (asset.kind === 'video' && isPlayableVideoUrl(asset.url)) ||
    (asset.kind === 'audio' && isPlayableAudioUrl(asset.url)) ||
    ((asset.kind === 'image' || asset.kind === 'logo') && isPlayableImageUrl(assetUrl));
  if (!canInsertAsset) {
    return {
      ok: false,
      notice: formatNotice(params.notices.projectMediaNotPlayable, { filename: asset.filename }),
    };
  }
  if (params.targetTrack && params.lockedTimelineTracks.includes(params.targetTrack)) {
    return {
      ok: false,
      notice: formatNotice(params.notices.unlockTrackBeforeProjectMediaDrop, {
        track: workspaceTimelineTrackLabel(params.targetTrack),
      }),
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
    return {
      ok: false,
      notice: formatNotice(params.notices.projectMediaCannotBePlaced, { filename: asset.filename }),
    };
  }
  if (params.targetTrack && !workspaceTimelineItemsCompatibleWithTrack(draftItems, params.targetTrack)) {
    return {
      ok: false,
      notice: formatNotice(params.notices.projectMediaNotCompatibleWithTrack, {
        filename: asset.filename,
        track: params.targetTrack,
      }),
    };
  }

  const nextItems = params.targetTrack ? retargetWorkspaceTimelineItemsForTrack(draftItems, params.targetTrack) : draftItems;
  const selectedItemId = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? nextItems[0]?.id ?? null;
  const resolvedTargetTrack = params.targetTrack ?? nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.track ?? nextItems[0]?.track ?? null;
  if (!selectedItemId || !resolvedTargetTrack) {
    return {
      ok: false,
      notice: formatNotice(params.notices.projectMediaCannotBePlaced, { filename: asset.filename }),
    };
  }
  if (nextItems.some((item) => params.lockedTimelineTracks.includes(item.track))) {
    return { ok: false, notice: params.notices.unlockTargetTrackBeforeProjectMediaInsert };
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
        ? params.notices.projectMediaInsertNeedsEditPoint
        : formatNotice(params.notices.projectMediaCouldNotBeInserted, { filename: asset.filename }),
    };
  }

  return {
    ok: true,
    items: nextTimelineItems,
    selectedItemId,
    playheadSec: insertedItem.startSec,
    notice: params.targetTrack
      ? formatNotice(params.notices.projectMediaDroppedOnTimeline, {
        filename: asset.filename,
        track: resolvedTargetTrack,
        time: insertedItem.startSec.toFixed(2),
      })
      : formatNotice(params.notices.projectMediaInsertedAtPlayhead, {
        filename: asset.filename,
        track: resolvedTargetTrack,
      }),
  };
}
