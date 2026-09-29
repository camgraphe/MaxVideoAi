'use client';
import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { usePlacementEditor } from './usePlacementEditor';
import { validateCurationOpening, type CurationOpening } from '@/lib/admin/playlist-curation';
import { PlacementOpeningEditor } from './PlacementOpeningEditor';
import { PlacementCandidatePicker } from './PlacementCandidatePicker';
import { PlacementExplorerDialog } from './PlacementExplorerDialog';
import { PlacementMediaList } from './PlacementMediaList';
import { PlacementMediaInspector } from './PlacementMediaInspector';
import { PlacementDraftActions } from './PlacementDraftActions';
import { PlacementPreviewDialog } from './PlacementPreviewDialog';

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const { loaded, draft, busy, dirty, change, preview } = state;
  useEffect(() => {
    setPreviewOpen(Boolean(preview));
  }, [preview]);
  let openingError: string | null = null;
  try { validateCurationOpening(draft, loaded?.candidates ?? []); }
  catch (error) { openingError = (error as Error).message; }
  if (loaded?.snapshot.openingAvailable && loaded.snapshot.slug.startsWith('family-') && !loaded.snapshot.config && !draft.openingIds)
    openingError = 'Choose all four opening videos before adopting this family.';
  const changeOrder = (tail: string[]) => {
    let index = 0;
    change({ ...draft, orderedIds: draft.orderedIds.map(id => state.openingPreviewIds.includes(id) ? id : tail[index++]) });
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
  const withoutOpeningVideo = (id: string) => draft.openingIds?.map(value => value === id ? '' : value) as CurationOpening | null | undefined;
  const remove = (id: string, excluded = false) =>
    change({
      ...draft,
      openingIds: withoutOpeningVideo(id),
      orderedIds: draft.orderedIds.filter(value => value !== id),
      excludedIds: excluded ? [...new Set([...draft.excludedIds, id])] : draft.excludedIds,
    });
  const exclude = (id: string) => remove(id, true);
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
    <div className="space-y-4">
      {loaded.snapshot.openingAvailable ? <PlacementOpeningEditor draft={draft} candidates={loaded.candidates} busy={busy} required={!loaded.snapshot.config && loaded.snapshot.slug.startsWith('family-')} onChange={next => { change(next); if (!next.openingIds) setSlot(null); }} onChooseSlot={index => { setSlot(index); setExplorerOpen(true); }} onInspect={setInspectedId} />
        : <PlacementOpeningEditor draft={draft} candidates={loaded.candidates} busy={busy} readOnly
          previewIds={state.openingPreviewIds} onChange={change} onChooseSlot={index => { setSlot(index); setExplorerOpen(true); }} onInspect={setInspectedId} />}
      {loaded.removedCount ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {loaded.removedCount} saved items are no longer eligible and are hidden. Your next save will remove them from
          the selection.
        </p>
      ) : null}
      {!loaded.snapshot.isPublic ? (
        <p className="text-sm text-warning">This collection is private. Its public page will remain empty.</p>
      ) : null}
      {openingError ? <p role="status" className="text-sm text-warning">{openingError}</p> : null}
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
          if (!loaded.snapshot.openingAvailable) {
            const next = [...draft.orderedIds];
            const oldIndex = next.indexOf(id);
            if (oldIndex >= 0) {
              [next[slot], next[oldIndex]] = [next[oldIndex], next[slot]];
            } else if (slot < next.length) {
              const replaced = next[slot];
              next[slot] = id;
              next.splice(Math.min(4, next.length), 0, replaced);
            } else {
              next.splice(slot, 0, id);
            }
            change({ ...draft, orderedIds: next }); setSlot(null); setExplorerOpen(false);
            return;
          }
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
      <PlacementDraftActions dirty={dirty} busy={busy} preview={preview} openingError={openingError}
        mode={draft.mode} canPreview={dirty || Boolean(loaded.removedCount) || !loaded.snapshot.config}
        needsAdoption={!loaded.snapshot.config} onModeChange={mode => void state.changeMode(mode)}
        onCancel={() => { state.cancel(); setSlot(null); setExplorerOpen(false); }}
        onPreview={state.makePreview} onSave={state.save}
        onReload={() => { if (!dirty || window.confirm('Discard unsaved changes and reload this destination?')) void state.reload(); }} />
      {inspectedItem ? <PlacementMediaInspector item={inspectedItem} onClose={() => setInspectedId(null)}
        onRemove={() => remove(inspectedItem.id)}
        onExclude={() => exclude(inspectedItem.id)} /> : null}
      {preview && previewOpen ? <PlacementPreviewDialog preview={preview} onClose={() => setPreviewOpen(false)} onSave={state.save} /> : null}
    </div>
  );
}
