import type {
  WorkspaceAssetRecord,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceProjectMediaFolder,
  WorkspaceProjectSettings,
  WorkspaceTemplateId,
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from '../_lib/workspace-types';
import { coerceWorkspaceProjectSettings } from '../_lib/workspace-project-settings';
import { normalizeWorkspaceTimelineIdentities } from '../_lib/workspace-timeline-editing';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
  normalizeWorkspaceTimelineTrack,
  workspaceTimelineAudioTrackId,
  workspaceTimelineAudioTrackIndex,
  workspaceTimelineVideoTrackId,
  workspaceTimelineVideoTrackIndex,
} from '../_lib/workspace-timeline-tracks';

export const STORAGE_KEY = 'maxvideoai.editor.workspace.v1';
export const USER_CANVAS_TEMPLATES_STORAGE_KEY = 'maxvideoai.editor.canvasTemplates.v1';
export const STUDIO_PROJECTS_STORAGE_KEY = 'maxvideoai.editor.projects.v1';
export const RENDER_MANIFEST_STORAGE_KEY = 'maxvideoai.editor.timelineRender.v1';
export const VIDEO_EXPORT_REQUEST_STORAGE_KEY = 'maxvideoai.editor.videoExportRequest.v1';
export const TIMELINE_HISTORY_LIMIT = 50;
export const MAX_TIMELINE_VIDEO_TRACKS = 4;
export const MIN_TIMELINE_AUDIO_TRACKS = 3;
export const MAX_TIMELINE_AUDIO_TRACKS = 8;
export const MIN_TIMELINE_PANEL_HEIGHT = 220;
export const MAX_TIMELINE_PANEL_HEIGHT = 620;
export const DEFAULT_WORKSPACE_SHOT_MODEL_ID = 'seedance-2-0';
export const DEFAULT_WORKSPACE_SEQUENCE_ID = 'sequence-main';
export const STALE_EMPTY_DEMO_AUDIO_URL = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

export type WorkspaceFocusMode = 'canvas' | 'viewer';
export type WorkspaceEditorSurface = 'canvas' | 'timeline';

export type PersistedWorkspaceState = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  projectAssets?: WorkspaceAssetRecord[];
  projectMediaFolders?: WorkspaceProjectMediaFolder[];
  timelineItems: WorkspaceTimelineItem[];
  activeSequenceId?: string;
  sequences?: WorkspaceSequenceRecord[];
  activeTemplateId: WorkspaceTemplateId;
  projectSettings: WorkspaceProjectSettings;
  focusMode?: WorkspaceFocusMode;
  audioTrackCount?: number;
  hiddenVideoTracks?: WorkspaceTimelineVideoTrack[];
  lockedTimelineTracks?: WorkspaceTimelineTrack[];
  mutedAudioTracks?: WorkspaceTimelineAudioTrack[];
  videoTrackCount?: number;
  timelinePanelHeight?: number | null;
  timelineInPointSec?: number | null;
  timelineOutPointSec?: number | null;
};

export type WorkspaceSequenceRecord = {
  id: string;
  name: string;
  timelineItems: WorkspaceTimelineItem[];
  projectSettings: WorkspaceProjectSettings;
  audioTrackCount: number;
  hiddenVideoTracks: WorkspaceTimelineVideoTrack[];
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  mutedAudioTracks: WorkspaceTimelineAudioTrack[];
  videoTrackCount: number;
  timelinePanelHeight: number | null;
  timelineInPointSec: number | null;
  timelineOutPointSec: number | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceUserCanvasTemplate = {
  id: string;
  name: string;
  description: string;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  createdAt: string;
};

export type StudioProjectStorageRecord = {
  id: string;
  name: string;
  settings?: WorkspaceProjectSettings;
  canvasTemplateId?: WorkspaceTemplateId;
  workspaceState?: unknown;
};

export type TimelineHistoryState = {
  past: WorkspaceTimelineItem[][];
  future: WorkspaceTimelineItem[][];
};

export type CanvasGraphHistorySnapshot = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
};

export type CanvasGraphHistoryState = {
  past: CanvasGraphHistorySnapshot[];
  future: CanvasGraphHistorySnapshot[];
};

export type TimelineExportClientJobStatus = 'queued' | 'rendering' | 'completed' | 'failed' | 'canceled';

export type TimelineExportClientEstimate = {
  billingKind: 'free' | 'paid';
  amountCents: number;
  currency: string;
  freeExportsRemaining: number;
};

