import { authFetch } from '@/lib/authFetch';
import {
  WORKSPACE_TEMPLATE_SUMMARIES,
} from '../_lib/workspace-templates';
import {
  coerceWorkspaceProjectSettings,
} from '../_lib/workspace-project-settings';
import {
  normalizeWorkspaceTimelineIdentities,
} from '../_lib/workspace-timeline-editing';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceProjectMediaFolder,
  WorkspaceTemplateId,
} from '../_lib/workspace-types';
import {
  normalizeGeneratedOutputEdges,
  normalizeGeneratedOutputNodes,
  normalizeOutputOnlySourceEdges,
  normalizeOutputOnlySourceNodes,
  normalizePlaceholderOutputNodes,
  normalizeShotOutputEdges,
  normalizeShotOutputNodes,
  normalizeTimelineMediaUrls,
  normalizeWorkspaceEdgeTypes,
} from './workspace-normalizers';
import { saveStudioSequencesToApi } from './workspace-sequence-api-persistence';
import {
  DEFAULT_WORKSPACE_SEQUENCE_ID,
  coerceAudioTrackCount,
  coerceHiddenVideoTracks,
  coerceMutedAudioTracks,
  coerceTimelineMarker,
  coerceTimelinePanelHeight,
  coerceTimelineTrackList,
  coerceVideoTrackCount,
  createWorkspaceSequenceRecord,
  normalizeWorkspaceSequenceRecord,
  upsertWorkspaceSequence,
  type PersistedWorkspaceState,
  type StudioProjectStorageRecord,
  type WorkspaceSequenceRecord,
  type WorkspaceUserCanvasTemplate,
} from './workspace-state';
import { sequenceNameForIndex } from './workspace-selectors';

export {
  readStudioSequencesFromApi,
  saveStudioSequencesToApi,
} from './workspace-sequence-api-persistence';

export function normalizeStudioProjectTemplateId(value: unknown): WorkspaceTemplateId {
  if (typeof value === 'string' && WORKSPACE_TEMPLATE_SUMMARIES.some((template) => template.id === value)) {
    return value as WorkspaceTemplateId;
  }
  return 'product-ad';
}

export function normalizeStudioProjectApiRecord(value: unknown): StudioProjectStorageRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<StudioProjectStorageRecord>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;
  return {
    id: record.id,
    name: record.name.trim() || 'Untitled edit',
    settings: coerceWorkspaceProjectSettings(record.settings),
    canvasTemplateId: normalizeStudioProjectTemplateId(record.canvasTemplateId),
    workspaceState: record.workspaceState,
  };
}

export async function readStudioProjectFromApi(projectId: string, signal?: AbortSignal): Promise<StudioProjectStorageRecord | null> {
  try {
    const response = await authFetch(`/api/studio/projects/${encodeURIComponent(projectId)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) return null;
    return normalizeStudioProjectApiRecord(payload.project);
  } catch {
    return null;
  }
}

export async function saveStudioProjectToApi(params: {
  projectId: string;
  name: string;
  canvasTemplateId: WorkspaceTemplateId;
  settings: StudioProjectStorageRecord['settings'];
  workspaceState: PersistedWorkspaceState;
  signal?: AbortSignal;
}): Promise<void> {
  try {
    await authFetch(`/api/studio/projects/${encodeURIComponent(params.projectId)}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project: {
          name: params.name,
          canvasTemplateId: params.canvasTemplateId,
          settings: params.settings,
          workspaceState: params.workspaceState,
        },
      }),
      signal: params.signal,
    });
  } catch {
    // Server persistence is best effort; local workspace storage remains the fallback.
  }
}

export function stripWorkspaceSequencesForProjectApi(state: PersistedWorkspaceState): PersistedWorkspaceState {
  return {
    ...state,
    timelineItems: [],
    sequences: [],
  };
}

export function hasStudioProjectWorkspaceSequenceSnapshot(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PersistedWorkspaceState>;
  if (Array.isArray(record.sequences) && record.sequences.length > 0) return true;
  return Array.isArray(record.timelineItems) && record.timelineItems.length > 0;
}

export function shouldApplyStudioProjectWorkspaceState(
  workspaceState: unknown,
  serverSequences: WorkspaceSequenceRecord[] | null
): boolean {
  if (serverSequences !== null) return true;
  return hasStudioProjectWorkspaceSequenceSnapshot(workspaceState);
}

