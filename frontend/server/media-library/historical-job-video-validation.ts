import { libraryIdentityCtes } from './browse-identity-sql';
import { historicalJobProjectionSql } from './visibility-sql';
import { query } from '@/lib/db';
import { mapGenerationStatusRecordToAgent } from '@/server/generations/agent-generation-policy';
import { isExternalFalImport } from '@/server/app-job-origin';
import { mapRecentGenerationRecordToWeb, readOwnedGenerationRecordsByIds } from '@/server/generations/recent-generations';
import { LibraryOrganizationError, onlyFields, requireLibraryOwner } from './organization-validation';

/** A qualified historical job source is a proof, never a LibraryMediaReference. */
export async function validateHistoricalJobVideo(userId: string, input: unknown): Promise<void> {
  requireLibraryOwner(userId);
  onlyFields(input, ['jobId', 'originalUrl']);
  const { jobId, originalUrl } = input;
  if (typeof jobId !== 'string' || !jobId || jobId.length > 256 || jobId.trim() !== jobId ||
      typeof originalUrl !== 'string' || originalUrl.length > 16384 || originalUrl.trim() !== originalUrl)
    throw new LibraryOrganizationError('INVALID_CANDIDATE');
  try {
    const url = new URL(originalUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error();
  } catch { throw new LibraryOrganizationError('INVALID_ORIGINAL'); }

  const [record] = await readOwnedGenerationRecordsByIds({ userId, jobIds: [jobId] });
  if (!record || isExternalFalImport(record.settings_snapshot) ||
      mapGenerationStatusRecordToAgent(record)?.status !== 'completed')
    throw new LibraryOrganizationError('SOURCE_UNAVAILABLE', 409);
  const [availability] = await query<{ hidden: boolean | null; has_outputs: boolean }>(
    `SELECT hidden, EXISTS(SELECT 1 FROM job_outputs WHERE job_id = $2) AS has_outputs
       FROM app_jobs WHERE user_id = $1 AND job_id = $2`, [userId, jobId],
  );
  if (!availability || availability.hidden) throw new LibraryOrganizationError('SOURCE_UNAVAILABLE', 409);
  // Include deleted/unavailable/foreign rows: this cannot bypass persisted source authorization/Trash.
  if (availability.has_outputs) throw new LibraryOrganizationError('PERSISTED_OUTPUT_REQUIRED', 409);
  const job = mapRecentGenerationRecordToWeb(record);
  if (job.surface !== 'video' || !job.videoUrl) throw new LibraryOrganizationError('SOURCE_UNAVAILABLE', 409);
  if (job.videoUrl !== originalUrl) throw new LibraryOrganizationError('SOURCE_VERSION_CHANGED', 409);
  const [projection] = await query<{ identity_error: string | null; trashed_at: string | null }>(
    `WITH ${libraryIdentityCtes()} ${historicalJobProjectionSql('$2', '$3')}`, [userId, jobId, originalUrl],
  );
  if (projection.identity_error) throw new LibraryOrganizationError(projection.identity_error, 409);
  if (projection.trashed_at) throw new LibraryOrganizationError('SOURCE_TRASHED', 409);
}
