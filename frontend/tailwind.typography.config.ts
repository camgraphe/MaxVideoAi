import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';
import base from './tailwind.config';

// Editorial sheets opt in; globals keep the shared theme, reset and utilities.
const config: Config = {
  ...base,
  plugins: [...(base.plugins ?? []), typography],
};

export default config;
