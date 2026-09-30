import type { QueryExecutor } from '@/lib/db';
import { CurationError } from './curation-store';

/** Row locks cannot protect new hybrid candidates or newly inserted deletion tombstones.
 * NOWAIT avoids queueing broad locks behind generation writers. The two-second SQL
 * deadline limits the window during which new writers can wait for this admin save.
 * This guard is only used by PUT; previews remain read-only and take no write-blocking locks.
 */
export async function guardCurationSave(db: QueryExecutor): Promise<QueryExecutor> {
  await db.query('LOCK TABLE playlists, playlist_items, playlist_curations, app_jobs, job_outputs, media_assets IN SHARE MODE NOWAIT');
  const deadline = Date.now() + 2000;
  return {
    async query<T>(text: string, params?: ReadonlyArray<unknown>): Promise<T[]> {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new CurationError('Page validation took too long. Preview again and retry saving.');
      await db.query("SELECT set_config('statement_timeout',$1,true)", [`${remaining}ms`]);
      return db.query<T>(text, params);
    },
  };
}
