'use client';
import { useState, type ReactNode } from 'react';
import { Eye, Trash2, Undo2, X } from 'lucide-react';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import { CompactLibraryPopup } from './CompactLibraryPopup.client';
import { compactLibraryCopy } from './compact-library-copy';
import { useLibraryCollections } from './useLibraryCollections';
import type { useLibraryManagementSelection } from './useLibraryManagementSelection';

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
  const [targetCollection, setTargetCollection] = useState('');
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const useIn = fr ? 'Utiliser dans…' : es ? 'Usar en…' : 'Use in…';
  return <div className="compact-library-selection-actions" role="group" aria-label={fr ? 'Actions de sélection' : es ? 'Acciones de selección' : 'Selection actions'} aria-busy={selection.pending}>
    <strong>{selection.count.toLocaleString(locale)} {selection.count === 1 ? copy.selectedSingular : copy.selected}</strong>
    {asset && !scope.trash ? <>
      <button type="button" data-preview disabled={selection.pending} onClick={() => onOpen(asset)}><Eye size={16} aria-hidden />{copy.preview}</button>
      {renderContinuation ? <CompactLibraryPopup label={useIn} disabled={selection.pending} className="compact-library-use-trigger"><div className="compact-library-use-actions">{renderContinuation(asset)}</div></CompactLibraryPopup> : null}
    </> : null}
    {scope.trash ? <button type="button" disabled={selection.pending} onClick={() => void selection.run('restore')}><Undo2 size={16} aria-hidden />{copy.restore}</button> : <>
      <CompactLibraryPopup label={copy.favorites} disabled={selection.pending}>
        {(close) => <div className="compact-library-selection">
          <button type="button" onClick={() => { void selection.run('favorite'); close(); }}>{copy.favorite}</button>
          <button type="button" onClick={() => { void selection.run('unfavorite'); close(); }}>{copy.unfavorite}</button>
        </div>}
      </CompactLibraryPopup>
      <CompactLibraryPopup label={copy.collections} disabled={selection.pending}>
        {(close) => <fieldset className="compact-library-collection-actions" disabled={selection.pending}>
          <select aria-label={copy.chooseCollection} value={targetCollection} onChange={event => setTargetCollection(event.target.value)}>
            <option value="">{copy.chooseCollection}</option>
            {collections.items.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
          </select>
          {collections.hasMore ? <button type="button" onClick={collections.loadMore}>{copy.moreCollections}</button> : null}
          <button type="button" disabled={!targetCollection} onClick={() => { void selection.run('add-to-collection', targetCollection); close(); }}>{copy.addCollection}</button>
          {scope.collectionId ? <button type="button" onClick={() => { void selection.run('remove-from-collection', scope.collectionId); close(); }}>{copy.removeCollection}</button> : null}
        </fieldset>}
      </CompactLibraryPopup>
      <button type="button" data-trash disabled={selection.pending} onClick={() => void selection.run('trash')}><Trash2 size={16} aria-hidden />{copy.trash}</button>
    </>}
    <button type="button" className="compact-library-clear" aria-label={copy.clear} title={copy.clear} disabled={selection.pending} onClick={onClear}><X size={16} aria-hidden /></button>
  </div>;
}
