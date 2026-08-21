# Pay-as-you-go Page Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the localized Pay-as-you-go page one exact-locale editorial content boundary, one render-ready pricing view model, and focused section renderers while preserving every current route, price, SEO field, string, class, link, and behavior.

**Architecture:** `getPayAsYouGoContent(locale)` selects one complete EN, FR, or ES TypeScript document with no fallback. `buildPayAsYouGoPageData({ locale, content })` combines that authored document with the unchanged pricing hub and returns render-ready data; metadata, JSON-LD, showcase formatting, and four route-local section groups consume explicit content projections rather than owning locale maps. Temporary semantic manifests prove exact before/after parity and are deleted once permanent content, data, rendering, and architecture contracts cover the final design.

**Tech Stack:** Next.js 15.5.18 App Router, React 18.3 server components, TypeScript 5.4, Node test runner through `tsx`, pnpm 10.18, React server rendering, Playwright browser smoke verification.

## Global Constraints

- Execute from `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/kling-image-dimension-validation` on local `main`; the approved design parent is commit `0b6650dd`.
- Fetch `origin/main` before implementation and stop for deliberate integration if `git merge-base --is-ancestor origin/main HEAD` fails; never force-push or discard unrelated user changes.
- Read root `AGENTS.md`, `docs/engineering/llm-working-guide.md`, `docs/engineering/project-structure.md`, `docs/engineering/page-architecture.md`, `docs/engineering/refactor-roadmap.md`, and the new route-local `AGENTS.md` once Task 7 creates it.
- Preserve every current visible string, link, section, style, metadata field, JSON-LD output, runtime behavior, and localized path. The approved correction manifest is empty.
- Do not change any price, margin, credit amount, starter offer, quote, billing policy, pricing formula, pricing source, model list, route, redirect, canonical, hreflang, sitemap rule, indexing rule, showcase selection rule, or media ordering rule.
- Existing authored prose such as `Starter credits from $10` remains exact editorial copy; computed pricing rows, quote outputs, price cells, and formulas remain outside `_content`.
- `getPayAsYouGoContent(locale)` must be the only production content selector, must return the exact requested locale, and must never merge, overlay, or fall back to English.
- Content modules must not import React, Lucide, pricing builders, database modules, or runtime video types.
- Components must not select translations, search pricing rows, format price fallbacks, or import the pricing hub.
- Dynamic prices must remain projections of `buildPricingHubData(locale)`; permanent tests use injected sentinel quotes instead of freezing a second list of numeric prices.
- Keep `page.tsx` <= 120 physical lines; `PayAsYouGoPageView.tsx` <= 100; each grouped section module <= 250; section primitives <= 120; `payg-page-data.ts` <= 400; each locale content module <= 350; content types and selector individually <= 180; JSON-LD <= 120; showcase component and data modules each < 250.
- No permanent Pay-as-you-go source file may appear in `npm run architecture:audit -- --min-lines 500`.
- Use `apply_patch` for authored edits. Generated characterization fixtures may be written only by the committed capture script and must be deleted in Task 7.
- Every task follows red-green-refactor, runs its focused tests, runs `pnpm test:validate` before commit, runs `git diff --check`, and ends in a focused commit.
- Baseline focused command is green at 6/6:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/payg-ai-video-generator-page.test.ts
```

## File Structure

### Permanent files to create

- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/types.ts` — complete authored-content contract, fixed semantic IDs, and content-only types.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/en.ts` — complete exact English document.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/fr.ts` — complete exact French document.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/es.ts` — complete exact Spanish document.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts` — exhaustive exact-locale selector and sole production content API.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoHeroSections.tsx` — hero, quote console, natural questions, and model testing order.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoGuideSections.tsx` — meaning, audience, comparison, workflow, and quote factors.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPricingSections.tsx` — price table, lookup shortcuts, and example costs rendering only.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoTrustSections.tsx` — refund and FAQ sections.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoSectionPrimitives.tsx` — route-local container, section header, and semantic icon mapping.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/AGENTS.md` — final route ownership and verification contract.
- `tests/payg-page-content-contract.test.ts` — exact locale, completeness, structure, semantic ID, and forbidden-owner tests.
- `tests/payg-page-data.test.ts` — render-ready builder and dynamic-pricing-source contracts.
- `tests/payg-page-rendering.test.ts` — permanent EN/FR/ES visible markup, section order, link, and showcase-state contracts.
- `tests/payg-page-architecture.test.ts` — source ownership and physical line caps.

### Permanent files to modify

- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx` — select content once and orchestrate metadata, data, showcase, canonical, JSON-LD, and view.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts` — remove authored locale maps and produce the complete render-ready page model from content plus pricing.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-jsonld.ts` — accept explicit localized JSON-LD copy and retain only schema/URL assembly.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-video-showcase.ts` — accept authored runtime showcase copy while retaining playlist, selection, and number-formatting behavior.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoVideoShowcase.tsx` — accept explicit copy and stop selecting a locale.
- `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx` — become a <= 100-line ordered section orchestrator.
- `tests/payg-ai-video-generator-page.test.ts` — replace assertions for obsolete inline owners with assertions against the new public boundaries while retaining routing/discoverability coverage.
- `docs/engineering/page-architecture.md` — document the strict Pay-as-you-go content and render-ready pricing boundary.

### Temporary files to create and delete in this project

- `tests/helpers/payg-page-parity.ts` — semantic manifest extractor for current and migrated implementations.
- `scripts/capture-payg-page-parity.ts` — guarded writer for three locale fixtures.
- `tests/fixtures/payg-page-parity/en.json` — current English empty/showcase semantic manifests.
- `tests/fixtures/payg-page-parity/fr.json` — current French empty/showcase semantic manifests.
- `tests/fixtures/payg-page-parity/es.json` — current Spanish empty/showcase semantic manifests.
- `tests/payg-page-parity-bridge.test.ts` — temporary old/new exact-parity gate.

---

### Task 1: Capture the current EN/FR/ES semantic contract

**Files:**

- Create: `tests/helpers/payg-page-parity.ts`
- Create: `scripts/capture-payg-page-parity.ts`
- Create: `tests/payg-page-parity-bridge.test.ts`
- Generate: `tests/fixtures/payg-page-parity/en.json`
- Generate: `tests/fixtures/payg-page-parity/fr.json`
- Generate: `tests/fixtures/payg-page-parity/es.json`

**Interfaces:**

- Produces temporarily: `PAYG_PARITY_LOCALES`, `PAYG_SHOWCASE_FIXTURE`, `PaygSemanticManifest`, and `captureCurrentPaygManifest(locale, videos): Promise<PaygSemanticManifest>`.
- The manifest stores metadata, all three JSON-LD objects, ordered section/header openings, ordered headings, ordered visible text nodes, table cells, links with destinations, image/video accessible labels, and showcase-empty/showcase-present states.
- Later tasks update only the construction calls inside this helper; the expected fixtures remain immutable until deleted in Task 7.

- [ ] **Step 1: Add the semantic extractor and deterministic showcase fixture**

Use React server rendering with the same i18n provider required by localized links. Extract ordered semantic fields, not a screenshot hash:

```ts
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppLocale } from '../../frontend/i18n/locales.ts';
import { I18nProvider } from '../../frontend/lib/i18n/I18nProvider.tsx';
import { buildMetadataUrls } from '../../frontend/lib/metadataUrls.ts';
import { PayAsYouGoPageView } from '../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx';
import { buildPayAsYouGoPageData, PAYG_PAGE_PATH } from '../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts';
import { buildPayAsYouGoBreadcrumbJsonLd, buildPayAsYouGoServiceJsonLd, buildPayAsYouGoWebApplicationJsonLd } from '../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-jsonld.ts';
import type { PayAsYouGoShowcaseVideo } from '../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-video-showcase.ts';
import { generateMetadata } from '../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx';

export const PAYG_PARITY_LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];

export const PAYG_SHOWCASE_FIXTURE: PayAsYouGoShowcaseVideo[] = [{
  id: 'parity-video',
  engineId: 'kling-3-pro',
  engineLabel: 'Kling 3 Pro',
  priceLabel: '$1.23',
  durationLabel: '8s',
  title: 'Deterministic showcase title',
  useCase: 'Deterministic showcase use case.',
  posterUrl: 'https://assets.example/payg-parity.jpg',
  href: '/video/parity-video?from=%2Fpay-as-you-go-ai-video-generator',
}];

export type PaygSemanticManifest = {
  metadata: unknown;
  jsonLd: { breadcrumb: unknown; service: unknown; webApplication: unknown };
  sectionOpenings: string[];
  headings: string[];
  textNodes: string[];
  tableCells: string[];
  links: Array<{ href: string; text: string }>;
  mediaLabels: string[];
  showcasePresent: boolean;
};

function values(pattern: RegExp, html: string, group = 1): string[] {
  return [...html.matchAll(pattern)].map((match) => match[group] ?? '');
}

