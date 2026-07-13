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

test('the sitemap consumes the common publication source without indexing MCP by default', () => {
  const sitemapConfig = readFileSync('frontend/next-sitemap.config.js', 'utf8');
  assert.match(sitemapConfig, /require\('\.\/config\/mcp-publication\.json'\)/);
  assert.match(
    sitemapConfig,
    /if \(mcpPublication\.publicIndexing\) \{\s*marketingPaths\.add\('\/mcp'\);\s*\}/
  );
});
