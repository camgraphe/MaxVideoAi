import { z } from 'zod';
import type { QueryExecutor } from '@/lib/db';

const inputSchema = z.object({
  userId: z.string().min(1).max(200),
  projectIds: z.array(z.string().min(1).max(200)).min(1).max(100),
}).strict();
const rowSchema = z.object({ id: z.string(), fingerprint: z.string().regex(/^[a-f0-9]{32}$/) }).strict();
export const privateCanvasCleanupPlanSchema = z.object({
  version: z.literal(1),
  userId: z.string().min(1).max(200),
  projects: z.array(rowSchema).min(1).max(100),
  sequences: z.array(rowSchema).max(1000).default([]),
}).strict();
export type PrivateCanvasCleanupPlan = z.infer<typeof privateCanvasCleanupPlanSchema>;
type ReferenceColumn = { table_name: string; column_name: string };

function identifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error('CANVAS_REFERENCE_SCHEMA_UNEXPECTED');
  return `"${value}"`;
}
async function referenceColumns(executor: QueryExecutor): Promise<ReferenceColumn[]> {
  return executor.query<ReferenceColumn>(`SELECT DISTINCT table_name,column_name FROM information_schema.columns
    WHERE table_schema='public' AND (column_name IN ('project_id','studio_project_id','sequence_id','studio_sequence_id')
      OR (table_name='app_timeline_exports' AND column_name='render_manifest')) ORDER BY table_name,column_name`);
}
async function assertNoReferences(executor: QueryExecutor, ids: string[], columns: ReferenceColumn[]) {
  for (const column of columns) {
    const rows = await executor.query(`SELECT 1 FROM public.${identifier(column.table_name)} WHERE ${identifier(column.column_name)}=ANY($1::text[]) LIMIT 1`, [ids]);
    if (rows.length) throw new Error(`CANVAS_REFERENCED:${column.table_name}`);
  }
}

/** No bootstrap or writes. Only private sequence rows may cascade; media/financial rows block deletion. */
export async function previewPrivateCanvasCleanup(executor: QueryExecutor, rawInput: unknown): Promise<PrivateCanvasCleanupPlan> {
  const input = inputSchema.parse(rawInput), ids = [...new Set(input.projectIds)].sort();
  if (ids.length !== input.projectIds.length) throw new Error('CANVAS_DUPLICATE_IDS');
  const rows = await executor.query<{ id: string; user_id: string; persistence_mode: string; fingerprint: string }>(
    `SELECT id,user_id,persistence_mode,md5(to_jsonb(p)::text) AS fingerprint FROM studio_projects p WHERE id=ANY($1::text[]) ORDER BY id`, [ids]);
  if (rows.length !== ids.length || rows.some(row => row.user_id !== input.userId || row.persistence_mode !== 'legacy')) throw new Error('NOT_PRIVATE_CANVAS');
  const columns = await referenceColumns(executor);
  const sequences = columns.some(row => row.table_name === 'studio_sequences' && row.column_name === 'project_id')
    ? await executor.query<{ id: string; user_id: string; fingerprint: string }>(
      `SELECT id,user_id,md5(to_jsonb(s)::text) AS fingerprint FROM studio_sequences s WHERE project_id=ANY($1::text[]) ORDER BY id`, [ids]) : [];
  if (sequences.some(row => row.user_id !== input.userId)) throw new Error('NOT_PRIVATE_CANVAS_SEQUENCE');
  await assertNoReferences(executor, ids, columns.filter(row => ['project_id', 'studio_project_id'].includes(row.column_name)
    && !(row.table_name === 'studio_sequences' && row.column_name === 'project_id')));
  const sequenceIds = sequences.map(row => row.id);
  await assertNoReferences(executor, sequenceIds, columns.filter(row => ['sequence_id', 'studio_sequence_id'].includes(row.column_name)));
  if (columns.some(row => row.table_name === 'app_timeline_exports' && row.column_name === 'render_manifest')) {
    const exports = await executor.query(`SELECT 1 FROM app_timeline_exports
      WHERE render_manifest->>'sequenceId'=ANY($1::text[]) OR render_manifest->>'projectId'=ANY($2::text[]) LIMIT 1`, [sequenceIds, ids]);
    if (exports.length) throw new Error('CANVAS_REFERENCED:app_timeline_exports');
  }
  return { version: 1, userId: input.userId, projects: rows.map(({ id, fingerprint }) => ({ id, fingerprint })),
    sequences: sequences.map(({ id, fingerprint }) => ({ id, fingerprint })) };
}

/** Run on one dedicated client in a READ COMMITTED transaction; locked reads must use fresh snapshots. */
export async function applyPrivateCanvasCleanup(executor: QueryExecutor, rawPlan: unknown): Promise<{ deletedIds: string[]; alreadyDeleted?: true }> {
  const plan = privateCanvasCleanupPlanSchema.parse(rawPlan), ids = plan.projects.map(row => row.id).sort();
  if (new Set(ids).size !== ids.length || new Set(plan.sequences.map(row => row.id)).size !== plan.sequences.length) throw new Error('CANVAS_DUPLICATE_IDS');
  const isolation = await executor.query<{ isolation: string }>("SELECT current_setting('transaction_isolation') AS isolation");
  if (isolation[0]?.isolation !== 'read committed') throw new Error('CANVAS_REQUIRES_READ_COMMITTED');
  await executor.query('LOCK TABLE studio_projects IN SHARE ROW EXCLUSIVE MODE');
  // Freeze scoped reference writers, including financial associations without foreign keys.
  const columns = await referenceColumns(executor);
  for (const table of [...new Set(columns.map(row => row.table_name))].sort()) await executor.query(`LOCK TABLE public.${identifier(table)} IN SHARE MODE`);
  const existing = await executor.query('SELECT id FROM studio_projects WHERE id=ANY($1::text[])', [ids]);
  if (!existing.length) return { deletedIds: [], alreadyDeleted: true };
  const current = await previewPrivateCanvasCleanup(executor, { userId: plan.userId, projectIds: ids });
  const fingerprintSet = (rows: Array<{ id: string; fingerprint: string }>) => JSON.stringify([...rows].sort((a, b) => a.id.localeCompare(b.id)));
  if (fingerprintSet(current.projects) !== fingerprintSet(plan.projects) || fingerprintSet(current.sequences) !== fingerprintSet(plan.sequences)) throw new Error('CANVAS_CHANGED');
  const deleted = await executor.query<{ id: string }>(`DELETE FROM studio_projects WHERE user_id=$1 AND persistence_mode='legacy' AND id=ANY($2::text[]) RETURNING id`, [plan.userId, ids]);
  const deletedIds = deleted.map(row => row.id).sort();
  if (JSON.stringify(deletedIds) !== JSON.stringify(ids)) throw new Error('CANVAS_DELETE_SCOPE_CHANGED');
  return { deletedIds };
}
