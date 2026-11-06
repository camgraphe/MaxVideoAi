'use client';

import { getRecastReadinessCopy } from '../_lib/recast-readiness-copy';

export function CharacterStudioRecastReadiness({
  id, locale, missingCharacter, missingDirection, pending, invalidDuration,
  onCharacter, onDirection, onPassage, onDuration,
}: {
  id: string;
  locale: string;
  missingCharacter: boolean;
  missingDirection: boolean;
  pending: 'reading' | 'passage' | null;
  invalidDuration: boolean;
  onCharacter: () => void;
  onDirection: () => void;
  onPassage: () => void;
  onDuration: () => void;
}) {
  if (!missingCharacter && !missingDirection && !pending && !invalidDuration) return null;
  const copy = getRecastReadinessCopy(locale);
  const action = 'min-h-9 text-left text-xs font-medium underline underline-offset-4';
  return (
    <div id={id} data-recast-readiness className="rounded-xl border border-brand/50 bg-bg px-3 py-2 text-xs" aria-live="polite">
      <p className="font-semibold">{copy.complete}</p>
      <ul className="mt-1 space-y-1">
        {missingCharacter && <li><button type="button" data-recast-action="character" className={action} onClick={onCharacter}>{copy.character}</button></li>}
        {missingDirection && <li><button type="button" data-recast-action="direction" className={action} onClick={onDirection}>{copy.direction}</button></li>}
        {pending === 'reading' && <li className="py-1" role="status">{copy.reading}</li>}
        {pending === 'passage' && <li>
          <p>{copy.passage}</p>
          <button type="button" data-recast-action="passage" className={action} onClick={onPassage}>{copy.choosePassage}</button>
        </li>}
        {invalidDuration && <li><button type="button" data-recast-action="duration" className={action} onClick={onDuration}>{copy.duration}</button></li>}
      </ul>
    </div>
  );
}
