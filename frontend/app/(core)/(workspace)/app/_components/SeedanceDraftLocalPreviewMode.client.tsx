'use client';

import { useId } from 'react';
import type { useSeedanceDraftLocalPreview } from '../_hooks/useSeedanceDraftLocalPreview';

type Props = { preview: ReturnType<typeof useSeedanceDraftLocalPreview> };

export function SeedanceDraftLocalPreviewMode({ preview }: Props) {
  const id = useId();
  if (!preview.available) return null;

  const choices = [
    { value: 'direct', selected: !preview.selected, title: 'Générer directement',
      description: 'Une vidéo, à la qualité choisie.', detail: 'Un seul rendu payant.' },
    { value: 'trial', selected: preview.selected, title: 'Essayer d’abord',
      description: 'Testez votre idée en 480p.', detail: 'Final 1080p facultatif, en supplément.' },
  ];

  return (
    <fieldset className="mb-3 min-w-0">
      <legend className="mb-2 text-sm font-semibold text-text-primary">Comment créer votre vidéo ?</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {choices.map((choice) => (
          <label key={choice.value} className="relative cursor-pointer">
            <input
              type="radio"
              name={id}
              value={choice.value}
              checked={choice.selected}
              onChange={() => { if (!choice.selected) preview.toggle(); }}
              aria-labelledby={`${id}-${choice.value}-title`}
              aria-describedby={`${id}-${choice.value}-description`}
              className="peer sr-only"
            />
            <span className={`block h-full rounded-input border px-3 py-3 transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${
              choice.selected
                ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                : 'border-hairline bg-surface hover:border-border-hover'
            }`}>
              <span className="flex items-center gap-2">
                <span aria-hidden className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  choice.selected ? 'border-[var(--app-accent)] text-[var(--app-accent)]' : 'border-hairline'
                }`}>
                  {choice.selected ? <span className="h-2 w-2 rounded-full bg-current" /> : null}
                </span>
                <span id={`${id}-${choice.value}-title`} className="text-sm font-semibold text-text-primary">{choice.title}</span>
              </span>
              <span id={`${id}-${choice.value}-description`} className="mt-2 block text-xs leading-relaxed text-text-secondary">
                {choice.description}<br />{choice.detail}
              </span>
            </span>
          </label>
        ))}
      </div>
      {preview.selected ? (
        <div className="mt-2 rounded-input border border-hairline bg-surface px-3 py-2">
          <ol aria-label="Les étapes de votre essai" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-primary">
            {['Essai 480p', 'Voir le résultat', 'Final 1080p optionnel'].map((label, index) => (
              <li key={label} className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold">{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <p className="mt-1.5 text-xs text-text-secondary">Vous payez l’essai. Le final ne démarre que si vous le demandez, avec un prix en plus.</p>
        </div>
      ) : null}
    </fieldset>
  );
}
