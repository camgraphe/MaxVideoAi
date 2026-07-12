'use strict';

const MODEL_ROUTE_BASES = [
  { prefix: '/models', index: '/models' },
  { prefix: '/fr/modeles', index: '/fr/modeles' },
  { prefix: '/es/modelos', index: '/es/modelos' },
];

function buildModelRegistryRedirects(modelRegistry) {
  const redirects = [];
  const sources = new Set();
  const modelsById = new Map(modelRegistry.models.map((model) => [model.id.toLowerCase(), model]));
  const add = (source, destination) => {
    if (sources.has(source)) throw new Error(`model-registry redirects: duplicate source "${source}"`);
    sources.add(source);
    redirects.push({ source, destination, statusCode: 301 });
  };

  for (const model of modelRegistry.models) {
    const replacement = model.replacement
      ? modelsById.get(model.replacement.trim().toLowerCase())
      : null;
    if (model.replacement && !replacement) {
      throw new Error(`model-registry redirects: missing replacement "${model.replacement}"`);
    }
    const sourceSlugs = model.replacement
      ? [model.slug, ...model.aliases.publicSlugs]
      : model.aliases.publicSlugs;
    const destinationSlug = replacement?.slug ?? model.slug;
    for (const sourceSlug of sourceSlugs) {
      for (const route of MODEL_ROUTE_BASES) {
        add(`${route.prefix}/${sourceSlug}`, `${route.prefix}/${destinationSlug}`);
      }
    }
  }
  for (const tombstone of modelRegistry.tombstones) {
    for (const route of MODEL_ROUTE_BASES) {
      add(`${route.prefix}/${tombstone.slug}`, route.index);
    }
  }
  return redirects;
}

module.exports = { buildModelRegistryRedirects };
