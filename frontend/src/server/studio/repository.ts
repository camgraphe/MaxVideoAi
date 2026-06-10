import { randomUUID } from 'node:crypto';
import { query, withDbTransaction } from '@/lib/db';
import type { StudioCanvasTemplateRecord, StudioProjectRecord, StudioSequenceRecord } from './contracts';
import { ensureStudioProjectSchema } from './schema';

type StudioProjectRow = {
  id: string;
  user_id: string;
  name: string;
  canvas_template_id: string;
  settings: unknown;
  workspace_state: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

type StudioCanvasTemplateRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  nodes: unknown;
  edges: unknown;
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

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mapProject(row: StudioProjectRow): StudioProjectRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    canvasTemplateId: row.canvas_template_id,
    settings: row.settings,
    workspaceState: row.workspace_state,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

function mapCanvasTemplate(row: StudioCanvasTemplateRow): StudioCanvasTemplateRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    nodes: jsonArray(row.nodes),
    edges: jsonArray(row.edges),
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

async function hasStudioProjectAccess(params: { userId: string; projectId: string }): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `SELECT id
       FROM studio_projects
      WHERE user_id = $1
        AND id = $2
        AND deleted_at IS NULL
      LIMIT 1`,
    [params.userId, params.projectId]
  );
  return Boolean(rows[0]);
}

export async function listStudioProjects(params: {
  userId: string;
  limit?: number;
}): Promise<StudioProjectRecord[]> {
  await ensureStudioProjectSchema();
  const limit = Math.max(1, Math.min(params.limit ?? 40, 100));
  const rows = await query<StudioProjectRow>(
    `SELECT id, user_id, name, canvas_template_id, settings, workspace_state, created_at, updated_at
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
  if (!(await hasStudioProjectAccess(params))) throw new Error('STUDIO_PROJECT_NOT_FOUND');

  const id = params.id?.trim() || studioId('sequence');
  const name = params.name.trim() || 'Untitled sequence';
  const rows = await query<StudioSequenceRow>(
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
}

export async function deleteStudioSequence(params: {
  userId: string;
  projectId: string;
  sequenceId: string;
}): Promise<{ ok: true } | { ok: false; reason: 'last_sequence' | 'not_found' }> {
  await ensureStudioProjectSchema();
  return withDbTransaction(async (executor) => {
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
    `SELECT id, user_id, name, canvas_template_id, settings, workspace_state, created_at, updated_at
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
  const rows = await query<StudioProjectRow>(
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
      RETURNING id, user_id, name, canvas_template_id, settings, workspace_state, created_at, updated_at`,
    [
      id,
      params.userId,
      name,
      params.canvasTemplateId?.trim() || 'product-ad',
      JSON.stringify(params.settings ?? {}),
      JSON.stringify(params.workspaceState ?? {}),
    ]
  );
  if (!rows[0]) throw new Error('STUDIO_PROJECT_CONFLICT');
  return mapProject(rows[0]);
}

export async function deleteStudioProject(params: {
  userId: string;
  projectId: string;
}): Promise<boolean> {
  await ensureStudioProjectSchema();
  const rows = await query<{ id: string }>(
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
}

export async function listStudioCanvasTemplates(params: {
  userId: string;
  limit?: number;
}): Promise<StudioCanvasTemplateRecord[]> {
  await ensureStudioProjectSchema();
  const limit = Math.max(1, Math.min(params.limit ?? 40, 100));
  const rows = await query<StudioCanvasTemplateRow>(
    `SELECT id, user_id, name, description, nodes, edges, created_at, updated_at
       FROM studio_canvas_templates
      WHERE user_id = $1
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT $2`,
    [params.userId, limit]
  );
  return rows.map(mapCanvasTemplate);
}

export async function upsertStudioCanvasTemplate(params: {
  userId: string;
  id?: string;
  name: string;
  description?: string;
  nodes?: unknown;
  edges?: unknown;
}): Promise<StudioCanvasTemplateRecord> {
  await ensureStudioProjectSchema();
  const id = params.id?.trim() || studioId('canvas_template');
  const name = params.name.trim() || 'Untitled canvas template';
  const rows = await query<StudioCanvasTemplateRow>(
    `INSERT INTO studio_canvas_templates (
        id, user_id, name, description, nodes, edges
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        nodes = EXCLUDED.nodes,
        edges = EXCLUDED.edges,
        updated_at = NOW(),
        deleted_at = NULL
      WHERE studio_canvas_templates.user_id = EXCLUDED.user_id
      RETURNING id, user_id, name, description, nodes, edges, created_at, updated_at`,
    [
      id,
      params.userId,
      name,
      params.description?.trim() ?? '',
      JSON.stringify(Array.isArray(params.nodes) ? params.nodes : []),
      JSON.stringify(Array.isArray(params.edges) ? params.edges : []),
    ]
  );
  if (!rows[0]) throw new Error('STUDIO_CANVAS_TEMPLATE_CONFLICT');
  return mapCanvasTemplate(rows[0]);
}

export async function deleteStudioCanvasTemplate(params: {
  userId: string;
  templateId: string;
}): Promise<boolean> {
  await ensureStudioProjectSchema();
  const rows = await query<{ id: string }>(
    `UPDATE studio_canvas_templates
        SET deleted_at = NOW(),
            updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
        AND deleted_at IS NULL
      RETURNING id`,
    [params.userId, params.templateId]
  );
  return Boolean(rows[0]);
}
