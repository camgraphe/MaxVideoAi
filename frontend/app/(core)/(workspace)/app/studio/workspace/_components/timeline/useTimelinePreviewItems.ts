'use client';

import { useMemo } from 'react';

import {
  layoutForTimelineItem,
  previewPlayheadForInteraction,
  trackForTimelineItem,
  type TimelineInteractionState,
} from '../../_lib/timeline/timeline-interaction';
import { moveWorkspaceTimelineSelectionWithMode } from '../../_lib/workspace-timeline-editing';
import type { WorkspaceTimelineItem } from '../../_lib/workspace-types';
import type { TimelinePreviewTrackItem } from './TimelineTrackList';

const TIMELINE_PREVIEW_ID_SEED = 'preview';

type UseTimelinePreviewItemsOptions = {
  interaction: TimelineInteractionState | null;
  isInsertIntoClipEnabled: boolean;
  items: WorkspaceTimelineItem[];
};

export function useTimelinePreviewItems({
  interaction,
  isInsertIntoClipEnabled,
  items,
}: UseTimelinePreviewItemsOptions) {
  const resolvedPreviewTimelineItems = useMemo(() => {
    if (!interaction || interaction.kind !== 'move') return null;
    return moveWorkspaceTimelineSelectionWithMode({
      items,
      itemIds: interaction.selectedItemIds,
      anchorItemId: interaction.itemId,
      nextStartSec: interaction.previewStartSec,
      nextTrack: interaction.previewTrack,
      mode: 'insert',
      idSeed: TIMELINE_PREVIEW_ID_SEED,
      allowInsertIntoClip: isInsertIntoClipEnabled,
    });
  }, [interaction, isInsertIntoClipEnabled, items]);

  const previewItems = useMemo<TimelinePreviewTrackItem[]>(
    () => {
      if (resolvedPreviewTimelineItems) {
        return resolvedPreviewTimelineItems.map((item) => ({
          item,
          layout: { startSec: item.startSec, durationSec: item.durationSec },
          trackId: item.track,
        }));
      }
      return items.map((item) => ({
        item,
        layout: layoutForTimelineItem(item, interaction),
        trackId: trackForTimelineItem(item, interaction),
      }));
    },
    [interaction, items, resolvedPreviewTimelineItems]
  );

  const previewTimelineItems = useMemo(
    () => {
      if (resolvedPreviewTimelineItems) return resolvedPreviewTimelineItems;
      return interaction
        ? items.map((item) => {
            const layout = layoutForTimelineItem(item, interaction);
            return {
              ...item,
              startSec: layout.startSec,
              durationSec: layout.durationSec,
              track: trackForTimelineItem(item, interaction),
            };
          })
        : null;
    },
    [interaction, items, resolvedPreviewTimelineItems]
  );

  const previewPlayheadSec = interaction
    ? resolvedPreviewTimelineItems?.find((item) => item.id === interaction.itemId)?.startSec ?? previewPlayheadForInteraction(interaction)
    : null;

  return {
    previewItems,
    previewPlayheadSec,
    previewTimelineItems,
  };
}
