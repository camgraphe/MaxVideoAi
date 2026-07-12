# Canonical Model Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace distributed model identity, alias, publication, family-membership, and model-redirect policy with one validated registry while preserving all public and internal compatibility.

**Architecture:** `frontend/config/model-registry.json` becomes the only authored policy source. Server/build code consumes it through a validated TypeScript API; browser code consumes a checked, generated `model-runtime.json` projection that excludes tombstones and validation code. Existing `falEngines`, publication, family, roster, and slug modules remain stable facades until their data tables have been removed.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript 5.4, Node test runner through `tsx`, JSON configuration, pnpm 10, Next.js redirects.

## Global Constraints

- Start from commit `5cf44bbafc620102a9ffe32acd1bdded5bd0674e` on `origin/main`; the design commits `82713840` and `84e55b7f` are documentation-only prerequisites.
- `frontend/config/model-registry.json` is the sole authored owner of canonical ID, canonical slug, family, category, internal aliases, public aliases, replacement, model publication, examples publication, comparison publication, app discovery, pricing-link publication, sitemap publication, and model-route tombstones.
- The compatibility baseline contains 41 engine entries, 40 published model pages, 87 manual internal aliases, 44 slug-map aliases plus the middleware-only `pika-image-video` alias, and two catalogue tombstones.
- Preserve canonical destinations, model availability, metadata, JSON-LD, sitemap membership, and English/French/Spanish locale behavior.
- Normalize every historical model redirect to explicit HTTP 301 and one hop.
- Provider IDs, provider endpoints, provider capabilities, price formulas, and localized editorial copy stay outside the registry.
- Perform no database migration and no network lookup while loading or validating the registry.
- Do not add validation, tombstone, or redirect code to client bundles. The generated runtime projection may contain only model fields that replace data already shipped by the current engine/alias/publication modules.
- Keep `normalizeEngineId`, `getFalEngineBySlug`, `MODEL_FAMILIES`, roster helpers, and slug helpers available as compatibility facades.
- Treat engine/app inputs and public URL slugs as separate alias namespaces inside the same registry. The same token may intentionally target different models by context; specifically, engine input `veo3` resolves to `veo-3-1-fast`, while public slug `veo3` resolves to `veo-3-1`.
- Use `pnpm`; do not run `npm install`.
- Do not mix pricing-calculation, editorial-content, provider-routing, job-finalization, or polling refactors into these commits.
- Treat replacement entries as fully retired: every publication surface is off, the target is a directly active model page, and chains or cycles are invalid. Generate localized HTTP 301 rules for the retired canonical slug and every historical public alias directly to the replacement canonical slug.
- Project only a flattened `publicTargetId` into the browser-safe runtime so wrong-English FR/ES model compatibility paths also resolve replacement canonical slugs and aliases in one hop without exposing the replacement graph or changing engine-input resolution.
- Gate model-page rendering on `publication.model.published`, robots metadata on `publication.model.indexable`, and sitemap output on `publication.sitemap.published`; a published noindex model remains routable.
- Make `pnpm model:registry:check` a read-only exact drift check for runtime JSON, engine catalog, frontend roster, docs roster JSON, and docs roster CSV.

---

## File Map

### New authored files

- `frontend/config/model-registry.json`: sole model policy document.
- `frontend/config/model-registry.ts`: typed server/build selectors over the validated document.
- `frontend/config/model-registry-validation.ts`: pure deterministic structural and cross-reference validator.
- `frontend/config/model-runtime.ts`: browser-safe selectors over the generated projection.
- `scripts/generate-model-runtime.mjs`: deterministic registry-to-runtime projection and drift check.
- `scripts/validate-model-registry.ts`: build preflight, including repository/content checks.
- `tests/fixtures/model-registry-baseline.json`: immutable pre-migration input/output oracle.
- `tests/model-registry-baseline.test.ts`: baseline integrity contract.
- `tests/model-registry-validation.test.ts`: validator mutation tests.
- `tests/model-registry-parity.test.ts`: identity/publication/alias/family parity.
- `tests/model-registry-redirects.test.ts`: EN/FR/ES redirect projection contract.
- `tests/model-registry-architecture.test.ts`: one-owner and client-boundary contract.
- `docs/engineering/model-registry.md`: operating guide for additions, renames, retirements, and publication.

### New generated file

- `frontend/config/model-runtime.json`: checked browser-safe projection; never edited by hand.

### Existing facades and builders to modify

- `frontend/src/config/falEngines.ts`
- `frontend/src/config/fal-engines/types.ts`
- `frontend/src/config/fal-engines/launch-config.ts`
- all raw engine definition modules listed in Task 4
- `frontend/src/lib/engine-alias.ts`
- `frontend/src/lib/model-slugs.ts`
- `frontend/src/lib/model-roster.ts`
- `frontend/config/model-publication.ts`
- `frontend/config/model-families.ts`
- `frontend/lib/model-families.ts`
- `scripts/build-engine-catalog.ts`
- `scripts/models-audit.mjs`
- `scripts/model-setup.mjs`
- `scripts/generate-model-roster.mjs`
- `frontend/next.config.js`
- `frontend/lib/middleware/routing-marketing.ts`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
- root and frontend `package.json`
- root and model-route `AGENTS.md`
- `docs/engineering/project-structure.md`

### Generated artifacts to refresh after ownership moves

- `frontend/config/engine-catalog.json`
- `frontend/config/model-roster.json`
- `docs/model-roster.json`
- `docs/model-roster.csv`

---

### Task 1: Freeze the pre-migration compatibility baseline

**Files:**
- Create: `tests/model-registry-baseline.test.ts`
- Create: `tests/fixtures/model-registry-baseline.json`
- Temporarily create, run, then delete: `scripts/capture-model-registry-baseline.ts`

**Interfaces:**
- Consumes: current `listFalEngines()`, `MODEL_FAMILIES`, `manualAliases`, `LEGACY_MODEL_SLUG_ALIASES`, and `nextConfig.redirects()` behavior.
- Produces: immutable fixture with `models`, `internalAliases`, `publicSlugAliases`, `familyDefinitions`, `modelRedirects`, and `tombstones`.

- [ ] **Step 1: Write the failing baseline integrity test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fixturePath = 'tests/fixtures/model-registry-baseline.json';

test('model registry baseline freezes the complete pre-migration contract', () => {
  const baseline = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    models: Array<{ id: string; slug: string }>;
    internalAliases: Array<{ alias: string; targetId: string }>;
    publicSlugAliases: Array<{ alias: string; targetSlug: string }>;
    familyDefinitions: Array<{ id: string }>;
    modelRedirects: Array<{ source: string; destination: string; statusCode: number }>;
    tombstones: Array<{ slug: string; destination: 'models-index' }>;
  };

  assert.equal(baseline.models.length, 41);
  assert.equal(new Set(baseline.models.map((model) => model.id.toLowerCase())).size, 41);
  assert.equal(new Set(baseline.models.map((model) => model.slug)).size, 41);
  assert.equal(baseline.internalAliases.length, 87);
  assert.equal(baseline.publicSlugAliases.length, 45);
  assert.ok(baseline.familyDefinitions.length >= 10);
  assert.ok(baseline.modelRedirects.length >= 35);
  assert.deepEqual(baseline.tombstones, [
    { slug: 'hunyuan-video', destination: 'models-index' },
    { slug: 'luma-dream-machine', destination: 'models-index' },
  ]);
});
```

- [ ] **Step 2: Run the test and verify the missing fixture is the only failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-baseline.test.ts`

Expected: FAIL with `ENOENT` for `tests/fixtures/model-registry-baseline.json`.

- [ ] **Step 3: Add and run the one-time capture script**

```ts
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MODEL_FAMILIES } from '../frontend/config/model-families.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';

const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js') as {
  redirects(): Promise<Array<{ source: string; destination: string; permanent?: boolean; statusCode?: number }>>;
};

function parseRecord(sourcePath: string, declaration: string) {
  const source = readFileSync(sourcePath, 'utf8');
  const start = source.indexOf(declaration);
  assertFound(start >= 0, `${declaration} not found in ${sourcePath}`);
  const open = source.indexOf('{', start);
  const close = [source.indexOf('\n  };', open), source.indexOf('\n};', open)]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? -1;
  assertFound(open >= 0 && close > open, `record body not found for ${declaration}`);
  const body = source.slice(open + 1, close);
  const rows: Array<{ alias: string; target: string }> = [];
  const row = /^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_-]+)):\s*'([^']+)',/gm;
  for (const match of body.matchAll(row)) {
    rows.push({ alias: match[1] ?? match[2] ?? match[3], target: match[4] });
  }
  return rows;
}

function assertFound(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const internalAliases = parseRecord(
  'frontend/src/lib/engine-alias.ts',
  'const manualAliases: Record<string, string>'
).map(({ alias, target }) => ({ alias, targetId: target }));

const publicSlugAliases = parseRecord(
  'frontend/src/config/falEngines.ts',
  'const LEGACY_MODEL_SLUG_ALIASES: Record<string, string>'
)
  .map(({ alias, target }) => ({ alias, targetSlug: target }))
  .concat({ alias: 'pika-image-video', targetSlug: 'pika-text-to-video' });

const redirects = await nextConfig.redirects();
const modelRedirects = redirects
  .filter((rule) => /^\/(?:models|fr\/modeles|es\/modelos)\//.test(rule.source))
  .map((rule) => ({
    source: rule.source,
    destination: rule.destination,
    statusCode: rule.statusCode ?? (rule.permanent ? 308 : 307),
  }))
  .sort((left, right) => left.source.localeCompare(right.source));

const models = listFalEngines()
  .map((entry) => ({
    id: entry.id,
    slug: entry.modelSlug,
    family: entry.family ?? null,
    category: entry.category ?? 'video',
    publication: entry.surfaces,
  }))
  .sort((left, right) => left.id.localeCompare(right.id));

const fixture = {
  capturedFromCommit: '5cf44bbafc620102a9ffe32acd1bdded5bd0674e',
  models,
  internalAliases,
  publicSlugAliases,
  familyDefinitions: MODEL_FAMILIES,
  modelRedirects,
  tombstones: [
    { slug: 'hunyuan-video', destination: 'models-index' },
    { slug: 'luma-dream-machine', destination: 'models-index' },
  ],
};

const outputPath = 'tests/fixtures/model-registry-baseline.json';
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`);
rmSync('scripts/capture-model-registry-baseline.ts');
```

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/capture-model-registry-baseline.ts`

Expected: fixture exists, contains 41 models, and the temporary script deletes itself.

- [ ] **Step 4: Run the baseline test and the existing alias/public-engine tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-baseline.test.ts tests/public-engines.test.ts tests/seedance-prelaunch.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit the immutable oracle**

```bash
git add tests/model-registry-baseline.test.ts tests/fixtures/model-registry-baseline.json
git commit -m "test: freeze model registry compatibility baseline"
```

---

### Task 2: Add the canonical registry schema, data, and pure validator

