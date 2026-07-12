import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import registry from '../frontend/config/model-registry.json' with { type: 'json' };
import { validateModelRegistryDocument } from '../frontend/config/model-registry-validation.ts';
import { createRuntimeModelResolver } from '../frontend/config/model-runtime.ts';
import { buildModelRuntimeProjection } from '../scripts/lib/model-runtime-projection.mjs';
import { buildModelRegistryRedirects } from '../frontend/config/model-registry-redirects.cjs';
import {
  handleMarketingSlug,
  isDottedLocalizedEnglishModelCompatibilityPath,
} from '../frontend/lib/middleware/routing-marketing.ts';

function replacementFixture() {
  const fixture = structuredClone(registry) as any;
  const retired = fixture.models.find((model: any) => model.id === 'happy-horse-1-0');
  const target = fixture.models.find((model: any) => model.id === 'happy-horse-1-1');
  assert.ok(retired.aliases.publicSlugs.includes('happy-horse-1.0'));
  retired.replacement = target.id;
  retired.publication = {
    model: { published: false, indexable: false },
    examples: { published: false, includeInFamilyCopy: false, current: false },
    compare: { published: false, indexed: false, suggestedOpponentIds: [], publishedPairIds: [] },
    app: { published: false },
    pricing: { published: false },
    sitemap: { published: false },
  };
  return { document: validateModelRegistryDocument(fixture), retired, target };
}

test('flattened runtime public resolution targets replacements without changing engine inputs', () => {
  const { document, retired, target } = replacementFixture();
  const runtime = buildModelRuntimeProjection(document);
  const resolver = createRuntimeModelResolver(runtime);

  assert.equal(resolver.resolveEngineInput(retired.id)?.id, retired.id);
  assert.equal(resolver.resolveEngineInput(retired.aliases.internal[0])?.id, retired.id);
  assert.equal(runtime.models.find((model: any) => model.id === retired.id)?.publicTargetId, target.id);
  assert.equal(resolver.resolvePublicSlug(retired.slug)?.id, target.id);
  for (const alias of retired.aliases.publicSlugs) {
    assert.equal(resolver.resolvePublicSlug(alias)?.id, target.id, alias);
  }
  assert.equal(Object.hasOwn(runtime.models.find((model: any) => model.id === retired.id), 'replacement'), false);
});

test('FR and ES wrong-English replacement paths redirect once to the localized active canonical slug', () => {
  const { document, retired, target } = replacementFixture();
  const runtime = buildModelRuntimeProjection(document);
  const resolver = createRuntimeModelResolver(runtime);
  const slugs = [retired.slug, ...retired.aliases.publicSlugs];

  assert.equal(
    isDottedLocalizedEnglishModelCompatibilityPath(
      '/fr/models/happy-horse-1.0',
      resolver.resolvePublicSlug
    ),
    true
  );

  for (const locale of ['fr', 'es'] as const) {
    const localizedBase = locale === 'fr' ? 'modeles' : 'modelos';
    for (const slug of slugs) {
      const request = new NextRequest(
        `https://maxvideoai.com/${locale}/models/${slug}?utm_source=replacement&keep=1`
      );
      const response = handleMarketingSlug(
        request,
        request.nextUrl.pathname,
        resolver.resolvePublicSlug
      );
      assert.equal(response?.status, 301, `${locale}:${slug}`);
      assert.equal(
        response?.headers.get('location'),
        `https://maxvideoai.com/${locale}/${localizedBase}/${target.slug}?utm_source=replacement&keep=1`,
        `${locale}:${slug}`
      );
    }
  }

  const native = buildModelRegistryRedirects(document);
  const sources = new Set(native.map((rule: any) => rule.source));
  assert.equal(sources.size, native.length, 'native redirect sources must remain unique');
  for (const rule of native.filter((candidate: any) =>
    slugs.some((slug) => candidate.source.endsWith(`/${slug}`))
  )) {
    assert.equal(sources.has(rule.destination), false, `${rule.source} must stay one hop`);
    assert.ok(rule.destination.endsWith(`/${target.slug}`), rule.source);
  }
});
