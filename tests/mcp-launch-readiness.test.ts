import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const launchEvidencePath = 'docs/marketing/mcp-launch-evidence.md';
const compatibilityPath = 'docs/operations/mcp-host-compatibility-matrix.md';
const e2ePath = 'tests/e2e/mcp-acquisition.spec.ts';
const publicationPath = 'frontend/config/mcp-publication.json';

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
});

test('the compatibility matrix distinguishes local QA from real host evidence', () => {
  const compatibility = readFileSync(compatibilityPath, 'utf8');
  assert.match(compatibility, /Task 11 local launch verification/);
  assert.match(compatibility, /Codex default[^\n]+phone/i);
  assert.match(compatibility, /Claude Desktop[^\n]+refresh/i);
  assert.match(compatibility, /Real-host end-to-end[^\n]+Not run/i);
  assert.match(compatibility, /Paid generation[^\n]+Blocked/i);
  assert.match(compatibility, /Trial[^\n]+Blocked/i);
  assert.match(compatibility, /Reference[^\n]+Blocked/i);
  assert.match(compatibility, /Funnel[^\n]+Blocked/i);
});
