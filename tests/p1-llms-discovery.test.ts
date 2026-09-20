import assert from 'node:assert/strict';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import mcpPublication from '../frontend/config/mcp-publication.json' with { type: 'json' };
import { buildModelFamilyDefinitions } from '../frontend/config/model-families.ts';
import type { ModelLaunchReadinessEntry } from '../frontend/config/model-launch-readiness-schema.ts';
import { listRuntimeModels, type RuntimeModelEntry } from '../frontend/config/model-runtime.ts';
import {
  buildLlmsModelDiscoveryProjection,
  buildLlmsText,
  P1_PRIMARY_COMPARISONS,
} from '../frontend/lib/seo/llms-text.ts';

const P1_IDS = [
  'gemini-omni-flash',
  'kling-3-turbo-standard',
  'kling-3-turbo-pro',
  'minimax-h3-max',
] as const;

const PAIRS_BY_ID: Record<string, string[]> = {
  'gemini-omni-flash': ['kling-3-turbo-pro'],
  'kling-3-turbo-standard': ['kling-3-turbo-pro'],
  'kling-3-turbo-pro': ['kling-3-turbo-standard', 'kling-3-pro', 'gemini-omni-flash'],
  'minimax-h3-max': ['minimax-h3'],
};

function publishedP1Models(): RuntimeModelEntry[] {
  return listRuntimeModels().map((model) => {
    if (!P1_IDS.includes(model.id as (typeof P1_IDS)[number])) return structuredClone(model);
    const cloned = structuredClone(model);
    return {
      ...cloned,
      publication: {
        ...cloned.publication,
        model: { published: true, indexable: true },
        examples: {
          ...cloned.publication.examples,
          published: true,
          includeInFamilyCopy: true,
          current: true,
        },
        compare: {
          published: true,
          indexed: true,
          suggestedOpponentIds: PAIRS_BY_ID[model.id] ?? [],
          publishedPairIds: PAIRS_BY_ID[model.id] ?? [],
        },
        app: { ...cloned.publication.app, published: true },
        pricing: { ...cloned.publication.pricing, published: true },
        sitemap: { published: true },
      },
    };
  });
}

const readiness: ModelLaunchReadinessEntry[] = [
  { waveId: 'p1', modelId: 'gemini-omni-flash', familyId: 'veo', acceptedAssetCount: 2, familyPlaylistSlug: 'family-veo', modelPlaylistSlug: 'examples-gemini-omni-flash' },
  { waveId: 'p1', modelId: 'kling-3-turbo-standard', familyId: 'kling', acceptedAssetCount: 2, familyPlaylistSlug: 'family-kling', modelPlaylistSlug: 'examples-kling-3-turbo-standard' },
  { waveId: 'p1', modelId: 'kling-3-turbo-pro', familyId: 'kling', acceptedAssetCount: 2, familyPlaylistSlug: 'family-kling', modelPlaylistSlug: 'examples-kling-3-turbo-pro' },
  { waveId: 'p1', modelId: 'minimax-h3-max', familyId: 'hailuo', acceptedAssetCount: 2, familyPlaylistSlug: 'family-hailuo', modelPlaylistSlug: 'examples-minimax-h3-max' },
];