export function mergePersistedWorkspaceWithServerSequences(
  persisted: PersistedWorkspaceState,
  serverSequences: WorkspaceSequenceRecord[] | null
): PersistedWorkspaceState {
  if (!serverSequences?.length) return persisted;

  const activeSequenceId = serverSequences.some((sequence) => sequence.id === persisted.activeSequenceId)
    ? persisted.activeSequenceId
    : serverSequences[0].id;
  const activeSequence = serverSequences.find((sequence) => sequence.id === activeSequenceId) ?? serverSequences[0];

  return {
    ...persisted,
    activeSequenceId,
    sequences: serverSequences,
    timelineItems: activeSequence.timelineItems,
    projectSettings: activeSequence.projectSettings,
    audioTrackCount: activeSequence.audioTrackCount,
    hiddenVideoTracks: activeSequence.hiddenVideoTracks,
    lockedTimelineTracks: activeSequence.lockedTimelineTracks,
    mutedAudioTracks: activeSequence.mutedAudioTracks,
    videoTrackCount: activeSequence.videoTrackCount,
    timelinePanelHeight: activeSequence.timelinePanelHeight,
    timelineInPointSec: activeSequence.timelineInPointSec,
    timelineOutPointSec: activeSequence.timelineOutPointSec,
  };
}

export async function saveStudioWorkspaceToApi(params: {
  projectId: string;
  name: string;
  canvasTemplateId: WorkspaceTemplateId;
  settings: StudioProjectStorageRecord['settings'];
  workspaceState: PersistedWorkspaceState;
  signal?: AbortSignal;
}): Promise<void> {
  const sequenceSyncOk = await saveStudioSequencesToApi({
    projectId: params.projectId,
    sequences: params.workspaceState.sequences ?? [],
    signal: params.signal,
  });
  await saveStudioProjectToApi({
    ...params,
    workspaceState: sequenceSyncOk
      ? stripWorkspaceSequencesForProjectApi(params.workspaceState)
      : params.workspaceState,
  });
}

export function describeCanvasTemplate(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): string {
  return `${nodes.length} block${nodes.length === 1 ? '' : 's'} · ${edges.length} link${edges.length === 1 ? '' : 's'}`;
}

export function normalizeUserCanvasTemplate(value: unknown): WorkspaceUserCanvasTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<WorkspaceUserCanvasTemplate>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;
  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) return null;
  const nodes = normalizePlaceholderOutputNodes(
    normalizeGeneratedOutputNodes(normalizeShotOutputNodes(normalizeOutputOnlySourceNodes(record.nodes)))
  );
  const edges = normalizeWorkspaceEdgeTypes(
    normalizeGeneratedOutputEdges(nodes, normalizeShotOutputEdges(nodes, normalizeOutputOnlySourceEdges(nodes, record.edges)))
  );
  return {
    id: record.id,
    name: record.name.trim() || 'Untitled canvas template',
    description: typeof record.description === 'string' && record.description.trim()
      ? record.description.trim()
      : describeCanvasTemplate(nodes, edges),
    nodes,
    edges,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
  };
}

export async function readUserCanvasTemplatesFromApi(signal?: AbortSignal): Promise<WorkspaceUserCanvasTemplate[] | null> {
  try {
    const response = await authFetch('/api/studio/canvas-templates', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !Array.isArray(payload.templates)) return null;
    return payload.templates
      .map(normalizeUserCanvasTemplate)
      .filter((template: WorkspaceUserCanvasTemplate | null): template is WorkspaceUserCanvasTemplate => Boolean(template));
  } catch {
    return null;
  }
}

export async function saveUserCanvasTemplateToApi(template: WorkspaceUserCanvasTemplate): Promise<void> {
  try {
    await authFetch('/api/studio/canvas-templates', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template }),
    });
  } catch {
    // User templates are still persisted locally when the API is unavailable.
  }
}

