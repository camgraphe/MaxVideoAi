import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import { assertStudioConnectedSchemaReady } from './connected-schema';
import { StudioConnectedPersistenceError } from './montage-command';
import type { StudioProjectRecord, StudioSequenceRecord } from './contracts';
import type { WorkspaceTimelineItem } from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import { normalizeWorkspaceTimelineItemsSourceMetadata } from '@/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-source-metadata';
import {
  normalizeWorkspaceEdgeTypes,
  normalizeWorkspaceGraphNodes,
} from '@/app/(core)/(workspace)/app/studio/workspace/_state/workspace-normalizers';
import { normalizeWorkspaceSequenceRecord } from '@/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state';
export { StudioConnectedPersistenceError } from './montage-command';

type TransactionRunner = <T>(callback: (executor: QueryExecutor) => Promise<T>) => Promise<T>;
type WorkspaceRecord = Record<string, unknown>;

export type SaveStudioWorkspaceInput = {
  projectId: string;
  expectedRevision: number;
  snapshot: {
    name: string;
    canvasTemplateId: string;
    settings: unknown;
    workspaceState: WorkspaceRecord;
  };
};

const defaultTransactionRunner: TransactionRunner = (callback) => withDbTransaction((executor) => callback(executor));

function objectRecord(value: unknown): WorkspaceRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as WorkspaceRecord : null;
}

function boundedString(value: unknown, maximum = 500): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

function finiteTimelineNumber(value: unknown, options: { minimum: number; maximum: number }): value is number {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= options.minimum && value <= options.maximum;
}

function validateTimelineItems(value: unknown, label: string): WorkspaceTimelineItem[] {
  if (!Array.isArray(value) || value.length > 5_000) {
    throw new Error(`Invalid Studio workspace ${label}.`);
  }
  const ids = new Set<string>();
  for (const candidate of value) {
    const item = objectRecord(candidate);
    if (!item
      || !boundedString(item.id, 200) || ids.has(item.id)
      || typeof item.outputNodeId !== 'string' || item.outputNodeId.length > 200
      || !boundedString(item.title, 500)
      || !boundedString(item.track, 50)
      || !['video', 'audio', 'image'].includes(String(item.mediaKind))
      || !finiteTimelineNumber(item.startSec, { minimum: 0, maximum: 86_400 })
      || !finiteTimelineNumber(item.durationSec, { minimum: Number.MIN_VALUE, maximum: 86_400 })
      || (item.sourceStartSec !== undefined
        && !finiteTimelineNumber(item.sourceStartSec, { minimum: 0, maximum: 86_400 }))
      || (item.sourceDurationSec !== undefined
        && !finiteTimelineNumber(item.sourceDurationSec, { minimum: Number.MIN_VALUE, maximum: 86_400 }))) {
      throw new Error(`Invalid Studio workspace ${label}.`);
    }
    ids.add(item.id);
  }
  // These canonical, pure normalizers are intentionally reached only after the
  // shape guard above. They must never receive arbitrary JSON such as [null].
  normalizeWorkspaceTimelineItemsSourceMetadata(value as WorkspaceTimelineItem[]);
  return value as WorkspaceTimelineItem[];
}

function validateWorkspaceGraph(workspace: WorkspaceRecord): void {
  const nodes = workspace.nodes;
  const edges = workspace.edges;
  if (!Array.isArray(nodes) || nodes.length > 500 || nodes.some((candidate) => {
    const node = objectRecord(candidate);
    return !node || !boundedString(node.id, 200) || !objectRecord(node.data);
  })) {
    throw new Error('Invalid Studio workspace graph nodes.');
  }
  if (!Array.isArray(edges) || edges.length > 2_000 || edges.some((candidate) => {
    const edge = objectRecord(candidate);
    return !edge || !boundedString(edge.id, 200)
      || !boundedString(edge.source, 200) || !boundedString(edge.target, 200)
      || (edge.type !== undefined && typeof edge.type !== 'string');
  })) {
    throw new Error('Invalid Studio workspace graph edges.');
  }
  normalizeWorkspaceGraphNodes(nodes as Parameters<typeof normalizeWorkspaceGraphNodes>[0]);
  normalizeWorkspaceEdgeTypes(edges as Parameters<typeof normalizeWorkspaceEdgeTypes>[0]);
  validateTimelineItems(workspace.timelineItems, 'root timeline items');
}

