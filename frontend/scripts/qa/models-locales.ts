import { runLocaleFixtureSet, type LocaleFixture } from './locale-runtime-utils';

const MODELS_INTERNAL_PATHS = [
  '/models',
  '/ai-video-engines',
  '/examples',
  '/blog',
  '/tools/angle',
  '/tools/character-builder',
];

const fixtures: LocaleFixture[] = [
  {
    englishPath: '/models',
    localizableInternalPaths: MODELS_INTERNAL_PATHS,
    skipMetadataDiff: true,
  },
  {
    englishPath: '/models/sora-2',
    localizableInternalPaths: MODELS_INTERNAL_PATHS,
    forbiddenTextByLocale: {
      fr: ['View render', 'View model'],
      es: ['View render', 'View model'],
    },
  },
  {
    englishPath: '/models/veo-3-1',
    localizableInternalPaths: MODELS_INTERNAL_PATHS,
    forbiddenTextByLocale: {
      fr: ['View render', 'View model'],
      es: ['View render', 'View model'],
    },
  },
  {
    englishPath: '/models/kling-3-pro',
    localizableInternalPaths: MODELS_INTERNAL_PATHS,
    forbiddenTextByLocale: {
      fr: ['View render', 'View model'],
      es: ['View render', 'View model'],
    },
  },
  {
    englishPath: '/models/veo-3-1-fast',
    localizableInternalPaths: MODELS_INTERNAL_PATHS,
    forbiddenTextByLocale: {
      fr: ['View render', 'View model'],
      es: ['View render', 'View model'],
    },
  },
  {
    englishPath: '/models/luma-ray-2',
    localizableInternalPaths: MODELS_INTERNAL_PATHS,
    forbiddenTextByLocale: {
      fr: ['View render', 'View model'],
      es: ['View render', 'View model'],
    },
  },
  {
    englishPath: '/models/luma-ray-2-flash',
    localizableInternalPaths: MODELS_INTERNAL_PATHS,
    forbiddenTextByLocale: {
      fr: ['View render', 'View model'],
      es: ['View render', 'View model'],
    },
  },
];

runLocaleFixtureSet('models', fixtures).catch((error) => {
  console.error('models locale check failed', error);
  process.exit(1);
});
