import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getRuntimeModelById } from '../frontend/config/model-runtime.ts';
import { getFalEngineById } from '../frontend/src/config/falEngines.ts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts.ts';
import { quotePublicPricing } from '../frontend/src/lib/pricing-public-quote.ts';
import { buildMetadataUrls } from '../frontend/lib/metadataUrls.ts';
import { buildModelSchemaPayloads } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema-payloads.ts';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import { buildDetailSlugMap } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-links.ts';
import {
  getModelPageTemplateConfig,
  isPrelaunchModelPageTemplateSlug,
  listPrelaunchModelPageTemplateSlugs,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

const slug = 'seedance-2-5';
const locales = ['en', 'fr', 'es'] as const;

const expectedLaunchCopy = {
  en: {
    badge: 'New · Up to 30 seconds · 720p · Native audio',
    primaryCta: 'Generate with Seedance 2.5',
    secondaryCta: 'View Seedance examples',
    compareCta: 'Compare with Seedance 2.0',
    examplesHref: '/examples/seedance',
    compareHref: '/ai-video-engines/seedance-2-0-vs-seedance-2-5?order=seedance-2-5',
    pricingHref: '/pricing#seedance-2-5-pricing',
  },
  fr: {
    badge: 'Nouveau · Jusqu’à 30 secondes · 720p · Audio natif',
    primaryCta: 'Générer avec Seedance 2.5',
    secondaryCta: 'Voir les exemples Seedance',
    compareCta: 'Comparer avec Seedance 2.0',
    examplesHref: '/fr/galerie/seedance',
    compareHref: '/fr/comparatif/seedance-2-0-vs-seedance-2-5?order=seedance-2-5',
    pricingHref: '/fr/tarifs#seedance-2-5-pricing',
  },
  es: {
    badge: 'Nuevo · Hasta 30 segundos · 720p · Audio nativo',
    primaryCta: 'Generar con Seedance 2.5',
    secondaryCta: 'Ver ejemplos de Seedance',
    compareCta: 'Comparar con Seedance 2.0',
    examplesHref: '/es/galeria/seedance',
    compareHref: '/es/comparativa/seedance-2-0-vs-seedance-2-5?order=seedance-2-5',
    pricingHref: '/es/precios#seedance-2-5-pricing',
  },
} as const;

test('Seedance 2.5 uses the public conversion template with pricing and comparison enabled', () => {
  const model = getRuntimeModelById(slug);
  const template = getModelPageTemplateConfig(slug);

  assert.ok(model);
  assert.ok(template);
  assert.equal(template.intent, 'production');
  assert.equal(isPrelaunchModelPageTemplateSlug(slug), false);
  assert.equal(template.hero.primaryCtaHref, '/app?engine=seedance-2-5');
  assert.equal(template.hero.secondaryCtaHref, '/examples/seedance');
  assert.equal(template.pricing.enabled, true);
  assert.equal(template.pricing.anchorHref, '#pricing');
  assert.deepEqual(
    template.pricing.presets.map(({ id }) => id),
    ['4s-480p', '15s-720p-audio', '24s-720p', 'max-duration'],
  );
  assert.equal(template.sections.examples, true);
  assert.equal(template.sections.prompting, true);
  assert.equal(template.sections.tips, true);
  assert.equal(template.sections.compare, true);
  assert.equal(template.sections.specs, true);

  assert.equal(model.publication.model.indexable, true);
  assert.equal(model.publication.app.published, true);
  assert.equal(model.publication.pricing.published, true);
  assert.equal(model.publication.examples.published, true);
  assert.equal(model.publication.compare.published, true);
  assert.equal(model.publication.sitemap.published, true);
  assert.deepEqual(listPrelaunchModelPageTemplateSlugs(), []);
});

test('Seedance 2.5 localized marketing content converts in EN, FR, and ES without rollout language', () => {
  for (const locale of locales) {
    const source = `content/models/${locale}/${slug}.json`;
    const document = JSON.parse(readFileSync(source, 'utf8')) as {
      custom?: Record<string, unknown>;
      hero: {
        badge: string;
        ctaPrimary: { label: string; href: string };
      };
      faqs: Array<{ q: string; a: string }>;
      decision?: unknown;
      prompting?: unknown;
      examples?: unknown;
    };
    const launchCopy = expectedLaunchCopy[locale];
    const decision = parseModelDecisionContent(document.decision, slug, locale, `${source}#decision`);
    const prompting = parseModelPromptingContent(document.prompting, slug, locale, `${source}#prompting`);
    const examples = parseModelExamplesContent(document.examples, slug, locale, `${source}#examples`);
    const serialized = JSON.stringify(document);

    assert.match(serialized, /seedance-2-5/);
    assert.equal(document.hero.badge, launchCopy.badge);
    assert.deepEqual(document.hero.ctaPrimary, {
      label: launchCopy.primaryCta,
      href: '/app?engine=seedance-2-5',
    });
    assert.equal(decision.modelSlug, slug);
    assert.equal(decision.hero.primaryCta.label, launchCopy.primaryCta);
    assert.equal(decision.hero.primaryCta.href, '/app?engine=seedance-2-5');
    assert.deepEqual(decision.hero.secondaryCta, {
      label: launchCopy.secondaryCta,
      href: launchCopy.examplesHref,
    });
    assert.deepEqual(decision.hero.quickLinks[0], {
      label: launchCopy.compareCta,
      href: launchCopy.compareHref,
    });
    assert.deepEqual(decision.hero.quickLinks.slice(1).map(({ href }) => href), [launchCopy.pricingHref, '#prompting']);
    assert.equal(decision.referenceWorkflows.length, 4);
    const workflowCopy = decision.referenceWorkflows.map(({ title, body }) => `${title} ${body}`).join(' ');
    const requiredWorkflowTerms = {
      en: [/text/i, /start image/i, /end image/i, /multimodal references/i, /edit.*video/i, /extend/i, /optional generated audio/i],
      fr: [/texte/i, /image de départ/i, /image de fin/i, /références multimodales/i, /mont.*vidéo/i, /prolong/i, /audio généré optionnel/i],
      es: [/texto/i, /imagen inicial/i, /imagen final/i, /referencias multimodales/i, /edit.*vídeo/i, /exten/i, /audio generado opcional/i],
    } as const;
    for (const term of requiredWorkflowTerms[locale]) {
      assert.match(workflowCopy, term);
    }
    assert.match(
      document.faqs.at(-1)?.a ?? '',
      locale === 'en'
        ? /available to MaxVideoAI users.*price.*shown before each render/i
        : locale === 'fr'
          ? /accessible aux utilisateurs de MaxVideoAI.*prix.*affiché avant chaque rendu/i
          : /disponible para los usuarios de MaxVideoAI.*precio.*muestra antes de cada render/i,
    );
    assert.equal(prompting.modelSlug, slug);
    assert.equal(examples.modelSlug, slug);
    assert.equal(examples.showWhenEmpty, false);
    assert.deepEqual(prompting.tabs.map((tab) => tab.id), ['concept', 'timeline', 'constraints']);
    assert.deepEqual(examples.filters.map((filter) => filter.id), ['all', 'cinematic', 'audio']);
    assert.deepEqual(
      examples.proofItems.map(({ id, icon }) => [id, icon]),
      [
        ['continuity', 'users'],
        ['camera', 'maximize'],
        ['physics', 'zap'],
        ['dialogue', 'audio'],
        ['production', 'shield'],
      ],
    );
    assert.equal(Object.hasOwn(document.custom ?? {}, 'prelaunch'), false);
    assert.doesNotMatch(
      serialized,
      /public generation is not open|génération publique n’est pas ouverte|generación pública no está abierta/i,
    );
    assert.doesNotMatch(
      serialized,
      /\b(?:BytePlus|ModelArk|provider|canary|unconfirmed|rollout|USD|credits?)\b|\$\s*\d/i,
    );
  }
});

test('Seedance 2.5 emits canonical localized metadata URLs and complete public schemas', () => {
  const engine = getFalEngineById(slug);
  assert.ok(engine);
  assert.equal(engine.surfaces.pricing.includeInEstimator, true);

  const expectedMetadataUrls = {
    en: 'https://maxvideoai.com/models/seedance-2-5',
    fr: 'https://maxvideoai.com/fr/modeles/seedance-2-5',
    es: 'https://maxvideoai.com/es/modelos/seedance-2-5',
  } as const;
  for (const locale of locales) {
    const metadataUrls = buildMetadataUrls(locale, buildDetailSlugMap(slug), {
      englishPath: `/models/${slug}`,
      availableLocales: [...locales],
    });
    assert.equal(metadataUrls.canonical, expectedMetadataUrls[locale]);
    assert.deepEqual(metadataUrls.languages, {
      en: expectedMetadataUrls.en,
      fr: expectedMetadataUrls.fr,
      es: expectedMetadataUrls.es,
      'x-default': expectedMetadataUrls.en,
    });
  }

  const canonical = expectedMetadataUrls.en;
  const schemas = buildModelSchemaPayloads({
    canonical,
    description: 'Seedance 2.5 marketing page',
    engine,
    heroPosterAbsolute: null,
    heroTitle: 'Seedance 2.5',
    inLanguage: 'en-US',
    localizedCanonical: canonical,
    localizedHomeUrl: 'https://maxvideoai.com/',
    localizedModelsUrl: 'https://maxvideoai.com/models',
    pricingEngine: engine.engine,
    resolvedBreadcrumb: { home: 'Home', models: 'Models' },
  }) as Array<Record<string, unknown>>;
  assert.deepEqual(schemas.map((schema) => schema['@type']), ['WebPage', 'Product', 'BreadcrumbList']);

  const webPage = schemas[0];
  const product = schemas[1] as Record<string, unknown> & { offers?: Record<string, unknown> };
  const breadcrumb = schemas[2] as Record<string, unknown> & {
    itemListElement?: Array<Record<string, unknown>>;
  };
  assert.equal(webPage?.url, canonical);
  assert.equal(product?.url, canonical);
  assert.ok(product);
  assert.ok(product.offers);
  assert.equal(product.offers['@type'], 'Offer');
  assert.equal(product.offers.url, canonical);
  assert.equal(breadcrumb.itemListElement?.at(-1)?.item, canonical);

  const facts = buildPublicPricingFacts({
    engine: engine.engine,
    mode: 't2v',
    durationSec: 4,
    resolution: '480p',
    aspectRatio: '16:9',
    addons: { audio: false },
  });
  const canonicalQuote = quotePublicPricing({
    facts: facts.facts,
    scenario: {
      id: 'public:seedance-2-5:model-page-offer',
      engineId: slug,
      mode: 't2v',
      resolution: '480p',
      membershipTier: 'member',
    },
    compatibilityProfileId: facts.compatibilityProfileId,
  });
  assert.equal(product.offers.priceCurrency, 'USD');
  assert.equal(product.offers.price, (canonicalQuote.customerTotalCents / 100).toFixed(2));
});
