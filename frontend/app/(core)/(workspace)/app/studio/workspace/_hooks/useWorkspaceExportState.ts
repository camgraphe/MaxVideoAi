'use client';

import { useMemo } from 'react';
import {
  buildWorkspaceTimelineRenderManifest,
  type WorkspaceTimelineExportRangeMode,
  type WorkspaceTimelineRenderManifest,
} from '../_lib/workspace-timeline-render';
import {
  filterHiddenVideoTrackItems,
  muteAudioTrackItems,
} from '../_lib/workspace-timeline-selection';
import type {
  WorkspaceGraphNode,
  WorkspaceProjectSettings,
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineVideoTrack,
} from '../_lib/workspace-types';
import {
  selectedWorkspaceSequenceInspectorSummary,
  selectedWorkspaceTimelineItem,
  type WorkspaceSequenceInspectorSummary,
  type WorkspaceSequenceSidebarSummary,
} from '../_state/workspace-selectors';

type WorkspaceExportRangeInput =
  | { mode: 'sequence' }
  | { mode: 'in-out'; startSec: number; endSec: number };

type UseWorkspaceExportStateOptions = {
  activeSequenceId: string;
  activeTemplateName: string;
  exportRangeMode: WorkspaceTimelineExportRangeMode;
  hiddenVideoTracks: WorkspaceTimelineVideoTrack[];
  inspectedSequenceId: string | null;
  mutedAudioTracks: WorkspaceTimelineAudioTrack[];
  nodes: WorkspaceGraphNode[];
  previewTimelineItems: WorkspaceTimelineItem[];
  projectSettings: WorkspaceProjectSettings;
  selectedTimelineItemId: string | null;
  sequenceSummaries: WorkspaceSequenceSidebarSummary[];
  timelineInPointSec: number | null;
  timelineItems: WorkspaceTimelineItem[];
  timelineOutPointSec: number | null;
};

type WorkspaceExportState = {
  activeExportRange: WorkspaceExportRangeInput;
  exportManifest: WorkspaceTimelineRenderManifest;
  exportTimelineItems: WorkspaceTimelineItem[];
  hasValidTimelineInOut: boolean;
  selectedSequenceForInspector: WorkspaceSequenceInspectorSummary | null;
  selectedTimelineItem: WorkspaceTimelineItem | null;
  viewerTimelineItems: WorkspaceTimelineItem[];
};

export function useWorkspaceExportState({
  activeSequenceId,
  activeTemplateName,
  exportRangeMode,
  hiddenVideoTracks,
  inspectedSequenceId,
  mutedAudioTracks,
  nodes,
  previewTimelineItems,
  projectSettings,
  selectedTimelineItemId,
  sequenceSummaries,
  timelineInPointSec,
  timelineItems,
  timelineOutPointSec,
}: UseWorkspaceExportStateOptions): WorkspaceExportState {
  const viewerTimelineItems = useMemo(
    () => muteAudioTrackItems(filterHiddenVideoTrackItems(previewTimelineItems, hiddenVideoTracks), mutedAudioTracks),
    [hiddenVideoTracks, mutedAudioTracks, previewTimelineItems]
  );

  const selectedTimelineItem = useMemo(
    () => selectedWorkspaceTimelineItem(previewTimelineItems, selectedTimelineItemId),
    [previewTimelineItems, selectedTimelineItemId]
  );

  const selectedSequenceForInspector = useMemo(
    () => selectedWorkspaceSequenceInspectorSummary({ inspectedSequenceId, sequenceSummaries }),
    [inspectedSequenceId, sequenceSummaries]
  );

  const exportTimelineItems = useMemo(
    () => muteAudioTrackItems(filterHiddenVideoTrackItems(timelineItems, hiddenVideoTracks), mutedAudioTracks),
    [hiddenVideoTracks, mutedAudioTracks, timelineItems]
  );

  const hasValidTimelineInOut =
    timelineInPointSec !== null && timelineOutPointSec !== null && timelineOutPointSec > timelineInPointSec;

  const activeExportRange = useMemo(
    () => (
      exportRangeMode === 'in-out' && hasValidTimelineInOut
        ? {
            mode: 'in-out' as const,
            startSec: timelineInPointSec,
            endSec: timelineOutPointSec,
          }
        : { mode: 'sequence' as const }
    ),
    [exportRangeMode, hasValidTimelineInOut, timelineInPointSec, timelineOutPointSec]
  );

  const activeSequenceSummary = useMemo(
    () => sequenceSummaries.find((sequence) => sequence.id === activeSequenceId) ?? null,
    [activeSequenceId, sequenceSummaries]
  );

  const exportManifest = useMemo(
    () => buildWorkspaceTimelineRenderManifest({
      items: exportTimelineItems,
      nodes,
      projectName: activeTemplateName,
      sequenceId: activeSequenceId,
      sequenceName: activeSequenceSummary?.name,
      projectSettings,
      exportRange: activeExportRange,
    }),
    [activeExportRange, activeSequenceId, activeSequenceSummary?.name, activeTemplateName, exportTimelineItems, nodes, projectSettings]
  );

  return {
    activeExportRange,
    exportManifest,
    exportTimelineItems,
    hasValidTimelineInOut,
    selectedSequenceForInspector,
    selectedTimelineItem,
    viewerTimelineItems,
  };
}
