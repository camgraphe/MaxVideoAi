'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Upload, X } from 'lucide-react';
import { LibraryImageThumbnail } from '@/components/library/LibraryImageThumbnail.client';
import type { StudioImage } from '@/types/character-studio';
import type { CaptureCharacterBuilderAccountRequest } from '../_lib/character-builder-types';
import type { StudioCopy } from '../_lib/character-studio-copy';
import { getStudioLibraryCopy } from '../_lib/character-studio-library-copy';
import { useCharacterStudioLibrary } from '../_hooks/useCharacterStudioLibrary';

export type RecastCharacterLibraryAccess = {
  userId: string | null;
  captureAccountRequest: CaptureCharacterBuilderAccountRequest;
  onSignIn: () => void;
};
type Source = Pick<StudioImage, 'jobId' | 'imageUrl' | 'thumbUrl'>;

/** Mounted on demand. Its detail selection never changes the Character editor's draft. */
export function CharacterStudioRecastCharacterPicker({ access, copy, onSelect, onUpload, onClose }: {
  access: RecastCharacterLibraryAccess;
  copy: StudioCopy;
  onSelect: (source: Source, name: string) => void;
  onUpload: () => void;
  onClose: () => void;
}) {
  const library = useCharacterStudioLibrary({ ...access, enabled: true });
  const labels = getStudioLibraryCopy(copy.recastLocale);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [listCursor, setListCursor] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const close = () => { dialog.current?.close(); onClose(); };
  const select = (source: Source, name: string) => { onSelect(source, name); close(); };
  const busy = library.loading || library.detailLoading;
  const actionClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-medium hover:bg-surface-hover disabled:opacity-50';
  const card = (id: string, source: Source, name: string, onClick: () => void) => (
    <button key={id} type="button" disabled={busy} onClick={onClick}
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-bg text-left transition hover:border-brand focus-visible:outline-brand disabled:opacity-50">
      <LibraryImageThumbnail asset={{ url: source.imageUrl, thumbUrl: source.thumbUrl, kind: 'image' }}
        alt="" className="aspect-[3/4] w-full bg-bg object-contain" />
      <span className="block truncate px-3 py-2 text-sm font-medium" title={name}>{name}</span>
    </button>
  );
  return <dialog ref={dialog} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }}
    className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface p-4 text-text-primary shadow-xl backdrop:bg-black/65 sm:p-5">
    <div className="flex items-start justify-between gap-4">
      <div><h2 id={titleId} className="text-lg font-semibold">{labels.title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{copy.characterLibraryHint}</p></div>
      <button type="button" onClick={close} aria-label={labels.cancel} className={`${actionClass} shrink-0 px-2`}><X size={18} /></button>
    </div>
    <div className="my-4 flex flex-wrap items-center justify-between gap-2">
      {detailId ? <button type="button" className={actionClass} onClick={() => { setDetailId(null); library.closeCharacter(); }}>
        <ArrowLeft size={14} />{labels.back}</button> : <span />}
      <button type="button" className={actionClass} onClick={() => { close(); onUpload(); }}><Upload size={14} />{copy.uploadCharacterImage}</button>
    </div>
    {!access.userId ? <button type="button" className={actionClass} onClick={() => { close(); access.onSignIn(); }}>{labels.signIn}</button> : <>
      {busy ? <p role="status" className="mb-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" />{labels.loading}</p> : null}
      {library.error ? <div role="alert" className="mb-4 rounded-xl border border-border bg-bg p-4 text-sm">
        <p>{labels.unavailable}</p><button type="button" disabled={busy} className={`${actionClass} mt-3`}
          onClick={() => void (detailId ? library.openCharacter(detailId, library.selected?.nextLookCursor) : library.load(listCursor))}>{labels.retry}</button>
      </div> : null}
      {!busy && !library.error && !detailId && !library.characters.length ? <div className="rounded-xl border border-dashed border-border p-6">
        <p className="font-medium">{labels.empty}</p><p className="mt-2 text-sm text-text-secondary">{labels.emptyBody}</p>
      </div> : null}
      {library.selected ? <>
        <h3 className="mb-3 text-sm font-semibold">{library.selected.name}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {card('identity', library.selected.identity, labels.identity, () => select(library.selected!.identity, library.selected!.name))}
          {library.selected.looks.map(look => card(look.id, look, look.name, () => select(look, `${library.selected!.name} · ${look.name}`)))}
        </div>
        {library.selected.nextLookCursor ? <button type="button" className={`${actionClass} mt-4`} disabled={busy}
          onClick={() => void library.openCharacter(library.selected!.id, library.selected!.nextLookCursor)}>{labels.more}</button> : null}
      </> : !detailId ? <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {library.characters.map(character => card(character.id, character.identity, character.name,
            () => { setDetailId(character.id); void library.openCharacter(character.id); }))}
        </div>
        {library.nextCursor ? <button type="button" className={`${actionClass} mt-4`} disabled={busy}
          onClick={() => { setListCursor(library.nextCursor); void library.load(library.nextCursor); }}>{labels.more}</button> : null}
      </> : null}
    </>}
  </dialog>;
}
