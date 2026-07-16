# Model Examples Content Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every model-specific Examples projection into the existing localized model JSON documents, preserve current output exactly, and replace the 1,588-line `ModelExamplesSection.tsx` owner with a strict content contract, a pure runtime view model, and focused renderers.

**Architecture:** `getEngineLocalized` exposes only the requested locale's raw `examples` object. A strict route-local parser validates editorial content, a pure builder combines it with existing media/capability/link inputs, and default/decision renderers consume one render-ready view model. A temporary legacy projector and converter prove exact 40-model-by-3-locale parity before 399 old `custom` keys and all temporary ownership are deleted.

**Tech Stack:** Next.js 15.5.18 App Router, React 18.3, TypeScript 5.4, Zod 3.23, Node test runner through `tsx`, JSON localized content, pnpm 10.18.

## Global Constraints

- Start from local `main` at the commit containing this plan; its required design parent is `dfe861db`. Fetch `origin/main` and stop for integration if the remote is no longer an ancestor.
- Read root `AGENTS.md`, `docs/engineering/llm-working-guide.md`, `docs/engineering/project-structure.md`, `docs/engineering/page-architecture.md`, and the route-local `AGENTS.md` before execution.
- Preserve unrelated user changes and re-check `git status --short --branch` before every commit.
- All 40 configured models and all 120 `en`/`fr`/`es` documents must contain a non-null top-level `examples` object.
- Model-specific Examples editorial content has exactly one final owner: `content/models/{locale}/{slug}.json#examples`.
- `examples` is exact-locale content. Never use `overlay.examples ?? base.examples`, an English fallback, a compatibility map, direct production JSON imports, or a second filesystem loader.
- Preserve every current visible string, null action, item/filter order, proof icon, tag, alt, empty state, active fallback decision, destination, and conditional presence. The approved correction manifest is empty; any content difference fails migration.
- Do not activate dormant image fallback definitions.
- Keep prices, registry identity, capabilities, selected real media, actual duration/aspect/audio, optimized posters, and routes out of editorial JSON.
- Do not change public routes, redirects, canonical, hreflang, metadata, JSON-LD, sitemap policy, model registry, pricing, billing, capabilities, real-media selection, section order, or visual styling.
- Final caps: `ModelExamplesSection.tsx` <= 120 physical lines; `ModelDecisionExamplesSection.tsx` <= 220; `ModelDefaultExamplesSection.tsx` <= 220; parser <= 300; view-model builder <= 300; UI copy <= 160; static media resolver <= 220; runtime policy <= 180.
- The final JSON cleanup removes exactly 399 legacy keys: 105 `galleryTitle`, 105 `galleryIntro`, 102 `galleryAllCta`, zero `gallerySceneCta`, and 87 `recreateLabel` keys from `custom`; no root-level copies exist.
- Use `apply_patch` for authored edits. The guarded one-time converter may perform the mechanical 120-document rewrite and 399-key cleanup.
- Every task follows red-green-refactor, runs its focused suite, runs `pnpm test:validate` once before commit, and ends in a reviewable commit.
- Baseline focused command is green at 60/60:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-template-content.test.ts \
  tests/google-veo-marketing-surfaces.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/kling-o3-model-pages.test.ts \
  tests/model-prompting-architecture.test.ts \
  tests/model-setup-cli.test.ts
```

## File Structure

### Permanent files to create

- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts` — strict schema, identity/ID/relationship validation, and parsed content types.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-ui-copy.ts` — generic locale UI vocabulary only.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-example-media.ts` — non-localized fallback poster assets keyed by model and fallback item ID.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-runtime-policy.ts` — current silent-presentation and preview-alt compatibility decisions only.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-view-model.ts` — pure runtime transformation and render-ready contracts.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionExamplesSection.tsx` — focused decision renderer and proof grid.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDefaultExamplesSection.tsx` — focused retained default renderer.
- `tests/model-examples-content-contract.test.ts` — strict inventory, structure, exact-locale, and legacy-key contracts.
- `tests/model-examples-view-model.test.ts` — pure real-media/fallback/filter/empty/immutability matrix.
- `tests/model-examples-architecture.test.ts` — permanent ownership, boundaries, and line caps.

### Permanent files to modify

- `frontend/lib/models/i18n-normalization.ts` — expose `examples?: unknown` from `overlay.examples` only.
- `content/models/en/*.json`, `content/models/fr/*.json`, `content/models/es/*.json` — add strict `examples`, then remove only the five legacy gallery keys.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx` — remove the dormant Examples-only CTA route plumbing.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx` — parse/build Examples once and pass one view model without exceeding its 500-line contract.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPageContentSections.tsx` — pass variant plus the render-ready view model.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelExamplesSection.tsx` — retain only visibility/variant orchestration.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionExamplesGallery.client.tsx` — receive the generic no-preview label instead of owning copy.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy.ts` — remove gallery parsing from `custom`.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs-types.ts` — remove the five gallery fields from `SoraCopy`.
- `frontend/scripts/scaffold-model-page.ts` — retarget `examples.modelSlug` with decision/prompting identities.
- `scripts/model-setup.mjs` — require exact-locale Examples review.
- `scripts/audit-models.mjs` — recognize strict `examples` and reject custom fallbacks.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/AGENTS.md` — document final ownership and runtime boundary.
- `docs/engineering/page-architecture.md` — document strict model Examples ownership.
- `tests/model-page-layout-architecture.test.ts` — lock parse/build-once route ownership and layout cap.
- `tests/model-page-template-content.test.ts` — keep customer-visible localization scans on `examples` values.
- `tests/model-setup-cli.test.ts` — behaviorally verify EN/FR/ES identity retargeting and review guidance.
- `tests/google-veo-marketing-surfaces.test.ts`, `tests/gemini-omni-marketing-surfaces.test.ts`, `tests/kling-o3-model-pages.test.ts` — assert representative gallery behavior through parsed content/view models.

### Temporary files to create and delete in this project

- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-legacy.ts` — pure normalized projection of current TypeScript behavior.
- `scripts/migrate-model-examples-content.ts` — dry-run/write converter plus guarded legacy-key remover.
- `tests/model-examples-legacy-projection.test.ts` — 120-way old/new deep parity bridge.

---

### Task 1: Lock the strict Examples content contract and generic UI vocabulary

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-ui-copy.ts`
- Create: `tests/model-examples-content-contract.test.ts`

**Interfaces:**

- Produces: `DECISION_EXAMPLE_FILTER_IDS`, `DecisionExampleFilterId`, `ModelExampleFilter`, `ModelExampleIconId`, and `ModelExamplesContent`.
- Produces: `parseModelExamplesContent(input, expectedSlug, locale, source?): ModelExamplesContent`.
- Produces: `getModelExamplesUiCopy(locale): ModelExamplesUiCopy` and `formatEmptyExamplesLabel(copy, modelName): string`.
- Later tasks import these exact types instead of defining parallel schemas.

