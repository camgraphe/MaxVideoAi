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
      indexable: false,
      showTrialClaim: false,
      showPaidGenerationClaim: false,
      showReferenceClaim: false,
    }
  );
});

test('the sitemap composes every publication prerequisite from the common build-time source', () => {
  const sitemapConfig = readFileSync('frontend/next-sitemap.config.js', 'utf8');
  assert.match(sitemapConfig, /require\('\.\/config\/mcp-publication\.json'\)/);
  assert.match(
    sitemapConfig,
    /const mcpIndexable =\s*mcpPublication\.publicIndexing &&\s*mcpPublication\.transport &&\s*mcpPublication\.oauth &&\s*mcpPublication\.discovery &&\s*mcpPublication\.paidGeneration &&\s*mcpPublication\.trial &&\s*mcpPublication\.referenceUploads;/
  );
  assert.match(sitemapConfig, /if \(mcpIndexable\) \{\s*marketingPaths\.add\('\/mcp'\);\s*\}/);
});