function text(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function semanticHtml(html: string) {
  return {
    sectionOpenings: values(/<(header|section)([^>]*)>/g, html, 0),
    headings: values(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g, html).map(text),
    textNodes: values(/>([^<>]+)</g, html).map(text).filter(Boolean),
    tableCells: values(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g, html).map(text),
    links: [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({ href: match[1], text: text(match[2]) })),
    mediaLabels: values(/(?:aria-label|alt)="([^"]*)"/g, html),
    showcasePresent: html.includes('parity-video'),
  };
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function captureCurrentPaygManifest(
  locale: AppLocale,
  videos: PayAsYouGoShowcaseVideo[],
): Promise<PaygSemanticManifest> {
  const data = buildPayAsYouGoPageData(locale);
  const markup = renderToStaticMarkup(React.createElement(
    I18nProvider,
    { locale, dictionary: {}, fallback: {} },
    React.createElement(PayAsYouGoPageView, { locale, data, showcaseVideos: videos }),
  ));
  const canonical = buildMetadataUrls(locale, undefined, { englishPath: PAYG_PAGE_PATH }).canonical;
  return {
    metadata: plain(await generateMetadata({ params: Promise.resolve({ locale }) })),
    jsonLd: plain({
      breadcrumb: buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale }),
      service: buildPayAsYouGoServiceJsonLd({ canonical, locale }),
      webApplication: buildPayAsYouGoWebApplicationJsonLd({ canonical, locale }),
    }),
    ...semanticHtml(markup),
  };
}
```

- [ ] **Step 2: Add the fixture writer and an initially RED bridge test**

The writer records both current empty and deterministic showcase states and refuses any argument other than `--write`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAYG_PARITY_LOCALES, PAYG_SHOWCASE_FIXTURE, captureCurrentPaygManifest } from '../tests/helpers/payg-page-parity.ts';

if (process.argv[2] !== '--write') throw new Error('Pass --write to capture Pay-as-you-go parity fixtures.');
const output = join(process.cwd(), 'tests/fixtures/payg-page-parity');
mkdirSync(output, { recursive: true });
for (const locale of PAYG_PARITY_LOCALES) {
  const fixture = {
    empty: await captureCurrentPaygManifest(locale, []),
    showcase: await captureCurrentPaygManifest(locale, PAYG_SHOWCASE_FIXTURE),
  };
  writeFileSync(join(output, `${locale}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
}
```

The bridge test reads each fixture and deep-compares both states:

```ts
for (const locale of PAYG_PARITY_LOCALES) {
  test(`${locale} Pay-as-you-go semantics match the captured implementation`, async () => {
    const expected = JSON.parse(readFileSync(join(fixturesRoot, `${locale}.json`), 'utf8'));
    assert.deepEqual(await captureCurrentPaygManifest(locale, []), expected.empty);
    assert.deepEqual(await captureCurrentPaygManifest(locale, PAYG_SHOWCASE_FIXTURE), expected.showcase);
  });
}
```

- [ ] **Step 3: Run the bridge and verify RED before capture**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/payg-page-parity-bridge.test.ts
```

Expected: FAIL with `ENOENT` for `tests/fixtures/payg-page-parity/en.json`.

- [ ] **Step 4: Capture once and verify GREEN**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/capture-payg-page-parity.ts --write
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/payg-page-parity-bridge.test.ts tests/payg-ai-video-generator-page.test.ts
pnpm test:validate
git diff --check
```

Expected: the focused bridge passes 3 locale cases, the existing suite remains 6/6, the full suite passes, and the three fixtures contain both `empty` and `showcase` manifests.

- [ ] **Step 5: Commit Task 1**

```bash
git add scripts/capture-payg-page-parity.ts \
  tests/helpers/payg-page-parity.ts \
  tests/payg-page-parity-bridge.test.ts \
  tests/fixtures/payg-page-parity
git commit -m "test: capture payg page parity"
```

### Task 2: Create the strict exact-locale content catalog

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/types.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/en.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/fr.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/es.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts`
- Create: `tests/payg-page-content-contract.test.ts`

**Interfaces:**

- Produces: `PAYG_ICON_IDS`, `PaygIconId`, `PAYG_PRICE_LOOKUP_IDS`, `PaygPriceLookupId`, `PAYG_SUPPORTED_MODEL_IDS`, `PaygSupportedModelId`, `PAYG_SHOWCASE_TITLE_IDS`, `PaygShowcaseTitleId`, `PayAsYouGoContent`.
- Produces: `getPayAsYouGoContent(locale: AppLocale): PayAsYouGoContent` as the only route-facing content selector.
- Each locale module exports one `PayAsYouGoContent` value using `satisfies PayAsYouGoContent`; no module exports partial overlays.

- [ ] **Step 1: Write RED content ownership and exact-locale contracts**

Cover exhaustive locale selection, recursive non-empty strings, identical structural signatures, semantic ID inventories, and forbidden runtime ownership:

```ts
const locales = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];

function signature(value: unknown): unknown {
  if (Array.isArray(value)) return { kind: 'array', length: value.length, items: value.map(signature) };
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, signature(child)]));
  }
  return typeof value;
}

function assertNoBlankStrings(value: unknown, path = 'content'): void {
  if (typeof value === 'string') assert.ok(value.trim(), `${path} must be non-empty`);
  else if (Array.isArray(value)) value.forEach((child, index) => assertNoBlankStrings(child, `${path}[${index}]`));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => assertNoBlankStrings(child, `${path}.${key}`));
}

test('Pay-as-you-go content is complete, exact-locale and structurally identical', () => {
  const documents = locales.map(getPayAsYouGoContent);
  documents.forEach(assertNoBlankStrings);
  assert.deepEqual(signature(documents[1]), signature(documents[0]));
  assert.deepEqual(signature(documents[2]), signature(documents[0]));
  assert.notEqual(documents[0].metadata.title, documents[1].metadata.title);
  assert.notEqual(documents[0].metadata.title, documents[2].metadata.title);
  assert.throws(() => getPayAsYouGoContent('de' as AppLocale), /Missing complete Pay-as-you-go content for locale "de"/);
});

test('editorial content owns semantic strings but no computed pricing or React runtime', () => {
  const localeSources = ['en.ts', 'fr.ts', 'es.ts'].map((name) => read(join(contentRoot, name))).join('\n');
  assert.doesNotMatch(localeSources, /buildPricingHubData|VideoPricingRow|priceCells|quotes\[|finalPriceCents|lucide-react|React/);
  assert.match(localeSources, /Starter credits from \$10/);
  assert.deepEqual(getPayAsYouGoContent('en').workflow.items.map((item) => item.icon), ['engine', 'preview', 'video', 'refund']);
  assert.deepEqual(getPayAsYouGoContent('en').quoteFactors.items.map((item) => item.icon), ['model', 'duration', 'resolution', 'audio']);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/payg-page-content-contract.test.ts
```

Expected: FAIL because `_content/index.ts` and its types do not exist.

- [ ] **Step 3: Define the complete content-only contract**

Keep the type file declarative and below 180 lines. Use fixed IDs for every relationship that runtime builders must join:

```ts
export const PAYG_ICON_IDS = ['model', 'engine', 'preview', 'video', 'refund', 'duration', 'resolution', 'audio', 'credits'] as const;
export type PaygIconId = (typeof PAYG_ICON_IDS)[number];

export const PAYG_PRICE_LOOKUP_IDS = ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'happy-horse-1-1', 'seedance-2-0-mini', 'ltx-2-3-fast'] as const;
export type PaygPriceLookupId = (typeof PAYG_PRICE_LOOKUP_IDS)[number];

export const PAYG_EXAMPLE_COST_IDS = ['seedance-2-0', 'kling-3-pro', 'veo-3-1-fast', 'happy-horse-1-1', 'seedance-2-0-mini', 'ltx-2-3-fast'] as const;
export type PaygExampleCostId = (typeof PAYG_EXAMPLE_COST_IDS)[number];

export const PAYG_SUPPORTED_MODEL_IDS = ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'happy-horse-1-1', 'seedance-2-0-mini', 'ltx-2-3-fast', 'wan-2-6'] as const;
export type PaygSupportedModelId = (typeof PAYG_SUPPORTED_MODEL_IDS)[number];

export const PAYG_SHOWCASE_TITLE_IDS = ['rooftop', 'museum', 'smooth-image', 'guided-image', 'racer', 'ugc', 'warrior', 'product-image', 'product-reveal'] as const;
export type PaygShowcaseTitleId = (typeof PAYG_SHOWCASE_TITLE_IDS)[number];

export type PaygHeaderCopy = { eyebrow?: string; title: string; intro?: string };
export type PaygQuestion = { question: string; answer: string };
export type PaygCard = { title: string; body: string };

export type PayAsYouGoContent = {
  metadata: { title: string; description: string; imageAlt: string; keywords: string[] };
  common: { aiVideoModelAlt: string; liveQuote: string; audioIncluded: string; examplePrefix: string };
  hero: {
    eyebrow: string; title: string; intro: string; primaryCta: string; secondaryCta: string; trustItems: string[];
    quote: { consoleLabel: string; title: string; promptLabel: string; prompt: string; modelLabel: string; chooseModel: string; exampleCostLabel: string; chargeRuleLabel: string; chargeRuleValue: string };
  };
  naturalQuestions: { header: PaygHeaderCopy; summaryLead: string; summaryItems: string[]; items: PaygQuestion[] };
  modelTesting: { header: PaygHeaderCopy; footer: string; models: Record<PaygSupportedModelId, { family: string; title: string; body: string }> };
  meaning: { title: string; body: string; bullets: string[] };
  noSubscription: { title: string; body: string; cards: PaygCard[] };
  audienceFit: { cards: Array<PaygCard & { bullets: string[] }> };
  subscriptionComparison: { header: PaygHeaderCopy; columns: [string, string, string]; rows: Array<{ label: string; payg: string; subscription: string }> };
  workflow: { header: PaygHeaderCopy; items: Array<PaygCard & { icon: PaygIconId }> };
  quoteFactors: { header: PaygHeaderCopy; items: Array<PaygCard & { icon: PaygIconId }> };
  pricing: {
    header: PaygHeaderCopy; fullMatrixLabel: string; columns: { model: string; bestFor: string; links: string }; modelLinkLabel: string; compareLinkLabel: string;
    bestFor: Record<'seedanceMini' | 'seedance' | 'happyHorse' | 'kling' | 'veo' | 'ltx' | 'wan' | 'fallback', string>;
  };
  priceLookups: { header: PaygHeaderCopy; openRowLabel: string; items: Record<PaygPriceLookupId, { query: string; title: string; body: string }> };
  exampleCosts: { header: PaygHeaderCopy; settingsLabel: string; labels: Record<PaygExampleCostId, string> };
  refundPolicy: { header: PaygHeaderCopy; bullets: Array<{ icon: PaygIconId; body: string }> };
  faq: { title: string; items: PaygQuestion[] };
  showcase: {
    section: { eyebrow: string; title: string; intro: string; preview: string; result: string; cta: string; mediaPhrase: string; engineImageAltSuffix: string };
    runtime: {
      priceUnavailable: string; defaultEngineLabel: string; defaultTitleEngineLabel: string; defaultTitleTemplate: string;
      titles: Record<PaygShowcaseTitleId, string>;
      fallbackTitles: { image: string; character: string; prompt: string };
      useCases: Record<'seedanceMini' | 'seedance' | 'kling' | 'veo' | 'happyHorseEarlier' | 'happyHorse11' | 'happyHorse' | 'ltx' | 'wan' | 'fallback', string>;
    };
  };
  jsonLd: {
    breadcrumbName: string;
    service: { name: string; description: string; serviceType: string; category: string; offer: string };
    webApplication: { description: string; offer: string; features: string[] };
  };
};
```

