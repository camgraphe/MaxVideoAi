import { query } from '@/lib/db';
import { MEDIA_LIBRARY_PURGE_SCHEMA } from '@/lib/schema/media-library-purge-schema';

/** Operator/bootstrap owner, never called by GET or the deletion worker. */
export async function installLibraryPurgeSchema() { await query(MEDIA_LIBRARY_PURGE_SCHEMA); }
