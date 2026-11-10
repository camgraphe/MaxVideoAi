'use client';
import { useState } from 'react';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import { CompactLibraryPopup } from './CompactLibraryPopup.client';
import { compactLibraryCopy } from './compact-library-copy';
import { useLibraryCollections } from './useLibraryCollections';
import type { useLibraryManagementSelection } from './useLibraryManagementSelection';

export function CompactLibrarySelection({
  userId,
  locale,
  scope,
  selection,
  isLoading,
}: {
  userId: string;
  locale: string;
  scope: LibraryBrowseScope;
  selection: ReturnType<typeof useLibraryManagementSelection>;
  isLoading: boolean;
}) {
  const copy = compactLibraryCopy(locale);
  const collections = useLibraryCollections(userId);
  const [targetCollection, setTargetCollection] = useState('');
  return (
    <CompactLibraryPopup
      className="compact-library-selection-trigger"
      label={
        selection.count
          ? `${selection.count.toLocaleString(locale)} ${selection.count === 1 ? copy.selectedSingular : copy.selected}`
          : copy.select
      }
      active={selection.count > 0}
    >
      {(close) => (
        <div className="compact-library-selection">
          <span>
            {selection.count.toLocaleString(locale)}{' '}
            {selection.count === 1 ? copy.selectedSingular : copy.selected}
          </span>
          <button
            type="button"
            disabled={isLoading || selection.pending}
            onClick={selection.selectLoaded}
          >
            {copy.selectLoaded}
          </button>
          <button
            type="button"
            disabled={isLoading || selection.pending}
            onClick={() => void selection.selectAllResults()}
          >
            {copy.selectResults}
          </button>
          <button
            type="button"
            disabled={!selection.count || selection.pending}
            onClick={() => {
              selection.clear();
              close();
            }}
          >
            {copy.clear}
          </button>
          <fieldset disabled={!selection.count || selection.pending}>
            {scope.trash ? (
              <button type="button" onClick={() => void selection.run('restore')}>
                {copy.restore}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => void selection.run('favorite')}>
                  {copy.favorite}
                </button>
                <button type="button" onClick={() => void selection.run('unfavorite')}>
                  {copy.unfavorite}
                </button>
                <select
                  aria-label={copy.chooseCollection}
                  value={targetCollection}
                  onChange={(event) => setTargetCollection(event.target.value)}
                >
                  <option value="">{copy.chooseCollection}</option>
                  {collections.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {collections.hasMore ? (
                  <button type="button" onClick={collections.loadMore}>
                    {copy.moreCollections}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!targetCollection}
                  onClick={() => void selection.run('add-to-collection', targetCollection)}
                >
                  {copy.addCollection}
                </button>
                <button
                  type="button"
                  disabled={!scope.collectionId}
                  onClick={() => void selection.run('remove-from-collection', scope.collectionId)}
                >
                  {copy.removeCollection}
                </button>
                <button type="button" onClick={() => void selection.run('trash')}>
                  {copy.trash}
                </button>
              </>
            )}
          </fieldset>
        </div>
      )}
    </CompactLibraryPopup>
  );
}