- [ ] **Step 4: Relocate all current authored strings into three complete documents**

Move literals without rewriting punctuation, capitalization, accents, spacing, or array order. Use this exhaustive source-to-target mapping:

| Current owner | Target projection |
|---|---|
| `page.tsx#PAYG_META` | `metadata` |
| `payg-page-data.ts#PAYG_COPY_BY_LOCALE` hero/common/questions/meaning/no-subscription/pricing/refund/FAQ | `common`, `hero`, `naturalQuestions.items`, `meaning`, `noSubscription`, `pricing.header`, `refundPolicy`, `faq` |
| `payg-page-data.ts#PRICE_LOOKUP_CONFIGS` English query/title/body and `PRICE_LOOKUP_COPY` ES/FR | `priceLookups.items` |
| `payg-page-data.ts#modelBestFor` | `pricing.bestFor` |
| `payg-page-data.ts#buildExampleCosts` labels/settings | `exampleCosts.labels` and `exampleCosts.settingsLabel` |
| `payg-page-data.ts#buildSupportedModels` family/title/body | `modelTesting.models` |
| `PayAsYouGoPageView.tsx#getPayAsYouGoViewCopy` call sites and five copy-array helpers | matching `hero.quote`, `naturalQuestions`, `modelTesting`, `audienceFit`, `subscriptionComparison`, `workflow`, `quoteFactors`, `pricing`, `priceLookups`, `exampleCosts`, `faq.title`, and `common` fields |
| `PayAsYouGoVideoShowcase.tsx#getShowcaseCopy` plus its hardcoded engine alt suffix | `showcase.section` |
| `payg-video-showcase.ts` fallback price, title translations/templates, use-case strings, and default engine labels | `showcase.runtime` |
| `payg-jsonld.ts` localized maps | `jsonLd` |

Each document imports only `PayAsYouGoContent`, exports exactly one literal named `enPayAsYouGoContent`, `frPayAsYouGoContent`, or `esPayAsYouGoContent`, and closes the complete literal with `satisfies PayAsYouGoContent`. Start `en.ts#metadata` with the current title `Pay-as-you-go AI Video Generator with Upfront Pricing`, `fr.ts#metadata` with `Générateur de vidéos IA sans abonnement, paiement à l’usage`, and `es.ts#metadata` with `Generador de video con IA de pago por uso y precio por adelantado`; the characterization fixture rejects any missed or edited field. Do not fill a translation from English when a current route surface intentionally uses the same string, such as `FAQ`, `Prompt`, or `AI video model`; preserve that existing value explicitly in all three documents.

- [ ] **Step 5: Implement the sole exhaustive selector**

Use a `Record<AppLocale, PayAsYouGoContent>` so adding a supported application locale cannot compile without a document. Retain an explicit runtime guard for unsafe casts and boundary inputs:

```ts
import type { AppLocale } from '@/i18n/locales';
import { enPayAsYouGoContent } from './en';
import { esPayAsYouGoContent } from './es';
import { frPayAsYouGoContent } from './fr';
import type { PayAsYouGoContent } from './types';

const CONTENT_BY_LOCALE: Record<AppLocale, PayAsYouGoContent> = {
  en: enPayAsYouGoContent,
  es: esPayAsYouGoContent,
  fr: frPayAsYouGoContent,
};

export function getPayAsYouGoContent(locale: AppLocale): PayAsYouGoContent {
  const content = CONTENT_BY_LOCALE[locale];
  if (!content) throw new Error(`[payg-content] Missing complete Pay-as-you-go content for locale "${locale}".`);
  return content;
}

export type { PayAsYouGoContent } from './types';
```

- [ ] **Step 6: Verify content GREEN, exact parity still GREEN, and caps**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/payg-page-content-contract.test.ts \
  tests/payg-page-parity-bridge.test.ts \
  tests/payg-ai-video-generator-page.test.ts
pnpm test:validate
wc -l 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/'*.ts
git diff --check
```

Expected: all tests pass; each locale <= 350 lines; `types.ts` and `index.ts` each <= 180; parity is unchanged because production has not switched owners yet.

- [ ] **Step 7: Commit Task 2**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content' \
  tests/payg-page-content-contract.test.ts
git commit -m "feat: add strict payg content catalog"
```

### Task 3: Cut metadata and JSON-LD over to explicit content

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-jsonld.ts`
- Modify: `tests/helpers/payg-page-parity.ts`
- Modify: `tests/payg-ai-video-generator-page.test.ts`
- Modify: `tests/payg-page-content-contract.test.ts`

**Interfaces:**

- Consumes: `getPayAsYouGoContent(locale): PayAsYouGoContent`.
- Produces: `buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale, copy })`, where `copy` is `PayAsYouGoContent['jsonLd']`.
- Produces: `buildPayAsYouGoServiceJsonLd({ canonical, copy })` and `buildPayAsYouGoWebApplicationJsonLd({ canonical, copy })`.
- Numeric Schema.org offer values remain literal runtime schema facts in `payg-jsonld.ts`: `price: '10.00'`, `priceCurrency: 'USD'`.

- [ ] **Step 1: Add RED source-ownership assertions**

Replace the obsolete `PAYG_META[locale]` and JSON-LD locale-map expectations with explicit content-input expectations:

```ts
test('metadata and JSON-LD read exact-locale editorial content', () => {
  const pageSource = read(pagePath);
  const jsonLdSource = read(jsonLdPath);
  assert.match(pageSource, /getPayAsYouGoContent\(locale\)/);
  assert.match(pageSource, /const meta = getPayAsYouGoContent\(locale\)\.metadata/);
  assert.match(pageSource, /copy: content\.jsonLd/);
  assert.doesNotMatch(pageSource, /const PAYG_META/);
  assert.doesNotMatch(jsonLdSource, /\ben:\s*\{|\bes:\s*\{|\bfr:\s*\{/);
  assert.match(jsonLdSource, /copy: PayAsYouGoContent\['jsonLd'\]/);
  assert.match(jsonLdSource, /price: '10\.00'/);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/payg-ai-video-generator-page.test.ts tests/payg-page-content-contract.test.ts
```

Expected: FAIL because `page.tsx` still owns `PAYG_META` and JSON-LD builders still select locale maps.

- [ ] **Step 3: Make metadata and page orchestration select content explicitly**

Delete `PAYG_META`. Metadata uses the same selector as the page; the page selects once for JSON-LD while the data builder remains on its old signature until Task 4:

```ts
export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const meta = getPayAsYouGoContent(locale).metadata;
  return buildSeoMetadata({
    locale,
    title: meta.title,
    description: meta.description,
    englishPath: PAYG_PAGE_PATH,
    image: '/og/price-before.png',
    imageAlt: meta.imageAlt,
    keywords: meta.keywords,
  });
}

export default async function PayAsYouGoAiVideoGeneratorPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await props.params;
  const content = getPayAsYouGoContent(locale);
  const data = buildPayAsYouGoPageData(locale);
  const showcaseVideos = await loadPayAsYouGoVideoShowcase(locale);
  const canonical = buildMetadataUrls(locale, undefined, { englishPath: PAYG_PAGE_PATH }).canonical;
  const breadcrumbJsonLd = buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale, copy: content.jsonLd });
  const serviceJsonLd = buildPayAsYouGoServiceJsonLd({ canonical, copy: content.jsonLd });
  const webApplicationJsonLd = buildPayAsYouGoWebApplicationJsonLd({ canonical, copy: content.jsonLd });
```

These are replacements for the declarations at the top of the existing page function. Leave its current fragment, `PayAsYouGoPageView`, three script IDs, `dangerouslySetInnerHTML`, and `serializeJsonLd` calls untouched in this task.

- [ ] **Step 4: Make JSON-LD builders pure explicit-copy assemblers**

Retain locale only for the shared home breadcrumb label/path. Remove every authored per-locale map:

```ts
type JsonLdCopy = PayAsYouGoContent['jsonLd'];

export function buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale, copy }: { canonical: string; locale: AppLocale; copy: JsonLdCopy }) {
  const labels = getBreadcrumbLabels(locale);
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: labels.home, item: `${SITE_BASE_URL}${localePrefix || ''}` },
      { '@type': 'ListItem', position: 2, name: copy.breadcrumbName, item: canonical },
    ],
  };
}

