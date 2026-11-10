'use client';
import { useEffect, useRef } from 'react';
/** Open the saved identity using the library's existing draft/account cancellation. */
export function useCharacterLibraryEntry({ characterId, hydrated, active, openCharacter }: {
  characterId: string | null; hydrated: boolean; active: boolean; openCharacter: (id: string) => Promise<unknown>;
}) {
  const consumed = useRef(false);
  useEffect(() => {
    if (consumed.current || !characterId) return;
    if (!active) { consumed.current = true; return; }
    if (!hydrated) return;
    consumed.current = true;
    if (/^[1-9]\d*$/.test(characterId)) void openCharacter(characterId);
  }, [characterId, hydrated, active, openCharacter]);
}
