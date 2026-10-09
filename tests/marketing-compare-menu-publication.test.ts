import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listRuntimeModels,
  type RuntimeModelEntry,
} from '../frontend/config/model-runtime.ts';
import {
  buildMarketingCompareMenu,
  MARKETING_NAV_COMPARE,
} from '../frontend/config/navigation.ts';
import {
  buildPublishedComparisonSlugsFromModels,
  createPublishedComparisonSlugLookup,
} from '../frontend/lib/compare-hub/pairs.ts';

const EDITORIAL_COMPARISONS = [
  { slug: 'minimax-h3-vs-seedance-2-5', label: 'MiniMax H3 vs Seedance 2.5' },
  { slug: 'minimax-h3-vs-minimax-h3-max', label: 'MiniMax H3 vs H3 Max' },
  { slug: 'kling-3-pro-vs-seedance-2-5', label: 'Kling 3 Pro vs Seedance 2.5' },
  { slug: 'seedance-2-5-vs-wan-3', label: 'Seedance 2.5 vs Wan 3' },
  { slug: 'ltx-2-5-fast-vs-ltx-2-5-pro', label: 'LTX 2.5 Fast vs Pro' },
  { slug: 'wan-3-vs-wan-3-prime', label: 'Wan 3 vs Wan 3 Prime' },
  { slug: 'gemini-omni-flash-vs-veo-3-1', label: 'Gemini Omni Flash 1.1 vs Veo 3.1' },
  { slug: 'seedance-2-0-vs-seedance-2-0-fast', label: 'Seedance 2.0 vs Fast' },
] as const;

function model(
  id: string,
  slug: string,
  publishedPairIds: string[],
  flags: { published: boolean; indexed: boolean } = { published: true, indexed: true },
): RuntimeModelEntry {
  const base = structuredClone(listRuntimeModels()[0]);
  return {
    ...base,
    id,
    slug,
    aliases: { internal: [`internal-${id}`], publicSlugs: [`historical-${slug}`] },
    publication: {
      ...base.publication,
      compare: { ...flags, suggestedOpponentIds: [], publishedPairIds },
    },
  };
}

function countLocaleComparisons<T>(run: () => T): { result: T; calls: number } {
  const original = String.prototype.localeCompare;
  let calls = 0;
  String.prototype.localeCompare = function (this: string, ...args: Parameters<typeof original>) {
    calls += 1;
    return original.apply(this, args);
  };
  try {
    return { result: run(), calls };
  } finally {
    String.prototype.localeCompare = original;
  }
}

test('each editorial comparison accepts a declaration from either canonical endpoint using IDs', () => {
  for (const item of EDITORIAL_COMPARISONS) {
    const [leftSlug, rightSlug] = item.slug.split('-vs-');
    for (const direction of ['left', 'right']) {
      const models = [
        model('left-id', leftSlug, direction === 'left' ? ['right-id'] : []),
        model('right-id', rightSlug, direction === 'right' ? ['left-id'] : []),
      ];
      assert.deepEqual(buildMarketingCompareMenu(models), [item], `${item.slug}:${direction}`);
      assert.deepEqual(buildMarketingCompareMenu([...models].reverse()), [item], `${item.slug}:${direction}:reversed`);
      assert.deepEqual(buildPublishedComparisonSlugsFromModels(models, () => true), [item.slug]);
    }
  }
});

test('comparison menu requires both comparison publication flags on both endpoints', () => {
  for (const endpoint of ['left', 'right']) {
    for (const flag of ['published', 'indexed'] as const) {
      const flags = { published: true, indexed: true, [flag]: false };
      const models = [
        model('left-id', 'minimax-h3', ['right-id'], endpoint === 'left' ? flags : undefined),
        model('right-id', 'seedance-2-5', ['left-id'], endpoint === 'right' ? flags : undefined),
      ];
      assert.deepEqual(buildMarketingCompareMenu(models), [], `${endpoint}.${flag}`);
    }
  }
});

