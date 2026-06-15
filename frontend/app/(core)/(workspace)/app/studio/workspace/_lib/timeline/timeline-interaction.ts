import type { WorkspaceTimelineTrimEdge } from '../workspace-timeline-editing';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
} from '../workspace-timeline-tracks';
import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../workspace-types';
import {
  MIN_CLIP_DURATION_SEC,
  TIMELINE_SECOND_PRECISION,
} from './timeline-frames';

export { MIN_CLIP_DURATION_SEC };

export const DEFAULT_TIMELINE_FPS = 24;
export const DEFAULT_TIMELINE_FRAME_STEP_SECONDS = 1 / DEFAULT_TIMELINE_FPS;

const SNAP_TARGET_THRESHOLD_PIXELS = 1;

export type TimelineInteractionKind = 'move' | 'resize-start' | 'resize-end';

export type TimelineClipLayout = {
  startSec: number;
  durationSec: number;
};

export type TimelineInteractionState = {
  itemId: string;
  linkedGroupId: string | null;
  selectedItemIds: string[];
  selectedKeys: string[];
  originLayoutsById: Record<string, TimelineClipLayout>;
  kind: TimelineInteractionKind;
  originClientX: number;
  originTrack: WorkspaceTimelineTrack;
  originStartSec: number;
  originDurationSec: number;
  originSourceStartSec: number;
  originSourceDurationSec: number;
  snapStepSec: number;
  previewTrack: WorkspaceTimelineTrack;
  previewStartSec: number;
  previewDurationSec: number;
  snapGuideSec: number | null;
};

export type TimelineMarqueeState = {
  originClientX: number;
  originClientY: number;
  currentClientX: number;
  currentClientY: number;
  containerLeft: number;
  containerTop: number;
  itemRects: Array<{
    id: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }>;
};

export type TimelineMarqueeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SnapCandidate = {
  startSec: number;
  guideSec: number | null;
};

type TimelineTrackConstraint = {
  startSec: number;
  guideSec: number | null;
};

export function frameStepSeconds(projectFps: number): number {
  return 1 / Math.max(1, projectFps || DEFAULT_TIMELINE_FPS);
}

export function snapTimelineSeconds(
  seconds: number,
  snapStepSec = DEFAULT_TIMELINE_FRAME_STEP_SECONDS
): number {
  const safeStepSec = snapStepSec > 0 ? snapStepSec : DEFAULT_TIMELINE_FRAME_STEP_SECONDS;
  return Math.round((Math.round(seconds / safeStepSec) * safeStepSec) * TIMELINE_SECOND_PRECISION) / TIMELINE_SECOND_PRECISION;
}

export function selectionKeyForTimelineItem(item: WorkspaceTimelineItem): string {
  return item.linkedGroupId ? `group:${item.linkedGroupId}` : `item:${item.id}`;
}

export function selectionKeysForTimelineItemIds(items: WorkspaceTimelineItem[], itemIds: string[]): Set<string> {
  const keys = new Set<string>();
  itemIds.forEach((itemId) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (item) keys.add(selectionKeyForTimelineItem(item));
  });
  return keys;
}

export function timelineRulerStepFor(pixelsPerSecond: number): number {
  if (pixelsPerSecond >= 72) return 1;
  if (pixelsPerSecond >= 42) return 2;
  return 4;
}

export function interactionMatchesTimelineItem(
  interaction: TimelineInteractionState,
  item: WorkspaceTimelineItem
): boolean {
  if (interaction.selectedKeys.length > 1) {
    return interaction.selectedKeys.includes(selectionKeyForTimelineItem(item));
  }
  if (interaction.linkedGroupId) return item.linkedGroupId === interaction.linkedGroupId;
  return item.id === interaction.itemId;
}

export function trackForTimelineItem(
  item: WorkspaceTimelineItem,
  interaction: TimelineInteractionState | null
): WorkspaceTimelineTrack {
  if (!interaction || !interactionMatchesTimelineItem(interaction, item)) return item.track;
  if (interaction.selectedKeys.length > 1) return item.track;
  if (isWorkspaceTimelineVideoTrack(item.track) && !isWorkspaceTimelineVideoTrack(interaction.previewTrack)) return item.track;
  if (isWorkspaceTimelineAudioTrack(item.track) && !isWorkspaceTimelineAudioTrack(interaction.previewTrack)) return item.track;
  return interaction.previewTrack;
}

