import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

function requireOptionalNonBlankString(value: unknown, path: string): asserts value is string | undefined {
  if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
    fail(`${path} must be a non-blank string when provided`);
  }
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
    requireOptionalNonBlankString(
      model.publication?.app?.variantGroup,
      `${model.id}.publication.app.variantGroup`
    );
    requireOptionalNonBlankString(
      model.publication?.app?.variantLabel,
      `${model.id}.publication.app.variantLabel`
    );
    requireBoolean(model.publication?.pricing?.published, `${model.id}.publication.pricing.published`);
    requireOptionalNonBlankString(
      model.publication?.pricing?.featuredScenario,
      `${model.id}.publication.pricing.featuredScenario`
    );
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

  for (const start of document.models.filter((model) => model.replacement)) {
    const visited = new Set<string>([normalized(start.id)]);
    let cursor = start;
    let edgeCount = 0;
    while (cursor.replacement) {
      edgeCount += 1;
      const targetKey = normalized(cursor.replacement);
      const target = byId.get(targetKey);
      if (!target) fail(`missing model reference "${cursor.replacement}" from ${cursor.id}.replacement`);
      if (visited.has(targetKey)) fail(`replacement cycle starts at "${start.id}"`);
      visited.add(targetKey);
      cursor = target;
    }
    if (edgeCount > 1) fail(`replacement chain starts at "${start.id}"`);
  }

  for (const model of document.models) {
    for (const target of model.publication.compare.suggestedOpponentIds) {
      requireId(model.id, target, 'suggestedOpponentIds');
    }
    for (const target of model.publication.compare.publishedPairIds) {
      requireId(model.id, target, 'publishedPairIds');
    }
    if (model.replacement) {
      requireId(model.id, model.replacement, 'replacement');
      if (normalized(model.replacement) === normalized(model.id)) fail(`replacement self-reference at "${model.id}"`);
      const publication = model.publication;
      const fullyRetired =
        !publication.model.published &&
        !publication.model.indexable &&
        !publication.examples.published &&
        !publication.examples.includeInFamilyCopy &&
        !publication.examples.current &&
        publication.examples.familyRank === undefined &&
        !publication.compare.published &&
        !publication.compare.indexed &&
        publication.compare.suggestedOpponentIds.length === 0 &&
        publication.compare.publishedPairIds.length === 0 &&
        !publication.app.published &&
        publication.app.discoveryRank === undefined &&
        publication.app.variantGroup === undefined &&
        publication.app.variantLabel === undefined &&
        !publication.pricing.published &&
        publication.pricing.featuredScenario === undefined &&
        !publication.sitemap.published;
      if (!fullyRetired) fail(`replacement model "${model.id}" must be retired on every publication surface`);
      const replacement = byId.get(normalized(model.replacement))!;
      if (!replacement.publication.model.published) {
        fail(`replacement target "${replacement.id}" must publish a model page`);
      }
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

export function validateModelRegistryRepository(document: ModelRegistryDocument, root: string): void {
  const modelsById = new Map(document.models.map((model) => [normalized(model.id), model]));
  const catalog = JSON.parse(
    readFileSync(join(root, 'frontend/config/engine-catalog.json'), 'utf8')
  ) as Array<{ engineId: string }>;
  const catalogIds = new Set(catalog.map((entry) => normalized(entry.engineId)));

  for (const entry of catalog) {
    if (!modelsById.has(normalized(entry.engineId))) {
      fail(`engine catalog references missing registry id "${entry.engineId}"`);
    }
  }

  for (const model of document.models) {
    if (!catalogIds.has(normalized(model.id))) {
      fail(`registry model is missing from engine catalog "${model.id}"`);
    }

    if (model.publication.model.published) {
      for (const locale of ['en', 'fr', 'es'] as const) {
        const contentPath = join(root, 'content/models', locale, `${model.slug}.json`);
        if (!existsSync(contentPath)) fail(`missing ${locale} content for published model "${model.slug}"`);
      }
    }

    if (model.publication.sitemap.published && !model.publication.model.indexable) {
      fail(`sitemap model must be indexable "${model.slug}"`);
    }

    const opponentIds = [
      ...model.publication.compare.suggestedOpponentIds,
      ...model.publication.compare.publishedPairIds,
    ];
    for (const opponentId of opponentIds) {
      const opponent = modelsById.get(normalized(opponentId));
      if (!opponent?.publication.compare.published) {
        fail(`comparison opponent "${opponentId}" is not published for "${model.id}"`);
      }
    }
  }
}
