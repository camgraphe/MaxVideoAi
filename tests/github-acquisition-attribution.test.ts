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
  'docs/marketing/github-distribution-matrix.md',
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
      source: 'github', medium: 'release', campaign: 'assistant_video_plugin_0_3_2',
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
    'docs/marketing/github-distribution-matrix.md': [],
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
    local_key: 'local_batch_m123abcd_qwerty_1', price_cents: 250, amount: 2.5, currency: 'USD', route: '/mcp', payment_status: 'quoted',
    prompt: 'private brief', 'p%72ompt': 'encoded private brief', 'p%2572ompt': 'double-encoded private brief',
    'e-mail': 'person@example.com', uid: 'user-1', customer_id: 'customer-1', profile_id: 'profile-1', mail: 'person@example.com',
    Reference_URL: 'https://private.example/media', authorization: 'Bearer secret', 'api key': 'secret',
    leading_url: ' https://private.example/media', protocol_relative: '//private.example/media',
    encoded_url: 'https%3A%2F%2Fprivate.example%2Fmedia', query_path: '/mcp?token=secret', fragment_path: '/mcp#private',
    raw_unc: '\\\\private.example\\token-secret', control_url: '\0https://private.example/media',
    tab_url: '\thttps://private.example/media', newline_path: '\n/mcp', encoded_unc: '%5C%5Cprivate.example%5Ctoken-secret',
    encoded_control_url: '%00https%3A%2F%2Fprivate.example%2Fmedia',
    c1_url: '\u0085https://private.example/media', encoded_c1_url: '%C2%85https%3A%2F%2Fprivate.example%2Fmedia',
    nested: { prompt: 'private' }, array: ['private'], callable: () => undefined, symbol: Symbol('private'),
    infinity: Infinity, nan: Number.NaN, first_touch_source: 'forged',
    description: 'my unreleased prompt', message: 'Bearer private-token', input: 'private media brief',
    payment_details: '4242 4242 4242 4242', card_number: '4242424242424242', cvv: '123',
    credential: 'private-credential',
  });
  const prepared = prepareJourneyEvents(journey, 'generation_started', payload, Date.UTC(2026, 7, 28));
  const eventPayload = prepared.events.at(-1)?.payload ?? {};
  assert.deepEqual(
    [eventPayload.first_touch_source, eventPayload.first_touch_medium, eventPayload.first_touch_campaign, eventPayload.first_touch_content],
    ['github', 'repository', 'assistant_video_plugin', 'hero_connect'],
  );
  assert.deepEqual(
    Object.fromEntries(['local_key', 'price_cents', 'amount', 'currency', 'route', 'payment_status'].map((key) => [key, eventPayload[key]])),
    { local_key: 'local_batch_m123abcd_qwerty_1', price_cents: 250, amount: 2.5, currency: 'USD', route: '/mcp', payment_status: 'quoted' },
  );
  for (const privateKey of [
    'prompt', 'p%72ompt', 'p%2572ompt', 'e-mail', 'uid', 'customer_id', 'profile_id', 'mail',
    'Reference_URL', 'authorization', 'api key', 'leading_url', 'protocol_relative', 'encoded_url', 'query_path',
    'fragment_path', 'raw_unc', 'control_url', 'tab_url', 'newline_path', 'encoded_unc', 'encoded_control_url',
    'c1_url', 'encoded_c1_url', 'nested', 'array', 'callable', 'symbol', 'infinity', 'nan', 'inherited_value',
    'description', 'message', 'input', 'payment_details', 'card_number', 'cvv', 'credential',
  ]) {
    assert.equal(privateKey in eventPayload, false, `${privateKey} should not be projected`);
  }
  assert.equal(prepared.record.generationStartedCount, 1);
});