export function buildPayAsYouGoServiceJsonLd({ canonical, copy }: { canonical: string; copy: JsonLdCopy }) {
  return buildMarketingServiceJsonLd({
    name: copy.service.name,
    description: copy.service.description,
    serviceType: copy.service.serviceType,
    category: copy.service.category,
    url: canonical,
    offers: { priceCurrency: 'USD', price: '10.00', availability: 'https://schema.org/InStock', description: copy.service.offer, url: canonical },
  });
}

export function buildPayAsYouGoWebApplicationJsonLd({ canonical, copy }: { canonical: string; copy: JsonLdCopy }) {
  return {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'MaxVideoAI',
    applicationCategory: 'MultimediaApplication', operatingSystem: 'Web', url: canonical,
    description: copy.webApplication.description,
    offers: { '@type': 'Offer', price: '10.00', priceCurrency: 'USD', description: copy.webApplication.offer, url: canonical },
    featureList: copy.webApplication.features,
  };
}
```

- [ ] **Step 5: Update the temporary manifest calls and verify exact parity**

Inside `captureCurrentPaygManifest`, select `content` and pass `content.jsonLd` to all three builders. Do not regenerate fixtures:

```ts
const content = getPayAsYouGoContent(locale);
const jsonLd = {
  breadcrumb: buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale, copy: content.jsonLd }),
  service: buildPayAsYouGoServiceJsonLd({ canonical, copy: content.jsonLd }),
  webApplication: buildPayAsYouGoWebApplicationJsonLd({ canonical, copy: content.jsonLd }),
};
```

Assign `jsonLd` directly to the manifest's `jsonLd` property.

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/payg-page-parity-bridge.test.ts \
  tests/payg-page-content-contract.test.ts \
  tests/payg-ai-video-generator-page.test.ts
pnpm test:validate
wc -l 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-jsonld.ts'
git diff --check
```

Expected: parity passes without fixture changes; page <= 120; JSON-LD <= 120; full suite passes.

- [ ] **Step 6: Commit Task 3**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-jsonld.ts' \
  tests/helpers/payg-page-parity.ts \
  tests/payg-ai-video-generator-page.test.ts \
  tests/payg-page-content-contract.test.ts
git commit -m "refactor: centralize payg seo copy"
```

### Task 4: Make the pricing builder return render-ready page data

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx`
- Create: `tests/payg-page-data.test.ts`
- Modify: `tests/helpers/payg-page-parity.ts`
- Modify: `tests/payg-ai-video-generator-page.test.ts`

**Interfaces:**

- Produces: `BuildPayAsYouGoPageDataInput = { locale: AppLocale; content: PayAsYouGoContent; pricingHub?: PricingHubData }`.
- Produces: `buildPayAsYouGoPageData(input: BuildPayAsYouGoPageDataInput): PayAsYouGoPageData`.
- `pricingHub` is injectable only for pure tests; production omits it and the builder calls the unchanged `buildPricingHubData(locale)`.
- `PayAsYouGoPageData` contains render-ready `hero.quote`, `pricing.rows[].priceCells[].displayValue`, explicit section headers/labels, semantic icon IDs, resolved supported-model links/icons, and resolved example costs.

- [ ] **Step 1: Write RED builder and dynamic-price-source tests**

Prove content projection, source immutability, derived hero data, and sentinel quote propagation rather than snapshotting current numeric prices:

```ts
test('Pay-as-you-go data is render-ready and does not mutate content or pricing input', () => {
  const content = structuredClone(getPayAsYouGoContent('en'));
  const pricingHub = structuredClone(buildPricingHubData('en'));
  const contentBefore = structuredClone(content);
  const pricingBefore = structuredClone(pricingHub);
  const data = buildPayAsYouGoPageData({ locale: 'en', content, pricingHub });
  assert.deepEqual(content, contentBefore);
  assert.deepEqual(pricingHub, pricingBefore);
  assert.equal(data.hero.title, content.hero.title);
  assert.equal(data.workflow.items[0].icon, 'engine');
  assert.ok(data.hero.quote.previewRows.length <= 4);
  assert.ok(data.pricing.rows.every((row) => row.priceCells.every((cell) => cell.displayValue.trim())));
});

test('displayed pricing remains a live projection of the pricing hub', () => {
  const content = getPayAsYouGoContent('en');
  const pricingHub = structuredClone(buildPricingHubData('en'));
  const sourceRow = pricingHub.video.rows.find((row) => row.id === 'seedance-2-0');
  assert.ok(sourceRow);
  sourceRow.quotes['5s-720p'] = { ...sourceRow.quotes['5s-720p'], display: '$987.65' };
  const data = buildPayAsYouGoPageData({ locale: 'en', content, pricingHub });
  const cell = data.pricing.rows.find((row) => row.id === 'seedance-2-0')?.priceCells.find((item) => item.presetId === '5s-720p');
  assert.equal(cell?.value, '$987.65');
  assert.equal(cell?.displayValue, 'Example: $987.65');
  assert.doesNotMatch(JSON.stringify(content), /987\.65/);
});

test('missing quotes preserve the current exact-locale live-quote fallback', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = getPayAsYouGoContent(locale);
    const pricingHub = structuredClone(buildPricingHubData(locale));
    const sourceRow = pricingHub.video.rows.find((row) => row.id === 'seedance-2-0');
    assert.ok(sourceRow);
    sourceRow.quotes['5s-720p'] = { ...sourceRow.quotes['5s-720p'], display: undefined };
    const data = buildPayAsYouGoPageData({ locale, content, pricingHub });
    const cell = data.pricing.rows.find((row) => row.id === 'seedance-2-0')?.priceCells.find((item) => item.presetId === '5s-720p');
    assert.equal(cell?.value, content.common.liveQuote);
    assert.equal(cell?.displayValue, content.common.liveQuote);
  }
});
```

- [ ] **Step 2: Run the new suite and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/payg-page-data.test.ts
```

Expected: FAIL because the builder still accepts only `locale`, owns localized copy, and does not return `displayValue` or `hero.quote`.

- [ ] **Step 3: Convert the builder to explicit content plus optional pricing input**

Remove `PAYG_COPY_BY_LOCALE`, `PRICE_LOOKUP_COPY`, `modelBestFor` locale maps, supported-model locale branches, and example-label locale maps. Preserve model-family/config/preset/runtime route constants. Use content for authored values and the pricing hub for every quote:

```ts
export type BuildPayAsYouGoPageDataInput = {
  locale: AppLocale;
  content: PayAsYouGoContent;
  pricingHub?: PricingHubData;
};

export type PayAsYouGoPriceCell = {
  presetId: VideoPricePresetId;
  label: string;
  value: string;
  displayValue: string;
  note?: string;
};

export type PayAsYouGoModelRow = {
  id: string;
  engineIcon: PayAsYouGoEngineIcon;
  engineName: string;
  family: string;
  bestFor: string;
  modelHref?: string;
  compareHref?: string;
  priceCells: PayAsYouGoPriceCell[];
};

export type PayAsYouGoPriceLookup = {
  id: PaygPriceLookupId; query: string; title: string; body: string; engineIcon: PayAsYouGoEngineIcon;
  price: string; href: string; modelHref?: string;
};

export type PayAsYouGoSupportedModel = {
  id: PaygSupportedModelId; family: string; title: string; body: string; href: string; engineIcon: PayAsYouGoEngineIcon;
};

export type PayAsYouGoExampleCost = {
  id: PaygExampleCostId; label: string; engine: string; price: string; context: string; href: string;
};

export type PayAsYouGoPageData = {
  common: PayAsYouGoContent['common'];
  hero: Omit<PayAsYouGoContent['hero'], 'quote'> & {
    quote: PayAsYouGoContent['hero']['quote'] & {
      previewRows: Array<PayAsYouGoModelRow & { quoteLabel: string }>;
      sampleModelName: string;
      sampleCost?: PayAsYouGoExampleCost;
    };
  };
  naturalQuestions: PayAsYouGoContent['naturalQuestions'];
  modelTesting: Omit<PayAsYouGoContent['modelTesting'], 'models'> & { items: PayAsYouGoSupportedModel[] };
  meaning: PayAsYouGoContent['meaning'];
  noSubscription: PayAsYouGoContent['noSubscription'];
  audienceFit: PayAsYouGoContent['audienceFit'];
  subscriptionComparison: PayAsYouGoContent['subscriptionComparison'];
  workflow: PayAsYouGoContent['workflow'];
  quoteFactors: PayAsYouGoContent['quoteFactors'];
  pricing: Omit<PayAsYouGoContent['pricing'], 'bestFor'> & { rows: PayAsYouGoModelRow[]; fullMatrixHref: string };
  priceLookups: Omit<PayAsYouGoContent['priceLookups'], 'items'> & { items: PayAsYouGoPriceLookup[] };
  exampleCosts: Pick<PayAsYouGoContent['exampleCosts'], 'header'> & { items: PayAsYouGoExampleCost[] };
  refundPolicy: PayAsYouGoContent['refundPolicy'];
  faq: PayAsYouGoContent['faq'];
};

