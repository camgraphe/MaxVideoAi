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

type GithubAcquisitionLinkInput = {
  surface: string;
  destination: string;
  content: string;
  locale?: string;
};

type GithubAcquisitionLinks = {
  buildGithubAcquisitionUrl(input: GithubAcquisitionLinkInput): string | null;
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
    assert.equal(buildGithubAcquisitionUrl(input as GithubAcquisitionLinkInput), null, JSON.stringify(input));
  }
});

test('GitHub Markdown links are generated by the campaign contract while non-website links remain untracked', async () => {
  const { buildGithubAcquisitionUrl } = await loadBuilder();
  const expected = new Set([
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
  ]);
  assert.equal(expected.has(null), false, 'the static contract should build every expected tracked link');

  const found = new Set(markdownPaths.flatMap((path) => trackedUrls(readFileSync(path, 'utf8'))));
  assert.deepEqual(found, expected);
  const pluginReadme = readFileSync('plugins/maxvideoai/README.md', 'utf8');
  assert.match(pluginReadme, /https:\/\/maxvideoai\.com\/legal\/privacy(?!\?)/);
  assert.match(pluginReadme, /https:\/\/maxvideoai\.com\/contact(?!\?)/);
  assert.match(pluginReadme, /mailto:support@maxvideoai\.com/);
  assert.match(readFileSync('README.md', 'utf8'), /https:\/\/github\.com\/camgraphe\/maxvideoai-plugin(?!\?)/);
});

test('approved GitHub attribution survives the complete journey without private content', () => {
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
  const events = [
    'oauth_connection_started',
    'oauth_connection_completed',
    'recommend_models',
    'calculate_project_budget',
    'paid_quote_prepared',
    'paid_generation_accepted',
    'paid_generation_completed',
    'library_opened',
    'generation_started',
  ];
  let record = journey;
  for (const event of events) {
    const prepared = prepareJourneyEvents(record, event, {
      prompt: 'private brief', media: 'private-asset', token: 'secret', accountId: 'account-1',
    }, Date.UTC(2026, 7, 28));
    record = prepared.record;
    const payload = prepared.events.at(-1)?.payload ?? {};
    assert.deepEqual(
      [payload.first_touch_source, payload.first_touch_medium, payload.first_touch_campaign, payload.first_touch_content],
      ['github', 'repository', 'assistant_video_plugin', 'hero_connect'],
      event,
    );
    for (const privateKey of ['prompt', 'media', 'token', 'accountId']) {
      assert.equal(privateKey in payload, false, `${event} should not retain ${privateKey}`);
    }
  }
  assert.equal(record.generationStartedCount, 1);
});
