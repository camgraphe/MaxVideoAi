import { ensureMediaLibrarySchema } from '../../frontend/src/lib/schema/media-library-schema';
import { ensureAssetSchema } from '../../frontend/src/lib/schema/asset-schema';
import { ensureMediaLibraryOrganizationSchema } from '../../frontend/src/lib/schema/media-library-organization-schema';
import { mutateLibraryOrganization } from '../../frontend/server/media-library/organization';
import { query } from '../../frontend/src/lib/db';

export async function setupToolLibrary() {
  await ensureMediaLibrarySchema();
  await ensureAssetSchema();
  await ensureMediaLibraryOrganizationSchema();
  await query("ALTER TABLE media_assets ALTER COLUMN source SET DEFAULT 'upload'");
}
export { mutateLibraryOrganization };