function isVisiblePrice(value: string | undefined, liveQuote: string) {
  const normalized = value?.trim();
  return Boolean(normalized && normalized !== '-' && normalized !== '—' && normalized !== liveQuote);
}

function formatExamplePrice(value: string, content: PayAsYouGoContent) {
  return isVisiblePrice(value, content.common.liveQuote) ? `${content.common.examplePrefix}: ${value}` : value;
}

export function buildPayAsYouGoPageData({ locale, content, pricingHub: inputPricingHub }: BuildPayAsYouGoPageDataInput): PayAsYouGoPageData {
  const pricingHub = inputPricingHub ?? buildPricingHubData(locale);
  const { models: modelCopyById, ...modelTestingCopy } = content.modelTesting;
  const { bestFor: bestForCopy, ...pricingCopy } = content.pricing;
  const { labels: exampleLabels, settingsLabel, header: exampleCostsHeader } = content.exampleCosts;
  const rows = buildModelRows(pricingHub, bestForCopy, content.common);
  const exampleCosts = buildExampleCosts(pricingHub, exampleLabels, settingsLabel, content.common.liveQuote);
  const sampleCost = exampleCosts[0];
  const sampleModel = findModelForExampleCost(rows, sampleCost);
  return {
    hero: {
      ...content.hero,
      quote: {
        ...content.hero.quote,
        previewRows: rows.slice(0, 4).map((row) => ({ ...row, quoteLabel: row.priceCells.find((cell) => isVisiblePrice(cell.value, content.common.liveQuote))?.value ?? content.common.liveQuote })),
        sampleModelName: sampleModel?.engineName ?? content.hero.quote.chooseModel,
        sampleCost,
      },
    },
    naturalQuestions: content.naturalQuestions,
    modelTesting: { ...modelTestingCopy, items: buildSupportedModels(pricingHub.video.rows, modelCopyById) },
    meaning: content.meaning,
    noSubscription: content.noSubscription,
    audienceFit: content.audienceFit,
    subscriptionComparison: content.subscriptionComparison,
    workflow: content.workflow,
    quoteFactors: content.quoteFactors,
    pricing: { ...pricingCopy, rows, fullMatrixHref: '/pricing#video-pricing' },
    priceLookups: { ...content.priceLookups, items: buildPriceLookups(pricingHub.video.rows, content.priceLookups.items, content.common.liveQuote) },
    exampleCosts: { header: exampleCostsHeader, items: exampleCosts },
    refundPolicy: content.refundPolicy,
    faq: content.faq,
    common: content.common,
  };
}
```

Give the helpers these exact authored-input boundaries: `buildModelRows(pricingHub, bestForCopy, common)`, `buildPriceLookups(rows, lookupCopyById, liveQuote)`, `buildExampleCosts(pricingHub, exampleLabels, settingsLabel, liveQuote)`, and `buildSupportedModels(rows, modelCopyById)`. Reduce `PRICE_LOOKUP_CONFIGS` to `{ id, presetId }` runtime facts and the preferred example list to `{ id, presetId }`; all query/title/body/label strings now come from the matching content records.

Each pricing cell includes `presetId`, the unchanged raw/fallback `value`, and the render-ready `displayValue`:

```ts
{
  presetId: preset.id,
  label: preset.label,
  value: quote.display ?? content.common.liveQuote,
  displayValue: formatExamplePrice(quote.display ?? content.common.liveQuote, content),
  note: quote.note?.replace(/\baudio incl\.?\b/gi, content.common.audioIncluded),
}
```

- [ ] **Step 4: Convert the current owner view to the final render-ready shape without extracting JSX yet**

Delete `getPayAsYouGoViewCopy`, `PaygViewCopy`, the five localized array helpers, `isVisiblePrice`, `firstVisiblePrice`, `examplePriceLabel`, and `findModelForExampleCost`. Keep the existing JSX in this file for this task, but replace every authored or derived value with these exact data paths:

| Existing source | Render-ready source |
|---|---|
| hero inline labels and quote helpers | `data.hero.*` and `data.hero.quote.*` |
| `quickSummaryItems` and question array | `data.naturalQuestions.summaryItems` and `.items` |
| natural-question inline header/lead | `data.naturalQuestions.header` and `.summaryLead` |
| `supportedModels` and model-order inline copy | `data.modelTesting.items`, `.header`, `.footer` |
| `audienceFitCards` | `data.audienceFit.cards` |
| `comparisonRows` and table labels | `data.subscriptionComparison.header`, `.columns`, `.rows` |
| `stepItems` | `data.workflow.header`, `.items` |
| `quoteFactors` | `data.quoteFactors.header`, `.items` |
| pricing inline labels and `examplePriceLabel` | `data.pricing.*` and `cell.displayValue` |
| lookup inline labels | `data.priceLookups.header`, `.openRowLabel`, `.items` |
| example-cost inline labels | `data.exampleCosts.header`, `.items` |
| refund index icons/strings | `data.refundPolicy.header`, `.bullets[].icon`, `.bullets[].body` |
| hardcoded `FAQ` and old FAQ array | `data.faq.title`, `data.faq.items` |

Temporarily retain the `locale` prop only to pass it to the old showcase component; no other code in the view may inspect locale after this step. Replace Lucide values formerly embedded in copy helpers with `PayAsYouGoSemanticIcon` only in Task 6; until then, use a local exhaustive `Record<PaygIconId, LucideIcon>` so the DOM and icons remain exact and the view compiles.

- [ ] **Step 5: Cut page and temporary manifest to the new builder signature**

Use the same selected content instance in production and parity capture:

```ts
const content = getPayAsYouGoContent(locale);
const data = buildPayAsYouGoPageData({ locale, content });
```

Do not regenerate fixtures.

- [ ] **Step 6: Verify dynamic pricing, exact parity, focused suite, and cap**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/payg-page-data.test.ts \
  tests/payg-page-content-contract.test.ts \
  tests/payg-page-parity-bridge.test.ts \
  tests/payg-ai-video-generator-page.test.ts
pnpm test:validate
wc -l 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts'
git diff --check
```

Expected: sentinel quote test passes; parity fixtures remain unchanged; data builder <= 400 lines; full suite passes.

- [ ] **Step 7: Commit Task 4**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx' \
  tests/helpers/payg-page-parity.ts \
  tests/payg-page-data.test.ts \
  tests/payg-ai-video-generator-page.test.ts
git commit -m "refactor: build render-ready payg data"
```

### Task 5: Move every authored showcase label behind content

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-video-showcase.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoVideoShowcase.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx`
- Modify: `tests/payg-ai-video-generator-page.test.ts`
- Modify: `tests/payg-page-content-contract.test.ts`
- Modify: `tests/helpers/payg-page-parity.ts`

**Interfaces:**

- Produces: `PayAsYouGoShowcaseRuntimeCopy = PayAsYouGoContent['showcase']['runtime']`.
- Produces: `buildPayAsYouGoShowcaseVideo(video: GalleryVideo, locale: AppLocale, copy: PayAsYouGoShowcaseRuntimeCopy): PayAsYouGoShowcaseVideo` for pure tests.
- Produces: `loadPayAsYouGoVideoShowcase({ locale, copy }): Promise<PayAsYouGoShowcaseVideo[]>`.
- `PayAsYouGoVideoShowcase` receives `{ videos, copy }`, where `copy` is `PayAsYouGoContent['showcase']['section']`; it no longer receives `locale`.
- Locale remains in the loader only for `Intl.NumberFormat`; every authored fallback/title/use-case string comes from `copy`.

- [ ] **Step 1: Add RED showcase ownership and pure formatting tests**

Add source assertions and test one fallback-price/title/use-case result for each locale through the exported pure converter:

```ts
test('showcase keeps runtime selection but owns no localized prose', () => {
  const componentSource = read(showcasePath);
  const loaderSource = read(showcaseDataPath);
  assert.doesNotMatch(componentSource, /getShowcaseCopy|locale: AppLocale/);
  assert.match(componentSource, /copy: PayAsYouGoContent\['showcase'\]\['section'\]/);
  assert.doesNotMatch(loaderSource, /translatedTitles|const copy = \(en: string|Price shown first|Precio visible antes de generar|Prix affiché avant la génération/);
  assert.match(loaderSource, /copy: PayAsYouGoShowcaseRuntimeCopy/);
});

test('showcase formatting uses exact-locale content while retaining runtime number formatting', () => {
  const fixtureGalleryVideo = (overrides: Partial<GalleryVideo> = {}) => ({
    id: 'showcase-fixture', engineId: 'kling-3-pro', engineLabel: 'Kling 3 Pro',
    prompt: 'A rooftop chase', promptExcerpt: 'A rooftop chase', durationSec: 8,
    currency: 'USD', ...overrides,
  }) as GalleryVideo;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getPayAsYouGoContent(locale).showcase.runtime;
    const result = buildPayAsYouGoShowcaseVideo(fixtureGalleryVideo({ finalPriceCents: undefined, prompt: 'A rooftop chase' }), locale, copy);
    assert.equal(result.priceLabel, copy.priceUnavailable);
    assert.equal(result.title, copy.titles.rooftop);
    assert.equal(result.useCase, copy.useCases.kling);
  }
  const priced = buildPayAsYouGoShowcaseVideo(fixtureGalleryVideo({ finalPriceCents: 123 }), 'en', getPayAsYouGoContent('en').showcase.runtime);
  assert.equal(priced.priceLabel, '$1.23');
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/payg-ai-video-generator-page.test.ts tests/payg-page-content-contract.test.ts
```