- [ ] **Step 1: Write failing parser and UI-copy tests**

Create a valid fixture with context-specific filter labels and nullable recreate action:

```ts
function validExamplesFixture() {
  return {
    modelSlug: 'fixture-model',
    section: {
      title: 'Fixture examples',
      intro: 'Current Fixture outputs.',
      defaultCtaLabel: 'View all Fixture examples',
      recreateLabel: null,
    },
    filters: [
      { id: 'all', label: 'All' },
      { id: 'product', label: 'Product / Ad' },
    ],
    proofItems: [
      { id: 'renders', icon: 'sparkles', title: 'Real renders', body: 'Review current outputs.' },
      { id: 'recreate', icon: 'zap', title: 'Recreate', body: 'Reuse the runtime setup.' },
      { id: 'audio', icon: 'audio', title: 'Audio', body: 'Check the current audio state.' },
      { id: 'continuity', icon: 'users', title: 'Continuity', body: 'Keep scenes consistent.' },
      { id: 'safety', icon: 'shield', title: 'Production-aware', body: 'Use current safeguards.' },
    ],
    fallbackItems: null,
  };
}

test('Examples parser rejects missing, identity mismatch, unknown fields, blanks and invalid relationships', () => {
  assert.throws(
    () => parseModelExamplesContent(undefined, 'fixture-model', 'en', 'missing.json'),
    /Missing examples content.*fixture-model.*en/,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), modelSlug: 'other' }, 'fixture-model', 'en'),
    /identity mismatch/i,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), extra: true }, 'fixture-model', 'en'),
    /Invalid examples content/,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), filters: [{ id: 'product', label: 'Product' }] }, 'fixture-model', 'en'),
    /first filter.*all/i,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), proofItems: validExamplesFixture().proofItems.slice(0, 4) }, 'fixture-model', 'en'),
    /proofItems/i,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), fallbackItems: [{ id: 'fallback', title: 'Fallback', category: 'Product', aspectRatio: '1:1', alt: 'Fallback image', tags: ['edit'] }] }, 'fixture-model', 'en'),
    /undeclared filter.*edit/i,
  );
});

test('generic Examples UI copy is complete and model-neutral', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getModelExamplesUiCopy(locale);
    assert.ok(copy.viewAllLabel.trim());
    assert.ok(copy.renderLabel.trim());
    assert.ok(copy.openLabel.trim());
    assert.ok(copy.noPreviewLabel.trim());
    assert.ok(formatEmptyExamplesLabel(copy, 'Fixture Model').includes('Fixture Model'));
    assert.doesNotMatch(JSON.stringify(copy), /sora|veo|kling|luma|seedance|nano banana/i);
  }
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-examples-content-contract.test.ts
```

Expected: FAIL because both production modules are missing.

- [ ] **Step 3: Implement the strict parser**

Use one exported enum source for parser, builder, content tests, and the existing client gallery type:

```ts
export const DECISION_EXAMPLE_FILTER_IDS = [
  'all', 'cinematic', 'product', 'action', 'vertical', 'audio',
  'campaign', 'typography', 'reference', 'final', 'grounded', 'edit',
  'wide', 'character', 'batch', 'ui', 'mask', 'infographic',
] as const;
export type DecisionExampleFilterId = (typeof DECISION_EXAMPLE_FILTER_IDS)[number];

export const MODEL_EXAMPLE_ICON_IDS = [
  'audio', 'image', 'maximize', 'pen', 'shield', 'sparkles', 'type', 'users', 'zap',
] as const;
export type ModelExampleIconId = (typeof MODEL_EXAMPLE_ICON_IDS)[number];

const nonEmpty = z.string().refine((value) => value.trim().length > 0, 'Expected a non-empty string');
const filterId = z.enum(DECISION_EXAMPLE_FILTER_IDS);
const schema = z.object({
  modelSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  section: z.object({
    title: nonEmpty,
    intro: nonEmpty,
    defaultCtaLabel: nonEmpty.nullable(),
    recreateLabel: nonEmpty.nullable(),
  }).strict(),
  filters: z.array(z.object({ id: filterId, label: nonEmpty }).strict()).min(1),
  proofItems: z.array(z.object({
    id: nonEmpty,
    icon: z.enum(MODEL_EXAMPLE_ICON_IDS),
    title: nonEmpty,
    body: nonEmpty,
  }).strict()).length(5),
  fallbackItems: z.array(z.object({
    id: nonEmpty,
    title: nonEmpty,
    category: nonEmpty,
    aspectRatio: nonEmpty,
    alt: nonEmpty,
    tags: z.array(filterId).min(1),
  }).strict()).nullable(),
}).strict();

export type ModelExamplesContent = z.infer<typeof schema>;
export type ModelExampleFilter = ModelExamplesContent['filters'][number];

export function parseModelExamplesContent(
  input: unknown,
  expectedSlug: string,
  locale: AppLocale,
  source = `content/models/${locale}/${expectedSlug}.json#examples`,
): ModelExamplesContent {
  if (input === undefined) {
    throw new Error(`[model-examples-content] Missing examples content for ${expectedSlug}/${locale} in ${source}`);
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
    throw new Error(`[model-examples-content] Invalid examples content in ${source}: ${issues}`);
  }
  const value = parsed.data;
  if (value.modelSlug !== expectedSlug) {
    throw new Error(`[model-examples-content] Model identity mismatch in ${source}: expected ${expectedSlug}, received ${value.modelSlug}`);
  }
  if (value.filters[0]?.id !== 'all' || value.filters.filter((item) => item.id === 'all').length !== 1) {
    throw new Error(`[model-examples-content] The first filter must be the only all filter in ${source}`);
  }
  for (const [label, ids] of [
    ['filter', value.filters.map((item) => item.id)],
    ['proof', value.proofItems.map((item) => item.id)],
    ['fallback', value.fallbackItems?.map((item) => item.id) ?? []],
  ] as const) {
    if (new Set(ids).size !== ids.length) throw new Error(`[model-examples-content] Duplicate ${label} id in ${source}`);
  }
  const declared = new Set(value.filters.map((item) => item.id));
  for (const item of value.fallbackItems ?? []) {
    for (const tag of item.tags) {
      if (!declared.has(tag)) throw new Error(`[model-examples-content] Fallback ${item.id} uses undeclared filter ${tag} in ${source}`);
    }
  }
  return value;
}
```

- [ ] **Step 4: Implement generic UI copy**

Keep only current generic chrome. Preserve the current hardcoded `No preview` output in all locales unless a separate approved correction changes it:

```ts
export type ModelExamplesUiCopy = {
  viewAllLabel: string;
  renderLabel: string;
  openLabel: string;
  silentLabel: string;
  audioOnLabel: string;
  audioOffLabel: string;
  noPreviewLabel: string;
  emptyTemplate: string;
};

