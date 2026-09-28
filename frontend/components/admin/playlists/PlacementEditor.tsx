'use client';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { usePlacementEditor } from './usePlacementEditor';
import { validateCurationOpening } from '@/lib/admin/playlist-curation';
import { PlacementOpeningEditor } from './PlacementOpeningEditor';
import { PlacementCandidatePicker } from './PlacementCandidatePicker';
import { PlacementExplorerDialog } from './PlacementExplorerDialog';
import { PlacementMediaList } from './PlacementMediaList';
import { PlacementMediaInspector } from './PlacementMediaInspector';

type Props = {
  playlistId: string;
  fallback?: ReactNode;
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void;
  onSaved?: () => void | Promise<void>;
};
export function PlacementEditor({ playlistId, onStateChange, onSaved, fallback }: Props) {
  const state = usePlacementEditor(playlistId, onStateChange, onSaved);
  const [slot, setSlot] = useState<number | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const { loaded, draft, busy, dirty, change, preview } = state;
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (preview) previewHeadingRef.current?.focus();
  }, [preview]);
  let openingError: string | null = null;
  try { validateCurationOpening(draft, loaded?.candidates ?? []); }
  catch (error) { openingError = (error as Error).message; }
  if (loaded?.snapshot.openingAvailable && loaded.snapshot.slug.startsWith('family-') && !loaded.snapshot.config && !draft.openingIds)
    openingError = 'Choose all four opening videos before adopting this family.';
  const changeOrder = (tail: string[]) => {
    let index = 0;
    change({ ...draft, orderedIds: draft.orderedIds.map(id => draft.openingIds?.includes(id) ? id : tail[index++]) });
  };
  const dropOnPage = (event: DragEvent, targetPage: number) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    if (busy || state.windowBusy || targetPage < 0 || targetPage * 48 >= state.tailIds.length || !state.tailIds.includes(id)) return;
    const orderedIds = state.tailIds.filter(value => value !== id);
    orderedIds.splice(targetPage * 48, 0, id);
    changeOrder(orderedIds); state.setSelectedPage(targetPage);
  };
  const ordered = state.windowIds.flatMap(id => loaded?.candidates.find(item => item.id === id) ?? []);
  const inspectedItem = loaded?.candidates.find(item => item.id === inspectedId) ?? null;
  const exclude = (id: string) =>
    change({
      ...draft,
      orderedIds: draft.orderedIds.filter((value) => value !== id),
      excludedIds: [...new Set([...draft.excludedIds, id])],
    });
  if (!loaded)
    return (
      <div>
        <p role="status">{state.error ?? 'Loading page contents…'}</p>
        {state.error ? (
          <Button onClick={state.reload} disabled={busy}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  if (loaded.snapshot.available && !loaded.snapshot.supported && !loaded.snapshot.config && fallback)
    return <>{fallback}</>;
  if (!loaded.snapshot.available || !loaded.snapshot.supported)
    return (
      <p className="text-sm text-text-secondary">The page selection editor is not available for this destination.</p>
    );
  return (
    <div className="space-y-5">
      {!loaded.snapshot.config ? (
        <p className="text-sm text-text-secondary">
          Existing selection is active. Preview and save to choose how this page is filled.
        </p>
      ) : null}
      {loaded.removedCount ? (
        <p className="text-sm text-warning">
          {loaded.removedCount} saved items are no longer eligible and are hidden. Your next save will remove them from
          the selection.
        </p>
      ) : null}
      {!loaded.snapshot.isPublic ? (
        <p className="text-sm text-warning">This collection is private. Its public page will remain empty.</p>
      ) : null}
      {loaded.snapshot.openingAvailable ? <PlacementOpeningEditor draft={draft} candidates={loaded.candidates} busy={busy} required={!loaded.snapshot.config && loaded.snapshot.slug.startsWith('family-')} onChange={next => { change(next); if (!next.openingIds) setSlot(null); }} onChooseSlot={index => { setSlot(index); setExplorerOpen(true); }} /> : null}
      {openingError ? <p role="status" className="text-sm text-warning">{openingError}</p> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm">
          Page order
          <select
            aria-label="Page order"
            value={draft.mode}
            disabled={busy}
            onChange={(event) => void state.changeMode(event.target.value as 'manual' | 'hybrid')}
            className="ml-3 rounded-md border border-border px-3 py-2"
          >
            <option value="manual">unselected videos hidden</option>
            <option value="hybrid">eligible new videos appended automatically</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm('Discard unsaved changes and reload this destination?')) void state.reload();
            }}
          >
            Reload
          </Button>
          <Button size="sm" variant="outline" disabled={busy || !dirty} onClick={() => { state.cancel(); setSlot(null); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={busy || Boolean(openingError) || (!dirty && !loaded.removedCount && Boolean(loaded.snapshot.config))}
            onClick={state.makePreview}
          >
            Preview changes
          </Button>
          <Button size="sm" disabled={busy || !preview} onClick={state.save}>
            Save changes
          </Button>
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        {draft.mode === 'hybrid'
          ? 'Featured videos stay first in your chosen order. Other eligible published videos follow by creation date, newest first.'
          : 'Only the selected videos appear, in your chosen order. New publications are offered below.'}{' '}
        {dirty ? 'Unsaved changes.' : ''}{' '}
        {!preview && (dirty || loaded.removedCount || !loaded.snapshot.config)
          ? 'Preview changes to enable saving.'
          : ''}
      </p>
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
      {preview ? (
        <section aria-label="Page preview" className="border-t-2 border-brand pt-4">
          <h3 ref={previewHeadingRef} tabIndex={-1} className="text-sm font-semibold">
            Page preview · {preview.effective?.total ?? preview.items.length} videos
          </h3>
          <p className="my-2 text-xs text-text-secondary">
            {draft.mode === 'manual' ? 'Manual order' : 'Featured + Automatic'}. This selection takes effect after
            saving. New publications may extend automatic results.
          </p>
          {preview.effective ? <div className="my-3 space-y-2 text-sm">
            <p>Currently {preview.effective.currentTotal} videos → after saving {preview.effective.total} videos.</p>
            <p>{preview.effective.addedCount} added · {preview.effective.removedCount} removed.</p>
            {preview.effective.openingFormats.length ? <p>Opening formats: {preview.effective.openingFormats.map(format => format ?? 'Unknown').join(' · ')}</p> : null}
            {preview.effective.suppressedSourceSlugs.length ? <p>Suppressed inherited sources: {preview.effective.suppressedSourceSlugs.join(', ')}</p> : null}
            {preview.effective.warnings.map(warning => <p key={warning} className="text-warning">{warning}</p>)}
            <p className="font-medium">First page · up to 24 videos</p>
          </div> : null}
          <ol className="max-h-64 overflow-auto text-sm">
            {(preview.effective?.firstPageIds ?? preview.items.slice(0, 24).map(item => item.id)).map((id, index) => (
              <li key={id} className="truncate py-1">
                {index + 1}. {preview.items.find(item => item.id === id)?.prompt || id}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <section aria-label="Selected media">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{draft.mode === 'hybrid' ? 'Featured' : 'Manual selection'} · {state.tailIds.length}</h3>
          <Button size="sm" onClick={() => { setSlot(null); setExplorerOpen(true); }} disabled={busy}>Add videos</Button>
        </div>
        <PlacementMediaList
          items={ordered}
          busy={busy || state.windowBusy}
          orderedIds={state.tailIds}
          onOrder={changeOrder}
          onRemove={(id) =>
            change({
              ...draft,
              orderedIds: draft.orderedIds.filter((value) => value !== id),
            })
          }
          removeLabel={draft.mode === 'hybrid' ? 'Unfeature' : 'Remove'}
          onExclude={exclude}
          onInspect={setInspectedId}
        />
        <div className="flex items-center gap-3 py-3 text-sm">
          <Button size="sm" title="Drop a video here to move it to the previous page" onDragOver={event => event.preventDefault()} onDrop={event => dropOnPage(event, state.selectedPage - 1)} disabled={busy || state.windowBusy || state.selectedPage === 0} onClick={() => state.setSelectedPage(state.selectedPage - 1)}>Previous selected</Button>
          <span>Selected page {state.selectedPage + 1} of {Math.max(1, Math.ceil(state.tailIds.length / 48))}</span>
          <Button size="sm" title="Drop a video here to move it to the next page" onDragOver={event => event.preventDefault()} onDrop={event => dropOnPage(event, state.selectedPage + 1)} disabled={busy || state.windowBusy || (state.selectedPage + 1) * 48 >= state.tailIds.length} onClick={() => state.setSelectedPage(state.selectedPage + 1)}>Next selected</Button>
        </div>
        {!state.tailIds.length ? (
          <p className="py-4 text-sm text-text-muted">No videos selected. Add eligible media below.</p>
        ) : null}
      </section>
      {explorerOpen ? <PlacementExplorerDialog open={explorerOpen} slot={slot} onClose={() => { setExplorerOpen(false); setSlot(null); }}>
        <PlacementCandidatePicker playlistId={playlistId} initialPage={loaded.candidatePage} draft={draft} busy={busy} slot={slot}
        onCancelSlot={() => { setExplorerOpen(false); setSlot(null); }} onItems={state.rememberItems} onChooseSlot={(id) => {
          if (slot === null) return;
          const openingIds = [...(draft.openingIds ?? ['', '', '', ''])] as [string, string, string, string];
          openingIds[slot] = id;
          change({ ...draft, openingIds }); setSlot(null); setExplorerOpen(false);
        }}
        onAdd={id => change({ ...draft, orderedIds: [...draft.orderedIds, id] })} onExclude={exclude} />
      </PlacementExplorerDialog> : null}
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-sm">Excluded from this page · {draft.excludedIds.length}</summary>
        <ul className="mt-3 space-y-2">
          {draft.excludedIds.map((id) => (
            <li key={id} className="flex justify-between gap-3 text-sm">
              <span className="truncate">{loaded.candidates.find((item) => item.id === id)?.prompt ?? id}</span>
              <button
                disabled={busy}
                onClick={() =>
                  change({
                    ...draft,
                    excludedIds: draft.excludedIds.filter((value) => value !== id),
                  })
                }
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      </details>
      {inspectedItem ? <PlacementMediaInspector item={inspectedItem} onClose={() => setInspectedId(null)}
        onRemove={() => change({ ...draft, orderedIds: draft.orderedIds.filter(id => id !== inspectedItem.id) })}
        onExclude={() => exclude(inspectedItem.id)} /> : null}
    </div>
  );
}