Expected: FAIL because the component and loader still own locale maps and the pure converter is not exported.

- [ ] **Step 3: Replace loader title strings with semantic rule IDs**

Keep every current regex and priority rule, but map patterns to IDs and resolve through content:

```ts
const VIDEO_TITLE_RULES: Array<{ pattern: RegExp; id: PaygShowcaseTitleId }> = [
  { pattern: /rooftop|chase|reunion/i, id: 'rooftop' },
  { pattern: /museum|curator|gallery/i, id: 'museum' },
  { pattern: /animate this image|image into|smooth animation/i, id: 'smooth-image' },
  { pattern: /provided image|reference image/i, id: 'guided-image' },
  { pattern: /female racer|racer/i, id: 'racer' },
  { pattern: /selfie|ugc|vertical/i, id: 'ugc' },
  { pattern: /warrior|temple/i, id: 'warrior' },
  { pattern: /product|packshot|bottle|perfume/i, id: 'product-image' },
  { pattern: /cinematic|studio lighting|camera push/i, id: 'product-reveal' },
];

function formatVideoTitle(prompt: string, engineLabel: string, copy: PayAsYouGoShowcaseRuntimeCopy) {
  const cleaned = cleanPromptText(prompt);
  const matched = VIDEO_TITLE_RULES.find(({ pattern }) => pattern.test(cleaned));
  if (matched) return copy.titles[matched.id];
  if (/image|reference|photo/i.test(cleaned)) return copy.fallbackTitles.image;
  if (/character|person|portrait|actor/i.test(cleaned)) return copy.fallbackTitles.character;
  if (/text-to-video|prompt/i.test(cleaned)) return copy.fallbackTitles.prompt;
  return copy.defaultTitleTemplate.replace('{engine}', engineLabel || copy.defaultTitleEngineLabel);
}
```

In `buildPayAsYouGoShowcaseVideo`, preserve the two distinct current fallbacks:

```ts
const engineLabel = video.engineLabel || video.engineId || copy.defaultEngineLabel;
const titleEngineLabel = video.engineLabel || video.engineId || copy.defaultTitleEngineLabel;
```

Use `engineLabel` for the returned card label and `titleEngineLabel` only for `formatVideoTitle`.

Rewrite `formatVideoUseCase` to return the corresponding `copy.useCases` member at each unchanged branch. Rename/export `toShowcaseVideo` as `buildPayAsYouGoShowcaseVideo`; use `copy.priceUnavailable` only when `finalPriceCents` is missing. Change the loader signature:

```ts
export async function loadPayAsYouGoVideoShowcase({ locale, copy }: { locale: AppLocale; copy: PayAsYouGoShowcaseRuntimeCopy }) {
  return pickDiverseVideos(videos).map((video) => buildPayAsYouGoShowcaseVideo(video, locale, copy));
}
```

Apply that signature and return expression to the existing function; retain its current `isDatabaseConfigured`, playlist `try/catch`, warning, empty-playlist fallback, and local `videos` declaration verbatim.

- [ ] **Step 4: Make the showcase component an explicit-copy renderer**

Delete `getShowcaseCopy`, remove `AppLocale`, pass `copy` through `VideoMedia`, and preserve current JSX/classes exactly. The final props are:

```ts
type PayAsYouGoVideoShowcaseProps = {
  copy: PayAsYouGoContent['showcase']['section'];
  videos: PayAsYouGoShowcaseVideo[];
};
```

Change `VideoMedia` to accept the same `copy` projection and compute exactly:

```ts
const mediaLabel = `${video.title}, ${copy.mediaPhrase} ${video.engineLabel}, ${video.priceLabel}, ${video.durationLabel}`;
```

Replace the six former selector fields one-for-one: `eyebrow`, `title`, `intro`, `preview`, `result`, and `cta`. Replace the hardcoded engine icon suffix with `copy.engineImageAltSuffix`. The video, image, poster, source, priority, preload, link, and no-video branches remain otherwise byte-for-byte equal.

- [ ] **Step 5: Thread the two explicit showcase projections through page and view**

Page loader:

```ts
const showcaseVideos = await loadPayAsYouGoVideoShowcase({ locale, copy: content.showcase.runtime });
```

View prop and render call:

```ts
type PayAsYouGoPageViewProps = {
  locale: AppLocale;
  data: PayAsYouGoPageData;
  showcaseCopy: PayAsYouGoContent['showcase']['section'];
  showcaseVideos: PayAsYouGoShowcaseVideo[];
};

<PayAsYouGoVideoShowcase videos={showcaseVideos} copy={showcaseCopy} />
```

Pass `showcaseCopy={content.showcase.section}` from `page.tsx` and update the temporary parity helper identically. Do not regenerate fixtures.

- [ ] **Step 6: Verify showcase behavior, exact parity, and caps**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/payg-page-content-contract.test.ts \
  tests/payg-page-parity-bridge.test.ts \
  tests/payg-ai-video-generator-page.test.ts
pnpm test:validate
wc -l 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-video-showcase.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoVideoShowcase.tsx'
git diff --check
```

Expected: empty and deterministic showcase parity pass for all locales; loader/component each < 250 lines; full suite passes.

- [ ] **Step 7: Commit Task 5**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-video-showcase.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoVideoShowcase.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx' \
  tests/helpers/payg-page-parity.ts \
  tests/payg-ai-video-generator-page.test.ts \
  tests/payg-page-content-contract.test.ts
git commit -m "refactor: centralize payg showcase copy"
```

### Task 6: Extract focused sections and reduce the view to ordered composition

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoSectionPrimitives.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoHeroSections.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoGuideSections.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPricingSections.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoTrustSections.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx`
- Create: `tests/payg-page-rendering.test.ts`
- Create: `tests/payg-page-architecture.test.ts`
- Modify: `tests/helpers/payg-page-parity.ts`
- Modify: `tests/payg-ai-video-generator-page.test.ts`

**Interfaces:**

- `PayAsYouGoSectionPrimitives.tsx` exports `PAYG_CONTAINER_CLASS_NAME`, `PayAsYouGoSectionHeader`, and `PayAsYouGoSemanticIcon({ id, className, strokeWidth })`.
- Hero module exports `PayAsYouGoHeroSection`, `PayAsYouGoNaturalQuestionsSection`, `PayAsYouGoModelTestingOrderSection`.
- Guide module exports `PayAsYouGoMeaningSection`, `PayAsYouGoAudienceFitSection`, `PayAsYouGoSubscriptionComparisonSection`, `PayAsYouGoWorkflowSection`, `PayAsYouGoQuoteFactorsSection`.
- Pricing module exports `PayAsYouGoPricePerModelSection`, `PayAsYouGoPriceLookupShortcutsSection`, `PayAsYouGoExampleCostsSection`.
- Trust module exports `PayAsYouGoRefundPolicySection`, `PayAsYouGoFaqSection`.
- Every section receives only `{ data: PayAsYouGoPageData }` or its exact named projection; no section receives `locale` or a translation selector.
- Final view receives `{ data, showcaseCopy, showcaseVideos }`; it no longer receives `locale`.

- [ ] **Step 1: Add RED architecture and rendering contracts**

Architecture contract locks owners, forbidden imports, order, and caps:

```ts
test('Pay-as-you-go view is a short pure section orchestrator', () => {
  const source = read(viewPath);
  assert.ok(source.split('\n').length <= 100);
  assert.doesNotMatch(source, /AppLocale|getPayAsYouGoViewCopy|copy\.text|function .*Section|isVisiblePrice|findModelForExampleCost|lucide-react/);
  const ordered = [
    'PayAsYouGoHeroSection', 'PayAsYouGoVideoShowcase', 'PayAsYouGoNaturalQuestionsSection',
    'PayAsYouGoModelTestingOrderSection', 'PayAsYouGoMeaningSection', 'PayAsYouGoAudienceFitSection',
    'PayAsYouGoSubscriptionComparisonSection', 'PayAsYouGoWorkflowSection', 'PayAsYouGoQuoteFactorsSection',
    'PayAsYouGoPricePerModelSection', 'PayAsYouGoPriceLookupShortcutsSection', 'PayAsYouGoExampleCostsSection',
    'PayAsYouGoRefundPolicySection', 'PayAsYouGoFaqSection',
  ];
  let cursor = -1;
  for (const name of ordered) {
    const next = source.indexOf(`<${name}`, cursor + 1);
    assert.ok(next > cursor, `${name} must appear in order`);
    cursor = next;
  }
});

test('section files render only and obey physical caps', () => {
  for (const [path, cap] of [[heroPath, 250], [guidePath, 250], [pricingPath, 250], [trustPath, 250], [primitivesPath, 120]] as const) {
    const source = read(path);
    assert.ok(source.split('\n').length <= cap, `${path} must be <= ${cap} lines`);
    assert.doesNotMatch(source, /AppLocale|copy\.text|buildPricingHubData|PAYG_COPY_BY_LOCALE|PRICE_LOOKUP_COPY|buildPayAsYouGo.*JsonLd/);
  }
});
```

Permanent rendering tests create content/data for each locale, wrap the final view in `I18nProvider`, and assert section-heading order, exact representative strings/hrefs, empty showcase absence, and deterministic showcase presence. Reuse the semantic extraction logic while it still exists, but do not import fixture JSON in the permanent test.

- [ ] **Step 2: Run the new suites and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/payg-page-architecture.test.ts tests/payg-page-rendering.test.ts
```

Expected: FAIL because the five component modules do not exist and the current view remains above 700 lines.

