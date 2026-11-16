import type { MarketingMediaItem } from '@/lib/marketing-media';
import { MarketingMediaError } from './snapshot';
import { prepareMarketingPublicationImport } from './import-publication-manifest';
import { importPreparedMarketingCopy, type MarketingImportDependencies } from './import-copy';

export function previewMarketingPublicationImport(manifest: unknown) {
  return prepareMarketingPublicationImport(manifest).summary;
}

/** Only the authenticated admin route admits an already-public publication manifest. */
export async function importMarketingPublication(
  input: { manifest: unknown; actorId: string; permissionConfirmed: boolean },
  dependencies?: MarketingImportDependencies,
): Promise<MarketingMediaItem> {
  if (!input.actorId.trim()) throw new MarketingMediaError('An administrator is required.', 403);
  if (input.permissionConfirmed !== true)
    throw new MarketingMediaError('Confirm permission to copy the public video and all of its references.', 403);
  return importPreparedMarketingCopy({ ...input, prepared: prepareMarketingPublicationImport(input.manifest) }, dependencies);
}
