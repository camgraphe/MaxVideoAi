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
        border: 'var(--border)',
        hairline: 'var(--hairline)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)'
        },
        brand: 'var(--brand)',
        brandHover: 'var(--brand-hover)',
        brandActive: 'var(--brand-active)',
        onBrand: 'var(--on-brand)',
        'brand-hover': 'var(--brand-hover)',
        'brand-active': 'var(--brand-active)',
        'on-brand': 'var(--on-brand)',
        accent: 'var(--accent)',
        accentSoft: 'var(--accent-subtle)',
        'accent-soft': 'var(--accent-subtle)',
        ring: 'var(--ring)'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)'
      },
      borderRadius: {
        card: 'var(--radius-card)',
        input: 'var(--radius-input)',
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