**Files:**
- Create: `frontend/config/model-registry.json`
- Create: `frontend/config/model-registry-validation.ts`
- Create: `frontend/config/model-registry.ts`
- Create: `tests/model-registry-validation.test.ts`
- Temporarily create, run, then delete: `scripts/migrate-model-registry-baseline.ts`

**Interfaces:**
- Consumes: `tests/fixtures/model-registry-baseline.json`.
- Produces:
  - `validateModelRegistryDocument(value: unknown): ModelRegistryDocument`
  - `getModelRegistryEntries(): readonly ModelRegistryEntry[]`
  - `getModelRegistryEntryById(id: string): ModelRegistryEntry | null`
  - `getModelRegistryEntryByCanonicalSlug(slug: string): ModelRegistryEntry | null`
  - `resolveModelRegistryEngineInput(value: string | null | undefined): ModelRegistryEntry | null`
  - `resolveModelRegistryPublicSlug(slug: string): ModelRegistryEntry | null`
  - `buildLocalizedModelPath(locale: 'en' | 'fr' | 'es', slug: string): string`

- [ ] **Step 1: Write validator mutation tests before the module exists**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateModelRegistryDocument } from '../frontend/config/model-registry-validation.ts';

const valid = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8'));

function mutate(run: (copy: any) => void) {
  const copy = structuredClone(valid);
  run(copy);
  return copy;
}

test('canonical registry validates the committed document', () => {
  assert.equal(validateModelRegistryDocument(valid).models.length, 41);
});

test('engine and public alias namespaces preserve context-specific veo3 behavior', () => {
  const document = validateModelRegistryDocument(valid);
  const internalOwner = document.models.find((model) => model.aliases.internal.includes('veo3'));
  const publicOwner = document.models.find((model) => model.aliases.publicSlugs.includes('veo3'));
  assert.equal(internalOwner?.id, 'veo-3-1-fast');
  assert.equal(publicOwner?.id, 'veo-3-1');
});

test('registry rejects duplicate identity and ambiguous aliases', () => {
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => { copy.models[1].id = copy.models[0].id; })),
    /duplicate canonical id/i
  );
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      copy.models[1].aliases.internal.push(copy.models[0].aliases.internal[0]);
    })),
    /ambiguous internal alias/i
  );
});

test('registry rejects broken references, chains, and tombstone collisions', () => {
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      copy.models[0].publication.compare.suggestedOpponentIds = ['missing-model'];
    })),
    /missing model reference/i
  );
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      copy.models[0].replacement = copy.models[1].id;
      copy.models[1].replacement = copy.models[2].id;
    })),
    /replacement chain/i
  );
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      copy.tombstones[0].slug = copy.models[0].slug;
    })),
    /tombstone collision/i
  );
});
```

- [ ] **Step 2: Run the test and verify it fails on missing registry modules**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-validation.test.ts`

Expected: FAIL because `model-registry-validation.ts` and `model-registry.json` do not exist.

- [ ] **Step 3: Generate the initial registry deterministically from the baseline**

```ts
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const baseline = JSON.parse(readFileSync('tests/fixtures/model-registry-baseline.json', 'utf8'));
const modelIdBySlug = new Map(baseline.models.map((model: any) => [model.slug, model.id]));
const familyById = new Map(baseline.familyDefinitions.map((family: any) => [family.id, family]));

function idsForSlugs(slugs: string[]) {
  return slugs.map((slug) => {
    const id = modelIdBySlug.get(slug);
    if (!id) throw new Error(`Missing model id for comparison slug ${slug}`);
    return id;
  });
}

const models = baseline.models.map((model: any) => {
  const family = model.family ? familyById.get(model.family) : null;
  const configuredCurrent = family?.examplesPage?.currentModelSlugs ?? [];
  const configuredPublished = family?.examplesPage?.publishedModelSlugs ?? [];
  const currentSlugs = configuredCurrent.length ? configuredCurrent : configuredPublished;
  const familyRank = configuredPublished.indexOf(model.slug);
  return {
    id: model.id,
    slug: model.slug,
    family: model.family,
    category: model.category,
    aliases: {
      internal: baseline.internalAliases
        .filter((row: any) => row.targetId === model.id)
        .map((row: any) => row.alias)
        .sort(),
      publicSlugs: baseline.publicSlugAliases
        .filter((row: any) => row.targetSlug === model.slug)
        .map((row: any) => row.alias)
        .sort(),
    },
    publication: {
      model: {
        published: model.publication.modelPage.indexable || model.publication.modelPage.includeInSitemap,
        indexable: model.publication.modelPage.indexable,
      },
      examples: {
        published: model.publication.examples.includeInFamilyResolver,
        includeInFamilyCopy: model.publication.examples.includeInFamilyCopy,
        current: currentSlugs.includes(model.slug),
        familyRank: familyRank >= 0 ? familyRank : undefined,
      },
      compare: {
        published: model.publication.compare.includeInHub,
        indexed: model.publication.compare.includeInHub,
        suggestedOpponentIds: idsForSlugs(model.publication.compare.suggestOpponents),
        publishedPairIds: idsForSlugs(model.publication.compare.publishedPairs),
      },
      app: {
        published: model.publication.app.enabled,
        discoveryRank: model.publication.app.discoveryRank,
        variantGroup: model.publication.app.variantGroup,
        variantLabel: model.publication.app.variantLabel,
      },
      pricing: {
        published: model.publication.pricing.includeInEstimator,
        featuredScenario: model.publication.pricing.featuredScenario,
      },
      sitemap: { published: model.publication.modelPage.includeInSitemap },
    },
    replacement: null,
  };
});

const document = { schemaVersion: 1, models, tombstones: baseline.tombstones };
writeFileSync('frontend/config/model-registry.json', `${JSON.stringify(document, null, 2)}\n`);
rmSync('scripts/migrate-model-registry-baseline.ts');
```

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-registry-baseline.ts`

Expected: `frontend/config/model-registry.json` is created with 41 entries and the temporary script is removed.

- [ ] **Step 4: Implement the pure validator and typed selector API**

Use these exact public types in `model-registry-validation.ts`:

```ts
export type ModelCategory = 'video' | 'image' | 'audio' | 'multimodal';

export type ModelRegistryPublication = {
  model: { published: boolean; indexable: boolean };
  examples: { published: boolean; includeInFamilyCopy: boolean; current: boolean; familyRank?: number };
  compare: {
    published: boolean;
    indexed: boolean;
    suggestedOpponentIds: string[];
    publishedPairIds: string[];
  };
  app: {
    published: boolean;
    discoveryRank?: number;
    variantGroup?: string;
    variantLabel?: string;
  };
  pricing: { published: boolean; featuredScenario?: string };
  sitemap: { published: boolean };
};

export type ModelRegistryEntry = {
  id: string;
  slug: string;
  family: string | null;
  category: ModelCategory;
  aliases: { internal: string[]; publicSlugs: string[] };
  publication: ModelRegistryPublication;
  replacement: string | null;
};

export type ModelRegistryDocument = {
  schemaVersion: 1;
  models: ModelRegistryEntry[];
  tombstones: Array<{ slug: string; destination: 'models-index' }>;
};
```

Implement `validateModelRegistryDocument` with normalized-key indexes and these concrete checks:

```ts
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HISTORICAL_SLUG_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function normalized(value: string) {
  return value.trim().toLowerCase();
}

function fail(message: string): never {
  throw new Error(`model-registry: ${message}`);
}

function requireBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') fail(`${path} must be boolean`);
}

function requireStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail(`${path} must be a non-blank string array`);
  }
  if (new Set(value.map(normalized)).size !== value.length) fail(`${path} contains duplicates`);
}

function rejectForbiddenFields(value: unknown, path = 'registry'): void {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectForbiddenFields(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return;
  const forbidden = new Set([
    'provider',
    'providerId',
    'falModelId',
    'endpoint',
    'pricingDetails',
    'priceFormula',
    'copy',
    'title',
    'description',
  ]);
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) fail(`forbidden field ${path}.${key}`);
    rejectForbiddenFields(child, `${path}.${key}`);
  }
}

