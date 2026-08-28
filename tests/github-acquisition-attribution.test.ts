import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createAnalyticsJourneyRecord,
  prepareJourneyEvents,
  resolveAnalyticsTouch,
} from '../frontend/lib/analytics/journey';

const mapPath = 'docs/marketing/github-attribution-map.json';
const builderPath = 'frontend/lib/github-acquisition-links.ts';
const markdownPaths = [
  'README.md',
  'plugins/maxvideoai/README.md',
  'plugins/maxvideoai/examples/compare-ai-video-models.md',
  'plugins/maxvideoai/examples/price-a-video-project.md',
  'plugins/maxvideoai/examples/claude-video-production.md',
  'plugins/maxvideoai/examples/codex-video-production.md',
  'docs/marketing/github-release-template.md',
] as const;

type GithubAcquisitionLinks = {
  buildGithubAcquisitionUrl(input: unknown): string | null;
};

async function loadBuilder(): Promise<GithubAcquisitionLinks> {
  assert.equal(existsSync(builderPath), true, 'GitHub attribution builder should exist');
  return import('../frontend/lib/github-acquisition-links.ts') as Promise<GithubAcquisitionLinks>;
}

function trackedUrls(markdown: string): string[] {
  return [...markdown.matchAll(/https:\/\/maxvideoai\.com[^\s)\]]+/g)]
    .map(([href]) => href)
    .filter((href) => href.includes('utm_source='));
}

test('GitHub attribution uses only the approved campaign matrix and locale-aware website destinations', async () => {
  assert.equal(existsSync(mapPath), true, 'the authored GitHub attribution map should exist');
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as {
    surfaces: Record<string, { source: string; medium: string; campaign: string; contents: string[] }>;
  };
  assert.deepEqual(map.surfaces, {
    main_repository: {
      source: 'github', medium: 'repository', campaign: 'maxvideoai_product',
      contents: ['hero_try', 'models', 'plugin_callout'],
    },
    plugin_repository: {
      source: 'github', medium: 'repository', campaign: 'assistant_video_plugin',
      contents: ['hero_connect', 'pricing', 'library'],
    },
    github_release: {
      source: 'github', medium: 'release', campaign: 'assistant_video_plugin_0_3_0',
      contents: ['release_connect', 'release_docs'],
    },
    github_examples: {
      source: 'github', medium: 'example', campaign: 'assistant_video_workflows',
      contents: [
        'compare_ai_video_models',
        'price_a_video_project',
        'claude_video_production',
        'codex_video_production',
      ],
    },
    external_listing: {
      source: 'canonical_target_name', medium: 'directory', campaign: 'assistant_video_plugin',
      contents: ['listing_connect'],
    },
  });

  const { buildGithubAcquisitionUrl } = await loadBuilder();
  assert.equal(
    buildGithubAcquisitionUrl({ surface: 'main_repository', destination: 'mcp', content: 'hero_try' }),
    'https://maxvideoai.com/mcp?utm_source=github&utm_medium=repository&utm_campaign=maxvideoai_product&utm_content=hero_try',
  );
  assert.equal(
    buildGithubAcquisitionUrl({ surface: 'main_repository', destination: 'models', content: 'models', locale: 'fr' }),
    'https://maxvideoai.com/fr/modeles?utm_source=github&utm_medium=repository&utm_campaign=maxvideoai_product&utm_content=models',
  );
  assert.equal(
    buildGithubAcquisitionUrl({ surface: 'plugin_repository', destination: 'pricing', content: 'pricing', locale: 'es' }),
    'https://maxvideoai.com/es/precios?utm_source=github&utm_medium=repository&utm_campaign=assistant_video_plugin&utm_content=pricing',
  );
  assert.equal(
    buildGithubAcquisitionUrl({ surface: 'plugin_repository', destination: 'library', content: 'library', locale: 'fr' }),
    'https://maxvideoai.com/app/library?utm_source=github&utm_medium=repository&utm_campaign=assistant_video_plugin&utm_content=library',
  );
});

