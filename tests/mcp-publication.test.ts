import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  getMcpIntegrationPublicationState,
  getMcpPublicationState,
} from '../frontend/lib/mcp-publication';
import { getMcpPublicIntegrationPaths } from '../frontend/lib/mcp-integration-registry';

const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));

test('public integration paths come from the indexable registry projection', () => {
  assert.deepEqual(getMcpPublicIntegrationPaths(), [
    '/integrations/claude',
    '/integrations/chatgpt',
    '/integrations/codex',
  ]);
  const publicationSource = readFileSync('frontend/lib/mcp-publication.ts', 'utf8');
  const discoverySource = readFileSync('frontend/lib/sitemap/route-discovery.ts', 'utf8');
  assert.match(publicationSource, /getMcpPublicIntegrationPaths/);
  assert.match(discoverySource, /getMcpPublicIntegrationPaths/);
});

test('runtime sitemap discovery excludes explicit noindex preview routes', async () => {
  const react = frontendRequire('react') as {
    cache?: <TFunction extends (...args: never[]) => unknown>(fn: TFunction) => TFunction;
  };
  react.cache ??= (fn) => fn;
  const { getCanonicalPathEntries } = await import(
    '../frontend/lib/sitemap/route-discovery.ts'
  );
  const paths = (await getCanonicalPathEntries()).map(({ englishPath }) => englishPath);

  assert.ok(paths.includes('/integrations/claude'));
  assert.ok(paths.includes('/integrations/chatgpt'));
  assert.ok(paths.includes('/integrations/codex'));
  assert.equal(paths.includes('/integrations/openclaw'), false);
  assert.equal(paths.includes('/integrations/n8n'), false);
});

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

test('integration publication keeps live clients intact and fails previews and hidden hosts closed', () => {
  const liveGlobalState = getMcpPublicationState({
    publicMarketing: true,
    publicIndexing: true,
    transport: true,
    oauth: true,
    discovery: true,
    paidGeneration: true,
    trial: false,
    referenceUploads: true,
  });

  assert.deepEqual(
    getMcpIntegrationPublicationState('openclaw', liveGlobalState),
    {
      ...liveGlobalState,
      renderPublicPage: true,
      connectionAvailable: false,
      indexable: false,
      showTrialClaim: false,
      showPaidGenerationClaim: false,
      showReferenceClaim: false,
    },
  );
  assert.deepEqual(getMcpIntegrationPublicationState('claude', liveGlobalState), liveGlobalState);
  assert.equal(
    getMcpIntegrationPublicationState('cursor', liveGlobalState).renderPublicPage,
    false,
  );

  const globallyHidden = { ...liveGlobalState, renderPublicPage: false };
  assert.equal(
    getMcpIntegrationPublicationState('openclaw', globallyHidden).renderPublicPage,
    false,
  );
});

test('integration page data rejects accidental preview indexation', async () => {
  const { buildIntegrationPageData } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-page-data.ts'
  );
  assert.throws(
    () => buildIntegrationPageData({
      client: 'openclaw',
      locale: 'en',
      publication: {
        renderPublicPage: true,
        connectionAvailable: true,
        indexable: true,
        showTrialClaim: false,
        showPaidGenerationClaim: true,
        showReferenceClaim: true,
      },
    }),
    /cannot be indexable in preview_noindex state/,
  );
});

test('the sitemap composes every publication prerequisite from the common build-time source', () => {
  const sitemapConfig = readFileSync('frontend/next-sitemap.config.js', 'utf8');
  assert.match(sitemapConfig, /require\('\.\/config\/mcp-publication\.json'\)/);
  assert.match(sitemapConfig, /require\('\.\/config\/mcp-integrations\.json'\)/);
  assert.match(
    sitemapConfig,
    /const mcpIndexable =\s*mcpPublication\.publicIndexing &&\s*mcpPublication\.transport &&\s*mcpPublication\.oauth &&\s*mcpPublication\.discovery &&\s*mcpPublication\.paidGeneration &&\s*mcpPublication\.referenceUploads;/
  );
  assert.match(
    sitemapConfig,
    /Object\.values\(mcpIntegrations\.integrations\)[\s\S]*site\.publication === 'live'[\s\S]*site\.indexable === true[\s\S]*displayOrder[\s\S]*englishPath/
  );
  assert.match(
    sitemapConfig,
    /if \(mcpIndexable\) \{\s*MCP_PUBLIC_INDEXABLE_PATHS\.forEach\(\(englishPath\) => \{\s*LOCALES\.forEach\(\(locale\) => marketingPaths\.add\(localizePathFromEnglish\(locale, englishPath\)\)\);\s*\}\);\s*\}/
  );
  assert.match(sitemapConfig, /hrefIsAbsolute:\s*true/);
  assert.match(sitemapConfig, /if \(slug === '\/docs\/mcp' && !mcpIndexable\)/);
});
