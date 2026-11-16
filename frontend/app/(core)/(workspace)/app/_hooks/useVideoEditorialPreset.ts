import { useEffect, useRef, useState } from 'react';

type Params = {
  searchString: string;
  ready: boolean;
  accountScope: string | null;
  engineId?: string;
  mode?: string;
  applySnapshot: (snapshot: unknown) => boolean;
  onError: (message: string) => void;
  locale: string;
};

/** Apply once after draft + workflow hydration. A click never submits Milo or generates. */
export function useVideoEditorialPreset({ searchString, ready, accountScope, engineId, mode, applySnapshot, onError, locale }: Params) {
  const applied = useRef<string | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  const query = new URLSearchParams(searchString);
  const requestedEngine = query.get('engine');
  const example = query.get('videoPrompt');
  const blocked = ['job', 'from', 'continueDraft', 'tool'].some(key => query.has(key));
  const requestKey = `${accountScope}:${requestedEngine}:${example}`;
  useEffect(() => {
    if (!ready || !accountScope || blocked || !example || !requestedEngine || engineId !== requestedEngine) return;
    const key = `${accountScope}:${requestedEngine}:${example}`;
    if (applied.current === key || settled === key) return;
    let retired = false;
    void import('@/lib/video/editorial-presets').then(({ getVideoEditorialPreset }) => {
      if (retired) return;
      const preset = getVideoEditorialPreset(requestedEngine, example);
      if (!preset) { setSettled(key); return; }
      if (preset.mode !== mode) return;
      if (!applySnapshot(preset.snapshot)) { setSettled(key); return; }
      applied.current = key;
      setSettled(key);
      const url = new URL(window.location.href);
      if (url.searchParams.get('videoPrompt') === example && url.searchParams.get('engine') === requestedEngine) {
        url.searchParams.delete('videoPrompt');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    }).catch(() => {
      if (retired) return;
      setSettled(key);
      onError(locale.startsWith('fr') ? 'Le prompt n’a pas pu être chargé. Revenez à l’exemple pour le copier.'
        : locale.startsWith('es') ? 'No se pudo cargar el prompt. Vuelve al ejemplo para copiarlo.'
          : 'The prompt could not be loaded. Return to the example to copy it.');
    });
    return () => { retired = true; };
  }, [ready, accountScope, blocked, example, requestedEngine, engineId, mode, applySnapshot, settled, onError, locale]);
  return Boolean(ready && accountScope && !blocked && example && requestedEngine === engineId
    && mode === query.get('mode') && settled !== requestKey && applied.current !== requestKey);
}
