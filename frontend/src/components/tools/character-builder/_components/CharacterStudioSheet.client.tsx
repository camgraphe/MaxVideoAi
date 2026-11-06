'use client';

import { useRef } from 'react';
import type { StudioCharacter, StudioLook } from '@/types/character-studio';
import type { StudioLocale } from '@/lib/character-studio-catalog';
import { LibraryImageThumbnail } from '@/components/library/LibraryImageThumbnail.client';

const strings = {
  en: [
    'View sheet',
    'Full-body turnaround',
    'Identity reference',
    'Original image',
    'Close',
    'Front',
    'Three-quarter',
    'Profile',
    'Back',
    'Outfit',
    'Signature',
  ],
  fr: [
    'Voir la planche',
    'Rotation en pied',
    'Portrait de référence',
    'Image originale',
    'Fermer',
    'Face',
    'Trois quarts',
    'Profil',
    'Dos',
    'Tenue',
    'Signature',
  ],
  es: [
    'Ver la hoja',
    'Vistas de cuerpo entero',
    'Retrato de referencia',
    'Imagen original',
    'Cerrar',
    'Frente',
    'Tres cuartos',
    'Perfil',
    'Espalda',
    'Ropa',
    'Rasgos',
  ],
} as const;

export function CharacterStudioSheet({
  character,
  look,
  locale,
}: {
  character: StudioCharacter;
  look: StudioLook;
  locale: StudioLocale;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, turn, reference, original, close, ...labels] = strings[locale];
  return (
    <>
      <button
        type="button"
        className="min-h-10 rounded-lg border border-border px-3 text-xs hover:bg-surface-hover"
        onClick={() => dialog.current?.showModal()}
      >
        {open}
      </button>
      <dialog
        ref={dialog}
        aria-label={look.name}
        className="m-auto max-h-[94dvh] w-[min(94vw,72rem)] max-w-none overflow-auto rounded-xl border border-stone-400 bg-[#f5f1e8] p-4 text-[#1e3025] shadow-xl backdrop:bg-black/75 sm:p-7"
      >
        <header className="flex items-center justify-between border-b border-[#758176] pb-3">
          <span className="font-mono text-xs uppercase tracking-wider">MaxVidéo AI / Character Studio</span>
          <button
            type="button"
            className="rounded-lg border border-[#758176] px-3 py-2 text-xs"
            onClick={() => dialog.current?.close()}
          >
            {close}
          </button>
        </header>
        <h3 className="my-3 font-serif text-4xl font-bold">{character.name}</h3>
        <p className="mb-4 text-sm">{look.name}</p>
        <div className="grid gap-5 border-y border-[#758176] py-4 md:grid-cols-[3fr_1fr]">
          <figure>
            <figcaption className="mb-2 font-mono text-xs uppercase">01 / {turn}</figcaption>
            <LibraryImageThumbnail
              asset={{ url: look.imageUrl, kind: 'image' }}
              alt={look.name}
              className="w-full rounded-sm"
            />
            {!look.settingsSnapshot.builder.outputOptions.includeCloseUps && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {labels.slice(0, 4).map((label, i) => (
                  <span key={label} className="border-t border-[#758176] pt-1 text-xs">
                    <b>0{i + 1}</b> {label}
                  </span>
                ))}
              </div>
            )}
          </figure>
          <aside>
            <p className="mb-2 font-mono text-xs uppercase">02 / {reference}</p>
            <LibraryImageThumbnail
              asset={{
                url: character.identity.imageUrl,
                thumbUrl: character.identity.thumbUrl,
                kind: 'image',
              }}
              alt={character.name}
              className="max-h-64 w-full object-contain"
            />
            {[character.presentation?.outfit, character.presentation?.details].map(
              (value, i) =>
                value && (
                  <div key={i} className="mt-3 text-sm">
                    <b>{labels[i + 4]}</b>
                    <p>{value}</p>
                  </div>
                ),
            )}
          </aside>
        </div>
        <a
          className="mt-3 inline-block text-sm underline"
          href={look.imageUrl}
          rel="noreferrer"
          target="_blank"
        >
          {original}
        </a>
      </dialog>
    </>
  );
}
