import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getRuntimeModelById,
  resolveRuntimePublicSlug,
  resolveRuntimeEngineInput,
} from '../frontend/config/model-runtime.ts';
import { resolveModelRegistryEngineInput } from '../frontend/config/model-registry.ts';
import {
  getFalEngineById,
  getFalEngineBySlug,
} from '../frontend/src/config/falEngines.ts';
import {
  getBaseEngineIncludingHidden,
  getBaseEngines,
} from '../frontend/src/lib/engines.ts';
import {
  getModelPageTemplateConfig,
  listModelPageTemplateSlugs,
  listPrelaunchModelPageTemplateSlugs,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';
import { parseModelPrelaunchContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prelaunch-content.ts';
import { buildModelPrelaunchSchemaPayloads } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prelaunch-schema.ts';
import {
  mergeEngineLocalizedContent,
  type EngineOverlay,
} from '../frontend/lib/models/i18n-normalization.ts';
import {
  buildMetaDescription,
  buildMetaTitle,
} from '../frontend/lib/seo/meta.ts';

const slug = 'seedance-2-5';
const locales = ['en', 'fr', 'es'] as const;

test('Seedance 2.5 is a published noindex presentation page without an executable engine', () => {
  const model = getRuntimeModelById(slug);

  assert.ok(model);
  assert.equal(model.presentationOnly, true);
  assert.equal(model.publication.model.published, true);
  assert.equal(model.publication.model.indexable, false);
  assert.equal(model.publication.app.published, false);
  assert.equal(model.publication.pricing.published, false);
  assert.equal(model.publication.examples.published, false);
  assert.equal(model.publication.compare.published, false);
  assert.equal(model.publication.sitemap.published, false);
  assert.equal(resolveRuntimePublicSlug(slug)?.id, slug);
  assert.equal(resolveRuntimeEngineInput(slug), null);
  assert.equal(resolveModelRegistryEngineInput(slug), null);

  assert.equal(getFalEngineById(slug), undefined);
  assert.equal(getFalEngineBySlug(slug), undefined);
  assert.equal(getBaseEngineIncludingHidden(slug), undefined);
  assert.equal(getBaseEngines().some((engine) => engine.id === slug), false);

  const roster = JSON.parse(
    readFileSync('frontend/config/model-roster.json', 'utf8'),
  ) as Array<{ modelSlug?: string }>;
  assert.equal(roster.some((entry) => entry.modelSlug === slug), false);
});

test('Seedance 2.5 uses the canonical model template registry in prelaunch mode', () => {
  const template = getModelPageTemplateConfig(slug);

  assert.ok(template);
  assert.equal(template.intent, 'prelaunch');
  assert.equal(template.pricing.enabled, false);
  assert.deepEqual(template.pricing.presets, []);
  assert.equal(template.sections.examples, false);
  assert.equal(template.sections.prompting, false);
  assert.equal(template.sections.compare, false);
  assert.equal(template.sections.specs, false);
  assert.doesNotMatch(JSON.stringify(template), /\/app\?engine=seedance-2-5/i);
  assert.doesNotMatch(
    JSON.stringify(template.hero),
    /\b(?:API|BytePlus|ModelArk|provider|pricing|price|unconfirmed|unavailable)\b/i,
  );
  assert.equal(listModelPageTemplateSlugs().includes(slug), false);
  assert.deepEqual(listPrelaunchModelPageTemplateSlugs(), [slug]);
});

test('Seedance 2.5 public copy stays factual, customer-facing, and free of rollout jargon', () => {
  for (const locale of locales) {
    const content = JSON.parse(
      readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'),
    ) as EngineOverlay & Record<string, unknown>;
    const serialized = JSON.stringify(content);
    const parsed = parseModelPrelaunchContent(
      mergeEngineLocalizedContent({}, content),
      locale,
    );

    assert.equal(content.marketingName, 'Seedance 2.5');
    assert.equal(parsed.custom.prelaunch.modelSlug, slug);
    assert.equal(parsed.hero.secondaryLinks.length, 1);
    assert.match(serialized, /coming_soon/);
    assert.doesNotMatch(serialized, /\/app\?engine=seedance-2-5/i);
    assert.equal(Object.hasOwn(content, 'pricingNotes'), false);
    assert.equal(
      Object.hasOwn(content.custom?.prelaunch ?? {}, 'apiAvailability'),
      false,
    );
    assert.equal(
      Object.hasOwn(content.custom?.prelaunch ?? {}, 'pricingAvailability'),
      false,
    );
    assert.equal(
      Object.hasOwn(content.custom?.prelaunch ?? {}, 'integrationChecks'),
      false,
    );
    assert.equal('apiAvailability' in parsed.custom.prelaunch, false);
    assert.equal('pricingAvailability' in parsed.custom.prelaunch, false);
    assert.equal('pricingNotes' in parsed, false);
    assert.equal('integrationChecks' in parsed.custom.prelaunch, false);
    assert.equal('integrationEyebrow' in parsed.custom.prelaunch.labels, false);

    const publicCopy = [
      parsed.seo.title,
      parsed.seo.description,
      parsed.overview,
      parsed.hero.title,
      parsed.hero.intro,
      parsed.hero.badge,
      parsed.hero.ctaPrimary.label,
      ...parsed.hero.secondaryLinks.map((link) => link.label),
      ...parsed.faqs.flatMap((faq) => [faq.question, faq.answer]),
      ...Object.values(parsed.custom.prelaunch.labels),
      ...parsed.custom.prelaunch.statusItems.flatMap((item) => [
        item.label,
        item.value,
        item.detail,
      ]),
      ...parsed.custom.prelaunch.announcedCapabilities.flatMap((item) => [
        item.title,
        item.body,
      ]),
    ].join(' ');

    assert.doesNotMatch(
      publicCopy,
      /\b(?:API|BytePlus|ModelArk|provider|providers|fournisseur|fournisseurs|proveedor|proveedores|engine|moteur|motor|pricing|price|prix|tarif|tarifs|tarification|precio|precios|cost|coût|coste|rate|billing|facturation|facturación|payload|endpoint|polling|canary|canari|canario|technical|technique|técnic\w*|contract|contrat|contrato|legal|juridique|refund|remboursement|unconfirmed|unavailable|indisponible|sin confirmar)\b/i,
    );
  }
});

test('Seedance 2.5 social metadata is not truncated and uses a portable raster card', () => {
  for (const locale of locales) {
    const content = JSON.parse(
      readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'),
    ) as EngineOverlay;
    const title = content.seo?.title;
    const description = content.seo?.description;
    const image = content.seo?.image;

    assert.ok(title);
    assert.ok(description);
    assert.ok(image);
    assert.equal(buildMetaTitle(title), title);
    assert.equal(buildMetaDescription(description), description);
    assert.match(image, /\.png$/);
  }

  const card = readFileSync(`frontend/public/models/${slug}-coming-soon.png`);
  assert.deepEqual([...card.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

  const socialSource = readFileSync(
    `frontend/public/models/${slug}-coming-soon.svg`,
    'utf8',
  );
  assert.doesNotMatch(
    socialSource,
    /\b(?:API|BytePlus|ModelArk|provider|pricing|price|unconfirmed|unavailable)\b/i,
  );
});

test('the canonical route has a dedicated prelaunch renderer without product or pricing schema', () => {
  const route = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx',
    'utf8',
  );
  const renderer = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPrelaunchPageLayout.tsx',
    'utf8',
  );
  const prelaunchRoute = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prelaunch-route.tsx',
    'utf8',
  );

  assert.match(route, /listPublishedRuntimeModels/);
  assert.match(route, /renderMarketingModelPrelaunchPage/);
  assert.match(route, /presentationOnly/i);
  assert.match(prelaunchRoute, /MarketingModelPrelaunchPageLayout/);
  assert.doesNotMatch(renderer, /ModelDecisionPricingCard|pricingEngine|["']Product["']|["']Offer["']/);
  assert.doesNotMatch(renderer, /\/app\?engine=seedance-2-5/i);
  assert.doesNotMatch(
    renderer,
    /(?:text|border)-white\/(?:12|45|65|68)\b/,
    'prelaunch renderer should use Tailwind-supported opacity modifiers',
  );
});

test('prelaunch structured data contains only the editorial page and breadcrumbs', () => {
  const schemas = buildModelPrelaunchSchemaPayloads({
    canonicalUrl: 'https://maxvideoai.com/models/seedance-2-5',
    description: 'Coming soon.',
    inLanguage: 'en-US',
    modelName: 'Seedance 2.5',
    homeLabel: 'Home',
    homeUrl: 'https://maxvideoai.com/',
    modelsLabel: 'Models',
    modelsUrl: 'https://maxvideoai.com/models',
  });

  assert.deepEqual(schemas.map((schema) => schema['@type']), [
    'WebPage',
    'BreadcrumbList',
  ]);
  assert.doesNotMatch(JSON.stringify(schemas), /"Product"|"Offer"|priceCurrency|availability/);
});

test('an explicit Seedance 2.5 generation request fails as unknown before configured-engine, database, and billing work', () => {
  const routeContext = readFileSync(
    'frontend/app/api/generate/_lib/route-context.ts',
    'utf8',
  );
  const baseEngineGuard = routeContext.indexOf(
    'const registeredBaseEngine = getBaseEngineIncludingHidden(requestedEngineId);',
  );
  const unknownEngineGuard = routeContext.indexOf(
    "body: { ok: false, error: 'Unknown engine' }",
  );
  const configuredEngineLookup = routeContext.indexOf(
    'const publicEngine = await getConfiguredEngine(requestedEngineId);',
  );
  const databaseGuard = routeContext.indexOf('isDatabaseConfigured()');
  const billingBootstrap = routeContext.indexOf('await ensureBillingSchema()');

  assert.ok(baseEngineGuard >= 0);
  assert.ok(unknownEngineGuard > baseEngineGuard);
  assert.ok(configuredEngineLookup > unknownEngineGuard);
  assert.ok(databaseGuard > unknownEngineGuard);
  assert.ok(billingBootstrap > unknownEngineGuard);
});