test('comparison menu does not infer a pair from suggestions, missing opponents or self references', () => {
  const left = model('left-id', 'minimax-h3', ['missing', 'left-id']);
  const right = model('right-id', 'seedance-2-5', []);
  left.publication.compare.suggestedOpponentIds = ['right-id'];
  right.publication.compare.suggestedOpponentIds = ['left-id'];
  assert.deepEqual(buildMarketingCompareMenu([left, right]), []);
  assert.deepEqual(buildMarketingCompareMenu([model('left-id', 'minimax-h3', ['right-id'])]), []);
  assert.deepEqual(buildMarketingCompareMenu([model('right-id', 'seedance-2-5', ['left-id'])]), []);
  assert.deepEqual(buildMarketingCompareMenu([]), []);
});

test('comparison menu requires distinct IDs and exact canonical slugs without alias resolution', () => {
  assert.deepEqual(buildMarketingCompareMenu([
    model('same-id', 'minimax-h3', ['same-id']),
    model('same-id', 'seedance-2-5', ['same-id']),
  ]), []);

  for (const opponent of ['seedance-2-5', 'internal-right-id', 'RIGHT-ID']) {
    assert.deepEqual(buildMarketingCompareMenu([
      model('left-id', 'minimax-h3', [opponent]),
      model('right-id', 'seedance-2-5', []),
    ]), [], opponent);
  }

  const historical = model('right-id', 'seedance-renamed', []);
  historical.aliases.publicSlugs = ['seedance-2-5'];
  assert.deepEqual(buildMarketingCompareMenu([
    model('left-id', 'minimax-h3', ['right-id']), historical,
  ]), []);
});

test('comparison menu uses comparison publication independently from model lifecycle and model-page publication', () => {
  const left = model('left-id', 'minimax-h3', ['right-id']);
  const right = model('right-id', 'seedance-2-5', []);
  left.lifecycle = 'deep_legacy';
  right.publication.model = { published: false, indexable: false };
  right.publication.sitemap.published = false;
  assert.deepEqual(buildMarketingCompareMenu([left, right]), [EDITORIAL_COMPARISONS[0]]);
});

test('reciprocal and duplicate declarations produce one menu entry in editorial order', () => {
  const models = [
    model('seedance-id', 'seedance-2-5', ['wan-id', 'h3-id', 'h3-id']),
    model('wan-id', 'wan-3', ['seedance-id']),
    model('h3-id', 'minimax-h3', ['seedance-id', 'seedance-id', 'h3-max-id']),
    model('h3-max-id', 'minimax-h3-max', ['h3-id']),
  ];
  const expected = [EDITORIAL_COMPARISONS[0], EDITORIAL_COMPARISONS[1], EDITORIAL_COMPARISONS[3]];
  assert.deepEqual(buildMarketingCompareMenu(models), expected);
  assert.deepEqual(buildMarketingCompareMenu([...models].reverse()), expected);
  assert.deepEqual(buildMarketingCompareMenu([...models, models[0]]), expected);
});

test('comparison menu preserves full-builder membership when duplicate input IDs or slugs occur', () => {
  const fixtures = [
    [
      model('h3-id', 'minimax-h3', ['seedance-id']),
      model('seedance-id', 'seedance-2-5', []),
      model('seedance-id', 'seedance-renamed', []),
    ],
    [
      model('h3-id', 'minimax-h3', ['seedance-id']),
      model('h3-id', 'h3-renamed', []),
      model('seedance-id', 'seedance-2-5', []),
    ],
    [
      model('h3-id', 'minimax-h3', ['seedance-id']),
      model('h3-shadow-id', 'minimax-h3', [], { published: false, indexed: false }),
      model('seedance-id', 'seedance-2-5', []),
    ],
  ];
  const expectations = [[], [EDITORIAL_COMPARISONS[0]], [EDITORIAL_COMPARISONS[0]]];
  for (const [index, models] of fixtures.entries()) {
    const published = new Set(buildPublishedComparisonSlugsFromModels(models, () => true));
    assert.deepEqual(EDITORIAL_COMPARISONS.filter(({ slug }) => published.has(slug)), expectations[index]);
    assert.deepEqual(buildMarketingCompareMenu(models), expectations[index]);
  }
});

