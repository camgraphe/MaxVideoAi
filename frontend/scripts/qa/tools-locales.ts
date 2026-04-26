import { runLocaleFixtureSet, type LocaleFixture } from './locale-runtime-utils';

const TOOLS_INTERNAL_PATHS = [
  '/models',
  '/examples',
  '/blog',
  '/tools/angle',
  '/tools/character-builder',
  '/tools/upscale',
];

const fixtures: LocaleFixture[] = [
  {
    englishPath: '/tools/angle',
    localizableInternalPaths: TOOLS_INTERNAL_PATHS,
    requiredTextByLocale: {
      fr: ['angle de caméra sans reconstruire'],
      es: ['ángulo de cámara sin reconstruir la imagen'],
    },
    forbiddenTextByLocale: {
      fr: ['Change Camera Angle Without Rebuilding the Image'],
      es: ['Change Camera Angle Without Rebuilding the Image'],
    },
  },
  {
    englishPath: '/tools/character-builder',
    localizableInternalPaths: TOOLS_INTERNAL_PATHS,
    requiredTextByLocale: {
      fr: ['référence personnage réutilisable'],
      es: ['referencia de personaje reutilizable'],
    },
    forbiddenTextByLocale: {
      fr: ['Create a reusable character reference for consistent AI images and video'],
      es: ['Create a reusable character reference for consistent AI images and video'],
    },
  },
  {
    englishPath: '/tools/upscale',
    localizableInternalPaths: TOOLS_INTERNAL_PATHS,
    requiredTextByLocale: {
      fr: ['Upscalez vos assets'],
      es: ['Upscalea assets'],
    },
    forbiddenTextByLocale: {
      fr: ['Upscale assets before they move through the pipeline'],
      es: ['Upscale assets before they move through the pipeline'],
    },
  },
];

runLocaleFixtureSet('tools', fixtures).catch((error) => {
  console.error('tools locale check failed', error);
  process.exit(1);
});
