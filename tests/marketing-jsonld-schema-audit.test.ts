import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildFaqSchema,
  buildItemListSchema,
  buildOrganizationSchema,
  buildSoftwareSchema,
} from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-jsonld.ts';
import { buildFAQJsonLd } from '../frontend/components/seo/FAQSchema.tsx';
import { buildPricingBreadcrumbJsonLd, buildPricingServiceJsonLd } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricing-jsonld.ts';
import {
  buildModelsCatalogBreadcrumbJsonLd,
  buildModelsCatalogFaqJsonLd,
  buildModelsCatalogItemListJsonLd,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-jsonld.ts';
import {
  buildModelFaqJsonLd,
  buildModelServiceJsonLd,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/model-jsonld.ts';
import { buildModelSchemaPayloads } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema-payloads.ts';
import { buildExamplesJsonLd } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-jsonld.ts';
import {
  buildBlogPostJsonLd,
  buildBlogPostLocalization,
} from '../frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_lib/blog-post-seo.ts';
import { getFalEngineBySlug } from '../frontend/src/config/falEngines.ts';

type JsonRecord = Record<string, unknown>;

type SchemaCase = {
  surface: string;
  schemas: unknown[];
};

const DEPRECATED_SCHEMA_TYPES = new Set([
  'HowTo',
  'SpecialAnnouncement',
  'CourseInfo',
  'EstimatedSalary',
  'LearningVideo',
  'ClaimReview',
  'VehicleListing',
  'PracticeProblem',
  'Dataset',
]);

const RESTRICTED_SCHEMA_TYPES = new Set(['FAQPage']);

const KNOWN_SCHEMA_TYPES = new Set([
  'Answer',
  'Brand',
  'BreadcrumbList',
  'DefinedRegion',
  'FAQPage',
  'ImageObject',
  'ItemList',
  'ListItem',
  'MerchantReturnPolicy',
  'MonetaryAmount',
  'Offer',
  'OfferShippingDetails',
  'Organization',
  'Product',
  'QuantitativeValue',
  'Question',
  'Service',
  'ShippingDeliveryTime',
  'WebApplication',
  'WebPage',
  'Article',
]);

const URL_LIKE_KEYS = new Set([
  '@id',
  'contentUrl',
  'image',
  'item',
  'logo',
  'mainEntityOfPage',
  'thumbnailUrl',
  'url',
]);

const REQUIRED_PROPERTIES: Record<string, string[]> = {
  Article: ['headline', 'author', 'datePublished', 'dateModified', 'image', 'publisher', 'mainEntityOfPage'],
  Answer: ['text'],
  BreadcrumbList: ['itemListElement'],
  Brand: ['name'],
  FAQPage: ['mainEntity'],
  ItemList: ['itemListElement'],
  ListItem: ['position', 'name'],
  Offer: ['price', 'priceCurrency'],
  Organization: ['name'],
  Product: ['name', 'description', 'url', 'image', 'brand'],
  Question: ['name', 'acceptedAnswer'],
  Service: ['name', 'description', 'url', 'provider'],
  WebApplication: ['name', 'applicationCategory', 'operatingSystem', 'url'],
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: JsonRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function hasPresentProperty(record: JsonRecord, key: string) {
  if (!hasOwn(record, key)) return false;
  const value = record[key];
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function schemaTypes(record: JsonRecord): string[] {
  const raw = record['@type'];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((value): value is string => typeof value === 'string');
  return [];
}

function emittedSchema(schema: unknown): unknown {
  return JSON.parse(JSON.stringify(schema));
}

function assertAbsoluteUrl(value: string, path: string) {
  assert.match(value, /^https?:\/\//, `${path} should be an absolute URL`);
}

function assertRequiredProperties(record: JsonRecord, path: string) {
  for (const type of schemaTypes(record)) {
    for (const property of REQUIRED_PROPERTIES[type] ?? []) {
      assert.ok(hasPresentProperty(record, property), `${path} ${type} should include ${property}`);
    }

    if (type === 'ImageObject') {
      assert.ok(
        hasPresentProperty(record, 'url') || hasPresentProperty(record, 'contentUrl'),
        `${path} ImageObject should include url or contentUrl`
      );
    }

    if (type === 'MerchantReturnPolicy') {
      assert.ok(hasPresentProperty(record, 'applicableCountry'), `${path} MerchantReturnPolicy should include applicableCountry`);
      assert.ok(hasPresentProperty(record, 'returnPolicyCountry'), `${path} MerchantReturnPolicy should include returnPolicyCountry`);
    }
  }
}

function assertSchemaNode(value: unknown, path: string, isRoot = false) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSchemaNode(entry, `${path}[${index}]`));
    return;
  }

  if (!isRecord(value)) {
    if (typeof value === 'string') {
      assert.doesNotMatch(value, /\[[^\]]+\]/, `${path} should not contain placeholder text`);
    }
    return;
  }

  if (isRoot) {
    assert.equal(value['@context'], 'https://schema.org', `${path} should use the Schema.org context`);
    assert.ok(schemaTypes(value).length > 0, `${path} should declare @type`);
  }

  for (const type of schemaTypes(value)) {
    assert.ok(KNOWN_SCHEMA_TYPES.has(type), `${path} uses an unexpected schema type: ${type}`);
    assert.ok(!DEPRECATED_SCHEMA_TYPES.has(type), `${path} should not emit deprecated ${type} schema`);
  }

  assertRequiredProperties(value, path);

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (typeof child === 'string') {
      assert.doesNotMatch(child, /\[[^\]]+\]/, `${childPath} should not contain placeholder text`);
      if (URL_LIKE_KEYS.has(key)) {
        assertAbsoluteUrl(child, childPath);
      }
      if (/^date(?:Published|Modified|Posted)$/i.test(key) || key === 'uploadDate') {
        assert.match(child, /^\d{4}-\d{2}-\d{2}/, `${childPath} should use an ISO-like date`);
      }
      continue;
    }

    if (URL_LIKE_KEYS.has(key) && Array.isArray(child)) {
      child.forEach((entry, index) => {
        if (typeof entry === 'string') {
          assertAbsoluteUrl(entry, `${childPath}[${index}]`);
        }
      });
    }

    assertSchemaNode(child, childPath);
  }
}

