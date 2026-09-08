import { randomUUID } from 'node:crypto';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import type { StudioProjectRecord, StudioSequenceRecord } from './contracts';
import { ensureStudioProjectSchema } from './schema';

const DEFAULT_STUDIO_PROJECT_CANVAS_TEMPLATE_ID = 'minimal-start';

type StudioProjectRow = {
  id: string;
  user_id: string;
  name: string;
  canvas_template_id: string;
  settings: unknown;
  workspace_state: unknown;
  revision?: string | number | null;
  persistence_mode?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type StudioSequenceRow = {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  settings: unknown;
  timeline_state: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

function studioId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function isoDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function mapProject(row: StudioProjectRow): StudioProjectRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    canvasTemplateId: row.canvas_template_id,
    settings: row.settings,
    workspaceState: row.workspace_state,
    revision: Math.max(0, Number(row.revision ?? 0) || 0),
    persistenceMode: row.persistence_mode === 'connected' ? 'connected' : 'legacy',
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

function mapSequence(row: StudioSequenceRow): StudioSequenceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    name: row.name,
    settings: row.settings,
    timelineState: row.timeline_state,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

async function studioProjectAccess(
  params: { userId: string; projectId: string },
  executor: QueryExecutor = { query },
  lock = false,
): Promise<'legacy' | 'connected' | null> {
  const rows = await executor.query<{ id: string; persistence_mode: string }>(
    `SELECT id, COALESCE(to_jsonb(studio_projects)->>'persistence_mode', 'legacy') AS persistence_mode
       FROM studio_projects
      WHERE user_id = $1
        AND id = $2
        AND deleted_at IS NULL
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [params.userId, params.projectId]
  );
  return rows[0]?.persistence_mode === 'connected' ? 'connected' : rows[0] ? 'legacy' : null;
}

async function requireLegacyStudioProject(
  params: { userId: string; projectId: string },
  executor: QueryExecutor,
): Promise<void> {
  const access = await studioProjectAccess(params, executor, true);
  if (access === 'connected') throw new Error('STUDIO_CONNECTED_PROJECT_REVISION_REQUIRED');
  if (!access) throw new Error('STUDIO_PROJECT_NOT_FOUND');
}

export async function listStudioProjects(params: {
  userId: string;
  limit?: number;
}): Promise<StudioProjectRecord[]> {
  await ensureStudioProjectSchema();
  const limit = Math.max(1, Math.min(params.limit ?? 40, 100));
  const rows = await query<StudioProjectRow>(
    `SELECT id, user_id, name, canvas_template_id, settings, workspace_state,
            COALESCE((to_jsonb(studio_projects)->>'revision')::bigint, 0) AS revision,
            COALESCE(to_jsonb(studio_projects)->>'persistence_mode', 'legacy') AS persistence_mode,
            created_at, updated_at
       FROM studio_projects
      WHERE user_id = $1
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT $2`,
    [params.userId, limit]
  );
  return rows.map(mapProject);
}

export async function listStudioSequences(params: {
  userId: string;
  projectId: string;
  limit?: number;
}): Promise<StudioSequenceRecord[]> {
  await ensureStudioProjectSchema();
  const limit = Math.max(1, Math.min(params.limit ?? 100, 200));
  const rows = await query<StudioSequenceRow>(
    `SELECT id, user_id, project_id, name, settings, timeline_state, created_at, updated_at
       FROM studio_sequences
      WHERE user_id = $1
        AND project_id = $2
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT $3`,
    [params.userId, params.projectId, limit]
  );
  return rows.map(mapSequence);
}

export async function readStudioSequence(params: {
  userId: string;
  projectId: string;
  sequenceId: string;
}): Promise<StudioSequenceRecord | null> {
  await ensureStudioProjectSchema();
  const rows = await query<StudioSequenceRow>(
    `SELECT id, user_id, project_id, name, settings, timeline_state, created_at, updated_at
       FROM studio_sequences
      WHERE user_id = $1
        AND project_id = $2
        AND id = $3
        AND deleted_at IS NULL
      LIMIT 1`,
    [params.userId, params.projectId, params.sequenceId]
  );
  return rows[0] ? mapSequence(rows[0]) : null;
}

export async function upsertStudioSequence(params: {
  userId: string;
  projectId: string;
  id?: string;
  name: string;
  settings?: unknown;
  timelineState?: unknown;
}): Promise<StudioSequenceRecord> {
  await ensureStudioProjectSchema();
  const id = params.id?.trim() || studioId('sequence');
  const name = params.name.trim() || 'Untitled sequence';
  return withDbTransaction(async (executor) => {
    await requireLegacyStudioProject(params, executor);
    const rows = await executor.query<StudioSequenceRow>(
    `INSERT INTO studio_sequences (
        id, user_id, project_id, name, settings, timeline_state
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        settings = EXCLUDED.settings,
        timeline_state = EXCLUDED.timeline_state,
        updated_at = NOW(),
        deleted_at = NULL
      WHERE studio_sequences.user_id = EXCLUDED.user_id
        AND studio_sequences.project_id = EXCLUDED.project_id
      RETURNING id, user_id, project_id, name, settings, timeline_state, created_at, updated_at`,
    [
      id,
      params.userId,
      params.projectId,
      name,
      JSON.stringify(params.settings ?? {}),
      JSON.stringify(params.timelineState ?? {}),
    ]
  );
    if (!rows[0]) throw new Error('STUDIO_SEQUENCE_CONFLICT');
    return mapSequence(rows[0]);
  });
}

export async function deleteStudioSequence(params: {
  userId: string;
  projectId: string;
  sequenceId: string;
}): Promise<{ ok: true } | { ok: false; reason: 'last_sequence' | 'not_found' }> {
  await ensureStudioProjectSchema();
  return withDbTransaction(async (executor) => {
    await requireLegacyStudioProject(params, executor);
    const targetRows = await executor.query<{ id: string }>(
      `SELECT id
         FROM studio_sequences
        WHERE user_id = $1
          AND project_id = $2
          AND id = $3
          AND deleted_at IS NULL
        LIMIT 1`,
      [params.userId, params.projectId, params.sequenceId]
    );
    if (!targetRows[0]) return { ok: false, reason: 'not_found' };

    const countRows = await executor.query<{ count: string | number }>(
      `SELECT COUNT(*)::int AS count
         FROM studio_sequences
        WHERE user_id = $1
          AND project_id = $2
          AND deleted_at IS NULL`,
      [params.userId, params.projectId]
    );
    if (Number(countRows[0]?.count ?? 0) <= 1) return { ok: false, reason: 'last_sequence' };

    const rows = await executor.query<{ id: string }>(
      `UPDATE studio_sequences
          SET deleted_at = NOW(),
              updated_at = NOW()
        WHERE user_id = $1
          AND project_id = $2
          AND id = $3
          AND deleted_at IS NULL
        RETURNING id`,
      [params.userId, params.projectId, params.sequenceId]
    );
    return rows[0] ? { ok: true } : { ok: false, reason: 'not_found' };
  });
}

export async function readStudioProject(params: {
  userId: string;
  projectId: string;
}): Promise<StudioProjectRecord | null> {
  await ensureStudioProjectSchema();
  const rows = await query<StudioProjectRow>(
    `SELECT id, user_id, name, canvas_template_id, settings, workspace_state,
            COALESCE((to_jsonb(studio_projects)->>'revision')::bigint, 0) AS revision,
            COALESCE(to_jsonb(studio_projects)->>'persistence_mode', 'legacy') AS persistence_mode,
            created_at, updated_at
       FROM studio_projects
      WHERE user_id = $1
        AND id = $2
        AND deleted_at IS NULL
      LIMIT 1`,
    [params.userId, params.projectId]
  );
  return rows[0] ? mapProject(rows[0]) : null;
}

export async function upsertStudioProject(params: {
  userId: string;
  id?: string;
  name: string;
  canvasTemplateId?: string;
  settings?: unknown;
  workspaceState?: unknown;
}): Promise<StudioProjectRecord> {
  await ensureStudioProjectSchema();
  const id = params.id?.trim() || studioId('project');
  const name = params.name.trim() || 'Untitled edit';
  const canvasTemplateId = params.canvasTemplateId?.trim() || DEFAULT_STUDIO_PROJECT_CANVAS_TEMPLATE_ID;
  return withDbTransaction(async (executor) => {
    if (params.id?.trim()) {
      const access = await studioProjectAccess({ userId: params.userId, projectId: id }, executor, true);
      if (access === 'connected') throw new Error('STUDIO_CONNECTED_PROJECT_REVISION_REQUIRED');
    }
    const rows = await executor.query<StudioProjectRow>(
    `INSERT INTO studio_projects (
        id, user_id, name, canvas_template_id, settings, workspace_state
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        canvas_template_id = EXCLUDED.canvas_template_id,
        settings = EXCLUDED.settings,
        workspace_state = EXCLUDED.workspace_state,
        updated_at = NOW(),
        deleted_at = NULL
      WHERE studio_projects.user_id = EXCLUDED.user_id
        AND COALESCE(to_jsonb(studio_projects)->>'persistence_mode', 'legacy') <> 'connected'
      RETURNING id, user_id, name, canvas_template_id, settings, workspace_state,
                COALESCE((to_jsonb(studio_projects)->>'revision')::bigint, 0) AS revision,
                COALESCE(to_jsonb(studio_projects)->>'persistence_mode', 'legacy') AS persistence_mode,
                created_at, updated_at`,
    [
      id,
      params.userId,
      name,
      canvasTemplateId,
      JSON.stringify(params.settings ?? {}),
      JSON.stringify(params.workspaceState ?? {}),
    ]
  );
    if (!rows[0]) throw new Error('STUDIO_PROJECT_CONFLICT');
    return mapProject(rows[0]);
  });
}

export async function deleteStudioProject(params: {
  userId: string;
  projectId: string;
}): Promise<boolean> {
  await ensureStudioProjectSchema();
  return withDbTransaction(async (executor) => {
    await requireLegacyStudioProject(params, executor);
    const rows = await executor.query<{ id: string }>(
    `UPDATE studio_projects
        SET deleted_at = NOW(),
            updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
        AND deleted_at IS NULL
      RETURNING id`,
    [params.userId, params.projectId]
  );
    return Boolean(rows[0]);
  });
}
