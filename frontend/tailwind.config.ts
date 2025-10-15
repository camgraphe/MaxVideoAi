import type { Config } from 'tailwindcss';

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
        bg: '#F8F9FA',
        surface: '#FFFFFF',
        border: '#D1D5DB',
        hairline: '#E5E7EB',
        text: {
          primary: '#111111',
          secondary: '#374151',
          muted: '#6B7280'
        },
        accent: '#4F5D75',
        accentSoft: '#61708B',
        ring: '#9DA7B8'
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 6px 16px rgba(16,24,40,.06)',
        float: '0 6px 16px rgba(16,24,40,.08)'
      },
      borderRadius: {
        card: '12px',
        input: '10px',
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
  plugins: [],
};

export default config;
