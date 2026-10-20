import type { SubtitleStyle } from './document';

export const SUBTITLE_PRESETS = ['active-word', 'clean', 'high-contrast'] as const;

const copy = {
  en: { title: 'Choose your caption style', sample: ['Make', 'it', 'count.'], names: ['Pop', 'Cinema', 'Contrast'], descriptions: ['The spoken word lights up.', 'Understated, easy to read.', 'A solid background for clarity.'] },
  fr: { title: 'Choisissez votre style', sample: ['Chaque', 'mot', 'compte.'], names: ['Pop', 'Cinéma', 'Contraste'], descriptions: ['Le mot prononcé se détache.', 'Sobre et facile à lire.', 'Un fond plein pour la lisibilité.'] },
  es: { title: 'Elige tu estilo', sample: ['Cada', 'palabra', 'cuenta.'], names: ['Pop', 'Cine', 'Contraste'], descriptions: ['Destaca la palabra pronunciada.', 'Discreto y fácil de leer.', 'Un fondo sólido para leer mejor.'] },
};

export function subtitlePresetCopy(locale: string) { return copy[locale === 'fr' ? 'fr' : locale === 'es' ? 'es' : 'en']; }

/** Shared appearance for real overlays and the style selector; timing remains in presentation.ts. */
export function subtitleAppearance(preset: SubtitleStyle['preset']) {
  return {
    fontWeight: preset === 'active-word' ? 900 : preset === 'clean' ? 500 : 700,
    textTransform: preset === 'active-word' ? 'uppercase' as const : 'none' as const,
    textShadow: '0 1px 2px #000, 1px 0 2px #000, -1px 0 2px #000',
  };
}

export function activeSubtitleWordStyle(accent: string) {
  return { background: accent, color: '#111111', borderRadius: '0.13em', padding: '0.04em 0.12em', textShadow: 'none' };
}
