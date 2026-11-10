import type { QueryExecutor } from '@/lib/db';
import { PURGE_JOB_FIELDS } from './purge-source-plan';

/** Build once per worker batch. Optional columns/tables are resolved here, so the
 * object check never serializes full jobs (including pricing and input payloads).
 * These possible path aliases can retain bytes, never authorize their deletion. */
export async function readPurgeProjectionRetentionSql(executor: QueryExecutor): Promise<string> {
  const tables = ['app_jobs', 'character_studio_characters', 'character_studio_looks'];
  const columns = await executor.query<{ table_name: string; column_name: string }>(`SELECT relations.name AS table_name,a.attname AS column_name
    FROM unnest($1::text[]) AS relations(name) JOIN pg_attribute a ON a.attrelid=to_regclass(relations.name)
    WHERE a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY($2::text[])`, [tables, [...PURGE_JOB_FIELDS, 'image_url']]);
  const present = (table: string, column: string) => columns.some(row => row.table_name === table && row.column_name === column);
  const key = (value: string) => `library_possible_storage_key(${value})`;
  const queries: string[] = [], jobPredicates: string[] = [];
  const scalar = PURGE_JOB_FIELDS.filter(column => !['render_ids', 'keyframe_urls'].includes(column) && present('app_jobs', column));
  if (scalar.length) jobPredicates.push(`$1=ANY(ARRAY[${scalar.map(column => key(`j.${column}`)).join(',')}])`);
  if (present('app_jobs', 'keyframe_urls')) jobPredicates.push(`EXISTS(SELECT 1 FROM jsonb_each(
    CASE WHEN jsonb_typeof(j.keyframe_urls)='object' THEN j.keyframe_urls ELSE '{}'::jsonb END) frame
    WHERE jsonb_typeof(frame.value)='string' AND $1=${key("frame.value#>>'{}'")})`);
  if (present('app_jobs', 'render_ids')) {
    const decoded = `CASE WHEN jsonb_typeof(j.render_ids)='string' AND pg_input_is_valid(j.render_ids#>>'{}','jsonb')
      THEN (j.render_ids#>>'{}')::jsonb ELSE j.render_ids END`;
    const paths = ["entry.value->>'url'", "entry.value->>'thumb_url'", "entry.value->>'thumbUrl'", "entry.value->>'preview_url'", "entry.value->>'previewUrl'", "entry.value#>>'{imageDisplay,url}'"];
    jobPredicates.push(`EXISTS(SELECT 1 FROM LATERAL (SELECT ${decoded} AS renders) decoded
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(decoded.renders)='array' THEN decoded.renders ELSE '[]'::jsonb END) entry(value)
      WHERE (jsonb_typeof(entry.value)='string' AND $1=${key("entry.value#>>'{}'")})
        OR $1=ANY(ARRAY[${paths.map(key).join(',')}]))`);
  }
  if (jobPredicates.length) queries.push(`SELECT 1 FROM app_jobs j WHERE ${jobPredicates.map(predicate => `(${predicate})`).join(' OR ')}`);
  for (const table of tables.slice(1)) {
    const fields = ['image_url', 'thumb_url'].filter(column => present(table, column));
    if (fields.length) queries.push(`SELECT 1 FROM ${table} character WHERE $1=ANY(ARRAY[${fields.map(column => key(`character.${column}`)).join(',')}])`);
  }
  return queries.join(' UNION ALL ') || 'SELECT 1 WHERE $1::text IS NULL AND false';
}
