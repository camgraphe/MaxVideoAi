import { query, type QueryExecutor } from '@/lib/db';

export async function assertStudioConnectedSchemaReady(
  executor: QueryExecutor = { query },
): Promise<void> {
  const rows = await executor.query<{ ready: boolean }>(`
    SELECT to_regclass('public.studio_project_commands') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'public.studio_projects'::regclass
          AND attname = 'revision' AND NOT attisdropped
      )
      AND EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'public.studio_projects'::regclass
          AND attname = 'persistence_mode' AND NOT attisdropped
      ) AS ready
  `);
  if (rows[0]?.ready !== true) {
    throw new Error('STUDIO_CONNECTED_SCHEMA_UNAVAILABLE');
  }
}