function validateSnapshot(input: SaveStudioWorkspaceInput): Array<{
  id: string;
  name: string;
  projectSettings: unknown;
  timelineState: WorkspaceRecord;
}> {
  if (!input || typeof input !== 'object' || !input.projectId?.trim() || input.projectId !== input.projectId.trim()) {
    throw new Error('Invalid Studio workspace save input.');
  }
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new Error('Invalid Studio workspace expected revision.');
  }
  const snapshot = objectRecord(input.snapshot);
  const workspace = objectRecord(input.snapshot?.workspaceState);
  if (!snapshot || !workspace || typeof input.snapshot.name !== 'string' || !input.snapshot.name.trim()
    || input.snapshot.name !== input.snapshot.name.trim() || input.snapshot.name.length > 200
    || typeof input.snapshot.canvasTemplateId !== 'string' || !input.snapshot.canvasTemplateId.trim()
    || !objectRecord(input.snapshot.settings)
    || !Array.isArray(workspace.nodes) || workspace.nodes.length > 500
    || !Array.isArray(workspace.edges) || workspace.edges.length > 2_000
    || !Array.isArray(workspace.timelineItems)
    || !Array.isArray(workspace.sequences) || workspace.sequences.length < 1 || workspace.sequences.length > 50
    || JSON.stringify(input.snapshot).length > 5_000_000) {
    throw new Error('Invalid Studio workspace snapshot; provide at least one sequence and bounded editor state.');
  }
  validateWorkspaceGraph(workspace);
  const ids = new Set<string>();
  const sequences = workspace.sequences.map((value, index) => {
    const sequence = objectRecord(value);
    if (!sequence || typeof sequence.id !== 'string' || !sequence.id.trim() || sequence.id !== sequence.id.trim()
      || sequence.id.length > 200 || ids.has(sequence.id)
      || typeof sequence.name !== 'string' || !sequence.name.trim()
      || !Array.isArray(sequence.timelineItems) || sequence.timelineItems.length > 5_000
      || !objectRecord(sequence.projectSettings)) {
      throw new Error(`Invalid Studio workspace sequence ${index + 1}.`);
    }
    const timelineItems = validateTimelineItems(sequence.timelineItems, `sequence ${index + 1} timeline items`);
    if (!normalizeWorkspaceSequenceRecord(sequence)) {
      throw new Error(`Invalid Studio workspace sequence ${index + 1}.`);
    }
    ids.add(sequence.id);
    return {
      id: sequence.id,
      name: sequence.name.trim().slice(0, 200),
      projectSettings: sequence.projectSettings,
      timelineState: {
        timelineItems,
        audioTrackCount: sequence.audioTrackCount,
        hiddenVideoTracks: sequence.hiddenVideoTracks,
        lockedTimelineTracks: sequence.lockedTimelineTracks,
        mutedAudioTracks: sequence.mutedAudioTracks,
        videoTrackCount: sequence.videoTrackCount,
        timelinePanelHeight: sequence.timelinePanelHeight,
        timelineInPointSec: sequence.timelineInPointSec,
        timelineOutPointSec: sequence.timelineOutPointSec,
      },
    };
  });
  if (typeof workspace.activeSequenceId !== 'string' || !ids.has(workspace.activeSequenceId)) {
    throw new Error('Invalid Studio workspace active sequence.');
  }
  return sequences;
}

