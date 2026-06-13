import { authFetch } from '@/lib/authFetch';
import {
  createStarterWorkspaceTemplate,
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
  WorkspaceNodeGeneratedCopy,
  WorkspaceProjectMediaFolder,
  WorkspaceTemplateId,
  WorkspaceTimelineItem,
  WorkspaceTimelineItemGeneratedCopy,
} from '../_lib/workspace-types';
import {
  normalizeGeneratedOutputEdges,
  normalizeOutputOnlySourceEdges,
  normalizeShotOutputEdges,
  normalizeTimelineMediaUrls,
  normalizeWorkspaceEdgeTypes,
  normalizeWorkspaceGraphNodes,
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
  readStudioSequencesFromApiResult,
  saveStudioSequencesToApi,
} from './workspace-sequence-api-persistence';

export type StudioApiSyncStatus = 'ready' | 'unauthorized' | 'unavailable' | 'error';

export type StudioApiResult<T> = {
  data: T | null;
  status: StudioApiSyncStatus;
};

export function studioApiSyncStatusFromResponse(response: Response): StudioApiSyncStatus {
  if (response.status === 401) return 'unauthorized';
  if (response.status === 503) return 'unavailable';
  if (!response.ok) return 'error';
  return 'ready';
}

export function normalizeStudioProjectTemplateId(value: unknown): WorkspaceTemplateId {
  if (typeof value === 'string' && WORKSPACE_TEMPLATE_SUMMARIES.some((template) => template.id === value)) {
    return value as WorkspaceTemplateId;
  }
  return 'product-ad';
}

type NormalizePersistedWorkspaceStateOptions = {
  canvasTemplateId?: WorkspaceTemplateId;
};

function starterTemplateIdForPersistedWorkspace(
  parsed: Partial<PersistedWorkspaceState>,
  options?: NormalizePersistedWorkspaceStateOptions
): WorkspaceTemplateId {
  return normalizeStudioProjectTemplateId(parsed.activeTemplateId ?? options?.canvasTemplateId);
}

function mergeNodeGeneratedCopyField(
  generatedCopy: WorkspaceNodeGeneratedCopy | undefined,
  field: keyof WorkspaceNodeGeneratedCopy,
  currentValue: unknown,
  starterValue: unknown,
  starterGeneratedCopy: WorkspaceNodeGeneratedCopy | undefined
): WorkspaceNodeGeneratedCopy | undefined {
  const reference = starterGeneratedCopy?.[field];
  // A present field, including null, is a modern marker: do not infer legacy
  // starter provenance after a user has cleared generated copy on that field.
  const hasModernFieldMarker = generatedCopy ? Object.prototype.hasOwnProperty.call(generatedCopy, field) : false;
  if (!reference || hasModernFieldMarker || currentValue !== starterValue) return generatedCopy;
  return { ...generatedCopy, [field]: reference };
}

function nodeMatchesStarterGeneratedCopyContext(
  node: WorkspaceGraphNode,
  starterNode: WorkspaceGraphNode
): boolean {
  if (node.id !== starterNode.id || node.type !== starterNode.type || node.data.kind !== starterNode.data.kind) return false;
  if (starterNode.data.promptRole && node.data.promptRole !== starterNode.data.promptRole) return false;
  if (starterNode.data.asset?.id && node.data.asset?.id !== starterNode.data.asset.id) return false;
  if (starterNode.data.asset?.filename && node.data.asset?.filename !== starterNode.data.asset.filename) return false;
  if (starterNode.data.shot) {
    if (!node.data.shot) return false;
    if (node.data.shot.modelId !== starterNode.data.shot.modelId) return false;
    if (node.data.shot.durationSec !== starterNode.data.shot.durationSec) return false;
  }
  if (starterNode.data.output?.sourceShotId && node.data.output?.sourceShotId !== starterNode.data.output.sourceShotId) {
    return false;
  }
  return true;
}

function migrateStarterGeneratedCopyForNodes(
  templateId: WorkspaceTemplateId,
  nodes: WorkspaceGraphNode[]
): WorkspaceGraphNode[] {
  const starterNodesById = new Map(createStarterWorkspaceTemplate(templateId).nodes.map((node) => [node.id, node]));
  return nodes.map((node) => {
    const starterNode = starterNodesById.get(node.id);
    if (!starterNode || !nodeMatchesStarterGeneratedCopyContext(node, starterNode)) return node;

    let generatedCopy = node.data.generatedCopy;
    generatedCopy = mergeNodeGeneratedCopyField(generatedCopy, 'title', node.data.title, starterNode.data.title, starterNode.data.generatedCopy);
    generatedCopy = mergeNodeGeneratedCopyField(generatedCopy, 'subtitle', node.data.subtitle, starterNode.data.subtitle, starterNode.data.generatedCopy);
    generatedCopy = mergeNodeGeneratedCopyField(
      generatedCopy,
      'promptText',
      node.data.promptText,
      starterNode.data.promptText,
      starterNode.data.generatedCopy
    );
    generatedCopy = mergeNodeGeneratedCopyField(
      generatedCopy,
      'shotOutputName',
      node.data.shot?.outputName,
      starterNode.data.shot?.outputName,
      starterNode.data.generatedCopy
    );

    return generatedCopy === node.data.generatedCopy
      ? node
      : {
          ...node,
          data: {
            ...node.data,
            generatedCopy,
          },
        };
  });
}

