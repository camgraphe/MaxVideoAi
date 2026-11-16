import { useEffect, useRef } from 'react';

type Params = {
  searchParams: { get(name: string): string | null } | null | undefined;
  storageHydrated: boolean;
  availableEngineIds: string[];
  applySnapshot: (snapshot: unknown) => void;
  onError: (message: string) => void;
  errorMessage: string;
};

/** Resolve approved examples only after account/guest draft restoration has finished. */
export function useImageEditorialPreset({ searchParams, storageHydrated, availableEngineIds, applySnapshot, onError, errorMessage }: Params) {
  const applied = useRef<string | null>(null);
  const engine = searchParams?.get('engine');
  const example = searchParams?.get('example');
  const blocked = Boolean(searchParams?.get('job') || searchParams?.get('tool') || searchParams?.get('continueDraft'));
  const available = Boolean(engine && availableEngineIds.includes(engine));
  useEffect(() => {
    if (!storageHydrated || !engine || !example || !available || blocked) return;
    const key = `${engine}:${example}`;
    if (applied.current === key) return;
    let retired = false;
    void import('@/lib/image/editorial-presets').then(({ getImageEditorialPreset }) => {
      if (retired) return;
      const preset = getImageEditorialPreset(engine, example, window.location.origin);
      if (!preset) return;
      applySnapshot(preset.snapshot);
      applied.current = key;
      // A later login continuation must preserve the user's edits, not reapply the original example.
      const url = new URL(window.location.href);
      if (url.searchParams.get('example') === example && url.searchParams.get('engine') === engine) {
        url.searchParams.delete('example');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    }).catch(() => { if (!retired) onError(errorMessage); });
    return () => { retired = true; };
  }, [applySnapshot, available, blocked, engine, example, storageHydrated, onError, errorMessage]);
}
