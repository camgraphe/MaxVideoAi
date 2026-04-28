import { runLocaleFixtureSet, type LocaleFixture } from './locale-runtime-utils';

const EXAMPLES_INTERNAL_PATHS = [
  '/examples',
  '/models',
  '/ai-video-engines',
  '/blog',
  '/tools/angle',
  '/tools/character-builder',
];

const fixtures: LocaleFixture[] = [
  {
    englishPath: '/examples',
    localizableInternalPaths: EXAMPLES_INTERNAL_PATHS,
    skipMetadataDiff: true,
  },
  {
    englishPath: '/examples/luma',
    localizableInternalPaths: EXAMPLES_INTERNAL_PATHS,
    requiredTextByLocale: {
      fr: ['niveau premium ou sur le niveau brouillon plus rapide'],
      es: ['tier premium o al tier draft mas rapido'],
    },
    forbiddenTextByLocale: {
      fr: ['Browse Luma Ray 2 and Ray 2 Flash examples'],
      es: ['Browse Luma Ray 2 and Ray 2 Flash examples'],
    },
  },
];

runLocaleFixtureSet('examples', fixtures).catch((error) => {
  console.error('examples locale check failed', error);
  process.exit(1);
});
