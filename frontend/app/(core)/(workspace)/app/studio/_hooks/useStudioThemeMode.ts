'use client';

import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';

export type StudioThemePreference = 'dark' | 'light' | 'system';
export type StudioResolvedTheme = 'dark' | 'light';

const STUDIO_THEME_STORAGE_KEY = 'maxvideoai.studio.theme.v1';
const STUDIO_THEME_USER_OVERRIDE_STORAGE_KEY = 'maxvideoai.studio.theme.userOverride.v1';
const DEFAULT_STUDIO_THEME_PREFERENCE: StudioThemePreference = 'light';
const DEFAULT_STUDIO_RESOLVED_THEME: StudioResolvedTheme = 'light';

function isStudioThemePreference(value: unknown): value is StudioThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredTheme(): StudioThemePreference {
  if (typeof window === 'undefined') return DEFAULT_STUDIO_THEME_PREFERENCE;

  try {
    const hasUserOverride = window.localStorage.getItem(STUDIO_THEME_USER_OVERRIDE_STORAGE_KEY) === 'true';
    if (!hasUserOverride) return DEFAULT_STUDIO_THEME_PREFERENCE;
    const value = window.localStorage.getItem(STUDIO_THEME_STORAGE_KEY);
    return isStudioThemePreference(value) ? value : DEFAULT_STUDIO_THEME_PREFERENCE;
  } catch {
    return DEFAULT_STUDIO_THEME_PREFERENCE;
  }
}

function systemTheme(): StudioResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return DEFAULT_STUDIO_RESOLVED_THEME;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function markStudioThemeUserOverride(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STUDIO_THEME_USER_OVERRIDE_STORAGE_KEY, 'true');
  } catch {
    return;
  }
}

export function useStudioThemeMode() {
  const [preference, setPreferenceState] = useState<StudioThemePreference>(DEFAULT_STUDIO_THEME_PREFERENCE);
  const [system, setSystem] = useState<StudioResolvedTheme>(DEFAULT_STUDIO_RESOLVED_THEME);

  useEffect(() => {
    setPreferenceState(readStoredTheme());
    setSystem(systemTheme());

    if (typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystem(systemTheme());
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setPreference = useCallback((nextPreference: SetStateAction<StudioThemePreference>) => {
    markStudioThemeUserOverride();
    setPreferenceState((current) => (
      typeof nextPreference === 'function' ? nextPreference(current) : nextPreference
    ));
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
