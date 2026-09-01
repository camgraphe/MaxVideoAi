import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import {
  getRuntimeModelByCanonicalSlug,
  resolveRuntimePublicSlug,
} from '../frontend/config/model-runtime.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildModelDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const P0_SLUGS = [
  'wan-3',
  'wan-3-prime',
  'ltx-2-5-fast',
  'ltx-2-5-pro',
  'grok-imagine-video-1-5',
  'flux-3',
  'flux-3-draft',
] as const;

const EXPECTED_OWNER = {
  'wan-3': /Alibaba|Tongyi/i,
  'wan-3-prime': /Alibaba|Tongyi/i,
  'ltx-2-5-fast': /Lightricks/i,
  'ltx-2-5-pro': /Lightricks/i,
  'grok-imagine-video-1-5': /xAI/i,
  'flux-3': /Black Forest Labs/i,
  'flux-3-draft': /Black Forest Labs/i,
} as const;

const OFFICIAL_GUIDE = {
  'wan-3': 'https://docs.modelstudio.console.alibabacloud.com/en/model-studio/wan3-video-generation-guide',
  'wan-3-prime': 'https://docs.modelstudio.console.alibabacloud.com/en/model-studio/wan3-video-generation-guide',
  'ltx-2-5-fast': 'https://docs.ltx.io/api-documentation/implementation-guides/prompting-guide',
  'ltx-2-5-pro': 'https://docs.ltx.io/api-documentation/implementation-guides/prompting-guide',
  'grok-imagine-video-1-5': 'https://docs.x.ai/developers/models/grok-imagine-video-1.5',
  'flux-3': 'https://bfl.ai/blog/flux-3-video',
  'flux-3-draft': 'https://bfl.ai/blog/flux-3-video',
} as const;

const FAMILY_HREF = {
  en: { wan: '/examples/wan', ltx: '/examples/ltx', grok: '/examples/grok', flux: '/examples/flux' },
  fr: { wan: '/fr/galerie/wan', ltx: '/fr/galerie/ltx', grok: '/fr/galerie/grok', flux: '/fr/galerie/flux' },
  es: { wan: '/es/galeria/wan', ltx: '/es/galeria/ltx', grok: '/es/galeria/grok', flux: '/es/galeria/flux' },
} as const;

const COMPARISON_SLUGS = {
  'wan-3': ['wan-2-6-vs-wan-3'],
  'wan-3-prime': ['wan-3-vs-wan-3-prime'],
  'ltx-2-5-fast': ['ltx-2-3-fast-vs-ltx-2-5-fast', 'ltx-2-5-fast-vs-ltx-2-5-pro'],
  'ltx-2-5-pro': ['ltx-2-3-pro-vs-ltx-2-5-pro', 'ltx-2-5-fast-vs-ltx-2-5-pro'],
  'grok-imagine-video-1-5': ['grok-imagine-video-1-5-vs-sora-2', 'flux-3-vs-grok-imagine-video-1-5'],
  'flux-3': ['flux-3-vs-flux-3-draft', 'flux-3-vs-grok-imagine-video-1-5'],
  'flux-3-draft': ['flux-3-vs-flux-3-draft'],
} as const;

const SIBLING_SLUG = {
  'wan-3': 'wan-3-prime',
  'wan-3-prime': 'wan-3',
  'ltx-2-5-fast': 'ltx-2-5-pro',
  'ltx-2-5-pro': 'ltx-2-5-fast',
  'grok-imagine-video-1-5': null,
  'flux-3': 'flux-3-draft',
  'flux-3-draft': 'flux-3',
} as const;

const LIFECYCLE = {
  'ltx-2-3-pro': { state: 'legacy', successor: 'ltx-2-5-pro', comparison: 'ltx-2-3-pro-vs-ltx-2-5-pro' },
  'ltx-2-3-fast': { state: 'legacy', successor: 'ltx-2-5-fast', comparison: 'ltx-2-3-fast-vs-ltx-2-5-fast' },
  'ltx-2': { state: 'deep_legacy', successor: 'ltx-2-5-pro', comparison: null },
  'ltx-2-fast': { state: 'deep_legacy', successor: 'ltx-2-5-fast', comparison: null },
  'wan-2-6': { state: 'legacy', successor: 'wan-3', comparison: 'wan-2-6-vs-wan-3' },
  'wan-2-5': { state: 'deep_legacy', successor: 'wan-3', comparison: null },
} as const;