- [ ] **Step 3: Create route-local primitives with the exact current icons**

Keep React/Lucide at the renderer boundary and fail exhaustively at compile time:

```tsx
import { BadgeDollarSign, CreditCard, Eye, Film, Layers3, RotateCcw, SlidersHorizontal, Sparkles, type LucideIcon } from 'lucide-react';
import type { PaygIconId } from '../_content/types';

export const PAYG_CONTAINER_CLASS_NAME = 'container-page max-w-[1220px]';

const ICONS: Record<PaygIconId, LucideIcon> = {
  model: Layers3,
  engine: SlidersHorizontal,
  preview: Eye,
  video: Film,
  refund: RotateCcw,
  duration: Film,
  resolution: Sparkles,
  audio: BadgeDollarSign,
  credits: CreditCard,
};

export function PayAsYouGoSemanticIcon({ id, className, strokeWidth = 1.9 }: { id: PaygIconId; className?: string; strokeWidth?: number }) {
  const Icon = ICONS[id];
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

export function PayAsYouGoSectionHeader({ eyebrow, title, intro, align = 'left' }: { eyebrow?: string; title: string; intro?: string; align?: 'left' | 'center' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-micro text-brand">{eyebrow}</p> : null}
      <h2 className="mt-3 text-2xl font-semibold tracking-normal text-text-primary sm:text-3xl">{title}</h2>
      {intro ? <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">{intro}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: Move section JSX by approved responsibility without changing DOM/classes**

Move functions intact, rename them to the exported names above, replace `copy.text(...)` call sites with their render-ready `data` fields, and replace local icon component values with `PayAsYouGoSemanticIcon` IDs already stored in data.

The exact file ownership is:

```text
PayAsYouGoHeroSections.tsx
  HeroQuoteCard (private)
  PayAsYouGoHeroSection
  PayAsYouGoNaturalQuestionsSection
  PayAsYouGoModelTestingOrderSection

PayAsYouGoGuideSections.tsx
  PayAsYouGoMeaningSection
  PayAsYouGoAudienceFitSection
  PayAsYouGoSubscriptionComparisonSection
  PayAsYouGoWorkflowSection
  PayAsYouGoQuoteFactorsSection

PayAsYouGoPricingSections.tsx
  PayAsYouGoPricePerModelSection
  PayAsYouGoPriceLookupShortcutsSection
  PayAsYouGoExampleCostsSection

PayAsYouGoTrustSections.tsx
  PayAsYouGoRefundPolicySection
  PayAsYouGoFaqSection
```

Use named projections directly. For example, pricing renders `cell.displayValue` and semantic workflow icons render `item.icon`:

```tsx
{row.priceCells.map((cell) => (
  <td key={`${row.id}-${cell.label}`} className="px-4 py-3 text-right">
    <span className="font-mono font-semibold tabular-nums text-text-primary">{cell.displayValue}</span>
    {cell.note ? <span className="block text-[11px] text-text-muted">{cell.note}</span> : null}
  </td>
))}

{data.workflow.items.map((item, index) => (
  <article key={item.title} className="rounded-[8px] border border-hairline bg-surface p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-text-primary text-sm font-semibold text-bg">{index + 1}</span>
      <PayAsYouGoSemanticIcon id={item.icon} className="h-5 w-5 text-[#1F5EFF]" />
    </div>
    <h3 className="mt-4 text-sm font-semibold text-text-primary">{item.title}</h3>
    <p className="mt-2 text-sm leading-6 text-text-secondary">{item.body}</p>
  </article>
))}
```

- [ ] **Step 5: Replace the owner view with exact ordered composition**

The final view contains only imports, props, `<main>`, and the approved order:

```tsx
export type PayAsYouGoPageViewProps = {
  data: PayAsYouGoPageData;
  showcaseCopy: PayAsYouGoContent['showcase']['section'];
  showcaseVideos: PayAsYouGoShowcaseVideo[];
};

export function PayAsYouGoPageView({ data, showcaseCopy, showcaseVideos }: PayAsYouGoPageViewProps) {
  return (
    <main className="bg-bg">
      <PayAsYouGoHeroSection data={data} />
      <PayAsYouGoVideoShowcase videos={showcaseVideos} copy={showcaseCopy} />
      <PayAsYouGoNaturalQuestionsSection data={data} />
      <PayAsYouGoModelTestingOrderSection data={data} />
      <PayAsYouGoMeaningSection data={data} />
      <PayAsYouGoAudienceFitSection data={data} />
      <PayAsYouGoSubscriptionComparisonSection data={data} />
      <PayAsYouGoWorkflowSection data={data} />
      <PayAsYouGoQuoteFactorsSection data={data} />
      <PayAsYouGoPricePerModelSection data={data} />
      <PayAsYouGoPriceLookupShortcutsSection data={data} />
      <PayAsYouGoExampleCostsSection data={data} />
      <PayAsYouGoRefundPolicySection data={data} />
      <PayAsYouGoFaqSection data={data} />
    </main>
  );
}
```

Remove `locale` at the page and temporary manifest call sites. Do not regenerate fixtures.

- [ ] **Step 6: Verify exact parity and permanent rendering/architecture contracts**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/payg-page-architecture.test.ts \
  tests/payg-page-rendering.test.ts \
  tests/payg-page-data.test.ts \
  tests/payg-page-content-contract.test.ts \
  tests/payg-page-parity-bridge.test.ts \
  tests/payg-ai-video-generator-page.test.ts
pnpm test:validate
wc -l \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoHeroSections.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoGuideSections.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPricingSections.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoTrustSections.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoSectionPrimitives.tsx'
git diff --check
```

Expected: all six suites and the full suite pass; parity fixtures are unchanged; view <= 100; group/primitives caps pass.

- [ ] **Step 7: Commit Task 6**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components' \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx' \
  tests/helpers/payg-page-parity.ts \
  tests/payg-page-architecture.test.ts \
  tests/payg-page-rendering.test.ts \
  tests/payg-ai-video-generator-page.test.ts
git commit -m "refactor: split payg page sections"
```

### Task 7: Delete migration owners, document boundaries, and run release-grade verification

**Files:**

- Delete: `tests/helpers/payg-page-parity.ts`
- Delete: `scripts/capture-payg-page-parity.ts`
- Delete: `tests/payg-page-parity-bridge.test.ts`
- Delete: `tests/fixtures/payg-page-parity/en.json`
- Delete: `tests/fixtures/payg-page-parity/fr.json`
- Delete: `tests/fixtures/payg-page-parity/es.json`
- Create: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/AGENTS.md`
- Modify: `docs/engineering/page-architecture.md`
- Modify: `tests/payg-page-architecture.test.ts`
- Modify: `tests/payg-page-rendering.test.ts`
- Modify: `tests/payg-ai-video-generator-page.test.ts`

**Interfaces:**

- No temporary interface survives.
- Permanent contract is `getPayAsYouGoContent(locale)` -> `buildPayAsYouGoPageData({ locale, content })` -> renderers, with explicit `content.jsonLd` and `content.showcase` projections.
- Routing/discoverability tests remain in `payg-ai-video-generator-page.test.ts`; ownership/caps remain in architecture tests; semantic customer output remains in rendering tests; pricing-source behavior remains in data tests.

- [ ] **Step 1: Strengthen permanent contracts before deleting the bridge**

Add exhaustive source scans across permanent route files:

