import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const launchEvidencePath = 'docs/marketing/mcp-launch-evidence.md';
const compatibilityPath = 'docs/operations/mcp-host-compatibility-matrix.md';
const e2ePath = 'tests/e2e/mcp-acquisition.spec.ts';
const publicationPath = 'frontend/config/mcp-publication.json';
const fixtureConfigPath = 'tests/fixtures/mcp-launch-publication-states.json';
const fixtureRunnerPath = 'scripts/run-mcp-launch-fixture.mjs';

test('Task 11 keeps every MCP publication gate fail closed', () => {
  const publication = JSON.parse(readFileSync(publicationPath, 'utf8')) as Record<string, boolean>;
  assert.deepEqual(publication, {
    publicMarketing: false,
    publicIndexing: false,
    transport: false,
    oauth: false,
    discovery: false,
    paidGeneration: false,
    trial: false,
    referenceUploads: false,
  });
});

test('the MCP browser contract covers localized no-JS SEO, visual states, and private boundaries', () => {
  assert.equal(existsSync(e2ePath), true, `${e2ePath} should exist`);
  const source = readFileSync(e2ePath, 'utf8');

  for (const path of [
    '/mcp',
    '/fr/mcp',
    '/es/mcp',
    '/integrations/claude',
    '/fr/integrations/claude',
    '/es/integraciones/claude',
    '/integrations/codex',
    '/fr/integrations/codex',
    '/es/integraciones/codex',
    '/docs/mcp',
    '/fr/docs/mcp',
    '/es/docs/mcp',
  ]) {
    assert.match(source, new RegExp(path.replaceAll('/', '\\/')));
  }

  assert.match(source, /javaScriptEnabled:\s*false/);
  assert.match(source, /1440[\s\S]*1000/);
  assert.match(source, /390[\s\S]*844/);
  assert.match(source, /data-theme/);
  assert.match(source, /screenshot/);
  assert.match(source, /canonical/i);
  assert.match(source, /hreflang/i);
  assert.match(source, /application\/ld\+json/);
  assert.match(source, /noindex/i);
  assert.match(source, /no-store/i);
  assert.match(source, /api\/mcp/);
  assert.match(source, /oauth\/consent/);
  assert.match(source, /api\/uploads\/image/);
  assert.match(source, /api\/wallet/);
  assert.match(source, /llms\.txt/);
  assert.match(source, /sitemap-en\.xml/);
  assert.match(source, /setViewportSize\(\{\s*width:\s*1440,\s*height:\s*1000\s*\}\)/);
  assert.match(source, /window\.innerWidth/);
  assert.match(source, /preview-budget-unavailable-light-1440x1000\.png/);
  assert.match(source, /enabled-budget-trial-paid-light-1440x1000\.png/);
  assert.match(source, /x-middleware-rewrite/);
  assert.match(source, /__mcp-publication-gated__/);
  assert.match(source, /apiHostHeaders[\s\S]*?request\.get\('\/mcp'/);
});

test('tracked fixture config and runner reproduce all launch modes without mutating checked-in flags', () => {
  for (const path of [fixtureConfigPath, fixtureRunnerPath]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }

  const fixtureConfig = JSON.parse(readFileSync(fixtureConfigPath, 'utf8')) as Record<
    string,
    Record<string, boolean>
  >;
  assert.deepEqual(fixtureConfig, {
    gated: {
      publicMarketing: false,
      publicIndexing: false,
      transport: false,
      oauth: false,
      discovery: false,
      paidGeneration: false,
      trial: false,
      referenceUploads: false,
    },
    preview: {
      publicMarketing: true,
      publicIndexing: false,
      transport: true,
      oauth: true,
      discovery: true,
      paidGeneration: false,
      trial: false,
      referenceUploads: false,
    },
    enabled: {
      publicMarketing: true,
      publicIndexing: true,
      transport: true,
      oauth: true,
      discovery: true,
      paidGeneration: true,
      trial: true,
      referenceUploads: true,
    },
  });

  const runner = readFileSync(fixtureRunnerPath, 'utf8');
  assert.match(runner, /git[\s\S]*?ls-files/);
  assert.match(runner, /mkdtemp/);
  assert.match(runner, /node_modules/);
  assert.match(runner, /frontend\/config\/mcp-publication\.json/);
  assert.match(runner, /createHash\(['"]sha256['"]\)/);
  assert.match(runner, /findAvailablePort/);
  assert.match(runner, /MCP_E2E_MODE/);
  assert.match(runner, /MCP_E2E_BASE_URL/);
  assert.match(runner, /playwright[\s\S]*?mcp-acquisition\.spec\.ts/);
  assert.match(runner, /--lighthouse/);
  assert.match(runner, /lhci[\s\S]*?\/mcp[\s\S]*?\/integrations\/claude[\s\S]*?\/integrations\/codex/);
  assert.match(runner, /process\.kill\(-server\.pid/);
  assert.match(runner, /rmSync\(fixtureRoot/);
  assert.doesNotMatch(runner, /frontend\/\.tmp\/mcp-launch/);

  const packageJson = readFileSync('package.json', 'utf8');
  assert.match(packageJson, /"qa:mcp-launch:lighthouse":\s*"node scripts\/run-mcp-launch-fixture\.mjs --mode enabled --lighthouse"/);
});

test('launch evidence records local states, artifacts, exact limitations, and future evidence', () => {
  assert.equal(existsSync(launchEvidencePath), true, `${launchEvidencePath} should exist`);
  const evidence = readFileSync(launchEvidencePath, 'utf8');

  assert.match(evidence, /Checked:\s*2026-07-14/);
  for (const state of ['Pass', 'Blocked', 'Not run']) assert.match(evidence, new RegExp(`\\b${state}\\b`));
  assert.match(evidence, /all eight[^\n]+false/i);
  assert.match(evidence, /isolated[^\n]+all-gates-green/i);
  assert.match(evidence, /output\/playwright\//);
  assert.match(evidence, /JavaScript disabled/i);
  assert.match(evidence, /Lighthouse/i);
  assert.match(evidence, /Core Web Vitals|lab metrics/i);
  assert.match(evidence, /Codex[^\n]+phone/i);
  assert.match(evidence, /Claude[^\n]+refresh/i);
  assert.match(evidence, /migrations? 30[^\n]+32/i);
  assert.match(evidence, /migration 33[^\n]+unapplied/i);
  assert.match(evidence, /no publishable MCP (?:proof|demonstration)/i);
  assert.match(evidence, /GSC[^\n]+post-deployment/i);
  assert.match(evidence, /no production|production[^\n]+not probed/i);
  assert.match(evidence, /not ready for public promotion/i);
  assert.match(evidence, /qa:mcp-launch:gated/);
  assert.match(evidence, /qa:mcp-launch:preview/);
  assert.match(evidence, /qa:mcp-launch:enabled/);
  assert.doesNotMatch(evidence, /frontend\/\.tmp\/mcp-launch/);
});

test('the compatibility matrix keeps the local five-tool profile distinct from unverified host evidence', () => {
  const compatibility = readFileSync(compatibilityPath, 'utf8');
  for (const tool of [
    'get_account_status',
    'list_models',
    'get_model_details',
    'recommend_models',
    'calculate_project_budget',
  ]) assert.match(compatibility, new RegExp(`\\\`${tool}\\\``));
  assert.match(compatibility, /OAuth.*unverified/i);
  assert.match(compatibility, /Codex.*unverified/i);
  assert.match(compatibility, /Claude.*unverified/i);
  assert.match(compatibility, /project estimate/i);
  assert.match(compatibility, /prepare_generation.*confirm_generation/is);
  assert.match(compatibility, /all eight[^\n]+false/i);
});