export async function deleteUserCanvasTemplateFromApi(templateId: string): Promise<void> {
  try {
    await authFetch(`/api/studio/canvas-templates/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
  } catch {
    // User templates are still deleted locally when the API is unavailable.
  }
}

function normalizePersistedProjectAsset(value: unknown): WorkspaceAssetRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<WorkspaceAssetRecord>;
  const kind = record.kind;
  if (kind !== 'image' && kind !== 'video' && kind !== 'audio' && kind !== 'logo' && kind !== 'text') return null;
  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  if (typeof record.filename !== 'string' || !record.filename.trim()) return null;
  return {
    id: record.id,
    kind,
    filename: record.filename,
    subtitle: typeof record.subtitle === 'string' && record.subtitle.trim() ? record.subtitle : kind,
    url: typeof record.url === 'string' ? record.url : undefined,
    thumbUrl: typeof record.thumbUrl === 'string' ? record.thumbUrl : undefined,
    durationSec: typeof record.durationSec === 'number' && Number.isFinite(record.durationSec) ? record.durationSec : undefined,
    dimensions: typeof record.dimensions === 'string' ? record.dimensions : undefined,
  };
}

function normalizePersistedProjectAssets(value: unknown): WorkspaceAssetRecord[] {
  if (!Array.isArray(value)) return [];
  const assets = value
    .map(normalizePersistedProjectAsset)
    .filter((asset): asset is WorkspaceAssetRecord => Boolean(asset));
  const seenIds = new Set<string>();
  return assets.filter((asset) => {
    if (seenIds.has(asset.id)) return false;
    seenIds.add(asset.id);
    return true;
  });
}

function normalizePersistedProjectMediaFolder(value: unknown): WorkspaceProjectMediaFolder | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<WorkspaceProjectMediaFolder>;
  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  const timestamp = new Date().toISOString();
  return {
    id: record.id,
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Untitled folder',
    createdAt: typeof record.createdAt === 'string' && record.createdAt.trim() ? record.createdAt : timestamp,
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt.trim() ? record.updatedAt : timestamp,
  };
}

function normalizePersistedProjectMediaFolders(value: unknown): WorkspaceProjectMediaFolder[] {
  if (!Array.isArray(value)) return [];
  const folders = value
    .map(normalizePersistedProjectMediaFolder)
    .filter((folder): folder is WorkspaceProjectMediaFolder => Boolean(folder));
  const seenIds = new Set<string>();
  return folders.filter((folder) => {
    if (seenIds.has(folder.id)) return false;
    seenIds.add(folder.id);
    return true;
  });
}

export function normalizePersistedWorkspaceState(value: unknown): PersistedWorkspaceState | null {
  const parsed = value as Partial<PersistedWorkspaceState> | null;
  if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || !Array.isArray(parsed.timelineItems)) return null;
  const nodes = normalizePlaceholderOutputNodes(
    normalizeGeneratedOutputNodes(normalizeShotOutputNodes(normalizeOutputOnlySourceNodes(parsed.nodes)))
  );
  const edges = normalizeWorkspaceEdgeTypes(
    normalizeGeneratedOutputEdges(nodes, normalizeShotOutputEdges(nodes, normalizeOutputOnlySourceEdges(nodes, parsed.edges)))
  );
  const timelineItems = normalizeWorkspaceTimelineIdentities(normalizeTimelineMediaUrls(nodes, parsed.timelineItems));
  const audioTrackCount = coerceAudioTrackCount(parsed.audioTrackCount, timelineItems);
  const videoTrackCount = coerceVideoTrackCount(parsed.videoTrackCount, timelineItems);
  const activeSequenceId = typeof parsed.activeSequenceId === 'string' && parsed.activeSequenceId.trim()
    ? parsed.activeSequenceId
    : DEFAULT_WORKSPACE_SEQUENCE_ID;
  const activeSequenceName = Array.isArray(parsed.sequences)
    ? normalizeWorkspaceSequenceRecord(parsed.sequences.find((sequence) => (
        Boolean(sequence) &&
        typeof sequence === 'object' &&
        (sequence as Partial<WorkspaceSequenceRecord>).id === activeSequenceId
      )))?.name
    : undefined;
  const activeSequence = createWorkspaceSequenceRecord({
    id: activeSequenceId,
    name: activeSequenceName ?? sequenceNameForIndex(1),
    timelineItems,
    projectSettings: coerceWorkspaceProjectSettings(parsed.projectSettings),
    audioTrackCount,
    hiddenVideoTracks: parsed.hiddenVideoTracks,
    lockedTimelineTracks: parsed.lockedTimelineTracks,
    mutedAudioTracks: parsed.mutedAudioTracks,
    videoTrackCount,
    timelinePanelHeight: parsed.timelinePanelHeight,
    timelineInPointSec: parsed.timelineInPointSec,
    timelineOutPointSec: parsed.timelineOutPointSec,
  });
  const sequences = upsertWorkspaceSequence(
    Array.isArray(parsed.sequences)
      ? parsed.sequences
          .map(normalizeWorkspaceSequenceRecord)
          .filter((sequence): sequence is WorkspaceSequenceRecord => Boolean(sequence))
      : [],
    activeSequence
  );
  return {
    nodes,
    edges,
    projectAssets: normalizePersistedProjectAssets(parsed.projectAssets),
    projectMediaFolders: normalizePersistedProjectMediaFolders(parsed.projectMediaFolders),
    timelineItems,
    activeSequenceId,
    sequences,
    activeTemplateId: normalizeStudioProjectTemplateId(parsed.activeTemplateId),
    projectSettings: coerceWorkspaceProjectSettings(parsed.projectSettings),
    focusMode: parsed.focusMode === 'viewer' ? 'viewer' : 'canvas',
    audioTrackCount,
    hiddenVideoTracks: coerceHiddenVideoTracks(parsed.hiddenVideoTracks, videoTrackCount),
    lockedTimelineTracks: coerceTimelineTrackList(parsed.lockedTimelineTracks, videoTrackCount, audioTrackCount),
    mutedAudioTracks: coerceMutedAudioTracks(parsed.mutedAudioTracks, audioTrackCount),
    videoTrackCount,
    timelinePanelHeight: coerceTimelinePanelHeight(parsed.timelinePanelHeight),
    timelineInPointSec: coerceTimelineMarker(parsed.timelineInPointSec),
    timelineOutPointSec: coerceTimelineMarker(parsed.timelineOutPointSec),
  };
}
