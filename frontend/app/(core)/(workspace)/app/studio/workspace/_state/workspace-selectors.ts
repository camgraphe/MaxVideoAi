import type { WorkspaceProjectSettings, WorkspaceTimelineItem } from '../_lib/workspace-types';
import { isWorkspaceTimelineVideoTrack } from '../_lib/workspace-timeline-tracks';
import type { WorkspaceSequenceRecord } from './workspace-state';

export type WorkspaceSequenceInspectorSummary = {
  clipCount: number;
  durationSec: number;
  id: string;
  name: string;
  settings: WorkspaceProjectSettings;
};

export type WorkspaceSequenceSidebarSummary = {
  id: string;
  name: string;
  durationSec: number;
  clipCount: number;
  settings: WorkspaceProjectSettings;
  isActive: boolean;
  previewUrl?: string | null;
};

export function workspaceSequenceDurationSec(sequence: Pick<WorkspaceSequenceRecord, 'timelineItems'>): number {
  return Math.max(0, ...sequence.timelineItems.map((item) => item.startSec + item.durationSec));
}

export function workspaceTimelineDurationSec(items: WorkspaceTimelineItem[]): number {
  return Math.max(0, ...items.map((item) => item.startSec + item.durationSec));
}

export function sequenceNameForIndex(index: number): string {
  return index <= 1 ? 'Main sequence' : `Sequence ${index}`;
}

export function workspaceSequencePreviewUrl(sequence: Pick<WorkspaceSequenceRecord, 'timelineItems'>): string | null {
  const previewItem =
    sequence.timelineItems.find((item) => isWorkspaceTimelineVideoTrack(item.track) && (item.thumbnailUrl || item.mediaUrl)) ?? null;
  return previewItem?.thumbnailUrl ?? previewItem?.mediaUrl ?? null;
}

export function buildWorkspaceSequenceSummaries(params: {
  sequences: WorkspaceSequenceRecord[];
  activeSequenceId: string;
}): WorkspaceSequenceSidebarSummary[] {
  return params.sequences.map((sequence) => ({
    id: sequence.id,
    name: sequence.name,
    durationSec: workspaceSequenceDurationSec(sequence),
    clipCount: sequence.timelineItems.length,
    settings: sequence.projectSettings,
    isActive: sequence.id === params.activeSequenceId,
    previewUrl: workspaceSequencePreviewUrl(sequence),
  }));
}

export function selectedWorkspaceTimelineItem(
  items: WorkspaceTimelineItem[],
  selectedTimelineItemId: string | null
): WorkspaceTimelineItem | null {
  return items.find((item) => item.id === selectedTimelineItemId) ?? null;
}

export function selectedWorkspaceSequenceInspectorSummary(params: {
  inspectedSequenceId: string | null;
  sequenceSummaries: WorkspaceSequenceSidebarSummary[];
}): WorkspaceSequenceInspectorSummary | null {
  if (!params.inspectedSequenceId) return null;
  const sequence = params.sequenceSummaries.find((candidate) => candidate.id === params.inspectedSequenceId);
  if (!sequence) return null;
  return {
    clipCount: sequence.clipCount,
    durationSec: sequence.durationSec,
    id: sequence.id,
    name: sequence.name,
    settings: sequence.settings,
  };
}