function mergeTimelineGeneratedCopyField(
  generatedCopy: WorkspaceTimelineItemGeneratedCopy | undefined,
  currentTitle: string,
  starterItem: WorkspaceTimelineItem
): WorkspaceTimelineItemGeneratedCopy | undefined {
  const reference = starterItem.generatedCopy?.title;
  // See node migration above: null means "custom text, do not re-infer".
  const hasModernFieldMarker = generatedCopy ? Object.prototype.hasOwnProperty.call(generatedCopy, 'title') : false;
  if (!reference || hasModernFieldMarker || currentTitle !== starterItem.title) return generatedCopy;
  return { ...generatedCopy, title: reference };
}

function timelineItemMatchesStarterGeneratedCopyContext(
  item: WorkspaceTimelineItem,
  starterItem: WorkspaceTimelineItem
): boolean {
  return (
    item.id === starterItem.id &&
    item.outputNodeId === starterItem.outputNodeId &&
    item.track === starterItem.track &&
    item.mediaKind === starterItem.mediaKind &&
    item.startSec === starterItem.startSec &&
    item.durationSec === starterItem.durationSec
  );
}

function migrateStarterGeneratedCopyForTimelineItems(
  templateId: WorkspaceTemplateId,
  items: WorkspaceTimelineItem[]
): WorkspaceTimelineItem[] {
  const starterItemsById = new Map(createStarterWorkspaceTemplate(templateId).timelineItems.map((item) => [item.id, item]));
  return items.map((item) => {
    const starterItem = starterItemsById.get(item.id);
    if (!starterItem || !timelineItemMatchesStarterGeneratedCopyContext(item, starterItem)) return item;
    const generatedCopy = mergeTimelineGeneratedCopyField(item.generatedCopy, item.title, starterItem);
    return generatedCopy === item.generatedCopy ? item : { ...item, generatedCopy };
  });
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
  const result = await readStudioProjectFromApiResult(projectId, signal);
  return result.data;
}

