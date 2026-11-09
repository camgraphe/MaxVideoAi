import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { invalidateLibraryMedia } from '@/hooks/useLibraryCacheRevision';
import type { LibraryMediaReference, LibraryOrganizationOperation, LibraryOrganizationMutationResult } from './media-library-organization';
import type { LibrarySnapshotMutationResult } from './library-browse';
export type LibraryOrganizationRequest = { operation: LibraryOrganizationOperation; collectionId?: string } & (
  { references: LibraryMediaReference[]; snapshotId?: never; excludedKeys?: never } |
  { snapshotId: string; excludedKeys?: string[]; references?: never }
);
export type LibraryMutationResponse = (LibraryOrganizationMutationResult | LibrarySnapshotMutationResult) & { ok: boolean; error?: string };
/** Complete server outcomes remain caller-owned; never retain a 10k overlay or guess mirrors. */
export async function mutateLibraryOrganization(userId: string, request: LibraryOrganizationRequest): Promise<LibraryMutationResponse> {
  const response = await ownedAuthFetch('/api/media-library/organization', userId, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
  });
  const body = await response.json();
  if (typeof body?.succeededCount !== 'number' || typeof body?.failedCount !== 'number') throw new Error(body?.error ?? 'MUTATION_FAILED');
  if (body.succeededCount > 0) invalidateLibraryMedia(userId);
  return body;
}