function collectTypes(value: unknown, types = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectTypes(entry, types));
    return types;
  }

  if (!isRecord(value)) return types;

  schemaTypes(value).forEach((type) => types.add(type));
  Object.values(value).forEach((entry) => collectTypes(entry, types));
  return types;
}

function getRequiredEngine(slug: string) {
  const engine = getFalEngineBySlug(slug);
  assert.ok(engine, `${slug} should exist in the Fal engine catalog`);
  return engine;
}

function readBlogMdxJsonLdSchemas(): SchemaCase {
  const contentRoot = join(process.cwd(), 'content');
  const schemas: unknown[] = [];
  for (const localeDir of readdirSync(contentRoot, { withFileTypes: true })) {
    if (!localeDir.isDirectory()) continue;
    const blogRoot = join(contentRoot, localeDir.name, 'blog');
    if (!existsSync(blogRoot)) continue;
    for (const file of readdirSync(blogRoot, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.mdx')) continue;
      const sourcePath = join(blogRoot, file.name);
      const source = readFileSync(sourcePath, 'utf8');
      const scriptRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      for (const match of source.matchAll(scriptRegex)) {
        const rawJson = match[1]?.trim();
        if (!rawJson) continue;
        try {
          schemas.push(JSON.parse(rawJson));
        } catch (error) {
          assert.fail(`${sourcePath} contains invalid JSON-LD: ${error}`);
        }
      }
    }
  }

  return {
    surface: 'blog-mdx-inline',
    schemas,
  };
}

function buildAuditedSchemaCases(): SchemaCase[] {
  const seedance = getRequiredEngine('seedance-2-0');
  const blogLocalization = buildBlogPostLocalization({
    canonicalSlug: 'schema-audit-sample',
    locale: 'en',
    localizedSlugs: { en: 'schema-audit-sample' },
  });
  const blogSchemas = buildBlogPostJsonLd({
    locale: 'en',
    localization: blogLocalization,
    modifiedIso: '2026-06-20',
    post: {
      content: '',
      date: '2026-06-01',
      description: 'Schema audit sample for MaxVideoAI blog structured data.',
      excerpt: 'Schema audit sample.',
      image: '/og/schema-audit.png',
      slug: 'schema-audit-sample',
      title: 'Schema Audit Sample',
    },
    publishedIso: '2026-06-01',
  });
  const examplesSchemas = buildExamplesJsonLd({
    canonicalUrl: 'https://maxvideoai.com/examples',
    faqBlock: {
      title: 'Examples FAQ',
      items: [
        {
          question: 'Can I clone AI video examples?',
          answer: 'Yes. MaxVideoAI examples include source prompts and model metadata for supported videos.',
        },
      ],
    },
    galleryBasePath: '/examples',
    galleryVideos: [
      {
        aspectRatio: '16:9',
        durationSec: 5,
        engineId: 'seedance-2-0',
        engineLabel: 'Seedance 2.0',
        id: 'schema-audit-video',
        prompt: 'A cinematic product reveal shot.',
        promptExcerpt: 'A cinematic product reveal shot.',
      },
    ] as never,
    locale: 'en',
    localePrefix: '',
  });

  return [
    {
      surface: 'home',
      schemas: [
        buildSoftwareSchema({
          hero: { subtitle: 'Generate AI video with price-before-you-render controls.' },
          pricingTrust: { subtitle: 'Start with pay-as-you-go credits.' },
          providers: { title: 'Supported AI video engines' },
        } as never),
        buildOrganizationSchema(),
        buildFaqSchema([
          {
            question: 'What is MaxVideoAI?',
            answer: 'MaxVideoAI is a browser-based AI video generation workspace.',
          },
        ]),
        buildItemListSchema(
          {
            providers: { title: 'Supported AI video engines' },
          } as never,
          [{ provider: 'OpenAI', model: 'Sora 2' }] as never
        ),
      ],
    },
    {
      surface: 'pricing',
      schemas: [
        buildPricingBreadcrumbJsonLd({ canonical: 'https://maxvideoai.com/pricing', locale: 'en' }),
        buildPricingServiceJsonLd({ canonical: 'https://maxvideoai.com/pricing', locale: 'en' }),
        buildFAQJsonLd([
          {
            question: 'How does MaxVideoAI pricing work?',
            answer: 'MaxVideoAI uses pay-as-you-go credits and shows estimated cost before generation.',
          },
        ]),
      ],
    },
    {
      surface: 'models-catalog',
      schemas: [
        buildModelsCatalogBreadcrumbJsonLd({ activeLocale: 'en', scope: 'all' }),
        buildModelsCatalogItemListJsonLd({
          activeLocale: 'en',
          modelCards: [{ id: 'seedance-2-0', label: 'Seedance 2.0' }],
          scope: 'all',
        }),
        buildModelsCatalogFaqJsonLd([
          {
            question: 'Which AI video model should I use?',
            answer: 'Choose based on motion quality, references, audio support, duration, and price.',
          },
        ]),
      ],
    },
    {
      surface: 'model-detail',
      schemas: [
        buildModelServiceJsonLd('seedance-2-0'),
        buildModelFaqJsonLd('seedance-2-0'),
        ...buildModelSchemaPayloads({
          canonical: 'https://maxvideoai.com/models/seedance-2-0',
          description: 'Generate Seedance 2.0 AI videos in MaxVideoAI.',
          engine: seedance,
          heroPosterAbsolute: 'https://maxvideoai.com/og/seedance-2-0.png',
          heroTitle: 'Seedance 2.0 AI Video Generator',
          inLanguage: 'en-US',
          localizedCanonical: 'https://maxvideoai.com/models/seedance-2-0',
          localizedHomeUrl: 'https://maxvideoai.com',
          localizedModelsUrl: 'https://maxvideoai.com/models',
          pricingEngine: seedance.engine,
          resolvedBreadcrumb: {
            home: 'Home',
            models: 'Models',
          },
        }),
      ],
    },
    {
      surface: 'examples',
      schemas: Object.values(examplesSchemas),
    },
    {
      surface: 'blog',
      schemas: [blogSchemas.articleSchema, blogSchemas.breadcrumbJsonLd],
    },
    readBlogMdxJsonLdSchemas(),
  ];
}

test('marketing JSON-LD builders emit baseline-valid schema payloads', () => {
  for (const schemaCase of buildAuditedSchemaCases()) {
    const schemas = schemaCase.schemas.filter(Boolean).map(emittedSchema);
    assert.ok(schemas.length > 0, `${schemaCase.surface} should expose JSON-LD schemas for audit`);
    schemas.forEach((schema, index) => assertSchemaNode(schema, `${schemaCase.surface}[${index}]`, true));
  }
});

test('restricted FAQPage usage is inventoried without allowing deprecated schema types', () => {
  const restrictedSurfaces = new Set<string>();
  const deprecatedTypes = new Set<string>();

  for (const schemaCase of buildAuditedSchemaCases()) {
    for (const schema of schemaCase.schemas.filter(Boolean).map(emittedSchema)) {
      const types = collectTypes(schema);
      for (const type of types) {
        if (RESTRICTED_SCHEMA_TYPES.has(type)) {
          restrictedSurfaces.add(schemaCase.surface);
        }
        if (DEPRECATED_SCHEMA_TYPES.has(type)) {
          deprecatedTypes.add(type);
        }
      }
    }
  }

  assert.deepEqual([...deprecatedTypes], [], 'audited marketing schemas should not emit deprecated schema types');
  assert.ok(restrictedSurfaces.has('home'), 'homepage FAQPage debt should be visible in the schema audit');
  assert.ok(restrictedSurfaces.has('pricing'), 'pricing FAQPage debt should remain inventoried');
  assert.ok(restrictedSurfaces.has('models-catalog'), 'models catalog FAQPage debt should remain inventoried');
  assert.ok(restrictedSurfaces.has('blog-mdx-inline'), 'inline blog FAQPage debt should remain inventoried');
});
