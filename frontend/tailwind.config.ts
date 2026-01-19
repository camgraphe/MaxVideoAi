import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist"', '"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Geist"', '"Inter"', 'system-ui', 'sans-serif']
      },
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        'surface-hover': 'var(--surface-hover)',
        'surface-disabled': 'var(--surface-disabled)',
        'surface-glass-95': 'var(--surface-glass-95)',
        'surface-glass-90': 'var(--surface-glass-90)',
        'surface-glass-85': 'var(--surface-glass-85)',
        'surface-glass-80': 'var(--surface-glass-80)',
        'surface-glass-75': 'var(--surface-glass-75)',
        'surface-glass-70': 'var(--surface-glass-70)',
        'surface-glass-60': 'var(--surface-glass-60)',
        'surface-on-media-5': 'var(--surface-on-media-5)',
        'surface-on-media-10': 'var(--surface-on-media-10)',
        'surface-on-media-15': 'var(--surface-on-media-15)',
        'surface-on-media-20': 'var(--surface-on-media-20)',
        'surface-on-media-25': 'var(--surface-on-media-25)',
        'surface-on-media-30': 'var(--surface-on-media-30)',
        'surface-on-media-40': 'var(--surface-on-media-40)',
        'surface-on-media-50': 'var(--surface-on-media-50)',
        'surface-on-media-60': 'var(--surface-on-media-60)',
        'surface-on-media-70': 'var(--surface-on-media-70)',
        border: 'var(--border)',
        hairline: 'var(--hairline)',
        'border-hover': 'var(--border-hover)',
        'border-disabled': 'var(--border-disabled)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          disabled: 'var(--text-disabled)'
        },
        'on-surface': 'var(--on-surface)',
        'on-surface-muted': 'var(--on-surface-muted)',
        brand: 'var(--brand)',
        brandHover: 'var(--brand-hover)',
        brandActive: 'var(--brand-active)',
        onBrand: 'var(--on-brand)',
        'brand-hover': 'var(--brand-hover)',
        'brand-active': 'var(--brand-active)',
        'on-brand': 'var(--on-brand)',
        accent: 'var(--accent)',
        accentHover: 'var(--accent-hover)',
        accentActive: 'var(--accent-active)',
        accentSoft: 'var(--accent-subtle)',
        accentSubtle: 'var(--accent-subtle)',
        'accent-soft': 'var(--accent-subtle)',
        'accent-hover': 'var(--accent-hover)',
        'accent-active': 'var(--accent-active)',
        'accent-subtle': 'var(--accent-subtle)',
        'on-accent': 'var(--on-accent)',
        ring: 'var(--ring)',
        link: 'var(--link)',
        linkHover: 'var(--link-hover)',
        'link-hover': 'var(--link-hover)',
        'overlay-bg': 'var(--overlay-bg)',
        'overlay-surface': 'var(--overlay-surface)',
        'overlay-ink': 'var(--overlay-ink)',
        'overlay-muted': 'var(--overlay-muted)'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)'
      },
      borderRadius: {
        card: 'var(--radius-card)',
        input: 'var(--radius-input)',
        modal: 'var(--radius-xl)',
        pill: '9999px'
      },
      letterSpacing: {
        micro: '0.08em',
        tiny: '0.02em'
      },
      keyframes: {
        'button-pop': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '40%': { transform: 'scale(0.96)', opacity: '0.96' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      },
      animation: {
        'button-pop': 'button-pop 180ms ease-out'
      }
    }
  },
  plugins: [typography],
};

export default config;
