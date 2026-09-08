import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import { assertStudioConnectedSchemaReady } from './connected-schema';
import { StudioConnectedPersistenceError } from './montage-command';
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
    ids.add(sequence.id);
    return {
      id: sequence.id,
      name: sequence.name.trim().slice(0, 200),
      projectSettings: sequence.projectSettings,
      timelineState: {
        timelineItems: sequence.timelineItems,
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

function stripTransientAccess(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTransientAccess);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as WorkspaceRecord)
    .filter(([key]) => key !== 'mediaAccessUrl' && key !== 'mediaAccessExpiresAt')
    .map(([key, nested]) => [key, stripTransientAccess(nested)]));
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
    for (const sequence of sequences) {
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
        JSON.stringify(stripTransientAccess(sequence.timelineState)),
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