export function validateModelRegistryDocument(value: unknown): ModelRegistryDocument {
  if (!value || typeof value !== 'object') fail('document must be an object');
  const document = value as ModelRegistryDocument;
  if (document.schemaVersion !== 1) fail('schemaVersion must equal 1');
  if (!Array.isArray(document.models) || !Array.isArray(document.tombstones)) {
    fail('models and tombstones must be arrays');
  }
  rejectForbiddenFields(document);

  const byId = new Map<string, ModelRegistryEntry>();
  const bySlug = new Map<string, ModelRegistryEntry>();
  const internalAliases = new Map<string, string>();
  const publicAliases = new Map<string, string>();
  const engineInputs = new Map<string, string>();
  const publicInputs = new Map<string, string>();

  for (const model of document.models) {
    if (!model || typeof model !== 'object') fail('model entry must be an object');
    if (!ID_PATTERN.test(model.id)) fail(`invalid canonical id "${model.id}"`);
    if (!SLUG_PATTERN.test(model.slug)) fail(`invalid canonical slug "${model.slug}"`);
    if (model.family !== null && (typeof model.family !== 'string' || !model.family.trim())) {
      fail(`invalid family for "${model.id}"`);
    }
    if (!['video', 'image', 'audio', 'multimodal'].includes(model.category)) {
      fail(`invalid category for "${model.id}"`);
    }
    requireStringArray(model.aliases?.internal, `${model.id}.aliases.internal`);
    requireStringArray(model.aliases?.publicSlugs, `${model.id}.aliases.publicSlugs`);
    requireBoolean(model.publication?.model?.published, `${model.id}.publication.model.published`);
    requireBoolean(model.publication?.model?.indexable, `${model.id}.publication.model.indexable`);
    requireBoolean(model.publication?.examples?.published, `${model.id}.publication.examples.published`);
    requireBoolean(
      model.publication?.examples?.includeInFamilyCopy,
      `${model.id}.publication.examples.includeInFamilyCopy`
    );
    requireBoolean(model.publication?.examples?.current, `${model.id}.publication.examples.current`);
    requireBoolean(model.publication?.compare?.published, `${model.id}.publication.compare.published`);
    requireBoolean(model.publication?.compare?.indexed, `${model.id}.publication.compare.indexed`);
    requireStringArray(
      model.publication?.compare?.suggestedOpponentIds,
      `${model.id}.publication.compare.suggestedOpponentIds`
    );
    requireStringArray(
      model.publication?.compare?.publishedPairIds,
      `${model.id}.publication.compare.publishedPairIds`
    );
    requireBoolean(model.publication?.app?.published, `${model.id}.publication.app.published`);
    requireBoolean(model.publication?.pricing?.published, `${model.id}.publication.pricing.published`);
    requireBoolean(model.publication?.sitemap?.published, `${model.id}.publication.sitemap.published`);
    if (model.replacement !== null && (typeof model.replacement !== 'string' || !model.replacement.trim())) {
      fail(`invalid replacement for "${model.id}"`);
    }
    const idKey = normalized(model.id);
    const slugKey = normalized(model.slug);
    if (byId.has(idKey)) fail(`duplicate canonical id "${model.id}"`);
    if (bySlug.has(slugKey)) fail(`duplicate canonical slug "${model.slug}"`);
    const idOwner = engineInputs.get(idKey);
    const engineSlugOwner = engineInputs.get(slugKey);
    const publicSlugOwner = publicInputs.get(slugKey);
    if (idOwner && idOwner !== model.id) fail(`canonical id input collision "${model.id}"`);
    if (engineSlugOwner && engineSlugOwner !== model.id) fail(`canonical engine slug collision "${model.slug}"`);
    if (publicSlugOwner && publicSlugOwner !== model.id) fail(`canonical public slug collision "${model.slug}"`);
    byId.set(idKey, model);
    bySlug.set(slugKey, model);
    engineInputs.set(idKey, model.id);
    engineInputs.set(slugKey, model.id);
    publicInputs.set(slugKey, model.id);
  }

  for (const model of document.models) {
    const idKey = normalized(model.id);
    const slugKey = normalized(model.slug);
    for (const alias of model.aliases.internal) {
      const key = normalized(alias);
      const owner = internalAliases.get(key);
      if (owner && owner !== model.id) fail(`ambiguous internal alias "${alias}"`);
      if (byId.has(key) && key !== idKey) fail(`internal alias conflicts with canonical id "${alias}"`);
      const inputOwner = engineInputs.get(key);
      if (inputOwner && inputOwner !== model.id) fail(`ambiguous engine input "${alias}"`);
      internalAliases.set(key, model.id);
      engineInputs.set(key, model.id);
    }
    for (const alias of model.aliases.publicSlugs) {
      const key = normalized(alias);
      if (!HISTORICAL_SLUG_PATTERN.test(key)) fail(`invalid public slug alias "${alias}"`);
      if (key === slugKey) fail(`public alias equals canonical slug "${alias}"`);
      const owner = publicAliases.get(key);
      if (owner && owner !== model.id) fail(`ambiguous public alias "${alias}"`);
      if (bySlug.has(key) && key !== slugKey) fail(`public alias conflicts with canonical slug "${alias}"`);
      const inputOwner = publicInputs.get(key);
      if (inputOwner && inputOwner !== model.id) fail(`ambiguous public input "${alias}"`);
      publicAliases.set(key, model.id);
      publicInputs.set(key, model.id);
    }
  }

  const requireId = (sourceId: string, targetId: string, field: string) => {
    if (!byId.has(normalized(targetId))) fail(`missing model reference "${targetId}" from ${sourceId}.${field}`);
  };

  const familyRanks = new Map<string, string>();
  const appRanks = new Map<string, string>();
  for (const model of document.models) {
    for (const target of model.publication.compare.suggestedOpponentIds) {
      requireId(model.id, target, 'suggestedOpponentIds');
    }
    for (const target of model.publication.compare.publishedPairIds) {
      requireId(model.id, target, 'publishedPairIds');
    }
    if (model.replacement) {
      requireId(model.id, model.replacement, 'replacement');
      const replacement = byId.get(normalized(model.replacement));
      if (replacement?.replacement) fail(`replacement chain starts at "${model.id}"`);
      if (normalized(model.replacement) === normalized(model.id)) fail(`replacement self-reference at "${model.id}"`);
    }
    if (model.publication.sitemap.published && !model.publication.model.published) {
      fail(`sitemap publication requires model publication for "${model.id}"`);
    }
    if (model.publication.model.indexable && !model.publication.model.published) {
      fail(`indexable model must be published for "${model.id}"`);
    }
    if (model.publication.examples.current && !model.publication.examples.published) {
      fail(`current examples model must be published for "${model.id}"`);
    }
    if (model.publication.compare.indexed && !model.publication.compare.published) {
      fail(`indexed comparison requires published comparison for "${model.id}"`);
    }
    const rank = model.publication.examples.familyRank;
    if (rank !== undefined) {
      if (!Number.isInteger(rank) || rank < 0 || !model.family) {
        fail(`invalid examples family rank for "${model.id}"`);
      }
      const rankKey = `${model.family.toLowerCase()}:${rank}`;
      const owner = familyRanks.get(rankKey);
      if (owner) fail(`duplicate examples family rank for "${owner}" and "${model.id}"`);
      familyRanks.set(rankKey, model.id);
    }
    const discoveryRank = model.publication.app.discoveryRank;
    if (discoveryRank !== undefined) {
      if (!Number.isFinite(discoveryRank)) fail(`invalid app discovery rank for "${model.id}"`);
      const group = model.publication.app.variantGroup ?? model.family ?? model.id;
      const rankKey = `${group.toLowerCase()}:${discoveryRank}`;
      const owner = appRanks.get(rankKey);
      if (owner) fail(`duplicate app discovery rank for "${owner}" and "${model.id}"`);
      appRanks.set(rankKey, model.id);
    }
  }

  const tombstones = new Set<string>();
  for (const tombstone of document.tombstones) {
    const key = normalized(tombstone.slug);
    if (tombstone.destination !== 'models-index') fail(`unsupported tombstone destination for "${tombstone.slug}"`);
    if (!SLUG_PATTERN.test(key)) fail(`invalid tombstone slug "${tombstone.slug}"`);
    if (tombstones.has(key)) fail(`duplicate tombstone "${tombstone.slug}"`);
    if (bySlug.has(key) || publicAliases.has(key)) fail(`tombstone collision for "${tombstone.slug}"`);
    tombstones.add(key);
  }

  return document;
}
```

In `model-registry.ts`, validate at module load and expose a read-only collection view:

```ts
import rawRegistry from './model-registry.json' with { type: 'json' };
import { validateModelRegistryDocument } from './model-registry-validation';
import type { ModelRegistryDocument, ModelRegistryEntry } from './model-registry-validation';

const registry = validateModelRegistryDocument(rawRegistry) as ModelRegistryDocument;
const byId = new Map(registry.models.map((model) => [model.id.toLowerCase(), model]));
const bySlug = new Map(registry.models.map((model) => [model.slug, model]));
const byEngineInput = new Map<string, ModelRegistryEntry>();
const byPublicSlug = new Map<string, ModelRegistryEntry>();

for (const model of registry.models) {
  for (const value of [model.id, model.slug, ...model.aliases.internal]) {
    byEngineInput.set(value.trim().toLowerCase(), model);
  }
  for (const value of [model.slug, ...model.aliases.publicSlugs]) {
    byPublicSlug.set(value.trim().toLowerCase(), model);
  }
}

export type { ModelRegistryDocument, ModelRegistryEntry } from './model-registry-validation';
export const MODEL_REGISTRY_SCHEMA_VERSION = registry.schemaVersion;

export function getModelRegistryEntries(): readonly ModelRegistryEntry[] {
  return registry.models;
}

export function getModelRegistryEntryById(id: string): ModelRegistryEntry | null {
  return byId.get(id.trim().toLowerCase()) ?? null;
}

export function getModelRegistryEntryByCanonicalSlug(slug: string): ModelRegistryEntry | null {
  return bySlug.get(slug.trim().toLowerCase()) ?? null;
}

export function resolveModelRegistryEngineInput(value: string | null | undefined): ModelRegistryEntry | null {
  const key = value?.trim().toLowerCase();
  return key ? byEngineInput.get(key) ?? null : null;
}

export function resolveModelRegistryPublicSlug(slug: string): ModelRegistryEntry | null {
  return byPublicSlug.get(slug.trim().toLowerCase()) ?? null;
}

export function buildLocalizedModelPath(locale: 'en' | 'fr' | 'es', slug: string): string {
  if (locale === 'fr') return `/fr/modeles/${slug}`;
  if (locale === 'es') return `/es/modelos/${slug}`;
  return `/models/${slug}`;
}
```

- [ ] **Step 5: Run validator tests and fix only concrete reported invariants**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-validation.test.ts`

Expected: PASS with four tests and zero failures.

- [ ] **Step 6: Commit the canonical source and validator**

```bash
git add frontend/config/model-registry.json frontend/config/model-registry.ts frontend/config/model-registry-validation.ts tests/model-registry-validation.test.ts
git commit -m "feat: add canonical model registry"
```

---

### Task 3: Add the checked browser-safe runtime projection and build preflight

**Files:**
- Create: `frontend/config/model-runtime.json`
- Create: `frontend/config/model-runtime.ts`
- Create: `scripts/generate-model-runtime.mjs`
- Create: `scripts/validate-model-registry.ts`
- Create: `tests/model-registry-parity.test.ts`
- Modify: `package.json`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `ModelRegistryDocument` from Task 2 and the baseline fixture.
- Produces:
  - `listRuntimeModels(): readonly RuntimeModelEntry[]`
  - `getRuntimeModelById(id: string): RuntimeModelEntry | null`
  - `getRuntimeModelByCanonicalSlug(slug: string): RuntimeModelEntry | null`
  - `resolveRuntimeEngineInput(value: string | null | undefined): RuntimeModelEntry | null`
  - `resolveRuntimePublicSlug(slug: string): RuntimeModelEntry | null`
  - `toLegacyModelSurfaces(model: RuntimeModelEntry): ModelPublicationSurfaces`

- [ ] **Step 1: Write the failing runtime parity test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  listRuntimeModels,
  resolveRuntimeEngineInput,
  resolveRuntimePublicSlug,
  toLegacyModelSurfaces,
} from '../frontend/config/model-runtime.ts';

const baseline = JSON.parse(readFileSync('tests/fixtures/model-registry-baseline.json', 'utf8'));

test('runtime model projection matches every baseline identity and surface', () => {
  const runtimeById = new Map(listRuntimeModels().map((model) => [model.id, model]));
  for (const expected of baseline.models) {
    const actual = runtimeById.get(expected.id);
    assert.ok(actual, `missing runtime model ${expected.id}`);
    assert.equal(actual.slug, expected.slug);
    assert.equal(actual.family, expected.family);
    assert.equal(actual.category, expected.category);
    assert.deepEqual(toLegacyModelSurfaces(actual), expected.publication);
  }
});

test('runtime projection resolves every frozen explicit alias', () => {
  for (const row of baseline.internalAliases) {
    assert.equal(resolveRuntimeEngineInput(row.alias)?.id, row.targetId, row.alias);
  }
  for (const row of baseline.publicSlugAliases) {
    assert.equal(resolveRuntimePublicSlug(row.alias)?.slug, row.targetSlug, row.alias);
  }
});
```

- [ ] **Step 2: Run the test and verify the runtime projection is missing**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-parity.test.ts`

Expected: FAIL because `model-runtime.ts` does not exist.

- [ ] **Step 3: Implement deterministic runtime generation with check mode**

```js
import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../frontend/config/model-registry.json', import.meta.url);
const outputPath = new URL('../frontend/config/model-runtime.json', import.meta.url);
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const runtime = {
  schemaVersion: source.schemaVersion,
  models: source.models.map(({ replacement, ...model }) => model),
};
const expected = `${JSON.stringify(runtime, null, 2)}\n`;
const write = process.argv.includes('--write');

if (write) {
  await writeFile(outputPath, expected);
  console.log(`[model-runtime] wrote ${runtime.models.length} models`);
} else {
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (current !== expected) {
    console.error('[model-runtime] drift detected; run pnpm model:registry:generate');
    process.exitCode = 1;
  } else {
    console.log(`[model-runtime] projection current (${runtime.models.length} models)`);
  }
}
```