export function layoutForTimelineItem(
  item: WorkspaceTimelineItem,
  interaction: TimelineInteractionState | null
): TimelineClipLayout {
  if (!interaction || !interactionMatchesTimelineItem(interaction, item)) {
    return { startSec: item.startSec, durationSec: item.durationSec };
  }
  if (interaction.selectedKeys.length > 1) {
    const originLayout = interaction.originLayoutsById[item.id];
    const startDeltaSec = interaction.previewStartSec - interaction.originStartSec;
    return {
      startSec: Math.max(
        0,
        snapTimelineSeconds((originLayout?.startSec ?? item.startSec) + startDeltaSec, interaction.snapStepSec)
      ),
      durationSec: originLayout?.durationSec ?? item.durationSec,
    };
  }
  return {
    startSec: interaction.previewStartSec,
    durationSec: interaction.previewDurationSec,
  };
}

export function sourceDurationForTimelineItem(item: WorkspaceTimelineItem): number {
  const sourceStartSec = item.sourceStartSec ?? 0;
  return Math.max(MIN_CLIP_DURATION_SEC, item.sourceDurationSec ?? sourceStartSec + item.durationSec);
}

export function sourceStartForTimelineItem(item: WorkspaceTimelineItem): number {
  const sourceDurationSec = sourceDurationForTimelineItem(item);
  return Math.max(0, Math.min(sourceDurationSec - MIN_CLIP_DURATION_SEC, item.sourceStartSec ?? 0));
}

export function maxResizeDurationForInteraction(
  interaction: TimelineInteractionState,
  edge: WorkspaceTimelineTrimEdge
): number {
  if (edge === 'start') {
    return Math.max(MIN_CLIP_DURATION_SEC, interaction.originDurationSec + interaction.originSourceStartSec);
  }
  return Math.max(MIN_CLIP_DURATION_SEC, interaction.originSourceDurationSec - interaction.originSourceStartSec);
}

export function buildSnapTargets(
  items: WorkspaceTimelineItem[],
  interaction: TimelineInteractionState,
  playheadSec: number
): number[] {
  const targets = new Set<number>([0, snapTimelineSeconds(playheadSec, interaction.snapStepSec)]);
  items.forEach((item) => {
    if (interactionMatchesTimelineItem(interaction, item)) return;
    targets.add(snapTimelineSeconds(item.startSec, interaction.snapStepSec));
    targets.add(snapTimelineSeconds(item.startSec + item.durationSec, interaction.snapStepSec));
  });
  return Array.from(targets).sort((left, right) => left - right);
}

export function closestSnapCandidate(
  startSec: number,
  durationSec: number,
  snapTargets: number[],
  snapStepSec: number,
  snapThresholdSec: number
): SnapCandidate {
  let bestCandidate: SnapCandidate = { startSec, guideSec: null };
  let bestDistance = snapThresholdSec;

  snapTargets.forEach((targetSec) => {
    const startDistance = Math.abs(startSec - targetSec);
    if (startDistance <= bestDistance) {
      bestDistance = startDistance;
      bestCandidate = { startSec: targetSec, guideSec: targetSec };
    }

    const endDistance = Math.abs(startSec + durationSec - targetSec);
    if (endDistance <= bestDistance) {
      bestDistance = endDistance;
      bestCandidate = { startSec: targetSec - durationSec, guideSec: targetSec };
    }
  });

  return {
    startSec: Math.max(0, snapTimelineSeconds(bestCandidate.startSec, snapStepSec)),
    guideSec: bestCandidate.guideSec,
  };
}

