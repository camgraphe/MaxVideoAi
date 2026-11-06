'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from 'react';
import { ScanFace, Upload, X } from 'lucide-react';
import type { StudioCopy } from '../_lib/character-studio-copy';
import type { RecastImage } from '../_lib/recast-submit';
import { getRecastReadinessCopy } from '../_lib/recast-readiness-copy';
import { CharacterStudioRecastCharacterPicker, type RecastCharacterLibraryAccess } from './CharacterStudioRecastCharacterPicker.client';

const signedOutAccess: RecastCharacterLibraryAccess = { userId: null, captureAccountRequest: () => null, onSignIn: () => {} };

export function CharacterStudioRecastPortrait({ portrait, copy, active, access = signedOutAccess, onSelect, onUpload }: {
  portrait: RecastImage | null;
  copy: StudioCopy;
  active: boolean;
  access?: RecastCharacterLibraryAccess;
  onSelect: (portrait: RecastImage | null) => void;
  onUpload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hintId = useId();
  const readiness = getRecastReadinessCopy(copy.recastLocale);
  const opener = useRef<HTMLButtonElement>(null);
  const restoreSelectionFocus = useRef(false);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  useEffect(() => {
    if (!open && restoreSelectionFocus.current) {
      restoreSelectionFocus.current = false;
      if (active) opener.current?.focus();
    }
  }, [open, active]);
  return <section data-required-missing={!portrait || undefined} className={!portrait ? 'rounded-xl ring-1 ring-brand/50 ring-offset-4 ring-offset-surface' : undefined}>
    <h3 className="mb-2 text-xs font-medium text-text-secondary">02 · {copy.replacement} · {readiness.required}</h3>
    {portrait ? <div className="relative">
      <img src={portrait.url} alt={portrait.name} className="h-40 w-full rounded-xl bg-bg object-contain" />
      <p className="mt-2 truncate text-xs text-text-secondary">{portrait.name}</p>
      <button type="button" aria-label={`${copy.remove} · ${copy.replacement}`} onClick={() => onSelect(null)}
        className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white"><X size={14} /></button>
      <button ref={opener} type="button" onClick={() => setOpen(true)} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border text-xs hover:border-brand">
        <ScanFace size={16} />{copy.changeCharacter}
      </button>
    </div> : <>
      <p id={hintId} className="mb-2 text-xs text-text-secondary">{readiness.characterHint}</p>
      <button ref={opener} type="button" onClick={() => setOpen(true)} aria-describedby={hintId}
        className="flex min-h-28 w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-bg px-3 text-sm hover:border-brand">
        <ScanFace size={24} />{copy.addReplacement}
      </button>
      <button type="button" onClick={onUpload} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg text-xs text-text-secondary hover:bg-surface-hover">
        <Upload size={14} />{copy.uploadCharacterImage}
      </button>
    </>}
    {active && open ? <CharacterStudioRecastCharacterPicker key={access.userId ?? 'signed-out'} access={access} copy={copy}
      onSelect={(source, name) => {
        restoreSelectionFocus.current = true;
        onSelect({ url: source.imageUrl, jobId: source.jobId, name });
      }}
      onUpload={onUpload} onClose={() => setOpen(false)} /> : null}
  </section>;
}