const COPY: Record<AppLocale, ModelExamplesUiCopy> = {
  en: { viewAllLabel: 'View all examples', renderLabel: 'View render', openLabel: 'Open', silentLabel: 'Silent', audioOnLabel: 'Audio on', audioOffLabel: 'Audio off', noPreviewLabel: 'No preview', emptyTemplate: 'No {model} examples match this filter yet.' },
  fr: { viewAllLabel: 'Voir tous les exemples', renderLabel: 'Voir le rendu', openLabel: 'Ouvrir', silentLabel: 'Silencieux', audioOnLabel: 'Audio activé', audioOffLabel: 'Audio coupé', noPreviewLabel: 'No preview', emptyTemplate: 'Aucun exemple {model} ne correspond encore à ce filtre.' },
  es: { viewAllLabel: 'Ver todos los ejemplos', renderLabel: 'Ver resultado', openLabel: 'Abrir', silentLabel: 'Sin audio', audioOnLabel: 'Audio activado', audioOffLabel: 'Audio desactivado', noPreviewLabel: 'No preview', emptyTemplate: 'Todavía no hay ejemplos de {model} para este filtro.' },
};

export function getModelExamplesUiCopy(locale: AppLocale): ModelExamplesUiCopy {
  return COPY[locale];
}

export function formatEmptyExamplesLabel(copy: ModelExamplesUiCopy, modelName: string): string {
  return copy.emptyTemplate.replace('{model}', modelName);
}
```

- [ ] **Step 5: Verify GREEN and permanent caps**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-examples-content-contract.test.ts
pnpm test:validate
wc -l 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-ui-copy.ts'
git diff --check
```

Expected: focused and full suites PASS; parser <= 300 lines; UI copy <= 160; diff check clean.

- [ ] **Step 6: Commit Task 1**

```bash
git add tests/model-examples-content-contract.test.ts \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-ui-copy.ts'
git commit -m "feat: add strict model examples contract"
```

### Task 2: Isolate and characterize the effective legacy editorial projection

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-legacy.ts`
- Create: `tests/model-examples-legacy-projection.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelExamplesSection.tsx`

**Interfaces:**

- Consumes: `SoraCopy`, locale, model slug, and the explicit current `imageFallbackActive` boolean.
- Produces temporarily: `buildLegacyModelExamplesContent(input): ModelExamplesContent`.
- The active component consumes this projection before JSON cutover, proving extraction independently from migration.

- [ ] **Step 1: Add the failing isolation and 120-projection characterization tests**

```ts
test('legacy Examples editorial decisions are isolated behind one pure projector', () => {
  assert.ok(existsSync(legacyPath));
  assert.match(legacySource, /export function buildLegacyModelExamplesContent/);
  assert.match(sectionSource, /buildLegacyModelExamplesContent/);
  assert.doesNotMatch(sectionSource, /function getDecisionExampleProofItems|function getDecisionExampleFilters|function buildImageFallbackExampleItems/);
});