test('candidate lookup requires complete canonical pairs and preserves model slugs containing the separator', () => {
  const models = [
    model('alpha-id', 'alpha-video', ['zeta-id']),
    model('zeta-id', 'zeta-video', []),
    model('compound-id', 'alpha-vs-beta', ['gamma-id']),
    model('gamma-id', 'gamma', []),
  ];
  const isPublished = createPublishedComparisonSlugLookup(models);
  assert.equal(isPublished('alpha-video-vs-zeta-video'), true);
  assert.equal(isPublished('zeta-video-vs-alpha-video'), false);
  for (const slug of ['', 'alpha-video', 'alpha-video-vs-', '-vs-zeta-video', 'alpha-video-vs-missing']) {
    assert.equal(isPublished(slug), false, slug);
  }
  assert.deepEqual(buildPublishedComparisonSlugsFromModels(models, () => true), [
    'alpha-video-vs-zeta-video', 'alpha-vs-beta-vs-gamma',
  ]);
  assert.equal(isPublished('alpha-vs-beta-vs-gamma'), true);
});

test('live runtime comparison menu retains every link, label, brand and badge from the full publication graph', () => {
  const models = listRuntimeModels();
  const published = new Set(buildPublishedComparisonSlugsFromModels(models, () => true));
  const isPublished = createPublishedComparisonSlugLookup(models);
  for (const slug of published) assert.equal(isPublished(slug), true, slug);
  assert.deepEqual(EDITORIAL_COMPARISONS.filter(({ slug }) => published.has(slug)), EDITORIAL_COMPARISONS);
  assert.deepEqual(buildMarketingCompareMenu(models), EDITORIAL_COMPARISONS);

  const brandsBySlug: Record<string, string> = {
    'minimax-h3': 'minimax', 'minimax-h3-max': 'minimax', 'seedance-2-5': 'bytedance',
    'kling-3-pro': 'kling', 'wan-3': 'wan', 'wan-3-prime': 'wan',
    'ltx-2-5-fast': 'lightricks', 'ltx-2-5-pro': 'lightricks',
    'gemini-omni-flash': 'google-veo', 'veo-3-1': 'google-veo',
    'seedance-2-0': 'bytedance', 'seedance-2-0-fast': 'bytedance',
  };
  assert.deepEqual(MARKETING_NAV_COMPARE, EDITORIAL_COMPARISONS.map(({ slug, label }) => ({
    key: slug,
    label,
    href: { pathname: '/ai-video-engines/[slug]', params: { slug } },
    comparisonBrands: slug.split('-vs-').map(id => ({ id, brandId: brandsBySlug[id] })),
    badge: undefined,
  })));
  assert.ok(MARKETING_NAV_COMPARE.length <= 10);
});

test('comparison menu bounds canonical comparison work to editorial candidates even in a dense graph', (t) => {
  const unrelatedIds = Array.from({ length: 40 }, (_, index) => `unrelated-${index}`);
  const dense = [
    ...listRuntimeModels(),
    ...unrelatedIds.map(id => model(id, id, unrelatedIds.filter(opponent => opponent !== id))),
  ];
  for (const [name, models] of [['live', listRuntimeModels()], ['dense', dense]] as const) {
    const expanded = countLocaleComparisons(() => buildPublishedComparisonSlugsFromModels(models, () => true));
    const menu = countLocaleComparisons(() => buildMarketingCompareMenu(models));
    t.diagnostic(`${name}: full graph ${expanded.result.length} canonical pairs / ${expanded.calls} localeCompare calls; menu ${menu.result.length} entries / ${menu.calls} localeCompare calls.`);
    assert.deepEqual(menu.result, EDITORIAL_COMPARISONS);
    assert.ok(menu.calls <= EDITORIAL_COMPARISONS.length,
      `${name}: menu should canonicalize at most its ${EDITORIAL_COMPARISONS.length} candidates; observed ${menu.calls} localeCompare calls`);
    assert.ok(expanded.calls > menu.calls, `${name}: the bounded menu avoids full graph canonicalization and sorting`);
  }
});