test('P1 LLM discovery exposes current names, canonical URLs, families, and scoreboards', () => {
  const models = publishedP1Models();
  const projection = buildLlmsModelDiscoveryProjection({
    models,
    catalog: engineCatalog,
    families: buildModelFamilyDefinitions(models, readiness),
    candidateModelIds: P1_IDS,
    primaryComparisons: P1_PRIMARY_COMPARISONS,
    isLocalizedScoreboardComplete: () => true,
  });
  const text = buildLlmsText(mcpPublication, projection);
  const expectedLabels = {
    'gemini-omni-flash': 'Gemini Omni Flash 1.1',
    'kling-3-turbo-standard': 'Kling 3.0 Turbo Standard',
    'kling-3-turbo-pro': 'Kling 3.0 Turbo Pro',
    'minimax-h3-max': 'MiniMax H3 Max',
  } as const;

  assert.deepEqual(projection.currentModels.map(({ id }) => id).sort(), [...P1_IDS].sort());
  for (const id of P1_IDS) {
    const model = projection.currentModels.find((candidate) => candidate.id === id);
    assert.equal(model?.label, expectedLabels[id]);
    assert.equal(model?.href, `https://maxvideoai.com/models/${id}`);
    assert.equal(text.split(`](https://maxvideoai.com/models/${id})`).length - 1, 1, id);
  }
  assert.deepEqual(projection.families.map(({ id }) => id).sort(), ['hailuo', 'kling', 'veo']);
  assert.deepEqual(
    projection.primaryComparisons.map(({ slug }) => slug).sort(),
    P1_PRIMARY_COMPARISONS.map(({ slug }) => slug).sort(),
  );
  assert.doesNotMatch(text, /gemini-omni-flash-1-1\)/);
  assert.doesNotMatch(text, /fal(?:\.ai)?/i);
});

test('published P1 identities remain present in default LLM discovery', () => {
  const projection = buildLlmsModelDiscoveryProjection();
  for (const id of ['kling-3-turbo-standard', 'kling-3-turbo-pro', 'minimax-h3-max']) {
    assert.equal(projection.currentModels.some((model) => model.id === id), true, id);
  }
});

test('default llms output includes priority models once and drops the stale Sora selection', () => {
  const text = buildLlmsText(mcpPublication);
  const projection = buildLlmsModelDiscoveryProjection();
  assert.deepEqual(projection.currentModels.slice(0, 3).map(({ id }) => id), [
    'minimax-h3', 'minimax-h3-max', 'seedance-2-5',
  ]);
  for (const id of ['minimax-h3', 'minimax-h3-max', 'seedance-2-5']) {
    assert.equal(text.split(`](https://maxvideoai.com/models/${id})`).length - 1, 1, id);
  }
  assert.doesNotMatch(text, /sora-2|Sora 2|## Engines \(key pages\)|## Current launch models/);
  assert.match(text, /available through its web application/);
  assert.match(text, /In addition to the web application.*remote MCP integration/);
  for (const slug of [
    'gemini-omni-flash-vs-veo-3-1',
    'seedance-2-0-vs-seedance-2-0-fast',
    'veo-3-1-fast-vs-veo-3-1-lite',
  ]) {
    assert.ok(text.includes(`](https://maxvideoai.com/ai-video-engines/${slug})`), slug);
  }
  const urls = [...text.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);
  assert.equal(new Set(urls).size, urls.length, 'source links must not be duplicated');
});

test('curated llms model links follow lifecycle, publication, canonical slug and label changes', () => {
  for (const state of ['legacy', 'retired', 'unpublished', 'noindex'] as const) {
    const models = structuredClone(listRuntimeModels()) as RuntimeModelEntry[];
    const model = models.find(({ id }) => id === 'seedance-2-5')!;
    if (state === 'unpublished') model.publication.model.published = false;
    else if (state === 'noindex') model.publication.model.indexable = false;
    else model.lifecycle = state;
    const projection = buildLlmsModelDiscoveryProjection({ models });
    assert.equal(projection.currentModels.some(({ id }) => id === model.id), false, state);
    const text = buildLlmsText(mcpPublication, projection);
    assert.equal(text.includes(`](https://maxvideoai.com/models/${model.slug})`), false, state);
    if (state !== 'legacy') {
      assert.equal(projection.primaryComparisons.some(({ slug }) => slug.includes(model.slug)), false, state);
    }
  }
  const models = structuredClone(listRuntimeModels()) as RuntimeModelEntry[];
  const model = models.find(({ id }) => id === 'minimax-h3')!;
  model.slug = 'renamed-h3';
  model.label = 'Updated H3 label';
  const text = buildLlmsText(mcpPublication, buildLlmsModelDiscoveryProjection({ models }));
  assert.match(text, /\[Updated H3 label\]\(https:\/\/maxvideoai.com\/models\/renamed-h3\)/);
  assert.equal(text.includes('](https://maxvideoai.com/models/minimax-h3)'), false);
});
