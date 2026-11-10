'use client';
import { useRef, type ReactNode } from 'react';
import { Eye, Folder, FolderPlus, Star, Trash2, Undo2, X } from 'lucide-react';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import { CompactLibraryPopup } from './CompactLibraryPopup.client';
import { compactLibraryCopy } from './compact-library-copy';
import { useLibraryCollections } from './useLibraryCollections';
import type { useLibraryManagementSelection } from './useLibraryManagementSelection';
import { LibraryCollectionCreate } from './LibraryCollectionCreate.client';

export function CompactLibrarySelectionActions({ userId, locale, scope, selection, asset, onOpen, renderContinuation, onClear }: {
  userId: string;
  locale: string;
  scope: LibraryBrowseScope;
  selection: ReturnType<typeof useLibraryManagementSelection>;
  asset?: AssetBrowserAsset;
  onOpen: (asset: AssetBrowserAsset) => void;
  renderContinuation?: (asset: AssetBrowserAsset) => ReactNode;
  onClear: () => void;
}) {
  const copy = compactLibraryCopy(locale);
  const collections = useLibraryCollections(userId);
  const records = [...selection.selection.records.values()];
  const currentSelection = useRef(selection.selection);
  currentSelection.current = selection.selection;
  const allFavorite = selection.selection.snapshot ? Boolean(scope.favorite) : records.length > 0 && records.every(record => record.organization.favorite);
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const useIn = fr ? 'Utiliser dans…' : es ? 'Usar en…' : 'Use in…';
  return <div className="compact-library-selection-actions" role="group" aria-label={fr ? 'Actions de sélection' : es ? 'Acciones de selección' : 'Selection actions'} aria-busy={selection.pending}>
    <strong>{selection.count.toLocaleString(locale)} {selection.count === 1 ? copy.selectedSingular : copy.selected}</strong>
    {asset && !scope.trash ? <>
      <button type="button" data-preview disabled={selection.pending} onClick={() => onOpen(asset)}><Eye size={16} aria-hidden />{copy.preview}</button>
      {renderContinuation ? <CompactLibraryPopup label={useIn} disabled={selection.pending} className="compact-library-use-trigger"><div className="compact-library-use-actions">{renderContinuation(asset)}</div></CompactLibraryPopup> : null}
    </> : null}
    {scope.trash ? <button type="button" disabled={selection.pending} onClick={() => void selection.run('restore')}><Undo2 size={16} aria-hidden />{copy.restore}</button> : <>
      <button type="button" disabled={selection.pending} aria-pressed={allFavorite} onClick={() => void selection.run(allFavorite ? 'unfavorite' : 'favorite')}>
        <Star size={16} fill={allFavorite ? 'currentColor' : 'none'} aria-hidden />{allFavorite ? copy.unfavorite : copy.addFavorite}
      </button>
      <CompactLibraryPopup label={copy.addCollection} icon={<FolderPlus size={16} aria-hidden />} disabled={selection.pending}>
        {(close) => <fieldset className="compact-library-collections compact-library-collection-actions" disabled={selection.pending || collections.pending}>
          <nav aria-label={copy.chooseCollection}>
            {collections.items.map(collection => <button type="button" key={collection.id} onClick={() => { void selection.run('add-to-collection', collection.id); close(); }}><Folder size={16} aria-hidden /><span>{collection.name}</span></button>)}
          </nav>
          {!collections.items.length ? <p className="compact-library-collection-hint">{collections.isLoading ? copy.loading : copy.collectionHint}</p> : null}
          {collections.hasMore ? <button type="button" onClick={collections.loadMore}>{copy.moreCollections}</button> : null}
          <LibraryCollectionCreate locale={locale} pending={selection.pending || collections.pending} submitLabel={copy.createAndAdd} onCreate={async name => {
            const intendedSelection = selection.selection;
            const created = await collections.create(name);
            if (!created || currentSelection.current !== intendedSelection) return false;
            void selection.run('add-to-collection', created.id); close(); return true;
          }} />
          {scope.collectionId ? <button type="button" onClick={() => { void selection.run('remove-from-collection', scope.collectionId); close(); }}>{copy.removeCollection}</button> : null}
          {collections.error ? <p role="alert">{copy.collectionFailure}</p> : null}
        </fieldset>}
      </CompactLibraryPopup>
      <button type="button" data-trash disabled={selection.pending} onClick={() => void selection.run('trash')}><Trash2 size={16} aria-hidden />{copy.trash}</button>
    </>}
    <button type="button" className="compact-library-clear" aria-label={copy.clear} title={copy.clear} disabled={selection.pending} onClick={onClear}><X size={16} aria-hidden /></button>
  </div>;
}
