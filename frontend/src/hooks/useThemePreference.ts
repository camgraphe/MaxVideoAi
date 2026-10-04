'use client';

import { useCallback, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'mv-app-theme';
export const THEME_CHANGE_EVENT = 'mv-app-theme-change';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
const LEGACY_STUDIO_THEME_KEY = 'maxvideoai.studio.theme.v1';
const LEGACY_STUDIO_OVERRIDE_KEY = 'maxvideoai.studio.theme.userOverride.v1';

type ThemeSnapshot = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
};

const volatilePreferences = new WeakMap<Window, ThemePreference>();

function isExplicitTheme(value: string | null): value is ResolvedTheme {
  return value === 'light' || value === 'dark';
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || isExplicitTheme(value);
}

function readStoredPreference(browserWindow: Window) {
  const volatile = volatilePreferences.get(browserWindow);
  if (volatile) return volatile;
  try {
    const stored = browserWindow.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
    // Old Studio defaults were persisted automatically; only import an explicit override.
    const legacy = browserWindow.localStorage.getItem(LEGACY_STUDIO_THEME_KEY);
    if (browserWindow.localStorage.getItem(LEGACY_STUDIO_OVERRIDE_KEY) === 'true' && isThemePreference(legacy)) {
      try {
        browserWindow.localStorage.setItem(THEME_STORAGE_KEY, legacy);
      } catch {
        volatilePreferences.set(browserWindow, legacy);
      }
      return legacy;
    }
    return null;
  } catch {
    return null;
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
  const preference: ThemePreference = stored === 'system' ? 'system' : isExplicitTheme(stored) ? stored : DEFAULT_THEME_PREFERENCE;
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
  try {
    browserWindow.localStorage.setItem(THEME_STORAGE_KEY, preference);
    volatilePreferences.delete(browserWindow);
  } catch {
    // Reads may still succeed after a quota/permission write failure.
    volatilePreferences.set(browserWindow, preference);
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
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    try {
      if (event.storageArea && event.storageArea !== browserWindow.localStorage) return;
    } catch {
      return;
    }
    volatilePreferences.delete(browserWindow);
    publish();
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
      setSnapshot((current) => current.preference === next.preference && current.resolvedTheme === next.resolvedTheme ? current : next);
    };
    sync(readThemeSnapshot(window));
    return subscribeToThemePreference(window, sync);
  }, []);

  const setPreference = useCallback((preference: ThemePreference) => {
    persistThemePreference(window, preference);
  }, []);

  const toggleTheme = useCallback(() => {
    persistThemePreference(window, readThemeSnapshot(window).resolvedTheme === 'dark' ? 'light' : 'dark');
  }, []);

  return { ...snapshot, setPreference, toggleTheme };
}
