'use client';

import { useCallback, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'mv-theme';
export const THEME_CHANGE_EVENT = 'mv-theme-change';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

type ThemeSnapshot = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
};

const volatilePreferences = new WeakMap<Window, ThemePreference>();

function isExplicitTheme(value: string | null): value is ResolvedTheme {
  return value === 'light' || value === 'dark';
}

function readStoredPreference(browserWindow: Window) {
  try {
    return browserWindow.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return volatilePreferences.get(browserWindow) ?? null;
  }
}

function prefersDark(browserWindow: Window) {
  try {
    return browserWindow.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function readThemeSnapshot(browserWindow: Window): ThemeSnapshot {
  const stored = readStoredPreference(browserWindow);
  const preference: ThemePreference = stored === 'system' ? 'system' : isExplicitTheme(stored) ? stored : 'light';
  const resolvedTheme = preference === 'system'
    ? prefersDark(browserWindow) ? 'dark' : 'light'
    : preference;
  return { preference, resolvedTheme };
}

export function applyResolvedTheme(resolvedTheme: ResolvedTheme, root: HTMLElement = document.documentElement) {
  if (resolvedTheme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
}

export function persistThemePreference(browserWindow: Window, preference: ThemePreference) {
  volatilePreferences.set(browserWindow, preference);
  try {
    browserWindow.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The in-memory preference keeps this tab usable when storage is blocked.
  }
  const event = browserWindow.document.createEvent('Event');
  event.initEvent(THEME_CHANGE_EVENT, false, false);
  browserWindow.dispatchEvent(event);
}

export function subscribeToThemePreference(browserWindow: Window, notify: (snapshot: ThemeSnapshot) => void) {
  let media: MediaQueryList | null = null;
  try {
    media = browserWindow.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    media = null;
  }
  const publish = () => notify(readThemeSnapshot(browserWindow));
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) publish();
  };
  const onThemeChange = () => publish();
  const onSystemChange = () => {
    if (readThemeSnapshot(browserWindow).preference === 'system') publish();
  };

  browserWindow.addEventListener('storage', onStorage);
  browserWindow.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
  media?.addEventListener('change', onSystemChange);
  return () => {
    browserWindow.removeEventListener('storage', onStorage);
    browserWindow.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
    media?.removeEventListener('change', onSystemChange);
  };
}

const SERVER_SNAPSHOT: ThemeSnapshot = { preference: 'system', resolvedTheme: 'light' };

export function useThemePreference() {
  const [snapshot, setSnapshot] = useState<ThemeSnapshot>(SERVER_SNAPSHOT);

  useEffect(() => {
    const sync = (next: ThemeSnapshot) => {
      applyResolvedTheme(next.resolvedTheme);
      setSnapshot(next);
    };
    sync(readThemeSnapshot(window));
    return subscribeToThemePreference(window, sync);
  }, []);

  const setPreference = useCallback((preference: ThemePreference) => {
    persistThemePreference(window, preference);
  }, []);

  const toggleTheme = useCallback(() => {
    persistThemePreference(window, snapshot.resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [snapshot.resolvedTheme]);

  return { ...snapshot, setPreference, toggleTheme };
}
