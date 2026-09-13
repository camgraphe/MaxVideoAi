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
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceProjectSettings,
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineVideoTrack,
} from '../_lib/workspace-types';
import type { StudioCopy } from '../../_lib/studio-copy';
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
  inspectedProjectAssetId: string | null;
  inspectedSequenceId: string | null;
  mutedAudioTracks: WorkspaceTimelineAudioTrack[];
  nodes: WorkspaceGraphNode[];
  previewTimelineItems: WorkspaceTimelineItem[];
  projectAssets: WorkspaceAssetRecord[];
  projectSettings: WorkspaceProjectSettings;
  selectedTimelineItemId: string | null;
  sequenceSummaries: WorkspaceSequenceSidebarSummary[];
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes'];
  studioExportDialogCopy: StudioCopy['exportDialog'];
  studioProjectMediaCopy: StudioCopy['viewer']['projectMedia'];
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
  selectedProjectAssetForInspector: WorkspaceAssetRecord | null;
  selectedTimelineItem: WorkspaceTimelineItem | null;
  viewerTimelineItems: WorkspaceTimelineItem[];
};

export function useWorkspaceExportState({
  activeSequenceId,
  activeTemplateName,
  exportRangeMode,
  hiddenVideoTracks,
  inspectedProjectAssetId,
  inspectedSequenceId,
  mutedAudioTracks,
  nodes,
  previewTimelineItems,
  projectAssets,
  projectSettings,
  selectedTimelineItemId,
  sequenceSummaries,
  studioCanvasNodeCopy,
  studioExportDialogCopy,
  studioProjectMediaCopy,
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

  const selectedProjectAssetForInspector = useMemo(
    () => projectAssets.find((asset) => asset.id === inspectedProjectAssetId) ?? null,
    [inspectedProjectAssetId, projectAssets]
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
      canvasNodeCopy: studioCanvasNodeCopy,
      exportDialogCopy: studioExportDialogCopy,
      projectMediaCopy: studioProjectMediaCopy,
      exportRange: activeExportRange,
    }),
    [
      activeExportRange,
      activeSequenceId,
      activeSequenceSummary?.name,
      activeTemplateName,
      exportTimelineItems,
      nodes,
      projectSettings,
      studioCanvasNodeCopy,
      studioExportDialogCopy,
      studioProjectMediaCopy,
    ]
  );

  return {
    activeExportRange,
    exportManifest,
    exportTimelineItems,
    hasValidTimelineInOut,
    selectedSequenceForInspector,
    selectedProjectAssetForInspector,
    selectedTimelineItem,
    viewerTimelineItems,
  };
}