function montageSourceByItemId(timelineState: unknown): Map<string, unknown> {
  const state = objectRecord(timelineState);
  if (!Array.isArray(state?.timelineItems)) return new Map();
  return new Map(state.timelineItems.flatMap((candidate): Array<[string, unknown]> => {
    const item = objectRecord(candidate);
    return item && typeof item.id === 'string' && objectRecord(item.montageSource)
      ? [[item.id, item.montageSource]]
      : [];
  }));
}

function preserveImmutableMontageSources(
  timelineState: WorkspaceRecord,
  existingSources: Map<string, unknown>,
): WorkspaceRecord {
  const timelineItems = (timelineState.timelineItems as WorkspaceTimelineItem[]).map((candidate) => {
    const item = { ...candidate } as WorkspaceTimelineItem;
    delete item.montageSource;
    const persistedSource = existingSources.get(item.id);
    return persistedSource ? { ...item, montageSource: persistedSource } : item;
  });
  return { ...timelineState, timelineItems };
}

function stripTransientAccess(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTransientAccess);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as WorkspaceRecord)
    .filter(([key]) => key !== 'mediaAccessUrl' && key !== 'mediaAccessExpiresAt')
    .map(([key, nested]) => [key, stripTransientAccess(nested)]));
}

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function readStudioWorkspace(
  actor: { userId: string },
  projectId: string,
  dependencies: {
    withTransaction?: TransactionRunner;
    afterProjectLock?: () => void | Promise<void>;
  } = {},
): Promise<{ project: StudioProjectRecord; sequences: StudioSequenceRecord[] }> {
  if (!actor.userId || actor.userId !== actor.userId.trim() || !projectId?.trim() || projectId !== projectId.trim()) {
    throw new Error('UNAUTHORIZED');
  }
  const runTransaction = dependencies.withTransaction ?? defaultTransactionRunner;
  return runTransaction(async (executor) => {
    await assertStudioConnectedSchemaReady(executor);
    const projects = await executor.query<{
      id: string; user_id: string; name: string; canvas_template_id: string; settings: unknown;
      workspace_state: unknown; revision: string | number; persistence_mode: string;
      created_at: Date | string; updated_at: Date | string;
    }>(`
      SELECT id, user_id, name, canvas_template_id, settings, workspace_state,
             revision, persistence_mode, created_at, updated_at
        FROM studio_projects
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       FOR SHARE
    `, [projectId, actor.userId]);
    const row = projects[0];
    if (!row) throw new Error('STUDIO_PROJECT_NOT_FOUND');
    if (row.persistence_mode !== 'connected') {
      throw new StudioConnectedPersistenceError('STUDIO_CONNECTED_PROJECT_REQUIRED', 409);
    }
    await dependencies.afterProjectLock?.();
    const sequenceRows = await executor.query<{
      id: string; user_id: string; project_id: string; name: string; settings: unknown;
      timeline_state: unknown; created_at: Date | string; updated_at: Date | string;
    }>(`
      SELECT id, user_id, project_id, name, settings, timeline_state, created_at, updated_at
        FROM studio_sequences
       WHERE project_id = $1 AND user_id = $2 AND deleted_at IS NULL
       ORDER BY created_at, id
    `, [projectId, actor.userId]);
    return {
      project: {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        canvasTemplateId: row.canvas_template_id,
        settings: row.settings,
        workspaceState: row.workspace_state,
        revision: Number(row.revision),
        persistenceMode: 'connected',
        createdAt: isoDate(row.created_at),
        updatedAt: isoDate(row.updated_at),
      },
      sequences: sequenceRows.map((sequence) => ({
        id: sequence.id,
        userId: sequence.user_id,
        projectId: sequence.project_id,
        name: sequence.name,
        settings: sequence.settings,
        timelineState: sequence.timeline_state,
        createdAt: isoDate(sequence.created_at),
        updatedAt: isoDate(sequence.updated_at),
      })),
    };
  });
}