Run: `node scripts/generate-model-runtime.mjs --write`

Expected: `[model-runtime] wrote 41 models`.

- [ ] **Step 4: Implement the browser-safe runtime facade**

```ts
import runtimeDocument from './model-runtime.json' with { type: 'json' };
import type { ModelPublicationSurfaces } from './model-publication';
import type { ModelRegistryEntry } from './model-registry-validation';

export type RuntimeModelEntry = Omit<ModelRegistryEntry, 'replacement'>;

const models = runtimeDocument.models as RuntimeModelEntry[];
const byId = new Map(models.map((model) => [model.id.toLowerCase(), model]));
const bySlug = new Map(models.map((model) => [model.slug, model]));
const byEngineInput = new Map<string, RuntimeModelEntry>();
const byPublicSlug = new Map<string, RuntimeModelEntry>();

for (const model of models) {
  for (const value of [model.id, model.slug, ...model.aliases.internal]) {
    byEngineInput.set(value.trim().toLowerCase(), model);
  }
  for (const value of [model.slug, ...model.aliases.publicSlugs]) {
    byPublicSlug.set(value.trim().toLowerCase(), model);
  }
}

export function listRuntimeModels(): readonly RuntimeModelEntry[] {
  return models;
}

export function getRuntimeModelById(id: string): RuntimeModelEntry | null {
  return byId.get(id.trim().toLowerCase()) ?? null;
}

export function getRuntimeModelByCanonicalSlug(slug: string): RuntimeModelEntry | null {
  return bySlug.get(slug.trim().toLowerCase()) ?? null;
}

export function resolveRuntimeEngineInput(value: string | null | undefined): RuntimeModelEntry | null {
  const key = value?.trim().toLowerCase();
  return key ? byEngineInput.get(key) ?? null : null;
}

export function resolveRuntimePublicSlug(slug: string): RuntimeModelEntry | null {
  return byPublicSlug.get(slug.trim().toLowerCase()) ?? null;
}

export function toLegacyModelSurfaces(model: RuntimeModelEntry): ModelPublicationSurfaces {
  const slugById = (id: string) => byId.get(id.toLowerCase())?.slug ?? id;
  return {
    modelPage: {
      indexable: model.publication.model.indexable,
      includeInSitemap: model.publication.sitemap.published,
    },
    examples: {
      includeInFamilyResolver: model.publication.examples.published,
      includeInFamilyCopy: model.publication.examples.includeInFamilyCopy,
    },
    compare: {
      suggestOpponents: model.publication.compare.suggestedOpponentIds.map(slugById),
      publishedPairs: model.publication.compare.publishedPairIds.map(slugById),
      includeInHub: model.publication.compare.published,
    },
    app: {
      enabled: model.publication.app.published,
      discoveryRank: model.publication.app.discoveryRank,
      variantGroup: model.publication.app.variantGroup,
      variantLabel: model.publication.app.variantLabel,
    },
    pricing: {
      includeInEstimator: model.publication.pricing.published,
      featuredScenario: model.publication.pricing.featuredScenario,
    },
  };
}
```

- [ ] **Step 5: Add registry scripts and automatic production-build preflight**

Add these root scripts:

```json
"model:registry:generate": "node scripts/generate-model-runtime.mjs --write",
"model:registry:check": "tsx --tsconfig frontend/tsconfig.json scripts/validate-model-registry.ts && node scripts/generate-model-runtime.mjs"
```

Make `scripts/validate-model-registry.ts` execute validation without side effects:

```ts
import registry from '../frontend/config/model-registry.json' with { type: 'json' };
import { validateModelRegistryDocument } from '../frontend/config/model-registry-validation.ts';

const validated = validateModelRegistryDocument(registry);
console.log(`[model-registry] valid (${validated.models.length} models, ${validated.tombstones.length} tombstones)`);
```

Add this frontend lifecycle script so every `next build` runs the preflight:

```json
"prebuild": "pnpm --dir .. model:registry:check"
```

- [ ] **Step 6: Run parity, generation drift, and build-preflight commands**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts && pnpm model:registry:check`

Expected: all tests PASS, validator reports 41 models and two tombstones, runtime projection reports current.

- [ ] **Step 7: Commit the runtime boundary**

```bash
git add package.json frontend/package.json frontend/config/model-runtime.json frontend/config/model-runtime.ts scripts/generate-model-runtime.mjs scripts/validate-model-registry.ts tests/model-registry-parity.test.ts
git commit -m "feat: add checked model runtime projection"
```

---

### Task 4: Make raw engine modules reference registry identity and publication

**Files:**
- Modify: `frontend/src/config/falEngines.ts`
- Modify: `frontend/src/config/fal-engines/types.ts`
- Modify: `frontend/src/config/fal-engines/launch-config.ts`
- Modify: `frontend/src/config/fal-engines/gemini-omni-flash.ts`
- Modify: `frontend/src/config/fal-engines/gpt-image-2.ts`
- Modify: `frontend/src/config/fal-engines/hailuo.ts`
- Modify: `frontend/src/config/fal-engines/happy-horse-1-1.ts`
- Modify: `frontend/src/config/fal-engines/happy-horse.ts`
- Modify: `frontend/src/config/fal-engines/kling-2-5.ts`
- Modify: `frontend/src/config/fal-engines/kling-2-6.ts`
- Modify: `frontend/src/config/fal-engines/kling-3-4k.ts`
- Modify: `frontend/src/config/fal-engines/kling-3-pro.ts`
- Modify: `frontend/src/config/fal-engines/kling-3-standard.ts`
- Modify: `frontend/src/config/fal-engines/kling-o3.ts`
- Modify: `frontend/src/config/fal-engines/ltx-2-3-fast.ts`
- Modify: `frontend/src/config/fal-engines/ltx-2-3.ts`
- Modify: `frontend/src/config/fal-engines/ltx-2-fast.ts`
- Modify: `frontend/src/config/fal-engines/ltx-2.ts`
- Modify: `frontend/src/config/fal-engines/luma-ray-2-flash.ts`
- Modify: `frontend/src/config/fal-engines/luma-ray-2.ts`
- Modify: `frontend/src/config/fal-engines/luma-ray-3-2.ts`
- Modify: `frontend/src/config/fal-engines/luma-uni-1-max.ts`
- Modify: `frontend/src/config/fal-engines/luma-uni-1.ts`
- Modify: `frontend/src/config/fal-engines/nano-banana-2.ts`
- Modify: `frontend/src/config/fal-engines/nano-banana-lite.ts`
- Modify: `frontend/src/config/fal-engines/nano-banana-pro.ts`
- Modify: `frontend/src/config/fal-engines/nano-banana.ts`
- Modify: `frontend/src/config/fal-engines/pika.ts`
- Modify: `frontend/src/config/fal-engines/seedance-1-5.ts`
- Modify: `frontend/src/config/fal-engines/seedance-2-byteplus.ts`
- Modify: `frontend/src/config/fal-engines/seedance-2-fast.ts`
- Modify: `frontend/src/config/fal-engines/seedance-2-mini.ts`
- Modify: `frontend/src/config/fal-engines/seedance-2-standard.ts`
- Modify: `frontend/src/config/fal-engines/seedream.ts`
- Modify: `frontend/src/config/fal-engines/sora.ts`
- Modify: `frontend/src/config/fal-engines/veo-3-1-fast.ts`
- Modify: `frontend/src/config/fal-engines/veo-3-1-lite.ts`
- Modify: `frontend/src/config/fal-engines/veo-3-1.ts`
- Modify: `frontend/src/config/fal-engines/wan-2-5.ts`
- Modify: `frontend/src/config/fal-engines/wan-2-6.ts`
- Modify: `scripts/build-engine-catalog.ts`
- Modify: `scripts/models-audit.mjs`
- Refresh: `frontend/config/engine-catalog.json`
- Refresh: `frontend/config/model-roster.json`
- Refresh: `docs/model-roster.json`
- Refresh: `docs/model-roster.csv`
- Temporarily create, run, then delete: `scripts/remove-raw-model-policy.ts`
- Create: `tests/model-registry-architecture.test.ts`

**Interfaces:**
- Consumes: `getRuntimeModelById` and `toLegacyModelSurfaces` from Task 3.
- Produces: every `FalEngineEntry` gets `modelSlug`, `family`, `category`, and `surfaces` exclusively from the generated registry projection.

- [ ] **Step 1: Write the failing raw-ownership architecture test**

```ts
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('../frontend/node_modules/typescript');
const engineDir = 'frontend/src/config/fal-engines';
const registryOwnedProperties = new Set(['modelSlug', 'family', 'category', 'surfaces']);

function objectPropertyName(node: any) {
  const name = node.name;
  return name && ts.isIdentifier(name) ? name.text : name && ts.isStringLiteral(name) ? name.text : null;
}