type ModelDocument = {
  marketingName?: string;
  seo?: { title?: string; description?: string };
  decision?: unknown;
  prompting?: unknown;
  examples?: unknown;
} & Record<string, unknown>;

function readDocument(locale: AppLocale, slug: string): ModelDocument {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), 'content', 'models', locale, `${slug}.json`), 'utf8'),
  ) as ModelDocument;
}

function collectVisibleStrings(value: unknown, key = ''): string[] {
  if (typeof value === 'string') return ['href', 'id', 'icon', 'kind', 'modelSlug', 'image'].includes(key) ? [] : [value];
  if (Array.isArray(value)) return value.flatMap((entry) => collectVisibleStrings(entry, key));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([nestedKey, nested]) => collectVisibleStrings(nested, nestedKey));
}

function wordCount(value: unknown): number {
  return collectVisibleStrings(value)
    .join(' ')
    .match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function sentenceSet(value: unknown): Set<string> {
  return new Set(
    collectVisibleStrings(value)
      .flatMap((text) => text.split(/[.!?]+/))
      .map((text) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
      .filter((text) => text.split(/\s+/).length >= 7),
  );
}

function structuralSignature(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuralSignature);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, structuralSignature(nested)]),
    );
  }
  return value === null ? 'null' : typeof value;
}

function links(decision: ReturnType<typeof parseModelDecisionContent>): string[] {
  return [
    decision.hero.primaryCta.href,
    decision.hero.secondaryCta.href,
    ...decision.hero.quickLinks.map(({ href }) => href),
    ...decision.decisionCards.map(({ cta }) => cta.href),
    decision.pricingCopy.ctaHref,
  ];
}

function localizedModelHref(locale: AppLocale, slug: string) {
  if (locale === 'fr') return `/fr/modeles/${slug}`;
  if (locale === 'es') return `/es/modelos/${slug}`;
  return `/models/${slug}`;
}

function localizedComparisonToken(locale: AppLocale, slug: string) {
  if (locale === 'fr') return `/fr/comparatif/${slug}`;
  if (locale === 'es') return `/es/comparativa/${slug}`;
  return `/ai-video-engines/${slug}`;
}

function familyFor(slug: (typeof P0_SLUGS)[number]) {
  if (slug.startsWith('wan-')) return 'wan' as const;
  if (slug.startsWith('ltx-')) return 'ltx' as const;
  if (slug.startsWith('grok-')) return 'grok' as const;
  return 'flux' as const;
}

test('all 21 P0 locale documents parse strictly and remain structurally aligned', () => {
  for (const slug of P0_SLUGS) {
    const english = readDocument('en', slug);
    for (const locale of LOCALES) {
      const document = readDocument(locale, slug);
      const decision = parseModelDecisionContent(document.decision, slug, locale);
      const prompting = parseModelPromptingContent(document.prompting, slug, locale);
      const examples = parseModelExamplesContent(document.examples, slug, locale);
      assert.equal(decision.modelSlug, slug);
      assert.equal(prompting.modelSlug, slug);
      assert.equal(examples.modelSlug, slug);
      if (locale !== 'en') {
        assert.deepEqual(structuralSignature(document.decision), structuralSignature(english.decision), `${slug}/${locale}/decision`);
        assert.deepEqual(structuralSignature(document.prompting), structuralSignature(english.prompting), `${slug}/${locale}/prompting`);
        assert.deepEqual(structuralSignature(document.examples), structuralSignature(english.examples), `${slug}/${locale}/examples`);
      }
    }
  }
});

test('P0 pages contain useful page-specific localized copy and unique metadata', () => {
  for (const locale of LOCALES) {
    const documents = new Map(P0_SLUGS.map((slug) => [slug, readDocument(locale, slug)]));
    const metadata = new Set<string>();
    const sentenceSets = new Map([...documents].map(([slug, document]) => [slug, sentenceSet(document)]));
    for (const [slug, document] of documents) {
      assert.ok(wordCount(document) >= 400, `${slug}/${locale} should contain at least 400 useful localized words`);
      const metaKey = `${document.seo?.title}\n${document.seo?.description}`;
      assert.ok(document.seo?.title?.trim(), `${slug}/${locale} title`);
      assert.ok(document.seo?.description?.trim(), `${slug}/${locale} description`);
      assert.equal(metadata.has(metaKey), false, `${slug}/${locale} metadata should be unique`);
      metadata.add(metaKey);

      const ownSentences = sentenceSets.get(slug) ?? new Set<string>();
      const others = new Set(
        [...sentenceSets]
          .filter(([otherSlug]) => otherSlug !== slug)
          .flatMap(([, values]) => [...values]),
      );
      const uniqueCount = [...ownSentences].filter((sentence) => !others.has(sentence)).length;
      assert.ok(ownSentences.size > 0, `${slug}/${locale} should expose page-specific sentences`);
      assert.ok(uniqueCount / ownSentences.size >= 0.8, `${slug}/${locale} should keep at least 80% page-specific sentences`);
    }
  }
});