function interactionResizeItems(
  items: WorkspaceTimelineItem[],
  interaction: TimelineInteractionState
): WorkspaceTimelineItem[] {
  return items
    .filter((item) => interactionMatchesTimelineItem(interaction, item))
    .sort((left, right) => {
      const leftPrimary = isWorkspaceTimelineVideoTrack(left.track) ? 0 : 1;
      const rightPrimary = isWorkspaceTimelineVideoTrack(right.track) ? 0 : 1;
      return leftPrimary - rightPrimary || left.track.localeCompare(right.track) || left.id.localeCompare(right.id);
    });
}

function constrainResizeStartToTrackGaps(
  startSec: number,
  items: WorkspaceTimelineItem[],
  interaction: TimelineInteractionState
): TimelineTrackConstraint {
  const activeItems = interactionResizeItems(items, interaction);
  const previousEndSec = activeItems.reduce((maxTrackEndSec, activeItem) => {
    const trackEndSec = items
      .filter((item) => (
        item.track === activeItem.track &&
        !interactionMatchesTimelineItem(interaction, item) &&
        item.startSec + item.durationSec <= activeItem.startSec
      ))
      .reduce((maxEndSec, item) => Math.max(maxEndSec, item.startSec + item.durationSec), 0);
    return Math.max(maxTrackEndSec, trackEndSec);
  }, 0);
  const constrainedStartSec = Math.max(previousEndSec, startSec);
  return {
    startSec: snapTimelineSeconds(constrainedStartSec, interaction.snapStepSec),
    guideSec: constrainedStartSec !== startSec ? previousEndSec : null,
  };
}

function constrainResizeEndToTrackGaps(
  endSec: number,
  items: WorkspaceTimelineItem[],
  interaction: TimelineInteractionState
): TimelineTrackConstraint {
  const activeItems = interactionResizeItems(items, interaction);
  const nextStartSec = activeItems.reduce((minTrackStartSec, activeItem) => {
    const activeEndSec = activeItem.startSec + activeItem.durationSec;
    const trackStartSec = items
      .filter((item) => (
        item.track === activeItem.track &&
        !interactionMatchesTimelineItem(interaction, item) &&
        item.startSec >= activeEndSec
      ))
      .reduce((minStartSec, item) => Math.min(minStartSec, item.startSec), Number.POSITIVE_INFINITY);
    return Math.min(minTrackStartSec, trackStartSec);
  }, Number.POSITIVE_INFINITY);
  if (!Number.isFinite(nextStartSec) || endSec <= nextStartSec) {
    return { startSec: snapTimelineSeconds(endSec, interaction.snapStepSec), guideSec: null };
  }
  return {
    startSec: snapTimelineSeconds(nextStartSec, interaction.snapStepSec),
    guideSec: nextStartSec,
  };
}