test('all 40 by 3 legacy projections satisfy the strict normalized contract', () => {
  for (const slug of listModelPageTemplateSlugs().sort()) {
    for (const locale of ['en', 'fr', 'es'] as const) {
      const localized = mergeEngineLocalizedContent(readDocument('en', slug), readDocument(locale, slug));
      const copy = buildSoraCopy(localized, slug, locale);
      const projected = buildLegacyModelExamplesContent({
        modelSlug: slug,
        locale,
        copy,
        imageFallbackActive: LEGACY_ACTIVE_IMAGE_FALLBACK_SLUGS.has(slug),
      });
      assert.deepEqual(parseModelExamplesContent(projected, slug, locale), projected);
    }
  }
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-examples-legacy-projection.test.ts
```

Expected: FAIL because the legacy projector does not exist and the component still owns the functions.

- [ ] **Step 3: Move only editorial projection into the temporary pure module**

Use this exact public boundary:

```ts
export const LEGACY_ACTIVE_IMAGE_FALLBACK_SLUGS = new Set([
  'nano-banana-pro',
  'nano-banana',
  'nano-banana-2',
  'seedream',
  'gpt-image-2',
  'luma-uni-1',
  'luma-uni-1-max',
]);

export type BuildLegacyModelExamplesContentInput = {
  modelSlug: string;
  locale: AppLocale;
  copy: Pick<SoraCopy,
    | 'heroTitle'
    | 'galleryTitle'
    | 'galleryIntro'
    | 'galleryAllCta'
    | 'recreateLabel'
  >;
  imageFallbackActive: boolean;
};

export function buildLegacyModelExamplesContent(
  input: BuildLegacyModelExamplesContentInput,
): ModelExamplesContent {
  const modelName = resolveExamplesModelName(input.copy);
  const recreateLabel = input.copy.recreateLabel ?? (
    input.imageFallbackActive
      ? input.locale === 'fr'
        ? 'Recréer ce still →'
        : input.locale === 'es'
          ? 'Recrear este still →'
          : 'Recreate this still →'
      : null
  );
  return {
    modelSlug: input.modelSlug,
    section: {
      title: input.copy.galleryTitle ?? getFallbackExamplesTitle(input.locale, modelName),
      intro: input.copy.galleryIntro ?? getFallbackExamplesIntro(input.locale, modelName),
      defaultCtaLabel: input.copy.galleryAllCta,
      recreateLabel,
    },
    filters: getDecisionExampleFilters(input.locale, input.imageFallbackActive, input.modelSlug),
    proofItems: getDecisionExampleProofItems(
      input.locale,
      modelName,
      input.imageFallbackActive,
      input.modelSlug,
    ).map(({ title, body, icon }, index) => ({ id: `proof-${index + 1}`, title, body, icon })),
    fallbackItems: input.imageFallbackActive
      ? getLegacyImageFallbackContentItems(input.modelSlug, input.locale)
      : null,
  };
}
```

Move these exact current pure helpers into the temporary module: `resolveExamplesModelName`, `getFallbackExamplesTitle`, `getFallbackExamplesIntro`, all route classifiers used by filters/proofs, `isSilentVideoDecisionEngine`, `getDecisionExampleFilters`, and `getDecisionExampleProofItems`. In proof objects, replace `AudioLines`, `ImageIcon`, `Maximize2`, `PenLine`, `ShieldCheck`, `Sparkles`, `Type`, `Users`, and `Zap` with the matching approved lowercase icon IDs. The positional IDs `proof-1` through `proof-5` are locale-stable and preserve the existing five-card order.

Create `getLegacyImageFallbackContentItems` from the tuple arrays currently inside `buildImageFallbackExampleItems` (source lines 1087–1376 at baseline). Return only `{ id: tag, title, category, aspectRatio: resolution, alt, tags: [tag] }`. Exclude poster URLs, app URLs, real media, duration, audio, and `fallbackImageUrl`.

Delete the disabled `getCuratedDecisionExampleTitle`, `getCuratedDecisionExampleCategory`, and `useCuratedLabels = false` path instead of projecting it. Keep current active item titles/categories derived from real media unchanged.

- [ ] **Step 4: Make the live component consume the normalized legacy content**

At the top of the component, resolve exactly once:

```ts
const legacyContent = buildLegacyModelExamplesContent({
  modelSlug: engineSlug,
  locale,
  copy,
  imageFallbackActive: isImageEngine,
});
```

Use `legacyContent.section`, `legacyContent.filters`, `legacyContent.proofItems`, and `legacyContent.fallbackItems` in the current rendering/transformation path. The component may temporarily retain runtime transformation and JSX, but no editorial fallback function or localized model table.

- [ ] **Step 5: Verify exact behavior and commit**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-examples-legacy-projection.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-template-content.test.ts \
  tests/google-veo-marketing-surfaces.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/kling-o3-model-pages.test.ts
pnpm test:validate
git diff --check
```

Expected: all 120 projections parse; focused and full suites PASS; current renderer output contracts remain green.

```bash
git add tests/model-examples-legacy-projection.test.ts \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-legacy.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelExamplesSection.tsx'
git commit -m "refactor: isolate legacy model examples projection"
```

### Task 3: Materialize 120 exact-locale Examples objects and prove zero-difference parity

**Files:**

- Create: `scripts/migrate-model-examples-content.ts`
- Modify: `frontend/lib/models/i18n-normalization.ts`
- Modify: `content/models/en/*.json`
- Modify: `content/models/fr/*.json`
- Modify: `content/models/es/*.json`
- Modify: `tests/model-examples-content-contract.test.ts`
- Modify: `tests/model-examples-legacy-projection.test.ts`

**Interfaces:**

- `EngineOverlay` and `EngineLocalizedContent` gain `examples?: unknown`.
- `mergeEngineLocalizedContent(base, overlay)` returns `examples: overlay.examples` with no fallback.
- Converter supports `--dry-run` and `--write`; dry run reports exactly `projections=120 pending=120 differences=0` before write and `pending=0 differences=0` after write.

- [ ] **Step 1: Extend tests for inventory, structure, exact locale, and parity**

```ts
test('all 40 model documents expose strict Examples content in every locale', () => {
  const expected = listModelPageTemplateSlugs().map((slug) => `${slug}.json`).sort();
  assert.equal(expected.length, 40);
  for (const locale of LOCALES) {
    assert.deepEqual(files(locale), expected);
    for (const fileName of expected) {
      const slug = fileName.slice(0, -5);
      const parsed = parseModelExamplesContent(readDocument(locale, slug).examples, slug, locale);
      assert.equal(parsed.modelSlug, slug);
    }
  }
});

function structuralSignature(
  value: unknown,
  options: { nullableStringPaths: readonly string[] },
  currentPath = '',
): unknown {
  if (options.nullableStringPaths.includes(currentPath)) {
    assert.ok(value === null || typeof value === 'string', currentPath);
    return 'nullable-string';
  }
  if (Array.isArray(value)) {
    return { kind: 'array', length: value.length, items: value.map((item, index) => structuralSignature(item, options, `${currentPath}.${index}`)) };
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, structuralSignature(nested, options, currentPath ? `${currentPath}.${key}` : key)]));
  }
  return value === null ? 'null' : typeof value;
}

test('each model keeps identical EN FR ES Examples structure and semantic IDs', () => {
  for (const slug of listModelPageTemplateSlugs()) {
    const en = parseModelExamplesContent(readDocument('en', slug).examples, slug, 'en');
    for (const locale of ['fr', 'es'] as const) {
      const localized = parseModelExamplesContent(readDocument(locale, slug).examples, slug, locale);
      assert.deepEqual(structuralSignature(localized, { nullableStringPaths: ['section.defaultCtaLabel', 'section.recreateLabel'] }), structuralSignature(en, { nullableStringPaths: ['section.defaultCtaLabel', 'section.recreateLabel'] }));
      assert.deepEqual(localized.filters.map(({ id }) => id), en.filters.map(({ id }) => id));
      assert.deepEqual(localized.proofItems.map(({ id, icon }) => [id, icon]), en.proofItems.map(({ id, icon }) => [id, icon]));
      assert.deepEqual(localized.fallbackItems?.map(({ id, tags }) => [id, tags]) ?? null, en.fallbackItems?.map(({ id, tags }) => [id, tags]) ?? null);
    }
  }
});

test('localized Examples selection never falls back to English', () => {
  assert.match(normalizationSource, /examples:\s*overlay\.examples/);
  assert.doesNotMatch(normalizationSource, /examples:\s*overlay\.examples\s*\?\?\s*base\.examples/);
});

test('stored Examples content is exact legacy parity with zero corrections', () => {
  for (const projection of allLegacyProjections()) {
    const stored = parseModelExamplesContent(readDocument(projection.locale, projection.slug).examples, projection.slug, projection.locale);
    assert.deepEqual(stored, projection.content, `${projection.slug}/${projection.locale}`);
  }
});
```

- [ ] **Step 2: Run RED before loader/converter changes**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-examples-content-contract.test.ts \
  tests/model-examples-legacy-projection.test.ts
```

Expected: FAIL because `examples` is absent from all 120 documents and loader normalization.

- [ ] **Step 3: Expose exact-locale raw Examples content**

In `i18n-normalization.ts`, add the field to both public types and return it exactly:

```ts
// Append beside the current raw exact-locale fields in EngineOverlay.
type EngineOverlayExamplesFields = {
  examples?: unknown;
};

// Append beside the current raw exact-locale fields in EngineLocalizedContent.
type EngineLocalizedExamplesFields = {
  examples?: unknown;
};

// Add as the final field of mergeEngineLocalizedContent's existing return object.
examples: overlay.examples,
```

Do not replace either full type with these excerpts; add the property next to `prompting?: unknown` and `decision?: unknown`, then add the exact return-field expression shown above.

- [ ] **Step 4: Implement the guarded converter**

The converter must use `mergeEngineLocalizedContent`, `buildSoraCopy`, and `buildLegacyModelExamplesContent`; it must not reimplement loader normalization:

```ts
type Mode = 'dry-run' | 'write';

for (const locale of ['en', 'fr', 'es'] as const) {
  for (const slug of listModelPageTemplateSlugs().sort()) {
    const base = readDocument('en', slug);
    const overlay = readDocument(locale, slug);
    const localized = mergeEngineLocalizedContent(base, overlay);
    const copy = buildSoraCopy(localized, slug, locale);
    const projected = buildLegacyModelExamplesContent({
      modelSlug: slug,
      locale,
      copy,
      imageFallbackActive: LEGACY_ACTIVE_IMAGE_FALLBACK_SLUGS.has(slug),
    });
    parseModelExamplesContent(projected, slug, locale);
    if (overlay.examples !== undefined && !isDeepStrictEqual(overlay.examples, projected)) {
      throw new Error(`Examples parity difference: ${slug}/${locale}`);
    }
    if (overlay.examples === undefined) pending += 1;
    if (mode === 'write') writeDocument(locale, slug, { ...overlay, examples: projected });
  }
}
```

Serialize with two-space JSON plus one trailing newline. Reject unknown flags. A second `--write` must make zero changes.

- [ ] **Step 5: Run dry-run, write, idempotence, and parity proof**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-examples-content.ts --dry-run
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-examples-content.ts --write
git diff --check
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-examples-content.ts --dry-run
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-examples-content-contract.test.ts \
  tests/model-examples-legacy-projection.test.ts \
  tests/model-localization-normalization.test.ts \
  tests/model-page-template-content.test.ts
pnpm test:validate
```

Expected after write: `projections=120 pending=0 differences=0`; a second write/dry-run changes nothing; every focused and full test passes.

- [ ] **Step 6: Commit Task 3**

```bash
git add frontend/lib/models/i18n-normalization.ts scripts/migrate-model-examples-content.ts \
  tests/model-examples-content-contract.test.ts tests/model-examples-legacy-projection.test.ts \
  content/models/en content/models/fr content/models/es
git commit -m "content: migrate localized model examples"
```

### Task 4: Build static fallback media, runtime policy, and the pure view model

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-example-media.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-runtime-policy.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-view-model.ts`
- Create: `tests/model-examples-view-model.test.ts`

**Interfaces:**

- Produces: `resolveModelExampleFallbackPosters(modelSlug, itemIds, fallbackImageUrl): ReadonlyMap<string, string>`.
- Produces: `resolveModelExamplesRuntimePolicy({ modelSlug, engineId }): ModelExamplesRuntimePolicy` and `buildModelExamplePreviewAlts(args): Map<string, string>`.
- Produces: `buildModelExamplesViewModel(input): ModelExamplesViewModel`.
- The builder receives parsed content, locale, explicit mode/audio capability, real gallery media, preview alts, static poster map, and route destinations. It never reads files or selects editorial content by slug.

- [ ] **Step 1: Write the failing view-model matrix**

Cover real video media, silent-video behavior, image fallback, empty state, tag-derived filters, and frozen inputs:

```ts
test('real video media preserves current title, alt, badges, links and available filters', () => {
  const result = buildModelExamplesViewModel(videoInput());
  assert.equal(result.visible, true);
  assert.equal(result.decision.items[0]?.id, 'job_fixture');
  assert.equal(result.decision.items[0]?.durationLabel, '8s');
  assert.equal(result.decision.items[0]?.audioBadgeLabel, 'Audio on');
  assert.deepEqual(result.filters.map(({ id }) => id), ['all', 'product', 'audio']);
});

test('silent mode never exposes the audio filter and uses the silent badge', () => {
  const result = buildModelExamplesViewModel(videoInput({ audioMode: 'silent' }));
  assert.equal(result.decision.items[0]?.audioBadgeLabel, 'Silent');
  assert.equal(result.filters.some(({ id }) => id === 'audio'), false);
});

test('image fallback attaches static posters without inventing runtime gallery media', () => {
  const result = buildModelExamplesViewModel(imageFallbackInput());
  assert.equal(result.decision.items[0]?.posterUrl, '/assets/model-examples/fixture/product.webp');
  assert.equal(result.decision.items[0]?.href, '/app/image?engine=fixture-image');
  assert.equal(result.decision.items[0]?.durationLabel, null);
});

test('missing real media stays empty when content has no active fallback items', () => {
  const result = buildModelExamplesViewModel(videoInput({ galleryVideos: [] }));
  assert.equal(result.visible, true);
  assert.deepEqual(result.decision.items, []);
});

test('builder does not mutate frozen content, media, maps or link inputs', () => {
  const input = deepFreeze(videoInput());
  assert.doesNotThrow(() => buildModelExamplesViewModel(input));
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-examples-view-model.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Move the existing poster manifest into the static-media resolver**

Use the current poster paths unchanged. The public API is:

```ts
const FALLBACK_POSTERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  seedream: {
    product: '/assets/model-examples/seedream/product.webp',
    character: '/assets/model-examples/seedream/character.webp',
    edit: '/assets/model-examples/seedream/edit.webp',
    batch: '/assets/model-examples/seedream/batch.webp',
  },
  'gpt-image-2': {
    product: '/assets/model-examples/gpt-image-2/product.webp',
    typography: '/assets/model-examples/gpt-image-2/typography.webp',
    ui: '/assets/model-examples/gpt-image-2/ui.webp',
    edit: '/assets/model-examples/gpt-image-2/edit.webp',
    mask: '/assets/model-examples/gpt-image-2/mask.webp',
    final: '/assets/model-examples/gpt-image-2/final.webp',
  },
  'nano-banana': {
    campaign: '/assets/model-examples/nano-banana/campaign.webp',
    typography: '/assets/model-examples/nano-banana/typography.webp',
    reference: '/assets/model-examples/nano-banana/reference.webp',
    final: '/assets/model-examples/nano-banana/final.webp',
  },
  'nano-banana-2': {
    grounded: '/assets/model-examples/nano-banana-2/grounded.webp',
    edit: '/assets/model-examples/nano-banana-2/edit.webp',
    reference: '/assets/model-examples/nano-banana-2/reference.webp',
    wide: '/assets/model-examples/nano-banana-2/wide.webp',
  },
  'luma-uni-1': {
    product: '/assets/model-examples/luma-uni-1/product.webp',
    edit: '/assets/model-examples/luma-uni-1/edit.webp',
    reference: '/assets/model-examples/luma-uni-1/reference.webp',
    campaign: '/assets/model-examples/luma-uni-1/research.webp',
  },
  'luma-uni-1-max': {
    product: '/assets/model-examples/luma-uni-1-max/hero-product.webp',
    typography: '/assets/model-examples/luma-uni-1-max/typography.webp',
    edit: '/assets/model-examples/luma-uni-1-max/edit.webp',
    reference: '/assets/model-examples/luma-uni-1-max/reference.webp',
  },
  'nano-banana-pro': {
    campaign: '/assets/model-examples/nano-banana-pro/campaign.webp',
    typography: '/assets/model-examples/nano-banana-pro/typography.webp',
    reference: '/assets/model-examples/nano-banana-pro/reference.webp',
    final: '/assets/model-examples/nano-banana-pro/final.webp',
  },
};

export function resolveModelExampleFallbackPosters(
  modelSlug: string,
  itemIds: readonly string[],
  fallbackImageUrl: string | null,
): ReadonlyMap<string, string> {
  return new Map(itemIds.map((id) => [id, FALLBACK_POSTERS[modelSlug]?.[id] ?? fallbackImageUrl ?? '']));
}
```

The map contains no copy or locale data. Add an assertion that its model keys equal the models with non-null migrated `fallbackItems`.

- [ ] **Step 4: Isolate the existing runtime compatibility decisions**

```ts
const SILENT_ENGINE_IDS = new Set([
  'minimax-hailuo-02-text', 'pika-text-to-video',
  'luma-ray-2', 'lumaRay2', 'luma-ray-2-flash', 'lumaRay2_flash', 'luma-ray-3-2',
]);
const NUMBERED_ALT_MODELS = new Set([
  'seedance-2-0', 'minimax-hailuo-02-text', 'wan-2-6', 'pika-text-to-video',
]);

export type ModelExamplesRuntimePolicy = {
  audioMode: 'runtime' | 'silent';
  previewAltMode: 'prompt' | 'numbered-model-example';
};

export function resolveModelExamplesRuntimePolicy({
  modelSlug,
  engineId,
}: {
  modelSlug: string;
  engineId: string;
}): ModelExamplesRuntimePolicy {
  return {
    audioMode: SILENT_ENGINE_IDS.has(engineId) ? 'silent' : 'runtime',
    previewAltMode: NUMBERED_ALT_MODELS.has(modelSlug) ? 'numbered-model-example' : 'prompt',
  };
}
```

Move the current `galleryPreviewAlts` algorithm behind this exact semantic interface:

```ts
export function buildModelExamplePreviewAlts({
  galleryVideos,
  locale,
  modelName,
  mode,
}: {
  galleryVideos: readonly ExampleGalleryVideo[];
  locale: AppLocale;
  modelName: string;
  mode: ModelExamplesRuntimePolicy['previewAltMode'];
}): Map<string, string> {
  const exampleLabel = locale === 'fr' ? 'exemple' : locale === 'es' ? 'ejemplo' : 'example';
  return dedupeAltsInList(galleryVideos.slice(0, 6).map((video, index) => {
    const prompt = video.promptFull ?? video.prompt;
    const tag = inferRenderTag(prompt, locale);
    const label = mode === 'numbered-model-example'
      ? `${modelName} ${tag ? `${tag} ` : ''}${exampleLabel} ${index + 1}`
      : prompt;
    return {
      id: video.id,
      alt: getImageAlt({ kind: 'renderThumb', engine: video.engineLabel, label, prompt: label, locale }),
      tag,
      index,
      locale,
    };
  }));
}
```

This module is the only permanent Examples module allowed to contain the above model/engine IDs.

- [ ] **Step 5: Implement the pure builder**

Define one complete render-ready contract:

```ts
export type ModelExamplesGalleryItem = {
  id: string;
  href: string;
  posterUrl: string;
  alt: string;
  audioBadgeLabel: string | null;
  durationLabel: string | null;
  aspectRatio: string | null;
  category: string;
  title: string;
  recreateHref: string | null;
  recreateLabel: string | null;
  tags: DecisionExampleFilterId[];
};

export type BuildModelExamplesViewModelInput = {
  content: ModelExamplesContent;
  ui: ModelExamplesUiCopy;
  locale: AppLocale;
  anchorId: string;
  modelName: string;
  mode: 'video' | 'image-fallback';
  audioMode: 'runtime' | 'silent';
  galleryVideos: readonly ExampleGalleryVideo[];
  galleryPreviewAlts: ReadonlyMap<string, string>;
  fallbackPosters: ReadonlyMap<string, string>;
  examplesLinkHref: LocalizedLinkHref;
  imageWorkspaceHref: string;
};

export type ModelExamplesViewModel = {
  visible: boolean;
  anchorId: string;
  section: ModelExamplesContent['section'];
  filters: ModelExampleFilter[];
  proofItems: Array<Omit<ModelExamplesContent['proofItems'][number], 'icon'> & { icon: LucideIcon }>;
  decision: {
    items: ModelExamplesGalleryItem[];
    examplesLinkHref: LocalizedLinkHref | null;
    viewAllLabel: string;
    renderLinkLabel: string;
    emptyLabel: string;
    noPreviewLabel: string;
  };
  defaultPresentation: {
    items: Array<{
      id: string;
      href: LocalizedLinkHref;
      posterUrl: string;
      alt: string;
      metadataLabel: string;
      recreateHref: LocalizedLinkHref | null;
      recreateLabel: string | null;
    }>;
    examplesLinkHref: LocalizedLinkHref;
    renderLinkLabel: string;
    noPreviewLabel: string;
  };
};
```

The input explicitly supplies `mode: 'video' | 'image-fallback'`, `audioMode: 'runtime' | 'silent'`, model display name, gallery data, alts, poster map, links, and generic UI copy. Reuse the current `getDisplayAspectRatio`, duration formatting, `inferRenderTag`, `deriveShortPromptLabel`, and tag regex behavior without model-slug branches.

Map icon IDs to Lucide components in one constant outside the content parser. Filter `content.filters` by tags present in final items while always retaining `all`.

- [ ] **Step 6: Verify and commit Task 4**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-examples-view-model.test.ts \
  tests/model-examples-content-contract.test.ts \
  tests/model-examples-legacy-projection.test.ts
pnpm test:validate
wc -l 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-view-model.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-example-media.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-runtime-policy.ts'
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: focused/full/static checks PASS; builder <= 300; media resolver <= 220; runtime policy <= 180.

```bash
git add tests/model-examples-view-model.test.ts \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-view-model.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-example-media.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-runtime-policy.ts'
git commit -m "feat: derive model examples view models"
```

### Task 5: Cut the active section and both renderers over to the view model

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionExamplesSection.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDefaultExamplesSection.tsx`
- Create: `tests/model-examples-architecture.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPageContentSections.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelExamplesSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionExamplesGallery.client.tsx`
- Modify: representative model marketing tests listed in File Structure.

**Interfaces:**

- `MarketingModelPageLayout` calls `parseModelExamplesContent` and `buildModelExamplesViewModel` exactly once.
- `ModelExamplesSection` props become `{ viewModel: ModelExamplesViewModel; variant?: 'default' | 'decision' }`.
- Both child renderers accept only `{ viewModel: ModelExamplesViewModel }`.
- The client gallery gains `noPreviewLabel: string` and imports filter/item types from the permanent Examples content/view-model boundary instead of defining another filter union.

- [ ] **Step 1: Write failing architecture and renderer-boundary tests**

```ts
test('model Examples parses and builds once before rendering', () => {
  assert.equal(count(layoutSource, 'parseModelExamplesContent('), 1);
  assert.equal(count(layoutSource, 'buildModelExamplesViewModel('), 1);
  assert.match(layoutSource, /examplesProps=\{\{\s*viewModel:\s*examplesViewModel/);
});

test('server Examples renderers accept only the render-ready view model', () => {
  for (const source of [wrapperSource, decisionSource, defaultSource]) {
    assert.doesNotMatch(source, /SoraCopy|AppLocale|ExampleGalleryVideo|engineSlug|galleryPreviewAlts|fallbackImageUrl/);
    assert.doesNotMatch(source, /nano-banana|seedream|luma-|veo-|sora-|kling-|seedance-/i);
  }
  assert.match(wrapperSource, /viewModel:\s*ModelExamplesViewModel/);
});

test('active Examples ownership no longer imports the legacy projector', () => {
  assert.doesNotMatch(`${layoutSource}\n${wrapperSource}\n${decisionSource}\n${defaultSource}`, /model-page-examples-legacy/);
});

test('Examples files respect permanent line caps', () => {
  assert.ok(lines(wrapperSource) <= 120);
  assert.ok(lines(decisionSource) <= 220);
  assert.ok(lines(defaultSource) <= 220);
  assert.ok(lines(parserSource) <= 300);
  assert.ok(lines(viewModelSource) <= 300);
  assert.ok(lines(uiCopySource) <= 160);
  assert.ok(lines(mediaSource) <= 220);
  assert.ok(lines(runtimePolicySource) <= 180);
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-examples-architecture.test.ts
```

Expected: FAIL because the layout passes raw props, the focused renderers are absent, and the active section imports legacy ownership.

- [ ] **Step 3: Parse and build once in the layout without breaching its cap**

Replace `hasFallbackGalleryCopy`, slug-list visibility, alt preparation, and the large `examplesProps` object with:

```ts
const examplesContent = parseModelExamplesContent(
  localizedContent.examples,
  engine.modelSlug,
  locale,
  `content/models/${locale}/${engine.modelSlug}.json#examples`,
);
const examplesPolicy = resolveModelExamplesRuntimePolicy({
  modelSlug: engine.modelSlug,
  engineId: engine.id,
});
const galleryPreviewAlts = buildModelExamplePreviewAlts({
  galleryVideos,
  locale,
  modelName: heroTitle,
  mode: examplesPolicy.previewAltMode,
});
const fallbackPosters = resolveModelExampleFallbackPosters(
  engine.modelSlug,
  examplesContent.fallbackItems?.map((item) => item.id) ?? [],
  heroMedia.posterUrl ?? localizedContent.seo.image ?? null,
);
const examplesViewModel = buildModelExamplesViewModel({
  content: examplesContent,
  ui: getModelExamplesUiCopy(locale),
  locale,
  anchorId: textAnchorId,
  modelName: heroTitle,
  mode: examplesContent.fallbackItems ? 'image-fallback' : 'video',
  audioMode: examplesPolicy.audioMode,
  galleryVideos,
  galleryPreviewAlts,
  fallbackPosters,
  examplesLinkHref,
  imageWorkspaceHref: `/app/image?engine=${encodeURIComponent(engine.modelSlug)}`,
});
const hasExamples = examplesViewModel.visible;
```

Delete the dormant `galleryCtaHref` calculation and prop from `page.tsx`, `MarketingModelPageLayout`, and all Examples components. The old `gallerySceneCta` render branch has no authored content in any of the 120 documents and must not survive as unused route plumbing.

If this addition pushes `MarketingModelPageLayout.tsx` above 500 lines, extract the existing examples input preparation into `_lib/model-page-examples-data.ts` only if it remains pure and does not duplicate the view-model builder. Do not compress unrelated JSX to satisfy the cap.

- [ ] **Step 4: Split renderers and keep the wrapper thin**

```tsx
export function ModelExamplesSection({
  viewModel,
  variant = 'default',
}: {
  viewModel: ModelExamplesViewModel;
  variant?: 'default' | 'decision';
}) {
  if (!viewModel.visible) return null;
  return variant === 'decision'
    ? <ModelDecisionExamplesSection viewModel={viewModel} />
    : <ModelDefaultExamplesSection viewModel={viewModel} />;
}
```

`ModelDecisionExamplesSection` renders the current outer `<section>`, rounded decision surface, `ModelDecisionExamplesGallery`, and five-card proof grid. Its gallery props come only from `viewModel.section`, `viewModel.filters`, `viewModel.decision`, and `viewModel.proofItems`.

`ModelDefaultExamplesSection` renders the current full-bleed section, horizontal six-item rail, metadata line, render/recreate links, and empty intro/CTA state. Its props come only from `viewModel.section` and `viewModel.defaultPresentation`.

Preserve the exact DOM order and class strings from baseline `dfe861db:frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelExamplesSection.tsx` lines 1392–1588. Pass `noPreviewLabel` into `ModelDecisionExamplesGallery`; do not change filtering, pagination, aria labels, item count, or styles.

- [ ] **Step 5: Add representative behavior assertions**

Permanent fixtures must cover:

- Sora 2 Pro real-video filters, title, proof icons, recreate label, and audio badge in EN/FR/ES;
- Veo 3.1 Fast real media without editorial title replacement;
- Kling O3 exact gallery section and current media links;
- Gemini Omni current examples behavior;
- Nano Banana Pro and Luma Uni image fallback item order, posters, categories, alts, and workspace links;
- default renderer null recreate label and no-preview behavior.

Use builder/rendered-output assertions, not source-string checks for customer-visible behavior.

- [ ] **Step 6: Verify cutover and commit Task 5**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-examples-architecture.test.ts \
  tests/model-examples-view-model.test.ts \
  tests/model-examples-content-contract.test.ts \
  tests/model-examples-legacy-projection.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-template-content.test.ts \
  tests/google-veo-marketing-surfaces.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/kling-o3-model-pages.test.ts
pnpm test:validate
npx tsc -p frontend/tsconfig.json --noEmit
npm --prefix frontend run lint
npm run lint:exposure
npm run architecture:audit -- --min-lines 500
git diff --check
```

Expected: active ownership tests and all suites PASS; no Examples renderer appears in the >=500-line audit; layout remains <=500.

```bash
git add tests/model-examples-architecture.test.ts tests/model-examples-view-model.test.ts \
  tests/model-page-layout-architecture.test.ts tests/model-page-template-content.test.ts \
  tests/google-veo-marketing-surfaces.test.ts tests/gemini-omni-marketing-surfaces.test.ts tests/kling-o3-model-pages.test.ts \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPageContentSections.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelExamplesSection.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionExamplesSection.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDefaultExamplesSection.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionExamplesGallery.client.tsx'
git commit -m "refactor: render model examples from localized content"
```

### Task 6: Delete legacy ownership, update scaffold/guides, and complete production verification

**Files:**

- Delete: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-legacy.ts`
- Delete: `scripts/migrate-model-examples-content.ts`
- Delete: `tests/model-examples-legacy-projection.test.ts`
- Modify: the 120 localized JSON files to remove exactly 399 legacy keys.
- Modify: permanent source, scaffold, setup, audit, guide, and test files listed in File Structure.

**Interfaces:**

- Final production ownership is only strict JSON -> parser -> pure view model -> focused renderer.
- Scaffold retargets `decision`, `prompting`, and `examples` identities.
- Migration-only imports and files are absent.

- [ ] **Step 1: Strengthen permanent deletion/scaffold contracts and prove RED**

```ts
const LEGACY_GALLERY_KEYS = [
  'galleryTitle', 'galleryIntro', 'galleryAllCta', 'gallerySceneCta', 'recreateLabel',
] as const;

test('model documents contain no legacy Examples ownership', () => {
  for (const locale of LOCALES) {
    for (const slug of listModelPageTemplateSlugs()) {
      const document = readDocument(locale, slug);
      for (const key of LEGACY_GALLERY_KEYS) {
        assert.equal(Object.hasOwn(document, key), false, `${slug}/${locale}/root/${key}`);
        assert.equal(Object.hasOwn(document.custom ?? {}, key), false, `${slug}/${locale}/custom/${key}`);
      }
    }
  }
});

test('temporary Examples migration owners are absent', () => {
  for (const filePath of [legacyPath, converterPath, legacyTestPath]) {
    assert.equal(existsSync(filePath), false, filePath);
  }
});

test('SoraCopy and buildSoraCopy contain no Examples ownership', () => {
  for (const key of LEGACY_GALLERY_KEYS) {
    assert.doesNotMatch(specTypesSource, new RegExp(`\\b${key}\\b`));
    assert.doesNotMatch(copySource, new RegExp(`\\b${key}\\b`));
  }
});
```

Extend the behavioral scaffold test so generated EN/FR/ES documents assert:

```ts
assert.equal(generated.decision?.modelSlug, targetSlug);
assert.equal(generated.prompting?.modelSlug, targetSlug);
assert.equal(generated.examples?.modelSlug, targetSlug);
assert.deepEqual(
  generated.examples?.filters.map(({ id }) => id),
  source.examples?.filters.map(({ id }) => id),
);
```

Run the permanent tests now; expected FAIL because the 399 keys and temporary owners remain and scaffold does not retarget `examples`.

- [ ] **Step 2: Guard and perform exact legacy-key cleanup**

Add a converter cleanup mode that:

1. asserts all 120 stored `examples` objects still equal the legacy projection;
2. removes only the five named keys from `custom`;
3. counts exactly 399 removals with the expected per-key inventory;
4. asserts removing `examples` and the five legacy keys leaves every other document path unchanged;
5. refuses to write if any count or parity check differs.

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-examples-content.ts --remove-legacy --dry-run
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-examples-content.ts --remove-legacy --write
git diff --check
```

Expected: `documents=120 removed=399 galleryTitle=105 galleryIntro=105 galleryAllCta=102 gallerySceneCta=0 recreateLabel=87 unrelatedDifferences=0 examplesDifferences=0`.

- [ ] **Step 3: Remove production and temporary legacy owners**

Delete the five properties from `SoraCopy` and the five assignments/fallback helper from `buildSoraCopy`. Delete the legacy projector, converter, and parity test only after permanent content/view-model tests pass.

Update `scripts/audit-models.mjs` to validate `content?.examples` and reject `custom` gallery ownership. Do not keep fallback reads.

- [ ] **Step 4: Update scaffold, setup guidance, and route documentation**

In the scaffold identity loop:

```ts
for (const field of ['decision', 'prompting', 'examples'] as const) {
  const block = transformed[field];
  if (block && typeof block === 'object' && !Array.isArray(block)) {
    transformed[field] = { ...(block as Record<string, unknown>), modelSlug: options.targetSlug };
  }
}
```

Update setup output to require review of every localized `decision`, `prompting`, and `examples` block, exact identities, structural parity, model-context filter labels, and no English fallback.

Document in route `AGENTS.md` and `page-architecture.md`:

- model-specific Examples editorial copy lives only at `#examples`;
- the loader uses exact locale;
- parser/builder/renderers contain no model-specific editorial branches;
- runtime media, capabilities, destinations, and posters are not localized content.

- [ ] **Step 5: Run permanent focused and full verification**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-examples-content-contract.test.ts \
  tests/model-examples-view-model.test.ts \
  tests/model-examples-architecture.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-template-content.test.ts \
  tests/model-localization-normalization.test.ts \
  tests/google-veo-marketing-surfaces.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/kling-o3-model-pages.test.ts \
  tests/model-setup-cli.test.ts
pnpm test:validate
npx tsc -p frontend/tsconfig.json --noEmit
npm --prefix frontend run lint
npm run lint:exposure
pnpm model:registry:check
npm run architecture:audit -- --min-lines 500
git diff --check
```

Expected: all checks PASS; temporary files absent; `ModelExamplesSection.tsx` absent from the >=500-line audit.

- [ ] **Step 6: Run production build and localized smokes**

Run:

```bash
npm --prefix frontend run build
```

Start the built server and smoke exactly these representative route shapes:

```text
/models/sora-2-pro
/fr/modeles/sora-2-pro
/es/modelos/sora-2-pro
/models/nano-banana-pro
/fr/modeles/luma-uni-1
/es/modelos/luma-uni-1
```

For every route assert HTTP 200, expected localized title/intro/proof/filter/fallback copy, existing item order, recreate-link presence or absence, canonical, `en`/`fr`/`es`/`x-default` hreflang, JSON-LD scripts, and no error overlay. Interactively verify filtering and show-more on one video route and one image route.

- [ ] **Step 7: Prove protected paths and commit Task 6**

```bash
git diff --name-only dfe861db -- | rg 'pricing|billing|model-registry|model-runtime|engine-catalog|sitemap|route\.ts' && exit 1 || true
git status --short --branch
git diff --check
```

Expected: no protected-path drift and clean tracked status after commit.

```bash
git add content/models frontend/lib/models/i18n-normalization.ts \
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]' \
  frontend/scripts/scaffold-model-page.ts scripts/model-setup.mjs scripts/audit-models.mjs \
  docs/engineering/page-architecture.md tests/model-examples-content-contract.test.ts \
  tests/model-examples-view-model.test.ts tests/model-examples-architecture.test.ts \
  tests/model-page-layout-architecture.test.ts tests/model-page-template-content.test.ts \
  tests/model-localization-normalization.test.ts tests/google-veo-marketing-surfaces.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts tests/kling-o3-model-pages.test.ts tests/model-setup-cli.test.ts
git commit -m "refactor: remove legacy model examples ownership"
```

## Final Review Gate

After all six task reviews pass, request one fresh whole-branch review for `dfe861db..HEAD`. Fix every Critical and Important finding and rerun the affected focused checks. Always rerun `pnpm test:validate`; rerun build and production smokes when the correction touches `frontend`, `content/models`, or runtime configuration. The branch is ready only with zero unresolved Critical or Important findings and a clean tracked worktree.