test('raw engine definitions do not own model identity or publication', () => {
  for (const name of readdirSync(engineDir).filter((file) => file.endsWith('.ts') && file !== 'types.ts')) {
    const path = `${engineDir}/${name}`;
    const source = readFileSync(path, 'utf8');
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    function visit(node: any) {
      if (ts.isObjectLiteralExpression(node)) {
        const names = node.properties.map(objectPropertyName).filter(Boolean);
        if (names.includes('id') && names.includes('marketingName')) {
          for (const property of names) {
            assert.equal(registryOwnedProperties.has(property!), false, `${name} owns ${property}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
});

test('fal engine materialization reads registry-owned model fields', () => {
  const source = readFileSync('frontend/src/config/falEngines.ts', 'utf8');
  assert.match(source, /getRuntimeModelById/);
  assert.match(source, /toLegacyModelSurfaces/);
  assert.doesNotMatch(source, /buildDefaultModelPublicationSurfaces|mergeModelPublicationSurfaces/);
});
```

- [ ] **Step 2: Run the test and confirm raw ownership causes failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-architecture.test.ts`

Expected: FAIL listing raw engine modules that still contain identity/publication properties.

- [ ] **Step 3: Run a syntax-aware one-time removal of raw policy fields**

Implement `scripts/remove-raw-model-policy.ts` with the TypeScript compiler API. It removes properties only from object literals that contain both `id` and `marketingName`, so nested provider metadata is untouched.

```ts
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('../frontend/node_modules/typescript');
const directory = 'frontend/src/config/fal-engines';
const owned = new Set(['modelSlug', 'family', 'category', 'surfaces']);

function propertyName(node: any) {
  const name = node.name;
  return name && ts.isIdentifier(name) ? name.text : name && ts.isStringLiteral(name) ? name.text : null;
}

for (const file of readdirSync(directory).filter((name) => name.endsWith('.ts') && name !== 'types.ts')) {
  const path = `${directory}/${file}`;
  const source = readFileSync(path, 'utf8');
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edits: Array<{ start: number; end: number }> = [];

  function visit(node: any) {
    if (ts.isObjectLiteralExpression(node)) {
      const names = new Set(node.properties.map(propertyName).filter(Boolean));
      if (names.has('id') && names.has('marketingName')) {
        for (const property of node.properties) {
          const name = propertyName(property);
          if (!name || !owned.has(name)) continue;
          let start = property.getFullStart();
          let end = property.end;
          const trailing = source.slice(end).match(/^\s*,/);
          if (trailing) end += trailing[0].length;
          edits.push({ start, end });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(tree);
  let next = source;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    next = `${next.slice(0, edit.start)}${next.slice(edit.end)}`;
  }
  if (next !== source) writeFileSync(path, next);
}

rmSync('scripts/remove-raw-model-policy.ts');
```

Run: `pnpm exec tsx scripts/remove-raw-model-policy.ts`

Expected: the temporary script deletes itself and the architecture test no longer finds those four top-level fields.

- [ ] **Step 4: Change raw and materialized engine types**

Keep `FalEngineEntry` unchanged for consumers, but replace `RawFalEngineEntry` with:

```ts
export interface RawFalEngineEntry
  extends Omit<FalEngineEntry, 'modelSlug' | 'family' | 'category' | 'surfaces'> {}
```

Replace `materializeFalEngineEntry` with:

```ts
import { getRuntimeModelById, toLegacyModelSurfaces } from '../../config/model-runtime';

function materializeFalEngineEntry(entry: RawFalEngineEntry): FalEngineEntry {
  const partnerBrand = getPartnerByBrandId(entry.brandId);
  const model = getRuntimeModelById(entry.id);
  if (!model) throw new Error(`Missing model registry entry for engine "${entry.id}"`);
  return {
    ...entry,
    modelSlug: model.slug,
    family: model.family ?? undefined,
    category: model.category,
    logoPolicy: partnerBrand?.policy.logoAllowed ? 'logoAllowed' : entry.logoPolicy,
    surfaces: toLegacyModelSurfaces(model),
  };
}
```

Delete `hasExplicitFalEngineSurfaces`; all surfaces now have one source.

- [ ] **Step 5: Remove obsolete Seedance surface construction**

Delete these exports and their now-unused publication imports from `launch-config.ts`:

```ts
SEEDANCE_COMPARE_PUBLISHED_SLUGS
getSeedancePublishedPairs
buildSeedance2Surfaces
buildSeedance2MiniSurfaces
```

Remove the corresponding imports from:

```text
frontend/src/config/fal-engines/seedance-2-fast.ts
frontend/src/config/fal-engines/seedance-2-standard.ts
frontend/src/config/fal-engines/seedance-2-mini.ts
```

- [ ] **Step 6: Mark generated engine catalog surfaces as registry-derived**

In `scripts/build-engine-catalog.ts`, remove `hasExplicitFalEngineSurfaces`, change the field type, and emit:

```ts
surfacesSource: 'registry';
```

In `scripts/models-audit.mjs`, replace the explicit/default exception with:

```js
if (entry?.surfacesSource !== 'registry') {
  pushIssue('error', 'MODEL_SURFACES_NOT_REGISTRY_DERIVED', 'Model surfaces must come from model-registry.json.', {
    modelSlug,
    surfacesSource: entry?.surfacesSource ?? 'unknown',
  });
}
```

Delete `GRANDFATHERED_DEFAULT_SURFACE_SLUGS`; registry publication is explicit for all 41 entries, so the audit has no grandfathered list.

- [ ] **Step 7: Regenerate derived catalogs and run focused contracts**

Run:

```bash
pnpm engine:catalog
pnpm model:generate:write
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-architecture.test.ts tests/model-registry-parity.test.ts tests/fal-engine-catalog-architecture.test.ts tests/public-engines.test.ts
pnpm model:check
```

Expected: generated catalog has 41 `surfacesSource: "registry"` entries; all tests and model checks PASS.

- [ ] **Step 8: Commit engine ownership migration**

```bash
git add frontend/src/config/falEngines.ts frontend/src/config/fal-engines scripts/build-engine-catalog.ts scripts/models-audit.mjs frontend/config/engine-catalog.json frontend/config/model-roster.json docs/model-roster.json docs/model-roster.csv tests/model-registry-architecture.test.ts
git commit -m "refactor: derive engine model policy from registry"
```

---

### Task 5: Replace internal and public alias tables with registry facades

**Files:**
- Modify: `frontend/src/lib/engine-alias.ts`
- Modify: `frontend/src/config/falEngines.ts`
- Modify: `frontend/src/lib/model-slugs.ts`
- Delete: `frontend/config/model-slugs.json`
- Extend: `tests/model-registry-parity.test.ts`

**Interfaces:**
- Consumes: runtime selectors from Task 3 plus provider aliases derived from engine adapters.
- Produces: stable `normalizeEngineId`, `canonicalizeFalModelSlug`, `getFalEngineBySlug`, `MODEL_SLUGS`, `getCanonicalSlug`, and `getEngineIdFromSlug` behavior without authored alias maps.

- [ ] **Step 1: Add facade parity tests for all frozen aliases and slug directions**

```ts
import { normalizeEngineId } from '../frontend/src/lib/engine-alias.ts';
import { canonicalizeFalModelSlug, getFalEngineBySlug } from '../frontend/src/config/falEngines.ts';
import { getCanonicalSlug, getEngineIdFromSlug } from '../frontend/src/lib/model-slugs.ts';

test('legacy facades resolve the frozen registry compatibility matrix', () => {
  for (const row of baseline.internalAliases) {
    assert.equal(normalizeEngineId(row.alias), row.targetId, row.alias);
  }
  for (const row of baseline.publicSlugAliases) {
    assert.equal(canonicalizeFalModelSlug(row.alias), row.targetSlug, row.alias);
    assert.equal(getFalEngineBySlug(row.alias)?.modelSlug, row.targetSlug, row.alias);
  }
  for (const model of baseline.models) {
    assert.equal(getCanonicalSlug(model.id), model.slug);
    assert.equal(getEngineIdFromSlug(model.slug), model.id);
  }
});
```

- [ ] **Step 2: Run the test before deleting tables**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-parity.test.ts`

Expected: PASS; this establishes the facade behavior that must remain green during deletion.

- [ ] **Step 3: Rewrite `normalizeEngineId` as a registry-first facade**

```ts
import { resolveRuntimeEngineInput } from '../../config/model-runtime';
import { listFalEngines } from '@/config/falEngines';

const PROVIDER_INPUT_ALIASES = new Map<string, string>();
for (const entry of listFalEngines()) {
  for (const value of [entry.defaultFalModelId, ...entry.modes.map((mode) => mode.falModelId)]) {
    PROVIDER_INPUT_ALIASES.set(value.trim().toLowerCase(), entry.id);
  }
}

export function normalizeEngineId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return resolveRuntimeEngineInput(key)?.id ?? PROVIDER_INPUT_ALIASES.get(key) ?? raw;
}
```

Delete the 87-row `manualAliases` object.

- [ ] **Step 4: Rewrite public slug resolution without `LEGACY_MODEL_SLUG_ALIASES`**

```ts
import { resolveRuntimePublicSlug } from '../../config/model-runtime';

export function canonicalizeFalModelSlug(slug: string): string {
  return resolveRuntimePublicSlug(slug)?.slug ?? slug.trim().toLowerCase();
}

export function getFalEngineBySlug(slug: string): FalEngineEntry | undefined {
  const model = resolveRuntimePublicSlug(slug);
  if (model) return getFalEngineById(model.id);
  const normalized = slug.trim().toLowerCase();
  return FAL_ENGINE_REGISTRY.find((entry) =>
    getEngineAliases(entry).some((alias) => alias.trim().toLowerCase() === normalized)
  );
}
```

Delete `LEGACY_MODEL_SLUG_ALIASES`. Keep the provider-alias scan as a derived compatibility fallback because provider IDs remain owned by adapters and were historically accepted by `getFalEngineBySlug`; the scan contains no authored model policy.

- [ ] **Step 5: Turn `model-slugs.ts` into a data-free facade and delete its JSON map**

```ts
import { getRuntimeModelByCanonicalSlug, getRuntimeModelById, listRuntimeModels } from '../../config/model-runtime';

export type ModelSlugMap = Record<string, string>;
export const MODEL_SLUGS: ModelSlugMap = Object.fromEntries(listRuntimeModels().map((model) => [model.id, model.slug]));

export function getCanonicalSlug(engineId: string): string | undefined {
  return getRuntimeModelById(engineId)?.slug;
}

export function getEngineIdFromSlug(slug: string): string | undefined {
  return getRuntimeModelByCanonicalSlug(slug)?.id;
}
```

Delete `frontend/config/model-slugs.json` after `rg` confirms no other importer.

- [ ] **Step 6: Run all alias, route-request, and slug tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-parity.test.ts tests/seedance-prelaunch.test.ts tests/workspace-hydration.test.ts tests/examples-route-architecture.test.ts
```

Expected: PASS; the 87 internal aliases and 45 public slug aliases match the fixture.

- [ ] **Step 7: Commit alias consolidation**

```bash
git add frontend/src/lib/engine-alias.ts frontend/src/config/falEngines.ts frontend/src/lib/model-slugs.ts frontend/config/model-slugs.json tests/model-registry-parity.test.ts
git commit -m "refactor: centralize model aliases in registry"
```

---

### Task 6: Remove legacy publication lists and derive family/roster views

**Files:**
- Modify: `frontend/config/model-publication.ts`
- Modify: `frontend/config/model-families.ts`
- Modify: `frontend/lib/model-families.ts`
- Modify: `frontend/src/lib/model-roster.ts`
- Modify: `scripts/generate-model-roster.mjs`
- Extend: `tests/model-registry-parity.test.ts`
- Run existing: `tests/examples-route-architecture.test.ts`
- Run existing: `tests/pricing-model-links.test.ts`
- Run existing: `tests/models-catalog-architecture.test.ts`

**Interfaces:**
- Consumes: `RuntimeModelEntry.publication` and compatibility `ModelPublicationSurfaces`.
- Produces: model-publication and family modules containing presentation rules and derived views only.

- [ ] **Step 1: Add publication and family parity assertions**

```ts
import { MODEL_FAMILIES, getModelFamilyExamplesPageConfig } from '../frontend/config/model-families.ts';

test('family model membership and current variants remain identical to baseline', () => {
  for (const expected of baseline.familyDefinitions) {
    const actual = MODEL_FAMILIES.find((family) => family.id === expected.id);
    assert.ok(actual, expected.id);
    assert.equal(actual.defaultModelSlug, expected.defaultModelSlug);
    assert.deepEqual(actual.routeAliases, expected.routeAliases);
    assert.deepEqual(
      getModelFamilyExamplesPageConfig(expected.id)?.publishedModelSlugs,
      expected.examplesPage?.publishedModelSlugs ?? []
    );
    assert.deepEqual(
      getModelFamilyExamplesPageConfig(expected.id)?.currentModelSlugs,
      expected.examplesPage?.currentModelSlugs?.length
        ? expected.examplesPage.currentModelSlugs
        : expected.examplesPage?.publishedModelSlugs ?? []
    );
  }
});
```

- [ ] **Step 2: Run parity before removing legacy data**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-parity.test.ts tests/examples-route-architecture.test.ts`

Expected: PASS before the refactor.

- [ ] **Step 3: Reduce `model-publication.ts` to compatibility types and family-page normalization**

Keep only:

```ts
export type ModelPublicationStage = 'hidden' | 'public_noindex' | 'indexed';
export type ModelPagePublicationConfig = { indexable: boolean; includeInSitemap: boolean };
export type ExamplesPublicationConfig = { includeInFamilyResolver: boolean; includeInFamilyCopy: boolean };
export type ComparePublicationConfig = { suggestOpponents: string[]; publishedPairs: string[]; includeInHub: boolean };
export type AppPublicationConfig = { enabled: boolean; discoveryRank?: number; variantGroup?: string; variantLabel?: string };
export type PricingPublicationConfig = { includeInEstimator: boolean; featuredScenario?: string };
export type ModelPublicationSurfaces = {
  modelPage: ModelPagePublicationConfig;
  examples: ExamplesPublicationConfig;
  compare: ComparePublicationConfig;
  app: AppPublicationConfig;
  pricing: PricingPublicationConfig;
};
export type ModelFamilyExamplesPageConfig = {
  stage: ModelPublicationStage;
  showInNav: boolean;
  publishedModelSlugs: string[];
  currentModelSlugs: string[];
};
```

Retain `getDefaultFamilyExamplesPageConfig` and `normalizeFamilyExamplesPageConfig`. Delete every `LEGACY_*` collection, `buildDefaultModelPublicationSurfaces`, `mergeModelPublicationSurfaces`, `PartialModelPublicationSurfaces`, and `isGrandfatheredDefaultSurfaceModel` after `rg` reports no consumers.

- [ ] **Step 4: Derive family model fields from runtime entries**

Keep authored family-route `routeAliases`, `aliases`, `prefixes`, `contains`, labels, and navigation copy because they resolve an examples family rather than a product model. Replace authored `defaultModelSlug`, `publishedModelSlugs`, and `currentModelSlugs` with `defaultModelId` and registry projections:

```ts
import { getRuntimeModelById, listRuntimeModels } from './model-runtime';

type ModelFamilySource = Omit<ModelFamilyDefinition, 'defaultModelSlug' | 'examplesPage'> & {
  defaultModelId?: string;
  examplesPage?: Pick<ModelFamilyExamplesPageConfig, 'stage' | 'showInNav'>;
};

const FAMILY_MODELS = listRuntimeModels();

function materializeFamily(source: ModelFamilySource): ModelFamilyDefinition {
  const members = FAMILY_MODELS
    .filter((model) => model.family === source.id)
    .sort((left, right) =>
      (left.publication.examples.familyRank ?? Number.MAX_SAFE_INTEGER) -
      (right.publication.examples.familyRank ?? Number.MAX_SAFE_INTEGER)
    );
  const defaultModel = source.defaultModelId ? getRuntimeModelById(source.defaultModelId) : null;
  const published = members.filter((model) => model.publication.examples.published).map((model) => model.slug);
  const current = members.filter((model) => model.publication.examples.current).map((model) => model.slug);
  const { defaultModelId, ...presentation } = source;
  return {
    ...presentation,
    defaultModelSlug: defaultModel?.slug,
    examplesPage: {
      stage: source.examplesPage?.stage ?? 'hidden',
      showInNav: source.examplesPage?.showInNav ?? false,
      publishedModelSlugs: published,
      currentModelSlugs: current.length ? current : published,
    },
  };
}

export type ModelFamilyId = (typeof MODEL_FAMILY_SOURCES)[number]['id'];
export const MODEL_FAMILIES: readonly ModelFamilyDefinition[] = MODEL_FAMILY_SOURCES.map(materializeFamily);
```

Rename the existing `export const MODEL_FAMILIES = [` declaration to `const MODEL_FAMILY_SOURCES = [` and keep all ten existing family presentation objects. In those objects, apply the exact default ID substitutions below and delete only `examplesPage.publishedModelSlugs` and `examplesPage.currentModelSlugs`; keep every label, navigation label, brand, route alias, family alias, prefix, containment rule, stage, and navigation boolean unchanged.

Use these exact default ID substitutions:

```ts
{
  sora: 'sora-2-pro',
  kling: 'kling-o3-pro',
  veo: 'veo-3-1',
  luma: 'luma-ray-3-2',
  wan: 'wan-2-6',
  seedance: 'seedance-2-0',
  'happy-horse': 'happy-horse-1-1',
  ltx: 'ltx-2-3',
  pika: 'pika-text-to-video',
  hailuo: 'minimax-hailuo-02-text',
}
```

Family-level `routeAliases`, `aliases`, `prefixes`, and `contains` remain because they resolve a family route, not a product model. `familyRank` is registry-owned publication order and preserves the existing published/current model ordering without another model list.

- [ ] **Step 5: Make model roster identity a derived projection**

In `model-roster.ts`, materialize each generated business row against the runtime registry:

```ts
import { getRuntimeModelById, toLegacyModelSurfaces } from '../../config/model-runtime';

const rosterEntries = (modelRoster as ModelRosterEntry[]).map((entry) => {
  const model = getRuntimeModelById(entry.engineId);
  if (!model) throw new Error(`Model roster references missing registry id "${entry.engineId}"`);
  return {
    ...entry,
    modelSlug: model.slug,
    family: model.family ?? undefined,
    surfaces: { modelPage: toLegacyModelSurfaces(model).modelPage },
  };
});
```

In `generate-model-roster.mjs`, load `model-registry.json`, build `registryById`, and replace the identity portion of `computeRosterEntry` with:

```js
function computeRosterEntry(entry, registryById) {
  const engineId = typeof entry.engineId === 'string' ? entry.engineId.trim() : '';
  const model = registryById.get(engineId.toLowerCase());
  if (!model) throw new Error(`Engine "${engineId}" is missing from model-registry.json.`);
  const marketingName = typeof entry.marketingName === 'string' ? entry.marketingName.trim() : '';
  const brandId = typeof entry.brandId === 'string' ? entry.brandId.trim() : '';
  const logoPolicy = typeof entry.logoPolicy === 'string' ? entry.logoPolicy.trim() : '';
  if (!marketingName) throw new Error(`Engine "${engineId}" is missing marketingName.`);
  if (!brandId) throw new Error(`Engine "${engineId}" is missing brandId.`);
  if (!logoPolicy) throw new Error(`Engine "${engineId}" is missing logoPolicy.`);
  return {
    engineId,
    marketingName,
    brandId,
    modelSlug: model.slug,
    family: model.family ?? undefined,
    versionLabel: normalizeVersionLabel(entry),
    availability: normalizeAvailability(entry.availability, engineId),
    logoPolicy,
    surfaces: {
      modelPage: {
        indexable: model.publication.model.indexable,
        includeInSitemap: model.publication.sitemap.published,
      },
    },
  };
}
```

Load `model-registry.json` beside the engine catalog, create `new Map(registry.models.map((model) => [model.id.toLowerCase(), model]))`, and pass that map to every `computeRosterEntry` call. Marketing name, brand, version, availability, and logo policy remain sourced from the engine catalog.

Replace the public-catalog filter with:

```js
const publicCatalog = catalog.filter((entry) => {
  const model = registryById.get(String(entry.engineId).trim().toLowerCase());
  return model?.publication.model.published === true;
});
```

- [ ] **Step 6: Run publication, family, pricing-link, app, and roster parity**

Run:

```bash
pnpm model:generate:write
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-parity.test.ts tests/examples-route-architecture.test.ts tests/pricing-model-links.test.ts tests/models-catalog-architecture.test.ts tests/public-engines.test.ts
pnpm model:check
```

Expected: PASS; generated roster output is semantically unchanged.

- [ ] **Step 7: Commit publication and family consolidation**

```bash
git add frontend/config/model-publication.ts frontend/config/model-families.ts frontend/lib/model-families.ts frontend/src/lib/model-roster.ts scripts/generate-model-roster.mjs frontend/config/model-roster.json docs/model-roster.json docs/model-roster.csv tests/model-registry-parity.test.ts
git commit -m "refactor: derive model publication views from registry"
```

---

### Task 7: Enforce repository, localized-content, comparison, and SEO invariants

**Files:**
- Modify: `frontend/config/model-registry-validation.ts`
- Modify: `scripts/validate-model-registry.ts`
- Extend: `tests/model-registry-validation.test.ts`
- Extend: `tests/model-registry-parity.test.ts`
- Run existing SEO/sitemap/model-page contracts listed below.

**Interfaces:**
- Consumes: validated document plus repository root.
- Produces: `validateModelRegistryRepository(document: ModelRegistryDocument, root: string): void`.

- [ ] **Step 1: Write failing repository-validation tests**

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateModelRegistryRepository } from '../frontend/config/model-registry-validation.ts';

test('published model pages require localized content in en, fr, and es', () => {
  const root = mkdtempSync(join(tmpdir(), 'model-registry-'));
  const source = validateModelRegistryDocument(valid);
  const published = structuredClone(source.models.find((model) => model.publication.model.published)!);
  published.publication.compare.suggestedOpponentIds = [];
  published.publication.compare.publishedPairIds = [];
  const document = { schemaVersion: 1 as const, models: [published], tombstones: [] };
  const catalogDirectory = join(root, 'frontend/config');
  mkdirSync(catalogDirectory, { recursive: true });
  writeFileSync(
    join(catalogDirectory, 'engine-catalog.json'),
    JSON.stringify([{ engineId: published.id }])
  );
  for (const locale of ['en', 'fr'] as const) {
    const directory = join(root, 'content/models', locale);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `${published.slug}.json`), '{}');
  }
  assert.throws(() => validateModelRegistryRepository(document, root), /missing es content/i);
});
```

- [ ] **Step 2: Run the test and verify the repository validator is missing**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-validation.test.ts`

Expected: FAIL because `validateModelRegistryRepository` is not exported.

- [ ] **Step 3: Implement deterministic repository checks**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function validateModelRegistryRepository(document: ModelRegistryDocument, root: string): void {
  const ids = new Set(document.models.map((model) => model.id.toLowerCase()));
  const catalog = JSON.parse(readFileSync(join(root, 'frontend/config/engine-catalog.json'), 'utf8')) as Array<{
    engineId: string;
  }>;
  const catalogIds = new Set(catalog.map((entry) => entry.engineId.toLowerCase()));
  for (const entry of catalog) {
    if (!ids.has(entry.engineId.toLowerCase())) fail(`engine catalog references missing registry id "${entry.engineId}"`);
  }
  for (const model of document.models) {
    if (!catalogIds.has(model.id.toLowerCase())) fail(`registry model is missing from engine catalog "${model.id}"`);
    if (!model.publication.model.published) continue;
    for (const locale of ['en', 'fr', 'es'] as const) {
      const contentPath = join(root, 'content/models', locale, `${model.slug}.json`);
      if (!existsSync(contentPath)) fail(`missing ${locale} content for published model "${model.slug}"`);
    }
    if (model.publication.sitemap.published && !model.publication.model.indexable) {
      fail(`sitemap model must be indexable "${model.slug}"`);
    }
    for (const opponentId of model.publication.compare.suggestedOpponentIds) {
      const opponent = document.models.find((candidate) => candidate.id.toLowerCase() === opponentId.toLowerCase());
      if (!opponent?.publication.compare.published) {
        fail(`comparison opponent "${opponentId}" is not published for "${model.id}"`);
      }
    }
  }
}
```

Update `scripts/validate-model-registry.ts`:

```ts
import { resolve } from 'node:path';
import {
  validateModelRegistryDocument,
  validateModelRegistryRepository,
} from '../frontend/config/model-registry-validation.ts';

const validated = validateModelRegistryDocument(registry);
validateModelRegistryRepository(validated, resolve('.'));
console.log(`[model-registry] valid (${validated.models.length} models, ${validated.tombstones.length} tombstones)`);
```

- [ ] **Step 4: Lock canonical path and surface parity directly from the baseline**

Add assertions that for every published baseline model:

```ts
import { buildLocalizedModelPath } from '../frontend/config/model-registry.ts';

for (const model of listRuntimeModels().filter((entry) => entry.publication.model.published)) {
  assert.equal(buildLocalizedModelPath('en', model.slug), `/models/${model.slug}`);
  assert.equal(buildLocalizedModelPath('fr', model.slug), `/fr/modeles/${model.slug}`);
  assert.equal(buildLocalizedModelPath('es', model.slug), `/es/modelos/${model.slug}`);
}
```

- [ ] **Step 5: Run the full focused SEO/public-surface matrix**

Run:

```bash
pnpm model:registry:check
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/model-page-static-architecture.test.ts tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-page-decision-data.test.ts tests/model-seo-signals.test.ts tests/hreflang-variants.test.ts tests/schema-sitemap-architecture.test.ts tests/video-pages-sitemap.test.ts tests/pricing-model-links.test.ts tests/compare-page-architecture.test.ts tests/examples-route-architecture.test.ts
```

Expected: PASS with zero failures and no missing localized content.

- [ ] **Step 6: Commit repository and SEO validation**

```bash
git add frontend/config/model-registry-validation.ts scripts/validate-model-registry.ts tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts
git commit -m "test: enforce model registry repository invariants"
```

---

### Task 8: Generate all historical model redirects from the registry

**Files:**
- Modify: `frontend/next.config.js`
- Modify: `frontend/lib/middleware/routing-marketing.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
- Create: `tests/model-registry-redirects.test.ts`
- Extend: `tests/marketing-locale-routing.test.ts`

**Interfaces:**
- Consumes: raw `model-registry.json` from `next.config.js` only.
- Produces: `45 × 3` alias redirects plus `2 × 3` tombstone redirects, all explicit 301 and single-hop.

- [ ] **Step 1: Write the failing generated-redirect contract**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import registry from '../frontend/config/model-registry.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js');
const baseline = JSON.parse(readFileSync('tests/fixtures/model-registry-baseline.json', 'utf8'));

const bases = {
  en: { prefix: '/models', index: '/models' },
  fr: { prefix: '/fr/modeles', index: '/fr/modeles' },
  es: { prefix: '/es/modelos', index: '/es/modelos' },
} as const;

test('next config projects every model alias and tombstone in all locales as one-hop 301', async () => {
  const redirects = await nextConfig.redirects();
  const bySource = new Map(redirects.map((rule: any) => [rule.source, rule]));
  const expectedSources = new Set<string>();

  for (const model of registry.models) {
    for (const alias of model.aliases.publicSlugs) {
      for (const route of Object.values(bases)) {
        const source = `${route.prefix}/${alias}`;
        expectedSources.add(source);
        assert.deepEqual(bySource.get(source), {
          source,
          destination: `${route.prefix}/${model.slug}`,
          statusCode: 301,
        });
      }
    }
  }
  for (const tombstone of registry.tombstones) {
    for (const route of Object.values(bases)) {
      const source = `${route.prefix}/${tombstone.slug}`;
      expectedSources.add(source);
      assert.deepEqual(bySource.get(source), {
        source,
        destination: route.index,
        statusCode: 301,
      });
    }
  }

  assert.equal(expectedSources.size, 141);
  for (const previous of baseline.modelRedirects) {
    const actual = bySource.get(previous.source);
    assert.ok(actual, `missing historical redirect ${previous.source}`);
    assert.equal(actual.destination, previous.destination, previous.source);
    assert.equal(actual.statusCode, 301, previous.source);
  }
  for (const source of expectedSources) {
    const destination = bySource.get(source).destination;
    assert.equal(expectedSources.has(destination), false, `redirect chain: ${source} -> ${destination}`);
  }
});
```

- [ ] **Step 2: Run the test and verify missing localized/generated routes fail**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-redirects.test.ts`

Expected: FAIL because current redirects are hand-authored, incomplete across locales, and mostly 308.

- [ ] **Step 3: Add the sole redirect projector to `next.config.js`**

At module top:

```js
const modelRegistry = require('./config/model-registry.json');
const MODEL_ROUTE_BASES = [
  { prefix: '/models', index: '/models' },
  { prefix: '/fr/modeles', index: '/fr/modeles' },
  { prefix: '/es/modelos', index: '/es/modelos' },
];

function buildModelRegistryRedirects() {
  const redirects = [];
  for (const model of modelRegistry.models) {
    for (const alias of model.aliases.publicSlugs) {
      for (const route of MODEL_ROUTE_BASES) {
        redirects.push({
          source: `${route.prefix}/${alias}`,
          destination: `${route.prefix}/${model.slug}`,
          statusCode: 301,
        });
      }
    }
  }
  for (const tombstone of modelRegistry.tombstones) {
    for (const route of MODEL_ROUTE_BASES) {
      redirects.push({
        source: `${route.prefix}/${tombstone.slug}`,
        destination: route.index,
        statusCode: 301,
      });
    }
  }
  return redirects;
}
```

Insert `...buildModelRegistryRedirects()` once in `redirects()` and delete every hand-authored redirect whose `source` starts with `/models/`, `/fr/modeles/`, or `/es/modelos/`. Keep `/modeles/:path*`, `/modelos/:path*`, examples, comparison, blog, legal, auth, and other non-model rules.

- [ ] **Step 4: Remove duplicate middleware and route-level model alias policy**

Delete these model-policy rows from `routing-marketing.ts`:

```text
/models/luma-dream-machine
/models/pika-image-to-video
/models/pika-image-video
/fr/models/pika-2-2
/fr/modeles/pika-2-2
/es/models/pika-2-2
/es/modelos/pika-2-2
```

Keep shorthand non-model paths such as `/pika`, `/pikavideo`, `/sora2`, and `/sora-2` in middleware because their source is not a model route.

Replace the two wrong-segment exact rules (`/fr/models/...` and `/es/models/...`) with one data-free locale normalizer backed by the runtime resolver:

```ts
import { resolveRuntimePublicSlug } from '@/config/model-runtime';

function resolveLocalizedEnglishModelSegment(
  req: NextRequest,
  normalizedPath: string,
  localePrefix: string
): NextResponse | null {
  if (localePrefix !== '/fr' && localePrefix !== '/es') return null;
  if (!normalizedPath.startsWith('/models/')) return null;
  const slug = normalizedPath.slice('/models/'.length);
  if (!slug || slug.includes('/')) return null;
  const model = resolveRuntimePublicSlug(slug);
  if (!model) return null;
  const localizedBase = localePrefix === '/fr' ? 'modeles' : 'modelos';
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = `${localePrefix}/${localizedBase}/${model.slug}`;
  return NextResponse.redirect(redirectUrl, 301);
}
```

Call it in `handleMarketingSlug` immediately after `normalizedPath` is computed and before exact redirect lookup. Because the cloned URL keeps `search`, `/fr/models/pika-2-2?utm_source=x` redirects once to `/fr/modeles/pika-text-to-video?utm_source=x`.

Delete the two hand-authored `veo-3-1-first-last` checks from the model page. Keep only the generic data-free canonical fallback:

```ts
if (slug !== engine.modelSlug) {
  permanentRedirect(`/${localizedModelsBase}/${engine.modelSlug}`.replace(/\/{2,}/g, '/'));
}
```

- [ ] **Step 5: Extend locale routing architecture assertions**

```ts
test('model-shaped compatibility redirects are not owned by marketing middleware', () => {
  const source = readFileSync('frontend/lib/middleware/routing-marketing.ts', 'utf8');
  assert.doesNotMatch(source, /['"]\/models\/(?:luma-dream-machine|pika-image-to-video)/);
  assert.doesNotMatch(source, /['"]\/(?:fr\/modeles|es\/modelos)\/pika-2-2/);
  assert.match(source, /resolveLocalizedEnglishModelSegment/);
  assert.match(source, /resolveRuntimePublicSlug/);
});
```

Add these imports and a local helper to `tests/marketing-locale-routing.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { handleMarketingSlug } from '../frontend/lib/middleware/routing-marketing.ts';

function resolveRedirectLocation(url: string): string | null {
  const request = new NextRequest(url);
  return handleMarketingSlug(request, request.nextUrl.pathname)?.headers.get('location') ?? null;
}
```

Then add behavioral assertions:

```ts
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
```

- [ ] **Step 6: Run redirect, locale, model-page, and Next-config tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-redirects.test.ts tests/marketing-locale-routing.test.ts tests/model-page-static-architecture.test.ts tests/middleware-architecture.test.ts
```

Expected: PASS; generated set size is exactly 141 and no destination is another generated source.

- [ ] **Step 7: Commit redirect consolidation**

```bash
git add frontend/next.config.js frontend/lib/middleware/routing-marketing.ts 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx' tests/model-registry-redirects.test.ts tests/marketing-locale-routing.test.ts
git commit -m "refactor: generate model redirects from registry"
```

---

### Task 9: Add permanent one-owner and client-boundary architecture guards

**Files:**
- Extend: `tests/model-registry-architecture.test.ts`

**Interfaces:**
- Consumes: final file layout from Tasks 2–8.
- Produces: a failing contract for any future parallel alias/publication/redirect table or client import of server/build registry code.

- [ ] **Step 1: Add failing architecture assertions**

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

test('legacy model policy tables cannot return outside the canonical registry', () => {
  const forbidden = [
    'LEGACY_MODEL_SLUG_ALIASES',
    'manualAliases',
    'LEGACY_SURFACELESS_MODEL_SLUGS',
    'LEGACY_COMPARE_INDEXED_ENGINE_SLUGS',
    'LEGACY_APP_DISCOVERY_PRIORITY',
    'LEGACY_COMPARE_SUGGESTED_OPPONENTS',
    'LEGACY_APP_VARIANTS',
    'GRANDFATHERED_DEFAULT_SURFACE_SLUGS',
  ];
  for (const path of [...walk('frontend'), ...walk('scripts')].filter((file) => /\.(?:ts|tsx|js|mjs)$/.test(file))) {
    const source = readFileSync(path, 'utf8');
    for (const name of forbidden) assert.doesNotMatch(source, new RegExp(`\\b${name}\\b`), path);
  }
});

test('browser-safe runtime facade cannot import full registry, validation, or redirects', () => {
  const source = readFileSync('frontend/config/model-runtime.ts', 'utf8');
  assert.doesNotMatch(source, /from ['"].*model-registry(?:\.json|['"])/);
  assert.doesNotMatch(source, /import\s+(?!type\b)[^;]*model-registry-validation/);
  assert.doesNotMatch(source, /next\.config|tombstones|buildModelRegistryRedirects/);
  assert.match(source, /import type \{ ModelRegistryEntry \}/);
});

test('generated runtime projection is checked and never hand-authored', () => {
  const rootPackage = readFileSync('package.json', 'utf8');
  const frontendPackage = readFileSync('frontend/package.json', 'utf8');
  assert.match(rootPackage, /model:registry:check/);
  assert.match(frontendPackage, /"prebuild":\s*"pnpm --dir \.\. model:registry:check"/);
});
```

- [ ] **Step 2: Run the guard and inspect every concrete owner violation**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-architecture.test.ts`

Expected: FAIL only if a legacy table or forbidden import remains.

- [ ] **Step 3: Verify the exact policy allowlist and remove no guard exceptions**

Allowed policy-bearing files are exactly:

```text
frontend/config/model-registry.json
tests/fixtures/model-registry-baseline.json
```

Allowed derived files are exactly:

```text
frontend/config/model-runtime.json
frontend/config/engine-catalog.json
frontend/config/model-roster.json
docs/model-roster.json
docs/model-roster.csv
```

Family presentation aliases, provider IDs in adapters, localized content, pricing formulas, and test input/output rows are not model registry policy and remain outside this scan by name and semantics.

Run:

```bash
rg -n "LEGACY_MODEL_SLUG_ALIASES|manualAliases|LEGACY_SURFACELESS_MODEL_SLUGS|LEGACY_COMPARE_INDEXED_ENGINE_SLUGS|LEGACY_APP_DISCOVERY_PRIORITY|LEGACY_COMPARE_SUGGESTED_OPPONENTS|LEGACY_APP_VARIANTS|GRANDFATHERED_DEFAULT_SURFACE_SLUGS" frontend scripts
```

Expected: no output. Tasks 4–6 remove every known legacy owner; do not add an allowlist entry to make this command pass.

- [ ] **Step 4: Run architecture, exposure, and TypeScript checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-architecture.test.ts tests/fal-engine-catalog-architecture.test.ts
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: PASS with zero errors.

- [ ] **Step 5: Commit permanent guardrails**

```bash
git add tests/model-registry-architecture.test.ts
git add -u frontend
git commit -m "test: prevent parallel model registries"
```

---

### Task 10: Update model tooling, engineering guides, and agent instructions

**Files:**
- Create: `docs/engineering/model-registry.md`
- Modify: `AGENTS.md`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/AGENTS.md`
- Modify: `docs/engineering/project-structure.md`
- Modify: `docs/engineering/llm-working-guide.md`
- Modify: `scripts/model-setup.mjs`
- Modify: `scripts/generate-model-roster.mjs` if its help text still identifies the engine catalog as the identity owner.
- Extend: `tests/model-registry-architecture.test.ts`

**Interfaces:**
- Consumes: final registry commands and ownership boundaries.
- Produces: one documented workflow for adding, renaming, retiring, and publishing a model.

- [ ] **Step 1: Add a failing documentation contract**

```ts
test('engineering and agent guides point model policy changes to the canonical registry', () => {
  for (const path of [
    'AGENTS.md',
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/AGENTS.md',
    'docs/engineering/project-structure.md',
    'docs/engineering/llm-working-guide.md',
    'docs/engineering/model-registry.md',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /frontend\/config\/model-registry\.json/, path);
    assert.match(source, /pnpm model:registry:check/, path);
  }
});
```

- [ ] **Step 2: Run the documentation contract and verify missing guidance**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-architecture.test.ts`

Expected: FAIL for the guide files not yet updated.

- [ ] **Step 3: Write the operating guide with exact workflows**

`docs/engineering/model-registry.md` must contain these commands and rules:

```markdown
# Model Registry Guide

`frontend/config/model-registry.json` is the only authored source for model identity, aliases, family, category, publication, replacement, and model-shaped tombstones.

## Add a model

1. Add the provider/execution definition with its canonical `id` only.
2. Add one registry entry with canonical slug, family, category, aliases, and explicit publication fields.
3. Add `content/models/{en,fr,es}/{slug}.json` before publishing the model page.
4. Run `pnpm model:registry:generate`, `pnpm engine:catalog`, and `pnpm model:generate:write`.
5. Run `pnpm model:registry:check` and the focused model/page tests.

## Rename a public slug

Keep the old slug in `aliases.publicSlugs`, change `slug`, and verify the generated EN/FR/ES 301 matrix. Never replace an old slug with a hand-authored redirect.

## Retire a model

Keep a canonical replacement ID in `replacement` when another model is the destination. Use a registry tombstone with `destination: "models-index"` only when the final destination is the localized catalogue.

## Change publication

Change only the registry publication object. Do not add surface overrides to engine modules, family configs, pricing code, sitemap code, middleware, or route files.

## Provider identifiers

Provider IDs stay in provider adapters and mode definitions. Do not add them to registry aliases merely to make provider routing work.
```

- [ ] **Step 4: Update agent and project-structure guides**

Add the same one-owner rule, commands, and nearest-guide link to the four existing guides. State that `model-runtime.json`, engine catalog, and roster files are generated projections and must not be edited directly.

- [ ] **Step 5: Update model setup output**

Replace the instruction that asks contributors to insert family/slug/publication blocks manually with output that prints a complete registry-entry skeleton and these commands:

```text
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
pnpm model:registry:check
```

Add `--category <video|image|audio|multimodal>` to `parseArgs`, default it to `video`, and reject any other value. The skeleton uses the actual `options.engineId ?? options.slug`, `options.slug`, `options.family`, and `options.category`; it emits empty alias arrays and all publication booleans explicitly.

```js
const VALID_MODEL_CATEGORIES = new Set(['video', 'image', 'audio', 'multimodal']);

// In the initial options object:
category: 'video',

// In the argument switch:
case '--category':
  options.category = next;
  index += 1;
  break;

// After required argument validation:
if (!VALID_MODEL_CATEGORIES.has(options.category)) {
  throw new Error('--category must be video, image, audio, or multimodal.');
}
```

Build the printed block with this shape, substituting the existing parsed CLI variables `engineId`, `modelSlug`, `family`, and `category`:

```js
const registryEntry = {
  id: options.engineId ?? options.slug,
  slug: options.slug,
  family: options.family || null,
  category: options.category ?? 'video',
  aliases: { internal: [], publicSlugs: [] },
  publication: {
    model: { published: false, indexable: false },
    examples: { published: false, includeInFamilyCopy: false, current: false },
    compare: { published: false, indexed: false, suggestedOpponentIds: [], publishedPairIds: [] },
    app: { published: false },
    pricing: { published: false },
    sitemap: { published: false },
  },
  replacement: null,
};
console.log(JSON.stringify(registryEntry, null, 2));
```

Change `buildFamilyStub` to emit `defaultModelId: options.engineId ?? options.slug` and an `examplesPage` containing only `stage` and `showInNav`. It must not emit `defaultModelSlug`, `publishedModelSlugs`, or `currentModelSlugs`.

- [ ] **Step 6: Run documentation, setup, and registry checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-architecture.test.ts
pnpm model:registry:check
git diff --check
```

Expected: PASS with zero whitespace errors.

- [ ] **Step 7: Commit documentation and tooling**

```bash
git add AGENTS.md 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/AGENTS.md' docs/engineering/model-registry.md docs/engineering/project-structure.md docs/engineering/llm-working-guide.md scripts/model-setup.mjs scripts/generate-model-roster.mjs tests/model-registry-architecture.test.ts
git commit -m "docs: establish canonical model registry workflow"
```

---

### Task 11: Run full verification and browser smoke matrix

**Files:**
- Verify only; do not edit generated SEO matrices unless a real registry change requires it.

**Interfaces:**
- Consumes: completed Tasks 1–10.
- Produces: merge evidence for tests, lint, types, build, redirects, locales, SEO, and a clean worktree.

- [ ] **Step 1: Run the focused registry suite from a clean process**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-baseline.test.ts tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/model-registry-redirects.test.ts tests/model-registry-architecture.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run the complete repository validation suite**

Run: `pnpm test:validate`

Expected: all tests PASS. If the suite regenerates the dated comparison-indexation matrices without a requested content change, reverse only those generated diffs before continuing.

- [ ] **Step 3: Run lint, exposure, TypeScript, model, and diff checks**

Run:

```bash
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm model:registry:check
pnpm model:check
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Run a production build**

Run: `pnpm --prefix frontend run build`

Expected: prebuild registry validation passes, Next build completes, and `next-sitemap` completes.

- [ ] **Step 5: Start the production server and verify redirects over HTTP**

Run: `pnpm --prefix frontend run start`

In another shell, run:

```bash
curl -sSI 'http://localhost:3000/models/openai-sora-2?utm_source=registry-smoke'
curl -sSI 'http://localhost:3000/fr/modeles/openai-sora-2?utm_source=registry-smoke'
curl -sSI 'http://localhost:3000/es/modelos/openai-sora-2?utm_source=registry-smoke'
curl -sSI 'http://localhost:3000/models/hunyuan-video'
curl -sSI 'http://localhost:3000/fr/modeles/hunyuan-video'
curl -sSI 'http://localhost:3000/es/modelos/hunyuan-video'
curl -sSI 'http://localhost:3000/fr/models/pika-2-2?utm_source=registry-smoke'
curl -sSI 'http://localhost:3000/es/models/pika-2-2?utm_source=registry-smoke'
```

Expected: every response is 301; aliases preserve locale and query string; tombstones target the localized model index; following one redirect returns 200 with no second redirect.

- [ ] **Step 6: Smoke canonical public surfaces in Chrome**

Use the Chrome-control skill at execution time and verify:

```text
/models/veo-3-1
/fr/modeles/veo-3-1
/es/modelos/veo-3-1
/examples/veo
/fr/galerie/veo
/es/galeria/veo
/ai-video-engines/seedance-2-0-vs-veo-3-1
/fr/comparatif/seedance-2-0-vs-veo-3-1
/es/comparativa/seedance-2-0-vs-veo-3-1
/pricing
/fr/tarifs
/es/precios
/sitemap.xml
```

Expected: each page loads in the requested locale; canonical and hreflang point to the expected localized URLs; model, examples, comparison, app link, pricing link, and sitemap inclusion match the baseline.

- [ ] **Step 7: Verify final history and worktree state**

Run:

```bash
git status --short --branch
git log --oneline --decorate origin/main..HEAD
```

Expected: no uncommitted files and a reviewable sequence of small registry commits after the two design commits. Do not create an empty verification commit.