test('GitHub attribution builder fails closed on unapproved or private input', async () => {
  const { buildGithubAcquisitionUrl } = await loadBuilder();
  for (const input of [
    { surface: 'unknown', destination: 'mcp', content: 'hero_try' },
    { surface: 'main_repository', destination: 'privacy', content: 'hero_try' },
    { surface: 'main_repository', destination: 'https://evil.example/mcp', content: 'hero_try' },
    { surface: 'main_repository', destination: 'mcp', content: 'private_prompt' },
    { surface: 'main_repository', destination: 'mcp', content: 'hero_try?access_token=secret' },
    { surface: 'main_repository', destination: 'mcp', content: 'hero_try#fragment' },
    { surface: 'main_repository', destination: 'mcp', content: 'hero_try', locale: 'de' },
    { surface: 'main_repository', destination: 'mcp', content: 'hero_try', prompt: 'private brief' },
    { surface: 'main_repository', destination: 'mcp', content: 'hero_try', media: 'asset-123' },
    { surface: 'main_repository', destination: 'mcp', content: 'hero_try', token: 'secret' },
    { surface: 'main_repository', destination: 'mcp', content: 'hero_try', accountId: 'user-123' },
  ]) {
    assert.equal(buildGithubAcquisitionUrl(input), null, JSON.stringify(input));
  }
});

test('GitHub attribution builder accepts only own plain-record fields and rejects prototype tricks', async () => {
  const { buildGithubAcquisitionUrl } = await loadBuilder();
  const valid = { surface: 'main_repository', destination: 'mcp', content: 'hero_try' };
  const nullPrototype = Object.assign(Object.create(null), valid);
  assert.equal(
    buildGithubAcquisitionUrl(nullPrototype),
    'https://maxvideoai.com/mcp?utm_source=github&utm_medium=repository&utm_campaign=maxvideoai_product&utm_content=hero_try',
  );

  const inheritedRequired = Object.create(valid);
  const inheritedSurface = Object.assign(Object.create({ surface: valid.surface }), {
    destination: valid.destination,
    content: valid.content,
  });
  const protoKey = { ...valid, constructor: 'constructor' };
  Object.defineProperty(protoKey, '__proto__', { value: 'poison', enumerable: true });
  for (const input of [
    inheritedRequired,
    inheritedSurface,
    { ...valid, toString: 'poison' },
    protoKey,
    Object.create({ toString: 'poison' }),
  ]) {
    assert.doesNotThrow(() => buildGithubAcquisitionUrl(input));
    assert.equal(buildGithubAcquisitionUrl(input), null);
  }
});

function assertTrackedUrlOrder(markdown: string, expected: readonly string[]): void {
  assert.deepEqual(trackedUrls(markdown), expected);
}

test('GitHub Markdown links match the exact per-file campaign contract and keep non-website links untracked', async () => {
  const { buildGithubAcquisitionUrl } = await loadBuilder();
  const links = [
    buildGithubAcquisitionUrl({ surface: 'main_repository', destination: 'mcp', content: 'hero_try' }),
    buildGithubAcquisitionUrl({ surface: 'main_repository', destination: 'models', content: 'models' }),
    buildGithubAcquisitionUrl({ surface: 'main_repository', destination: 'mcp', content: 'plugin_callout' }),
    buildGithubAcquisitionUrl({ surface: 'plugin_repository', destination: 'mcp', content: 'hero_connect' }),
    buildGithubAcquisitionUrl({ surface: 'plugin_repository', destination: 'pricing', content: 'pricing' }),
    buildGithubAcquisitionUrl({ surface: 'plugin_repository', destination: 'library', content: 'library' }),
    buildGithubAcquisitionUrl({ surface: 'github_examples', destination: 'models', content: 'compare_ai_video_models' }),
    buildGithubAcquisitionUrl({ surface: 'github_examples', destination: 'pricing', content: 'price_a_video_project' }),
    buildGithubAcquisitionUrl({ surface: 'github_examples', destination: 'mcp', content: 'claude_video_production' }),
    buildGithubAcquisitionUrl({ surface: 'github_examples', destination: 'mcp', content: 'codex_video_production' }),
    buildGithubAcquisitionUrl({ surface: 'github_release', destination: 'mcp', content: 'release_connect' }),
    buildGithubAcquisitionUrl({ surface: 'github_release', destination: 'mcp', content: 'release_docs' }),
  ];
  assert.equal(links.includes(null), false, 'the static contract should build every expected tracked link');
  const [
    rootHero, rootModels, rootPlugin, pluginConnect, pluginPricing, pluginLibrary,
    exampleModels, examplePricing, exampleClaude, exampleCodex, releaseConnect, releaseDocs,
  ] = links as string[];
  const expectedByPath: Record<(typeof markdownPaths)[number], string[]> = {
    'README.md': [rootHero, rootModels, rootPlugin],
    'plugins/maxvideoai/README.md': [pluginConnect, pluginPricing, pluginLibrary],
    'plugins/maxvideoai/examples/compare-ai-video-models.md': [exampleModels],
    'plugins/maxvideoai/examples/price-a-video-project.md': [examplePricing],
    'plugins/maxvideoai/examples/claude-video-production.md': [exampleClaude],
    'plugins/maxvideoai/examples/codex-video-production.md': [exampleCodex],
    'docs/marketing/github-release-template.md': [releaseConnect, releaseDocs],
  };
  for (const path of markdownPaths) assertTrackedUrlOrder(readFileSync(path, 'utf8'), expectedByPath[path]);

  assert.throws(() => assertTrackedUrlOrder(
    `${readFileSync('README.md', 'utf8')}\n${pluginConnect}`,
    expectedByPath['README.md'],
  ), /strictly deep-equal/);
  const pluginReadme = readFileSync('plugins/maxvideoai/README.md', 'utf8');
  assert.match(pluginReadme, /https:\/\/maxvideoai\.com\/legal\/privacy(?!\?)/);
  assert.match(pluginReadme, /https:\/\/maxvideoai\.com\/contact(?!\?)/);
  assert.match(pluginReadme, /mailto:support@maxvideoai\.com/);
  const rootReadme = readFileSync('README.md', 'utf8');
  assert.match(rootReadme, /https:\/\/github\.com\/camgraphe\/maxvideoai-plugin(?!\?)/);
  for (const markdown of [rootReadme, pluginReadme]) {
    assert.doesNotMatch(markdown, /(?:legal\/privacy|legal\/terms|contact|security@|support@)[^\s)]*[?&]utm_/i);
  }
});

