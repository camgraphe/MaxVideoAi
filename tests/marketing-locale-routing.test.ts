import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import registry from '../frontend/config/model-registry.json' with { type: 'json' };
import { handleMarketingSlug } from '../frontend/lib/middleware/routing-marketing.ts';
import { config as middlewareConfig, middleware } from '../frontend/middleware.ts';

const helperPath = 'frontend/lib/i18n/marketing-locale-switch.ts';
const togglePath = 'frontend/components/marketing/LanguageToggle.tsx';
const middlewarePath = 'frontend/middleware.ts';
const routingLocalePath = 'frontend/lib/middleware/routing-locale.ts';

function resolveRedirectLocation(url: string): string | null {
  const request = new NextRequest(url);
  return handleMarketingSlug(request, request.nextUrl.pathname)?.headers.get('location') ?? null;
}

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

test('model-shaped compatibility redirects are not owned by marketing middleware', () => {
  const source = readFileSync('frontend/lib/middleware/routing-marketing.ts', 'utf8');
  assert.doesNotMatch(source, /['"]\/models\/(?:luma-dream-machine|pika-image-to-video)/);
  assert.doesNotMatch(source, /['"]\/(?:fr\/modeles|es\/modelos)\/pika-2-2/);
  assert.match(source, /resolveLocalizedEnglishModelSegment/);
  assert.match(source, /resolveRuntimePublicSlug/);
});

test('wrong localized model segments resolve aliases directly in one hop', () => {
  assert.equal(
    resolveRedirectLocation('https://maxvideoai.com/fr/models/pika-2-2?utm_source=locale'),
    'https://maxvideoai.com/fr/modeles/pika-text-to-video?utm_source=locale'
  );
  assert.equal(
    resolveRedirectLocation('https://maxvideoai.com/es/models/pika-2-2?utm_source=locale'),
    'https://maxvideoai.com/es/modelos/pika-text-to-video?utm_source=locale'
  );
});

test('real middleware resolves every dotted public alias in localized English model segments', async () => {
  const dottedAliases = registry.models.flatMap((model) =>
    model.aliases.publicSlugs
      .filter((alias) => alias.includes('.'))
      .map((alias) => ({ alias, canonicalSlug: model.slug }))
  );

  assert.equal(dottedAliases.length, 6);
  assert.ok(
    middlewareConfig.matcher.includes('/:locale(fr|es)/models/:slug([^/]*\\.[^/]*)'),
    'the middleware matcher must admit only single-slug dotted FR/ES English model compatibility paths'
  );

  for (const { alias, canonicalSlug } of dottedAliases) {
    for (const locale of ['fr', 'es'] as const) {
      const localizedBase = locale === 'fr' ? 'modeles' : 'modelos';
      const request = new NextRequest(
        `https://maxvideoai.com/${locale}/models/${alias}?utm_source=dotted-alias`
      );
      const response = await middleware(request);
      assert.equal(response.status, 301, `${locale}/${alias} should redirect permanently`);
      assert.equal(
        response.headers.get('location'),
        `https://maxvideoai.com/${locale}/${localizedBase}/${canonicalSlug}?utm_source=dotted-alias`,
        `${locale}/${alias} should resolve directly to its localized canonical model path`
      );
    }
  }

  const staticAssetResponse = await middleware(
    new NextRequest('https://maxvideoai.com/fr/models/preview.png?cache=1')
  );
  assert.equal(staticAssetResponse.status, 200);
  assert.equal(staticAssetResponse.headers.get('location'), null);
  assert.equal(staticAssetResponse.headers.get('x-middleware-next'), '1');
});