export async function saveStudioWorkspace(
  actor: { userId: string },
  input: SaveStudioWorkspaceInput,
  dependencies: { withTransaction?: TransactionRunner } = {},
): Promise<{ projectId: string; revision: number }> {
  if (!actor.userId || actor.userId !== actor.userId.trim()) throw new Error('UNAUTHORIZED');
  const sequences = validateSnapshot(input);
  const runTransaction = dependencies.withTransaction ?? defaultTransactionRunner;
  return runTransaction(async (executor) => {
    await assertStudioConnectedSchemaReady(executor);
    const projects = await executor.query<{ revision: string | number; persistence_mode: string }>(`
      SELECT revision, persistence_mode
        FROM studio_projects
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       FOR UPDATE
    `, [input.projectId, actor.userId]);
    const project = projects[0];
    if (!project) throw new Error('STUDIO_PROJECT_NOT_FOUND');
    if (project.persistence_mode !== 'connected') {
      throw new StudioConnectedPersistenceError('STUDIO_CONNECTED_PROJECT_REQUIRED', 409);
    }
    const currentRevision = Number(project.revision);
    if (currentRevision !== input.expectedRevision) {
      throw new StudioConnectedPersistenceError('STUDIO_REVISION_CONFLICT', 409);
    }
    const existingSequenceRows = await executor.query<{ id: string; timeline_state: unknown }>(`
      SELECT id, timeline_state
        FROM studio_sequences
       WHERE project_id = $1 AND user_id = $2 AND deleted_at IS NULL
       FOR UPDATE
    `, [input.projectId, actor.userId]);
    const immutableSourcesBySequenceId = new Map(existingSequenceRows.map((row) => (
      [row.id, montageSourceByItemId(row.timeline_state)]
    )));
    for (const sequence of sequences) {
      const timelineState = preserveImmutableMontageSources(
        sequence.timelineState,
        immutableSourcesBySequenceId.get(sequence.id) ?? new Map(),
      );
      const rows = await executor.query<{ id: string }>(`
        INSERT INTO studio_sequences (id, user_id, project_id, name, settings, timeline_state)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          settings = EXCLUDED.settings,
          timeline_state = EXCLUDED.timeline_state,
          updated_at = NOW()
        WHERE studio_sequences.user_id = EXCLUDED.user_id
          AND studio_sequences.project_id = EXCLUDED.project_id
          AND studio_sequences.deleted_at IS NULL
        RETURNING id
      `, [
        sequence.id,
        actor.userId,
        input.projectId,
        sequence.name,
        JSON.stringify(stripTransientAccess(sequence.projectSettings)),
        JSON.stringify(stripTransientAccess(timelineState)),
      ]);
      if (!rows[0]) throw new Error('STUDIO_SEQUENCE_CONFLICT');
    }
    const sequenceIds = sequences.map((sequence) => sequence.id);
    await executor.query(`
      UPDATE studio_sequences
         SET deleted_at = NOW(), updated_at = NOW()
       WHERE project_id = $1 AND user_id = $2 AND deleted_at IS NULL
         AND NOT (id = ANY($3::text[]))
    `, [input.projectId, actor.userId, sequenceIds]);
    const workspaceState = {
      ...input.snapshot.workspaceState,
      timelineItems: [],
      sequences: [],
    };
    const updated = await executor.query<{ revision: string | number }>(`
      UPDATE studio_projects
         SET name = $3,
             canvas_template_id = $4,
             settings = $5::jsonb,
             workspace_state = $6::jsonb,
             revision = revision + 1,
             updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
         AND persistence_mode = 'connected' AND revision = $7
       RETURNING revision
    `, [
      input.projectId,
      actor.userId,
      input.snapshot.name,
      input.snapshot.canvasTemplateId,
      JSON.stringify(stripTransientAccess(input.snapshot.settings)),
      JSON.stringify(stripTransientAccess(workspaceState)),
      input.expectedRevision,
    ]);
    if (!updated[0]) throw new StudioConnectedPersistenceError('STUDIO_REVISION_CONFLICT', 409);
    return { projectId: input.projectId, revision: Number(updated[0].revision) };
  });
}
