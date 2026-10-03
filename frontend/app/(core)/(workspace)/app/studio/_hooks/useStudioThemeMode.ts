'use client';

import { useCallback, type SetStateAction } from 'react';
import { readThemeSnapshot, useThemePreference, type ThemePreference, type ResolvedTheme } from '@/hooks/useThemePreference';

export type StudioThemePreference = ThemePreference;
export type StudioResolvedTheme = ResolvedTheme;

// Keep the Studio shell/portal API while the app owns preference and persistence.
export function useStudioThemeMode() {
  const { preference, resolvedTheme, setPreference: setAppPreference, toggleTheme } = useThemePreference();
  const setPreference = useCallback((next: SetStateAction<StudioThemePreference>) => {
    setAppPreference(typeof next === 'function' ? next(readThemeSnapshot(window).preference) : next);
  }, [setAppPreference]);

  return { preference, resolvedTheme, setPreference, toggleResolvedTheme: toggleTheme };
}