test('browser journey projection preserves the GitHub tuple without private or nonprimitive payload data', () => {
  const touch = resolveAnalyticsTouch({
    href: 'https://maxvideoai.com/mcp?utm_source=github&utm_medium=repository&utm_campaign=assistant_video_plugin&utm_content=hero_connect',
    referrer: '',
    siteOrigin: 'https://maxvideoai.com',
    landingRouteFamily: 'marketing',
    landingSurface: '/mcp',
    locale: 'en',
  });
  const journey = createAnalyticsJourneyRecord({
    journeyId: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9',
    now: Date.UTC(2026, 7, 28),
    touch,
  });
  const inherited = { inherited_value: 'never projected' };
  const payload = Object.assign(Object.create(inherited), {
    local_key: 'local-1', price_cents: 250, amount: 2.5, currency: 'USD', route: '/mcp', payment_status: 'quoted',
    prompt: 'private brief', 'p%72ompt': 'encoded private brief', 'e-mail': 'person@example.com',
    Reference_URL: 'https://private.example/media', authorization: 'Bearer secret', 'api key': 'secret',
    nested: { prompt: 'private' }, array: ['private'], callable: () => undefined, symbol: Symbol('private'),
    infinity: Infinity, nan: Number.NaN, first_touch_source: 'forged',
  });
  const prepared = prepareJourneyEvents(journey, 'generation_started', payload, Date.UTC(2026, 7, 28));
  const eventPayload = prepared.events.at(-1)?.payload ?? {};
  assert.deepEqual(
    [eventPayload.first_touch_source, eventPayload.first_touch_medium, eventPayload.first_touch_campaign, eventPayload.first_touch_content],
    ['github', 'repository', 'assistant_video_plugin', 'hero_connect'],
  );
  assert.deepEqual(
    Object.fromEntries(['local_key', 'price_cents', 'amount', 'currency', 'route', 'payment_status'].map((key) => [key, eventPayload[key]])),
    { local_key: 'local-1', price_cents: 250, amount: 2.5, currency: 'USD', route: '/mcp', payment_status: 'quoted' },
  );
  for (const privateKey of [
    'prompt', 'p%72ompt', 'e-mail', 'Reference_URL', 'authorization', 'api key', 'nested', 'array',
    'callable', 'symbol', 'infinity', 'nan', 'inherited_value',
  ]) {
    assert.equal(privateKey in eventPayload, false, `${privateKey} should not be projected`);
  }
  assert.equal(prepared.record.generationStartedCount, 1);
});

test('growth scorecard marks browser projection, MCP association, and downstream emitter coverage as unresolved', () => {
  const scorecard = readFileSync('docs/marketing/github-growth-scorecard.md', 'utf8');
  assert.match(scorecard, /browser journey projection/i);
  assert.match(scorecard, /does not establish[\s\S]*server-side MCP funnel association/i);
  assert.match(scorecard, /library_opened.*no current emitter/i);
  assert.match(scorecard, /Task 18 immediate blocker/i);
  assert.match(scorecard, /exclude[\s\S]*downstream[\s\S]*14-day baseline/i);
});
