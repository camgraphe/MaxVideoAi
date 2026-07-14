import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getMcpPublicationState } from '../frontend/lib/mcp-publication';

test('public MCP previews do not become indexable before every public capability is live', () => {
  assert.deepEqual(
    getMcpPublicationState({
      publicMarketing: true,
      publicIndexing: true,
      transport: true,
      oauth: true,
      discovery: true,
      paidGeneration: false,
      trial: false,
      referenceUploads: false,
    }),
    {
      renderPublicPage: true,
      connectionAvailable: true,
      indexable: false,
      showTrialClaim: false,
      showPaidGenerationClaim: false,
      showReferenceClaim: false,
    }
  );
});

test('connection availability is capability-derived and independent from SEO indexation', () => {
  const preview = getMcpPublicationState({
    publicMarketing: true,
    publicIndexing: false,
    transport: true,
    oauth: true,
    discovery: true,
    paidGeneration: false,
    trial: false,
    referenceUploads: false,
  });
  assert.equal(preview.connectionAvailable, true);
  assert.equal(preview.indexable, false);

  const missingOAuth = getMcpPublicationState({
    publicMarketing: true,
    publicIndexing: true,
    transport: true,
    oauth: false,
    discovery: true,
    paidGeneration: true,
    trial: true,
    referenceUploads: true,
  });
  assert.equal(missingOAuth.connectionAvailable, false);
  assert.equal(missingOAuth.indexable, false);
});

test('the sitemap composes every publication prerequisite from the common build-time source', () => {
  const sitemapConfig = readFileSync('frontend/next-sitemap.config.js', 'utf8');
  assert.match(sitemapConfig, /require\('\.\/config\/mcp-publication\.json'\)/);
  assert.match(
    sitemapConfig,
    /const mcpIndexable =\s*mcpPublication\.publicIndexing &&\s*mcpPublication\.transport &&\s*mcpPublication\.oauth &&\s*mcpPublication\.discovery &&\s*mcpPublication\.paidGeneration &&\s*mcpPublication\.trial &&\s*mcpPublication\.referenceUploads;/
  );
  assert.match(
    sitemapConfig,
    /const MCP_PUBLIC_INDEXABLE_PATHS = \[\s*'\/mcp',\s*'\/integrations\/claude',\s*'\/integrations\/codex',\s*'\/docs\/mcp',\s*\];/
  );
  assert.match(
    sitemapConfig,
    /if \(mcpIndexable\) \{\s*MCP_PUBLIC_INDEXABLE_PATHS\.forEach\(\(englishPath\) => \{\s*LOCALES\.forEach\(\(locale\) => marketingPaths\.add\(localizePathFromEnglish\(locale, englishPath\)\)\);\s*\}\);\s*\}/
  );
  assert.match(sitemapConfig, /hrefIsAbsolute:\s*true/);
  assert.match(sitemapConfig, /if \(slug === '\/docs\/mcp' && !mcpIndexable\)/);
});
