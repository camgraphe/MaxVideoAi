'use client';

import { useEffect, useMemo, useState } from 'react';

export type StudioThemePreference = 'dark' | 'light' | 'system';
export type StudioResolvedTheme = 'dark' | 'light';

const STUDIO_THEME_STORAGE_KEY = 'maxvideoai.studio.theme.v1';

function readStoredTheme(): StudioThemePreference {
  if (typeof window === 'undefined') return 'dark';

  try {
    const value = window.localStorage.getItem(STUDIO_THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
  } catch {
    return 'dark';
  }
}

function systemTheme(): StudioResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useStudioThemeMode() {
  const [preference, setPreference] = useState<StudioThemePreference>('dark');
  const [system, setSystem] = useState<StudioResolvedTheme>('dark');

  useEffect(() => {
    setPreference(readStoredTheme());
    setSystem(systemTheme());

    if (typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystem(systemTheme());
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(STUDIO_THEME_STORAGE_KEY, preference);
    } catch {
      return;
    }
  }, [preference]);

  const resolvedTheme = useMemo<StudioResolvedTheme>(
    () => (preference === 'system' ? system : preference),
    [preference, system],
  );

  return {
    preference,
    resolvedTheme,
    setPreference,
    toggleResolvedTheme: () => setPreference((current) => {
      const currentResolved = current === 'system' ? system : current;
      return currentResolved === 'light' ? 'dark' : 'light';
    }),
  };
}
