'use client';
import { useRef, useEffect, useState } from 'react';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import { useLibraryCollections } from './useLibraryCollections';
import { compactLibraryCopy } from './compact-library-copy';
import { libraryPickerCandidate } from '@/lib/library-picker-validation';
import { mutateLibraryOrganization } from '@/lib/library-mutations';
import type { LibraryOrganizationOperation, LibraryOrganizationState } from '@/lib/media-library-organization';
/** Inline organization controls. This never changes the receiving draft or owns a modal. */
export function ReferenceLibraryManage({
  asset,
  userId,
  locale,
  onChange,
  onBusy,
}: {
  asset: AssetBrowserAsset;
  userId: string;
  locale: string;
  onChange: (state: LibraryOrganizationState) => void;
  onBusy: (busy: boolean) => void;
}) {
  const copy = compactLibraryCopy(locale),
    collections = useLibraryCollections(userId);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [collection, setCollection] = useState('');
  const alive = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run(operation: LibraryOrganizationOperation) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    onBusy(true);
    setError(null);
    try {
      const result = await mutateLibraryOrganization(userId, {
        operation,
        references: [libraryPickerCandidate(asset).reference],
        ...(operation.endsWith('collection') ? { collectionId: collection } : {}),
      });
      if (!alive.current) return;
      if (!('results' in result) || result.results[0]?.status !== 'succeeded' || !result.results[0].state)
        throw Error();
      onChange(result.results[0].state);
    } catch {
      if (alive.current) setError(copy.failure);
    } finally {
      if (alive.current) {
        inFlight.current = false;
        setPending(false);
        onBusy(false);
      }
    }
  }
  return (
    <section className="app-picker-management">
      <h3>{copy.collections}</h3>
      {error ? <p role="alert">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void run(asset.organization?.favorite ? 'unfavorite' : 'favorite')}
      >
        {asset.organization?.favorite ? copy.unfavorite : copy.favorite}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => void run(asset.organization?.trashedAt ? 'restore' : 'trash')}
      >
        {asset.organization?.trashedAt ? copy.restore : copy.trash}
      </button>
      <select
        aria-label={copy.chooseCollection}
        value={collection}
        onChange={(event) => setCollection(event.target.value)}
      >
        <option value="">{copy.chooseCollection}</option>
        {collections.items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <button type="button" disabled={pending || !collection} onClick={() => void run('add-to-collection')}>
        {copy.addCollection}
      </button>
      <button type="button" disabled={pending || !collection} onClick={() => void run('remove-from-collection')}>
        {copy.removeCollection}
      </button>
      {collections.hasMore ? (
        <button type="button" onClick={collections.loadMore}>
          {copy.moreCollections}
        </button>
      ) : null}
    </section>
  );
}
