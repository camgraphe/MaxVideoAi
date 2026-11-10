'use client';
import { useState } from 'react';
import { Check, Folder, FolderOpen, Images, Star, Trash2 } from 'lucide-react';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import { CompactLibraryPopup } from './CompactLibraryPopup.client';
import { LibraryCollectionCreate } from './LibraryCollectionCreate.client';
import { useLibraryCollections } from './useLibraryCollections';
import { compactLibraryCopy } from './compact-library-copy';

/** One shared browse destination. Choosing a collection preserves media/source filters. */
export function CompactLibraryCollections({ userId, locale, scope, onScopeChange, picker = false }: {
  userId: string;
  locale: string;
  scope: LibraryBrowseScope;
  onScopeChange: (patch: Partial<LibraryBrowseScope>) => void;
  picker?: boolean;
}) {
  const copy = compactLibraryCopy(locale), collections = useLibraryCollections(userId);
  const [name, setName] = useState<string | null>(null);
  const active = collections.items.find(collection => collection.id === scope.collectionId);
  const editingName = name ?? active?.name ?? '';
  const valid = Array.from(editingName.trim()).length > 0 && Array.from(editingName.trim()).length <= 120;
  const navigate = (patch: Partial<LibraryBrowseScope>) => onScopeChange({ favorite: undefined, trash: undefined, collectionId: undefined, ...patch });
  const label = scope.trash ? copy.trash : scope.favorite ? copy.favorites : active?.name ?? copy.collections;
  return <CompactLibraryPopup label={label} className="compact-library-collections-trigger"
    icon={scope.favorite ? <Star size={16} aria-hidden /> : <FolderOpen size={16} aria-hidden />}
    active={Boolean(scope.favorite || scope.trash || scope.collectionId)}>
    {close => <div className="compact-library-collections">
      <nav aria-label={copy.view}>
        <button type="button" aria-pressed={!scope.favorite && !scope.trash && !scope.collectionId} onClick={() => { navigate({}); close(); }}><Images size={16} aria-hidden />{copy.all}</button>
        <button type="button" aria-pressed={Boolean(scope.favorite)} onClick={() => { navigate({ favorite: true }); close(); }}><Star size={16} aria-hidden />{copy.favorites}</button>
        {!picker ? <button type="button" aria-pressed={Boolean(scope.trash)} onClick={() => { navigate({ trash: true }); close(); }}><Trash2 size={16} aria-hidden />{copy.trash}</button> : null}
        <h3>{copy.collections}</h3>
        {!collections.items.length ? <p className="compact-library-collection-hint">{collections.isLoading ? copy.loading : copy.collectionHint}</p> : null}
        {collections.items.map(collection => <button type="button" key={collection.id} aria-pressed={scope.collectionId === collection.id}
          onClick={() => { setName(null); navigate({ collectionId: collection.id }); close(); }}>
          <Folder size={16} aria-hidden /><span>{collection.name}</span>{scope.collectionId === collection.id ? <Check size={16} aria-hidden /> : null}
        </button>)}
        {collections.hasMore ? <button type="button" onClick={collections.loadMore}>{copy.moreCollections}</button> : null}
      </nav>
      <LibraryCollectionCreate locale={locale} pending={collections.pending} onCreate={async value => {
        const created = await collections.create(value);
        if (!created) return false;
        setName(null); navigate({ collectionId: created.id }); close(); return true;
      }} />
      {active && !picker ? <details className="compact-library-collection-editor">
        <summary>{copy.manageCollections}</summary>
        <form onSubmit={async event => { event.preventDefault(); await collections.write('PATCH', active.id, editingName); }}>
          <label>{copy.collectionName}<input value={editingName} maxLength={240} onChange={event => setName(event.target.value)} /></label>
          <button type="submit" disabled={!valid || collections.pending}>{copy.rename}</button>
          <button type="button" disabled={collections.pending} onClick={async () => {
            if (await collections.write('DELETE', active.id)) { navigate({}); setName(null); close(); }
          }}>{copy.deleteCollection}</button>
        </form>
      </details> : null}
      {collections.error ? <p role="alert">{copy.collectionFailure}<button type="button" onClick={() => void collections.refresh()}>{copy.retry}</button></p> : null}
    </div>}
  </CompactLibraryPopup>;
}
