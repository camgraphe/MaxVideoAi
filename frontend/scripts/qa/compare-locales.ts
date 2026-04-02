import { runLocaleFixtureSet, type LocaleFixture } from './locale-runtime-utils';

const COMPARE_INTERNAL_PATHS = [
  '/ai-video-engines',
  '/models',
  '/examples',
  '/blog',
  '/tools/angle',
  '/tools/character-builder',
];

const fixtures: LocaleFixture[] = [
  {
    englishPath: '/ai-video-engines',
    localizableInternalPaths: COMPARE_INTERNAL_PATHS,
  },
  {
    englishPath: '/ai-video-engines/kling-2-6-pro-vs-sora-2',
    localizableInternalPaths: COMPARE_INTERNAL_PATHS,
  },
  {
    englishPath: '/ai-video-engines/sora-2-vs-veo-3-1',
    localizableInternalPaths: COMPARE_INTERNAL_PATHS,
  },
  {
    englishPath: '/ai-video-engines/kling-2-6-pro-vs-veo-3-1',
    localizableInternalPaths: COMPARE_INTERNAL_PATHS,
  },
  {
    englishPath: '/ai-video-engines/sora-2-vs-wan-2-6',
    localizableInternalPaths: COMPARE_INTERNAL_PATHS,
  },
  {
    englishPath: '/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro',
    localizableInternalPaths: COMPARE_INTERNAL_PATHS,
  },
  {
    englishPath: '/ai-video-engines/luma-ray-2-vs-luma-ray-2-flash',
    localizableInternalPaths: COMPARE_INTERNAL_PATHS,
  },
];

runLocaleFixtureSet('compare', fixtures).catch((error) => {
  console.error('compare locale check failed', error);
  process.exit(1);
});