test('P0 copy distinguishes model ownership from Fal distribution and cites the reviewed owner guide', () => {
  for (const slug of P0_SLUGS) {
    for (const locale of LOCALES) {
      const document = readDocument(locale, slug);
      const visible = collectVisibleStrings(document).join(' ');
      const prompting = parseModelPromptingContent(document.prompting, slug, locale);
      assert.match(visible, EXPECTED_OWNER[slug], `${slug}/${locale} owner attribution`);
      assert.match(visible, /\bFal\b/, `${slug}/${locale} Fal distribution attribution`);
      assert.doesNotMatch(visible, /direct(?:ly)? (?:with|through|via) (?:Alibaba|Lightricks|xAI|Black Forest Labs)/i);
      assert.equal(prompting.section.guide?.href, OFFICIAL_GUIDE[slug], `${slug}/${locale} guide`);
    }
  }
});

test('P0 links are localized, decision-complete, and future comparison links stay content-owned', () => {
  for (const slug of P0_SLUGS) {
    const template = getModelPageTemplateConfig(slug);
    assert.ok(template);
    assert.equal(template.hero.quickLinks.some(({ href }) => href.includes('/ai-video-engines/')), false, `${slug} template should not publish a future comparison`);

    for (const locale of LOCALES) {
      const decision = parseModelDecisionContent(readDocument(locale, slug).decision, slug, locale);
      const destinations = [...new Set(links(decision))];
      assert.ok(destinations.includes(FAMILY_HREF[locale][familyFor(slug)]), `${slug}/${locale} family examples`);
      assert.ok(destinations.includes(`${locale === 'en' ? '/pricing' : locale === 'fr' ? '/fr/tarifs' : '/es/precios'}#${slug}-pricing`), `${slug}/${locale} pricing`);
      assert.ok(destinations.includes(`/app?engine=${slug}`), `${slug}/${locale} app`);
      const sibling = SIBLING_SLUG[slug];
      if (sibling) assert.ok(destinations.includes(localizedModelHref(locale, sibling)), `${slug}/${locale} sibling`);
      for (const comparison of COMPARISON_SLUGS[slug]) {
        assert.ok(destinations.some((href) => href.startsWith(localizedComparisonToken(locale, comparison))), `${slug}/${locale}/${comparison}`);
      }
      const contextual = destinations.filter((href) =>
        !href.startsWith('/app?')
        && href !== FAMILY_HREF[locale][familyFor(slug)]
        && !href.includes(locale === 'en' ? '/pricing' : locale === 'fr' ? '/fr/tarifs' : '/es/precios')
        && href !== '#prompting',
      );
      assert.ok(contextual.length >= 2 && contextual.length <= 4, `${slug}/${locale} should have 2-4 contextual destinations, got ${contextual.length}`);
    }
  }
});

test('P0 galleries are authored but hidden and contain no placeholder media', () => {
  for (const slug of P0_SLUGS) {
    const runtime = getRuntimeModelByCanonicalSlug(slug);
    assert.ok(runtime);
    assert.deepEqual(runtime.publication, {
      model: { published: false, indexable: false },
      examples: { published: false, includeInFamilyCopy: false, current: false },
      compare: { published: false, indexed: false, suggestedOpponentIds: [], publishedPairIds: [] },
      app: { published: false },
      pricing: { published: false },
      sitemap: { published: false },
    });
    for (const locale of LOCALES) {
      const examples = parseModelExamplesContent(readDocument(locale, slug).examples, slug, locale);
      assert.equal(examples.showWhenEmpty, false);
      assert.equal(examples.fallbackItems, null);
      assert.doesNotMatch(JSON.stringify(examples), /https?:\/\/|data:video|\.mp4\b/i);
    }
  }
});