test('browser journey rejects unknown event names and unapproved UTM tuples', () => {
  const unapprovedTouch = resolveAnalyticsTouch({
    href: 'https://maxvideoai.com/mcp?utm_source=github&utm_medium=repository&utm_campaign=plugin&utm_content=private_brief',
    referrer: '',
    siteOrigin: 'https://maxvideoai.com',
    landingRouteFamily: 'marketing',
    landingSurface: '/mcp',
    locale: 'en',
  });
  assert.deepEqual(unapprovedTouch, {
    source: 'direct',
    medium: 'none',
    landingRouteFamily: 'marketing',
    landingSurface: '/mcp',
    locale: 'en',
  });

  const journey = createAnalyticsJourneyRecord({
    journeyId: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9',
    now: Date.UTC(2026, 7, 28),
    touch: unapprovedTouch,
  });
  const prepared = prepareJourneyEvents(
    journey,
    'private_prompt_export',
    { description: 'my unreleased prompt', credential: 'Bearer private-token' },
    Date.UTC(2026, 7, 28),
  );
  assert.deepEqual(prepared.events, []);
  assert.deepEqual(prepared.record, journey);
});

test('browser journey drops private values even when they use approved analytics keys', () => {
  const touch = resolveAnalyticsTouch({
    href: 'https://maxvideoai.com/mcp',
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

  const generation = prepareJourneyEvents(journey, 'generation_started', {
    route_family: 'private media brief',
    local_key: 'account-123',
    job_id: 'Bearer private-token',
    batch_id: '4242 4242 4242 4242',
    group_id: 'private_prompt',
    engine: 'my-unreleased-model',
    mode: 'my unreleased prompt',
    payment_mode: 'private_wallet_token',
    payment_status: 'card_4242424242424242',
  }, Date.UTC(2026, 7, 28));
  const generationPayload = generation.events.at(-1)?.payload ?? {};
  for (const privateKey of [
    'route_family', 'local_key', 'job_id', 'batch_id', 'group_id', 'engine', 'mode',
    'payment_mode', 'payment_status',
  ]) {
    assert.equal(privateKey in generationPayload, false, `${privateKey} must fail closed on private content`);
  }

  const click = prepareJourneyEvents(generation.record, 'cta_click', {
    route_family: 'private media brief',
    cta_name: 'private_media_brief',
    cta_location: 'Bearer private-token',
    target_family: 'account_123',
    tool_name: 'secret_tool',
    tool_surface: 'my unreleased prompt',
  }, Date.UTC(2026, 7, 28));
  const clickPayload = click.events.at(-1)?.payload ?? {};
  for (const privateKey of [
    'route_family', 'cta_name', 'cta_location', 'target_family', 'tool_name', 'tool_surface',
  ]) {
    assert.equal(privateKey in clickPayload, false, `${privateKey} must fail closed on private content`);
  }
});

test('journey-owned route fields are revalidated before any event is emitted', () => {
  const touch = resolveAnalyticsTouch({
    href: 'https://maxvideoai.com/mcp',
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
  const tampered = {
    ...journey,
    firstTouch: {
      ...journey.firstTouch,
      source: 'Bearer-private-token',
      landingSurface: '/Bearer-private-token',
      locale: 'account-123',
    },
    lastTouch: { ...journey.lastTouch, landingSurface: '/private/customer-123' },
  };

  const prepared = prepareJourneyEvents(tampered, 'page_view', {
    route_family: 'marketing',
  }, Date.UTC(2026, 7, 28));
  const serialized = JSON.stringify(prepared.events);
  assert.doesNotMatch(serialized, /Bearer|private|token|customer/i);
  assert.equal(prepared.events.some(({ payload }) => 'landing_surface' in payload), false);
});

test('growth scorecard marks browser projection, MCP association, and downstream emitter coverage as unresolved', () => {
  const scorecard = readFileSync('docs/marketing/github-growth-scorecard.md', 'utf8');
  assert.match(scorecard, /browser journey projection/i);
  assert.match(scorecard, /does not establish[\s\S]*server-side MCP funnel association/i);
  assert.match(scorecard, /library_opened.*no current emitter/i);
  assert.match(scorecard, /Task 18 immediate blocker/i);
  assert.match(scorecard, /exclude[\s\S]*downstream[\s\S]*14-day baseline/i);
});
