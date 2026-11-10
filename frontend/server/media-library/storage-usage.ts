import { query } from '@/lib/db';
import { requireLibraryOwner } from './organization-validation';
import { LIBRARY_STORAGE_USAGE_SQL } from './storage-usage-sql';

/** Recorded original bytes, not a physical bucket inventory or a quota reservation.
 * Include recoverable Trash and pending/retained originals until deletion is confirmed.
 * Shared files without a surviving own reference are reported separately.
 * Unknown sizes stay unknown; no HEAD fan-out or schema bootstrap on this read. */
export async function readLibraryStorageUsage(userId: string) {
  requireLibraryOwner(userId);
  const [row] = await query<{
    bytes: string; measured: string; files: string; pending_files: string; pending_bytes: string;
    failed_files: string; trashed_files: string; trashed_bytes: string; shared_files: string; shared_bytes: string;
  }>(LIBRARY_STORAGE_USAGE_SQL, [userId]);
  return {
    recordedBytes: Number(row.bytes), measuredFiles: Number(row.measured), totalFiles: Number(row.files),
    pendingDeletionFiles: Number(row.pending_files), pendingDeletionBytes: Number(row.pending_bytes),
    failedDeletionFiles: Number(row.failed_files), trashedFiles: Number(row.trashed_files), trashedBytes: Number(row.trashed_bytes),
    sharedDeletionFiles: Number(row.shared_files), sharedDeletionBytes: Number(row.shared_bytes),
    limitBytes: null, enforcement: false,
  };
}