export type TimelineExportClientQuota = {
  freeLimit: number;
  usedFreeExports: number;
  freeExportsRemaining: number;
  billingKind: 'free' | 'paid';
};

export type TimelineExportClientJob = {
  id: string;
  status: TimelineExportClientJobStatus;
  progress: number;
  message: string | null;
  outputUrl: string | null;
};

export function videoTrackCountForTimelineItems(items: WorkspaceTimelineItem[]): number {
  return Math.max(1, ...items.map((item) => workspaceTimelineVideoTrackIndex(item.track)));
}

export function audioTrackCountForTimelineItems(items: WorkspaceTimelineItem[]): number {
  return Math.max(MIN_TIMELINE_AUDIO_TRACKS, ...items.map((item) => workspaceTimelineAudioTrackIndex(item.track)));
}

export function coerceVideoTrackCount(value: unknown, items: WorkspaceTimelineItem[]): number {
  const requestedCount = typeof value === 'number' ? value : 1;
  return Math.max(1, Math.min(MAX_TIMELINE_VIDEO_TRACKS, Math.max(requestedCount, videoTrackCountForTimelineItems(items))));
}

export function coerceAudioTrackCount(value: unknown, items: WorkspaceTimelineItem[]): number {
  const requestedCount = typeof value === 'number' ? value : MIN_TIMELINE_AUDIO_TRACKS;
  return Math.max(MIN_TIMELINE_AUDIO_TRACKS, Math.min(MAX_TIMELINE_AUDIO_TRACKS, Math.max(requestedCount, audioTrackCountForTimelineItems(items))));
}

export function coerceTimelinePanelHeight(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(MIN_TIMELINE_PANEL_HEIGHT, Math.min(MAX_TIMELINE_PANEL_HEIGHT, Math.round(value)));
}

export function coerceTimelineMarker(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 1000) / 1000;
}

export function coerceTimelineTrackList(value: unknown, videoTrackCount: number, audioTrackCount: number): WorkspaceTimelineTrack[] {
  if (!Array.isArray(value)) return [];
  const normalizedTracks = value
    .map((track) => normalizeWorkspaceTimelineTrack(String(track)))
    .filter((track) => {
      if (isWorkspaceTimelineVideoTrack(track)) return workspaceTimelineVideoTrackIndex(track) <= videoTrackCount;
      return isWorkspaceTimelineAudioTrack(track) && workspaceTimelineAudioTrackIndex(track) <= audioTrackCount;
    });
  return Array.from(new Set(normalizedTracks));
}

export function coerceHiddenVideoTracks(value: unknown, videoTrackCount: number): WorkspaceTimelineVideoTrack[] {
  return coerceTimelineTrackList(value, videoTrackCount, MIN_TIMELINE_AUDIO_TRACKS)
    .filter((track): track is WorkspaceTimelineVideoTrack => isWorkspaceTimelineVideoTrack(track));
}

export function coerceMutedAudioTracks(value: unknown, audioTrackCount: number): WorkspaceTimelineAudioTrack[] {
  return coerceTimelineTrackList(value, MAX_TIMELINE_VIDEO_TRACKS, audioTrackCount)
    .filter((track): track is WorkspaceTimelineAudioTrack => isWorkspaceTimelineAudioTrack(track));
}

export function deleteWorkspaceTimelineTrackItems(items: WorkspaceTimelineItem[], track: WorkspaceTimelineTrack): WorkspaceTimelineItem[] {
  if (isWorkspaceTimelineVideoTrack(track)) {
    const deletedIndex = workspaceTimelineVideoTrackIndex(track);
    return items
      .filter((item) => item.track !== track)
      .map((item) => {
        if (!isWorkspaceTimelineVideoTrack(item.track)) return item;
        const itemTrackIndex = workspaceTimelineVideoTrackIndex(item.track);
        if (itemTrackIndex <= deletedIndex) return item;
        return {
          ...item,
          track: workspaceTimelineVideoTrackId(itemTrackIndex - 1),
        };
      });
  }

  const deletedIndex = workspaceTimelineAudioTrackIndex(track);
  return items
    .filter((item) => item.track !== track)
    .map((item) => {
      if (!isWorkspaceTimelineAudioTrack(item.track)) return item;
      const itemTrackIndex = workspaceTimelineAudioTrackIndex(item.track);
      if (itemTrackIndex <= deletedIndex) return item;
      return {
        ...item,
        track: workspaceTimelineAudioTrackId(itemTrackIndex - 1),
      };
    });
}

