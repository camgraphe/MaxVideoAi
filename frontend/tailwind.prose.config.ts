import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';
import baseConfig from './tailwind.config';

const config: Config = {
  ...baseConfig,
  plugins: [...(baseConfig.plugins ?? []), typography],
};

export default config;