```ts
test('all Pay-as-you-go authored locale selection lives only in _content', () => {
  const productionFiles = listFiles(routeRoot).filter((path) => /\.(?:ts|tsx)$/.test(path) && !path.includes('/_content/'));
  const source = productionFiles.map((path) => read(path)).join('\n');
  assert.doesNotMatch(source, /copy\.text|getPayAsYouGoViewCopy|getShowcaseCopy|PAYG_COPY_BY_LOCALE|PRICE_LOOKUP_COPY|translatedTitles/);
  assert.doesNotMatch(source, /\{\s*en:\s*['"`]/);
  const nonFormatterSource = productionFiles.filter((path) => !path.endsWith('/payg-video-showcase.ts')).map((path) => read(path)).join('\n');
  assert.doesNotMatch(nonFormatterSource, /locale === ['"](?:en|fr|es)['"]\s*\?\s*['"`]/);
  const formatterSource = read(showcaseDataPath);
  assert.match(formatterSource, /new Intl\.NumberFormat/);
  assert.doesNotMatch(formatterSource, /Price shown first|Precio visible antes de generar|Prix affiché avant la génération|translatedTitles/);
});

test('Pay-as-you-go files satisfy final physical boundaries', () => {
  assertLineCap(pagePath, 120);
  assertLineCap(viewPath, 100);
  assertLineCap(heroPath, 250);
  assertLineCap(guidePath, 250);
  assertLineCap(pricingSectionsPath, 250);
  assertLineCap(trustPath, 250);
  assertLineCap(primitivesPath, 120);
  assertLineCap(dataPath, 400);
  assertLineCap(jsonLdPath, 120);
  assertLineCap(showcasePath, 250);
  assertLineCap(showcaseDataPath, 250);
  for (const locale of ['en', 'fr', 'es']) assertLineCap(join(contentRoot, `${locale}.ts`), 350);
  assertLineCap(join(contentRoot, 'types.ts'), 180);
  assertLineCap(join(contentRoot, 'index.ts'), 180);
});
```

Rendering tests must retain all of these permanent assertions for EN, FR, and ES before the temporary bridge is removed:

- exact ordered top-level section openings and headings;
- representative hero, natural-question, pricing, refund, FAQ, and showcase text;
- primary `/app`, pricing matrix, model, comparison, lookup, and video hrefs;
- empty showcase renders no showcase section;
- deterministic showcase renders its accessible media label and CTA;
- metadata title/description/image-alt/keywords equal `content.metadata`;
- all three JSON-LD builders equal the expected current schema structures and keep price `10.00`/currency `USD`.

- [ ] **Step 2: Run all permanent focused tests without relying on bridge fixtures**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/payg-page-content-contract.test.ts \
  tests/payg-page-data.test.ts \
  tests/payg-page-rendering.test.ts \
  tests/payg-page-architecture.test.ts \
  tests/payg-ai-video-generator-page.test.ts
```

Expected: all permanent contracts pass independently.

- [ ] **Step 3: Delete every temporary parity owner and prove no reference remains**

Delete the six temporary paths listed above, then run:

```bash
rg -n "payg-page-parity|captureCurrentPaygManifest|PAYG_SHOWCASE_FIXTURE" . \
  --glob '!docs/superpowers/plans/2026-07-16-pay-as-you-go-page-architecture.md'
```

Expected: no matches.

- [ ] **Step 4: Document the final route boundary**

Create route-local `AGENTS.md` with these enforceable rules:

```md
# Pay-as-you-go Route Guide

- `_content/{en,fr,es}.ts` is the only owner of authored localized copy for this route.
- `getPayAsYouGoContent(locale)` is exact-locale and must never fall back or merge overlays.
- `payg-page-data.ts` is the only owner of pricing-hub projection, row selection, price fallback formatting, hero quote preparation, supported-model runtime links, and example-cost resolution.
- Computed pricing values and formulas never belong in `_content`; existing authored price prose remains content.
- `page.tsx` only selects content, builds route data, loads showcase videos, assembles canonical/JSON-LD, and renders the view.
- JSON-LD and showcase helpers accept authored copy explicitly and must not add locale maps.
- Section components render `PayAsYouGoPageData`; they do not receive locale selectors or import pricing builders.
- Preserve public paths, metadata, canonical, hreflang, JSON-LD, section order, classes, links, prices, and showcase behavior during structural work.
- Run the five permanent Pay-as-you-go tests plus `pnpm test:validate`, frontend TypeScript/lint, exposure lint, architecture audit, build, and EN/FR/ES route smokes after changes.
```

Add a concise corresponding Pay-as-you-go example to `docs/engineering/page-architecture.md` showing:

```text
locale -> strict route content -> runtime page-data builder -> focused sections
                         \-> metadata / JSON-LD / showcase copy
```

- [ ] **Step 5: Run full static and architectural verification**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/payg-page-content-contract.test.ts \
  tests/payg-page-data.test.ts \
  tests/payg-page-rendering.test.ts \
  tests/payg-page-architecture.test.ts \
  tests/payg-ai-video-generator-page.test.ts
pnpm test:validate
pnpm --prefix frontend exec tsc --noEmit
pnpm --prefix frontend run lint
pnpm lint:exposure
npm run architecture:audit -- --min-lines 500
git diff --check
```

Expected: all focused/full tests, TypeScript, lint, exposure lint, and diff check pass; architecture audit lists no permanent file under `pay-as-you-go-ai-video-generator`.

- [ ] **Step 6: Build production and run localized browser smokes**

Build and start the production server in a persistent terminal:

```bash
pnpm --prefix frontend run build
PORT=3100 pnpm --prefix frontend start
```

In a second terminal, run a Playwright smoke against exact routes:

```bash
pnpm exec node --input-type=module <<'NODE'
import { chromium } from '@playwright/test';
const cases = [
  {
    path: '/pay-as-you-go-ai-video-generator',
    headings: ['Pay-as-you-go AI Video Generator', 'Quick answers before you spend credits', 'Recommended testing order for pay-as-you-go AI video', 'What pay-as-you-go means', 'Why no subscription matters', 'Who uses pay-as-you-go AI video credits?', 'Pay-as-you-go vs subscription', 'How pay-as-you-go credits work', 'What changes the live quote', 'Compare price per model', 'Check prices for popular AI video models', 'Example costs', 'What happens if a generation fails?', 'FAQ'],
  },
  {
    path: '/fr/pay-as-you-go-ai-video-generator',
    headings: ['Générateur de vidéos IA sans abonnement', 'L’essentiel avant d’utiliser vos crédits', 'Ordre recommandé pour tester la vidéo IA sans abonnement', 'Comment fonctionne le paiement à l’usage', 'Pourquoi l’absence d’abonnement compte', 'Qui utilise des crédits vidéo IA prépayés ?', 'Paiement à l’usage ou abonnement', 'Le flux affiche le coût avant le lancement', 'Ce qui fait varier le devis en direct', 'Comparez le prix par modèle', 'Consultez les prix des modèles de vidéo IA populaires', 'Exemples de coûts', 'Que se passe-t-il si une génération échoue ?', 'FAQ'],
  },
  {
    path: '/es/pay-as-you-go-ai-video-generator',
    headings: ['Generador de video con IA de pago por uso', 'Lo esencial antes de usar tus créditos', 'Orden recomendado para probar video con IA de pago por uso', 'Qué significa pagar por uso', 'Por qué importa no tener suscripción', '¿Quién usa créditos de video con IA de pago por uso?', 'Pago por uso vs. suscripción', 'Cómo funcionan los créditos de pago por uso', 'Qué cambia la cotización en tiempo real', 'Compara el precio por modelo', 'Consulta precios de modelos de video con IA populares', 'Costos de ejemplo', '¿Qué ocurre si falla una generación?', 'FAQ'],
  },
];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
for (const item of cases) {
  const response = await page.goto(`http://127.0.0.1:3100${item.path}`, { waitUntil: 'networkidle' });
  if (response?.status() !== 200) throw new Error(`${item.path}: HTTP ${response?.status()}`);
  await page.getByRole('heading', { level: 1, name: item.headings[0] }).waitFor();
  const bodyText = await page.locator('body').innerText();
  let cursor = -1;
  for (const marker of item.headings) {
    const next = bodyText.indexOf(marker, cursor + 1);
    if (next <= cursor) throw new Error(`${item.path}: missing or misordered visible marker ${marker}`);
    cursor = next;
  }
  if (!await page.locator('a[href$="/app"]').count()) throw new Error(`${item.path}: app CTA missing`);
  if (!await page.locator('a[href*="#video-pricing"]').count()) throw new Error(`${item.path}: pricing matrix link missing`);
  if (!await page.locator('a[href*="seedance-2-0"]').count()) throw new Error(`${item.path}: model link missing`);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  if (!canonical?.endsWith(item.path)) throw new Error(`${item.path}: bad canonical ${canonical}`);
  if (await page.locator('link[rel="alternate"][hreflang]').count() !== 4) throw new Error(`${item.path}: expected 4 hreflangs`);
  for (const id of ['payg-breadcrumb-jsonld', 'payg-service-jsonld', 'payg-web-application-jsonld']) {
    JSON.parse(await page.locator(`#${id}`).textContent());
  }
  if (await page.locator('nextjs-portal').count()) throw new Error(`${item.path}: Next.js error overlay present`);
}
await browser.close();
if (errors.length) throw new Error(`Browser page errors: ${errors.join(' | ')}`);
console.log('Pay-as-you-go EN/FR/ES production smokes passed.');
NODE
```

Expected: build succeeds; all three routes return 200; H1/canonical/four hreflangs/three JSON-LD scripts pass; no overlay or page error appears.

- [ ] **Step 7: Review the complete branch and commit Task 7**

Run:

```bash
git status --short --branch
git diff --stat 0b6650dd
git diff --check
git log --oneline --decorate -10
```

Review the full diff for unresolved Critical or Important findings, especially accidental price literals, locale fallback, route/SEO changes, class changes, or temporary files. Then commit only the final cleanup/docs/contracts:

```bash
git add -A \
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator' \
  docs/engineering/page-architecture.md \
  scripts/capture-payg-page-parity.ts \
  tests/helpers/payg-page-parity.ts \
  tests/fixtures/payg-page-parity \
  tests/payg-page-parity-bridge.test.ts \
  tests/payg-page-content-contract.test.ts \
  tests/payg-page-data.test.ts \
  tests/payg-page-rendering.test.ts \
  tests/payg-page-architecture.test.ts \
  tests/payg-ai-video-generator-page.test.ts
git commit -m "docs: lock payg page architecture"
```

Expected: commit succeeds and `git status --short` is empty. Do not push until the user explicitly requests it.

## Completion Gate

The implementation is complete only when all of the following are true:

- `getPayAsYouGoContent(locale)` is the single strict editorial selector and EN/FR/ES are complete with no fallback.
- All visible, metadata, JSON-LD, and showcase-authored copy lives under `_content`.
- Computed prices, pricing rows, quote outputs, and formulas remain sourced from the existing pricing hub and outside `_content`.
- `PayAsYouGoPageView.tsx` is <= 100 lines and renders fourteen sections in the approved order.
- All group, primitive, builder, page, JSON-LD, showcase, content, and audit caps pass.
- No permanent Pay-as-you-go file reaches 500 lines.
- Temporary parity fixtures/helpers/scripts are deleted.
- Exact route, SEO, class, link, copy, price, and showcase behavior is preserved with an empty correction manifest.
- Focused tests, full tests, TypeScript, lint, exposure lint, architecture audit, production build, and EN/FR/ES browser smokes pass.
- The final branch review has no unresolved Critical or Important finding and the worktree is clean.