export function nextTimelineInteractionState(
  interaction: TimelineInteractionState,
  clientX: number,
  items: WorkspaceTimelineItem[],
  playheadSec: number,
  snapEnabled: boolean,
  pixelsPerSecond: number
): TimelineInteractionState {
  const deltaSec = snapTimelineSeconds((clientX - interaction.originClientX) / pixelsPerSecond, interaction.snapStepSec);
  const snapTargets = snapEnabled ? buildSnapTargets(items, interaction, playheadSec) : [];
  const snapThresholdSec = SNAP_TARGET_THRESHOLD_PIXELS / pixelsPerSecond;

  if (interaction.kind === 'move') {
    const rawStartSec = Math.max(0, snapTimelineSeconds(interaction.originStartSec + deltaSec, interaction.snapStepSec));
    const snapCandidate = snapEnabled
      ? closestSnapCandidate(rawStartSec, interaction.originDurationSec, snapTargets, interaction.snapStepSec, snapThresholdSec)
      : { startSec: rawStartSec, guideSec: null };
    return {
      ...interaction,
      previewStartSec: snapCandidate.startSec,
      previewDurationSec: interaction.originDurationSec,
      snapGuideSec: snapCandidate.guideSec,
    };
  }

  if (interaction.kind === 'resize-start') {
    const originEndSec = interaction.originStartSec + interaction.originDurationSec;
    const maxDurationSec = maxResizeDurationForInteraction(interaction, 'start');
    const minStartSec = Math.max(0, snapTimelineSeconds(originEndSec - maxDurationSec, interaction.snapStepSec));
    const maxStartSec = originEndSec - MIN_CLIP_DURATION_SEC;
    const rawStartSec = Math.max(
      minStartSec,
      Math.min(maxStartSec, snapTimelineSeconds(interaction.originStartSec + deltaSec, interaction.snapStepSec))
    );
    const snapCandidate = snapEnabled
      ? closestSnapCandidate(rawStartSec, originEndSec - rawStartSec, snapTargets, interaction.snapStepSec, snapThresholdSec)
      : { startSec: rawStartSec, guideSec: null };
    const trackConstraint = constrainResizeStartToTrackGaps(snapCandidate.startSec, items, interaction);
    const nextStartSec = Math.max(minStartSec, Math.min(maxStartSec, trackConstraint.startSec));
    return {
      ...interaction,
      previewStartSec: nextStartSec,
      previewDurationSec: Math.min(
        maxDurationSec,
        Math.max(MIN_CLIP_DURATION_SEC, snapTimelineSeconds(originEndSec - nextStartSec, interaction.snapStepSec))
      ),
      snapGuideSec: trackConstraint.guideSec ?? snapCandidate.guideSec,
    };
  }

  const maxDurationSec = maxResizeDurationForInteraction(interaction, 'end');
  const rawDurationSec = Math.max(
    MIN_CLIP_DURATION_SEC,
    Math.min(maxDurationSec, snapTimelineSeconds(interaction.originDurationSec + deltaSec, interaction.snapStepSec))
  );
  const rawEndSec = interaction.originStartSec + rawDurationSec;
  const snapCandidate = snapEnabled
    ? closestSnapCandidate(rawEndSec, 0, snapTargets, interaction.snapStepSec, snapThresholdSec)
    : { startSec: rawEndSec, guideSec: null };
  const nextDurationSec = snapEnabled && snapCandidate.guideSec !== null
    ? Math.max(
        MIN_CLIP_DURATION_SEC,
        Math.min(maxDurationSec, snapTimelineSeconds(snapCandidate.startSec - interaction.originStartSec, interaction.snapStepSec))
      )
    : rawDurationSec;
  const trackConstraint = constrainResizeEndToTrackGaps(interaction.originStartSec + nextDurationSec, items, interaction);

  return {
    ...interaction,
    previewStartSec: interaction.originStartSec,
    previewDurationSec: Math.max(
      MIN_CLIP_DURATION_SEC,
      Math.min(maxDurationSec, snapTimelineSeconds(trackConstraint.startSec - interaction.originStartSec, interaction.snapStepSec))
    ),
    snapGuideSec: trackConstraint.guideSec ?? snapCandidate.guideSec,
  };
}

export function marqueeRectForState(marquee: TimelineMarqueeState): TimelineMarqueeRect {
  const left = Math.min(marquee.originClientX, marquee.currentClientX) - marquee.containerLeft;
  const top = Math.min(marquee.originClientY, marquee.currentClientY) - marquee.containerTop;
  const width = Math.abs(marquee.currentClientX - marquee.originClientX);
  const height = Math.abs(marquee.currentClientY - marquee.originClientY);
  return { left, top, width, height };
}

export function selectedItemIdsForMarquee(marquee: TimelineMarqueeState): string[] {
  const left = Math.min(marquee.originClientX, marquee.currentClientX);
  const right = Math.max(marquee.originClientX, marquee.currentClientX);
  const top = Math.min(marquee.originClientY, marquee.currentClientY);
  const bottom = Math.max(marquee.originClientY, marquee.currentClientY);
  return marquee.itemRects
    .filter((itemRect) => itemRect.left < right && itemRect.right > left && itemRect.top < bottom && itemRect.bottom > top)
    .map((itemRect) => itemRect.id);
}

export function previewPlayheadForInteraction(interaction: TimelineInteractionState): number {
  if (interaction.kind === 'resize-end') {
    return Math.max(
      interaction.previewStartSec,
      interaction.previewStartSec + interaction.previewDurationSec - interaction.snapStepSec
    );
  }
  return interaction.previewStartSec;
}
