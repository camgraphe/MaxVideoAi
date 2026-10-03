'use client';

import { Moon, Sun } from 'lucide-react';
import { useThemePreference } from '@/hooks/useThemePreference';

export function AppAppearanceControl({ locale }: { locale: string }) {
  const { resolvedTheme, toggleTheme } = useThemePreference();
  const dark = resolvedTheme === 'dark';
  const copy = locale === 'fr'
    ? { label: 'Apparence sombre', light: 'Passer au thème clair', dark: 'Passer au thème sombre' }
    : locale === 'es'
      ? { label: 'Apariencia oscura', light: 'Cambiar al tema claro', dark: 'Cambiar al tema oscuro' }
      : { label: 'Dark appearance', light: 'Switch to light theme', dark: 'Switch to dark theme' };

  return (
    <button
      type="button"
      className="app-appearance-toggle"
      role="switch"
      aria-checked={dark}
      aria-label={copy.label}
      title={dark ? copy.light : copy.dark}
      onClick={toggleTheme}
    >
      <span data-active={!dark}><Sun size={17} strokeWidth={1.75} aria-hidden="true" /></span>
      <span data-active={dark}><Moon size={17} strokeWidth={1.75} aria-hidden="true" /></span>
    </button>
  );
}
