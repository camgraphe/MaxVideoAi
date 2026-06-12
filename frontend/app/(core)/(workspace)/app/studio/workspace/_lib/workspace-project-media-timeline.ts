import { isPlayableAudioUrl, isPlayableImageUrl, isPlayableVideoUrl } from '../_state/workspace-normalizers';
import { buildWorkspaceTimelineItemsForAsset, insertWorkspaceTimelineItems } from './workspace-timeline-editing';
import {
  isWorkspaceTimelineVideoTrack,
  localizeWorkspaceTimelineTrackNoticeLabel,
} from './workspace-timeline-tracks';
import {
  projectAssetTimelineNodeId,
  retargetWorkspaceTimelineItemsForTrack,
  timelineTrackHasClipAt,
  workspaceTimelineItemsCompatibleWithTrack,
} from './workspace-timeline-drops';
import type { WorkspaceAssetRecord, WorkspaceTimelineItem, WorkspaceTimelineTrack } from './workspace-types';
import { DEFAULT_STUDIO_COPY, type StudioCopy } from '../../_lib/studio-copy';

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
  canvasNodeCopy?: StudioCopy['canvas']['nodes'];
  notices?: StudioCopy['notices'];
  projectAssets: WorkspaceAssetRecord[];
  startSec: number;
  targetTrack?: WorkspaceTimelineTrack;
}): ResolveProjectAssetTimelineInsertResult {
  const notices = params.notices ?? DEFAULT_STUDIO_COPY.notices;
  const canvasNodeCopy = params.canvasNodeCopy ?? DEFAULT_STUDIO_COPY.canvas.nodes;
  const asset = params.projectAssets.find((candidate) => candidate.id === params.assetId);
  if (!asset) {
    return { ok: false, notice: notices.projectMediaAssetNotFound };
  }

  const assetUrl = asset.url ?? asset.thumbUrl ?? null;
  const canInsertAsset =
    (asset.kind === 'video' && isPlayableVideoUrl(asset.url)) ||
    (asset.kind === 'audio' && isPlayableAudioUrl(asset.url)) ||
    ((asset.kind === 'image' || asset.kind === 'logo') && isPlayableImageUrl(assetUrl));
  if (!canInsertAsset) {
    return {
      ok: false,
      notice: formatNotice(notices.projectMediaNotPlayable, { filename: asset.filename }),
    };
  }
  if (params.targetTrack && params.lockedTimelineTracks.includes(params.targetTrack)) {
    return {
      ok: false,
      notice: formatNotice(notices.unlockTrackBeforeProjectMediaDrop, {
        track: localizeWorkspaceTimelineTrackNoticeLabel(params.targetTrack, canvasNodeCopy),
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
      notice: formatNotice(notices.projectMediaCannotBePlaced, { filename: asset.filename }),
    };
  }
  if (params.targetTrack && !workspaceTimelineItemsCompatibleWithTrack(draftItems, params.targetTrack)) {
    return {
      ok: false,
      notice: formatNotice(notices.projectMediaNotCompatibleWithTrack, {
        filename: asset.filename,
        track: localizeWorkspaceTimelineTrackNoticeLabel(params.targetTrack, canvasNodeCopy),
      }),
    };
  }

  const nextItems = params.targetTrack ? retargetWorkspaceTimelineItemsForTrack(draftItems, params.targetTrack) : draftItems;
  const selectedItemId = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? nextItems[0]?.id ?? null;
  const resolvedTargetTrack = params.targetTrack ?? nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.track ?? nextItems[0]?.track ?? null;
  if (!selectedItemId || !resolvedTargetTrack) {
    return {
      ok: false,
      notice: formatNotice(notices.projectMediaCannotBePlaced, { filename: asset.filename }),
    };
  }
  if (nextItems.some((item) => params.lockedTimelineTracks.includes(item.track))) {
    return { ok: false, notice: notices.unlockTargetTrackBeforeProjectMediaInsert };
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
        ? notices.projectMediaInsertNeedsEditPoint
        : formatNotice(notices.projectMediaCouldNotBeInserted, { filename: asset.filename }),
    };
  }

  return {
    ok: true,
    items: nextTimelineItems,
    selectedItemId,
    playheadSec: insertedItem.startSec,
    notice: params.targetTrack
      ? formatNotice(notices.projectMediaDroppedOnTimeline, {
        filename: asset.filename,
        track: localizeWorkspaceTimelineTrackNoticeLabel(resolvedTargetTrack, canvasNodeCopy),
        time: insertedItem.startSec.toFixed(2),
      })
      : formatNotice(notices.projectMediaInsertedAtPlayhead, {
        filename: asset.filename,
        track: localizeWorkspaceTimelineTrackNoticeLabel(resolvedTargetTrack, canvasNodeCopy),
      }),
  };
}
