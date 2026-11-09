import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import type { LibrarySelectionSnapshot } from './library-browse';
import type {
  LibraryMediaReference,
  LibraryOrganizationOperation,
} from './media-library-organization';
import { mutateLibraryOrganization, type LibraryMutationResponse } from './library-mutations';
export type ManagedLibraryAsset = AssetBrowserAsset & {
  organization: NonNullable<AssetBrowserAsset['organization']>;
  libraryRef: LibraryMediaReference;
  sourceRevision: string;
};
export type ManagementSelection = {
  records: Map<string, ManagedLibraryAsset>;
  snapshot: LibrarySelectionSnapshot | null;
  members: Set<string>;
  excluded: Set<string>;
};
export function emptyManagementSelection(): ManagementSelection {
  return { records: new Map(), snapshot: null, members: new Set(), excluded: new Set() };
}
export function frozenManagementSelection(snapshot: LibrarySelectionSnapshot): ManagementSelection {
  if (snapshot.totalCount > 10_000 || snapshot.keys.length !== snapshot.totalCount)
    throw new Error('SELECTION_LIMIT');
  return { ...emptyManagementSelection(), snapshot, members: new Set(snapshot.keys) };
}
export function selectionCount(s: ManagementSelection) {
  return s.snapshot ? s.snapshot.totalCount - s.excluded.size : s.records.size;
}
export function selectedManagementKeys(
  s: ManagementSelection,
  assets: ManagedLibraryAsset[]
): Set<string> {
  return new Set(
    assets
      .filter((a) =>
        s.snapshot
          ? s.members.has(a.organization.key) && !s.excluded.has(a.organization.key)
          : s.records.has(a.organization.key)
      )
      .map((a) => a.organization.key)
  );
}
/** A visible range can change without pruning retained off-page identities or versions. */
export function changeLoadedSelection(
  s: ManagementSelection,
  assets: ManagedLibraryAsset[],
  keys: ReadonlySet<string> | 'all'
): ManagementSelection {
  const next = { ...s, records: new Map(s.records), excluded: new Set(s.excluded) };
  for (const asset of assets) {
    const key = asset.organization.key,
      selected = keys === 'all' || keys.has(key);
    if (s.snapshot) {
      if (s.members.has(key)) {
        if (selected) next.excluded.delete(key);
        else next.excluded.add(key);
      }
    } else if (selected) {
      if (!next.records.has(key)) next.records.set(key, asset);
    } else next.records.delete(key);
  }
  if (selectionCount(next) > 10_000) throw new Error('SELECTION_LIMIT');
  return next;
}
export type ManualOrganizationOutcome = {
  confirmed: ManagedLibraryAsset[];
  failed: { asset: ManagedLibraryAsset; error: string }[];
  unconfirmed: ManagedLibraryAsset[];
  unattempted: ManagedLibraryAsset[];
};
function identity(ref: LibraryMediaReference) {
  return JSON.stringify(
    ref.type === 'job-output'
      ? [ref.type, ref.jobId, ref.outputId, ref.kind]
      : [ref.type, ref.assetId, ref.kind]
  );
}
/** Captured sources, serial transport, complete accounting; no fetch-all or implicit subset. */
export async function runManualOrganization({
  userId,
  records,
  operation,
  collectionId,
  isCurrent,
  mutate = mutateLibraryOrganization,
}: {
  userId: string;
  records: ManagedLibraryAsset[];
  operation: LibraryOrganizationOperation;
  collectionId?: string;
  isCurrent: () => boolean;
  mutate?: typeof mutateLibraryOrganization;
}): Promise<ManualOrganizationOutcome> {
  if (records.length > 10_000) throw new Error('SELECTION_LIMIT');
  const outcome: ManualOrganizationOutcome = {
    confirmed: [],
    failed: [],
    unconfirmed: [],
    unattempted: [],
  };
  for (let start = 0; start < records.length; start += 500) {
    if (!isCurrent()) {
      outcome.unattempted.push(...records.slice(start));
      break;
    }
    const chunk = records.slice(start, start + 500);
    let result: LibraryMutationResponse;
    try {
      result = await mutate(userId, {
        operation,
        ...(collectionId ? { collectionId } : {}),
        references: chunk.map((a) => ({ ...a.libraryRef, sourceRevision: a.sourceRevision })),
      });
    } catch {
      outcome.unconfirmed.push(...chunk);
      outcome.unattempted.push(...records.slice(start + 500));
      break;
    }
    const results =
      'results' in result
        ? new Map(result.results.map((r) => [identity(r.reference), r]))
        : new Map();
    for (const asset of chunk) {
      const item = results.get(identity(asset.libraryRef));
      if (item?.status === 'succeeded') outcome.confirmed.push(asset);
      else if (item?.status === 'failed')
        outcome.failed.push({ asset, error: item.error ?? 'MUTATION_FAILED' });
      else outcome.unconfirmed.push(asset);
    }
  }
  return outcome;
}
