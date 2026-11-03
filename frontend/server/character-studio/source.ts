import type { QueryExecutor } from '@/lib/db';
import { parseStoredImageRenders } from '@/lib/image-renders';
import type { CharacterBuilderSettingsSnapshot } from '@/types/character-builder';
import type { StudioImage } from '@/types/character-studio';

export class StudioLibraryError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function studioId(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,17}$/.test(value))
    throw new StudioLibraryError('invalid_character_id');
  return value;
}
export function studioName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80)
    throw new StudioLibraryError('invalid_name');
  return value.trim();
}

/** Resolve the exact original and recipe from the owned completed job, never the browser. */
export async function resolveStudioOutput(
  db: QueryExecutor,
  userId: string,
  jobId: unknown,
  imageUrl: unknown,
): Promise<StudioImage> {
  if (
    typeof jobId !== 'string' ||
    !jobId ||
    jobId.length > 160 ||
    typeof imageUrl !== 'string' ||
    imageUrl.length > 4096
  )
    throw new StudioLibraryError('invalid_source');
  const [job] = await db.query<{ settings_snapshot: CharacterBuilderSettingsSnapshot; render_ids: unknown }>(
    `SELECT settings_snapshot, render_ids FROM app_jobs WHERE user_id=$1 AND job_id=$2
       AND status='completed' AND hidden IS NOT TRUE AND settings_snapshot->>'surface'='character-builder'`,
    [userId, jobId],
  );
  if (!job || job.settings_snapshot?.schemaVersion !== 1 || !job.settings_snapshot.builder?.traits)
    throw new StudioLibraryError('source_unavailable', 404);
  const entry = parseStoredImageRenders(job.render_ids).entries.find((item) => item.url === imageUrl);
  if (!entry) throw new StudioLibraryError('source_unavailable', 404);
  const projections = await db.query<{ status: string; thumb_url: string | null }>(
    `SELECT status, thumb_url FROM job_outputs WHERE user_id=$1 AND job_id=$2 AND kind='image' AND (url=$3 OR storage_url=$3)`,
    [userId, jobId, imageUrl],
  );
  if (projections.length && !projections.some((row) => row.status === 'ready'))
    throw new StudioLibraryError('source_unavailable', 404);
  return {
    jobId,
    imageUrl,
    thumbUrl: projections.find((row) => row.status === 'ready')?.thumb_url ?? entry.thumbUrl ?? imageUrl,
    settingsSnapshot: job.settings_snapshot,
  };
}
