'use client';

import {Moon, Sun} from 'lucide-react';
import {useThemePreference} from '@/hooks/useThemePreference';

export function AppAppearanceControl({locale}: {locale: string}) {
  const {resolvedTheme, setPreference} = useThemePreference();
  const copy = locale === 'fr'
    ? {label: 'Apparence', light: 'Clair', dark: 'Sombre'}
    : locale === 'es'
      ? {label: 'Apariencia', light: 'Claro', dark: 'Oscuro'}
      : {label: 'Appearance', light: 'Light', dark: 'Dark'};

  return (
    <div className="app-appearance-options" role="group" aria-label={copy.label}>
      <button type="button" aria-pressed={resolvedTheme === 'light'} onClick={() => setPreference('light')}>
        <Sun size={16} strokeWidth={1.75} aria-hidden="true" /><span>{copy.light}</span>
      </button>
      <button type="button" aria-pressed={resolvedTheme === 'dark'} onClick={() => setPreference('dark')}>
        <Moon size={16} strokeWidth={1.75} aria-hidden="true" /><span>{copy.dark}</span>
      </button>
    </div>
  );
}