test('P0 rendered pricing cards consume canonical quotes for every frozen page scenario', () => {
  const engines = new Map(listFalEngines().map((engine) => [engine.id, engine]));
  for (const slug of P0_SLUGS) {
    const engine = engines.get(slug);
    assert.ok(engine, slug);
    const document = readDocument('en', slug);
    const decision = buildModelDecisionData({ engine, locale: 'en', decisionContent: document.decision });
    assert.ok(decision, slug);
    assert.equal(decision.pricing.scenarios.length, getModelPageTemplateConfig(slug)?.pricing.presets.length);
    for (const scenario of decision.pricing.scenarios) {
      assert.match(scenario.value, /^\$\d+(?:\.\d{2})$/, `${slug}/${scenario.id} should be an exact canonical quote`);
      assert.doesNotMatch(scenario.value, /live|check|—/i);
    }
  }
});

test('legacy and deep-legacy page copy follows the canonical successor graph without redirects', () => {
  const lifecyclePattern = {
    en: { legacy: /previous generation|legacy/i, deep_legacy: /historical|deep legacy/i },
    fr: { legacy: /génération précédente|legacy/i, deep_legacy: /historique|ancienne génération/i },
    es: { legacy: /generación anterior|legado/i, deep_legacy: /históric|legado profundo/i },
  } as const;
  for (const [slug, policy] of Object.entries(LIFECYCLE)) {
    const runtime = getRuntimeModelByCanonicalSlug(slug);
    assert.ok(runtime, slug);
    assert.equal(runtime.lifecycle, policy.state, slug);
    assert.equal(runtime.successorId, policy.successor, slug);
    assert.equal(runtime.publicTargetId, undefined, `${slug} must not have a retired replacement target`);
    assert.equal(resolveRuntimePublicSlug(slug)?.id, runtime.id, `${slug} public slug must remain self-canonical`);

    const template = getModelPageTemplateConfig(slug);
    assert.ok(template, slug);
    assert.equal(
      template.hero.primaryCtaHref,
      policy.state === 'legacy' ? `/app?engine=${runtime.id}` : `/app?engine=${policy.successor}`,
      `${slug} template CTA`,
    );

    for (const locale of LOCALES) {
      const document = readDocument(locale, slug);
      const decision = parseModelDecisionContent(document.decision, slug, locale);
      const visible = collectVisibleStrings(decision).join(' ');
      assert.match(visible, lifecyclePattern[locale][policy.state], `${slug}/${locale} lifecycle label`);
      assert.match(visible, new RegExp(policy.successor.replaceAll('-', '[ .-]?'), 'i'), `${slug}/${locale} successor`);
      assert.match(document.seo?.title ?? '', new RegExp(slug.startsWith('ltx-2-3') ? '2[ .]3' : slug.startsWith('ltx-2') ? 'LTX 2' : `Wan ${slug.endsWith('6') ? '2[ .]6' : '2[ .]5'}`, 'i'));
      assert.ok(links(decision).includes(localizedModelHref(locale, policy.successor)), `${slug}/${locale} successor link`);
      if (policy.state === 'legacy') {
        assert.ok(links(decision).includes(`/app?engine=${runtime.id}`), `${slug}/${locale} remains executable`);
        assert.ok(policy.comparison);
        assert.ok(links(decision).some((href) => href.startsWith(localizedComparisonToken(locale, policy.comparison))), `${slug}/${locale} upgrade scoreboard`);
      } else {
        assert.equal(links(decision).includes(`/app?engine=${runtime.id}`), false, `${slug}/${locale} deep legacy must not generate on the old route`);
        assert.ok(links(decision).includes(`/app?engine=${policy.successor}`), `${slug}/${locale} generation goes to successor`);
      }
    }
  }
});

test('P0 authored copy contains no finished price, provider-rate, or blanket superiority claims', () => {
  for (const slug of P0_SLUGS) {
    for (const locale of LOCALES) {
      const visible = collectVisibleStrings(readDocument(locale, slug)).join(' ');
      assert.doesNotMatch(visible, /\$\s*\d|USD\s*\d|\d+(?:[.,]\d+)?\s*(?:¢|cents?|centimes?|céntimos?)|\bmargin\b/i, `${slug}/${locale} authored price`);
      assert.doesNotMatch(visible, /\b(?:superior|beats every|surpasse tous|supera a todos)\b/i, `${slug}/${locale} unsupported superiority`);
    }
  }
});