export function deleteWorkspaceTimelineTrackIds(trackIds: WorkspaceTimelineTrack[], track: WorkspaceTimelineTrack): WorkspaceTimelineTrack[] {
  const nextTrackIds = trackIds
    .filter((trackId) => trackId !== track)
    .map((trackId) => {
      if (isWorkspaceTimelineVideoTrack(track) && isWorkspaceTimelineVideoTrack(trackId)) {
        const deletedIndex = workspaceTimelineVideoTrackIndex(track);
        const trackIndex = workspaceTimelineVideoTrackIndex(trackId);
        return trackIndex > deletedIndex ? workspaceTimelineVideoTrackId(trackIndex - 1) : trackId;
      }
      if (isWorkspaceTimelineAudioTrack(track) && isWorkspaceTimelineAudioTrack(trackId)) {
        const deletedIndex = workspaceTimelineAudioTrackIndex(track);
        const trackIndex = workspaceTimelineAudioTrackIndex(trackId);
        return trackIndex > deletedIndex ? workspaceTimelineAudioTrackId(trackIndex - 1) : trackId;
      }
      return trackId;
    });
  return Array.from(new Set(nextTrackIds));
}

export function createWorkspaceSequenceRecord(params: {
  id: string;
  name: string;
  timelineItems: WorkspaceTimelineItem[];
  projectSettings: WorkspaceProjectSettings;
  audioTrackCount?: number;
  hiddenVideoTracks?: WorkspaceTimelineVideoTrack[];
  lockedTimelineTracks?: WorkspaceTimelineTrack[];
  mutedAudioTracks?: WorkspaceTimelineAudioTrack[];
  videoTrackCount?: number;
  timelinePanelHeight?: number | null;
  timelineInPointSec?: number | null;
  timelineOutPointSec?: number | null;
  createdAt?: string;
  updatedAt?: string;
}): WorkspaceSequenceRecord {
  const timelineItems = normalizeWorkspaceTimelineIdentities(params.timelineItems);
  const audioTrackCount = coerceAudioTrackCount(params.audioTrackCount, timelineItems);
  const videoTrackCount = coerceVideoTrackCount(params.videoTrackCount, timelineItems);
  const timestamp = new Date().toISOString();
  return {
    id: params.id,
    name: params.name.trim() || 'Untitled sequence',
    timelineItems,
    projectSettings: coerceWorkspaceProjectSettings(params.projectSettings),
    audioTrackCount,
    hiddenVideoTracks: coerceHiddenVideoTracks(params.hiddenVideoTracks, videoTrackCount),
    lockedTimelineTracks: coerceTimelineTrackList(params.lockedTimelineTracks, videoTrackCount, audioTrackCount),
    mutedAudioTracks: coerceMutedAudioTracks(params.mutedAudioTracks, audioTrackCount),
    videoTrackCount,
    timelinePanelHeight: coerceTimelinePanelHeight(params.timelinePanelHeight),
    timelineInPointSec: coerceTimelineMarker(params.timelineInPointSec),
    timelineOutPointSec: coerceTimelineMarker(params.timelineOutPointSec),
    createdAt: params.createdAt ?? timestamp,
    updatedAt: params.updatedAt ?? timestamp,
  };
}

export function normalizeWorkspaceSequenceRecord(value: unknown): WorkspaceSequenceRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<WorkspaceSequenceRecord>;
  if (typeof record.id !== 'string' || !Array.isArray(record.timelineItems)) return null;
  return createWorkspaceSequenceRecord({
    id: record.id,
    name: typeof record.name === 'string' ? record.name : 'Untitled sequence',
    timelineItems: record.timelineItems,
    projectSettings: coerceWorkspaceProjectSettings(record.projectSettings),
    audioTrackCount: record.audioTrackCount,
    hiddenVideoTracks: record.hiddenVideoTracks,
    lockedTimelineTracks: record.lockedTimelineTracks,
    mutedAudioTracks: record.mutedAudioTracks,
    videoTrackCount: record.videoTrackCount,
    timelinePanelHeight: record.timelinePanelHeight,
    timelineInPointSec: record.timelineInPointSec,
    timelineOutPointSec: record.timelineOutPointSec,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  });
}

export function upsertWorkspaceSequence(
  sequences: WorkspaceSequenceRecord[],
  sequence: WorkspaceSequenceRecord
): WorkspaceSequenceRecord[] {
  const existingIndex = sequences.findIndex((candidate) => candidate.id === sequence.id);
  if (existingIndex === -1) return [...sequences, sequence];
  return sequences.map((candidate, index) => (index === existingIndex ? sequence : candidate));
}
