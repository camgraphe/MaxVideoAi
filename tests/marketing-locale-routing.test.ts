import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const helperPath = 'frontend/lib/i18n/marketing-locale-switch.ts';
const togglePath = 'frontend/components/marketing/LanguageToggle.tsx';
const middlewarePath = 'frontend/middleware.ts';
const routingLocalePath = 'frontend/lib/middleware/routing-locale.ts';

test('marketing locale switching has one browser-safe route owner', () => {
  assert.equal(existsSync(helperPath), true, 'the shared marketing locale switch helper should exist');

  const toggleSource = readFileSync(togglePath, 'utf8');
  assert.match(toggleSource, /buildMarketingLocaleSwitchHref/);
  assert.doesNotMatch(toggleSource, /router\.replace/);
  assert.doesNotMatch(toggleSource, /params\?\.(?:slug|usecase)/);
});

test('marketing locale switching maps every public route family across locales', async () => {
  assert.equal(existsSync(helperPath), true, 'the shared marketing locale switch helper should exist');
  const { buildMarketingLocaleSwitchHref } = await import('../frontend/lib/i18n/marketing-locale-switch.ts');
  const localizedSlugs = JSON.parse(
    readFileSync('frontend/config/localized-slugs.json', 'utf8')
  ) as Record<string, Record<'en' | 'fr' | 'es', string>>;

  for (const [family, segments] of Object.entries(localizedSlugs)) {
    assert.equal(
      buildMarketingLocaleSwitchHref({ pathname: `/${segments.fr}`, targetLocale: 'es' }),
      `/es/${segments.es}?lang=es`,
      `${family} should map its French root segment to Spanish`
    );
    assert.equal(
      buildMarketingLocaleSwitchHref({ pathname: `/es/${segments.es}`, targetLocale: 'en' }),
      `/${segments.en}?lang=en`,
      `${family} should map its Spanish root segment to English`
    );
  }

  const cases = [
    ['/', 'fr', '/fr?lang=fr'],
    ['/fr', 'en', '/?lang=en'],
    ['/es/blog', 'fr', '/fr/blog?lang=fr'],
    ['/fr/modeles', 'en', '/models?lang=en'],
    ['/models/veo-3-1', 'es', '/es/modelos/veo-3-1?lang=es'],
    ['/fr/galerie/veo', 'en', '/examples/veo?lang=en'],
    ['/ai-video-engines/seedance-2-0-vs-veo-3-1', 'fr', '/fr/comparatif/seedance-2-0-vs-veo-3-1?lang=fr'],
    ['/es/comparativa/best-for/cinematic-realism', 'en', '/ai-video-engines/best-for/cinematic-realism?lang=en'],
    ['/fr/outils/angle', 'es', '/es/herramientas/angle?lang=es'],
    ['/pricing', 'fr', '/fr/tarifs?lang=fr'],
    ['/fr/a-propos', 'es', '/es/acerca-de?lang=es'],
    ['/es/empresa', 'en', '/company?lang=en'],
    ['/fr/normes-editoriales', 'es', '/es/estandares-editoriales?lang=es'],
    ['/es/estado', 'fr', '/fr/statut?lang=fr'],
    ['/fr/docs/get-started', 'en', '/docs/get-started?lang=en'],
    ['/es/workflows', 'fr', '/fr/workflows?lang=fr'],
    ['/fr/legal/terms', 'en', '/legal/terms?lang=en'],
    [
      '/fr/blog/comment-creer-des-personnages-ia-coherents-dans-les-images-et-la-video',
      'en',
      '/blog/how-to-create-consistent-ai-characters?lang=en',
    ],
    [
      '/blog/how-to-create-consistent-ai-characters',
      'es',
      '/es/blog/como-crear-personajes-de-ia-coherentes-en-imagenes-y-video?lang=es',
    ],
  ] as const;

  for (const [pathname, targetLocale, expected] of cases) {
    assert.equal(
      buildMarketingLocaleSwitchHref({ pathname, targetLocale }),
      expected,
      `${pathname} should switch to ${targetLocale}`
    );
  }
});

test('marketing locale switching preserves useful query parameters and anchors', async () => {
  const { buildMarketingLocaleSwitchHref } = await import('../frontend/lib/i18n/marketing-locale-switch.ts');

  assert.equal(
    buildMarketingLocaleSwitchHref({
      pathname: '/fr/tarifs',
      targetLocale: 'en',
      search: '?currency=EUR&nolocale=1',
      hash: '#plans',
    }),
    '/pricing?currency=EUR&lang=en#plans'
  );
});

test('public marketing URLs remain authoritative over browser locale detection', () => {
  const middlewareSource = readFileSync(middlewarePath, 'utf8');
  const routingLocaleSource = readFileSync(routingLocalePath, 'utf8');

  assert.match(routingLocaleSource, /localeDetection:\s*false/);
  assert.doesNotMatch(middlewareSource, /getPreferredLocale\(req\)/);
});