export async function readStudioProjectFromApiResult(
  projectId: string,
  signal?: AbortSignal
): Promise<StudioApiResult<StudioProjectStorageRecord>> {
  try {
    const response = await authFetch(`/api/studio/projects/${encodeURIComponent(projectId)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return { data: null, status };
    const payload = await response.json().catch(() => null);
    if (!payload?.ok) return { data: null, status: 'error' };
    return { data: normalizeStudioProjectApiRecord(payload.project), status: 'ready' };
  } catch {
    return { data: null, status: 'error' };
  }
}

export async function saveStudioProjectToApi(params: {
  projectId: string;
  name: string;
  canvasTemplateId: WorkspaceTemplateId;
  settings: StudioProjectStorageRecord['settings'];
  workspaceState: PersistedWorkspaceState;
  signal?: AbortSignal;
}): Promise<StudioApiSyncStatus> {
  try {
    const response = await authFetch(`/api/studio/projects/${encodeURIComponent(params.projectId)}`, {
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
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return status;
    const payload = await response.json().catch(() => null);
    return payload?.ok ? 'ready' : 'error';
  } catch {
    // Server persistence is best effort; local workspace storage remains the fallback.
    return 'error';
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
  const migratedServerSequences = serverSequences.map((sequence) => ({
    ...sequence,
    timelineItems: migrateStarterGeneratedCopyForTimelineItems(persisted.activeTemplateId, sequence.timelineItems),
  }));

  const activeSequenceId = migratedServerSequences.some((sequence) => sequence.id === persisted.activeSequenceId)
    ? persisted.activeSequenceId
    : migratedServerSequences[0].id;
  const activeSequence = migratedServerSequences.find((sequence) => sequence.id === activeSequenceId) ?? migratedServerSequences[0];

  return {
    ...persisted,
    activeSequenceId,
    sequences: migratedServerSequences,
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
}): Promise<StudioApiSyncStatus> {
  const sequenceSyncStatus = await saveStudioSequencesToApi({
    projectId: params.projectId,
    sequences: params.workspaceState.sequences ?? [],
    signal: params.signal,
  });
  const projectSyncStatus = await saveStudioProjectToApi({
    ...params,
    workspaceState: sequenceSyncStatus === 'ready'
      ? stripWorkspaceSequencesForProjectApi(params.workspaceState)
      : params.workspaceState,
  });
  if (projectSyncStatus !== 'ready') return projectSyncStatus;
  return sequenceSyncStatus;
}

export function describeCanvasTemplate(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): string {
  return `${nodes.length} block${nodes.length === 1 ? '' : 's'} · ${edges.length} link${edges.length === 1 ? '' : 's'}`;
}

export function normalizeUserCanvasTemplate(value: unknown): WorkspaceUserCanvasTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<WorkspaceUserCanvasTemplate>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;
  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) return null;
  const nodes = normalizeWorkspaceGraphNodes(record.nodes);
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
  const result = await readUserCanvasTemplatesFromApiResult(signal);
  return result.data;
}

export async function readUserCanvasTemplatesFromApiResult(
  signal?: AbortSignal
): Promise<StudioApiResult<WorkspaceUserCanvasTemplate[]>> {
  try {
    const response = await authFetch('/api/studio/canvas-templates', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return { data: null, status };
    const payload = await response.json().catch(() => null);
    if (!payload?.ok || !Array.isArray(payload.templates)) return { data: null, status: 'error' };
    return {
      data: payload.templates
        .map(normalizeUserCanvasTemplate)
        .filter((template: WorkspaceUserCanvasTemplate | null): template is WorkspaceUserCanvasTemplate => Boolean(template)),
      status: 'ready',
    };
  } catch {
    return { data: null, status: 'error' };
  }
}

export async function saveUserCanvasTemplateToApi(template: WorkspaceUserCanvasTemplate): Promise<StudioApiSyncStatus> {
  try {
    const response = await authFetch('/api/studio/canvas-templates', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template }),
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return status;
    const payload = await response.json().catch(() => null);
    return payload?.ok ? 'ready' : 'error';
  } catch {
    // User templates are still persisted locally when the API is unavailable.
    return 'error';
  }
}

export async function deleteUserCanvasTemplateFromApi(templateId: string): Promise<StudioApiSyncStatus> {
  try {
    const response = await authFetch(`/api/studio/canvas-templates/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return status;
    const payload = await response.json().catch(() => null);
    return payload?.ok ? 'ready' : 'error';
  } catch {
    // User templates are still deleted locally when the API is unavailable.
    return 'error';
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
    folderId: typeof record.folderId === 'string' && record.folderId.trim() ? record.folderId : null,
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

function normalizeProjectMediaAssetFolders(
  assets: WorkspaceAssetRecord[],
  folders: WorkspaceProjectMediaFolder[]
): WorkspaceAssetRecord[] {
  const folderIds = new Set(folders.map((folder) => folder.id));
  return assets.map((asset) => ({
    ...asset,
    folderId: asset.folderId && folderIds.has(asset.folderId) ? asset.folderId : null,
  }));
}

export function normalizePersistedWorkspaceState(
  value: unknown,
  options?: NormalizePersistedWorkspaceStateOptions
): PersistedWorkspaceState | null {
  const parsed = value as Partial<PersistedWorkspaceState> | null;
  if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || !Array.isArray(parsed.timelineItems)) return null;
  const activeTemplateId = starterTemplateIdForPersistedWorkspace(parsed, options);
  const normalizedNodes = normalizeWorkspaceGraphNodes(parsed.nodes);
  const nodes = migrateStarterGeneratedCopyForNodes(activeTemplateId, normalizedNodes);
  const edges = normalizeWorkspaceEdgeTypes(
    normalizeGeneratedOutputEdges(nodes, normalizeShotOutputEdges(nodes, normalizeOutputOnlySourceEdges(nodes, parsed.edges)))
  );
  const timelineItems = migrateStarterGeneratedCopyForTimelineItems(
    activeTemplateId,
    normalizeWorkspaceTimelineIdentities(normalizeTimelineMediaUrls(nodes, parsed.timelineItems))
  );
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
          .map((sequence) => ({
            ...sequence,
            timelineItems: migrateStarterGeneratedCopyForTimelineItems(activeTemplateId, sequence.timelineItems),
          }))
      : [],
    activeSequence
  );
  const projectMediaFolders = normalizePersistedProjectMediaFolders(parsed.projectMediaFolders);
  return {
    nodes,
    edges,
    projectAssets: normalizeProjectMediaAssetFolders(normalizePersistedProjectAssets(parsed.projectAssets), projectMediaFolders),
    projectMediaFolders,
    timelineItems,
    activeSequenceId,
    sequences,
    activeTemplateId,
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
