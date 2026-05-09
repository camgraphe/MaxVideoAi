import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const schemaFacadePath = 'frontend/src/lib/schema.ts';
const schemaModulePaths = [
  'frontend/src/lib/schema/asset-schema.ts',
  'frontend/src/lib/schema/billing-content-schema.ts',
  'frontend/src/lib/schema/billing-core-schema.ts',
  'frontend/src/lib/schema/billing-products-schema.ts',
  'frontend/src/lib/schema/billing-provider-schema.ts',
  'frontend/src/lib/schema/billing-receipts-schema.ts',
  'frontend/src/lib/schema/billing-schema.ts',
  'frontend/src/lib/schema/billing-user-admin-schema.ts',
  'frontend/src/lib/schema/email-schema.ts',
  'frontend/src/lib/schema/media-library-schema.ts',
];

const sitemapFacadePath = 'frontend/lib/sitemapData.ts';
const sitemapModulePaths = [
  'frontend/lib/sitemap/compare-paths.ts',
  'frontend/lib/sitemap/lastmod.ts',
  'frontend/lib/sitemap/model-locales.ts',
  'frontend/lib/sitemap/route-discovery.ts',
  'frontend/lib/sitemap/types.ts',
  'frontend/lib/sitemap/xml.ts',
];

function read(path: string) {
  return readFileSync(path, 'utf8');
}

function lineCount(path: string) {
  return read(path).split('\n').length;
}

test('database schema facade delegates to focused schema modules', () => {
  assert.equal(existsSync(schemaFacadePath), true);
  schemaModulePaths.forEach((path) => assert.equal(existsSync(path), true, `${path} should exist`));

  const facadeSource = read(schemaFacadePath);
  assert.ok(lineCount(schemaFacadePath) < 40, `schema facade should stay tiny, got ${lineCount(schemaFacadePath)} lines`);
  assert.match(facadeSource, /ensureBillingSchema/);
  assert.match(facadeSource, /ensureAssetSchema/);
  assert.match(facadeSource, /ensureMediaLibrarySchema/);
  assert.match(facadeSource, /ensureEmailSchema/);
  assert.doesNotMatch(facadeSource, /CREATE TABLE|ALTER TABLE|CREATE INDEX|from '@\/lib\/db'/);

  schemaModulePaths.forEach((path) => {
    assert.ok(lineCount(path) < 500, `${path} should stay under 500 lines`);
  });
});

test('sitemap data facade delegates route discovery, lastmod, locales, and XML helpers', () => {
  assert.equal(existsSync(sitemapFacadePath), true);
  sitemapModulePaths.forEach((path) => assert.equal(existsSync(path), true, `${path} should exist`));

  const facadeSource = read(sitemapFacadePath);
  assert.ok(lineCount(sitemapFacadePath) < 260, `sitemapData.ts should stay focused, got ${lineCount(sitemapFacadePath)} lines`);
  assert.match(facadeSource, /getCanonicalPathEntries/);
  assert.match(facadeSource, /getVideoSitemapLastModified/);
  assert.match(facadeSource, /hasModelLocale/);
  assert.match(facadeSource, /escapeXml/);
  assert.doesNotMatch(facadeSource, /from 'node:fs'|from 'node:path'|spawnSync|discoverTemplatesFromFilesystem/);

  const routeDiscoverySource = read('frontend/lib/sitemap/route-discovery.ts');
  const lastmodSource = read('frontend/lib/sitemap/lastmod.ts');
  const xmlSource = read('frontend/lib/sitemap/xml.ts');

  assert.match(routeDiscoverySource, /discoverTemplatesFromManifest/);
  assert.match(routeDiscoverySource, /DYNAMIC_ROUTE_GENERATORS/);
  assert.match(lastmodSource, /getGitLastModified/);
  assert.match(xmlSource, /export const escapeXml/);
  sitemapModulePaths.forEach((path) => {
    assert.ok(lineCount(path) < 500, `${path} should stay under 500 lines`);
  });
});
