'use client';
import { CompactLibraryPopup } from './CompactLibraryPopup.client';
import { useState } from 'react';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import { useLibraryCollections } from './useLibraryCollections';
import { compactLibraryCopy } from './compact-library-copy';
export function CompactLibraryCollections({
  userId,
  locale,
  scope,
  onScopeChange,
}: {
  userId: string;
  locale: string;
  scope: LibraryBrowseScope;
  onScopeChange: (patch: Partial<LibraryBrowseScope>) => void;
}) {
  const copy = compactLibraryCopy(locale),
    collections = useLibraryCollections(userId);
  const [name, setName] = useState('');
  const valid = Array.from(name.trim()).length > 0 && Array.from(name.trim()).length <= 120;
  const navigate = (patch: Partial<LibraryBrowseScope>) =>
    onScopeChange({
      favorite: undefined,
      trash: undefined,
      collectionId: undefined,
      ...patch,
    });
  const label = scope.trash
    ? copy.trash
    : scope.favorite
      ? copy.favorites
      : scope.collectionId
        ? (collections.items.find((c) => c.id === scope.collectionId)?.name ?? copy.collections)
        : copy.all;
  return (
    <CompactLibraryPopup
      label={label}
      active={Boolean(scope.favorite || scope.trash || scope.collectionId)}
    >
      {(close) => (
        <div className="compact-library-collections">
          <nav aria-label={copy.view}>
            <button
              type="button"
              aria-pressed={!scope.favorite && !scope.trash && !scope.collectionId}
              onClick={() => {
                navigate({ view: 'all', kind: 'all', source: 'all', q: '' });
                close();
              }}
            >
              {copy.all}
            </button>
            <button
              type="button"
              aria-pressed={Boolean(scope.favorite)}
              onClick={() => {
                navigate({ favorite: true });
                close();
              }}
            >
              {copy.favorites}
            </button>
            <button
              type="button"
              aria-pressed={Boolean(scope.trash)}
              onClick={() => {
                navigate({ trash: true });
                close();
              }}
            >
              {copy.trash}
            </button>
            <h3>{copy.collections}</h3>
            {collections.items.map((collection) => (
              <button
                type="button"
                key={collection.id}
                aria-pressed={scope.collectionId === collection.id}
                onClick={() => {
                  setName(collection.name);
                  navigate({ collectionId: collection.id });
                  close();
                }}
              >
                {collection.name}
              </button>
            ))}
            {collections.hasMore ? (
              <button type="button" onClick={collections.loadMore}>
                {copy.moreCollections}
              </button>
            ) : null}
          </nav>
          <details className="compact-library-collection-editor">
            <summary>{copy.manageCollections}</summary>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (await collections.write('POST', undefined, name)) setName('');
              }}
            >
              <label>
                {copy.collectionName}
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={240}
                />
              </label>
              <button type="submit" disabled={!valid || collections.pending}>
                {copy.create}
              </button>
              {scope.collectionId ? (
                <>
                  <button
                    type="button"
                    disabled={!valid || collections.pending}
                    onClick={() => void collections.write('PATCH', scope.collectionId, name)}
                  >
                    {copy.rename}
                  </button>
                  <button
                    type="button"
                    disabled={collections.pending}
                    onClick={async () => {
                      if (await collections.write('DELETE', scope.collectionId)) {
                        navigate({});
                        setName('');
                      }
                    }}
                  >
                    {copy.deleteCollection}
                  </button>
                </>
              ) : null}
            </form>
          </details>
          {collections.error ? (
            <p role="alert">
              {copy.collectionFailure}
              <button type="button" onClick={() => void collections.refresh()}>
                {copy.retry}
              </button>
            </p>
          ) : null}
        </div>
      )}
    </CompactLibraryPopup>
  );
}
